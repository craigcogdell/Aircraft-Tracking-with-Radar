/**
 * Real-World Multi-SDR Aircraft Radar Controller
 * Supports HackRF One, RTL-SDR, BladeRF, Airspy, Network Feeds, and Live Real-World Airspace
 */

class RadarApp {
    constructor() {
        this.ws = null;
        this.radarCanvas = new RadarCanvas('radarCanvas');
        this.selectedIcao = null;
        this.aircraftMap = new Map();
        this.searchQuery = '';
        this.minAltitude = 0;
        this.categoryFilter = 'ALL';
        this.activeSource = 'hackrf';
        this.availableDevices = {};
        
        this.radarCanvas.maxRangeNM = 50;

        this.initUI();
        this.connectWebSocket();
        this.scanSdrDevices();
    }

    initUI() {
        // Range Buttons (15, 25, 50, 75, 100, 150 Miles)
        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = parseInt(e.target.dataset.range);
                this.updateRange(range);
            });
        });

        // SDR Source Selector
        const sdrSelect = document.getElementById('sdrSourceSelect');
        if (sdrSelect) {
            sdrSelect.addEventListener('change', (e) => {
                this.userSelectedSource = true;
                this.onSdrSourceChanged(e.target.value);
            });
        }

        // Scan SDR Devices Button
        const scanBtn = document.getElementById('scanSdrDevicesBtn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scanSdrDevices());
        }

        // Diagnostics / Health Test Button
        const diagBtn = document.getElementById('diagSdrBtn');
        if (diagBtn) {
            diagBtn.addEventListener('click', () => this.showDiagnosticsModal());
        }

        const closeDiagBtn = document.getElementById('closeDiagModalBtn');
        if (closeDiagBtn) {
            closeDiagBtn.addEventListener('click', () => {
                document.getElementById('diagModal').style.display = 'none';
            });
        }

        // Start / Stop SDR Radio Buttons
        const startSdrBtn = document.getElementById('startSdrBtn');
        if (startSdrBtn) {
            startSdrBtn.addEventListener('click', () => this.startSelectedSdr());
        }

        const stopSdrBtn = document.getElementById('stopSdrBtn');
        if (stopSdrBtn) {
            stopSdrBtn.addEventListener('click', () => this.stopActiveSdr());
        }

        // Browser GPS Auto-Detect Button
        const gpsBtn = document.getElementById('btnUseBrowserGps');
        if (gpsBtn) {
            gpsBtn.addEventListener('click', () => this.detectBrowserGps());
        }

        // Save Station Coordinates Button
        const saveCoordsBtn = document.getElementById('btnSaveStationCoords');
        if (saveCoordsBtn) {
            saveCoordsBtn.addEventListener('click', () => this.saveStationCoords());
        }

        // Audio Toggle & Sample Ping
        const audioBtn = document.getElementById('audioToggleBtn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                const state = window.radarAudio.toggle();
                audioBtn.classList.toggle('active', state);
                audioBtn.innerText = state ? '🔊 RADAR PING: ON' : '🔇 RADAR PING: OFF';
            });
        }

        const testPingBtn = document.getElementById('testPingBtn');
        if (testPingBtn) {
            testPingBtn.addEventListener('click', () => {
                if (window.radarAudio) {
                    window.radarAudio.init();
                    window.radarAudio.playRadarSweepPing();
                }
            });
        }

        // Unlock Web Audio API on first user interaction anywhere
        const unlockAudio = () => {
            if (window.radarAudio) window.radarAudio.init();
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('keydown', unlockAudio);
        };
        document.addEventListener('click', unlockAudio, { once: true });
        document.addEventListener('keydown', unlockAudio, { once: true });

        // Theme Selector
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                const theme = e.target.value;
                document.body.className = `theme-${theme}`;
                this.radarCanvas.theme = theme;
            });
        }

        // Sweep RPM Slider
        const rpmSlider = document.getElementById('sweepRpmSlider');
        if (rpmSlider) {
            rpmSlider.addEventListener('input', (e) => {
                const rpm = parseFloat(e.target.value);
                document.getElementById('sweepRpmVal').innerText = `${rpm} RPM`;
                this.radarCanvas.sweepRPM = rpm;
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ command: 'set_rpm', rpm: rpm }));
                }
            });
        }

        // Layer Toggles
        const airspaceCheck = document.getElementById('toggleAirspaceCheck');
        if (airspaceCheck) {
            airspaceCheck.addEventListener('change', (e) => {
                this.radarCanvas.showAirspace = e.target.checked;
            });
        }

        const coverageCheck = document.getElementById('toggleCoverageCheck');
        if (coverageCheck) {
            coverageCheck.addEventListener('change', (e) => {
                this.radarCanvas.showCoverage = e.target.checked;
            });
        }

        const trailsCheck = document.getElementById('toggleTrailsCheck');
        if (trailsCheck) {
            trailsCheck.addEventListener('change', (e) => {
                this.radarCanvas.showTrails = e.target.checked;
            });
        }

        const vectorsCheck = document.getElementById('toggleVectorsCheck');
        if (vectorsCheck) {
            vectorsCheck.addEventListener('change', (e) => {
                this.radarCanvas.showVectors = e.target.checked;
            });
        }

        const tagsCheck = document.getElementById('toggleTagsCheck');
        if (tagsCheck) {
            tagsCheck.addEventListener('change', (e) => {
                this.radarCanvas.showDataTags = e.target.checked;
            });
        }

        // Contact Search Input
        const searchInput = document.getElementById('searchContactInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toUpperCase().trim();
                this.renderContactsTable();
            });
        }

        // Altitude Filter Slider
        const altSlider = document.getElementById('altFilterSlider');
        if (altSlider) {
            altSlider.addEventListener('input', (e) => {
                this.minAltitude = parseInt(e.target.value);
                document.getElementById('altFilterVal').innerText = `${this.minAltitude} FT`;
                this.renderContactsTable();
            });
        }

        // Category Filter Select
        const catSelect = document.getElementById('aircraftTypeFilterSelect');
        if (catSelect) {
            catSelect.addEventListener('change', (e) => {
                this.categoryFilter = e.target.value;
                this.renderContactsTable();
            });
        }
    }

    onSdrSourceChanged(source) {
        const groups = {
            hackrf: 'hackrfControlsGroup',
            rtlsdr: 'rtlsdrControlsGroup',
            bladerf: 'bladerfControlsGroup',
            airspy: 'airspyControlsGroup',
            network: 'networkControlsGroup',
            live_feed: 'liveFeedControlsGroup',
            dummy_sim: 'dummySimControlsGroup'
        };

        Object.keys(groups).forEach(k => {
            const el = document.getElementById(groups[k]);
            if (el) el.style.display = (k === source) ? 'block' : 'none';
        });

        this.updateDeviceStatusText(source);
    }

    scanSdrDevices() {
        const statusEl = document.getElementById('sdrDeviceStatusText');
        if (statusEl) statusEl.innerText = 'Scanning USB bus & SDR tools...';

        fetch('/api/sdr/devices')
            .then(res => res.json())
            .then(data => {
                this.availableDevices = data;
                const source = document.getElementById('sdrSourceSelect').value;
                this.updateDeviceStatusText(source);
            })
            .catch(() => {
                if (statusEl) statusEl.innerText = 'Error detecting SDR devices';
            });
    }

    updateDeviceStatusText(source) {
        const statusEl = document.getElementById('sdrDeviceStatusText');
        if (!statusEl) return;

        const info = this.availableDevices[source];
        if (!info) {
            statusEl.innerText = 'Checking radio device / simulator...';
            statusEl.style.color = 'var(--text-dim)';
            return;
        }

        if (info.device_found) {
            statusEl.innerHTML = `<span style="color: var(--primary); font-weight: bold;">✅ ${info.detail.toUpperCase()}</span>`;
        } else if (info.available) {
            statusEl.innerHTML = `<span style="color: var(--accent-amber);">⚡ Ready: ${info.detail}</span>`;
        } else {
            statusEl.innerHTML = `<span style="color: var(--accent-red);">❌ ${info.detail}</span>`;
        }
    }

    showDiagnosticsModal() {
        const modal = document.getElementById('diagModal');
        const content = document.getElementById('diagModalContent');
        if (!modal || !content) return;

        modal.style.display = 'flex';
        content.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--primary);">Running live SDR bus diagnostics & RF safety tests...</div>';

        fetch('/api/sdr/diagnostics')
            .then(res => res.json())
            .then(data => {
                const hackrf = data.hackrf || {};
                const rtlsdr = data.rtlsdr || {};
                const prot = data.protection || {};
                const bins = data.binaries || {};

                content.innerHTML = `
                    <div style="margin-bottom: 14px;">
                        <h3 style="color: var(--primary); font-size: 12px; margin: 0 0 6px 0; letter-spacing: 1px;">1. SDR USB HARDWARE STATUS</h3>
                        <div style="background: rgba(0,0,0,0.4); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px;">
                            <div style="margin-bottom: 4px;">
                                <strong>HackRF One:</strong> ${hackrf.device_found ? '<span style="color: var(--primary);">✅ FOUND (' + hackrf.detail + ')</span>' : '<span style="color: var(--accent-red);">❌ ' + hackrf.detail + '</span>'}
                            </div>
                            <div>
                                <strong>RTL-SDR:</strong> ${rtlsdr.device_found ? '<span style="color: var(--primary);">✅ DETECTED (' + rtlsdr.detail + ')</span>' : '<span style="color: var(--text-dim);">No USB Dongle</span>'}
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <h3 style="color: var(--accent-amber); font-size: 12px; margin: 0 0 6px 0; letter-spacing: 1px;">2. HACKRF FRONT-END PROTECTION CHECKLIST</h3>
                        <div style="background: rgba(0,0,0,0.4); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px; line-height: 1.4;">
                            <div style="margin-bottom: 6px;">
                                <strong style="color: var(--accent-red);">⚠️ Max Input Power:</strong> ${prot.max_rf_power}
                            </div>
                            <div style="margin-bottom: 6px;">
                                <strong style="color: var(--primary);">🛡️ 1090 MHz Bandpass Filter:</strong> ${prot.bandpass_filter}
                            </div>
                            <div style="margin-bottom: 6px;">
                                <strong style="color: var(--accent-amber);">⚡ Bias-Tee DC Safety:</strong> ${prot.bias_tee_safety}
                            </div>
                            <div>
                                <strong style="color: var(--accent-cyan);">🎛️ Gain Staging:</strong> ${prot.gain_staging}
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom: 14px;">
                        <h3 style="color: var(--primary); font-size: 12px; margin: 0 0 6px 0; letter-spacing: 1px;">3. DEMODULATION PIPELINE INTEGRITY</h3>
                        <div style="background: rgba(0,0,0,0.4); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px;">
                            <div>• <strong>adsb_demod (8 MSPS / 2 MSPS C Demodulator):</strong> ${bins.adsb_demod_exists ? '<span style="color: var(--primary);">✅ READY (Compiled with CRC Error Correction & DC Filter)</span>' : '<span style="color: var(--accent-red);">❌ MISSING</span>'}</div>
                            <div>• <strong>hackrf_transfer utility:</strong> ${bins.hackrf_transfer ? '<span style="color: var(--primary);">✅ INSTALLED (' + bins.hackrf_transfer + ')</span>' : '<span style="color: var(--accent-red);">❌ MISSING</span>'}</div>
                            <div>• <strong>Live Tracked Scope Aircraft:</strong> <span style="color: var(--primary);">${data.tracked_aircraft_count || 0} active</span></div>
                        </div>
                    </div>

                    <div>
                        <h3 style="color: var(--primary); font-size: 12px; margin: 0 0 6px 0; letter-spacing: 1px;">4. QUICK ACTIONS & RECEPTION TIPS</h3>
                        <div style="background: rgba(0,0,0,0.4); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); font-size: 11px; line-height: 1.4;">
                            <div>1. <strong>Micro-USB Cable:</strong> HackRF is extremely sensitive to cable resistance. Always use a high-quality data cable and plug directly into a motherboards/PC USB port (avoid unpowered hubs).</div>
                            <div>2. <strong>Antenna Line of Sight:</strong> 1090 MHz microwaves cannot penetrate walls or terrain. Position your antenna near a high window or roof.</div>
                            <div>3. <strong>Gain Settings:</strong> Start with LNA=32 dB, VGA=28 dB. If in a clean suburban area, enable the 14 dB pre-amp.</div>
                        </div>
                    </div>
                `;
            })
            .catch(err => {
                content.innerHTML = `<div style="color: var(--accent-red);">Diagnostic scan failed: ${err.message}</div>`;
            });
    }

    startSelectedSdr() {
        const source = document.getElementById('sdrSourceSelect').value;
        const payload = { source: source };

        if (source === 'hackrf') {
            payload.lna_gain = parseInt(document.getElementById('hackrfLnaSlider').value);
            payload.vga_gain = parseInt(document.getElementById('hackrfVgaSlider').value);
            payload.amp = document.getElementById('hackrfAmpToggle').checked ? 1 : 0;
            payload.bias_tee = document.getElementById('hackrfBiasTeeToggle').checked ? 1 : 0;
            payload.sample_rate = parseInt(document.getElementById('hackrfSampleRateSelect').value);
        } else if (source === 'rtlsdr') {
            payload.gain = parseFloat(document.getElementById('rtlGainSlider').value);
            payload.ppm = parseInt(document.getElementById('rtlPpmSlider').value);
            payload.bias_tee = document.getElementById('rtlBiasTeeToggle').checked ? 1 : 0;
            payload.sample_rate = 2000000;
        } else if (source === 'bladerf') {
            payload.rx_gain = parseInt(document.getElementById('bladeGainSlider').value);
            payload.sample_rate = 8000000;
        } else if (source === 'airspy') {
            payload.gain = parseInt(document.getElementById('airspyGainSlider').value);
            payload.bias_tee = document.getElementById('airspyBiasTeeToggle').checked ? 1 : 0;
            payload.sample_rate = 6000000;
        } else if (source === 'network') {
            payload.host = document.getElementById('netHostInput').value;
            payload.port = parseInt(document.getElementById('netPortInput').value);
            payload.mode = document.getElementById('netModeSelect').value;
        } else if (source === 'live_feed' || source === 'dummy_sim') {
            payload.lat = this.radarCanvas.stationLat;
            payload.lon = this.radarCanvas.stationLon;
            payload.range_nm = this.radarCanvas.maxRangeNM;
        }


        const startBtn = document.getElementById('startSdrBtn');
        if (startBtn) startBtn.innerText = 'Starting...';

        fetch('/api/sdr/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (startBtn) startBtn.innerText = '▶ Apply & Start';
            const statusText = document.getElementById('sdrLiveStatsText');
            if (statusText) statusText.innerText = data.message || 'Radio Active';
            document.getElementById('activeRadioVal').innerText = source.toUpperCase();
        })
        .catch(err => {
            if (startBtn) startBtn.innerText = '▶ Apply & Start';
            console.error('Error starting SDR:', err);
        });
    }

    stopActiveSdr() {
        fetch('/api/sdr/stop', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                const statusText = document.getElementById('sdrLiveStatsText');
                if (statusText) statusText.innerText = 'SDR Receiver Stopped';
            });
    }

    detectBrowserGps() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        const gpsBtn = document.getElementById('btnUseBrowserGps');
        gpsBtn.innerText = 'Acquiring GPS...';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                document.getElementById('stationLatInput').value = lat.toFixed(4);
                document.getElementById('stationLonInput').value = lon.toFixed(4);
                document.getElementById('stationNameInput').value = 'My Station (GPS)';
                this.saveStationCoords();
                gpsBtn.innerText = '✅ Location Calibrated!';
                setTimeout(() => { gpsBtn.innerText = '🎯 Set to My Exact GPS Location'; }, 3000);
            },
            (err) => {
                alert(`GPS Error: ${err.message}. You can type your Lat/Lon coordinates manually.`);
                gpsBtn.innerText = '🎯 Set to My Exact GPS Location';
            }
        );
    }

    saveStationCoords() {
        const lat = parseFloat(document.getElementById('stationLatInput').value);
        const lon = parseFloat(document.getElementById('stationLonInput').value);
        const name = document.getElementById('stationNameInput').value || 'Swansea Base';

        fetch('/api/station', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                lat: lat,
                lon: lon,
                range_nm: this.radarCanvas.maxRangeNM
            })
        })
        .then(res => res.json())
        .then(data => {
            console.log('Station updated:', data);
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            document.getElementById('wsStatusBadge').innerText = 'LIVE SDR FEED';
            document.getElementById('wsStatusBadge').style.borderColor = 'var(--primary)';
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleRadarState(data);
            } catch (e) {
                console.error('Error parsing radar WS:', e);
            }
        };

        this.ws.onclose = () => {
            document.getElementById('wsStatusBadge').innerText = 'DISCONNECTED';
            document.getElementById('wsStatusBadge').style.borderColor = 'var(--accent-red)';
            setTimeout(() => this.connectWebSocket(), 2000);
        };
    }

    handleRadarState(data) {
        this.radarCanvas.updateData(data);

        this.aircraftMap.clear();
        (data.aircraft || []).forEach(ac => {
            this.aircraftMap.set(ac.icao, ac);
        });

        if (data.stats) {
            document.getElementById('inRangeContactsVal').innerText = data.stats.in_range_contacts || 0;
            
            const emCount = data.stats.emergencies_count || 0;
            const emEl = document.getElementById('emergencyCountVal');
            emEl.innerText = emCount;
            if (emCount > 0) {
                emEl.className = 'telemetry-value emergency-alert';
                if (window.radarAudio) {
                    window.radarAudio.playEmergencyAlert();
                }
            } else {
                emEl.className = 'telemetry-value';
            }
        }

        if (data.station) {
            document.getElementById('stationNameVal').innerText = data.station.name;
            document.getElementById('stationCoordsVal').innerText = `${data.station.lat.toFixed(2)}°, ${data.station.lon.toFixed(2)}°`;
            document.getElementById('rangeIndicatorVal').innerText = `${data.station.max_range_nm} MILES`;
        }

        if (data.source) {
            this.activeSource = data.source.active || 'hackrf';
            const sdrSelect = document.getElementById('sdrSourceSelect');
            if (sdrSelect && !this.userSelectedSource && sdrSelect.value !== this.activeSource) {
                sdrSelect.value = this.activeSource;
                this.onSdrSourceChanged(this.activeSource);
            }
            document.getElementById('activeRadioVal').innerText = (data.source.stats && data.source.stats.device) ? data.source.stats.device : this.activeSource.toUpperCase();
            
            if (data.source.stats) {
                const stats = data.source.stats;
                document.getElementById('sdrLiveStatsText').innerText = stats.status || 'Active';
                if (stats.packet_rate_fps !== undefined) {
                    document.getElementById('packetRateVal').innerText = `${stats.packet_rate_fps} FPS`;
                }
            }
        }

        this.renderTargetInspector();
        this.renderContactsTable();
    }

    selectAircraft(icao) {
        this.selectedIcao = icao;
        this.radarCanvas.selectedIcao = icao;
        const lockIndicator = document.getElementById('targetLockStatusIndicator');
        if (lockIndicator) {
            lockIndicator.innerText = icao ? `LOCKED: ${icao}` : 'CLICK TARGET';
            lockIndicator.style.color = icao ? 'var(--primary)' : 'var(--text-dim)';
        }
        this.renderTargetInspector();
        this.renderContactsTable();
    }

    updateRange(nm) {
        this.radarCanvas.maxRangeNM = nm;
        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.range) === nm);
        });
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ command: 'set_range', range_nm: nm }));
        }
    }

    renderTargetInspector() {
        const container = document.getElementById('targetInspectorContent');
        if (!container) return;

        if (!this.selectedIcao || !this.aircraftMap.has(this.selectedIcao)) {
            container.innerHTML = `
                <div style="padding: 28px 14px; text-align: center; color: var(--text-dim);">
                    <div style="font-size: 36px; margin-bottom: 8px;">📡</div>
                    <div style="font-size: 13px; font-weight: bold; letter-spacing: 1.5px; color: var(--primary);">NO AIRCRAFT LOCKED</div>
                    <div style="font-size: 11px; margin-top: 6px; line-height: 1.4;">
                        Click any real aircraft contact on the radar scope or in the table below to inspect live SDR telemetry, heading, speed, squawk, and flight coordinates.
                    </div>
                </div>
            `;
            return;
        }

        const ac = this.aircraftMap.get(this.selectedIcao);
        
        // Cardinal direction helper
        const getCardinal = (deg) => {
            if (deg === null || deg === undefined) return '';
            const val = Math.floor((deg / 22.5) + 0.5);
            const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
            return arr[(val % 16)];
        };

        const hdgDeg = ac.heading !== null ? Math.round(ac.heading) : null;
        const hdgCard = hdgDeg !== null ? getCardinal(hdgDeg) : '';
        const hdgStr = hdgDeg !== null ? `${hdgDeg.toString().padStart(3, '0')}° ${hdgCard}` : '---';

        const brgDeg = ac.bearing_deg !== null ? Math.round(ac.bearing_deg) : null;
        const brgCard = brgDeg !== null ? getCardinal(brgDeg) : '';
        const brgStr = brgDeg !== null ? `${brgDeg.toString().padStart(3, '0')}° ${brgCard}` : '---';

        // Formatted strings
        const altFtStr = ac.alt ? `${ac.alt.toLocaleString()} FT` : '---';
        const flStr = ac.flight_level ? `(${ac.flight_level})` : '';
        const altMStr = ac.alt_m ? `${ac.alt_m.toLocaleString()} m` : '';
        
        const spdKtsStr = ac.speed ? `${ac.speed} KTS` : '---';
        const spdMphStr = ac.speed_mph ? `${ac.speed_mph} MPH` : '';
        const spdKmhStr = ac.speed_kmh ? `${ac.speed_kmh} KM/H` : '';
        const machStr = ac.mach ? `M${ac.mach}` : '';
        
        const distStr = ac.distance_nm ? `${ac.distance_nm.toFixed(1)} NM (${ac.distance_mi} mi / ${ac.distance_km} km)` : '---';
        
        const sigFillPct = Math.max(5, Math.min(100, ac.signal_quality || 50));
        const sigColor = (sigFillPct > 70) ? 'var(--primary)' : (sigFillPct > 40 ? 'var(--accent-amber)' : 'var(--accent-red)');

        // Dynamic SVG Compass Rose Dial
        const compassSvg = hdgDeg !== null ? `
            <svg class="target-compass-svg" width="68" height="68" viewBox="0 0 68 68" style="overflow: visible;">
                <circle cx="34" cy="34" r="30" fill="rgba(0,0,0,0.55)" stroke="var(--border-color)" stroke-width="1.5" />
                <circle cx="34" cy="34" r="22" fill="none" stroke="var(--primary-dim)" stroke-width="1" stroke-dasharray="2,3" />
                <!-- Cardinal Labels -->
                <text x="34" y="11" fill="var(--primary)" font-size="8" text-anchor="middle" font-weight="bold">N</text>
                <text x="61" y="37" fill="var(--text-dim)" font-size="7" text-anchor="middle">E</text>
                <text x="34" y="62" fill="var(--text-dim)" font-size="7" text-anchor="middle">S</text>
                <text x="7" y="37" fill="var(--text-dim)" font-size="7" text-anchor="middle">W</text>
                <!-- Rotating Pointer Arrow -->
                <g transform="rotate(${hdgDeg} 34 34)">
                    <polygon points="34,13 38.5,34 34,30 29.5,34" fill="var(--primary)" filter="drop-shadow(0 0 4px var(--primary))" />
                    <polygon points="34,51 36,34 34,36 32,34" fill="rgba(255,255,255,0.4)" />
                    <circle cx="34" cy="34" r="2.5" fill="var(--bg-dark)" stroke="var(--primary)" stroke-width="1.2" />
                </g>
            </svg>
        ` : `
            <svg class="target-compass-svg" width="68" height="68" viewBox="0 0 68 68">
                <circle cx="34" cy="34" r="30" fill="rgba(0,0,0,0.4)" stroke="var(--border-color)" stroke-width="1" />
                <text x="34" y="38" fill="var(--text-dim)" font-size="10" text-anchor="middle">N/A</text>
            </svg>
        `;

        // Flight Tracker External Lookup URLs
        const cleanCallsign = ac.callsign && ac.callsign !== '---' ? encodeURIComponent(ac.callsign) : '';
        const fr24Url = cleanCallsign ? `https://www.flightradar24.com/${cleanCallsign}` : `https://www.flightradar24.com/${ac.lat},${ac.lon}/9`;
        const adsbxUrl = `https://globe.adsbexchange.com/?icao=${ac.icao}`;
        const radarboxUrl = cleanCallsign ? `https://www.radarbox.com/data/flights/${cleanCallsign}` : `https://www.radarbox.com/?lat=${ac.lat}&lng=${ac.lon}&z=9`;
        const flightawareUrl = cleanCallsign ? `https://www.flightaware.com/live/flight/${cleanCallsign}` : `https://www.flightaware.com/live/modes/${ac.icao}`;

        container.innerHTML = `
            <div class="target-card-header">
                <span class="target-locked-tag ${ac.is_emergency ? 'emergency' : ''}">${ac.is_emergency ? '🚨 EMERGENCY' : 'TARGET LOCKED'}</span>
                <div class="target-callsign-lg">${ac.country_flag || '✈️'} ${ac.callsign}</div>
                <div class="target-airline-sub">${ac.airline}</div>
                <div class="target-icao-sub">ICAO: 0x${ac.icao} • ${ac.country} (${ac.type})</div>
            </div>

            <!-- Tactical Heading & Speed Compass Card -->
            <div class="target-compass-row">
                ${compassSvg}
                <div class="target-compass-info">
                    <div style="font-size: 9px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px;">Flight Heading & Speed</div>
                    <div class="target-compass-hdg">HDG ${hdgStr}</div>
                    <div class="target-compass-spd">SPD ${spdKtsStr} <span style="font-size: 11px; font-weight: normal; color: var(--text-dim);">(${spdMphStr})</span></div>
                    <div class="target-compass-sub">${spdKmhStr} ${machStr ? '• ' + machStr : ''}</div>
                </div>
            </div>

            <div class="target-grid">
                <!-- Altitude -->
                <div class="target-cell">
                    <div class="target-cell-label">Altitude (Baro)</div>
                    <div class="target-cell-val" style="color: var(--primary);">${altFtStr} ${flStr}</div>
                    <div class="target-cell-sub">${altMStr}</div>
                </div>

                <!-- Vertical Rate Trend -->
                <div class="target-cell">
                    <div class="target-cell-label">Vertical Trend</div>
                    <div class="target-cell-val" style="color: ${ac.vrate > 200 ? 'var(--primary)' : (ac.vrate < -200 ? 'var(--accent-amber)' : 'var(--text-dim)')}">
                        ${ac.vtrend || 'LEVEL ━'}
                    </div>
                </div>

                <!-- Ground Speed -->
                <div class="target-cell">
                    <div class="target-cell-label">Ground Speed</div>
                    <div class="target-cell-val">${spdKtsStr}</div>
                    <div class="target-cell-sub">${spdMphStr}</div>
                </div>

                <!-- Track / Heading -->
                <div class="target-cell">
                    <div class="target-cell-label">True Track / Heading</div>
                    <div class="target-cell-val">${hdgStr}</div>
                    <div class="target-cell-sub">Heading vector</div>
                </div>

                <!-- Distance & Bearing from Radar Station -->
                <div class="target-cell span-full">
                    <div class="target-cell-label">Distance & Bearing to Radar</div>
                    <div class="target-cell-val">${distStr}</div>
                    <div class="target-cell-sub">Azimuth: ${brgStr} relative to Swansea Base</div>
                </div>

                <!-- Transponder Squawk Code -->
                <div class="target-cell span-full">
                    <div class="target-cell-label">Transponder Squawk Code</div>
                    <div class="target-cell-val" style="color: ${ac.is_emergency ? 'var(--accent-red)' : 'var(--primary)'}">
                        ${ac.squawk}
                    </div>
                    <div class="target-cell-sub" style="color: ${ac.is_emergency ? 'var(--accent-red)' : 'var(--text-color)'}">${ac.squawk_desc}</div>
                </div>

                <!-- RF Radio Signal Quality -->
                <div class="target-cell span-full">
                    <div class="target-cell-label">SDR Radio Signal Quality</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                        <span class="target-cell-val" style="color: ${sigColor};">${ac.signal_db} dB</span>
                        <span style="font-size: 10px; color: var(--text-dim);">${ac.msg_count} packets (${ac.receiver_source})</span>
                    </div>
                    <div class="signal-meter-bar">
                        <div class="signal-meter-fill" style="width: ${sigFillPct}%; background: ${sigColor}; box-shadow: 0 0 6px ${sigColor};"></div>
                    </div>
                </div>

                <!-- Exact GPS Coordinates -->
                <div class="target-cell span-full">
                    <div class="target-cell-label">Exact Geolocation</div>
                    <div class="target-cell-val" style="font-size: 11px;">${ac.lat !== null ? `${ac.lat.toFixed(5)}°, ${ac.lon.toFixed(5)}°` : '---'}</div>
                    <div class="target-cell-sub">${ac.dms}</div>
                </div>

                <!-- Downlink Protocol & Age -->
                <div class="target-cell span-full">
                    <div class="target-cell-label">Mode-S Frame Protocol</div>
                    <div class="target-cell-sub" style="color: var(--text-color);">${ac.downlink_format}</div>
                    <div class="target-cell-sub" style="color: var(--text-dim);">Last seen: ${ac.age_sec}s ago • First heard: ${Math.round((Date.now()/1000 - ac.last_seen))}s ago</div>
                </div>
            </div>

            <!-- External Flight Trackers -->
            <div style="margin-top: 10px;">
                <div style="font-size: 10px; color: var(--text-dim); margin-bottom: 4px; text-transform: uppercase;">External Live Flight Lookup:</div>
                <div class="flight-links-grid">
                    <a href="${fr24Url}" target="_blank" rel="noopener noreferrer" class="btn-flight-link">🌐 FlightRadar24</a>
                    <a href="${adsbxUrl}" target="_blank" rel="noopener noreferrer" class="btn-flight-link">📡 ADS-B Exchange</a>
                    <a href="${radarboxUrl}" target="_blank" rel="noopener noreferrer" class="btn-flight-link">✈️ RadarBox</a>
                    <a href="${flightawareUrl}" target="_blank" rel="noopener noreferrer" class="btn-flight-link">🗺️ FlightAware</a>
                </div>
            </div>
        `;
    }

    renderContactsTable() {
        const tbody = document.getElementById('contactsTableBody');
        if (!tbody) return;

        let list = Array.from(this.aircraftMap.values());

        if (this.searchQuery) {
            list = list.filter(a => a.callsign.includes(this.searchQuery) || a.icao.includes(this.searchQuery) || (a.airline && a.airline.toUpperCase().includes(this.searchQuery)));
        }

        if (this.minAltitude > 0) {
            list = list.filter(a => (a.alt || 0) >= this.minAltitude);
        }

        if (this.categoryFilter !== 'ALL') {
            if (this.categoryFilter === 'Emergency') {
                list = list.filter(a => a.is_emergency);
            } else {
                list = list.filter(a => (a.type && a.type.toLowerCase().includes(this.categoryFilter.toLowerCase())));
            }
        }

        list.sort((a, b) => {
            if (a.is_emergency && !b.is_emergency) return -1;
            if (!a.is_emergency && b.is_emergency) return 1;
            return (a.distance_nm || 999) - (b.distance_nm || 999);
        });

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align: center; color: var(--text-dim); padding: 16px;">
                        Listening on 1090 MHz SDR (${this.activeSource.toUpperCase()}). Waiting for real physical aircraft in coverage scope...
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(ac => {
            const isSelected = ac.icao === this.selectedIcao;
            const altText = ac.alt ? `${Math.round(ac.alt)} ft` : '---';
            const spdText = ac.speed ? `${Math.round(ac.speed)} kt` : '---';
            const distText = ac.distance_nm ? `${ac.distance_nm.toFixed(1)} NM` : '---';
            const brgText = ac.bearing_deg !== null ? `${ac.bearing_deg.toFixed(0)}°` : '---';

            return `
                <tr class="${isSelected ? 'selected' : ''} ${ac.is_emergency ? 'emergency-row' : ''}" onclick="window.radarApp.selectAircraft('${ac.icao}')">
                    <td style="font-weight: bold; color: ${ac.is_emergency ? 'var(--accent-red)' : 'var(--primary)'}">${ac.callsign}</td>
                    <td>0x${ac.icao}</td>
                    <td>${ac.country_flag || '✈️'}</td>
                    <td>${ac.airline || '---'}</td>
                    <td>${ac.type}</td>
                    <td>${altText}</td>
                    <td>${spdText}</td>
                    <td>${ac.heading !== null ? ac.heading + '°' : '---'}</td>
                    <td>${distText}</td>
                    <td>${brgText}</td>
                    <td style="color: ${ac.is_emergency ? 'var(--accent-red)' : 'var(--text-color)'}">${ac.squawk}</td>
                    <td>${ac.signal_db} dB</td>
                    <td style="font-size: 10px; color: var(--text-dim);">${ac.receiver_source || 'SDR'}</td>
                </tr>
            `;
        }).join('');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.radarApp = new RadarApp();
});


/**
 * Tactical Radar PPI (Plan Position Indicator) Canvas Renderer
 * Brings the radar scope to life with realistic sweep discovery,
 * CRT P7 phosphor decay, interactive target lock & hover HUD,
 * forward velocity vectors, and authentic sweep revolution acoustics.
 */

class RadarCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.aircraftList = [];
        this.selectedIcao = null;
        this.hoveredIcao = null;
        this.mousePos = null;
        
        // Radar configuration (50 Miles default)
        this.maxRangeNM = 50;
        this.sweepRPM = 15;
        this.sweepAngle = 0;
        this.lastFrameTime = performance.now();
        
        // Station Coordinates (Default Swansea Base SA1 8LY)
        this.stationLat = 51.6214;
        this.stationLon = -3.9436;
        this.stationName = "Swansea Base (SA1 8LY)";

        // Polar Max Range Coverage History: deg (0-359) -> max_distance_nm
        this.polarCoverage = new Float32Array(360);
        
        // Track aircraft that have been illuminated by the sweep beam
        this.revealedAircraft = new Set();
        // Blip phosphor decay state: icao -> brightness (0.0 to 1.0)
        this.blipDecay = {};
        // Timestamp of when the target was last swept by the beam
        this.blipSweepFlash = {};
        
        // Central station beacon pulse animation
        this.beaconPulseRadius = 0;
        
        // Display options
        this.showTrails = true;
        this.showDataTags = true;
        this.showVectors = true;
        this.showAirspace = true;
        this.showCoverage = true;
        this.theme = 'green';
        
        // Local Airfields & Nav Waypoints relative to South Wales
        this.airspaceWaypoints = [
            { name: "EGFH Swansea", lat: 51.6053, lon: -4.0678, type: "airfield" },
            { name: "EGFF Cardiff", lat: 51.3967, lon: -3.3433, type: "airfield" },
            { name: "EGDX St Athan", lat: 51.4050, lon: -3.4319, type: "airfield" },
            { name: "EGFP Pembrey", lat: 51.7139, lon: -4.3183, type: "airfield" },
            { name: "EGGD Bristol", lat: 51.3827, lon: -2.7191, type: "airfield" },
            { name: "BCN VOR", lat: 51.9897, lon: -3.3356, type: "vor" },
            { name: "EXMOR", lat: 51.2000, lon: -3.8000, type: "fix" },
            { name: "KIDLI", lat: 51.6667, lon: -4.3000, type: "fix" },
            { name: "NUMPO", lat: 51.3500, lon: -4.6000, type: "fix" },
            { name: "ALVIN", lat: 51.4833, lon: -2.9833, type: "fix" }
        ];

        this.setupDPI();
        window.addEventListener('resize', () => this.setupDPI());
        
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    setupDPI() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) - 10;
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = `${size}px`;
        this.canvas.style.height = `${size}px`;
        
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
        this.size = size;
        this.center = size / 2;
        this.radius = (size / 2) - 34;
    }

    getThemeColors() {
        if (this.theme === 'amber') {
            return {
                primary: '#ffaa00',
                primaryGlow: 'rgba(255, 170, 0, 0.45)',
                primaryDim: 'rgba(255, 170, 0, 0.15)',
                bezel: '#8c6000',
                text: '#ffe6b3',
                sweep: 'rgba(255, 170, 0, 0.28)',
                waypoint: '#cc8800',
                civilian: '#ffaa00',
                military: '#ffcc00',
                emergency: '#ff3344',
                flash: '#ffffff'
            };
        } else if (this.theme === 'cyan') {
            return {
                primary: '#00e5ff',
                primaryGlow: 'rgba(0, 229, 255, 0.45)',
                primaryDim: 'rgba(0, 229, 255, 0.15)',
                bezel: '#007788',
                text: '#d1f7ff',
                sweep: 'rgba(0, 229, 255, 0.28)',
                waypoint: '#0099bb',
                civilian: '#00e5ff',
                military: '#66ffff',
                emergency: '#ff3344',
                flash: '#ffffff'
            };
        } else if (this.theme === 'red') {
            return {
                primary: '#ff3355',
                primaryGlow: 'rgba(255, 51, 85, 0.45)',
                primaryDim: 'rgba(255, 51, 85, 0.15)',
                bezel: '#881122',
                text: '#ffd6dc',
                sweep: 'rgba(255, 51, 85, 0.28)',
                waypoint: '#aa2233',
                civilian: '#ff3355',
                military: '#ff6688',
                emergency: '#ffff00',
                flash: '#ffffff'
            };
        }
        return {
            primary: '#00ff66',
            primaryGlow: 'rgba(0, 255, 102, 0.45)',
            primaryDim: 'rgba(0, 255, 102, 0.15)',
            bezel: '#008833',
            text: '#d0f8df',
            sweep: 'rgba(0, 255, 102, 0.28)',
            waypoint: '#00aa44',
            civilian: '#00ff66',
            military: '#66ffaa',
            emergency: '#ff3344',
            flash: '#ffffff'
        };
    }

    updateData(data) {
        if (data.aircraft) {
            this.aircraftList = data.aircraft;
            
            // If sweep RPM is 0 (static radar mode), reveal all in-range aircraft
            if (this.sweepRPM === 0) {
                data.aircraft.forEach(ac => {
                    this.revealedAircraft.add(ac.icao);
                    this.blipDecay[ac.icao] = 1.0;
                });
            }

            // Record max polar distance history
            data.aircraft.forEach(ac => {
                if (ac.bearing_deg !== null && ac.distance_nm !== null) {
                    const b = Math.floor(ac.bearing_deg) % 360;
                    if (ac.distance_nm > this.polarCoverage[b]) {
                        this.polarCoverage[b] = ac.distance_nm;
                    }
                }
            });
        }
        if (data.station) {
            if (data.station.max_range_nm) this.maxRangeNM = data.station.max_range_nm;
            if (data.station.sweep_rpm !== undefined) this.sweepRPM = data.station.sweep_rpm;
            if (data.station.lat) this.stationLat = data.station.lat;
            if (data.station.lon) this.stationLon = data.station.lon;
            if (data.station.name) this.stationName = data.station.name;
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.mousePos = { x: mouseX, y: mouseY };

        const cx = this.center;
        const cy = this.center;

        let closestAc = null;
        let minDist = 30; // 30px hit radius

        this.aircraftList.forEach(ac => {
            // Only consider targets that have appeared on our radar scope
            if (this.sweepRPM > 0 && !this.revealedAircraft.has(ac.icao)) return;
            if (ac.distance_nm === null || ac.bearing_deg === null || ac.distance_nm > this.maxRangeNM) return;

            const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
            const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
            const ax = cx + distPx * Math.cos(bearingRad);
            const ay = cy + distPx * Math.sin(bearingRad);

            const d = Math.hypot(mouseX - ax, mouseY - ay);
            if (d < minDist) {
                minDist = d;
                closestAc = ac;
            }
        });

        this.hoveredIcao = closestAc ? closestAc.icao : null;
        this.canvas.style.cursor = closestAc ? 'pointer' : 'crosshair';
    }

    handleMouseLeave() {
        this.hoveredIcao = null;
        this.mousePos = null;
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const cx = this.center;
        const cy = this.center;

        let closestAc = null;
        let minDist = 32; // Generous 32px clickable radius

        this.aircraftList.forEach(ac => {
            // Only allow clicking targets that have appeared on our radar screen
            if (this.sweepRPM > 0 && !this.revealedAircraft.has(ac.icao)) return;
            if (ac.distance_nm === null || ac.bearing_deg === null || ac.distance_nm > this.maxRangeNM) return;

            const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
            const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
            const ax = cx + distPx * Math.cos(bearingRad);
            const ay = cy + distPx * Math.sin(bearingRad);

            const d = Math.hypot(clickX - ax, clickY - ay);
            if (d < minDist) {
                minDist = d;
                closestAc = ac;
            }
        });

        if (closestAc) {
            this.selectedIcao = closestAc.icao;
            if (window.radarApp) {
                window.radarApp.selectAircraft(closestAc.icao);
            }
            if (window.radarAudio) {
                window.radarAudio.playLock();
            }
        } else {
            this.selectedIcao = null;
            if (window.radarApp) {
                window.radarApp.selectAircraft(null);
            }
        }
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = Math.sign(e.deltaY);
        const ranges = [15, 25, 50, 75, 100, 150];
        let idx = ranges.indexOf(this.maxRangeNM);
        if (idx === -1) idx = 2;

        if (delta > 0 && idx < ranges.length - 1) {
            this.maxRangeNM = ranges[idx + 1];
        } else if (delta < 0 && idx > 0) {
            this.maxRangeNM = ranges[idx - 1];
        }

        if (window.radarApp) {
            window.radarApp.updateRange(this.maxRangeNM);
        }
    }

    render(timestamp) {
        const dt = Math.min(0.1, (timestamp - this.lastFrameTime) / 1000.0);
        this.lastFrameTime = timestamp;

        if (this.sweepRPM > 0) {
            const degPerSec = this.sweepRPM * 6.0;
            const prevAngle = this.sweepAngle;
            this.sweepAngle = (this.sweepAngle + degPerSec * dt) % 360.0;
            
            // Check sweep revolution and target intersections
            this.checkSweepIntersection(prevAngle, this.sweepAngle);
        }

        // Animate central station pulse ring
        this.beaconPulseRadius += dt * 25.0;
        if (this.beaconPulseRadius > 70) {
            this.beaconPulseRadius = 0;
        }

        const ctx = this.ctx;
        const c = this.center;
        const r = this.radius;
        const colors = this.getThemeColors();

        ctx.clearRect(0, 0, this.size, this.size);

        // 1. CRT Background Grid & Range Rings
        this.drawRadarGrid(ctx, c, r, colors);

        // 2. Central Station Beacon Pulse Rings
        this.drawStationBeacon(ctx, c, colors);

        // 3. Antenna Polar Coverage Heatmap
        if (this.showCoverage) {
            this.drawPolarCoverage(ctx, c, r, colors);
        }

        // 4. Airspace & Airfield Waypoints
        if (this.showAirspace) {
            this.drawAirspaceWaypoints(ctx, c, r, colors);
        }

        // 5. Outer Degree Bezel (0-359 deg)
        this.drawDegreeBezel(ctx, c, r, colors);

        // 6. Rotating Sweep Beam
        if (this.sweepRPM > 0) {
            this.drawSweepBeam(ctx, c, r, colors);
        }

        // 7. Live Aircraft Targets & Phosphor Blips (Only displayed once swept!)
        this.drawAircraftTargets(ctx, c, r, colors, dt);

        // 8. Selected Target Lock Reticle & Bearing Vector Line to Station
        this.drawTargetLockReticle(ctx, c, r, colors);

        // 9. Target Hover HUD / Tooltip
        this.drawHoverTooltip(ctx, c, r, colors);

        requestAnimationFrame(this.render);
    }

    drawRadarGrid(ctx, cx, cy, colors) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 18, 9, 0.55)';
        ctx.fill();
        ctx.strokeStyle = colors.primaryDim;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Cardinal Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - this.radius, cy);
        ctx.lineTo(cx + this.radius, cy);
        ctx.moveTo(cx, cy - this.radius);
        ctx.lineTo(cx, cy + this.radius);
        ctx.strokeStyle = colors.primaryDim;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 30-degree radial lines
        ctx.beginPath();
        for (let a = 30; a < 360; a += 30) {
            if (a % 90 === 0) continue;
            const rad = (a - 90) * (Math.PI / 180.0);
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + this.radius * Math.cos(rad), cy + this.radius * Math.sin(rad));
        }
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.08)';
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Concentric Distance Range Rings
        const ringSteps = [0.25, 0.5, 0.75, 1.0];
        ctx.fillStyle = colors.text;
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';

        ringSteps.forEach(step => {
            const ringR = this.radius * step;
            ctx.beginPath();
            ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = colors.primaryDim;
            ctx.lineWidth = 1;
            ctx.stroke();

            const distLabel = `${(this.maxRangeNM * step).toFixed(step === 0.25 ? 1 : 0)} MI`;
            ctx.fillText(distLabel, cx + 4, cy - ringR + 12);
        });

        ctx.restore();
    }

    drawStationBeacon(ctx, cx, colors) {
        ctx.save();
        const cy = cx;

        // Expanding tactical pulse ring radiating outward from Swansea station
        if (this.beaconPulseRadius > 1) {
            const alpha = Math.max(0, 1.0 - (this.beaconPulseRadius / 70.0));
            ctx.beginPath();
            ctx.arc(cx, cy, this.beaconPulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 255, 102, ${alpha * 0.4})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        // Center station glowing dot
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = colors.primary;
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 8;
        ctx.fill();

        ctx.restore();
    }

    drawPolarCoverage(ctx, cx, cy, colors) {
        let hasData = false;
        for (let i = 0; i < 360; i++) {
            if (this.polarCoverage[i] > 0) { hasData = true; break; }
        }
        if (!hasData) return;

        ctx.save();
        ctx.beginPath();
        let started = false;

        for (let deg = 0; deg < 360; deg += 3) {
            const dist = this.polarCoverage[deg] || 0;
            const distPx = Math.min(this.radius, (dist / this.maxRangeNM) * this.radius);
            const rad = (deg - 90) * (Math.PI / 180.0);
            const x = cx + distPx * Math.cos(rad);
            const y = cy + distPx * Math.sin(rad);

            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 255, 102, 0.04)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    drawAirspaceWaypoints(ctx, cx, cy, colors) {
        ctx.save();
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.fillStyle = colors.waypoint;
        ctx.strokeStyle = colors.waypoint;

        this.airspaceWaypoints.forEach(wp => {
            const dLat = (wp.lat - this.stationLat) * 60.0;
            const dLon = (wp.lon - this.stationLon) * 60.0 * Math.cos(this.stationLat * Math.PI / 180.0);
            const dist = Math.hypot(dLon, dLat);
            if (dist > this.maxRangeNM * 1.05) return;

            const bearingRad = Math.atan2(dLon, dLat);
            const distPx = (dist / this.maxRangeNM) * this.radius;

            const x = cx + distPx * Math.sin(bearingRad);
            const y = cy - distPx * Math.cos(bearingRad);

            if (wp.type === 'airfield') {
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(x, y - 4);
                ctx.lineTo(x + 3.5, y + 3);
                ctx.lineTo(x - 3.5, y + 3);
                ctx.closePath();
                ctx.stroke();
            }

            ctx.fillText(wp.name, x + 6, y + 3);
        });

        ctx.restore();
    }

    drawDegreeBezel(ctx, cx, cy, colors) {
        ctx.save();
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let deg = 0; deg < 360; deg += 2) {
            const rad = (deg - 90) * (Math.PI / 180.0);
            const is30 = deg % 30 === 0;
            const is10 = deg % 10 === 0;
            
            const tickLen = is30 ? 12 : (is10 ? 8 : 4);
            const rStart = this.radius + 2;
            const rEnd = rStart + tickLen;

            ctx.beginPath();
            ctx.moveTo(cx + rStart * Math.cos(rad), cy + rStart * Math.sin(rad));
            ctx.lineTo(cx + rEnd * Math.cos(rad), cy + rEnd * Math.sin(rad));
            ctx.strokeStyle = is30 ? colors.primary : (is10 ? colors.primaryGlow : colors.primaryDim);
            ctx.lineWidth = is30 ? 1.5 : 1;
            ctx.stroke();

            if (is30) {
                const textR = this.radius + 24;
                let label = `${deg.toString().padStart(3, '0')}°`;
                if (deg === 0) label = 'N';
                else if (deg === 90) label = 'E';
                else if (deg === 180) label = 'S';
                else if (deg === 270) label = 'W';

                ctx.fillStyle = (deg % 90 === 0) ? colors.primary : colors.text;
                ctx.fillText(label, cx + textR * Math.cos(rad), cy + textR * Math.sin(rad));
            }
        }
        ctx.restore();
    }

    drawSweepBeam(ctx, cx, cy, colors) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
        ctx.clip();

        const sweepRad = (this.sweepAngle - 90) * (Math.PI / 180.0);
        const trailSpanRad = 55 * (Math.PI / 180.0); // 55-degree phosphor decay fan

        const startAngle = sweepRad - trailSpanRad;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.radius);
        gradient.addColorStop(0, 'rgba(0, 255, 102, 0.04)');
        gradient.addColorStop(0.8, colors.sweep);
        gradient.addColorStop(1, colors.sweep);

        // Phosphor decay sector
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, this.radius, startAngle, sweepRad);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Neon leading sweep beam line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + this.radius * Math.cos(sweepRad), cy + this.radius * Math.sin(sweepRad));
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 12;
        ctx.stroke();

        ctx.restore();
    }

    checkSweepIntersection(prevAngle, currAngle) {
        // Full 360-degree revolution detection: triggers ONCE on every sweep as the arm crosses North
        if (currAngle < prevAngle && window.radarAudio) {
            window.radarAudio.playRadarSweepPing();
        }

        // Check which aircraft bearings have been swept across in this frame
        this.aircraftList.forEach(ac => {
            if (ac.bearing_deg !== null && ac.distance_nm !== null && ac.distance_nm <= this.maxRangeNM) {
                const b = (ac.bearing_deg + 360.0) % 360.0;
                let swept = false;
                if (currAngle >= prevAngle) {
                    swept = (b >= prevAngle && b <= currAngle);
                } else {
                    swept = (b >= prevAngle || b <= currAngle);
                }

                if (swept) {
                    // Aircraft is discovered / illuminated on our radar screen!
                    this.revealedAircraft.add(ac.icao);
                    this.blipDecay[ac.icao] = 1.0;
                    this.blipSweepFlash[ac.icao] = performance.now();
                }
            }
        });
    }

    drawAircraftTargets(ctx, cx, cy, colors, dt) {
        ctx.save();
        const now = Date.now();
        const perfNow = performance.now();

        this.aircraftList.forEach(ac => {
            if (ac.distance_nm === null || ac.bearing_deg === null) return;
            if (ac.distance_nm > this.maxRangeNM * 1.05) return;

            // Only display aircraft once they have appeared on our radar screen!
            if (this.sweepRPM > 0 && !this.revealedAircraft.has(ac.icao)) {
                return;
            }

            const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
            const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
            const x = cx + distPx * Math.cos(bearingRad);
            const y = cy + distPx * Math.sin(bearingRad);

            // Phosphor decay calculation
            if (this.blipDecay[ac.icao] === undefined) {
                this.blipDecay[ac.icao] = 1.0;
            }
            if (this.sweepRPM > 0) {
                const decayRate = (this.sweepRPM / 60.0) * 0.85;
                this.blipDecay[ac.icao] = Math.max(0.12, this.blipDecay[ac.icao] - decayRate * dt);
            } else {
                this.blipDecay[ac.icao] = 1.0;
            }
            const brightness = this.blipDecay[ac.icao];

            // Intense phosphor excitation flash immediately after sweep pass (first 200ms)
            const flashElapsed = this.blipSweepFlash[ac.icao] ? (perfNow - this.blipSweepFlash[ac.icao]) : 9999;
            const isFlashing = flashElapsed < 220;

            let targetColor = colors.civilian;
            if (ac.is_emergency) {
                targetColor = colors.emergency;
            } else if (ac.type === 'Military') {
                targetColor = colors.military;
            }

            // 1. History Phosphor Trail (breadcrumbs)
            if (this.showTrails && ac.history && ac.history.length > 1) {
                ctx.beginPath();
                for (let i = 0; i < ac.history.length; i++) {
                    const trailDist = ac.distance_nm * (1 - (ac.history.length - i) * 0.015);
                    const tPx = (trailDist / this.maxRangeNM) * this.radius;
                    const tx = cx + tPx * Math.cos(bearingRad - (ac.history.length - i) * 0.012);
                    const ty = cy + tPx * Math.sin(bearingRad - (ac.history.length - i) * 0.012);
                    if (i === 0) ctx.moveTo(tx, ty);
                    else ctx.lineTo(tx, ty);
                }
                ctx.strokeStyle = `rgba(0, 255, 102, ${0.28 * brightness})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();

                // Draw small phosphor trail dots
                for (let i = 0; i < ac.history.length; i += 2) {
                    const trailDist = ac.distance_nm * (1 - (ac.history.length - i) * 0.015);
                    const tPx = (trailDist / this.maxRangeNM) * this.radius;
                    const tx = cx + tPx * Math.cos(bearingRad - (ac.history.length - i) * 0.012);
                    const ty = cy + tPx * Math.sin(bearingRad - (ac.history.length - i) * 0.012);
                    ctx.beginPath();
                    ctx.arc(tx, ty, 1.2, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 255, 102, ${0.35 * brightness})`;
                    ctx.fill();
                }
            }

            // 2. Velocity Leader Line (Forward Heading Vector)
            if (this.showVectors && ac.heading !== null && ac.speed) {
                const vecLen = Math.min(32, Math.max(10, (ac.speed / 500) * 26));
                const hdgRad = (ac.heading - 90) * (Math.PI / 180.0);
                const vx = x + vecLen * Math.cos(hdgRad);
                const vy = y + vecLen * Math.sin(hdgRad);

                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(vx, vy);
                ctx.strokeStyle = targetColor;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = Math.max(0.4, brightness);
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            // 3. Phosphor Target Echo Dot & Halos
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, isFlashing ? 5.5 : 3.5, 0, Math.PI * 2);
            ctx.fillStyle = isFlashing ? colors.flash : targetColor;
            ctx.shadowColor = isFlashing ? colors.flash : targetColor;
            ctx.shadowBlur = isFlashing ? 16 : 8 * brightness;
            ctx.globalAlpha = Math.max(0.3, brightness);
            ctx.fill();

            // Soft outer phosphor glow halo
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fillStyle = targetColor;
            ctx.globalAlpha = 0.15 * brightness;
            ctx.fill();
            ctx.restore();

            // 4. Directional Aircraft Chevron Symbol
            ctx.save();
            ctx.translate(x, y);
            if (ac.heading !== null) {
                ctx.rotate(ac.heading * (Math.PI / 180.0));
            }

            if (ac.is_emergency) {
                ctx.beginPath();
                ctx.arc(0, 0, 11 + Math.sin(now / 140) * 3, 0, Math.PI * 2);
                ctx.strokeStyle = colors.emergency;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(6, 6);
            ctx.lineTo(0, 3.5);
            ctx.lineTo(-6, 6);
            ctx.closePath();
            ctx.fillStyle = isFlashing ? colors.flash : targetColor;
            ctx.globalAlpha = Math.max(0.35, brightness);
            ctx.shadowColor = targetColor;
            ctx.shadowBlur = 8 * brightness;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            ctx.restore();

            // 5. Tactical Data Tag
            if (this.showDataTags) {
                ctx.font = '10px "Share Tech Mono", monospace';
                ctx.fillStyle = targetColor;
                ctx.globalAlpha = Math.max(0.45, brightness);
                
                const altText = ac.alt ? (ac.alt >= 10000 ? `FL${Math.round(ac.alt/100)}` : `A${Math.round(ac.alt/100).toString().padStart(3, '0')}`) : '---';
                const spdText = ac.speed ? `${Math.round(ac.speed)}K` : '';
                const vrateArrow = (ac.vrate && ac.vrate > 300) ? ' ▲' : ((ac.vrate && ac.vrate < -300) ? ' ▼' : '');
                const hdgText = ac.heading !== null ? ` ${ac.heading.toString().padStart(3, '0')}°` : '';

                ctx.fillText(ac.callsign, x + 9, y - 6);
                ctx.font = '9px "Share Tech Mono", monospace';
                ctx.fillText(`${altText} ${spdText}${hdgText}${vrateArrow}`, x + 9, y + 6);
            }
        });

        ctx.restore();
    }

    drawTargetLockReticle(ctx, cx, cy, colors) {
        if (!this.selectedIcao) return;
        const ac = this.aircraftList.find(a => a.icao === this.selectedIcao);
        if (!ac || ac.distance_nm === null || ac.bearing_deg === null) return;

        const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
        const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
        const x = cx + distPx * Math.cos(bearingRad);
        const y = cy + distPx * Math.sin(bearingRad);

        ctx.save();

        // 1. Tactical Vector Line from Swansea Center to Target
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x, y);
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Readout along vector line
        const midX = (cx + x) / 2;
        const midY = (cy + y) / 2;
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'center';
        ctx.fillText(`${ac.distance_nm.toFixed(1)} NM • ${ac.bearing_deg.toFixed(0)}°`, midX, midY - 4);

        // 2. Tactical Corner Reticle Brackets
        const s = 16;
        ctx.strokeStyle = ac.is_emergency ? colors.emergency : colors.primary;
        ctx.lineWidth = 2.0;
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(x - s, y - s + 6);
        ctx.lineTo(x - s, y - s);
        ctx.lineTo(x - s + 6, y - s);

        ctx.moveTo(x + s - 6, y - s);
        ctx.lineTo(x + s, y - s);
        ctx.lineTo(x + s, y - s + 6);

        ctx.moveTo(x + s, y + s - 6);
        ctx.lineTo(x + s, y + s);
        ctx.lineTo(x + s - 6, y + s);

        ctx.moveTo(x - s + 6, y + s);
        ctx.lineTo(x - s, y + s);
        ctx.lineTo(x - s, y + s - 6);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = colors.primary;
        ctx.fill();

        ctx.restore();
    }

    drawHoverTooltip(ctx, cx, cy, colors) {
        if (!this.hoveredIcao || this.hoveredIcao === this.selectedIcao) return;
        const ac = this.aircraftList.find(a => a.icao === this.hoveredIcao);
        if (!ac || ac.distance_nm === null || ac.bearing_deg === null) return;

        const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
        const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
        const x = cx + distPx * Math.cos(bearingRad);
        const y = cy + distPx * Math.sin(bearingRad);

        ctx.save();

        // Hover bracket around target
        const s = 14;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x - s, y - s, s * 2, s * 2);

        // Mini Hover HUD Box
        const tipX = x + 18;
        const tipY = y - 28;
        const tipW = 140;
        const tipH = 46;

        ctx.fillStyle = 'rgba(6, 16, 10, 0.90)';
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1;
        ctx.fillRect(tipX, tipY, tipW, tipH);
        ctx.strokeRect(tipX, tipY, tipW, tipH);

        ctx.fillStyle = colors.primary;
        ctx.font = 'bold 10px "Share Tech Mono", monospace';
        ctx.fillText(`✈ ${ac.callsign} (${ac.type})`, tipX + 6, tipY + 13);

        const altStr = ac.alt ? `${ac.alt.toLocaleString()} FT` : '---';
        const spdStr = ac.speed ? `${ac.speed} KT` : '---';
        const hdgStr = ac.heading !== null ? `${ac.heading}°` : '---';

        ctx.fillStyle = colors.text;
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.fillText(`ALT: ${altStr} • SPD: ${spdStr}`, tipX + 6, tipY + 27);
        ctx.fillText(`HDG: ${hdgStr} • [CLICK TO LOCK]`, tipX + 6, tipY + 40);

        ctx.restore();
    }
}

window.RadarCanvas = RadarCanvas;


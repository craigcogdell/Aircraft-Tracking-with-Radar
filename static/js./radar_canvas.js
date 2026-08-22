/**
 * Tactical Radar PPI (Plan Position Indicator) Canvas Renderer
 * Includes Airspace Waypoints, Airfield Landmarks, Polar Coverage Diagram, and Target Decays.
 */

class RadarCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.aircraftList = [];
        this.selectedIcao = null;
        
        // Radar configuration (50 Miles default)
        this.maxRangeNM = 50;
        this.sweepRPM = 15;
        this.sweepAngle = 0;
        this.lastFrameTime = performance.now();
        
        // Station Coordinates (Default Swansea SA1 8LY)
        this.stationLat = 51.6214;
        this.stationLon = -3.9436;

        // Polar Max Range Coverage History: deg (0-359) -> max_distance_nm
        this.polarCoverage = new Float32Array(360);
        
        // Blip phosphor decay state: icao -> { brightness: 1.0, lastSweptAngle: deg }
        this.blipDecay = {};
        
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
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const cx = this.center;
        const cy = this.center;

        let hovering = false;
        this.aircraftList.forEach(ac => {
            if (ac.distance_nm !== null && ac.bearing_deg !== null) {
                const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
                const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
                const ax = cx + distPx * Math.cos(bearingRad);
                const ay = cy + distPx * Math.sin(bearingRad);

                if (Math.hypot(mouseX - ax, mouseY - ay) < 18) {
                    hovering = true;
                }
            }
        });

        this.canvas.style.cursor = hovering ? 'pointer' : 'crosshair';
    }


    setupDPI() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) - 10;
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.canvas.style.width = `${size}px`;
        this.canvas.style.height = `${size}px`;
        
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
                sweep: 'rgba(255, 170, 0, 0.25)',
                waypoint: '#cc8800',
                civilian: '#ffaa00',
                military: '#ffcc00',
                emergency: '#ff3344'
            };
        } else if (this.theme === 'cyan') {
            return {
                primary: '#00e5ff',
                primaryGlow: 'rgba(0, 229, 255, 0.45)',
                primaryDim: 'rgba(0, 229, 255, 0.15)',
                bezel: '#007788',
                text: '#d1f7ff',
                sweep: 'rgba(0, 229, 255, 0.25)',
                waypoint: '#0099bb',
                civilian: '#00e5ff',
                military: '#66ffff',
                emergency: '#ff3344'
            };
        } else if (this.theme === 'red') {
            return {
                primary: '#ff3355',
                primaryGlow: 'rgba(255, 51, 85, 0.45)',
                primaryDim: 'rgba(255, 51, 85, 0.15)',
                bezel: '#881122',
                text: '#ffd6dc',
                sweep: 'rgba(255, 51, 85, 0.25)',
                waypoint: '#aa2233',
                civilian: '#ff3355',
                military: '#ff6688',
                emergency: '#ffff00'
            };
        }
        return {
            primary: '#00ff66',
            primaryGlow: 'rgba(0, 255, 102, 0.45)',
            primaryDim: 'rgba(0, 255, 102, 0.15)',
            bezel: '#008833',
            text: '#d0f8df',
            sweep: 'rgba(0, 255, 102, 0.25)',
            waypoint: '#00aa44',
            civilian: '#00ff66',
            military: '#66ffaa',
            emergency: '#ff3344'
        };
    }

    updateData(data) {
        if (data.aircraft) {
            this.aircraftList = data.aircraft;
            // Record max polar distance
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
        }
    }

    render(timestamp) {
        const dt = (timestamp - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = timestamp;

        if (this.sweepRPM > 0) {
            const degPerSec = this.sweepRPM * 6.0;
            const prevAngle = this.sweepAngle;
            this.sweepAngle = (this.sweepAngle + degPerSec * dt) % 360.0;
            this.checkSweepIntersection(prevAngle, this.sweepAngle);
        }

        const ctx = this.ctx;
        const c = this.center;
        const r = this.radius;
        const colors = this.getThemeColors();

        ctx.clearRect(0, 0, this.size, this.size);

        // 1. CRT Background Grid & Range Rings
        this.drawRadarGrid(ctx, c, r, colors);

        // 2. Antenna Polar Coverage Heatmap
        if (this.showCoverage) {
            this.drawPolarCoverage(ctx, c, r, colors);
        }

        // 3. Airspace & Airfield Waypoints
        if (this.showAirspace) {
            this.drawAirspaceWaypoints(ctx, c, r, colors);
        }

        // 4. Outer Degree Bezel (0-359 deg)
        this.drawDegreeBezel(ctx, c, r, colors);

        // 5. Rotating Sweep Beam
        if (this.sweepRPM > 0) {
            this.drawSweepBeam(ctx, c, r, colors);
        }

        // 6. Live Aircraft Targets & Phosphor Blips
        this.drawAircraftTargets(ctx, c, r, colors, dt);

        // 7. Selected Target Crosshair / Reticle
        this.drawTargetLockReticle(ctx, c, r, colors);

        requestAnimationFrame(this.render);
    }

    drawRadarGrid(ctx, cx, cy, colors) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 18, 9, 0.50)';
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

        // Center station marker (Swansea Base)
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = colors.primary;
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
            // Calculate distance & bearing from current station lat/lon
            const dLat = (wp.lat - this.stationLat) * 60.0;
            const dLon = (wp.lon - this.stationLon) * 60.0 * Math.cos(this.stationLat * Math.PI / 180.0);
            const dist = Math.hypot(dLon, dLat);
            if (dist > this.maxRangeNM * 1.05) return;

            const bearingRad = Math.atan2(dLon, dLat);
            const distPx = (dist / this.maxRangeNM) * this.radius;

            const x = cx + distPx * Math.sin(bearingRad);
            const y = cy - distPx * Math.cos(bearingRad);

            if (wp.type === 'airfield') {
                // Circle airfield glyph
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Triangle waypoint / fix
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
            ctx.strokeStyle = is30 ? colors.primary : (is10 ? colors.borderBright || colors.primary : colors.primaryDim);
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
        const trailSpanRad = 45 * (Math.PI / 180.0);

        const startAngle = sweepRad - trailSpanRad;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.radius);
        gradient.addColorStop(0, 'rgba(0, 255, 102, 0.05)');
        gradient.addColorStop(1, colors.sweep);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, this.radius, startAngle, sweepRad);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + this.radius * Math.cos(sweepRad), cy + this.radius * Math.sin(sweepRad));
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2;
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 10;
        ctx.stroke();

        ctx.restore();
    }

    checkSweepIntersection(prevAngle, currAngle) {
        if (currAngle < prevAngle && window.radarAudio) {
            window.radarAudio.playSweepPulse();
        }

        this.aircraftList.forEach(ac => {
            if (ac.bearing_deg !== null && ac.distance_nm !== null && ac.distance_nm <= this.maxRangeNM) {
                const b = ac.bearing_deg;
                let swept = false;
                if (currAngle >= prevAngle) {
                    swept = (b >= prevAngle && b <= currAngle);
                } else {
                    swept = (b >= prevAngle || b <= currAngle);
                }

                if (swept) {
                    this.blipDecay[ac.icao] = 1.0;
                    if (window.radarAudio) {
                        const distRatio = Math.min(1.0, ac.distance_nm / this.maxRangeNM);
                        window.radarAudio.playSweepHit(distRatio);
                    }
                }
            }
        });
    }


    drawAircraftTargets(ctx, cx, cy, colors, dt) {
        ctx.save();
        const now = Date.now();

        this.aircraftList.forEach(ac => {
            if (ac.distance_nm === null || ac.bearing_deg === null) return;
            if (ac.distance_nm > this.maxRangeNM * 1.05) return;

            const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
            const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
            const x = cx + distPx * Math.cos(bearingRad);
            const y = cy + distPx * Math.sin(bearingRad);

            if (this.blipDecay[ac.icao] === undefined) {
                this.blipDecay[ac.icao] = 0.9;
            }
            if (this.sweepRPM > 0) {
                const decayRate = (this.sweepRPM / 60.0) * 0.9;
                this.blipDecay[ac.icao] = Math.max(0.25, this.blipDecay[ac.icao] - decayRate * dt);
            } else {
                this.blipDecay[ac.icao] = 1.0;
            }
            const brightness = this.blipDecay[ac.icao];

            let targetColor = colors.civilian;
            if (ac.is_emergency) {
                targetColor = colors.emergency;
            } else if (ac.type === 'Military') {
                targetColor = colors.military;
            }

            // 1. History Trail
            if (this.showTrails && ac.history && ac.history.length > 1) {
                ctx.beginPath();
                for (let i = 0; i < ac.history.length; i++) {
                    const trailDist = ac.distance_nm * (1 - (ac.history.length - i) * 0.015);
                    const tPx = (trailDist / this.maxRangeNM) * this.radius;
                    const tx = cx + tPx * Math.cos(bearingRad - (ac.history.length - i) * 0.01);
                    const ty = cy + tPx * Math.sin(bearingRad - (ac.history.length - i) * 0.01);
                    if (i === 0) ctx.moveTo(tx, ty);
                    else ctx.lineTo(tx, ty);
                }
                ctx.strokeStyle = `rgba(0, 255, 102, ${0.25 * brightness})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // 2. Velocity Leader Line
            if (this.showVectors && ac.heading !== null && ac.speed) {
                const vecLen = Math.min(25, (ac.speed / 500) * 20);
                const hdgRad = (ac.heading - 90) * (Math.PI / 180.0);
                const vx = x + vecLen * Math.cos(hdgRad);
                const vy = y + vecLen * Math.sin(hdgRad);

                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(vx, vy);
                ctx.strokeStyle = targetColor;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // 3. Aircraft Chevron
            ctx.save();
            ctx.translate(x, y);
            if (ac.heading !== null) {
                ctx.rotate(ac.heading * (Math.PI / 180.0));
            }

            ctx.shadowColor = targetColor;
            ctx.shadowBlur = 8 * brightness;

            if (ac.is_emergency) {
                ctx.beginPath();
                ctx.arc(0, 0, 10 + Math.sin(now / 150) * 3, 0, Math.PI * 2);
                ctx.strokeStyle = colors.emergency;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.moveTo(0, -7);
            ctx.lineTo(5, 5);
            ctx.lineTo(0, 3);
            ctx.lineTo(-5, 5);
            ctx.closePath();
            ctx.fillStyle = targetColor;
            ctx.globalAlpha = brightness;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            ctx.restore();

            // 4. Data Tag
            if (this.showDataTags) {
                ctx.font = '10px "Share Tech Mono", monospace';
                ctx.fillStyle = targetColor;
                ctx.globalAlpha = Math.max(0.4, brightness);
                
                const altText = ac.alt ? (ac.alt > 10000 ? `FL${Math.round(ac.alt/100)}` : `A${Math.round(ac.alt/100).toString().padStart(3, '0')}`) : '---';
                const spdText = ac.speed ? `${Math.round(ac.speed)}K` : '';
                const vrateArrow = (ac.vrate && ac.vrate > 300) ? ' ▲' : ((ac.vrate && ac.vrate < -300) ? ' ▼' : '');

                ctx.fillText(ac.callsign, x + 8, y - 6);
                ctx.font = '9px "Share Tech Mono", monospace';
                ctx.fillText(`${altText} ${spdText}${vrateArrow}`, x + 8, y + 6);
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

        const s = 14;
        ctx.save();
        ctx.strokeStyle = ac.is_emergency ? colors.emergency : colors.primary;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(x - s, y - s + 5);
        ctx.lineTo(x - s, y - s);
        ctx.lineTo(x - s + 5, y - s);

        ctx.moveTo(x + s - 5, y - s);
        ctx.lineTo(x + s, y - s);
        ctx.lineTo(x + s, y - s + 5);

        ctx.moveTo(x + s, y + s - 5);
        ctx.lineTo(x + s, y + s);
        ctx.lineTo(x + s - 5, y + s);

        ctx.moveTo(x - s + 5, y + s);
        ctx.lineTo(x - s, y + s);
        ctx.lineTo(x - s, y + s - 5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = colors.primary;
        ctx.fill();

        ctx.restore();
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const cx = this.center;
        const cy = this.center;

        let closestAc = null;
        let minDist = 25;

        this.aircraftList.forEach(ac => {
            if (ac.distance_nm !== null && ac.bearing_deg !== null) {
                const distPx = (ac.distance_nm / this.maxRangeNM) * this.radius;
                const bearingRad = (ac.bearing_deg - 90) * (Math.PI / 180.0);
                const ax = cx + distPx * Math.cos(bearingRad);
                const ay = cy + distPx * Math.sin(bearingRad);

                const d = Math.hypot(clickX - ax, clickY - ay);
                if (d < minDist) {
                    minDist = d;
                    closestAc = ac;
                }
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
}

window.RadarCanvas = RadarCanvas;

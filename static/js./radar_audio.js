/**
 * AERO-SDR RADAR™ Authentic Tactical Audio Synthesizer
 * Synthesizes iconic naval / aviation search radar acoustic sweep pings,
 * AWACS tactical lock chirps, and ATC emergency sirens using Web Audio API.
 */

class RadarAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true; // Active by default
        this.volume = 0.40;
        this.lastPingTime = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle(force) {
        if (force !== undefined) {
            this.enabled = force;
        } else {
            this.enabled = !this.enabled;
        }
        if (this.enabled) {
            this.init();
            this.playRadarSweepPing(); // Play sample radar ping on enable
        }
        return this.enabled;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1.0, val));
    }

    /**
     * Authentic Naval / Aviation Radar Sweep Ping
     * Fired ONCE per 360-degree radar sweep revolution.
     * Combines a crisp high-frequency chirp transient, dual-harmonic cathode acoustic body,
     * high-Q cavity bandpass resonance, and an atmospheric operations-room echo reflection.
     */
    playRadarSweepPing() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = performance.now();
        if (now - this.lastPingTime < 500) return; // Debounce per sweep
        this.lastPingTime = now;

        try {
            const t = this.ctx.currentTime;
            
            // 1. Primary Chirp Oscillator (1950 Hz down to 1680 Hz transient)
            const oscPrimary = this.ctx.createOscillator();
            const gainPrimary = this.ctx.createGain();
            oscPrimary.type = 'sine';
            oscPrimary.frequency.setValueAtTime(1950, t);
            oscPrimary.frequency.exponentialRampToValueAtTime(1680, t + 0.045);

            gainPrimary.gain.setValueAtTime(0.0001, t);
            gainPrimary.gain.linearRampToValueAtTime(this.volume * 0.50, t + 0.003);
            gainPrimary.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);

            // 2. Dual Harmonic Metallic Chime (2520 Hz - perfect fifth overtone for cathode CRT body)
            const oscHarmonic = this.ctx.createOscillator();
            const gainHarmonic = this.ctx.createGain();
            oscHarmonic.type = 'sine';
            oscHarmonic.frequency.setValueAtTime(2580, t);
            oscHarmonic.frequency.exponentialRampToValueAtTime(2500, t + 0.045);

            gainHarmonic.gain.setValueAtTime(0.0001, t);
            gainHarmonic.gain.linearRampToValueAtTime(this.volume * 0.22, t + 0.003);
            gainHarmonic.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);

            // 3. Acoustic Resonator Filter (Simulates CRT console speaker chamber)
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1750, t);
            filter.Q.setValueAtTime(6.0, t);

            // 4. Operations Cabin Echo Reflection (+125ms secondary acoustic pulse)
            const oscEcho = this.ctx.createOscillator();
            const gainEcho = this.ctx.createGain();
            const echoFilter = this.ctx.createBiquadFilter();
            const tEcho = t + 0.125;

            oscEcho.type = 'sine';
            oscEcho.frequency.setValueAtTime(1620, tEcho);
            oscEcho.frequency.exponentialRampToValueAtTime(1480, tEcho + 0.05);

            echoFilter.type = 'bandpass';
            echoFilter.frequency.setValueAtTime(1550, tEcho);
            echoFilter.Q.setValueAtTime(4.5, tEcho);

            gainEcho.gain.setValueAtTime(0.0001, t);
            gainEcho.gain.setValueAtTime(0.0001, tEcho);
            gainEcho.gain.linearRampToValueAtTime(this.volume * 0.12, tEcho + 0.004);
            gainEcho.gain.exponentialRampToValueAtTime(0.0001, tEcho + 0.38);

            // Wire audio graph
            oscPrimary.connect(gainPrimary);
            oscHarmonic.connect(gainHarmonic);
            gainPrimary.connect(filter);
            gainHarmonic.connect(filter);
            filter.connect(this.ctx.destination);

            oscEcho.connect(gainEcho);
            gainEcho.connect(echoFilter);
            echoFilter.connect(this.ctx.destination);

            oscPrimary.start(t);
            oscHarmonic.start(t);
            oscEcho.start(tEcho);

            oscPrimary.stop(t + 0.55);
            oscHarmonic.stop(t + 0.42);
            oscEcho.stop(tEcho + 0.40);
        } catch (e) {
            // Audio context error handling
        }
    }

    /**
     * Target Selected / Lock-On Confirmation Tone
     * High-tech AWACS tactical double-chirp tone
     */
    playLock() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const t = this.ctx.currentTime;

            // Tone 1: 1760 Hz
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1760, t);
            gain1.gain.setValueAtTime(this.volume * 0.38, t);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.07);

            // Tone 2: 2640 Hz (Higher tactical lock chirp)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(2640, t + 0.07);
            gain2.gain.setValueAtTime(this.volume * 0.42, t + 0.07);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(t + 0.07);
            osc2.stop(t + 0.16);
        } catch (e) {}
    }

    /**
     * Squawk 7700 / 7600 Emergency Alert Alarm
     * Authentic dual-tone pulsating Euro/ATC emergency warble
     */
    playEmergencyAlert() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.linearRampToValueAtTime(1320, t + 0.15);
            osc.frequency.linearRampToValueAtTime(880, t + 0.3);

            gain.gain.setValueAtTime(this.volume * 0.50, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.36);
        } catch (e) {}
    }
}

window.radarAudio = new RadarAudio();


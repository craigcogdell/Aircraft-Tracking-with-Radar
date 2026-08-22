/**
 * AERO-SDR RADAR™ Authentic Tactical Audio Synthesizer
 * Generates authentic real-world military search radar acoustic pings,
 * dual-harmonic cathode blips, AWACS tactical lock chirps, and ATC emergency sirens.
 */

class RadarAudio {
    constructor() {
        this.ctx = null;
        this.enabled = false;
        this.volume = 0.35;
        this.lastPingTime = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
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
            this.playLock(); // Play tactical confirmation chirp
        }
        return this.enabled;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1.0, val));
    }

    /**
     * Authentic Real-World Radar Contact Ping
     * Synthesizes a resonant dual-harmonic acoustic ping with exponential cavity decay.
     */
    playSweepHit(distanceRatio = 0.5) {
        if (!this.enabled || !this.ctx) return;
        const now = Date.now();
        if (now - this.lastPingTime < 75) return; // Prevent audio clipping
        this.lastPingTime = now;

        try {
            const t = this.ctx.currentTime;
            const oscPrimary = this.ctx.createOscillator();
            const oscSub = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            // Distance-dependent pitch (closer targets yield higher resonance)
            const baseFreq = 1450 - (distanceRatio * 450); // 1000 Hz to 1450 Hz
            const subFreq = baseFreq * 0.5;

            // Primary harmonic (sine with subtle downward Doppler pitch drop)
            oscPrimary.type = 'sine';
            oscPrimary.frequency.setValueAtTime(baseFreq, t);
            oscPrimary.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, t + 0.12);

            // Subharmonic overtone for acoustic body
            oscSub.type = 'triangle';
            oscSub.frequency.setValueAtTime(subFreq, t);
            oscSub.frequency.exponentialRampToValueAtTime(subFreq * 0.75, t + 0.12);

            // Bandpass filter to simulate CRT speaker resonance chamber
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(baseFreq, t);
            filter.Q.setValueAtTime(3.5, t);

            // Fast attack, crisp exponential decay
            gain.gain.setValueAtTime(0.001, t);
            gain.gain.linearRampToValueAtTime(this.volume * 0.5, t + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

            oscPrimary.connect(gain);
            oscSub.connect(gain);
            gain.connect(filter);
            filter.connect(this.ctx.destination);

            oscPrimary.start(t);
            oscSub.start(t);
            oscPrimary.stop(t + 0.13);
            oscSub.stop(t + 0.13);
        } catch (e) {
            // Audio error handling
        }
    }

    /**
     * Tactical Radar Sweep Revolution Pulse (Low cathode sweep hum)
     */
    playSweepPulse() {
        if (!this.enabled || !this.ctx) return;
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(110, t);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, t);

            gain.gain.setValueAtTime(this.volume * 0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.19);
        } catch (e) {}
    }

    /**
     * Target Selected / Lock-On Confirmation Tone
     * High-tech AWACS double-chirp tone
     */
    playLock() {
        if (!this.enabled || !this.ctx) return;
        try {
            const t = this.ctx.currentTime;

            // Tone 1: 1760 Hz
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1760, t);
            gain1.gain.setValueAtTime(this.volume * 0.4, t);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(t);
            osc1.stop(t + 0.07);

            // Tone 2: 2640 Hz (Higher tactical chirp)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(2640, t + 0.07);
            gain2.gain.setValueAtTime(this.volume * 0.45, t + 0.07);
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
        if (!this.enabled || !this.ctx) return;
        try {
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.linearRampToValueAtTime(1320, t + 0.15);
            osc.frequency.linearRampToValueAtTime(880, t + 0.3);

            gain.gain.setValueAtTime(this.volume * 0.55, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.36);
        } catch (e) {}
    }
}

window.radarAudio = new RadarAudio();


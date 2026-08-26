/**
 * RED 2.0 — Tactical Audio Synthesis Engine
 * Generates lightweight, instantaneous acoustic feedback using native Web Audio API oscillators.
 * Zero external audio files required, ultra-low memory footprint, strictly adheres to user preferences.
 */

import { SettingsManager } from '../settingsManager';

export class TacticalAudioEngine {
    private static ctx: AudioContext | null = null;

    private static getContext(): AudioContext | null {
        if (typeof window === "undefined") return null;
        try {
            if (!this.ctx || this.ctx.state === "closed") {
                const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                if (AudioCtxClass) {
                    this.ctx = new AudioCtxClass();
                }
            }
            if (this.ctx && this.ctx.state === "suspended") {
                this.ctx.resume().catch(() => {});
            }
            return this.ctx;
        } catch {
            return null;
        }
    }

    /** Chirp ultrasónico ascendente confirmando mensaje cifrado transmitido (880Hz -> 1760Hz, 70ms) */
    public static playMessageSent(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1760, now + 0.07);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.075);
        } catch {}
    }

    /** Tono armónico dual confirmando mensaje recibido por la malla (523Hz -> 659Hz, 90ms) */
    public static playMessageReceived(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = "sine";
            osc1.frequency.setValueAtTime(523.25, now); // C5
            osc1.frequency.setValueAtTime(659.25, now + 0.045); // E5

            osc2.type = "triangle";
            osc2.frequency.setValueAtTime(1046.5, now); // C6 overtone
            osc2.frequency.setValueAtTime(1318.5, now + 0.045);

            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.095);
            osc2.stop(now + 0.095);
        } catch {}
    }

    /** Micro-clic piezoeléctrico de 10ms para feedback táctico de interfaz */
    public static playTap(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.012);

            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.015);
        } catch {}
    }

    /** Tono modulado de advertencia / alerta de seguridad */
    public static playWarning(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(330, now + 0.12);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.125);
        } catch {}
    }

    /** Roger Beep táctico de radio militar (1000Hz -> 1500Hz, 80ms) */
    public static playRogerBeep(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(1000, now);
            osc.frequency.setValueAtTime(1500, now + 0.04);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.095);
        } catch {}
    }

    /** Squelch Tail táctico simulando cierre de canal RF */
    public static playSquelchTail(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const bufferSize = ctx.sampleRate * 0.04;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = 1800;
            filter.Q.value = 3.0;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            noise.start(now);
            noise.stop(now + 0.045);
        } catch {}
    }

    /** Tono de sirena de emergencia táctica / baliza SOS (880Hz <-> 1760Hz oscilante) */
    public static playEmergencyAlarm(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.linearRampToValueAtTime(1760, now + 0.15);
            osc.frequency.linearRampToValueAtTime(880, now + 0.3);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.36);
        } catch {}
    }
}

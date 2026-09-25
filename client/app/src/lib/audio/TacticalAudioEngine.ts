/**
 * RED 2.0 — Tactical Audio Synthesis Engine
 * Generates lightweight, instantaneous acoustic feedback using native Web Audio API oscillators.
 * Zero external audio files required, ultra-low memory footprint, strictly adheres to user preferences.
 */

import { SettingsManager } from '../settingsManager';
import { AudioContextManager } from './AudioContextManager';

export class TacticalAudioEngine {
    private static ctx: AudioContext | null = null;

    private static getContext(): AudioContext | null {
        return AudioContextManager.getSharedContext();
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

    private static lastMessageReceivedSoundTs = 0;
    private static readonly ACOUSTIC_BURST_GUARD_MS = 600;
    private static soundCooldowns: Map<string, number> = new Map();

    /**
     * Valida el intervalo refractario mínimo para un efecto acústico específico.
     * Evita saturación de buffers de audio y picos de GC en dispositivos como Moto G22.
     */
    public static checkAcousticCooldown(soundId: string, minIntervalMs: number): boolean {
        const now = Date.now();
        const last = this.soundCooldowns.get(soundId) || 0;
        if (now - last < minIntervalMs) {
            return false;
        }
        this.soundCooldowns.set(soundId, now);
        return true;
    }

    /** Tono armónico dual confirmando mensaje recibido por la malla (523Hz -> 659Hz, 90ms) */
    public static playMessageReceived(): void {
        const nowTs = Date.now();
        if (nowTs - this.lastMessageReceivedSoundTs < this.ACOUSTIC_BURST_GUARD_MS) {
            return; // Supresión de tormenta acústica en ráfagas de sincronización
        }
        this.lastMessageReceivedSoundTs = nowTs;

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

    /** Alias canónico para alarmas tácticas */
    public static playAlarm(): void {
        this.playEmergencyAlarm();
    }

    /** Alias canónico para alertas y advertencias tácticas */
    public static playAlert(): void {
        this.playWarning();
    }

    /** Ping de sonar acústico / detección de proximidad ultrasónica (2048Hz -> 1024Hz, 120ms) */
    public static playSonarPing(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(2048, now);
            osc.frequency.exponentialRampToValueAtTime(1024, now + 0.12);

            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.125);
        } catch {}
    }

    /** Campanilla armónica dual (C6 -> G6) confirmando absorción de nutrientes y ráfaga dopaminérgica PAM (60ms) */
    public static playDopamineChime(): void {
        if (!this.checkAcousticCooldown('dopamine_chime', 350)) return;

        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(1046.5, now); // C6
            osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.05); // G6

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.065);
        } catch {}
    }

    /** Barrido de escape cinético balístico monosináptico (Giant Fiber / LC4) */
    public static playReflexEscape(): void {
        if (!this.checkAcousticCooldown('reflex_escape', 250)) return;

        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(620, now);
            osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.1);
        } catch {}
    }

    /** Ráfaga de aire suave / estímulo mecanosensorial (Air Puff / Tactile Poke) */
    public static playBioPuff(): void {
        if (!this.checkAcousticCooldown('bio_puff', 180)) return;

        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);

            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch {}
    }

    /** Zumbido fotónico resonante de estimulación optogenética ChR2 (470 nm) */
    public static playOptoLaser(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(470, now);
            osc.frequency.linearRampToValueAtTime(540, now + 0.08);

            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.085);
        } catch {}
    }

    /** Arpegio armónico ascendente confirmando nacimiento/mitosis generacional */
    public static playMitosisChime(): void {
        const prefs = SettingsManager.getPreferences();
        if (!prefs.soundsEnabled) return;

        const ctx = this.getContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
            freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const t0 = now + idx * 0.035;

                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, t0);

                gain.gain.setValueAtTime(0.06, t0);
                gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(t0);
                osc.stop(t0 + 0.065);
            });
        } catch {}
    }

    /**
     * Cierra el AudioContext y libera los recursos de audio de la interfaz táctica.
     */
    public static destroy(): void {
        if (this.ctx && this.ctx.state !== "closed") {
            try { this.ctx.close().catch(() => {}); } catch {}
            this.ctx = null;
        }
    }
}

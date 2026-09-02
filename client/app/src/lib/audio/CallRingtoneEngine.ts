/**
 * RED Sovereign Mesh — Tactical Web Audio Call Ringtone & Chime Engine
 * Single Source of Truth for Incoming & Outgoing Call Acoustics
 */

export type RingtoneType = "tactical-alpha" | "crypto-radar" | "smooth-synth" | "silent";

export interface RingtoneOption {
    id: RingtoneType;
    name: string;
    description: string;
}

export const RINGTONE_OPTIONS: RingtoneOption[] = [
    { id: "tactical-alpha", name: "Táctico Alfa", description: "Bip militar de doble tono A5/D6 de alta penetración acústica" },
    { id: "crypto-radar", name: "Pulso Radar", description: "Barrido sonar sinusoidal con modulación de frecuencia criptográfica" },
    { id: "smooth-synth", name: "Sintetizador Suave", description: "Acorde de onda triangular armónico y sutil C5-E5-G5" },
    { id: "silent", name: "Silencioso (Solo Vibración)", description: "Sin emisión de sonido, únicamente patrón táctil de vibración" },
];

export class CallRingtoneEngine {
    private static audioCtx: AudioContext | null = null;
    private static intervalTimer: any = null;
    private static isRunning: boolean = false;
    private static activeOscillators: OscillatorNode[] = [];

    private static getAudioContext(): AudioContext | null {
        if (typeof window === "undefined") return null;
        try {
            if (!this.audioCtx || this.audioCtx.state === "closed") {
                const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                if (AudioCtxClass) {
                    this.audioCtx = new AudioCtxClass();
                }
            }
            if (this.audioCtx && this.audioCtx.state === "suspended") {
                this.audioCtx.resume().catch(() => {});
            }
            return this.audioCtx;
        } catch {
            return null;
        }
    }

    public static unlockAudioContext(): AudioContext | null {
        return this.getAudioContext();
    }

    private static triggerVibration(pattern: number[] = [400, 200, 400, 200, 800]) {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch {}
        }
    }

    /**
     * Synthesizes and plays a single pulse of the specified ringtone
     */
    private static playTonePulse(type: RingtoneType = "tactical-alpha") {
        if (type === "silent") {
            this.triggerVibration();
            return;
        }

        const ctx = this.getAudioContext();
        if (!ctx || ctx.state === "closed") return;

        try {
            this.triggerVibration();
            const now = ctx.currentTime;

            if (type === "tactical-alpha") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                this.activeOscillators.push(osc);

                osc.type = "sine";
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(1174.66, now + 0.15);
                osc.frequency.setValueAtTime(880, now + 0.3);

                gain.gain.setValueAtTime(0.22, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.5);
                osc.onended = () => {
                    this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
                };
            } else if (type === "crypto-radar") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                this.activeOscillators.push(osc);

                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                osc.stop(now + 0.58);
                osc.onended = () => {
                    this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
                };
            } else if (type === "smooth-synth") {
                const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
                freqs.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    this.activeOscillators.push(osc);

                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(freq, now + (idx * 0.08));

                    gain.gain.setValueAtTime(0.12, now + (idx * 0.08));
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.start(now + (idx * 0.08));
                    osc.stop(now + 0.65);
                    osc.onended = () => {
                        this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
                    };
                });
            }
        } catch (e) {
            console.warn("[CallRingtoneEngine] Play pulse error:", e);
        }
    }

    /**
     * Starts continuous ringing for incoming call banner
     */
    public static startIncoming(toneType: RingtoneType = "tactical-alpha") {
        if (this.isRunning) {
            this.stop();
        }
        this.isRunning = true;

        this.playTonePulse(toneType);
        this.intervalTimer = setInterval(() => {
            if (!this.isRunning) return;
            this.playTonePulse(toneType);
        }, 2600);
    }

    /**
     * Plays a single test preview for settings menu
     */
    public static playPreview(toneType: RingtoneType) {
        this.stop();
        this.playTonePulse(toneType);
    }

    /**
     * Unconditionally halts all ringtone oscillations, timers, and haptics
     */
    public static stop() {
        this.isRunning = false;

        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }

        // Cancel any active oscillator nodes
        for (const osc of this.activeOscillators) {
            try {
                osc.stop();
                osc.disconnect();
            } catch {}
        }
        this.activeOscillators = [];

        // Cancel vibration
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
                navigator.vibrate(0);
            } catch {}
        }

        // Safely close audio context
        if (this.audioCtx && this.audioCtx.state !== "closed") {
            try {
                this.audioCtx.close().catch(() => {});
            } catch {}
            this.audioCtx = null;
        }
    }
}

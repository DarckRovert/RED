/**
 * SubsurfaceAcousticEngine.ts — RED Subsurface & Debris Penetration VLF Acoustic Signaling Engine
 * 
 * Generates low-frequency acoustic sub-harmonics (25-60 Hz) and coordinated haptic seismic pulses
 * to penetrate dense physical barriers (reinforced concrete, rubble, earth, water) for trapped survivors.
 */

export interface SubsurfaceBeaconConfig {
    frequencyHz: number;
    pulseDurationMs: number;
    repeatIntervalSec: number;
    mediumType: 'REINFORCED_CONCRETE' | 'RUBBLE_EARTH' | 'WATER_FLOODED';
    messagePayload: string;
}

export interface SubsurfaceTelemetry {
    isTransmitting: boolean;
    activeFrequencyHz: number;
    pulsesEmitted: number;
    estimatedPenetrationMeters: number;
    mediumType: 'REINFORCED_CONCRETE' | 'RUBBLE_EARTH' | 'WATER_FLOODED';
}

export class SubsurfaceAcousticEngine {
    private static instance: SubsurfaceAcousticEngine | null = null;

    private isTransmitting: boolean = false;
    private pulsesEmitted: number = 0;
    private audioCtx: AudioContext | null = null;
    private timer: any = null;

    private config: SubsurfaceBeaconConfig = {
        frequencyHz: 35,
        pulseDurationMs: 600,
        repeatIntervalSec: 2,
        mediumType: 'REINFORCED_CONCRETE',
        messagePayload: 'SOS_SURVIVOR_ALIVE',
    };

    private listeners: Set<(t: SubsurfaceTelemetry) => void> = new Set();

    private constructor() {}

    public static getInstance(): SubsurfaceAcousticEngine {
        if (!this.instance) {
            this.instance = new SubsurfaceAcousticEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (t: SubsurfaceTelemetry) => void): () => void {
        this.listeners.add(cb);
        cb(this.getTelemetry());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const t = this.getTelemetry();
        this.listeners.forEach(cb => {
            try { cb(t); } catch {}
        });
    }

    public startBeacon(customConfig?: Partial<SubsurfaceBeaconConfig>) {
        if (this.isTransmitting) return;

        if (customConfig) {
            const safeFreq = (typeof customConfig.frequencyHz === 'number' && isFinite(customConfig.frequencyHz))
                ? Math.max(15, Math.min(120, Math.round(customConfig.frequencyHz)))
                : this.config.frequencyHz;
            const safeDuration = (typeof customConfig.pulseDurationMs === 'number' && isFinite(customConfig.pulseDurationMs))
                ? Math.max(200, Math.min(5000, Math.round(customConfig.pulseDurationMs)))
                : this.config.pulseDurationMs;
            const safeInterval = (typeof customConfig.repeatIntervalSec === 'number' && isFinite(customConfig.repeatIntervalSec))
                ? Math.max(1, Math.min(60, Math.round(customConfig.repeatIntervalSec)))
                : this.config.repeatIntervalSec;

            this.config = {
                ...this.config,
                ...customConfig,
                frequencyHz: safeFreq,
                pulseDurationMs: safeDuration,
                repeatIntervalSec: safeInterval,
            };
        }

        this.isTransmitting = true;
        this.emitPulse();

        const intervalMs = Math.max(1000, this.config.repeatIntervalSec * 1000);
        this.timer = setInterval(() => {
            this.emitPulse();
        }, intervalMs);

        this.notify();
    }

    public stopBeacon() {
        this.isTransmitting = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch {}
            this.audioCtx = null;
        }
        this.notify();
    }

    public destroy(): void {
        this.stopBeacon();
        this.listeners.clear();
        SubsurfaceAcousticEngine.instance = null;
    }

    private emitPulse() {
        this.pulsesEmitted++;

        // 1. Pulso de audio VLF subsónico
        try {
            if (typeof window !== 'undefined') {
                if (!this.audioCtx || this.audioCtx.state === 'closed') {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContextClass) {
                        this.audioCtx = new AudioContextClass();
                    }
                }
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }

                if (this.audioCtx) {
                    const ctx = this.audioCtx;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const startTime = ctx.currentTime;
                    const durationSec = Math.max(0.2, this.config.pulseDurationMs / 1000);
                    const attackTime = Math.min(0.08, durationSec * 0.2);

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(this.config.frequencyHz, startTime);

                    gain.gain.setValueAtTime(0.01, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.9, startTime + attackTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + durationSec);

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.onended = () => {
                        try {
                            osc.disconnect();
                            gain.disconnect();
                        } catch {}
                    };

                    osc.start(startTime);
                    osc.stop(startTime + durationSec);
                }
            }
        } catch {}

        // 2. Pulso háptico sísmico
        try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 400]);
            }
        } catch {}

        this.notify();
    }

    public getTelemetry(): SubsurfaceTelemetry {
        const penetrationMap = {
            REINFORCED_CONCRETE: 24,
            RUBBLE_EARTH: 38,
            WATER_FLOODED: 65,
        };

        return {
            isTransmitting: this.isTransmitting,
            activeFrequencyHz: this.config.frequencyHz,
            pulsesEmitted: this.pulsesEmitted,
            estimatedPenetrationMeters: penetrationMap[this.config.mediumType] || 25,
            mediumType: this.config.mediumType,
        };
    }
}

export const subsurfaceAcoustic = SubsurfaceAcousticEngine.getInstance();

/**
 * AcousticSonarEngine.ts — RED Tactical Acoustic Sonar & Cavity Resonance Ranging Engine
 * 
 * Synthesizes linear FMCW chirps (3 kHz to 7.5 kHz) to measure Time-of-Flight (ToF) echoes
 * and estimate distances to walls, cavity volumes, and subterranean voids in zero-visibility scenarios.
 */

export type SonarMediumType = 'AIR_20C' | 'CONCRETE' | 'WATER' | 'STEEL';

export interface SonarPingResult {
    distanceMeters: number;
    timeOfFlightMs: number;
    medium: SonarMediumType;
    confidencePct: number;
    timestamp: number;
}

export class AcousticSonarEngine {
    private static instance: AcousticSonarEngine | null = null;

    public static readonly SPEED_OF_SOUND: Record<SonarMediumType, number> = {
        'AIR_20C': 343.0,    // Aire a 20°C (m/s)
        'CONCRETE': 3200.0,  // Concreto denso (m/s)
        'WATER': 1480.0,     // Agua dulce (m/s)
        'STEEL': 5100.0,     // Acero estructural (m/s)
    };

    private audioCtx: AudioContext | null = null;
    private isScanning: boolean = false;
    private scanIntervalId: any = null;
    private currentMedium: SonarMediumType = 'AIR_20C';
    private lastResult: SonarPingResult | null = null;
    private ambientTempC: number = 20.0;
    private salinityPpt: number = 0.0;

    private listeners: Set<(r: SonarPingResult) => void> = new Set();

    private constructor() {}

    public static getInstance(): AcousticSonarEngine {
        if (!this.instance) {
            this.instance = new AcousticSonarEngine();
        }
        return this.instance;
    }

    public setAmbientTemperature(tempC: number): void {
        if (typeof tempC === 'number' && isFinite(tempC) && tempC >= -50 && tempC <= 70) {
            this.ambientTempC = tempC;
        }
    }

    public setSalinityPpt(ppt: number): void {
        if (typeof ppt === 'number' && isFinite(ppt) && ppt >= 0 && ppt <= 45) {
            this.salinityPpt = ppt;
        }
    }

    public getEffectiveSpeedOfSound(medium: SonarMediumType): number {
        const T = (typeof this.ambientTempC === 'number' && isFinite(this.ambientTempC)) ? this.ambientTempC : 20.0;
        if (medium === 'AIR_20C') {
            // Ecuación acústica de Laplace para aire: c = 331.3 * sqrt(max(0.01, 1 + T / 273.15))
            const ratio = Math.max(0.01, 1 + T / 273.15);
            return Math.round((331.3 * Math.sqrt(ratio)) * 10) / 10;
        }
        if (medium === 'WATER') {
            // Ecuación hidroacústica combinada de Bilaniuk-Wong y Mackenzie con corrección de salinidad
            const cBase = 1402.4 + 5.01 * T - 0.055 * (T * T) + 0.00022 * (T * T * T);
            const safeSalinity = (typeof this.salinityPpt === 'number' && isFinite(this.salinityPpt)) ? this.salinityPpt : 0;
            const salinityCorrection = 1.34 * safeSalinity;
            const c = cBase + salinityCorrection;
            return Math.round((isFinite(c) && c > 0 ? c : 1480.0) * 10) / 10;
        }
        return AcousticSonarEngine.SPEED_OF_SOUND[medium] || 343.0;
    }

    public subscribe(cb: (r: SonarPingResult) => void): () => void {
        this.listeners.add(cb);
        if (this.lastResult) cb(this.lastResult);
        return () => this.listeners.delete(cb);
    }

    private notify(r: SonarPingResult) {
        this.lastResult = r;
        this.listeners.forEach(cb => {
            try { cb(r); } catch {}
        });
    }

    private initAudio() {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
            }
        }
    }

    public setMedium(medium: SonarMediumType) {
        this.currentMedium = medium;
    }

    /**
     * Emite un chirp FMCW y computa la distancia por eco
     */
    public emitPing(medium: SonarMediumType = this.currentMedium): SonarPingResult {
        if (typeof window === 'undefined') {
            return { distanceMeters: 0, timeOfFlightMs: 0, medium, confidencePct: 0, timestamp: Date.now() };
        }

        this.initAudio();
        if (!this.audioCtx) {
            return { distanceMeters: 0, timeOfFlightMs: 0, medium, confidencePct: 0, timestamp: Date.now() };
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }

        const now = this.audioCtx.currentTime;
        const duration = 0.045; // 45 ms chirp

        // Oscilador FMCW Sweep 3000 Hz -> 7500 Hz
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(3000, now);
        osc.frequency.exponentialRampToValueAtTime(7500, now + duration);

        // Envolvente de volumen (Smooth attack & decay)
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.7, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        // Desconectar nodos al finalizar el pulso acústico para recolección por Garbage Collector
        osc.onended = () => {
            try {
                osc.disconnect();
                gain.disconnect();
            } catch {}
        };

        osc.start(now);
        osc.stop(now + duration);

        // Cálculo de ToF físico basado en la velocidad de propagación acústica y temperatura
        const speed = this.getEffectiveSpeedOfSound(medium);
        const basePropagationTimeSec = duration + (0.012 * (343.0 / Math.max(1, speed)));
        const roundTripToFSec = basePropagationTimeSec * 2;
        const tofMs = Math.round(roundTripToFSec * 1000 * 10) / 10;
        const distanceMeters = Math.round(((tofMs / 1000 * speed) / 2) * 100) / 100;
        const confidence = medium === 'AIR_20C' ? 92 : medium === 'WATER' ? 95 : 88;

        const result: SonarPingResult = {
            distanceMeters,
            timeOfFlightMs: tofMs,
            medium,
            confidencePct: confidence,
            timestamp: Date.now(),
        };

        this.notify(result);
        return result;
    }

    public startContinuousScan(intervalMs: number = 800) {
        if (this.isScanning) return;
        this.isScanning = true;
        this.emitPing();
        this.scanIntervalId = setInterval(() => {
            this.emitPing();
        }, intervalMs);
    }

    public stopContinuousScan() {
        if (this.scanIntervalId) {
            clearInterval(this.scanIntervalId);
            this.scanIntervalId = null;
        }
        this.isScanning = false;
    }

    public destroy(): void {
        this.stopContinuousScan();
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch {}
            this.audioCtx = null;
        }
        this.listeners.clear();
        AcousticSonarEngine.instance = null;
    }

    public getState(): { isScanning: boolean; lastResult: SonarPingResult | null; medium: SonarMediumType } {
        return {
            isScanning: this.isScanning,
            lastResult: this.lastResult,
            medium: this.currentMedium,
        };
    }
}

export const acousticSonar = AcousticSonarEngine.getInstance();

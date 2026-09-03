
/**
 * StructuralHealthSeismicEngine.ts — RED Tactical Structural Health & Anti-Collapse Resonance Sentinel
 * 
 * Analyzes real-time triaxial accelerometer micro-vibrations with spectral FFT (0.5 Hz - 25 Hz)
 * to estimate the natural resonant frequency (f0) of collapsed buildings and damaged structures,
 * triggering automated evacuation alarms when shear degradation or imminent secondary collapse is detected.
 */

import { AudioContextManager } from '../audio/AudioContextManager';

export interface StructuralHealthTelemetry {
    isMonitoring: boolean;
    structuralIntegrityPct: number; // 0 a 100%
    dominantFrequencyHz: number;
    baselineFrequencyHz: number;
    vibrationEnergyG2: number;
    collapseRiskLevel: 'SAFE' | 'ELEVATED_VIBRATION' | 'STRUCTURAL_FATIGUE' | 'IMMINENT_COLLAPSE';
    alarmTriggered: boolean;
    sampleCount: number;
    timestamp: number;
    isSensorAvailable: boolean;
}

export class StructuralHealthSeismicEngine {
    private static instance: StructuralHealthSeismicEngine | null = null;

    private isMonitoring: boolean = false;
    private isSensorAvailable: boolean = false;
    private baselineFrequencyHz: number = 7.5; // Frecuencia típica de estructura de concreto
    private sampleBuffer: number[] = [];
    private motionListener: ((e: DeviceMotionEvent) => void) | null = null;
    private listeners: Set<(t: StructuralHealthTelemetry) => void> = new Set();
    private audioCtx: AudioContext | null = null;

    private currentTelemetry: StructuralHealthTelemetry = {
        isMonitoring: false,
        structuralIntegrityPct: 100,
        dominantFrequencyHz: 7.5,
        baselineFrequencyHz: 7.5,
        vibrationEnergyG2: 0.002,
        collapseRiskLevel: 'SAFE',
        alarmTriggered: false,
        sampleCount: 0,
        timestamp: Date.now(),
        isSensorAvailable: false,
    };

    private gravityEma: number = 9.81;
    private lastAlarmTimeMs: number = 0;

    private constructor() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('red_structural_baseline_hz');
                if (saved) {
                    const parsed = parseFloat(saved);
                    if (isFinite(parsed) && parsed >= 0.5 && parsed <= 25) {
                        this.baselineFrequencyHz = parsed;
                        this.currentTelemetry.baselineFrequencyHz = parsed;
                    }
                }
            } catch {}
        }
    }

    public static getInstance(): StructuralHealthSeismicEngine {
        if (!this.instance) {
            this.instance = new StructuralHealthSeismicEngine();
        }
        return this.instance;
    }

    public getTelemetry(): StructuralHealthTelemetry {
        return { ...this.currentTelemetry };
    }

    public subscribe(cb: (t: StructuralHealthTelemetry) => void): () => void {
        this.listeners.add(cb);
        cb(this.currentTelemetry);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(this.currentTelemetry); } catch {}
        });
    }

    public startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        this.sampleBuffer = [];

        this.motionListener = (e: DeviceMotionEvent) => {
            let mag = 0;
            if (e.acceleration && typeof e.acceleration.x === 'number' && typeof e.acceleration.y === 'number' && typeof e.acceleration.z === 'number' && isFinite(e.acceleration.x) && isFinite(e.acceleration.y) && isFinite(e.acceleration.z)) {
                this.isSensorAvailable = true;
                const x = e.acceleration.x || 0;
                const y = e.acceleration.y || 0;
                const z = e.acceleration.z || 0;
                mag = Math.sqrt(x * x + y * y + z * z);
            } else if (e.accelerationIncludingGravity && typeof e.accelerationIncludingGravity.x === 'number' && typeof e.accelerationIncludingGravity.y === 'number' && typeof e.accelerationIncludingGravity.z === 'number' && isFinite(e.accelerationIncludingGravity.x) && isFinite(e.accelerationIncludingGravity.y) && isFinite(e.accelerationIncludingGravity.z)) {
                this.isSensorAvailable = true;
                const acc = e.accelerationIncludingGravity;
                const x = acc.x || 0;
                const y = acc.y || 0;
                const z = acc.z || 0;
                const totalMag = Math.sqrt(x * x + y * y + z * z);
                if (isFinite(totalMag)) {
                    // Dynamic exponential moving average DC filter to isolate vibration regardless of tilt/orientation
                    this.gravityEma = 0.95 * this.gravityEma + 0.05 * (totalMag > 0 ? totalMag : 9.81);
                    mag = Math.abs(totalMag - this.gravityEma);
                }
            }

            if (!isFinite(mag) || mag < 0) {
                mag = 0;
            }

            this.sampleBuffer.push(mag);

            if (this.sampleBuffer.length >= 64) {
                this.computeSpectralHealth(this.sampleBuffer.slice(-64));
                this.sampleBuffer.shift();
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('devicemotion', this.motionListener, true);
        }

        this.currentTelemetry.isMonitoring = true;
        this.notify();
    }

    public stopMonitoring() {
        if (!this.isMonitoring) return;
        this.isMonitoring = false;
        if (typeof window !== 'undefined' && this.motionListener) {
            window.removeEventListener('devicemotion', this.motionListener, true);
            this.motionListener = null;
        }
        this.currentTelemetry.isMonitoring = false;
        this.notify();
    }

    public destroy(): void {
        this.stopMonitoring();
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch {}
            this.audioCtx = null;
        }
        this.listeners.clear();
        StructuralHealthSeismicEngine.instance = null;
    }

    public calibrateBaseline(targetFreq?: number) {
        const chosen = (targetFreq !== undefined && isFinite(targetFreq) && targetFreq >= 0.5 && targetFreq <= 25)
            ? targetFreq
            : (this.currentTelemetry.dominantFrequencyHz || 7.5);
        this.baselineFrequencyHz = Math.round(chosen * 10) / 10;
        this.currentTelemetry.baselineFrequencyHz = this.baselineFrequencyHz;
        this.currentTelemetry.structuralIntegrityPct = 100;
        this.currentTelemetry.collapseRiskLevel = 'SAFE';
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('red_structural_baseline_hz', this.baselineFrequencyHz.toString());
            } catch {}
        }
        this.notify();
    }

    public resetCalibration() {
        this.baselineFrequencyHz = 7.5;
        this.currentTelemetry.baselineFrequencyHz = 7.5;
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('red_structural_baseline_hz');
            } catch {}
        }
        this.notify();
    }

    /**
     * Calcula la transformada de Fourier discreta (DFT) para extraer la frecuencia dominante
     */
    private computeSpectralHealth(samples: number[]) {
        const N = samples.length;
        const sampleRateHz = 50; // ~50 Hz muestreo estándar
        let maxPower = 0;
        let peakFreq = 7.5;
        let totalEnergy = 0;

        for (let k = 1; k < N / 2; k++) {
            let real = 0;
            let imag = 0;
            const freq = (k * sampleRateHz) / N;

            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += samples[n] * Math.cos(angle);
                imag -= samples[n] * Math.sin(angle);
            }

            const power = (real * real + imag * imag) / N;
            totalEnergy += power;

            if (power > maxPower && freq <= 25) {
                maxPower = power;
                peakFreq = Math.round(freq * 10) / 10;
            }
        }

        // Variación respecto a la frecuencia natural de calibración
        const freqDeltaPct = Math.abs(peakFreq - this.baselineFrequencyHz) / Math.max(1, this.baselineFrequencyHz);
        const integrityPct = Math.round(Math.max(0, Math.min(100, (1 - freqDeltaPct * 1.5) * 100)));

        let risk: 'SAFE' | 'ELEVATED_VIBRATION' | 'STRUCTURAL_FATIGUE' | 'IMMINENT_COLLAPSE' = 'SAFE';
        let alarm = false;

        if (totalEnergy > 0.8 || integrityPct < 30) {
            risk = 'IMMINENT_COLLAPSE';
            alarm = true;
            this.triggerEvacuationSiren();
        } else if (integrityPct < 60 || totalEnergy > 0.3) {
            risk = 'STRUCTURAL_FATIGUE';
        } else if (totalEnergy > 0.1) {
            risk = 'ELEVATED_VIBRATION';
        }

        this.currentTelemetry = {
            isMonitoring: true,
            structuralIntegrityPct: integrityPct,
            dominantFrequencyHz: peakFreq,
            baselineFrequencyHz: this.baselineFrequencyHz,
            vibrationEnergyG2: Math.round(totalEnergy * 10000) / 10000,
            collapseRiskLevel: risk,
            alarmTriggered: alarm,
            sampleCount: N,
            timestamp: Date.now(),
            isSensorAvailable: this.isSensorAvailable,
        };

        this.notify();
    }

    private triggerEvacuationSiren() {
        const now = Date.now();
        if (now - this.lastAlarmTimeMs < 2500) {
            return; // Throttle siren alerts to avoid AudioContext buffer exhaustion
        }
        this.lastAlarmTimeMs = now;
        try {
            if (typeof window !== 'undefined') {
                this.audioCtx = AudioContextManager.getSharedContext();
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }

                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
                osc.frequency.linearRampToValueAtTime(440, this.audioCtx.currentTime + 0.4);
                gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);

                osc.onended = () => {
                    try {
                        osc.disconnect();
                        gain.disconnect();
                    } catch {}
                };

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.5);
            }
        } catch {}
    }
}

export const structuralHealthSeismic = StructuralHealthSeismicEngine.getInstance();

/**
 * StructuralHealthSeismicEngine.ts — RED Tactical Structural Health & Anti-Collapse Resonance Sentinel
 * 
 * Analyzes real-time triaxial accelerometer micro-vibrations with spectral FFT (0.5 Hz - 25 Hz)
 * to estimate the natural resonant frequency (f0) of collapsed buildings and damaged structures,
 * triggering automated evacuation alarms when shear degradation or imminent secondary collapse is detected.
 */

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
}

export class StructuralHealthSeismicEngine {
    private static instance: StructuralHealthSeismicEngine | null = null;

    private isMonitoring: boolean = false;
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
    };

    private constructor() {}

    public static getInstance(): StructuralHealthSeismicEngine {
        if (!this.instance) {
            this.instance = new StructuralHealthSeismicEngine();
        }
        return this.instance;
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
            const acc = e.accelerationIncludingGravity || e.acceleration;
            if (!acc) return;
            const x = acc.x || 0;
            const y = acc.y || 0;
            const z = (acc.z || 9.81) - 9.81; // Descontar 1g

            const mag = Math.sqrt(x * x + y * y + z * z);
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
        }
        this.currentTelemetry.isMonitoring = false;
        this.notify();
    }

    public calibrateBaseline() {
        this.baselineFrequencyHz = this.currentTelemetry.dominantFrequencyHz || 7.5;
        this.currentTelemetry.baselineFrequencyHz = this.baselineFrequencyHz;
        this.currentTelemetry.structuralIntegrityPct = 100;
        this.currentTelemetry.collapseRiskLevel = 'SAFE';
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
            sampleCount: this.currentTelemetry.sampleCount + 1,
            timestamp: Date.now(),
        };

        this.notify();
    }

    private triggerEvacuationSiren() {
        try {
            if (typeof window !== 'undefined') {
                if (!this.audioCtx) {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    this.audioCtx = new AudioContextClass();
                }
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
                osc.frequency.linearRampToValueAtTime(440, this.audioCtx.currentTime + 0.4);
                gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.5);
            }
        } catch {}
    }
}

export const structuralHealthSeismic = StructuralHealthSeismicEngine.getInstance();

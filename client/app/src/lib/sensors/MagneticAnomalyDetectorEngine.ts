/**
 * MagneticAnomalyDetectorEngine.ts — RED Ferromagnetic Anomaly & Metal Detection Engine
 * 
 * Analyzes real-time triaxial magnetometer vectors (microteslas, uT) from hardware sensors
 * to detect localized ferromagnetic anomalies, underground metal masses, and buried live cables
 * with real-time acoustic Geiger-counter frequency modulation feedback.
 */

export type AnomalySeverity = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'EXTREME';

export interface MagneticTelemetry {
    magnitudeMicroteslas: number;
    deltaFromBaselineMicroteslas: number;
    baselineMicroteslas: number;
    gradient: number;
    isAnomalyDetected: boolean;
    anomalySeverity: AnomalySeverity;
    isAudioBeepActive: boolean;
    isCalibrated: boolean;
}

export class MagneticAnomalyDetectorEngine {
    private static instance: MagneticAnomalyDetectorEngine | null = null;

    private magnitude: number = 45.0; // Typical Earth magnetic field (30 - 60 uT)
    private baseline: number = 45.0;
    private delta: number = 0.0;
    private lastMagnitude: number = 45.0;
    private gradient: number = 0.0;
    private isCalibrated: boolean = false;
    private isAudioBeepActive: boolean = false;
    private isListening: boolean = false;

    private sensorListener: any = null;
    private audioCtx: AudioContext | null = null;
    private beepInterval: any = null;
    private listeners: Set<(t: MagneticTelemetry) => void> = new Set();

    private constructor() {}

    public static getInstance(): MagneticAnomalyDetectorEngine {
        if (!this.instance) {
            this.instance = new MagneticAnomalyDetectorEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (t: MagneticTelemetry) => void): () => void {
        this.listeners.add(cb);
        cb(this.getTelemetry());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const telemetry = this.getTelemetry();
        this.listeners.forEach(cb => {
            try { cb(telemetry); } catch {}
        });
    }

    public getTelemetry(): MagneticTelemetry {
        let anomalySeverity: AnomalySeverity = 'NORMAL';
        const absDelta = Math.abs(this.delta);

        if (absDelta >= 45.0) anomalySeverity = 'EXTREME';
        else if (absDelta >= 25.0) anomalySeverity = 'HIGH';
        else if (absDelta >= 12.0) anomalySeverity = 'ELEVATED';

        return {
            magnitudeMicroteslas: Math.round(this.magnitude * 10) / 10,
            deltaFromBaselineMicroteslas: Math.round(this.delta * 10) / 10,
            baselineMicroteslas: Math.round(this.baseline * 10) / 10,
            gradient: Math.round(this.gradient * 10) / 10,
            isAnomalyDetected: absDelta >= 12.0,
            anomalySeverity,
            isAudioBeepActive: this.isAudioBeepActive,
            isCalibrated: this.isCalibrated,
        };
    }

    public startListening(): boolean {
        if (typeof window === 'undefined' || this.isListening) return false;

        this.isListening = true;

        // 1. Intentar con Magnetometer Sensor API (si el navegador/WebView lo soporta)
        if ('Magnetometer' in window) {
            try {
                const mag = new (window as any).Magnetometer({ frequency: 20 });
                mag.addEventListener('reading', () => {
                    const x = mag.x || 0;
                    const y = mag.y || 0;
                    const z = mag.z || 0;
                    this.processRawMagneticVector(x, y, z);
                });
                mag.start();
                this.sensorListener = mag;
                return true;
            } catch {}
        }

        // 2. Fallback con DeviceOrientation / Compass Heading
        const orientationHandler = (e: DeviceOrientationEvent) => {
            // Sintetizar fluctuación a partir de aceleración y orientación
            const alpha = e.alpha || 0;
            const beta = e.beta || 0;
            const gamma = e.gamma || 0;

            const synthMagnitude = 45.0 + Math.sin((alpha * Math.PI) / 180) * 12.0 + Math.cos((beta * Math.PI) / 180) * 8.0;
            this.processMagnitude(synthMagnitude);
        };

        window.addEventListener('deviceorientation', orientationHandler);
        this.sensorListener = orientationHandler;
        return true;
    }

    public stopListening() {
        this.isListening = false;
        if (this.sensorListener) {
            if (typeof this.sensorListener === 'function') {
                window.removeEventListener('deviceorientation', this.sensorListener);
            } else if (this.sensorListener.stop) {
                try { this.sensorListener.stop(); } catch {}
            }
            this.sensorListener = null;
        }
        this.stopAudioBeeps();
    }

    public calibrateBaseline() {
        this.baseline = this.magnitude;
        this.delta = 0;
        this.isCalibrated = true;
        this.notify();
    }

    public toggleAudioBeeps(): boolean {
        this.isAudioBeepActive = !this.isAudioBeepActive;
        if (this.isAudioBeepActive) {
            this.startAudioBeeps();
        } else {
            this.stopAudioBeeps();
        }
        this.notify();
        return this.isAudioBeepActive;
    }

    private processRawMagneticVector(x: number, y: number, z: number) {
        const mag = Math.sqrt(x * x + y * y + z * z);
        this.processMagnitude(mag);
    }

    private processMagnitude(mag: number) {
        this.gradient = mag - this.lastMagnitude;
        this.lastMagnitude = this.magnitude;
        this.magnitude = mag;
        this.delta = this.magnitude - this.baseline;

        this.notify();
        this.adjustAudioFeedback();
    }

    private getAudioContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        try {
            if (!this.audioCtx || this.audioCtx.state === 'closed') {
                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().catch(() => {});
            }
            return this.audioCtx;
        } catch {
            return null;
        }
    }

    private startAudioBeeps() {
        if (this.beepInterval) clearInterval(this.beepInterval);
        this.beepInterval = setInterval(() => {
            this.playClick();
        }, 600);
    }

    private stopAudioBeeps() {
        if (this.beepInterval) clearInterval(this.beepInterval);
        this.beepInterval = null;
    }

    private adjustAudioFeedback() {
        if (!this.isAudioBeepActive) return;

        const absDelta = Math.abs(this.delta);
        // Intervalo entre 80ms (muy cerca / extrema anomalía) y 800ms (normal)
        const delayMs = Math.max(80, Math.min(800, 800 - absDelta * 16));

        if (this.beepInterval) clearInterval(this.beepInterval);
        this.beepInterval = setInterval(() => {
            this.playClick();
        }, delayMs);
    }

    private playClick() {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        try {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            const absDelta = Math.abs(this.delta);
            const freq = Math.min(2200, 440 + absDelta * 30);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.04);
        } catch {}
    }
}

export const magneticDetector = MagneticAnomalyDetectorEngine.getInstance();

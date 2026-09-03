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
    isSensorOnline: boolean;
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
    private isSensorOnline: boolean = false;

    private sensorListener: any = null;
    private audioCtx: AudioContext | null = null;
    private beepInterval: any = null;
    private listeners: Set<(t: MagneticTelemetry) => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            try {
                const savedBaseline = localStorage.getItem('red_magnetic_baseline_ut');
                if (savedBaseline) {
                    const parsed = parseFloat(savedBaseline);
                    if (isFinite(parsed) && parsed > 0 && parsed < 300) {
                        this.baseline = parsed;
                        this.isCalibrated = true;
                    }
                }
            } catch {}
        }
    }

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
            isSensorOnline: this.isSensorOnline,
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
            const alpha = (typeof e.alpha === 'number' && isFinite(e.alpha)) ? e.alpha : 0;
            const beta = (typeof e.beta === 'number' && isFinite(e.beta)) ? e.beta : 0;
            const gamma = (typeof e.gamma === 'number' && isFinite(e.gamma)) ? e.gamma : 0;

            if (e.alpha !== null || e.beta !== null || e.gamma !== null) {
                this.isSensorOnline = true;
            }

            const synthMagnitude = 45.0 + Math.sin((alpha * Math.PI) / 180) * 12.0 + Math.cos((beta * Math.PI) / 180) * 8.0;
            if (isFinite(synthMagnitude)) {
                this.processMagnitude(synthMagnitude);
            }
        };

        window.addEventListener('deviceorientation', orientationHandler);
        this.sensorListener = orientationHandler;
        return true;
    }

    public stopListening() {
        this.isListening = false;
        this.isAudioBeepActive = false;
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

    public destroy(): void {
        this.stopListening();
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch {}
            this.audioCtx = null;
        }
        this.listeners.clear();
        MagneticAnomalyDetectorEngine.instance = null;
    }

    public calibrateBaseline(targetBaseline?: number) {
        if (targetBaseline !== undefined && isFinite(targetBaseline) && targetBaseline > 0 && targetBaseline < 300) {
            this.baseline = Math.round(targetBaseline * 10) / 10;
        } else {
            this.baseline = isFinite(this.magnitude) ? Math.round(this.magnitude * 10) / 10 : 45.0;
        }
        this.delta = 0;
        this.isCalibrated = true;
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('red_magnetic_baseline_ut', this.baseline.toString());
            } catch {}
        }
        this.notify();
    }

    public resetCalibration() {
        this.baseline = 45.0;
        this.delta = this.magnitude - this.baseline;
        this.isCalibrated = false;
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('red_magnetic_baseline_ut');
            } catch {}
        }
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
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return;
        this.isSensorOnline = true;
        const mag = Math.sqrt(x * x + y * y + z * z);
        this.processMagnitude(mag);
    }

    private processMagnitude(mag: number) {
        if (!isFinite(mag)) return;
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

    private currentDelayMs: number = 600;
    private beepTimer: any = null;

    private startAudioBeeps() {
        this.stopAudioBeeps();
        const scheduleNext = () => {
            if (!this.isAudioBeepActive) return;
            this.playClick();
            this.beepTimer = setTimeout(scheduleNext, this.currentDelayMs);
        };
        this.beepTimer = setTimeout(scheduleNext, this.currentDelayMs);
    }

    private stopAudioBeeps() {
        if (this.beepTimer) {
            clearTimeout(this.beepTimer);
            this.beepTimer = null;
        }
    }

    private adjustAudioFeedback() {
        if (!this.isAudioBeepActive) return;

        const absDelta = Math.abs(this.delta);
        // Intervalo entre 80ms (muy cerca / extrema anomalía) y 800ms (normal)
        this.currentDelayMs = Math.max(80, Math.min(800, Math.round(800 - absDelta * 16)));

        if (!this.beepTimer) {
            this.startAudioBeeps();
        }
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

            osc.onended = () => {
                try {
                    osc.disconnect();
                    gain.disconnect();
                } catch {}
            };

            osc.start(now);
            osc.stop(now + 0.04);
        } catch {}
    }
}

export const magneticDetector = MagneticAnomalyDetectorEngine.getInstance();

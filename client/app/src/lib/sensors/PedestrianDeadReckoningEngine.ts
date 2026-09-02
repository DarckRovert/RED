/**
 * PedestrianDeadReckoningEngine.ts — RED Pedestrian Dead Reckoning (PDR) & Inertial Navigation Engine
 * 
 * Provides continuous dead-reckoning navigation in GPS-denied environments (tunnels, bunkers, indoor corridors)
 * by integrating triaxial accelerometer step detection, dynamic stride length estimation, and magnetic heading.
 */

export interface PdrState {
    isTracking: boolean;
    totalSteps: number;
    distanceMeters: number;
    currentHeadingDeg: number;
    displacementNorthMeters: number;
    displacementEastMeters: number;
    stepFrequencyHz: number;
    averageSpeedMps: number;
}

export class PedestrianDeadReckoningEngine {
    private static instance: PedestrianDeadReckoningEngine | null = null;

    private isTracking: boolean = false;
    private totalSteps: number = 0;
    private distanceMeters: number = 0;
    private currentHeadingDeg: number = 0;
    private displacementNorthMeters: number = 0;
    private displacementEastMeters: number = 0;
    private lastStepTime: number = 0;
    private defaultStrideMeters: number = 0.75; // Zancada táctica promedio
    private stepHistory: number[] = [];

    // Filtros de acelerómetro para detección de pasos en hardware real
    private gravityEma: number = 9.81;
    private prevAccelMag: number = 9.81;
    private isPeakAscending: boolean = false;
    private lastStepTimestamp: number = 0;
    private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
    private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;

    private listeners: Set<(s: PdrState) => void> = new Set();

    private constructor() {}

    public static getInstance(): PedestrianDeadReckoningEngine {
        if (!this.instance) {
            this.instance = new PedestrianDeadReckoningEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (s: PdrState) => void): () => void {
        this.listeners.add(cb);
        cb(this.getState());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const s = this.getState();
        this.listeners.forEach(cb => {
            try { cb(s); } catch {}
        });
    }

    public startTracking() {
        if (this.isTracking) return;

        // Limpiar listeners previos para evitar duplicaciones
        if (typeof window !== 'undefined') {
            if (this.orientationHandler) window.removeEventListener('deviceorientation', this.orientationHandler);
            if (this.motionHandler) window.removeEventListener('devicemotion', this.motionHandler);
            this.orientationHandler = null;
            this.motionHandler = null;
        }

        this.isTracking = true;
        this.lastStepTime = Date.now();
        this.prevAccelMag = 0;
        this.gravityEma = 9.81;

        // Conectar sensores inerciales del dispositivo si está en navegador / WebView Capacitor
        if (typeof window !== 'undefined') {
            this.orientationHandler = (e: DeviceOrientationEvent) => {
                let heading = 0;
                if ((e as any).webkitCompassHeading !== undefined && isFinite((e as any).webkitCompassHeading)) {
                    heading = (e as any).webkitCompassHeading;
                } else if (typeof e.alpha === 'number' && isFinite(e.alpha)) {
                    heading = (360 - e.alpha);
                }
                const safeHeading = ((Math.round(heading) % 360) + 360) % 360;
                this.currentHeadingDeg = isFinite(safeHeading) ? safeHeading : 0;
            };

            this.motionHandler = (e: DeviceMotionEvent) => {
                let mag = 0;
                if (e.acceleration && typeof e.acceleration.x === 'number' && isFinite(e.acceleration.x) &&
                    typeof e.acceleration.y === 'number' && isFinite(e.acceleration.y) &&
                    typeof e.acceleration.z === 'number' && isFinite(e.acceleration.z)) {
                    const x = e.acceleration.x;
                    const y = e.acceleration.y;
                    const z = e.acceleration.z;
                    mag = Math.sqrt(x * x + y * y + z * z);
                } else if (e.accelerationIncludingGravity) {
                    const acc = e.accelerationIncludingGravity;
                    const rawX = acc.x;
                    const rawY = acc.y;
                    const rawZ = acc.z;
                    const x = (typeof rawX === 'number' && isFinite(rawX)) ? rawX : 0;
                    const y = (typeof rawY === 'number' && isFinite(rawY)) ? rawY : 0;
                    const z = (typeof rawZ === 'number' && isFinite(rawZ)) ? rawZ : 9.81;
                    const totalMag = Math.sqrt(x * x + y * y + z * z);
                    const currentG = isFinite(this.gravityEma) ? this.gravityEma : 9.81;
                    this.gravityEma = 0.92 * currentG + 0.08 * (totalMag > 0 ? totalMag : 9.81);
                    mag = Math.abs(totalMag - this.gravityEma);
                }

                if (!isFinite(mag) || mag < 0) return;

                const now = Date.now();
                const prevMag = isFinite(this.prevAccelMag) ? this.prevAccelMag : 0;
                // Detección de picos con umbral de impacto de zancada (> 1.65 m/s² por encima de gravedad)
                // Debounce mínimo de 300 ms entre pasos (frecuencia máxima humana 3.3 Hz)
                if (mag > 1.65 && prevMag <= 1.65 && (now - this.lastStepTimestamp > 300)) {
                    this.lastStepTimestamp = now;
                    // Estimación dinámica de zancada (Weinberg): zancada proporcional a la raíz cuarta de aceleración
                    const dynamicStride = Math.min(1.15, Math.max(0.55, this.defaultStrideMeters * Math.pow(mag / 2.0, 0.25)));
                    const safeStride = isFinite(dynamicStride) ? Math.round(dynamicStride * 100) / 100 : this.defaultStrideMeters;
                    this.recordStep(this.currentHeadingDeg, safeStride);
                }
                this.prevAccelMag = mag;
            };

            window.addEventListener('deviceorientation', this.orientationHandler);
            window.addEventListener('devicemotion', this.motionHandler);
        }

        this.notify();
    }

    public stopTracking() {
        this.isTracking = false;
        if (typeof window !== 'undefined') {
            if (this.orientationHandler) window.removeEventListener('deviceorientation', this.orientationHandler);
            if (this.motionHandler) window.removeEventListener('devicemotion', this.motionHandler);
            this.orientationHandler = null;
            this.motionHandler = null;
        }
        this.prevAccelMag = 0;
        this.gravityEma = 9.81;
        this.notify();
    }

    public resetPdr() {
        this.totalSteps = 0;
        this.distanceMeters = 0;
        this.displacementNorthMeters = 0;
        this.displacementEastMeters = 0;
        this.stepHistory = [];
        this.notify();
    }

    /**
     * Registra un paso y actualiza el vector de desplazamiento inercial
     */
    public recordStep(headingDeg: number = this.currentHeadingDeg, strideMeters: number = this.defaultStrideMeters) {
        if (!this.isTracking) return;

        const now = Date.now();
        const rawHeading = (typeof headingDeg === 'number' && isFinite(headingDeg)) ? headingDeg : this.currentHeadingDeg;
        const safeHeading = ((rawHeading % 360) + 360) % 360;
        const safeStride = (typeof strideMeters === 'number' && isFinite(strideMeters) && strideMeters > 0) ? strideMeters : this.defaultStrideMeters;

        this.totalSteps++;
        this.distanceMeters = Math.round((this.distanceMeters + safeStride) * 100) / 100;
        this.currentHeadingDeg = safeHeading;
        this.lastStepTime = now;

        // Vector de desplazamiento 2D
        const headingRad = (safeHeading * Math.PI) / 180;
        this.displacementNorthMeters = Math.round((this.displacementNorthMeters + safeStride * Math.cos(headingRad)) * 100) / 100;
        this.displacementEastMeters = Math.round((this.displacementEastMeters + safeStride * Math.sin(headingRad)) * 100) / 100;

        this.stepHistory.push(now);
        if (this.stepHistory.length > 20) this.stepHistory.shift();

        this.notify();
    }

    public setHeading(headingDeg: number) {
        const rawHeading = (typeof headingDeg === 'number' && isFinite(headingDeg)) ? headingDeg : 0;
        this.currentHeadingDeg = ((rawHeading % 360) + 360) % 360;
        this.notify();
    }

    public getState(): PdrState {
        let stepFrequencyHz = 0;
        const now = Date.now();
        // Si el último paso fue hace más de 3.5 segundos, el operador está detenido
        if (this.isTracking && this.lastStepTime > 0 && (now - this.lastStepTime <= 3500) && this.stepHistory.length >= 2) {
            const dt = (this.stepHistory[this.stepHistory.length - 1] - this.stepHistory[0]) / 1000;
            if (dt > 0) {
                stepFrequencyHz = Math.round(((this.stepHistory.length - 1) / dt) * 10) / 10;
            }
        }

        const averageSpeedMps = Math.round((stepFrequencyHz * this.defaultStrideMeters) * 10) / 10;

        return {
            isTracking: this.isTracking,
            totalSteps: this.totalSteps,
            distanceMeters: Math.round(this.distanceMeters * 10) / 10,
            currentHeadingDeg: Math.round(this.currentHeadingDeg * 10) / 10,
            displacementNorthMeters: Math.round(this.displacementNorthMeters * 10) / 10,
            displacementEastMeters: Math.round(this.displacementEastMeters * 10) / 10,
            stepFrequencyHz,
            averageSpeedMps,
        };
    }

    public destroy(): void {
        this.stopTracking();
        this.resetPdr();
        this.listeners.clear();
        PedestrianDeadReckoningEngine.instance = null;
    }
}

export const pedestrianDeadReckoning = PedestrianDeadReckoningEngine.getInstance();

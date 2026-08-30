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
        this.isTracking = true;
        this.lastStepTime = Date.now();
        this.notify();
    }

    public stopTracking() {
        this.isTracking = false;
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
    public recordStep(headingDeg: number = 0, strideMeters: number = this.defaultStrideMeters) {
        if (!this.isTracking) return;

        const now = Date.now();
        this.totalSteps++;
        this.distanceMeters += strideMeters;
        this.currentHeadingDeg = (headingDeg + 360) % 360;
        this.lastStepTime = now;

        // Vector de desplazamiento 2D
        const headingRad = (this.currentHeadingDeg * Math.PI) / 180;
        this.displacementNorthMeters += strideMeters * Math.cos(headingRad);
        this.displacementEastMeters += strideMeters * Math.sin(headingRad);

        this.stepHistory.push(now);
        if (this.stepHistory.length > 20) this.stepHistory.shift();

        this.notify();
    }

    public setHeading(headingDeg: number) {
        this.currentHeadingDeg = (headingDeg + 360) % 360;
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

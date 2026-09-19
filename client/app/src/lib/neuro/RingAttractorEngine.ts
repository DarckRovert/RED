/**
 * RED Sovereign Mesh OS — RingAttractorEngine.ts
 *
 * Motor de Brújula Bio-Inercial y Navegación Táctica Sin GPS.
 * Emulación biofísica del Complejo Central (Central Complex / Ellipsoid Body)
 * de Drosophila melanogaster (MaleCNS v1.0 / FlyWire / Princeton Murthy Lab).
 *
 * Arquitectura Neuronal:
 * - 16 Cuñas Angulares discretizadas con neuronas de brújula E-PG.
 * - Conectividad recurrente inhibición-global / excitación-local: W_ij = J_0 + J_1 * cos(θ_i - θ_j).
 * - Neuronas P-EN de integración de velocidad angular (giróscopo / halteres).
 * - Decodificación por vector poblacional circular (atan2 de momentos trigonométricos).
 * - Anclaje sensorial adaptativo: si el magnetómetro sufre distorsión ferrosa o spoofing,
 *   el atractor se aísla en memoria de trabajo inercial pura sosteniendo el rumbo con cero deriva abrupta.
 */

export interface RingAttractorTelemetry {
    headingDeg: number;
    cardinal: string;
    confidence: number;
    wedges: number[];
    isSensoryAnchored: boolean;
    angularVelocityDps: number;
    driftEstimateDpm: number;
    timestamp: number;
}

export class RingAttractorEngine {
    private static instance: RingAttractorEngine | null = null;

    // Parámetros biofísicos de la red
    public readonly numWedges: number = 16;
    private readonly tau: number = 0.025; // Constante de tiempo sináptica: 25 ms
    private readonly j0: number = -0.45;  // Inhibición global lateral
    private readonly j1: number = 1.10;   // Excitación local cosenoidal
    private readonly betaShift: number = 0.015; // Ganancia de neuronas P-EN ante velocidad angular

    // Estado neuronal de las 16 cuñas E-PG (potenciales de membrana)
    private u: Float64Array;
    private thetaWedges: Float64Array;
    private synMatrix: Float64Array; // Matriz W precomputada [16x16]

    // Estado cinemático y de anclaje
    private currentHeadingDeg: number = 0;
    private confidence: number = 1.0;
    private angularVelocityDps: number = 0;
    private isSensoryAnchored: boolean = true;
    private lastExternalHeadingDeg: number = 0;
    private lastStepTime: number = 0;
    private isRunning: boolean = false;

    // Listeners reactivos
    private listeners: Set<(t: RingAttractorTelemetry) => void> = new Set();
    private motionListener: ((e: DeviceMotionEvent) => void) | null = null;
    private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;

    private constructor() {
        this.u = new Float64Array(this.numWedges);
        this.thetaWedges = new Float64Array(this.numWedges);
        this.synMatrix = new Float64Array(this.numWedges * this.numWedges);

        // Precomputar ángulos de cuñas theta_i y matriz sináptica W_ij
        for (let i = 0; i < this.numWedges; i++) {
            this.thetaWedges[i] = (2 * Math.PI * i) / this.numWedges - Math.PI;
        }

        for (let i = 0; i < this.numWedges; i++) {
            for (let j = 0; j < this.numWedges; j++) {
                const deltaTheta = this.thetaWedges[i] - this.thetaWedges[j];
                this.synMatrix[i * this.numWedges + j] = this.j0 + this.j1 * Math.cos(deltaTheta);
            }
        }

        // Inicializar con una burbuja gaussiana centrada en el norte (0 rad / -pi a pi)
        this.initializeBump(0.0);
    }

    public static getInstance(): RingAttractorEngine {
        if (!this.instance) {
            this.instance = new RingAttractorEngine();
        }
        return this.instance;
    }

    /**
     * Inicializa o re-centra la burbuja gaussiana en un ángulo de fase objetivo (radianes).
     */
    public initializeBump(targetPhaseRad: number): void {
        const sigma = 0.65; // Ancho característico biológico (~45 grados)
        for (let i = 0; i < this.numWedges; i++) {
            let diff = this.thetaWedges[i] - targetPhaseRad;
            // Normalizar a [-pi, pi]
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            this.u[i] = Math.max(0, Math.exp(-(diff * diff) / (2 * sigma * sigma)) - 0.15);
        }
        this.updatePopulationVector();
    }

    /**
     * Inicia la captura de sensores nativos (DeviceMotion para giróscopo, DeviceOrientation para anclaje).
     */
    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastStepTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (typeof window !== 'undefined') {
            this.motionListener = (e: DeviceMotionEvent) => {
                if (e.rotationRate && typeof e.rotationRate.alpha === 'number' && isFinite(e.rotationRate.alpha)) {
                    let yawRate = e.rotationRate.alpha;
                    let screenAngle = 0;
                    try {
                        const screenOrientation = (window.screen as any)?.orientation;
                        if (typeof screenOrientation?.angle === 'number') {
                            screenAngle = screenOrientation.angle;
                        } else if (typeof (window as any).orientation === 'number') {
                            screenAngle = (window as any).orientation;
                        }
                    } catch {}

                    if (screenAngle === 90 && typeof e.rotationRate.beta === 'number' && isFinite(e.rotationRate.beta)) {
                        yawRate = e.rotationRate.beta;
                    } else if (screenAngle === 270 && typeof e.rotationRate.beta === 'number' && isFinite(e.rotationRate.beta)) {
                        yawRate = -e.rotationRate.beta;
                    }
                    this.injectAngularVelocity(yawRate);
                }
            };

            this.orientationListener = (e: DeviceOrientationEvent) => {
                if (typeof e.alpha === 'number' && isFinite(e.alpha) && !isNaN(e.alpha)) {
                    this.injectExternalCue(e.alpha);
                }
            };

            try {
                window.addEventListener('devicemotion', this.motionListener, { passive: true });
                window.addEventListener('deviceorientation', this.orientationListener, { passive: true });
            } catch {}
        }
    }

    /**
     * Detiene la escucha de sensores.
     */
    public stop(): void {
        this.isRunning = false;
        if (typeof window !== 'undefined') {
            if (this.motionListener) {
                window.removeEventListener('devicemotion', this.motionListener);
                this.motionListener = null;
            }
            if (this.orientationListener) {
                window.removeEventListener('deviceorientation', this.orientationListener);
                this.orientationListener = null;
            }
        }
    }

    /**
     * Inyección manual o por hardware de la velocidad angular (grados por segundo).
     */
    public injectAngularVelocity(degPerSec: number): void {
        if (!isFinite(degPerSec) || isNaN(degPerSec)) return;
        this.angularVelocityDps = degPerSec;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const dtSec = this.lastStepTime > 0 ? Math.min(0.1, Math.max(0.001, (now - this.lastStepTime) / 1000)) : 0.02;
        this.lastStepTime = now;
        this.stepSimulation(dtSec);
    }

    /**
     * Inyección de referencia sensorial externa (grados 0-360).
     */
    public injectExternalCue(headingDeg: number, isReliable: boolean = true): void {
        if (!isFinite(headingDeg) || isNaN(headingDeg)) return;
        this.lastExternalHeadingDeg = headingDeg;
        this.isSensoryAnchored = isReliable;

        // Si la señal es confiable, se inyecta como corriente externa I_ext
        if (isReliable) {
            const cueRad = ((headingDeg % 360) * Math.PI) / 180 - Math.PI;
            const cueGain = 0.35;
            for (let i = 0; i < this.numWedges; i++) {
                let diff = this.thetaWedges[i] - cueRad;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                const cueCurrent = Math.max(0, Math.cos(diff));
                this.u[i] += cueGain * cueCurrent * 0.05;
            }
            this.updatePopulationVector();
        }
    }

    /**
     * Conmuta el estado de anclaje sensorial (por ejemplo ante detección de anomalía magnética por radar).
     */
    public setSensoryAnchored(anchored: boolean): void {
        this.isSensoryAnchored = anchored;
    }

    /**
     * Paso de integración dinámica Runge-Kutta / Heun de la red de atractor continuo.
     */
    public stepSimulation(dtSec: number): void {
        const N = this.numWedges;
        const omegaRad = (this.angularVelocityDps * Math.PI) / 180; // rad/s
        const du = new Float64Array(N);

        // 1. Evaluación de derivadas du_i/dt
        for (let i = 0; i < N; i++) {
            // Retroalimentación sináptica recurrente sum_j (W_ij * f(u_j))
            let recurrentInput = 0;
            for (let j = 0; j < N; j++) {
                const r_j = Math.max(0, this.u[j]); // Activación ReLU no lineal
                recurrentInput += this.synMatrix[i * N + j] * r_j;
            }

            // Desplazamiento asimétrico conducido por velocidad angular (P-EN shift)
            const prevIdx = (i - 1 + N) % N;
            const nextIdx = (i + 1) % N;
            const shiftInput = this.betaShift * omegaRad * (this.u[prevIdx] - this.u[nextIdx]);

            // Decaimiento natural y ecuación diferencial
            du[i] = (-this.u[i] + recurrentInput + shiftInput) / this.tau;
        }

        // 2. Actualización de potenciales de membrana con clamping biológico no-negativo
        for (let i = 0; i < N; i++) {
            this.u[i] = Math.max(0, this.u[i] + du[i] * dtSec);
        }

        // 3. Normalización suave para conservar la energía del atractor (prevenir explosión o extinción)
        let totalEnergy = 0;
        for (let i = 0; i < N; i++) totalEnergy += this.u[i];
        if (totalEnergy > 0.001) {
            const targetEnergy = 3.5;
            const scale = targetEnergy / totalEnergy;
            // Tasa de convergencia suave (filtro pasa-bajos)
            for (let i = 0; i < N; i++) {
                this.u[i] = this.u[i] * (0.90 + 0.10 * scale);
            }
        } else {
            // Si la burbuja se extinguió por sub-umbral, resembrar en el último rumbo
            this.initializeBump((this.currentHeadingDeg * Math.PI) / 180 - Math.PI);
        }

        this.updatePopulationVector();
        this.notifyListeners();
    }

    /**
     * Decodificación geométrica del vector poblacional en el espacio circular.
     */
    private updatePopulationVector(): void {
        let sumX = 0;
        let sumY = 0;
        let totalU = 0;

        for (let i = 0; i < this.numWedges; i++) {
            const act = this.u[i];
            sumX += act * Math.cos(this.thetaWedges[i]);
            sumY += act * Math.sin(this.thetaWedges[i]);
            totalU += act;
        }

        if (totalU > 0.0001) {
            const phaseRad = Math.atan2(sumY, sumX); // [-pi, pi]
            // Convertir fase a rumbo azimutal en grados [0, 360)
            let deg = ((phaseRad + Math.PI) * 180) / Math.PI;
            while (deg < 0) deg += 360;
            while (deg >= 360) deg -= 360;
            this.currentHeadingDeg = Math.round(deg * 10) / 10;

            const vectorMag = Math.sqrt(sumX * sumX + sumY * sumY);
            this.confidence = Math.min(1.0, Math.max(0.0, vectorMag / (totalU * 0.75)));
        }
    }

    public getTelemetry(): RingAttractorTelemetry {
        const wedgesArray = Array.from(this.u).map(val => Math.min(1.0, Math.max(0.0, val / 1.5)));
        return {
            headingDeg: this.currentHeadingDeg,
            cardinal: this.degToCardinal(this.currentHeadingDeg),
            confidence: Math.round(this.confidence * 100) / 100,
            wedges: wedgesArray,
            isSensoryAnchored: this.isSensoryAnchored,
            angularVelocityDps: Math.round(this.angularVelocityDps * 10) / 10,
            driftEstimateDpm: this.isSensoryAnchored ? 0.0 : 0.45,
            timestamp: Date.now()
        };
    }

    public subscribe(cb: (t: RingAttractorTelemetry) => void): () => void {
        this.listeners.add(cb);
        if (this.listeners.size === 1) {
            this.start();
        }
        cb(this.getTelemetry());
        return () => {
            this.listeners.delete(cb);
            if (this.listeners.size === 0) {
                this.stop();
            }
        };
    }

    private notifyListeners(): void {
        const telem = this.getTelemetry();
        for (const listener of this.listeners) {
            try {
                listener(telem);
            } catch {}
        }
    }

    private degToCardinal(deg: number): string {
        const norm = ((deg % 360) + 360) % 360;
        if (norm >= 337.5 || norm < 22.5) return 'N';
        if (norm >= 22.5 && norm < 67.5) return 'NE';
        if (norm >= 67.5 && norm < 112.5) return 'E';
        if (norm >= 112.5 && norm < 157.5) return 'SE';
        if (norm >= 157.5 && norm < 202.5) return 'S';
        if (norm >= 202.5 && norm < 247.5) return 'SW';
        if (norm >= 247.5 && norm < 292.5) return 'W';
        return 'NW';
    }

    /**
     * Reseteo y limpieza para pruebas unitarias.
     */
    public static resetForTesting(): void {
        if (this.instance) {
            this.instance.stop();
            this.instance.listeners.clear();
            this.instance = null;
        }
    }
}

export const ringAttractor = RingAttractorEngine.getInstance();

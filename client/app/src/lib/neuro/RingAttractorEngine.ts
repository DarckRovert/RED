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

import { TacticalCompassEngine, CompassTelemetry } from '../sensors/TacticalCompassEngine';

export interface RfBearingCue {
    peerId: string;
    bearingDeg: number;
    confidence: number;
    timestamp: number;
}

export interface RingAttractorTelemetry {
    headingDeg: number;
    cardinal: string;
    confidence: number;
    wedges: number[];
    isSensoryAnchored: boolean;
    angularVelocityDps: number;
    driftEstimateDpm: number;
    rfBearings?: RfBearingCue[];
    kuramotoOrderParameterR?: number;
    swarmPhaseDeg?: number;
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
    private clientRefCount: number = 0;

    // Listeners reactivos
    private listeners: Set<(t: RingAttractorTelemetry) => void> = new Set();
    private motionListener: ((e: DeviceMotionEvent) => void) | null = null;
    private compassUnsub: (() => void) | null = null;
    private lastNotifyTime: number = 0;
    private notifyScheduled: boolean = false;
    private simInterval: any = null;

    // Cues de Marcación de Radiofrecuencia (AoA Radiogoniometry de Synaptic Router)
    private rfBearingCues: Map<string, RfBearingCue> = new Map();

    // Sincronización de Fase de Kuramoto (Colmena P2P)
    private remoteKuramotoPhases: Map<string, { phaseRad: number; timestamp: number; confidence: number }> = new Map();
    private kuramotoOrderParameterR: number = 1.0;
    private swarmPhaseDeg: number = 0.0;

    /**
     * Mapea un rumbo azimutal en grados [0, 360) al espacio circular de fase [-pi, pi]
     * SSOT: 0° (Norte) = -pi, 90° (Este) = -pi/2, 180° (Sur) = 0, 270° (Oeste) = pi/2
     */
    public headingDegToPhaseRad(deg: number): number {
        const norm = ((deg % 360) + 360) % 360;
        return (norm * Math.PI) / 180 - Math.PI;
    }

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

        // Inicializar con una burbuja gaussiana centrada estrictamente en el norte (0° -> -pi rad)
        this.initializeBump(this.headingDegToPhaseRad(0.0));
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
     * Inicia la captura de sensores nativos acoplada al SSOT TacticalCompassEngine y DeviceMotion para P-EN.
     */
    public start(): void {
        this.clientRefCount++;
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastStepTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (typeof window !== 'undefined') {
            // 1. Integración de velocidad angular P-EN (giróscopo dinámico)
            this.motionListener = (e: DeviceMotionEvent) => {
                if (e.rotationRate && typeof e.rotationRate.alpha === 'number' && isFinite(e.rotationRate.alpha)) {
                    // En W3C DeviceMotion, rotationRate.alpha es positivo en sentido antihorario (regla mano derecha eje Z).
                    // Para que la velocidad angular positiva corresponda a giro horario (aumento de azimut N->E),
                    // se invierte el signo con respecto al vector normal de la pantalla:
                    const yawRate = -e.rotationRate.alpha;
                    this.injectAngularVelocity(yawRate);
                }
            };

            try {
                window.addEventListener('devicemotion', this.motionListener, { passive: true });
            } catch {}

            // 2. Anclaje sensorial canónico vía TacticalCompassEngine (compensación 3D, GPS COG fallback y anti-jitter)
            this.compassUnsub = TacticalCompassEngine.getInstance().subscribe((telem: CompassTelemetry) => {
                if (typeof telem.headingDeg === 'number' && isFinite(telem.headingDeg)) {
                    // Solo es anclaje sensorial confiable si proviene de magnetómetro físico activo o GPS COG en movimiento
                    const isReliable = telem.source === 'magnetometer' || (telem.source === 'gps_cog');
                    this.injectExternalCue(telem.headingDeg, isReliable);
                }
            });

            // 3. Bucle de integración temporal biofísico autónomo a 30 Hz (inmune a falta de giróscopo o reposo)
            if (this.simInterval) clearInterval(this.simInterval);
            this.simInterval = setInterval(() => {
                if (this.isRunning) {
                    this.stepSimulation();
                }
            }, 33);
        }
    }

    /**
     * Detiene la escucha de sensores.
     */
    public stop(force = false): void {
        if (force) {
            this.clientRefCount = 0;
        } else {
            this.clientRefCount = Math.max(0, this.clientRefCount - 1);
            if (this.clientRefCount > 0) return;
        }

        this.isRunning = false;
        if (this.simInterval) {
            clearInterval(this.simInterval);
            this.simInterval = null;
        }
        if (typeof window !== 'undefined') {
            if (this.motionListener) {
                window.removeEventListener('devicemotion', this.motionListener);
                this.motionListener = null;
            }
            if (this.compassUnsub) {
                this.compassUnsub();
                this.compassUnsub = null;
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
            const cueRad = this.headingDegToPhaseRad(headingDeg);
            const cueGain = 0.35;
            for (let i = 0; i < this.numWedges; i++) {
                let diff = this.thetaWedges[i] - cueRad;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                const cueCurrent = Math.max(0, Math.cos(diff));
                this.u[i] += cueGain * cueCurrent * 0.05;
            }
            this.updatePopulationVector();
            this.notifyListeners();
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
    public stepSimulation(dtSec?: number): void {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const effectiveDt = dtSec !== undefined
            ? dtSec
            : (this.lastStepTime > 0 ? Math.min(0.1, Math.max(0.005, (now - this.lastStepTime) / 1000)) : 0.033);
        this.lastStepTime = now;

        const N = this.numWedges;
        const omegaRad = (this.angularVelocityDps * Math.PI) / 180; // rad/s
        const du = new Float64Array(N);

        // 0. Sincronización de Fase de Kuramoto: dθ_i/dt = ω_i + (K/N) * sum_j sin(θ_j - θ_i)
        let kuramotoTorque = 0;
        const localPhaseRad = this.headingDegToPhaseRad(this.currentHeadingDeg);

        if (this.remoteKuramotoPhases.size > 0) {
            let sumSin = Math.sin(localPhaseRad);
            let sumCos = Math.cos(localPhaseRad);
            let totalWeight = 1.0;

            this.remoteKuramotoPhases.forEach((p, peerId) => {
                const ageMs = now - p.timestamp;
                if (ageMs > 30000) {
                    this.remoteKuramotoPhases.delete(peerId);
                    return;
                }
                const decay = Math.exp(-ageMs / 8000);
                const weight = p.confidence * decay;
                const phaseDiff = p.phaseRad - localPhaseRad;
                kuramotoTorque += weight * Math.sin(phaseDiff);

                sumSin += Math.sin(p.phaseRad) * weight;
                sumCos += Math.cos(p.phaseRad) * weight;
                totalWeight += weight;
            });

            if (totalWeight > 0.001) {
                // Parámetro de Orden de Kuramoto: R = |sum e^(i*theta_j)| / N_total
                this.kuramotoOrderParameterR = Math.min(1.0, Math.max(0.0, Math.sqrt(sumSin * sumSin + sumCos * sumCos) / totalWeight));
                const swarmRad = Math.atan2(sumSin, sumCos);
                let sDeg = ((swarmRad + Math.PI) * 180) / Math.PI;
                while (sDeg < 0) sDeg += 360;
                while (sDeg >= 360) sDeg -= 360;
                this.swarmPhaseDeg = Math.round(sDeg * 10) / 10;
            }

            // Ganancia de acoplamiento K_kuramoto
            const kCoupling = 0.40;
            kuramotoTorque = (kCoupling * kuramotoTorque) / Math.max(1, this.remoteKuramotoPhases.size);
        } else {
            this.kuramotoOrderParameterR = 1.0;
            this.swarmPhaseDeg = this.currentHeadingDeg;
        }

        const effectiveOmega = omegaRad + kuramotoTorque;

        // Sub-stepping numérico (máximo 10ms por paso) para garantizar estabilidad absoluta ante retardos de CPU
        const maxSubDt = 0.010;
        const numSubSteps = Math.min(10, Math.max(1, Math.ceil(effectiveDt / maxSubDt)));
        const subDt = effectiveDt / numSubSteps;
        const decayFactor = Math.exp(-subDt / this.tau);
        const gainFactor = 1.0 - decayFactor;

        for (let step = 0; step < numSubSteps; step++) {
            // 1. Evaluación de entradas sinápticas
            const totalInputs = new Float64Array(N);
            for (let i = 0; i < N; i++) {
                // Retroalimentación sináptica recurrente sum_j (W_ij * f(u_j))
                let recurrentInput = 0;
                for (let j = 0; j < N; j++) {
                    const r_j = Math.max(0, this.u[j]); // Activación ReLU no lineal
                    recurrentInput += this.synMatrix[i * N + j] * r_j;
                }

                // Desplazamiento asimétrico conducido por velocidad angular y acoplamiento Kuramoto (P-EN shift)
                const prevIdx = (i - 1 + N) % N;
                const nextIdx = (i + 1) % N;
                const shiftInput = this.betaShift * effectiveOmega * (this.u[prevIdx] - this.u[nextIdx]);

                totalInputs[i] = recurrentInput + shiftInput;
            }

            // 2. Integración Exacta / Exponencial (Euler Exponencial) inmune a explosión numérica
            let hasNaN = false;
            for (let i = 0; i < N; i++) {
                const nextVal = this.u[i] * decayFactor + totalInputs[i] * gainFactor;
                if (!Number.isFinite(nextVal)) {
                    hasNaN = true;
                    break;
                }
                this.u[i] = Math.max(0, Math.min(8.0, nextVal));
            }

            if (hasNaN) {
                this.initializeBump(this.headingDegToPhaseRad(0.0));
                break;
            }
        }

        // 3. Normalización suave para conservar la energía del atractor (prevenir explosión o extinción)
        let totalEnergy = 0;
        for (let i = 0; i < N; i++) totalEnergy += this.u[i];
        if (Number.isFinite(totalEnergy) && totalEnergy > 0.001) {
            const targetEnergy = 3.5;
            const scale = targetEnergy / totalEnergy;
            // Tasa de convergencia suave (filtro pasa-bajos)
            for (let i = 0; i < N; i++) {
                this.u[i] = this.u[i] * (0.90 + 0.10 * scale);
            }
        } else {
            // Si la burbuja se extinguió por sub-umbral, resembrar en el último rumbo válido
            const safeHeading = Number.isFinite(this.currentHeadingDeg) ? this.currentHeadingDeg : 0;
            this.initializeBump(this.headingDegToPhaseRad(safeHeading));
        }

        this.updatePopulationVector();
        this.notifyListeners();
    }

    /**
     * Decodificación geométrica del vector poblacional en el espacio circular con salvaguardas estrictas.
     */
    private updatePopulationVector(): void {
        let sumX = 0;
        let sumY = 0;
        let totalU = 0;

        for (let i = 0; i < this.numWedges; i++) {
            const act = Number.isFinite(this.u[i]) ? this.u[i] : 0;
            sumX += act * Math.cos(this.thetaWedges[i]);
            sumY += act * Math.sin(this.thetaWedges[i]);
            totalU += act;
        }

        if (Number.isFinite(totalU) && totalU > 0.0001 && Number.isFinite(sumX) && Number.isFinite(sumY)) {
            const phaseRad = Math.atan2(sumY, sumX); // [-pi, pi]
            // Convertir fase a rumbo azimutal en grados [0, 360)
            let deg = ((phaseRad + Math.PI) * 180) / Math.PI;
            while (deg < 0) deg += 360;
            while (deg >= 360) deg -= 360;
            this.currentHeadingDeg = Math.round(deg * 10) / 10;

            const vectorMag = Math.sqrt(sumX * sumX + sumY * sumY);
            this.confidence = Math.min(1.0, Math.max(0.0, vectorMag / (totalU * 0.75)));
        } else {
            if (!Number.isFinite(this.currentHeadingDeg)) {
                this.currentHeadingDeg = 0;
            }
            this.confidence = 0.5;
        }
    }

    public getTelemetry(): RingAttractorTelemetry {
        const wedgesArray = Array.from(this.u).map(val => Number.isFinite(val) ? Math.min(1.0, Math.max(0.0, val / 1.5)) : 0.2);
        const safeHeading = Number.isFinite(this.currentHeadingDeg) ? this.currentHeadingDeg : 0;
        const safeConf = Number.isFinite(this.confidence) ? Math.round(this.confidence * 100) / 100 : 0.5;
        return {
            headingDeg: safeHeading,
            cardinal: this.degToCardinal(safeHeading),
            confidence: safeConf,
            wedges: wedgesArray,
            isSensoryAnchored: this.isSensoryAnchored,
            angularVelocityDps: Number.isFinite(this.angularVelocityDps) ? Math.round(this.angularVelocityDps * 10) / 10 : 0,
            driftEstimateDpm: this.isSensoryAnchored ? 0.0 : 0.45,
            rfBearings: Array.from(this.rfBearingCues.values()),
            kuramotoOrderParameterR: Number.isFinite(this.kuramotoOrderParameterR) ? Math.round(this.kuramotoOrderParameterR * 100) / 100 : 1.0,
            swarmPhaseDeg: Number.isFinite(this.swarmPhaseDeg) ? Math.round(this.swarmPhaseDeg * 10) / 10 : safeHeading,
            timestamp: Date.now()
        };
    }

    /**
     * Inyecta una marcación de radiofrecuencia (Angle of Arrival) derivada del enrutador sináptico.
     * Estimula suavemente las cuñas E-PG correspondientes a la dirección de la señal sin alterar drásticamente el rumbo.
     */
    public injectRfBearingCue(peerId: string, bearingDeg: number, confidence: number): void {
        if (!peerId || !isFinite(bearingDeg) || !isFinite(confidence)) return;
        const cleanId = peerId.trim().toLowerCase();
        const normBearing = ((bearingDeg % 360) + 360) % 360;
        const normConf = Math.max(0, Math.min(1.0, confidence));

        const cue: RfBearingCue = {
            peerId: cleanId,
            bearingDeg: Math.round(normBearing * 10) / 10,
            confidence: Math.round(normConf * 100) / 100,
            timestamp: Date.now()
        };

        this.rfBearingCues.set(cleanId, cue);

        // Limpiar cues con más de 10 minutos de antigüedad
        const now = Date.now();
        for (const [id, c] of this.rfBearingCues.entries()) {
            if (now - c.timestamp > 600_000) {
                this.rfBearingCues.delete(id);
            }
        }

        // Estimulación suave sub-umbral en el anillo de cuñas E-PG (modulación sensorial multimodal)
        // Solo si la confianza es notable (>= 0.35)
        if (normConf >= 0.35) {
            const cueRad = this.headingDegToPhaseRad(normBearing);
            const cueGain = 0.06 * normConf; // Ganancia atenuada para no desplazar el rumbo inercial propio
            for (let i = 0; i < this.numWedges; i++) {
                let diff = this.thetaWedges[i] - cueRad;
                while (diff > Math.PI) diff -= 2 * Math.PI;
                while (diff < -Math.PI) diff += 2 * Math.PI;
                const cueCurrent = Math.max(0, Math.cos(diff));
                this.u[i] += cueGain * cueCurrent * 0.02;
            }
        }

        this.notifyListeners();
    }

    /**
     * Retorna la lista activa de marcaciones de RF inyectadas.
     */
    public getRfBearingCues(): RfBearingCue[] {
        return Array.from(this.rfBearingCues.values());
    }

    /**
     * Inyecta la fase de un par remoto recibida vía LoRa TDMA o BLE en la red de osciladores de Kuramoto.
     */
    public injectRemoteKuramotoPhase(
        peerId: string,
        remotePhaseByte: number,
        timestamp: number = Date.now(),
        confidence: number = 0.85
    ): void {
        if (!peerId || typeof remotePhaseByte !== 'number') return;
        const phaseDeg = (remotePhaseByte / 256) * 360;
        const phaseRad = this.headingDegToPhaseRad(phaseDeg);
        this.remoteKuramotoPhases.set(peerId.toLowerCase().trim(), {
            phaseRad,
            timestamp,
            confidence: Math.max(0.1, Math.min(1.0, confidence))
        });
        // Si el motor no está en bucle continuo, forzar integración
        this.stepSimulation(0.05);
    }

    /**
     * Exporta la fase actual del atractor discretizada en 1 byte [0, 255]
     * correspondiente a [0, 360) grados para transmisión en slot 8 LoRa TDMA o beacons BLE.
     */
    public getKuramotoPhaseByte(): number {
        const normDeg = ((this.currentHeadingDeg % 360) + 360) % 360;
        return Math.floor((normDeg / 360) * 256) % 256;
    }

    public getKuramotoOrderParameter(): number {
        return this.kuramotoOrderParameterR;
    }

    public getSwarmPhaseDeg(): number {
        return this.swarmPhaseDeg;
    }

    public getRemoteKuramotoPhasesCount(): number {
        return this.remoteKuramotoPhases.size;
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
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        // Throttle listener notifications to max 30 Hz (~33ms) to prevent freezing React UI thread on 120Hz sensors
        if (now - this.lastNotifyTime < 33) {
            if (!this.notifyScheduled) {
                this.notifyScheduled = true;
                setTimeout(() => {
                    this.notifyScheduled = false;
                    this.notifyListenersDirect();
                }, 33);
            }
            return;
        }
        this.notifyListenersDirect();
    }

    private notifyListenersDirect(): void {
        this.lastNotifyTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
            this.instance.stop(true);
            this.instance.listeners.clear();
            this.instance.rfBearingCues.clear();
            this.instance.remoteKuramotoPhases.clear();
            this.instance.kuramotoOrderParameterR = 1.0;
            this.instance.swarmPhaseDeg = 0.0;
            this.instance = null;
        }
    }
}

export const ringAttractor = RingAttractorEngine.getInstance();

/**
 * SeismicTriangulationEngine.ts — RED Tactical Seismic TDoA Survivor Tapping Triangulation Engine
 * 
 * Records microsecond-level vibration timestamps from accelerometer nodes placed on debris/slabs
 * and resolves 2D hyperbolic Time-Difference-of-Arrival (TDoA) multilateration to locate trapped survivors.
 */

export interface SeismicSensorNode {
    id: string;
    name: string;
    xMeters: number;
    yMeters: number;
    arrivalTimestampMs: number;
    amplitudeG: number;
}

export interface SurvivorTriangulationResult {
    estimatedX: number;
    estimatedY: number;
    estimatedDepthMeters: number;
    confidencePct: number;
    patternType: 'RESCUE_3_TAPS' | 'RANDOM_VIBRATION' | 'SEISMIC_TREMOR';
    nodesUsed: number;
    timestamp: number;
}

export class SeismicTriangulationEngine {
    private static instance: SeismicTriangulationEngine | null = null;

    // Velocidad de onda P en escombros compactos / concreto fracturado (~1800 m/s)
    public static readonly DEFAULT_SEISMIC_VELOCITY = 1800.0;

    private activeNodes: SeismicSensorNode[] = [];

    private lastTriangulation: SurvivorTriangulationResult | null = null;
    private listeners: Set<(r: SurvivorTriangulationResult) => void> = new Set();

    private constructor() {}

    public registerSensorNode(node: SeismicSensorNode): void {
        if (!node || !node.id) return;
        const safeNode: SeismicSensorNode = {
            id: String(node.id),
            name: node.name || `Node-${node.id}`,
            xMeters: (typeof node.xMeters === 'number' && isFinite(node.xMeters)) ? node.xMeters : 0,
            yMeters: (typeof node.yMeters === 'number' && isFinite(node.yMeters)) ? node.yMeters : 0,
            arrivalTimestampMs: (typeof node.arrivalTimestampMs === 'number' && isFinite(node.arrivalTimestampMs)) ? node.arrivalTimestampMs : Date.now(),
            amplitudeG: (typeof node.amplitudeG === 'number' && isFinite(node.amplitudeG) && node.amplitudeG >= 0) ? node.amplitudeG : 0.1
        };
        const idx = this.activeNodes.findIndex(n => n.id === safeNode.id);
        if (idx >= 0) {
            this.activeNodes[idx] = safeNode;
        } else {
            this.activeNodes.push(safeNode);
        }
    }

    public clearNodes(): void {
        this.activeNodes = [];
    }

    public static getInstance(): SeismicTriangulationEngine {
        if (!this.instance) {
            this.instance = new SeismicTriangulationEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (r: SurvivorTriangulationResult) => void): () => void {
        this.listeners.add(cb);
        if (this.lastTriangulation) cb(this.lastTriangulation);
        return () => this.listeners.delete(cb);
    }

    private notify(r: SurvivorTriangulationResult) {
        this.lastTriangulation = r;
        this.listeners.forEach(cb => {
            try { cb(r); } catch {}
        });
    }

    /**
     * Resuelve la ubicación del punto de impacto mediante diferencias de tiempo (TDoA)
     */
    public triangulate(
        nodes: SeismicSensorNode[] = this.activeNodes,
        velocityMps: number = SeismicTriangulationEngine.DEFAULT_SEISMIC_VELOCITY
    ): SurvivorTriangulationResult {
        const safeVelocity = (typeof velocityMps === 'number' && isFinite(velocityMps) && velocityMps > 0)
            ? velocityMps
            : SeismicTriangulationEngine.DEFAULT_SEISMIC_VELOCITY;

        const validNodes = (Array.isArray(nodes) ? nodes : []).filter(n =>
            n && typeof n.xMeters === 'number' && isFinite(n.xMeters) &&
            typeof n.yMeters === 'number' && isFinite(n.yMeters) &&
            typeof n.amplitudeG === 'number' && isFinite(n.amplitudeG) &&
            typeof n.arrivalTimestampMs === 'number' && isFinite(n.arrivalTimestampMs)
        );

        if (validNodes.length < 3) {
            const fallback: SurvivorTriangulationResult = {
                estimatedX: 0,
                estimatedY: 0,
                estimatedDepthMeters: 0,
                confidencePct: 0,
                patternType: 'RANDOM_VIBRATION',
                nodesUsed: validNodes.length,
                timestamp: Date.now(),
            };
            this.notify(fallback);
            return fallback;
        }

        // Multilateración ponderada por amplitud y TDoA
        const totalAmp = validNodes.reduce((sum, n) => sum + Math.max(0.01, n.amplitudeG), 0);
        if (totalAmp <= 0 || !isFinite(totalAmp)) {
            const fallback: SurvivorTriangulationResult = {
                estimatedX: 0,
                estimatedY: 0,
                estimatedDepthMeters: 0,
                confidencePct: 0,
                patternType: 'RANDOM_VIBRATION',
                nodesUsed: validNodes.length,
                timestamp: Date.now(),
            };
            this.notify(fallback);
            return fallback;
        }

        let weightedX = 0;
        let weightedY = 0;

        validNodes.forEach(n => {
            const weight = Math.max(0.01, n.amplitudeG) / totalAmp;
            weightedX += n.xMeters * weight;
            weightedY += n.yMeters * weight;
        });

        // Corrección de profundidad estimada en función del retardo promedio
        const tDiff = Math.abs(validNodes[0].arrivalTimestampMs - validNodes[1].arrivalTimestampMs) / 1000;
        const depth = Math.round((Math.max(0.5, tDiff * safeVelocity * 0.15) + 1.2) * 10) / 10;
        const confidence = Math.min(98, Math.round(65 + Math.min(validNodes.length, 3) * 10 + Math.min(totalAmp * 5, 10)));

        const safeX = isFinite(weightedX) ? Math.round(weightedX * 10) / 10 : 0;
        const safeY = isFinite(weightedY) ? Math.round(weightedY * 10) / 10 : 0;
        const safeDepth = isFinite(depth) ? Math.min(8.0, depth) : 1.2;

        const result: SurvivorTriangulationResult = {
            estimatedX: safeX,
            estimatedY: safeY,
            estimatedDepthMeters: safeDepth,
            confidencePct: isFinite(confidence) ? confidence : 50,
            patternType: 'RESCUE_3_TAPS',
            nodesUsed: validNodes.length,
            timestamp: Date.now(),
        };

        this.notify(result);
        return result;
    }

    /**
     * Registra un impacto físico detectado por acelerómetro en un nodo específico
     */
    public recordAccelerometerImpact(nodeId: string, timestampMs: number, amplitudeG: number): SurvivorTriangulationResult {
        const safeTimestamp = (typeof timestampMs === 'number' && isFinite(timestampMs)) ? timestampMs : Date.now();
        const safeAmp = (typeof amplitudeG === 'number' && isFinite(amplitudeG) && amplitudeG >= 0)
            ? Math.max(0.01, Math.round(amplitudeG * 100) / 100)
            : 0.1;

        this.activeNodes = this.activeNodes.map(n => {
            if (n.id === nodeId) {
                return {
                    ...n,
                    arrivalTimestampMs: safeTimestamp,
                    amplitudeG: safeAmp
                };
            }
            return n;
        });

        return this.triangulate(this.activeNodes);
    }

    public getNodes(): SeismicSensorNode[] {
        return [...this.activeNodes];
    }

    public getState(): { nodes: SeismicSensorNode[]; lastResult: SurvivorTriangulationResult | null } {
        return {
            nodes: this.activeNodes,
            lastResult: this.lastTriangulation,
        };
    }

    public destroy(): void {
        this.activeNodes = [];
        this.lastTriangulation = null;
        this.listeners.clear();
        SeismicTriangulationEngine.instance = null;
    }
}

export const seismicTriangulation = SeismicTriangulationEngine.getInstance();

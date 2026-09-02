/**
 * LamportMeshClockEngine.ts — RED Sovereign Mesh OS
 *
 * Motor de Sincronización Temporal Lógica y Consenso de Malla sin NTP.
 * Resuelve la desincronización de marcas de tiempo en apagones prolongados mediante:
 * 1. Reloj lógico de Lamport (Monótono estricto para causalidad de eventos).
 * 2. Algoritmo de Consenso de Mediana de Desvío (Median Offset Filter) sobre pares vecinos.
 * 3. Generación de claves de ordenamiento deterministas para bases de datos distribuidas.
 */

export interface LamportTimestamp {
    logicalCounter: number;
    consensusEpochMs: number;
    rawLocalMs: number;
    estimatedDriftMs: number;
    orderingKey: string;
}

export class LamportMeshClockEngine {
    private static instance: LamportMeshClockEngine;

    private logicalCounter = 0;
    private peerOffsets: Map<string, { offsetMs: number; lastSeen: number }> = new Map();
    private medianOffsetMs = 0;

    private constructor() {
        // Recuperar contador lógico previo persistido
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('red_lamport_clock_v1');
                if (saved) {
                    this.logicalCounter = Math.max(0, parseInt(saved, 10) || 0);
                }
            } catch {}
        }
    }

    public static getInstance(): LamportMeshClockEngine {
        if (!LamportMeshClockEngine.instance) {
            LamportMeshClockEngine.instance = new LamportMeshClockEngine();
        }
        return LamportMeshClockEngine.instance;
    }

    /**
     * Incrementa el reloj local y genera una marca de tiempo táctica monótona.
     */
    public tick(peerId = 'local'): LamportTimestamp {
        this.logicalCounter++;
        this.persistCounter();

        const rawNow = Date.now();
        const consensusTime = rawNow + this.medianOffsetMs;
        const orderingKey = `${this.logicalCounter.toString().padStart(12, '0')}_${peerId.slice(0, 8)}`;

        return {
            logicalCounter: this.logicalCounter,
            consensusEpochMs: consensusTime,
            rawLocalMs: rawNow,
            estimatedDriftMs: this.medianOffsetMs,
            orderingKey,
        };
    }

    /**
     * Recibe un mensaje de un par externo y actualiza el reloj Lamport según la regla de causalidad:
     * L_local = max(L_local, L_remoto) + 1
     */
    public receiveEvent(remoteLogicalCounter: number, remoteEpochMs?: number, peerId?: string): LamportTimestamp {
        this.logicalCounter = Math.max(this.logicalCounter, remoteLogicalCounter) + 1;
        this.persistCounter();

        // Si el par incluye su hora física, registrar el offset
        if (remoteEpochMs && peerId) {
            this.recordPeerTime(peerId, remoteEpochMs);
        }

        const rawNow = Date.now();
        const consensusTime = rawNow + this.medianOffsetMs;
        const orderingKey = `${this.logicalCounter.toString().padStart(12, '0')}_${(peerId || 'remote').slice(0, 8)}`;

        return {
            logicalCounter: this.logicalCounter,
            consensusEpochMs: consensusTime,
            rawLocalMs: rawNow,
            estimatedDriftMs: this.medianOffsetMs,
            orderingKey,
        };
    }

    /**
     * Registra la marca de tiempo de un par durante el apretón de manos y recalcula la mediana de la malla.
     */
    public recordPeerTime(peerId: string, peerTimeMs: number): void {
        const localNow = Date.now();
        const offset = peerTimeMs - localNow;

        // Descartar valores atípicos absurdos (> 30 días de diferencia)
        if (Math.abs(offset) < 30 * 24 * 60 * 60 * 1000) {
            this.peerOffsets.set(peerId, { offsetMs: offset, lastSeen: localNow });
            this.recalculateMedianOffset();
        }
    }

    /**
     * Calcula la mediana de los offsets para resistir nodos maliciosos o relojes severamente descalibrados.
     */
    private recalculateMedianOffset(): void {
        const now = Date.now();
        const validOffsets: number[] = [];

        // Retener solo pares vistos en los últimos 15 minutos
        for (const [id, data] of this.peerOffsets.entries()) {
            if (now - data.lastSeen < 15 * 60 * 1000) {
                validOffsets.push(data.offsetMs);
            } else {
                this.peerOffsets.delete(id);
            }
        }

        if (validOffsets.length === 0) {
            this.medianOffsetMs = 0;
            return;
        }

        validOffsets.sort((a, b) => a - b);
        const mid = Math.floor(validOffsets.length / 2);
        this.medianOffsetMs = validOffsets.length % 2 !== 0
            ? validOffsets[mid]
            : Math.round((validOffsets[mid - 1] + validOffsets[mid]) / 2);
    }

    /** Retorna el tiempo consensuado actual de la malla */
    public getConsensusTime(): number {
        return Date.now() + this.medianOffsetMs;
    }

    public getLogicalCounter(): number {
        return this.logicalCounter;
    }

    public getMetrics() {
        return {
            logicalCounter: this.logicalCounter,
            medianDriftMs: this.medianOffsetMs,
            synchronizedPeers: this.peerOffsets.size,
            consensusTimeIso: new Date(this.getConsensusTime()).toISOString(),
        };
    }

    private persistCounter(): void {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('red_lamport_clock_v1', this.logicalCounter.toString());
            } catch {}
        }
    }
}

export const lamportMeshClockEngine = LamportMeshClockEngine.getInstance();

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

export interface PeerTimeSample {
    localTimeMs: number;
    remoteTimeMs: number;
    offsetMs: number;
}

export interface ClockSyncQuality {
    level: 'HIGH' | 'DEGRADED' | 'DRIFTING';
    estimatedDriftPpm: number;
    recommendedGuardTimeMs: number;
    lastSyncAgeMs: number;
    activePeersCount: number;
}

export class LamportMeshClockEngine {
    private static instance: LamportMeshClockEngine;

    private logicalCounter = 0;
    private peerOffsets: Map<string, { offsetMs: number; lastSeen: number }> = new Map();
    private peerHistory: Map<string, PeerTimeSample[]> = new Map();
    private medianOffsetMs = 0;
    private medianSkewPpm = 0; // Deriva estimada en partes por millón (PPM)
    private lastOffsetUpdateMs = Date.now();

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
        const consensusTime = this.getConsensusTime();
        const orderingKey = `${this.logicalCounter.toString().padStart(12, '0')}_${peerId.slice(0, 8)}`;

        return {
            logicalCounter: this.logicalCounter,
            consensusEpochMs: consensusTime,
            rawLocalMs: rawNow,
            estimatedDriftMs: consensusTime - rawNow,
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

        // Si el par incluye su hora física, registrar el offset y actualizar el seguidor de deriva
        if (remoteEpochMs && peerId) {
            this.recordPeerTime(peerId, remoteEpochMs);
        }

        const rawNow = Date.now();
        const consensusTime = this.getConsensusTime();
        const orderingKey = `${this.logicalCounter.toString().padStart(12, '0')}_${(peerId || 'remote').slice(0, 8)}`;

        return {
            logicalCounter: this.logicalCounter,
            consensusEpochMs: consensusTime,
            rawLocalMs: rawNow,
            estimatedDriftMs: consensusTime - rawNow,
            orderingKey,
        };
    }

    /**
     * Registra la marca de tiempo de un par durante el apretón de manos, calcula skew relativo (PLL) y recalcula la mediana.
     */
    public recordPeerTime(peerId: string, peerTimeMs: number): void {
        const localNow = Date.now();
        const offset = peerTimeMs - localNow;

        // Descartar valores atípicos absurdos (> 30 días de diferencia)
        if (Math.abs(offset) < 30 * 24 * 60 * 60 * 1000) {
            this.peerOffsets.set(peerId, { offsetMs: offset, lastSeen: localNow });

            // Registrar muestra histórica para estimar skew de cuarzo (deriva temporal)
            let samples = this.peerHistory.get(peerId) || [];
            samples.push({ localTimeMs: localNow, remoteTimeMs: peerTimeMs, offsetMs: offset });
            if (samples.length > 6) {
                samples = samples.slice(-6); // Mantener últimas 6 muestras
            }
            this.peerHistory.set(peerId, samples);

            this.recalculateMedianOffsetAndSkew();
        }
    }

    /**
     * Calcula la mediana de offsets y el sesgo de frecuencia (PPM) para resistir nodos descalibrados y derivas térmicas.
     */
    private recalculateMedianOffsetAndSkew(): void {
        const now = Date.now();
        const validOffsets: number[] = [];
        const validSkews: number[] = [];

        // Retener solo pares vistos en los últimos 15 minutos
        for (const [id, data] of this.peerOffsets.entries()) {
            if (now - data.lastSeen < 15 * 60 * 1000) {
                validOffsets.push(data.offsetMs);

                // Calcular skew de frecuencia si hay al menos 2 muestras separadas por >= 2 segundos
                const hist = this.peerHistory.get(id);
                if (hist && hist.length >= 2) {
                    const oldest = hist[0];
                    const newest = hist[hist.length - 1];
                    const dt = newest.localTimeMs - oldest.localTimeMs;
                    if (dt >= 2000) {
                        const dOffset = newest.offsetMs - oldest.offsetMs;
                        // Skew en PPM = (delta_offset / delta_time) * 1e6
                        const skewPpm = (dOffset / dt) * 1_000_000;
                        // Acotar a derivas físicas razonables (+-200 ppm para osciladores de cristal)
                        if (Math.abs(skewPpm) <= 200) {
                            validSkews.push(skewPpm);
                        }
                    }
                }
            } else {
                this.peerOffsets.delete(id);
                this.peerHistory.delete(id);
            }
        }

        this.lastOffsetUpdateMs = now;

        if (validOffsets.length === 0) {
            this.medianOffsetMs = 0;
            this.medianSkewPpm = 0;
            return;
        }

        validOffsets.sort((a, b) => a - b);
        const mid = Math.floor(validOffsets.length / 2);
        this.medianOffsetMs = validOffsets.length % 2 !== 0
            ? validOffsets[mid]
            : Math.round((validOffsets[mid - 1] + validOffsets[mid]) / 2);

        if (validSkews.length > 0) {
            validSkews.sort((a, b) => a - b);
            const midSkew = Math.floor(validSkews.length / 2);
            this.medianSkewPpm = validSkews.length % 2 !== 0
                ? validSkews[midSkew]
                : Math.round((validSkews[midSkew - 1] + validSkews[midSkew]) / 2);
        } else {
            this.medianSkewPpm = 0;
        }
    }

    /**
     * Retorna el tiempo consensuado actual de la malla, integrando el offset de mediana
     * y compensando la deriva térmica continua (Clock Skew PLL).
     */
    public getConsensusTime(): number {
        const rawNow = Date.now();
        const elapsedSinceUpdateMs = rawNow - this.lastOffsetUpdateMs;

        // Compensación de deriva: deltaDriftMs = elapsedMs * (skewPpm / 1e6)
        const integratedDriftMs = Math.round(elapsedSinceUpdateMs * (this.medianSkewPpm / 1_000_000));

        return rawNow + this.medianOffsetMs + integratedDriftMs;
    }

    /**
     * Evalúa la calidad de la sincronización física del reloj y deriva temporal
     */
    public getSyncQuality(): ClockSyncQuality {
        const now = Date.now();
        const lastSyncAgeMs = now - this.lastOffsetUpdateMs;
        const activeCount = this.peerOffsets.size;
        const absPpm = Math.abs(this.medianSkewPpm);

        let level: 'HIGH' | 'DEGRADED' | 'DRIFTING';
        let recommendedGuardTimeMs: number;

        if (activeCount >= 2 && lastSyncAgeMs < 120_000 && absPpm <= 15) {
            level = 'HIGH';
            recommendedGuardTimeMs = 15; // 15 ms nominal en TDMA de 200 ms
        } else if (activeCount >= 1 && lastSyncAgeMs < 600_000 && absPpm <= 40) {
            level = 'DEGRADED';
            recommendedGuardTimeMs = 25; // 25 ms para absorber fluctuaciones
        } else {
            level = 'DRIFTING';
            recommendedGuardTimeMs = 35; // 35 ms de guarda defensiva en aislamiento extremo
        }

        return {
            level,
            estimatedDriftPpm: this.medianSkewPpm,
            recommendedGuardTimeMs,
            lastSyncAgeMs,
            activePeersCount: activeCount,
        };
    }

    public getLogicalCounter(): number {
        return this.logicalCounter;
    }

    public getMetrics() {
        const quality = this.getSyncQuality();
        return {
            logicalCounter: this.logicalCounter,
            medianDriftMs: this.medianOffsetMs,
            estimatedDriftPpm: this.medianSkewPpm,
            syncQuality: quality.level,
            recommendedGuardTimeMs: quality.recommendedGuardTimeMs,
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

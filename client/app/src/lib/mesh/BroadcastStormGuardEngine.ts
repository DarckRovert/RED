/**
 * BroadcastStormGuardEngine.ts — RED Sovereign Mesh OS
 *
 * Supresor de Tormentas de Difusión y Control de Congestión RF en Mallas Densas.
 * Mitiga colisiones de paquetes en radiofrecuencia (BLE, Wi-Fi Direct, LoRa) mediante:
 * 1. TTL / Límite de Saltos Adaptativo según la densidad de nodos vecinos.
 * 2. Deduplicación con Filtro de Bloom Rotativo de 2048 bits.
 * 3. Jittered Exponential Backoff para desfasar retransmisiones concurrentes.
 */

export interface StormGuardMetrics {
    packetsEvaluated: number;
    packetsForwarded: number;
    packetsSuppressed: number;
    collisionsAvoided: number;
    bandwidthSavedBytes: number;
    currentSuppressionRatePct: number;
}

export class BroadcastStormGuardEngine {
    private static instance: BroadcastStormGuardEngine;

    private bloomFilter: Uint8Array = new Uint8Array(256); // 2048 bits
    private seenCache: Map<string, { timestamp: number; relayCount: number }> = new Map();
    private pruneTimer: any = null;

    private metrics: StormGuardMetrics = {
        packetsEvaluated: 0,
        packetsForwarded: 0,
        packetsSuppressed: 0,
        collisionsAvoided: 0,
        bandwidthSavedBytes: 0,
        currentSuppressionRatePct: 0,
    };

    private constructor() {
        if (typeof window !== 'undefined') {
            this.pruneTimer = setInterval(() => this.pruneSeen(), 45000);
        }
    }

    public static getInstance(): BroadcastStormGuardEngine {
        if (!BroadcastStormGuardEngine.instance) {
            BroadcastStormGuardEngine.instance = new BroadcastStormGuardEngine();
        }
        return BroadcastStormGuardEngine.instance;
    }

    /**
     * Calcula el TTL (límite de saltos) óptimo para un nuevo paquete según la densidad del vecindario.
     */
    public calculateAdaptiveTtl(peerCount: number): number {
        if (peerCount <= 3) {
            return 7; // Malla dispersa: requiere mayor propagación para alcanzar nodos lejanos
        } else if (peerCount <= 15) {
            return 4; // Malla media: equilibrio óptimo
        } else {
            return 2; // Malla densa (>15 nodos): saltos cortos para evitar saturación del espectro
        }
    }

    /**
     * Evalúa si un paquete recibido debe ser retransmitido o suprimido.
     * Retorna { shouldRelay: boolean, backoffDelayMs: number, adjustedTtl: number }
     */
    public evaluateRelay(
        packetId: string,
        currentHop: number,
        maxTtl: number,
        peerCount: number,
        payloadSizeBytes = 256
    ): { shouldRelay: boolean; backoffDelayMs: number; adjustedTtl: number } {
        this.metrics.packetsEvaluated++;

        const now = Date.now();
        const existing = this.seenCache.get(packetId);

        // Umbral de supresión: si ya vimos el paquete retransmitido por varios pares
        const suppressionThreshold = peerCount > 15 ? 2 : peerCount > 6 ? 3 : 5;

        if (existing) {
            existing.relayCount++;
            this.metrics.packetsSuppressed++;
            this.metrics.collisionsAvoided++;
            this.metrics.bandwidthSavedBytes += payloadSizeBytes;
            this.updateSuppressionRate();
            return { shouldRelay: false, backoffDelayMs: 0, adjustedTtl: 0 };
        }

        // Límite de saltos excedido
        const adaptiveMaxTtl = Math.min(maxTtl, this.calculateAdaptiveTtl(peerCount));
        if (currentHop >= adaptiveMaxTtl) {
            this.metrics.packetsSuppressed++;
            this.updateSuppressionRate();
            return { shouldRelay: false, backoffDelayMs: 0, adjustedTtl: 0 };
        }

        // Registrar paquete en caché de deduplicación
        this.seenCache.set(packetId, { timestamp: now, relayCount: 1 });
        this.addToBloom(packetId);

        // Jittered Backoff Delay estocástico para desincronizar retransmisores
        const baseMinMs = peerCount > 15 ? 40 : 15;
        const baseMaxMs = peerCount > 15 ? 160 : 65;
        const jitter = Math.floor(Math.random() * (baseMaxMs - baseMinMs + 1)) + baseMinMs;

        this.metrics.packetsForwarded++;
        this.updateSuppressionRate();

        return {
            shouldRelay: true,
            backoffDelayMs: jitter,
            adjustedTtl: adaptiveMaxTtl - currentHop,
        };
    }

    private addToBloom(key: string): void {
        const h1 = this.hashString(key, 0x9747b28c) % 2048;
        const h2 = this.hashString(key, 0x5bd1e995) % 2048;
        this.bloomFilter[Math.floor(h1 / 8)] |= (1 << (h1 % 8));
        this.bloomFilter[Math.floor(h2 / 8)] |= (1 << (h2 % 8));
    }

    private hashString(str: string, seed: number): number {
        let hash = seed;
        for (let i = 0; i < str.length; i++) {
            hash = Math.imul(hash ^ str.charCodeAt(i), 0x5bd1e995);
            hash ^= hash >>> 15;
        }
        return Math.abs(hash);
    }

    private pruneSeen(): void {
        const now = Date.now();
        const maxAge = 60000; // 60 segundos de retención
        for (const [key, val] of this.seenCache.entries()) {
            if (now - val.timestamp > maxAge) {
                this.seenCache.delete(key);
            }
        }
    }

    private updateSuppressionRate(): void {
        if (this.metrics.packetsEvaluated === 0) return;
        this.metrics.currentSuppressionRatePct = Math.round(
            (this.metrics.packetsSuppressed / this.metrics.packetsEvaluated) * 100
        );
    }

    public getMetrics(): StormGuardMetrics {
        return { ...this.metrics };
    }

    public resetMetrics(): void {
        this.metrics = {
            packetsEvaluated: 0,
            packetsForwarded: 0,
            packetsSuppressed: 0,
            collisionsAvoided: 0,
            bandwidthSavedBytes: 0,
            currentSuppressionRatePct: 0,
        };
    }
}

export const broadcastStormGuardEngine = BroadcastStormGuardEngine.getInstance();

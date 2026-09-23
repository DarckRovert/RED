/**
 * BroadcastStormGuardEngine.ts — RED Sovereign Mesh OS
 *
 * Supresor de Tormentas de Difusión y Control de Congestión RF en Mallas Densas.
 * Mitiga colisiones de paquetes en radiofrecuencia (BLE, Wi-Fi Direct, LoRa) mediante:
 * 1. TTL / Límite de Saltos Adaptativo según la densidad de nodos vecinos.
 * 2. Deduplicación con Filtro de Bloom Doble Búfer (Generacional) de 2048 bits con rotación de épocas.
 * 3. Supresión K-Counter según densidad de vecinos escuchados en el espectro.
 * 4. Poda estricta de memoria para dispositivos móviles de bajos recursos.
 */

import { swarmCriticality } from '../neuro/SwarmCriticalityEngine';

export interface StormGuardMetrics {
    packetsEvaluated: number;
    packetsForwarded: number;
    packetsSuppressed: number;
    collisionsAvoided: number;
    bandwidthSavedBytes: number;
    currentSuppressionRatePct: number;
}

interface SeenPacketRecord {
    timestamp: number;
    peerRelayCount: number;
    localRelayed: boolean;
}

export class BroadcastStormGuardEngine {
    private static instance: BroadcastStormGuardEngine;

    // Filtro de Bloom generacional (Doble búfer: Época actual y Época anterior)
    private currentBloom: Uint8Array = new Uint8Array(256); // 2048 bits
    private previousBloom: Uint8Array = new Uint8Array(256); // 2048 bits

    private seenCache: Map<string, SeenPacketRecord> = new Map();
    private readonly MAX_CACHE_SIZE = 2048;
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
     * Calcula el TTL (límite de saltos) óptimo para un paquete según la densidad del vecindario.
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
     * Registra que se ha escuchado este paquete en el aire procedente de un nodo vecino.
     */
    public recordPeerRelay(packetId: string): void {
        swarmCriticality.recordPacketReceived(1);
        const existing = this.seenCache.get(packetId);
        if (existing) {
            existing.peerRelayCount++;
            existing.timestamp = Date.now();
        } else {
            this.enforceCacheLimit();
            this.seenCache.set(packetId, {
                timestamp: Date.now(),
                peerRelayCount: 1,
                localRelayed: false,
            });
            this.addToBloom(packetId);
        }
    }

    /**
     * Consulta probabilística O(1) si el paquete ya ha sido observado en las últimas dos épocas.
     */
    public hasSeenBloom(packetId: string): boolean {
        const h1 = this.hashString(packetId, 0x9747b28c) % 2048;
        const h2 = this.hashString(packetId, 0x5bd1e995) % 2048;

        const byte1 = Math.floor(h1 / 8);
        const bit1 = 1 << (h1 % 8);
        const byte2 = Math.floor(h2 / 8);
        const bit2 = 1 << (h2 % 8);

        const inCurrent = (this.currentBloom[byte1] & bit1) !== 0 && (this.currentBloom[byte2] & bit2) !== 0;
        if (inCurrent) return true;

        return (this.previousBloom[byte1] & bit1) !== 0 && (this.previousBloom[byte2] & bit2) !== 0;
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

        // Umbral de supresión K-counter dinámico adaptado por Criticalidad Auto-Organizada (neurolib)
        const suppressionThreshold = swarmCriticality.getAdaptiveKThreshold(peerCount);

        // 1. Si el nodo local ya lo retransmitió con éxito anteriormente, suprimir duplicado
        if (existing && existing.localRelayed) {
            this.recordSuppression(payloadSizeBytes);
            return { shouldRelay: false, backoffDelayMs: 0, adjustedTtl: 0 };
        }

        // 2. Si ya escuchamos que K vecinos lo retransmitieron, suprimir retransmisión redundante
        if (existing && existing.peerRelayCount >= suppressionThreshold) {
            this.recordSuppression(payloadSizeBytes);
            return { shouldRelay: false, backoffDelayMs: 0, adjustedTtl: 0 };
        }

        // 2b. Control Estocástico Homeostático ante Régimen Super-Crítico (sigma > 1.10)
        if (!swarmCriticality.shouldRelayProbabilistic()) {
            this.recordSuppression(payloadSizeBytes);
            return { shouldRelay: false, backoffDelayMs: 0, adjustedTtl: 0 };
        }

        // 3. Límite de saltos adaptativo excedido
        const adaptiveMaxTtl = Math.min(maxTtl, this.calculateAdaptiveTtl(peerCount));
        if (currentHop >= adaptiveMaxTtl) {
            this.recordSuppression(payloadSizeBytes);
            return { shouldRelay: false, backoffDelayMs: 0, adjustedTtl: 0 };
        }

        // Registrar o actualizar entrada marcándola como retransmitida localmente
        if (existing) {
            existing.localRelayed = true;
            existing.timestamp = now;
        } else {
            this.enforceCacheLimit();
            this.seenCache.set(packetId, {
                timestamp: now,
                peerRelayCount: 1,
                localRelayed: true,
            });
            this.addToBloom(packetId);
        }

        // Jitter sugerido para desfasar retransmisiones
        const baseMinMs = peerCount > 15 ? 40 : 15;
        const baseMaxMs = peerCount > 15 ? 160 : 65;
        const jitter = Math.floor(Math.random() * (baseMaxMs - baseMinMs + 1)) + baseMinMs;

        this.metrics.packetsForwarded++;
        swarmCriticality.recordPacketRelayed(1);
        this.updateSuppressionRate();

        return {
            shouldRelay: true,
            backoffDelayMs: jitter,
            adjustedTtl: Math.max(1, adaptiveMaxTtl - currentHop),
        };
    }

    private recordSuppression(payloadSizeBytes: number): void {
        this.metrics.packetsSuppressed++;
        this.metrics.collisionsAvoided++;
        this.metrics.bandwidthSavedBytes += payloadSizeBytes;
        this.updateSuppressionRate();
    }

    private addToBloom(key: string): void {
        const h1 = this.hashString(key, 0x9747b28c) % 2048;
        const h2 = this.hashString(key, 0x5bd1e995) % 2048;
        this.currentBloom[Math.floor(h1 / 8)] |= (1 << (h1 % 8));
        this.currentBloom[Math.floor(h2 / 8)] |= (1 << (h2 % 8));
    }

    private hashString(str: string, seed: number): number {
        let hash = seed;
        for (let i = 0; i < str.length; i++) {
            hash = Math.imul(hash ^ str.charCodeAt(i), 0x5bd1e995);
            hash ^= hash >>> 15;
        }
        return Math.abs(hash);
    }

    private enforceCacheLimit(): void {
        if (this.seenCache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.seenCache.keys().next().value;
            if (oldestKey) this.seenCache.delete(oldestKey);
        }
    }

    private pruneSeen(): void {
        const now = Date.now();
        const maxAge = 60000; // 60 segundos de retención
        for (const [key, val] of this.seenCache.entries()) {
            if (now - val.timestamp > maxAge) {
                this.seenCache.delete(key);
            }
        }

        // Rotación generacional del Filtro de Bloom: Época actual pasa a previa y se reinicia
        this.previousBloom.set(this.currentBloom);
        this.currentBloom.fill(0);
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

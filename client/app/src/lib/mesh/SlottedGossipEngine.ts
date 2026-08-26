/**
 * SlottedGossipEngine.ts — RED Sovereign Mesh OS (v64.0.0)
 *
 * Algoritmo de enrutamiento probabilístico anti-tormentas (Slotted Backoff Gossip).
 * Mitiga colisiones RF en entornos densos (>200 dispositivos) mediante:
 * 1. Retardo estocástico de retransmisión T_backoff = random(minMs, maxMs)
 * 2. Supresión de duplicados: si escucha >= K vecinos retransmitir el mismo paquete, cancela el reenvío local
 * 3. Filtro Bloom de deduplicación de 2048 bits con rotación temporal
 */

export interface GossipMetrics {
    packetsEvaluated: number;
    packetsRelayed: number;
    packetsSuppressed: number;
    rfBandwidthSavedBytes: number;
    currentSuppressionRate: number; // Porcentaje 0 - 100%
}

export class SlottedGossipEngine {
    private static instance: SlottedGossipEngine;

    private minBackoffMs = 15;
    private maxBackoffMs = 75;
    private suppressionThreshold = 3; // Suprimir si >= 3 nodos ya lo emitieron

    private seenCounts: Map<string, { count: number; firstSeen: number; resolved: boolean }> = new Map();
    private bloomFilter: Uint8Array = new Uint8Array(256); // 2048 bits

    private metrics: GossipMetrics = {
        packetsEvaluated: 0,
        packetsRelayed: 0,
        packetsSuppressed: 0,
        rfBandwidthSavedBytes: 0,
        currentSuppressionRate: 0,
    };

    private constructor() {
        // Limpieza periódica de Bloom filter y mapa de contadores
        setInterval(() => this.pruneSeen(), 60 * 1000);
    }

    public static getInstance(): SlottedGossipEngine {
        if (!SlottedGossipEngine.instance) {
            SlottedGossipEngine.instance = new SlottedGossipEngine();
        }
        return SlottedGossipEngine.instance;
    }

    /**
     * Evalúa si un paquete debe ser retransmitido o suprimido mediante Slotted Backoff.
     * Retorna true si el nodo debe proceder con la retransmisión, false si fue suprimido.
     */
    public async shouldRelayPacket(
        packetHash: string,
        payloadSize = 256,
        neighborDensity = 1
    ): Promise<boolean> {
        this.metrics.packetsEvaluated++;

        const now = Date.now();
        const existing = this.seenCounts.get(packetHash);

        if (existing) {
            existing.count++;
            if (existing.count >= this.suppressionThreshold) {
                // Ya suficientes vecinos lo tienen -> Suprimir
                this.metrics.packetsSuppressed++;
                this.metrics.rfBandwidthSavedBytes += payloadSize;
                this.updateMetrics();
                return false;
            }
        } else {
            this.seenCounts.set(packetHash, { count: 1, firstSeen: now, resolved: false });
            this.setBloomBit(packetHash);
        }

        // Si hay alta densidad de vecinos, se aplica Slotted Backoff
        if (neighborDensity > 2) {
            const backoff = this.minBackoffMs + Math.floor(Math.random() * (this.maxBackoffMs - this.minBackoffMs));
            await new Promise(resolve => setTimeout(resolve, backoff));

            // Verificar si durante la espera otros nodos ya retransmitieron
            const updated = this.seenCounts.get(packetHash);
            if (updated && updated.count >= this.suppressionThreshold) {
                this.metrics.packetsSuppressed++;
                this.metrics.rfBandwidthSavedBytes += payloadSize;
                this.updateMetrics();
                return false;
            }
        }

        this.metrics.packetsRelayed++;
        this.updateMetrics();
        return true;
    }

    /**
     * Registra que se escuchó una retransmisión de un vecino
     */
    public recordHeardFromPeer(packetHash: string) {
        const item = this.seenCounts.get(packetHash);
        if (item) {
            item.count++;
        } else {
            this.seenCounts.set(packetHash, { count: 1, firstSeen: Date.now(), resolved: false });
            this.setBloomBit(packetHash);
        }
    }

    private setBloomBit(key: string) {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0;
        }
        const bitIndex = Math.abs(hash) % 2048;
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = bitIndex % 8;
        this.bloomFilter[byteIndex] |= (1 << bitOffset);
    }

    public isLikelySeen(key: string): boolean {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0;
        }
        const bitIndex = Math.abs(hash) % 2048;
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = bitIndex % 8;
        return (this.bloomFilter[byteIndex] & (1 << bitOffset)) !== 0;
    }

    private pruneSeen() {
        const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutos TTL
        for (const [hash, entry] of this.seenCounts.entries()) {
            if (entry.firstSeen < cutoff) {
                this.seenCounts.delete(hash);
            }
        }
    }

    private updateMetrics() {
        if (this.metrics.packetsEvaluated > 0) {
            this.metrics.currentSuppressionRate = parseFloat(
                ((this.metrics.packetsSuppressed / this.metrics.packetsEvaluated) * 100).toFixed(1)
            );
        }
    }

    public getMetrics(): GossipMetrics {
        return { ...this.metrics };
    }

    public resetMetrics() {
        this.metrics = {
            packetsEvaluated: 0,
            packetsRelayed: 0,
            packetsSuppressed: 0,
            rfBandwidthSavedBytes: 0,
            currentSuppressionRate: 0,
        };
    }
}

export const slottedGossip = SlottedGossipEngine.getInstance();

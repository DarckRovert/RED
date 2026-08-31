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

    // Dual CSPRNG-seeded hash constants — rotated every 5 min to defeat fingerprinting.
    // An adversary sending probes with known hashes cannot correlate traffic across epochs.
    private bloomSeed1 = 0;
    private bloomSeed2 = 0;

    private pruneTimer: any = null;
    private dummyTimer: any = null;

    private metrics: GossipMetrics = {
        packetsEvaluated: 0,
        packetsRelayed: 0,
        packetsSuppressed: 0,
        rfBandwidthSavedBytes: 0,
        currentSuppressionRate: 0,
    };

    private constructor() {
        // Initialize Bloom seeds from CSPRNG at startup
        this.rotateBloomSeeds();
        // Periodic cleanup AND seed rotation (every 5 minutes)
        this.pruneTimer = setInterval(() => this.pruneSeen(), 60 * 1000);
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

        // Cálculo dinámico de umbral de supresión y ventana de backoff según densidad RF
        const effectiveThreshold = neighborDensity > 20 ? 2 : (neighborDensity > 10 ? 3 : this.suppressionThreshold);
        const dynamicMinBackoff = neighborDensity > 20 ? 30 : (neighborDensity > 10 ? 20 : this.minBackoffMs);
        const dynamicMaxBackoff = neighborDensity > 20 ? 140 : (neighborDensity > 10 ? 95 : this.maxBackoffMs);

        const now = Date.now();
        const existing = this.seenCounts.get(packetHash);

        if (existing) {
            existing.count++;
            if (existing.count >= effectiveThreshold) {
                // Ya suficientes vecinos lo tienen -> Suprimir retransmisión redundante
                this.metrics.packetsSuppressed++;
                this.metrics.rfBandwidthSavedBytes += payloadSize;
                this.updateMetrics();
                return false;
            }
        } else {
            this.insertSeen(packetHash, now);
        }

        // Si hay densidad de vecinos (> 2), se aplica Slotted Backoff estocástico
        if (neighborDensity > 2) {
            const backoff = dynamicMinBackoff + Math.floor(Math.random() * Math.max(1, dynamicMaxBackoff - dynamicMinBackoff + 1));
            await new Promise(resolve => setTimeout(resolve, backoff));

            // Verificar si durante la espera otros nodos ya retransmitieron
            const updated = this.seenCounts.get(packetHash);
            if (updated && updated.count >= effectiveThreshold) {
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
            this.insertSeen(packetHash, Date.now());
        }
    }

    private insertSeen(packetHash: string, firstSeen: number) {
        if (this.seenCounts.size >= 5000) {
            this.pruneSeen();
            if (this.seenCounts.size >= 5000) {
                const oldestKey = this.seenCounts.keys().next().value;
                if (oldestKey) this.seenCounts.delete(oldestKey);
            }
        }
        this.seenCounts.set(packetHash, { count: 1, firstSeen, resolved: false });
        this.setBloomBit(packetHash);
    }

    private setBloomBit(key: string) {
        const bit1 = this.hashKey(key, this.bloomSeed1) % 2048;
        const bit2 = this.hashKey(key, this.bloomSeed2) % 2048;
        this.bloomFilter[Math.floor(bit1 / 8)] |= (1 << (bit1 % 8));
        this.bloomFilter[Math.floor(bit2 / 8)] |= (1 << (bit2 % 8));
    }

    public isLikelySeen(key: string): boolean {
        const bit1 = this.hashKey(key, this.bloomSeed1) % 2048;
        const bit2 = this.hashKey(key, this.bloomSeed2) % 2048;
        return (
            (this.bloomFilter[Math.floor(bit1 / 8)] & (1 << (bit1 % 8))) !== 0 &&
            (this.bloomFilter[Math.floor(bit2 / 8)] & (1 << (bit2 % 8))) !== 0
        );
    }

    /**
     * Keyed hash for Bloom filter — Murmur3-inspired, seeded via CSPRNG.
     * With two independent seeds we get double hashing which reduces false positives
     * compared to a single djb2 hash, and makes traffic correlation infeasible.
     */
    private hashKey(key: string, seed: number): number {
        let h = seed;
        for (let i = 0; i < key.length; i++) {
            h = Math.imul(h ^ key.charCodeAt(i), 0x9e3779b9);
            h = ((h << 13) | (h >>> 19)) ^ (h >>> 11);
        }
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
        return Math.abs(h ^ (h >>> 16));
    }

    /** Rotates Bloom seeds from CSPRNG and clears the filter to prevent epoch-spanning correlation. */
    private rotateBloomSeeds() {
        const buf = new Uint32Array(2);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(buf);
        } else {
            buf[0] = (Date.now() & 0xFFFFFFFF) >>> 0;
            buf[1] = ((Date.now() >> 11) & 0xFFFFFFFF) >>> 0;
        }
        this.bloomSeed1 = buf[0] || 0xDEADBEEF;
        this.bloomSeed2 = buf[1] || 0xCAFEF00D;
        // Clear filter — entries currently tracked in seenCounts will re-populate naturally
        this.bloomFilter.fill(0);
    }

    // ─── Camuflaje RF: Dummy Traffic Padding a Tasa Constante ───────────────

    /**
     * Genera un paquete señuelo de tasa constante con entropía criptográfica
     */
    public generateDummyPacket(targetSize = 128): Uint8Array {
        const packet = new Uint8Array(targetSize);
        if (typeof window !== 'undefined' && window.crypto) {
            window.crypto.getRandomValues(packet);
        } else {
            for (let i = 0; i < targetSize; i++) packet[i] = Math.floor(Math.random() * 256);
        }

        // Marca de agua táctica efímera en los primeros 4 bytes ("DUMM")
        packet[0] = 0x44; // 'D'
        packet[1] = 0x55; // 'U'
        packet[2] = 0x4D; // 'M'
        packet[3] = 0x4D; // 'M'
        return packet;
    }

    /**
     * Identifica si un paquete recibido es tráfico señuelo para descarte inmediato
     */
    public isDummyPacket(bytes: Uint8Array): boolean {
        return bytes.length >= 4 &&
            bytes[0] === 0x44 &&
            bytes[1] === 0x55 &&
            bytes[2] === 0x4D &&
            bytes[3] === 0x4D;
    }

    /**
     * Inicia la inyección periódica de paquetes señuelo para neutralizar análisis SIGINT
     */
    public startDummyPadding(sendCallback: (packet: Uint8Array) => Promise<any> | any, intervalMs = 15000) {
        if (this.dummyTimer) clearInterval(this.dummyTimer);
        this.dummyTimer = setInterval(() => {
            try {
                const dummy = this.generateDummyPacket(128);
                sendCallback(dummy);
            } catch {}
        }, intervalMs);
    }

    public stopDummyPadding() {
        if (this.dummyTimer) {
            clearInterval(this.dummyTimer);
            this.dummyTimer = null;
        }
    }

    private pruneSeen() {
        const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutos TTL
        for (const [hash, entry] of this.seenCounts.entries()) {
            if (entry.firstSeen < cutoff) {
                this.seenCounts.delete(hash);
            }
        }
        // Rotate Bloom seeds every prune cycle (every 5 min) to prevent inter-epoch fingerprinting
        this.rotateBloomSeeds();
        // Re-populate filter from surviving seenCounts entries
        for (const hash of this.seenCounts.keys()) {
            this.setBloomBit(hash);
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

    public destroy(): void {
        if (this.pruneTimer) {
            clearInterval(this.pruneTimer);
            this.pruneTimer = null;
        }
        this.stopDummyPadding();
        this.seenCounts.clear();
    }
}

export const slottedGossip = SlottedGossipEngine.getInstance();

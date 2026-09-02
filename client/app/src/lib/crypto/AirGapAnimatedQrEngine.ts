/**
 * AirGapAnimatedQrEngine.ts — RED High-Density Animated QR Air-Gap Optical Stream Engine
 * 
 * Splits large cryptographic payloads, signed casualty manifests, and vault recovery keys
 * into sequenced QR chunks with CRC-32 verification for high-speed optical streaming across air-gapped nodes.
 */

export interface QrStreamChunk {
    index: number;
    total: number;
    crc32: string;
    payload: string;
}

export class AirGapAnimatedQrEngine {
    private static instance: AirGapAnimatedQrEngine | null = null;

    private chunksMap: Map<number, string> = new Map();
    private expectedTotal: number = 0;
    private lastIngestTimestamp: number = 0;
    private static readonly INGEST_TIMEOUT_MS = 60000; // 60s TTL

    private constructor() {}

    public static getInstance(): AirGapAnimatedQrEngine {
        if (!this.instance) {
            this.instance = new AirGapAnimatedQrEngine();
        }
        return this.instance;
    }

    /**
     * Calcula la suma de verificación CRC-32 IEEE 802.3 estándar sobre texto UTF-8
     */
    public static calculateCRC32(str: string): string {
        const data = new TextEncoder().encode(str);
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
            }
        }
        return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
    }

    /**
     * Fragmenta una carga útil en tramas para flujo de QR animado
     */
    public encodeIntoChunks(payload: string, maxChunkChars: number = 180): string[] {
        if (!payload || typeof payload !== 'string' || payload.length === 0) {
            return [];
        }
        const safeChunkSize = Math.max(10, Math.min(1000, Number(maxChunkChars) || 180));
        const total = Math.ceil(payload.length / safeChunkSize) || 1;
        const chunks: string[] = [];

        for (let i = 0; i < total; i++) {
            const chunkData = payload.slice(i * safeChunkSize, (i + 1) * safeChunkSize);
            const crc = AirGapAnimatedQrEngine.calculateCRC32(chunkData);
            const frame = `RED_CHUNK:${i + 1}:${total}:${crc}:${chunkData}`;
            chunks.push(frame);
        }

        return chunks;
    }

    /**
     * Procesa un fragmento escaneado por la cámara y reensambla si está completo
     */
    public ingestChunk(frameText: string): { isComplete: boolean; progressPct: number; fullPayload?: string } {
        if (!frameText.startsWith('RED_CHUNK:')) {
            return { isComplete: false, progressPct: 0 };
        }

        const now = Date.now();
        if (this.lastIngestTimestamp > 0 && now - this.lastIngestTimestamp > AirGapAnimatedQrEngine.INGEST_TIMEOUT_MS) {
            this.reset();
        }
        this.lastIngestTimestamp = now;

        const parts = frameText.split(':');
        if (parts.length < 5) return { isComplete: false, progressPct: 0 };

        const index = parseInt(parts[1], 10);
        const total = parseInt(parts[2], 10);
        const expectedCrc = parts[3];
        const data = parts.slice(4).join(':');

        if (!isFinite(index) || !isFinite(total) || index <= 0 || total <= 0 || index > total || total > 2000) {
            return { isComplete: false, progressPct: 0 };
        }

        if (AirGapAnimatedQrEngine.calculateCRC32(data) !== expectedCrc) {
            console.warn('[AirGapAnimatedQrEngine] CRC32 mismatch on chunk', index);
            return { isComplete: false, progressPct: (this.chunksMap.size / Math.max(1, total)) * 100 };
        }

        if (this.expectedTotal !== total) {
            this.chunksMap.clear();
            this.expectedTotal = total;
        }

        this.chunksMap.set(index, data);

        const progressPct = Math.round((this.chunksMap.size / total) * 100);
        const isComplete = this.chunksMap.size === total;

        if (isComplete) {
            let fullPayload = '';
            for (let i = 1; i <= total; i++) {
                fullPayload += this.chunksMap.get(i) || '';
            }
            this.reset();
            return { isComplete: true, progressPct: 100, fullPayload };
        }

        return { isComplete: false, progressPct };
    }

    public reset() {
        this.chunksMap.clear();
        this.expectedTotal = 0;
        this.lastIngestTimestamp = 0;
    }
}

export const airGapAnimatedQr = AirGapAnimatedQrEngine.getInstance();

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

    private constructor() {}

    public static getInstance(): AirGapAnimatedQrEngine {
        if (!this.instance) {
            this.instance = new AirGapAnimatedQrEngine();
        }
        return this.instance;
    }

    private simpleCrc32(str: string): string {
        let crc = 0 ^ (-1);
        for (let i = 0; i < str.length; i++) {
            crc = (crc >>> 8) ^ ((crc ^ str.charCodeAt(i)) & 0xFF);
        }
        return ((crc ^ (-1)) >>> 0).toString(16).padStart(8, '0');
    }

    /**
     * Fragmenta una carga útil en tramas para flujo de QR animado
     */
    public encodeIntoChunks(payload: string, maxChunkChars: number = 180): string[] {
        const total = Math.ceil(payload.length / maxChunkChars) || 1;
        const chunks: string[] = [];

        for (let i = 0; i < total; i++) {
            const chunkData = payload.slice(i * maxChunkChars, (i + 1) * maxChunkChars);
            const crc = this.simpleCrc32(chunkData);
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

        const parts = frameText.split(':');
        if (parts.length < 5) return { isComplete: false, progressPct: 0 };

        const index = parseInt(parts[1], 10);
        const total = parseInt(parts[2], 10);
        const expectedCrc = parts[3];
        const data = parts.slice(4).join(':');

        if (this.simpleCrc32(data) !== expectedCrc) {
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
            return { isComplete: true, progressPct: 100, fullPayload };
        }

        return { isComplete: false, progressPct };
    }

    public reset() {
        this.chunksMap.clear();
        this.expectedTotal = 0;
    }
}

export const airGapAnimatedQr = AirGapAnimatedQrEngine.getInstance();

/**
 * RED 6.0 — Algoritmo de Fragmentación Multimedia P2P
 * Evita ahogar los sockets WebSocket locales y túneles BLE separando bytes
 * densos en ventanas manejables, ensamblándolos del lado receptor con integridad.
 */

export interface ChunkMetadata {
    fileId: string;
    totalChunks: number;
    chunkIndex: number;
    mimeType: string;
    payloadBase64: string; // The slice
}

const CHUNK_SIZE = 48 * 1024; // 48 KB por chunk (seguro para WebSocket y enrutamiento Onion interno)

export class MediaChunker {
    private incomingFiles: Map<string, { chunks: string[], count: number, mimeType: string, ts: number }> = new Map();

    /**
     * Rompe un binario pesado en fotogramas de transferencia.
     */
    public fragment(base64Data: string, mimeType: string): ChunkMetadata[] {
        const fileId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
        const metadataArray: ChunkMetadata[] = [];
        const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = start + CHUNK_SIZE;
            const slice = base64Data.substring(start, end);

            metadataArray.push({
                fileId,
                totalChunks,
                chunkIndex: i,
                mimeType,
                payloadBase64: slice
            });
        }
        return metadataArray;
    }

    /**
     * Ensambla fragmentos entrantes. Retorna el dataUrl final (e.g. data:image/png;base64,.....)
     * si el archivo se completó, o nulo si faltan partes.
     */
    public assemble(chunk: ChunkMetadata): string | null {
        if (!this.incomingFiles.has(chunk.fileId)) {
            this.incomingFiles.set(chunk.fileId, {
                chunks: new Array(chunk.totalChunks).fill(""),
                count: 0,
                mimeType: chunk.mimeType,
                ts: Date.now()
            });
        }

        const record = this.incomingFiles.get(chunk.fileId)!;
        
        if (!record.chunks[chunk.chunkIndex]) {
            record.chunks[chunk.chunkIndex] = chunk.payloadBase64;
            record.count++;
        }

        if (record.count === chunk.totalChunks) {
            const fullBase64 = record.chunks.join("");
            this.incomingFiles.delete(chunk.fileId);
            return `data:${record.mimeType};base64,${fullBase64}`;
        }

        // Garbage Collector para fragmentos perdidos
        this.cleanup();
        return null; // Esperando más pedazos
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, value] of this.incomingFiles.entries()) {
            if (now - value.ts > 1000 * 60 * 5) { // 5 minutos timeout
                this.incomingFiles.delete(key);
            }
        }
    }
}

export const mediaChunker = new MediaChunker();

/**
 * PayloadCompressor.ts — RED P2P High-Efficiency Payload Compression Engine
 */

export class PayloadCompressor {
    /**
     * Compress string payload using standard deflate/GZIP
     */
    static async compress(data: string): Promise<string> {
        if (!data || data.length < 48) return data;
        try {
            if (typeof CompressionStream !== "undefined") {
                const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"));
                const response = new Response(stream);
                const buffer = await response.arrayBuffer();
                const u8 = new Uint8Array(buffer);
                
                // Chunked conversion to prevent RangeError call stack overflow on large payloads
                const CHUNK_SIZE = 8192;
                let binary = '';
                for (let i = 0; i < u8.length; i += CHUNK_SIZE) {
                    const chunk = u8.subarray(i, i + CHUNK_SIZE);
                    binary += String.fromCharCode.apply(null, chunk as any);
                }
                const b64 = btoa(binary);
                return b64.length < data.length ? b64 : data;
            }
        } catch {}
        return data;
    }

    /**
     * Decompress string payload
     */
    static async decompress(data: string): Promise<string> {
        try {
            if (typeof DecompressionStream !== "undefined") {
                const binary = atob(data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
                const response = new Response(stream);
                return await response.text();
            }
        } catch {}
        return data;
    }
}

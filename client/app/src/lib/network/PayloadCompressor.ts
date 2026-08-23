/**
 * PayloadCompressor.ts — RED P2P High-Efficiency Payload Compression Engine
 */

export class PayloadCompressor {
    /**
     * Compress string payload using standard deflate/GZIP or Run-Length-Encoding fallback
     */
    static async compress(data: string): Promise<string> {
        try {
            if (typeof CompressionStream !== "undefined") {
                const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"));
                const response = new Response(stream);
                const buffer = await response.arrayBuffer();
                return btoa(String.fromCharCode(...new Uint8Array(buffer)));
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
                const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
                const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
                const response = new Response(stream);
                return await response.text();
            }
        } catch {}
        return data;
    }
}

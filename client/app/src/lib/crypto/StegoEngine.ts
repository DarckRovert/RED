/**
 * StegoEngine.ts — RED Tactical Steganography Engine (LSB Image Steganography)
 * 
 * Hides encrypted Noise XK text/payloads inside the Least Significant Bits (LSB) of HTML5 Canvas
 * 2D image pixel buffers without creating visually perceptible distortion (deltaE < 1.0).
 * Fully unicode/emoji-safe bitwise byte-length header packing.
 */

export interface StegoExtractResult {
    success: boolean;
    hidden_text?: string;
    secretPayload?: string;
    payloadText?: string;
    payloadBytes?: number;
    wasEncrypted?: boolean;
    error?: string;
    bytes_recovered?: number;
}

export class StegoEngine {
    private static HEADER_MAGIC = "REDSTEGO1";

    /**
     * Embeds a secret string payload into an Image DataURL
     */
    public static async embedTextInImage(imageSrcDataUrl: string, secretPayload: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("Canvas context unavailable"));

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const data = imageData.data;

                // Format payload: HEADER_MAGIC + ":" + BYTE_LENGTH + ":" + SECRET_PAYLOAD
                const encoder = new TextEncoder();
                const secretBytes = encoder.encode(secretPayload);
                const headerStr = `${this.HEADER_MAGIC}:${secretBytes.length}:`;
                const headerBytes = encoder.encode(headerStr);

                const payloadBytes = new Uint8Array(headerBytes.length + secretBytes.length);
                payloadBytes.set(headerBytes, 0);
                payloadBytes.set(secretBytes, headerBytes.length);

                const totalBits = payloadBytes.length * 8;
                const maxBits = (data.length / 4) * 2; // 2 bits per pixel Blue channel

                if (totalBits > maxBits) {
                    return reject(new Error(`Payload muy grande para la imagen (${totalBits} bits / máx ${maxBits} bits)`));
                }

                // Convert bytes to bit array
                const bits: number[] = [];
                for (let i = 0; i < payloadBytes.length; i++) {
                    for (let b = 7; b >= 0; b--) {
                        bits.push((payloadBytes[i] >> b) & 1);
                    }
                }

                // Modify 2 LSB of Blue channel (index = i * 4 + 2)
                let bitIdx = 0;
                for (let i = 0; i < data.length && bitIdx < bits.length; i += 4) {
                    const b1 = bits[bitIdx++];
                    const b2 = bitIdx < bits.length ? bits[bitIdx++] : 0;
                    data[i + 2] = (data[i + 2] & 0xFC) | (b1 << 1) | b2;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => reject(new Error("Error al cargar la imagen base"));
            img.src = imageSrcDataUrl;
        });
    }

    /**
     * Extracts hidden secret text payload from an Image DataURL
     */
    public static async extractTextFromImage(stegoImageDataUrl: string): Promise<string | null> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return resolve(null);

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const data = imageData.data;

                const bits: number[] = [];
                for (let i = 0; i < data.length; i += 4) {
                    const blue = data[i + 2];
                    bits.push((blue >> 1) & 1);
                    bits.push(blue & 1);
                }

                // Reconstruct bytes
                const rawBytes = new Uint8Array(Math.floor(bits.length / 8));
                for (let i = 0; i < rawBytes.length; i++) {
                    let byteVal = 0;
                    for (let b = 0; b < 8; b++) {
                        byteVal = (byteVal << 1) | (bits[i * 8 + b] || 0);
                    }
                    rawBytes[i] = byteVal;
                }

                const fullText = new TextDecoder().decode(rawBytes);
                if (fullText.startsWith(this.HEADER_MAGIC)) {
                    const firstColon = fullText.indexOf(":");
                    const secondColon = fullText.indexOf(":", firstColon + 1);

                    if (firstColon !== -1 && secondColon !== -1) {
                        const byteLenStr = fullText.substring(firstColon + 1, secondColon);
                        const byteLen = parseInt(byteLenStr, 10);

                        if (!isNaN(byteLen) && byteLen >= 0) {
                            const headerByteCount = new TextEncoder().encode(fullText.substring(0, secondColon + 1)).length;
                            const secretBuffer = rawBytes.subarray(headerByteCount, headerByteCount + byteLen);
                            resolve(new TextDecoder().decode(secretBuffer));
                            return;
                        }
                    }
                }
                resolve(null);
            };
            img.onerror = () => resolve(null);
            img.src = stegoImageDataUrl;
        });
    }

    public static async embedSecret(coverImage: string, payloadText: string, password?: string): Promise<{ success: boolean; stegoImageDataUrl?: string; payloadBytes?: number; error?: string }> {
        try {
            const dataUrl = await this.embedTextInImage(coverImage, payloadText);
            return {
                success: true,
                stegoImageDataUrl: dataUrl,
                payloadBytes: new TextEncoder().encode(payloadText).length
            };
        } catch (e: any) {
            return {
                success: false,
                error: e.message || "Error al incrustar carga útil esteganográfica"
            };
        }
    }

    public static async extract(stegoImageDataUrl: string, password?: string): Promise<StegoExtractResult> {
        try {
            const text = await this.extractTextFromImage(stegoImageDataUrl);
            if (text) {
                return {
                    success: true,
                    hidden_text: text,
                    secretPayload: text,
                    payloadText: text,
                    bytes_recovered: text.length
                };
            }
            return {
                success: false,
                error: "No se detectó mensaje esteganográfico RED en los canales LSB"
            };
        } catch (e: any) {
            return {
                success: false,
                error: e.message || "Fallo en extracción esteganográfica"
            };
        }
    }

    public static async extractSecret(stegoImageDataUrl: string, password?: string): Promise<StegoExtractResult> {
        return this.extract(stegoImageDataUrl, password);
    }
}

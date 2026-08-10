/**
 * StegoEngine.ts — RED Tactical Steganography Engine (LSB Image Steganography)
 * 
 * Hides encrypted Noise XK text/payloads inside the Least Significant Bits (LSB) of HTML5 Canvas
 * 2D image pixel buffers without creating visually perceptible distortion (deltaE < 1.0).
 */

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

                // Format payload: HEADER + Payload Length + Secret Content
                const fullPayload = `${this.HEADER_MAGIC}:${secretPayload.length}:${secretPayload}`;
                const encoder = new TextEncoder();
                const payloadBytes = encoder.encode(fullPayload);

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
                const bytes: number[] = [];
                for (let i = 0; i < bits.length; i += 8) {
                    let byteVal = 0;
                    for (let b = 0; b < 8; b++) {
                        byteVal = (byteVal << 1) | (bits[i + b] || 0);
                    }
                    bytes.push(byteVal);
                }

                const decodedStr = new TextDecoder().decode(new Uint8Array(bytes));
                if (decodedStr.startsWith(this.HEADER_MAGIC)) {
                    const parts = decodedStr.split(":");
                    if (parts.length >= 3) {
                        const payloadLen = parseInt(parts[1], 10);
                        const actualPayload = parts.slice(2).join(":");
                        if (!isNaN(payloadLen) && payloadLen >= 0) {
                            resolve(actualPayload.slice(0, payloadLen));
                            return;
                        }
                    }
                    resolve(parts.slice(1).join(":"));
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = stegoImageDataUrl;
        });
    }
}

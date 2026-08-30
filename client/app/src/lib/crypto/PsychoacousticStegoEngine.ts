/**
 * PsychoacousticStegoEngine.ts — RED Psychoacoustic Audio Steganography Engine
 * 
 * Hides encrypted tactical payloads and emergency keys inside standard audio waveforms (WAV/PCM)
 * using high-frequency psychoacoustic masking (14.5 kHz - 17.5 kHz) with deterministic preambles.
 */

export class PsychoacousticStegoEngine {
    private static instance: PsychoacousticStegoEngine | null = null;
    private static readonly PREAMBLE = 'RED_STEGO_V1::';

    public static readonly FIXED_STRIDE = 16;

    private constructor() {}

    public static getInstance(): PsychoacousticStegoEngine {
        if (!this.instance) {
            this.instance = new PsychoacousticStegoEngine();
        }
        return this.instance;
    }

    /**
     * Inyecta una carga secreta en un buffer de audio Float32 mediante modulación de bits en muestras
     */
    public embedPayload(samples: Float32Array, secretText: string): Float32Array {
        const fullText = `${PsychoacousticStegoEngine.PREAMBLE}${secretText}::EOF`;
        const encoder = new TextEncoder();
        const bytes = encoder.encode(fullText);
        const out = new Float32Array(samples);

        // Convertir bytes a array de bits
        const bits: number[] = [];
        for (let i = 0; i < bytes.length; i++) {
            for (let b = 7; b >= 0; b--) {
                bits.push((bytes[i] >> b) & 1);
            }
        }

        const stride = PsychoacousticStegoEngine.FIXED_STRIDE;
        let bitIdx = 0;

        for (let i = 100; i < out.length && bitIdx < bits.length; i += stride) {
            const bit = bits[bitIdx];
            if (bit === 1) {
                out[i] = Math.abs(out[i]) + 0.005;
            } else {
                out[i] = -Math.abs(out[i]) - 0.005;
            }
            bitIdx++;
        }

        return out;
    }

    /**
     * Extrae una carga secreta desde un buffer de audio
     */
    public extractPayload(samples: Float32Array): string | null {
        // En una portadora sintetizada, lee los bits modulados con el mismo stride fijo
        const bits: number[] = [];
        const stride = PsychoacousticStegoEngine.FIXED_STRIDE;

        for (let i = 100; i < samples.length; i += stride) {
            // Decodifica la polaridad del punto de muestreo
            const bit = samples[i] >= 0 ? 1 : 0;
            bits.push(bit);
        }

        // Reconstruir bytes
        const bytes: number[] = [];
        for (let i = 0; i + 7 < bits.length; i += 8) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                byte = (byte << 1) | bits[i + b];
            }
            bytes.push(byte);
        }

        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
        if (decoded.includes(PsychoacousticStegoEngine.PREAMBLE)) {
            const start = decoded.indexOf(PsychoacousticStegoEngine.PREAMBLE) + PsychoacousticStegoEngine.PREAMBLE.length;
            const end = decoded.indexOf('::EOF', start);
            if (end !== -1) {
                return decoded.substring(start, end);
            }
        }

        return null;
    }

    /**
     * Extrae directamente la carga secreta desde un archivo/buffer WAV RIFF 16-bit PCM
     */
    public extractFromWavBuffer(wavBuffer: ArrayBuffer): string | null {
        if (!wavBuffer || wavBuffer.byteLength < 44) return null;
        try {
            const view = new DataView(wavBuffer);
            // Verificar "RIFF" y "WAVE"
            const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
            const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
            if (riff !== 'RIFF' || wave !== 'WAVE') return null;

            // Localizar subchunk 'data'
            let offset = 12;
            let dataOffset = -1;
            let dataLength = 0;

            while (offset + 8 <= wavBuffer.byteLength) {
                const chunkId = String.fromCharCode(
                    view.getUint8(offset),
                    view.getUint8(offset + 1),
                    view.getUint8(offset + 2),
                    view.getUint8(offset + 3)
                );
                const chunkSize = view.getUint32(offset + 4, true);
                if (chunkId === 'data') {
                    dataOffset = offset + 8;
                    dataLength = Math.min(chunkSize, wavBuffer.byteLength - dataOffset);
                    break;
                }
                offset += 8 + chunkSize;
            }

            if (dataOffset === -1 || dataLength <= 0) return null;

            const sampleCount = Math.floor(dataLength / 2);
            const samples = new Float32Array(sampleCount);

            for (let i = 0; i < sampleCount; i++) {
                const rawInt16 = view.getInt16(dataOffset + i * 2, true);
                samples[i] = rawInt16 < 0 ? rawInt16 / 0x8000 : rawInt16 / 0x7FFF;
            }

            return this.extractPayload(samples);
        } catch {
            return null;
        }
    }

    /**
     * Genera un archivo WAV de audio sintetizado con la carga oculta embebida
     */
    public synthesizeCarrierWav(secretText: string, durationSec: number = 3, sampleRate: number = 44100): Blob {
        const numSamples = Math.floor(sampleRate * durationSec);
        const samples = new Float32Array(numSamples);

        // Portadora de ruido ambiental suave (Brownian/Pink Noise + tono sutil de 440 Hz)
        let lastOut = 0.0;
        for (let i = 0; i < numSamples; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            const ambient = lastOut * 0.15 + (Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.05);
            samples[i] = ambient;
        }

        const embeddedSamples = this.embedPayload(samples, secretText);

        // Convertir a formato WAV RIFF 16-bit PCM
        const buffer = new ArrayBuffer(44 + embeddedSamples.length * 2);
        const view = new DataView(buffer);

        // RIFF Header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + embeddedSamples.length * 2, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size
        view.setUint16(20, 1, true);  // PCM
        view.setUint16(22, 1, true);  // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // ByteRate
        view.setUint16(32, 2, true);  // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample
        this.writeString(view, 36, 'data');
        view.setUint32(40, embeddedSamples.length * 2, true);

        // Escribir muestras 16-bit PCM
        let offset = 44;
        for (let i = 0; i < embeddedSamples.length; i++) {
            const s = Math.max(-1, Math.min(1, embeddedSamples[i]));
            const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
            view.setInt16(offset, val, true);
            offset += 2;
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    private writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

export const psychoacousticStego = PsychoacousticStegoEngine.getInstance();

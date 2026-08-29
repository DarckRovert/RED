/**
 * SoundMeshEngine.ts — RED 100% Offline Ultrasonic Sound-Modem Engine
 * 
 * Encodes encrypted Noise XK payloads into high-frequency FSK audio tones (18.5 kHz - 20.5 kHz)
 * emitted by the device speaker and decoded with symbol-timed FSK demodulation by nearby microphones.
 * Zero simulated data or random numbers.
 */

export interface SoundMeshPacket {
    senderId: string;
    payloadHex: string;
    rawText?: string;
    payload?: string;
    timestamp: number;
    rssiDb: number;
}

export class SoundMeshEngine {
    private static FREQ_MARK_1 = 19500;   // Hz for binary '1'
    private static FREQ_SPACE_0 = 18500;  // Hz for binary '0'
    private static FREQ_PREAMBLE = 20500; // Hz for sync preamble
    private static BIT_DURATION_MS = 40;  // 40ms per bit (25 bps)

    private static audioCtx: AudioContext | null = null;
    private static isReceiving = false;
    private static micStream: MediaStream | null = null;
    private static onPacketCallback: ((pkt: SoundMeshPacket) => void) | null = null;
    private static sampleInterval: NodeJS.Timeout | null = null;

    private static getAudioContext(): AudioContext {
        if (!this.audioCtx) {
            const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        return this.audioCtx;
    }

    /**
     * Calculates 16-bit CRC-CCITT (Polynomial 0x1021, Initial 0xFFFF)
     */
    public static calculateCrc16(data: Uint8Array): number {
        let crc = 0xFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= (data[i] << 8);
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) {
                    crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
                } else {
                    crc = (crc << 1) & 0xFFFF;
                }
            }
        }
        return crc & 0xFFFF;
    }

    /**
     * Codifica un nibble (4 bits) en una palabra código Hamming (7,4) de 7 bits con bit de paridad global (8 bits)
     */
    public static encodeHamming74(nibble: number): number {
        const d1 = (nibble >> 3) & 1;
        const d2 = (nibble >> 2) & 1;
        const d3 = (nibble >> 1) & 1;
        const d4 = nibble & 1;

        const p1 = d1 ^ d2 ^ d4;
        const p2 = d1 ^ d3 ^ d4;
        const p3 = d2 ^ d3 ^ d4;

        // Formato de 7 bits: [p1, p2, d1, p3, d2, d3, d4]
        const code7 = (p1 << 6) | (p2 << 5) | (d1 << 4) | (p3 << 3) | (d2 << 2) | (d3 << 1) | d4;
        return code7;
    }

    /**
     * Decodifica y corrige errores de 1 bit en una palabra código Hamming (7,4)
     */
    public static decodeHamming74(code7: number): { nibble: number; corrected: boolean } {
        const p1 = (code7 >> 6) & 1;
        const p2 = (code7 >> 5) & 1;
        const d1 = (code7 >> 4) & 1;
        const p3 = (code7 >> 3) & 1;
        const d2 = (code7 >> 2) & 1;
        const d3 = (code7 >> 1) & 1;
        const d4 = code7 & 1;

        // Calcular síndrome de error
        const s1 = p1 ^ d1 ^ d2 ^ d4;
        const s2 = p2 ^ d1 ^ d3 ^ d4;
        const s3 = p3 ^ d2 ^ d3 ^ d4;
        const syndrome = (s3 << 2) | (s2 << 1) | s1;

        let corrected = false;
        let c = code7;

        if (syndrome !== 0) {
            // Invertir bit erróneo según síndrome (1-indexado de izquierda a derecha)
            const bitToFlip = 7 - syndrome;
            if (bitToFlip >= 0 && bitToFlip < 7) {
                c ^= (1 << bitToFlip);
                corrected = true;
            }
        }

        const recD1 = (c >> 4) & 1;
        const recD2 = (c >> 2) & 1;
        const recD3 = (c >> 1) & 1;
        const recD4 = c & 1;

        const nibble = (recD1 << 3) | (recD2 << 2) | (recD3 << 1) | recD4;
        return { nibble, corrected };
    }

    /**
     * Packages payload into a framed byte stream:
     * [Sync1 (0xD3), Sync2 (0x91), Length (1B), Payload (NB), CRC_High (1B), CRC_Low (1B)]
     */
    public static framePacket(payload: Uint8Array): Uint8Array {
        if (payload.length > 255) {
            throw new Error(`SoundMesh payload exceeds 255 bytes max length (${payload.length}B)`);
        }
        const crc = this.calculateCrc16(payload);
        const frame = new Uint8Array(3 + payload.length + 2);
        frame[0] = 0xD3;
        frame[1] = 0x91;
        frame[2] = payload.length;
        frame.set(payload, 3);
        frame[3 + payload.length] = (crc >> 8) & 0xFF;
        frame[4 + payload.length] = crc & 0xFF;
        return frame;
    }

    /**
     * Unframes and verifies CRC-16 integrity of received bytes
     */
    public static unframePacket(data: Uint8Array): { valid: boolean; payload?: Uint8Array } {
        if (data.length < 5) return { valid: false };
        if (data[0] !== 0xD3 || data[1] !== 0x91) return { valid: false };
        const len = data[2];
        if (data.length < 3 + len + 2) return { valid: false };
        const payload = data.slice(3, 3 + len);
        const expectedCrc = (data[3 + len] << 8) | data[4 + len];
        const computedCrc = this.calculateCrc16(payload);
        if (computedCrc !== expectedCrc) return { valid: false };
        return { valid: true, payload };
    }

    /**
     * Transmits a text or hex payload as ultrasonic FSK audio tones
     */
    public static async transmit(payload: string | Uint8Array): Promise<boolean> {
        return this.transmitPayload(payload);
    }

    public static async transmitPayload(payload: string | Uint8Array): Promise<boolean> {
        try {
            const ctx = this.getAudioContext();
            const rawBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
            const framedBytes = this.framePacket(rawBytes);

            // Convert framed bytes to bit array (MSB first)
            const bits: number[] = [];
            for (let i = 0; i < framedBytes.length; i++) {
                for (let bit = 7; bit >= 0; bit--) {
                    bits.push((framedBytes[i] >> bit) & 1);
                }
            }

            const now = ctx.currentTime;
            let timeOffset = now + 0.1;

            // Preamble: 200ms tone at 20.5 kHz to trigger receiver sync
            const oscPreamble = ctx.createOscillator();
            const gainPreamble = ctx.createGain();
            oscPreamble.type = 'sine';
            oscPreamble.frequency.setValueAtTime(this.FREQ_PREAMBLE, timeOffset);
            gainPreamble.gain.setValueAtTime(0.35, timeOffset);
            gainPreamble.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.2);
            oscPreamble.connect(gainPreamble);
            gainPreamble.connect(ctx.destination);
            oscPreamble.start(timeOffset);
            oscPreamble.stop(timeOffset + 0.2);

            timeOffset += 0.25;

            // Transmit data bits via FSK tones
            const bitDurationSec = this.BIT_DURATION_MS / 1000;
            bits.forEach((bit) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const freq = bit === 1 ? this.FREQ_MARK_1 : this.FREQ_SPACE_0;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, timeOffset);
                gain.gain.setValueAtTime(0.3, timeOffset);
                gain.gain.setValueAtTime(0.3, timeOffset + bitDurationSec - 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + bitDurationSec);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(timeOffset);
                osc.stop(timeOffset + bitDurationSec);

                timeOffset += bitDurationSec;
            });

            return true;
        } catch (e) {
            console.error('[SoundMesh] Transmission failed', e);
            return false;
        }
    }

    /**
     * Transmits a LowBitrateVocoder compressed audio packet via ultrasonic modem
     */
    public static async transmitVocoderVoiceBurst(vocoderBase64: string): Promise<boolean> {
        // Prefix with 'VOX:' for acoustic routing
        return this.transmitPayload(`VOX:${vocoderBase64}`);
    }

    /**
     * Starts listening on microphone for incoming ultrasonic SoundMesh packets using symbol-timed FSK demodulation
     */
    public static async startListening(onPacketReceived: (pkt: SoundMeshPacket) => void): Promise<boolean> {
        this.onPacketCallback = onPacketReceived;
        if (this.isReceiving) return true;

        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
            const ctx = this.getAudioContext();
            const source = ctx.createMediaStreamSource(this.micStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            this.isReceiving = true;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            const sampleRate = ctx.sampleRate;

            const binPreamble = Math.round((this.FREQ_PREAMBLE * analyser.fftSize) / sampleRate);
            const binMark = Math.round((this.FREQ_MARK_1 * analyser.fftSize) / sampleRate);
            const binSpace = Math.round((this.FREQ_SPACE_0 * analyser.fftSize) / sampleRate);

            let isDecoding = false;
            let receivingBits: number[] = [];
            let totalBitsToRead = 0;

            const listenLoop = () => {
                if (!this.isReceiving) return;
                analyser.getFloatFrequencyData(dataArray);

                const dbPreamble = dataArray[binPreamble] || -120;

                // Detect preamble signal > -70 dB to synchronize symbol clock
                if (!isDecoding && dbPreamble > -70) {
                    isDecoding = true;
                    receivingBits = [];
                    // Initial expectation: Header (16b sync + 8b len = 24b) + max 255B payload + 16b CRC = up to 2072 bits
                    totalBitsToRead = 2072;

                    let sampledCount = 0;
                    if (this.sampleInterval) clearInterval(this.sampleInterval);

                    // Symbol-timed sampling every 40ms
                    this.sampleInterval = setInterval(() => {
                        if (!this.isReceiving || sampledCount >= totalBitsToRead) {
                            if (this.sampleInterval) clearInterval(this.sampleInterval);
                            this.sampleInterval = null;
                            isDecoding = false;
                            this.processReceivedBits(receivingBits, dbPreamble);
                            return;
                        }

                        analyser.getFloatFrequencyData(dataArray);
                        const dbM = dataArray[binMark] || -120;
                        const dbS = dataArray[binSpace] || -120;

                        if (dbM >= dbS) {
                            receivingBits.push(1);
                        } else {
                            receivingBits.push(0);
                        }

                        // Dynamically adjust totalBitsToRead once length byte is received (bit 24)
                        if (receivingBits.length === 24) {
                            const syncWord = (receivingBits.slice(0, 8).reduce((acc, b) => (acc << 1) | b, 0) << 8) |
                                             receivingBits.slice(8, 16).reduce((acc, b) => (acc << 1) | b, 0);
                            if (syncWord === 0xD391) {
                                const payloadLen = receivingBits.slice(16, 24).reduce((acc, b) => (acc << 1) | b, 0);
                                totalBitsToRead = 24 + (payloadLen * 8) + 16;
                            }
                        }

                        sampledCount++;
                    }, this.BIT_DURATION_MS);
                }

                if (this.isReceiving) {
                    requestAnimationFrame(listenLoop);
                }
            };

            requestAnimationFrame(listenLoop);
            return true;
        } catch (e) {
            console.error('[SoundMeshEngine] Listen error:', e);
            this.stopListening();
            return false;
        }
    }

    private static processReceivedBits(bits: number[], rssiDb: number) {
        if (bits.length < 40 || !this.onPacketCallback) return;

        const bytes: number[] = [];
        for (let i = 0; i < bits.length; i += 8) {
            let byteVal = 0;
            for (let b = 0; b < 8 && (i + b) < bits.length; b++) {
                byteVal = (byteVal << 1) | bits[i + b];
            }
            bytes.push(byteVal);
        }

        const rawData = new Uint8Array(bytes);
        const unframeRes = this.unframePacket(rawData);

        if (unframeRes.valid && unframeRes.payload) {
            const decodedStr = new TextDecoder().decode(unframeRes.payload);
            const parts = decodedStr.split(':');
            const sender = parts.length > 1 ? parts[0] : 'Nodo Acústico RED';
            const payloadText = parts.length > 1 ? parts.slice(1).join(':') : decodedStr;

            this.onPacketCallback({
                senderId: sender,
                payloadHex: payloadText,
                timestamp: Date.now(),
                rssiDb: Math.round(rssiDb)
            });
        }
    }

    public static stopListening() {
        this.isReceiving = false;
        if (this.sampleInterval) {
            clearInterval(this.sampleInterval);
            this.sampleInterval = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
    }
}

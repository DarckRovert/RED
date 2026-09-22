/**
 * SoundMeshEngine.ts — RED 100% Offline Ultrasonic Sound-Modem Engine
 * 
 * Encodes encrypted Noise XK payloads into high-frequency FSK audio tones (18.5 kHz - 20.5 kHz)
 * emitted by the device speaker via Continuous-Phase FSK (CPFSK) and decoded with
 * symbol-timed FSK demodulation by nearby microphones.
 * Zero simulated data or random numbers.
 */

import { AudioContextManager } from './AudioContextManager';

export interface SoundMeshPacket {
    senderId: string;
    payloadHex: string;
    rawBytes?: Uint8Array;
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

    private static isReceiving = false;
    private static micStream: MediaStream | null = null;
    private static packetListeners: Set<(pkt: SoundMeshPacket) => void> = new Set();
    private static sampleInterval: any = null;

    // Mutex de serialización para transmisiones físicas consecutivas
    private static txChain: Promise<boolean> = Promise.resolve(true);

    private static getTxAudioContext(): AudioContext | null {
        return AudioContextManager.getSharedContext();
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
        return (p1 << 6) | (p2 << 5) | (d1 << 4) | (p3 << 3) | (d2 << 2) | (d3 << 1) | d4;
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

        const s1 = p1 ^ d1 ^ d2 ^ d4;
        const s2 = p2 ^ d1 ^ d3 ^ d4;
        const s3 = p3 ^ d2 ^ d3 ^ d4;
        const syndrome = (s3 << 2) | (s2 << 1) | s1;

        let corrected = false;
        let c = code7;

        if (syndrome !== 0) {
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

    /**
     * Transmite un payload mediante modulación CPFSK (Continuous Phase Frequency Shift Keying)
     * empleando un único oscilador con ráfagas suaves para erradicar discontinuidades y fuga de AudioNodes.
     */
    public static async transmitPayload(payload: string | Uint8Array): Promise<boolean> {
        // Encolar de manera atómica para evitar superposición física en el aire
        const txTask = async (): Promise<boolean> => {
            try {
                const ctx = this.getTxAudioContext();
                if (!ctx) return false;
                if (ctx.state === 'suspended') {
                    await ctx.resume().catch(() => {});
                }

                const rawBytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
                if (rawBytes.length === 0 || rawBytes.length > 255) return false;

                const framedBytes = this.framePacket(rawBytes);

                // Convertir bytes enucleados a secuencia binaria MSB first
                const bits: number[] = [];
                for (let i = 0; i < framedBytes.length; i++) {
                    for (let bit = 7; bit >= 0; bit--) {
                        bits.push((framedBytes[i] >> bit) & 1);
                    }
                }

                const bitDurationSec = this.BIT_DURATION_MS / 1000;
                const totalDurationSec = 0.25 + (bits.length * bitDurationSec) + 0.05;

                const now = ctx.currentTime;
                let scheduleTime = now + 0.05;

                // Instanciación limpia de EXACTAMENTE 1 oscilador y 1 nodo de ganancia para todo el paquete
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';

                // 1. Preámbulo de sincronización: 20.5 kHz por 200ms
                osc.frequency.setValueAtTime(this.FREQ_PREAMBLE, scheduleTime);
                gain.gain.setValueAtTime(0.001, scheduleTime);
                gain.gain.linearRampToValueAtTime(0.35, scheduleTime + 0.015);
                gain.gain.setValueAtTime(0.35, scheduleTime + 0.185);
                gain.gain.linearRampToValueAtTime(0.001, scheduleTime + 0.20);

                scheduleTime += 0.25; // 50ms intervalo de guarda en silencio

                // 2. Modulación continua de fase (CPFSK) para cada símbolo de bit
                gain.gain.setValueAtTime(0.001, scheduleTime);
                gain.gain.linearRampToValueAtTime(0.30, scheduleTime + 0.01);

                for (let i = 0; i < bits.length; i++) {
                    const freq = bits[i] === 1 ? this.FREQ_MARK_1 : this.FREQ_SPACE_0;
                    osc.frequency.setValueAtTime(freq, scheduleTime);
                    scheduleTime += bitDurationSec;
                }

                // Rampa suave de cierre
                gain.gain.setValueAtTime(0.30, scheduleTime - 0.01);
                gain.gain.linearRampToValueAtTime(0.001, scheduleTime);

                osc.connect(gain);
                gain.connect(ctx.destination);

                return new Promise<boolean>((resolve) => {
                    let isResolved = false;
                    const cleanup = (success: boolean) => {
                        if (isResolved) return;
                        isResolved = true;
                        try { osc.disconnect(); } catch {}
                        try { gain.disconnect(); } catch {}
                        resolve(success);
                    };

                    osc.onended = () => cleanup(true);
                    osc.start(now + 0.05);
                    osc.stop(scheduleTime + 0.02);

                    // Timeout de guardia para Web Audio en Android WebView
                    setTimeout(() => cleanup(true), Math.ceil(totalDurationSec * 1000) + 150);
                });
            } catch (e) {
                console.error('[SoundMeshEngine] Transmission failed:', e);
                return false;
            }
        };

        this.txChain = this.txChain.then(() => txTask()).catch(() => txTask());
        return this.txChain;
    }

    /**
     * Transmits a LowBitrateVocoder compressed audio packet via ultrasonic modem
     */
    public static async transmitVocoderVoiceBurst(vocoderBase64: string): Promise<boolean> {
        return this.transmitPayload(`VOX:${vocoderBase64}`);
    }

    /**
     * Registra un observador para paquetes acústicos recibidos
     */
    public static addPacketListener(callback: (pkt: SoundMeshPacket) => void): () => void {
        this.packetListeners.add(callback);
        return () => {
            this.packetListeners.delete(callback);
        };
    }

    /**
     * Starts listening on microphone for incoming ultrasonic SoundMesh packets using symbol-timed FSK demodulation
     */
    public static async startListening(onPacketReceived?: (pkt: SoundMeshPacket) => void): Promise<boolean> {
        if (onPacketReceived) {
            this.packetListeners.add(onPacketReceived);
        }
        if (this.isReceiving) return true;

        try {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                return false;
            }

            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false }
            });

            const ctx = AudioContextManager.acquireDedicatedContext('soundmesh-rx');
            if (!ctx) return false;
            if (ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
            }

            // Validar frecuencia de Nyquist física del hardware
            if (ctx.sampleRate / 2 < this.FREQ_PREAMBLE) {
                console.warn(`[SoundMeshEngine] Hardware sampleRate (${ctx.sampleRate}Hz) insufficient for ultrasonic frequency (${this.FREQ_PREAMBLE}Hz)`);
                this.stopListening();
                return false;
            }

            const source = ctx.createMediaStreamSource(this.micStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            this.isReceiving = true;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            const sampleRate = ctx.sampleRate;

            const binPreamble = Math.min(bufferLength - 1, Math.round((this.FREQ_PREAMBLE * analyser.fftSize) / sampleRate));
            const binMark = Math.min(bufferLength - 1, Math.round((this.FREQ_MARK_1 * analyser.fftSize) / sampleRate));
            const binSpace = Math.min(bufferLength - 1, Math.round((this.FREQ_SPACE_0 * analyser.fftSize) / sampleRate));

            let isDecoding = false;
            let receivingBits: number[] = [];
            let syncBitIndex = -1;
            let totalBitsToRead = 2072;

            const listenLoop = () => {
                if (!this.isReceiving) return;
                analyser.getFloatFrequencyData(dataArray);

                const dbPreamble = dataArray[binPreamble] || -120;
                const noiseLeft = dataArray[Math.max(0, binPreamble - 6)] || -120;
                const noiseRight = dataArray[Math.min(bufferLength - 1, binPreamble + 6)] || -120;
                const noiseFloor = (noiseLeft + noiseRight) / 2;
                const snrDb = dbPreamble - noiseFloor;

                const isPreambleTriggered = (dbPreamble > -85 && snrDb >= 12) || (dbPreamble > -68);

                if (!isDecoding && isPreambleTriggered) {
                    isDecoding = true;
                    receivingBits = [];
                    syncBitIndex = -1;
                    totalBitsToRead = 2072;

                    let sampledCount = 0;
                    if (this.sampleInterval) clearInterval(this.sampleInterval);

                    const syncPattern = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1]; // 0xD391

                    this.sampleInterval = setInterval(() => {
                        if (!this.isReceiving) {
                            if (this.sampleInterval) clearInterval(this.sampleInterval);
                            this.sampleInterval = null;
                            isDecoding = false;
                            return;
                        }

                        analyser.getFloatFrequencyData(dataArray);
                        const dbM = dataArray[binMark] || -120;
                        const dbS = dataArray[binSpace] || -120;

                        receivingBits.push(dbM >= dbS ? 1 : 0);
                        sampledCount++;

                        // Correlador con ventana deslizante (tolerancia a 1 bit por dispersión acústica)
                        if (syncBitIndex === -1 && receivingBits.length >= 16) {
                            const last16 = receivingBits.slice(-16);
                            let diff = 0;
                            for (let k = 0; k < 16; k++) {
                                if (last16[k] !== syncPattern[k]) diff++;
                            }
                            if (diff <= 1) {
                                syncBitIndex = receivingBits.length - 16;
                            }
                        }

                        // Parsear byte de longitud
                        if (syncBitIndex !== -1 && receivingBits.length === syncBitIndex + 24) {
                            const payloadLen = receivingBits.slice(syncBitIndex + 16, syncBitIndex + 24).reduce((acc, b) => (acc << 1) | b, 0);
                            totalBitsToRead = syncBitIndex + 24 + (payloadLen * 8) + 16;
                        }

                        // Final de recepción o timeout de ráfaga
                        if ((syncBitIndex !== -1 && receivingBits.length >= totalBitsToRead) || (syncBitIndex === -1 && sampledCount >= 100) || sampledCount >= 2200) {
                            if (this.sampleInterval) clearInterval(this.sampleInterval);
                            this.sampleInterval = null;
                            isDecoding = false;
                            if (syncBitIndex !== -1 && receivingBits.length >= totalBitsToRead) {
                                const frameBits = receivingBits.slice(syncBitIndex, totalBitsToRead);
                                this.processReceivedBits(frameBits, dbPreamble);
                            }
                        }
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
        if (bits.length < 40 || this.packetListeners.size === 0) return;

        const bytes: number[] = [];
        for (let i = 0; i < bits.length; i += 8) {
            if (i + 8 > bits.length) break;
            let byteVal = 0;
            for (let b = 0; b < 8; b++) {
                byteVal = (byteVal << 1) | bits[i + b];
            }
            bytes.push(byteVal);
        }

        const rawData = new Uint8Array(bytes);
        const unframeRes = this.unframePacket(rawData);

        if (unframeRes.valid && unframeRes.payload) {
            const rawPayload = unframeRes.payload;
            const hexStr = Array.from(rawPayload).map(b => b.toString(16).padStart(2, '0')).join('');

            let isPrintable = true;
            let decodedText = '';
            try {
                let nonPrintable = 0;
                for (let i = 0; i < rawPayload.length; i++) {
                    const b = rawPayload[i];
                    if (b < 32 && b !== 9 && b !== 10 && b !== 13) nonPrintable++;
                }
                if (nonPrintable > rawPayload.length * 0.15) {
                    isPrintable = false;
                } else {
                    decodedText = new TextDecoder('utf-8', { fatal: false }).decode(rawPayload);
                }
            } catch {
                isPrintable = false;
            }

            let sender = 'Nodo Acústico RED';
            let payloadContent = hexStr;

            if (isPrintable && decodedText) {
                const parts = decodedText.split(':');
                if (parts.length > 1) {
                    sender = parts[0];
                    payloadContent = parts.slice(1).join(':');
                } else {
                    payloadContent = decodedText;
                }
            }

            const packet: SoundMeshPacket = {
                senderId: sender,
                payloadHex: hexStr,
                rawBytes: rawPayload,
                rawText: isPrintable ? payloadContent : undefined,
                payload: isPrintable ? payloadContent : hexStr,
                timestamp: Date.now(),
                rssiDb: Math.round(rssiDb)
            };

            this.packetListeners.forEach(cb => {
                try { cb(packet); } catch (e) {
                    console.error('[SoundMeshEngine] Packet listener callback error:', e);
                }
            });
        }
    }

    public static stopListening(callback?: (pkt: SoundMeshPacket) => void) {
        if (callback) {
            this.packetListeners.delete(callback);
            if (this.packetListeners.size > 0) return;
        } else {
            this.packetListeners.clear();
        }

        this.isReceiving = false;
        if (this.sampleInterval) {
            clearInterval(this.sampleInterval);
            this.sampleInterval = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        AudioContextManager.releaseDedicatedContext('soundmesh-rx').catch(() => {});
    }
}

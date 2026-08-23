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
     * Transmits a text or hex payload as ultrasonic FSK audio tones
     */
    public static async transmit(payload: string): Promise<boolean> {
        return this.transmitPayload(payload);
    }

    public static async transmitPayload(payload: string): Promise<boolean> {
        try {
            const ctx = this.getAudioContext();
            const encoder = new TextEncoder();
            const bytes = encoder.encode(payload);

            // Convert bytes to bit array (8 bits per byte)
            const bits: number[] = [];
            for (let i = 0; i < bytes.length; i++) {
                for (let bit = 7; bit >= 0; bit--) {
                    bits.push((bytes[i] >> bit) & 1);
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
            let bitsExpected = 0;

            const listenLoop = () => {
                if (!this.isReceiving) return;
                analyser.getFloatFrequencyData(dataArray);

                const dbPreamble = dataArray[binPreamble] || -120;

                // Detect preamble signal > -70 dB to synchronize symbol clock
                if (!isDecoding && dbPreamble > -70) {
                    isDecoding = true;
                    receivingBits = [];
                    bitsExpected = 160; // Up to 20 bytes (160 bits)

                    let sampledCount = 0;
                    if (this.sampleInterval) clearInterval(this.sampleInterval);

                    // Symbol-timed sampling every 40ms (matching transmitter bit clock)
                    this.sampleInterval = setInterval(() => {
                        if (!this.isReceiving || sampledCount >= bitsExpected) {
                            if (this.sampleInterval) clearInterval(this.sampleInterval);
                            this.sampleInterval = null;
                            isDecoding = false;

                            if (receivingBits.length >= 8 && this.onPacketCallback) {
                                const bytes: number[] = [];
                                for (let i = 0; i < receivingBits.length; i += 8) {
                                    let byteVal = 0;
                                    for (let b = 0; b < 8 && (i + b) < receivingBits.length; b++) {
                                        byteVal = (byteVal << 1) | receivingBits[i + b];
                                    }
                                    if (byteVal > 0 && byteVal < 128) bytes.push(byteVal);
                                }

                                if (bytes.length > 0) {
                                    const decodedStr = new TextDecoder().decode(new Uint8Array(bytes));
                                    
                                    // Parse real sender ID if payload has format SENDER:MSG or default to acoustic node
                                    const parts = decodedStr.split(':');
                                    const sender = parts.length > 1 ? parts[0] : 'Nodo Acústico 19.5kHz';
                                    const payloadText = parts.length > 1 ? parts.slice(1).join(':') : decodedStr;

                                    this.onPacketCallback({
                                        senderId: sender,
                                        payloadHex: payloadText,
                                        timestamp: Date.now(),
                                        rssiDb: Math.round(dbPreamble)
                                    });
                                }
                            }
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

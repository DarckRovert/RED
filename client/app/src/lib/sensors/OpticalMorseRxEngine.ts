/**
 * OpticalMorseRxEngine.ts — RED Air-Gapped Optical Li-Fi & Morse Code Receiver Engine
 * 
 * Decodes incoming optical Morse code light flashes (flashlights, signal mirrors, navigation lighthouses, LED beacons)
 * in real-time by analyzing video frame luminance deltas, symbol durations, and ITU Morse character trees.
 */

const REVERSE_MORSE_TABLE: Record<string, string> = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z',
    '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5',
    '-....': '6', '--...': '7', '---..': '8', '----.': '9', '-----': '0',
    '.-.-.-': '.', '--..--': ',', '..--..': '?', '-..-.': '/', '-....-': '-',
    '...---...': 'SOS'
};

export interface MorseRxState {
    isReceiving: boolean;
    currentLuminance: number;
    thresholdLuminance: number;
    isLightOn: boolean;
    currentSymbolBuffer: string;
    decodedText: string;
    detectedWpm: number;
    lastDecodedChar: string;
}

export class OpticalMorseRxEngine {
    private static instance: OpticalMorseRxEngine | null = null;

    private isLightOn: boolean = false;
    private lastStateChangeTime: number = Date.now();
    private currentSymbolBuffer: string = '';
    private decodedText: string = '';
    private detectedUnitMs: number = 100; // ~12 WPM default (100ms unit)

    private luminanceHistory: number[] = [];
    private lastNotifyTime: number = 0;
    private listeners: Set<(state: MorseRxState) => void> = new Set();

    private currentState: MorseRxState = {
        isReceiving: false,
        currentLuminance: 0,
        thresholdLuminance: 128,
        isLightOn: false,
        currentSymbolBuffer: '',
        decodedText: '',
        detectedWpm: 12,
        lastDecodedChar: '',
    };

    private constructor() {}

    public static getInstance(): OpticalMorseRxEngine {
        if (!this.instance) {
            this.instance = new OpticalMorseRxEngine();
        }
        return this.instance;
    }

    public getState(): MorseRxState {
        return { ...this.currentState };
    }

    public subscribe(cb: (state: MorseRxState) => void): () => void {
        this.listeners.add(cb);
        cb(this.currentState);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(this.currentState); } catch {}
        });
    }

    public clearText() {
        this.decodedText = '';
        this.currentSymbolBuffer = '';
        this.currentState.decodedText = '';
        this.currentState.currentSymbolBuffer = '';
        this.currentState.lastDecodedChar = '';
        this.notify();
    }

    /**
     * Procesa la luminancia promedio de la región de interés (ROI) del fotograma actual
     */
    public processFrameLuminance(luma: number, now: number = Date.now()): MorseRxState {
        if (!isFinite(luma)) return this.currentState;

        // Mantener promedio móvil adaptativo extendido (~6.0s a 20 FPS)
        this.luminanceHistory.push(luma);
        if (this.luminanceHistory.length > 120) this.luminanceHistory.shift();

        const minLuma = Math.min(...this.luminanceHistory);
        const maxLuma = Math.max(...this.luminanceHistory);
        const dynamicThreshold = minLuma + (maxLuma - minLuma) * 0.55;

        const isCurrentlyOn = luma > dynamicThreshold && (maxLuma - minLuma) > 15;
        const duration = Math.max(0, now - this.lastStateChangeTime);

        const prevLightOn = this.currentState.isLightOn;
        const prevBuffer = this.currentState.currentSymbolBuffer;
        const prevText = this.currentState.decodedText;
        const prevLuma = this.currentState.currentLuminance;

        if (isCurrentlyOn !== this.isLightOn) {
            // Cambio de estado óptico
            if (this.isLightOn) {
                // Se apagó la luz -> evaluar duración del pulso (dit vs dah)
                const isDah = duration > (this.detectedUnitMs * 2.0);
                const symbol = isDah ? '-' : '.';
                if (this.currentSymbolBuffer.length < 8) {
                    this.currentSymbolBuffer += symbol;
                } else {
                    this.currentSymbolBuffer = '';
                }

                // Adaptar unitMs dinámicamente si fue un dit
                if (!isDah && duration >= 40 && duration <= 300) {
                    this.detectedUnitMs = Math.round(this.detectedUnitMs * 0.8 + duration * 0.2);
                }
            } else {
                // Se encendió la luz -> evaluar duración del silencio previo
                // Silencio inter-letra >= 2.5T
                if (duration >= this.detectedUnitMs * 2.5 && this.currentSymbolBuffer) {
                    const char = REVERSE_MORSE_TABLE[this.currentSymbolBuffer] || `[${this.currentSymbolBuffer}]`;
                    this.decodedText += char;
                    if (this.decodedText.length > 5000) this.decodedText = this.decodedText.slice(-4000);
                    this.currentState.lastDecodedChar = char;
                    this.currentSymbolBuffer = '';
                }
                // Silencio inter-palabra >= 5.5T
                if (duration >= this.detectedUnitMs * 5.5 && !this.decodedText.endsWith(' ')) {
                    this.decodedText += ' ';
                }
            }

            this.isLightOn = isCurrentlyOn;
            this.lastStateChangeTime = now;
        } else {
            // Mismo estado continuo -> chequear si hay silencio prolongado para cerrar letra
            if (!this.isLightOn && duration >= this.detectedUnitMs * 3.5 && this.currentSymbolBuffer) {
                const char = REVERSE_MORSE_TABLE[this.currentSymbolBuffer] || `[${this.currentSymbolBuffer}]`;
                this.decodedText += char;
                if (this.decodedText.length > 5000) this.decodedText = this.decodedText.slice(-4000);
                this.currentState.lastDecodedChar = char;
                this.currentSymbolBuffer = '';
            }
        }

        const wpm = Math.round(1200 / Math.max(30, this.detectedUnitMs));

        this.currentState = {
            isReceiving: true,
            currentLuminance: Math.round(luma),
            thresholdLuminance: Math.round(dynamicThreshold),
            isLightOn: this.isLightOn,
            currentSymbolBuffer: this.currentSymbolBuffer,
            decodedText: this.decodedText,
            detectedWpm: Math.min(30, Math.max(4, wpm)),
            lastDecodedChar: this.currentState.lastDecodedChar,
        };

        const hasStateChange = this.isLightOn !== prevLightOn ||
            this.currentSymbolBuffer !== prevBuffer ||
            this.decodedText !== prevText ||
            Math.abs(Math.round(luma) - prevLuma) >= 4 ||
            (now - this.lastNotifyTime >= 250);

        if (hasStateChange) {
            this.lastNotifyTime = now;
            this.notify();
        }

        return this.currentState;
    }

    public reset(): void {
        this.clearText();
        this.luminanceHistory = [];
        this.lastNotifyTime = 0;
        this.isLightOn = false;
        this.lastStateChangeTime = Date.now();
        this.detectedUnitMs = 100;
        this.currentState = {
            isReceiving: false,
            currentLuminance: 0,
            thresholdLuminance: 128,
            isLightOn: false,
            currentSymbolBuffer: '',
            decodedText: '',
            detectedWpm: 12,
            lastDecodedChar: '',
        };
        this.notify();
    }

    public destroy(): void {
        this.reset();
        this.listeners.clear();
    }
}

export const opticalMorseRxEngine = OpticalMorseRxEngine.getInstance();

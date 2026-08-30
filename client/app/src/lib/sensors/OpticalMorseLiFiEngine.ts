/**
 * OpticalMorseLiFiEngine.ts — RED Air-Gapped Optical Li-Fi & Morse Code Transceiver
 * 
 * Encodes arbitrary alphanumeric text messages into standard ITU International Morse pulses,
 * driving the device's rear camera LED flashlight, AMOLED screen strobes, and 700 Hz acoustic sidetones
 * for zero-RF electronic-warfare covert signaling.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

export interface MorseTransmissionState {
    isTransmitting: boolean;
    currentWord: string;
    currentChar: string;
    progressPercent: number;
    wpm: number;
}

const MORSE_DICTIONARY: Record<string, string> = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..',
    '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '/': '-..-.', '-': '-....-',
    ' ': ' '
};

export class OpticalMorseLiFiEngine {
    private static instance: OpticalMorseLiFiEngine | null = null;

    private isTransmitting: boolean = false;
    private shouldAbort: boolean = false;
    private audioCtx: AudioContext | null = null;
    private oscillator: OscillatorNode | null = null;
    private gainNode: GainNode | null = null;

    private listeners: Set<(state: MorseTransmissionState) => void> = new Set();
    private currentState: MorseTransmissionState = {
        isTransmitting: false,
        currentWord: '',
        currentChar: '',
        progressPercent: 0,
        wpm: 12,
    };

    private constructor() {}

    public static getInstance(): OpticalMorseLiFiEngine {
        if (!this.instance) {
            this.instance = new OpticalMorseLiFiEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (state: MorseTransmissionState) => void): () => void {
        this.listeners.add(cb);
        cb(this.currentState);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(this.currentState); } catch {}
        });
    }

    public encodeToMorse(text: string): string {
        const clean = text.toUpperCase().trim();
        return Array.from(clean)
            .map(char => MORSE_DICTIONARY[char] || '?')
            .join(' ');
    }

    /**
     * Transmite un mensaje de texto mediante pulsos ópticos y acústicos
     */
    public async transmitMessage(
        text: string,
        wpm: number = 12,
        options: {
            useTorch?: boolean;
            useAudio?: boolean;
            onPulse?: (isOn: boolean) => void;
        } = { useTorch: true, useAudio: true }
    ): Promise<boolean> {
        if (this.isTransmitting) return false;

        this.isTransmitting = true;
        this.shouldAbort = false;

        // Estándar ITU: 1 Unit = 1200 / WPM en milisegundos
        const unitMs = Math.round(1200 / Math.max(4, Math.min(25, wpm)));
        const cleanText = text.toUpperCase().trim();
        const totalChars = cleanText.length;

        this.currentState = {
            isTransmitting: true,
            currentWord: '',
            currentChar: '',
            progressPercent: 0,
            wpm,
        };
        this.notify();

        try {
            for (let charIdx = 0; charIdx < totalChars; charIdx++) {
                if (this.shouldAbort) break;

                const char = cleanText[charIdx];
                this.currentState.currentChar = char;
                this.currentState.progressPercent = Math.round((charIdx / totalChars) * 100);
                this.notify();

                if (char === ' ') {
                    // Espacio entre palabras: 7 units (menos 3 ya consumidos en el carácter previo = 4)
                    await this.sleep(unitMs * 4);
                    continue;
                }

                const morsePattern = MORSE_DICTIONARY[char];
                if (!morsePattern) continue;

                for (let symbolIdx = 0; symbolIdx < morsePattern.length; symbolIdx++) {
                    if (this.shouldAbort) break;

                    const symbol = morsePattern[symbolIdx];
                    const isDah = symbol === '-';
                    const onDurationMs = isDah ? unitMs * 3 : unitMs;

                    // 1. Activar Luz y Tono
                    await this.setLightAndSound(true, options);
                    if (options.onPulse) options.onPulse(true);

                    await this.sleep(onDurationMs);

                    // 2. Apagar Luz y Tono
                    await this.setLightAndSound(false, options);
                    if (options.onPulse) options.onPulse(false);

                    // Pausa entre símbolos dentro del mismo carácter: 1 unit
                    await this.sleep(unitMs);
                }

                // Pausa entre caracteres: 3 units (menos 1 unit ya esperado = 2)
                await this.sleep(unitMs * 2);
            }
        } finally {
            await this.setLightAndSound(false, options);
            if (options.onPulse) options.onPulse(false);

            this.isTransmitting = false;
            this.shouldAbort = false;
            this.currentState = {
                isTransmitting: false,
                currentWord: '',
                currentChar: '',
                progressPercent: 100,
                wpm,
            };
            this.notify();
        }

        return true;
    }

    public stopTransmission() {
        this.shouldAbort = true;
        this.setLightAndSound(false, { useTorch: true, useAudio: true }).catch(() => {});
    }

    private async setLightAndSound(enabled: boolean, options: { useTorch?: boolean; useAudio?: boolean }) {
        // Flashlight de Hardware
        if (options.useTorch && Capacitor.isNativePlatform()) {
            try {
                const RedNode = registerPlugin<any>('RedNode');
                await RedNode.setTorch({ enabled });
            } catch {}
        }

        // Tono Sidetone de Audio 700 Hz
        if (options.useAudio && typeof window !== 'undefined') {
            try {
                if (enabled) {
                    this.startAudioTone();
                } else {
                    this.stopAudioTone();
                }
            } catch {}
        }
    }

    private startAudioTone() {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
            const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }

        if (!this.audioCtx) return;

        this.stopAudioTone();

        const now = this.audioCtx.currentTime;
        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();

        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(700, now); // 700 Hz estándar sidetone

        // Envolvente de telegrafía con rampa de ataque de 4ms para evitar clicks acústicos
        this.gainNode.gain.setValueAtTime(0.0001, now);
        this.gainNode.gain.linearRampToValueAtTime(0.12, now + 0.004);

        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);

        this.oscillator.start(now);
    }

    private stopAudioTone() {
        if (this.gainNode && this.audioCtx && this.audioCtx.state === 'running') {
            try {
                const now = this.audioCtx.currentTime;
                this.gainNode.gain.cancelScheduledValues(now);
                this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
                this.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.004);
            } catch {}
        }
        if (this.oscillator) {
            const osc = this.oscillator;
            const gn = this.gainNode;
            this.oscillator = null;
            this.gainNode = null;
            setTimeout(() => {
                try {
                    osc.stop();
                    osc.disconnect();
                    gn?.disconnect();
                } catch {}
            }, 8);
        }
    }

    public destroy(): void {
        this.stopTransmission();
        this.stopAudioTone();
        if (this.audioCtx) {
            try { this.audioCtx.close(); } catch {}
            this.audioCtx = null;
        }
        this.listeners.clear();
        OpticalMorseLiFiEngine.instance = null;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const opticalMorseLiFi = OpticalMorseLiFiEngine.getInstance();

/**
 * AcousticScramblerEngine.ts — RED Acoustic Counter-Surveillance & MEMS Microphone Jammer Engine
 * 
 * Emits dynamic pink noise, voice-frequency masking, and near-ultrasonic tones (20.5 kHz)
 * to saturate non-linear MEMS microphone diaphragms and prevent acoustic eavesdropping in tactical briefs.
 */

export type ScramblerMode = 'PINK_NOISE_CHAOS' | 'ULTRASONIC_MEMS_JAMMER' | 'VOICE_MASKING_CHOPPER' | 'OFF';

export class AcousticScramblerEngine {
    private static instance: AcousticScramblerEngine | null = null;

    private audioCtx: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private sourceNode: AudioNode | null = null;
    private lfoNode: OscillatorNode | null = null;
    private isRunning: boolean = false;
    private currentMode: ScramblerMode = 'OFF';
    private volume: number = 0.5;

    private listeners: Set<(state: { mode: ScramblerMode; isRunning: boolean; volume: number }) => void> = new Set();

    private constructor() {}

    public static getInstance(): AcousticScramblerEngine {
        if (!this.instance) {
            this.instance = new AcousticScramblerEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (state: { mode: ScramblerMode; isRunning: boolean; volume: number }) => void): () => void {
        this.listeners.add(cb);
        cb(this.getState());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const s = this.getState();
        this.listeners.forEach(cb => {
            try { cb(s); } catch {}
        });
    }

    private initAudio() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioCtx = new AudioContextClass();
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = this.volume;
            this.gainNode.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    public startScrambler(mode: ScramblerMode, vol: number = this.volume) {
        if (typeof window === 'undefined') return;
        this.stopScrambler();
        this.initAudio();
        if (!this.audioCtx || !this.gainNode) return;

        this.volume = Math.max(0, Math.min(1, vol));
        this.gainNode.gain.value = this.volume;
        this.currentMode = mode;
        this.isRunning = true;

        if (mode === 'PINK_NOISE_CHAOS') {
            // Buffer de ruido rosa
            const bufferSize = this.audioCtx.sampleRate * 2;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }

            const noiseSource = this.audioCtx.createBufferSource();
            noiseSource.buffer = buffer;
            noiseSource.loop = true;
            noiseSource.connect(this.gainNode);
            noiseSource.start();
            this.sourceNode = noiseSource;

        } else if (mode === 'ULTRASONIC_MEMS_JAMMER') {
            // Tono cerca de ultrasonido modulado en 20.5 kHz
            const osc = this.audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(20500, this.audioCtx.currentTime);

            const lfo = this.audioCtx.createOscillator();
            lfo.frequency.setValueAtTime(15, this.audioCtx.currentTime); // 15 Hz modulation
            const lfoGain = this.audioCtx.createGain();
            lfoGain.gain.setValueAtTime(800, this.audioCtx.currentTime);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            osc.connect(this.gainNode);
            lfo.start();
            osc.start();

            this.sourceNode = osc;
            this.lfoNode = lfo;

        } else if (mode === 'VOICE_MASKING_CHOPPER') {
            // Ruido blanco con chopper rítmico simulando frecuencias vocales
            const bufferSize = this.audioCtx.sampleRate;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.2;
            }

            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;

            const bandpass = this.audioCtx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(1500, this.audioCtx.currentTime);
            bandpass.Q.setValueAtTime(3, this.audioCtx.currentTime);

            noise.connect(bandpass);
            bandpass.connect(this.gainNode);
            noise.start();
            this.sourceNode = noise;
        }

        this.notify();
    }

    public stopScrambler() {
        if (this.sourceNode) {
            try { (this.sourceNode as any).stop?.(); } catch {}
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        if (this.lfoNode) {
            try { this.lfoNode.stop(); } catch {}
            this.lfoNode.disconnect();
            this.lfoNode = null;
        }
        this.isRunning = false;
        this.currentMode = 'OFF';
        this.notify();
    }

    public setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        this.notify();
    }

    public getState(): { mode: ScramblerMode; isRunning: boolean; volume: number } {
        return {
            mode: this.currentMode,
            isRunning: this.isRunning,
            volume: this.volume,
        };
    }
}

export const acousticScrambler = AcousticScramblerEngine.getInstance();

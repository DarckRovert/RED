/**
 * TacticalBinauralEngine.ts — RED Tactical Binaural Brainwave Entrainment & Solfeggio Focus Engine
 * 
 * Synthesizes pure stereo binaural beats and harmonic Solfeggio frequencies via Web Audio API
 * to optimize combat alertness (Gamma 40Hz), tactical focus (Beta 18Hz), and rapid recovery (Theta 6Hz).
 */

export interface BinauralPreset {
    name: string;
    description: string;
    baseFreqHz: number;
    beatFreqHz: number;
    category: 'COMBAT_ALERT' | 'TACTICAL_FOCUS' | 'STRESS_REDUCTION' | 'POWER_NAP' | 'SOLFEGGIO';
}

export class TacticalBinauralEngine {
    private static instance: TacticalBinauralEngine | null = null;

    public static readonly PRESETS: Record<string, BinauralPreset> = {
        'GAMMA_COMBAT': {
            name: 'Gamma 40 Hz (Combate & Hiper-Alerta)',
            description: 'Máximo procesamiento sensorial, reflejos rápidos y lucidez bajo fuego.',
            baseFreqHz: 216,
            beatFreqHz: 40,
            category: 'COMBAT_ALERT'
        },
        'BETA_FOCUS': {
            name: 'Beta 18 Hz (Enfoque Táctico)',
            description: 'Resolución de problemas, cálculo balístico y análisis operacional.',
            baseFreqHz: 200,
            beatFreqHz: 18,
            category: 'TACTICAL_FOCUS'
        },
        'ALPHA_CALM': {
            name: 'Alpha 10 Hz (Calma & Antiestrés)',
            description: 'Control de pulso, reducción de adrenalina y estabilización emocional.',
            baseFreqHz: 200,
            beatFreqHz: 10,
            category: 'STRESS_REDUCTION'
        },
        'THETA_NAP': {
            name: 'Theta 6 Hz (Siesta Táctica 20m)',
            description: 'Recuperación cerebral profunda en ventanas cortas de descanso.',
            baseFreqHz: 150,
            beatFreqHz: 6,
            category: 'POWER_NAP'
        },
        'SOLFEGGIO_528': {
            name: 'Solfeggio 528 Hz (Transformación)',
            description: 'Frecuencia armónica de resonancia celular y recuperación física.',
            baseFreqHz: 528,
            beatFreqHz: 0,
            category: 'SOLFEGGIO'
        },
        'SOLFEGGIO_432': {
            name: 'Solfeggio 432 Hz (Resonancia Natural)',
            description: 'Alineación armónica matemática y reducción del ritmo cardíaco.',
            baseFreqHz: 432,
            beatFreqHz: 0,
            category: 'SOLFEGGIO'
        }
    };

    private audioCtx: AudioContext | null = null;
    private leftOsc: OscillatorNode | null = null;
    private rightOsc: OscillatorNode | null = null;
    private gainNode: GainNode | null = null;
    private currentPresetKey: string | null = null;
    private isRunning: boolean = false;
    private volume: number = 0.4;

    private listeners: Set<(s: { isRunning: boolean; activePreset: string | null; volume: number }) => void> = new Set();

    private constructor() {}

    public static getInstance(): TacticalBinauralEngine {
        if (!this.instance) {
            this.instance = new TacticalBinauralEngine();
        }
        return this.instance;
    }

    public subscribe(cb: (s: { isRunning: boolean; activePreset: string | null; volume: number }) => void): () => void {
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

    public startPreset(presetKey: string, vol: number = this.volume) {
        if (typeof window === 'undefined') return;
        this.stopPreset();
        this.initAudio();
        if (!this.audioCtx || !this.gainNode) return;

        const preset = TacticalBinauralEngine.PRESETS[presetKey];
        if (!preset) return;

        this.volume = Math.max(0, Math.min(1, vol));
        this.gainNode.gain.value = this.volume;
        this.currentPresetKey = presetKey;
        this.isRunning = true;

        const merger = this.audioCtx.createChannelMerger(2);

        // Canal Izquierdo (Base)
        this.leftOsc = this.audioCtx.createOscillator();
        this.leftOsc.type = 'sine';
        this.leftOsc.frequency.setValueAtTime(preset.baseFreqHz, this.audioCtx.currentTime);

        // Canal Derecho (Base + Beat)
        this.rightOsc = this.audioCtx.createOscillator();
        this.rightOsc.type = 'sine';
        this.rightOsc.frequency.setValueAtTime(preset.baseFreqHz + preset.beatFreqHz, this.audioCtx.currentTime);

        this.leftOsc.connect(merger, 0, 0); // Canal 0
        this.rightOsc.connect(merger, 0, 1); // Canal 1
        merger.connect(this.gainNode);

        this.leftOsc.start();
        this.rightOsc.start();

        this.notify();
    }

    public stopPreset() {
        if (this.leftOsc) {
            try { this.leftOsc.stop(); } catch {}
            this.leftOsc.disconnect();
            this.leftOsc = null;
        }
        if (this.rightOsc) {
            try { this.rightOsc.stop(); } catch {}
            this.rightOsc.disconnect();
            this.rightOsc = null;
        }
        this.isRunning = false;
        this.currentPresetKey = null;
        this.notify();
    }

    public setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        this.notify();
    }

    public getState(): { isRunning: boolean; activePreset: string | null; volume: number } {
        return {
            isRunning: this.isRunning,
            activePreset: this.currentPresetKey,
            volume: this.volume,
        };
    }
}

export const tacticalBinaural = TacticalBinauralEngine.getInstance();

/**
 * TacticalVoiceAnalyzer.ts — RED Sovereign Mesh OS
 * 
 * Motor de análisis acústico para notas de voz:
 * 1. Decodificación de audio PCM offline mediante AudioContext.
 * 2. Cálculo exacto de duración en milisegundos (superando la limitación de Chromium en WebM duration).
 * 3. Extracción de picos de amplitud reales normalizados (Waveform de 28 barras).
 */

export interface VoiceAnalysisResult {
    durationMs: number;
    waveform: number[];
}

export class TacticalVoiceAnalyzer {
    private static audioCtx: AudioContext | null = null;

    private static getAudioContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
            const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtxClass) {
                this.audioCtx = new AudioCtxClass();
            }
        }
        return this.audioCtx;
    }

    /**
     * Analiza un Blob de audio (WebM/Opus, MP4, WAV, OGG) y extrae:
     * - Duración precisa en milisegundos
     * - Vector de 28 picos de amplitud normalizados entre 0.15 y 1.0 (o alturas entre 4 y 24px)
     */
    public static async analyzeAudioBlob(
        blob: Blob,
        fallbackDurationMs: number = 0,
        targetBars: number = 28
    ): Promise<VoiceAnalysisResult> {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const ctx = this.getAudioContext();

            if (ctx && arrayBuffer.byteLength > 0) {
                // Decodificar PCM nativamente en el navegador
                const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
                    ctx.decodeAudioData(
                        arrayBuffer.slice(0),
                        (decoded) => resolve(decoded),
                        (err) => reject(err)
                    );
                });

                const rawDurationSec = audioBuffer.duration;
                const durationMs = Math.max(100, Math.round(rawDurationSec * 1000));
                const channelData = audioBuffer.getChannelData(0); // Canal 1 (mono o izq)
                const totalSamples = channelData.length;

                const waveform: number[] = [];
                const samplesPerBar = Math.floor(totalSamples / targetBars);

                let maxPeak = 0.001;
                const rawPeaks: number[] = [];

                for (let b = 0; b < targetBars; b++) {
                    const start = b * samplesPerBar;
                    const end = Math.min(start + samplesPerBar, totalSamples);
                    let sumSquares = 0;
                    let peak = 0;

                    for (let s = start; s < end; s++) {
                        const val = Math.abs(channelData[s]);
                        if (val > peak) peak = val;
                        sumSquares += val * val;
                    }

                    const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
                    // Combinación ponderada de RMS (volumen medio) y Peak (crestas vocales)
                    const energy = (rms * 0.7) + (peak * 0.3);
                    rawPeaks.push(energy);
                    if (energy > maxPeak) maxPeak = energy;
                }

                // Normalización a escala de altura de barras (4px a 24px)
                for (let b = 0; b < targetBars; b++) {
                    const normalized = rawPeaks[b] / maxPeak;
                    // Mapeo entre 4 y 24 píxeles
                    const barHeight = Math.round(4 + (normalized * 20));
                    waveform.push(Math.min(24, Math.max(4, barHeight)));
                }

                return {
                    durationMs,
                    waveform
                };
            }
        } catch (err) {
            console.warn('[TacticalVoiceAnalyzer] Fallo en decodificación acústica nativa:', err);
        }

        // Fallback determinista si decodeAudioData falla (ej. codec no soportado por AudioContext)
        return {
            durationMs: Math.max(100, fallbackDurationMs),
            waveform: this.generateFallbackWaveform(blob.size, targetBars)
        };
    }

    /**
     * Genera un perfil de onda acústica coherente basado en la huella del buffer
     */
    private static generateFallbackWaveform(seed: number, count: number = 28): number[] {
        const bars: number[] = [];
        for (let i = 0; i < count; i++) {
            const pseudoRand = Math.abs(Math.sin((seed || 42) + i * 1.618) * 10000);
            const val = pseudoRand - Math.floor(pseudoRand);
            // Curva vocal con caída en los extremos (forma de campana típica del habla humana)
            const envelope = Math.sin((i / (count - 1)) * Math.PI);
            const height = Math.round(5 + (val * 12 * envelope) + (envelope * 7));
            bars.push(Math.min(24, Math.max(4, height)));
        }
        return bars;
    }
}

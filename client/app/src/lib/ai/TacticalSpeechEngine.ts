/**
 * RED 2.0 — TacticalSpeechEngine.ts
 *
 * Motor Unificado de Síntesis de Voz (Text-to-Speech / TTS) y Reconocimiento de Voz (Speech-to-Text / STT).
 *
 * Características clave:
 * 1. Text-to-Speech (TTS):
 *    - Inicialización asíncrona de voces del sistema operativo con eventos 'voiceschanged'.
 *    - Corrección del bug crítico de Chromium / Android WebView: Keep-Alive ticker para evitar congelamiento a los 14s.
 *    - Segmentación inteligente de oraciones (<160 caracteres) para reproducción fluida sin cortes de buffer.
 *    - Mapeo automático multilingüe (es, en, fr, pt, de, ru, uk, zh, qu).
 *    - Referencia fuerte persistente anti-Garbage Collection.
 *
 * 2. Speech-to-Text (STT):
 *    - Dictado en tiempo real utilizando Web Speech API nativa.
 *    - Soporte para transcripción preliminar (interim results) y transcripción final confirmada.
 *    - Gestión robusta de eventos y auto-limpieza de recursos.
 */

export interface TTSOptions {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
}

export interface STTOptions {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onResult: (transcript: string, isFinal: boolean) => void;
    onError?: (error: any) => void;
    onEnd?: () => void;
    onStart?: () => void;
}

class TacticalSpeechEngineClass {
    private isTtsActive = false;
    private currentUtteranceQueue: SpeechSynthesisUtterance[] = [];
    private currentUtteranceRef: SpeechSynthesisUtterance | null = null;
    private keepAliveTimer: any = null;
    private voices: SpeechSynthesisVoice[] = [];
    private voicesLoaded = false;

    // STT State
    private activeRecognition: any = null;
    private isSttListening = false;

    constructor() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.initVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = () => {
                    this.initVoices();
                };
            }
        }
    }

    private initVoices(): void {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        try {
            const list = window.speechSynthesis.getVoices();
            if (list && list.length > 0) {
                this.voices = list;
                this.voicesLoaded = true;
            }
        } catch {}
    }

    /** Retorna si el motor de síntesis de voz está disponible en este entorno */
    public isTtsSupported(): boolean {
        return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    }

    /** Retorna si el reconocimiento de voz / dictado está disponible en este entorno */
    public isSttSupported(): boolean {
        if (typeof window === 'undefined') return false;
        return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    }

    /** Obtiene la lista de voces disponibles */
    public getVoices(): SpeechSynthesisVoice[] {
        if (!this.voicesLoaded || this.voices.length === 0) {
            this.initVoices();
        }
        return this.voices;
    }

    /** Encuentra la mejor voz disponible para el código de idioma solicitado */
    private findBestVoice(langCode: string = 'es'): SpeechSynthesisVoice | null {
        const voices = this.getVoices();
        if (!voices || voices.length === 0) return null;

        const clean = langCode.toLowerCase().replace('_', '-');
        const prefix = clean.split('-')[0];

        // 1. Coincidencia exacta (ej. es-ES, en-US)
        const exact = voices.find(v => v.lang.toLowerCase().replace('_', '-') === clean);
        if (exact) return exact;

        // 2. Coincidencia por prefijo (ej. es, en)
        const prefixMatch = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
        if (prefixMatch) return prefixMatch;

        // 3. Coincidencia predeterminada del sistema
        const defaultVoice = voices.find(v => v.default);
        if (defaultVoice) return defaultVoice;

        return voices[0] || null;
    }

    /** Divide un texto largo en fragmentos naturales por puntuación para prevenir timeouts de buffer */
    private splitTextIntoChunks(text: string, maxLength: number = 160): string[] {
        if (!text) return [];
        const clean = text.replace(/[*_#`~[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
        if (clean.length <= maxLength) return [clean];

        const sentences = clean.split(/(?<=[.!?;\n])\s+/);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + ' ' + sentence).trim().length <= maxLength) {
                currentChunk = (currentChunk + ' ' + sentence).trim();
            } else {
                if (currentChunk) chunks.push(currentChunk);
                if (sentence.length <= maxLength) {
                    currentChunk = sentence;
                } else {
                    // Si una sola oración excede el máximo, dividir por comas o espacios
                    const subParts = sentence.split(/(?<=[,])\s+/);
                    for (const sub of subParts) {
                        if ((currentChunk + ' ' + sub).trim().length <= maxLength) {
                            currentChunk = (currentChunk + ' ' + sub).trim();
                        } else {
                            if (currentChunk) chunks.push(currentChunk);
                            currentChunk = sub;
                        }
                    }
                }
            }
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks.length > 0 ? chunks : [clean];
    }

    /**
     * Reproduce un texto mediante Síntesis de Voz (TTS) multilingüe de alta fidelidad.
     */
    public speak(text: string, options: TTSOptions = {}): void {
        if (!this.isTtsSupported() || !text.trim()) {
            options.onError?.(new Error('Síntesis de voz no disponible o texto vacío'));
            return;
        }

        this.stopSpeaking();
        this.isTtsActive = true;

        const lang = options.lang || 'es-ES';
        const rate = options.rate ?? 1.0;
        const pitch = options.pitch ?? 1.0;
        const volume = options.volume ?? 1.0;

        const chunks = this.splitTextIntoChunks(text);
        const voice = this.findBestVoice(lang);

        let chunkIndex = 0;

        const playNextChunk = () => {
            if (!this.isTtsActive || chunkIndex >= chunks.length) {
                this.stopSpeaking();
                options.onEnd?.();
                return;
            }

            const currentIdx = chunkIndex++;
            const chunkText = chunks[currentIdx];
            const utterance = new SpeechSynthesisUtterance(chunkText);
            this.currentUtteranceRef = utterance; // Referencia fuerte anti-GC

            utterance.lang = lang;
            utterance.rate = rate;
            utterance.pitch = pitch;
            utterance.volume = volume;
            if (voice) {
                utterance.voice = voice;
            }

            utterance.onstart = () => {
                if (currentIdx === 0) {
                    options.onStart?.();
                }
            };

            utterance.onend = () => {
                if (this.isTtsActive) {
                    playNextChunk();
                }
            };

            utterance.onerror = (e) => {
                // Si fue cancelado intencionalmente, no disparar error
                if (e.error === 'canceled' || e.error === 'interrupted') {
                    return;
                }
                console.warn('[TacticalSpeechEngine] Error en reproducción de fragmento:', e);
                options.onError?.(e);
                this.stopSpeaking();
            };

            try {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
                window.speechSynthesis.speak(utterance);
            } catch (err) {
                console.error('[TacticalSpeechEngine] Fallo al invocar speechSynthesis.speak:', err);
                options.onError?.(err);
                this.stopSpeaking();
            }
        };

        // Keep-Alive Ticker para navegadores basados en Chromium / Android WebView
        this.startKeepAlive();
        playNextChunk();
    }

    private startKeepAlive(): void {
        this.stopKeepAlive();
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        this.keepAliveTimer = setInterval(() => {
            if (this.isTtsActive && window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            }
        }, 10000);
    }

    private stopKeepAlive(): void {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    /** Detiene inmediatamente cualquier síntesis de voz en reproducción */
    public stopSpeaking(): void {
        this.isTtsActive = false;
        this.stopKeepAlive();
        this.currentUtteranceRef = null;
        this.currentUtteranceQueue = [];
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
            } catch {}
        }
    }

    /** Indica si actualmente se está reproduciendo audio TTS */
    public isSpeaking(): boolean {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
        return this.isTtsActive || window.speechSynthesis.speaking;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SPEECH-TO-TEXT (STT / RECONOCIMIENTO DE VOZ & DICTADO)
    // ─────────────────────────────────────────────────────────────────────────────

    /** Inicia el reconocimiento de voz para dictado en tiempo real */
    public startListening(options: STTOptions): boolean {
        if (!this.isSttSupported()) {
            options.onError?.(new Error('Reconocimiento de voz no soportado en este dispositivo'));
            return false;
        }

        this.stopListening();

        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        try {
            const recognition = new SpeechRec();
            recognition.lang = options.lang || 'es-ES';
            recognition.continuous = options.continuous ?? false;
            recognition.interimResults = options.interimResults ?? true;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                this.isSttListening = true;
                options.onStart?.();
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const trans = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += trans;
                    } else {
                        interimTranscript += trans;
                    }
                }

                if (finalTranscript) {
                    options.onResult(finalTranscript.trim(), true);
                } else if (interimTranscript) {
                    options.onResult(interimTranscript.trim(), false);
                }
            };

            recognition.onerror = (event: any) => {
                console.warn('[TacticalSpeechEngine] Error STT:', event.error);
                this.isSttListening = false;
                options.onError?.(event);
            };

            recognition.onend = () => {
                this.isSttListening = false;
                options.onEnd?.();
            };

            this.activeRecognition = recognition;
            recognition.start();
            return true;
        } catch (err) {
            console.error('[TacticalSpeechEngine] Error inicializando SpeechRecognition:', err);
            this.isSttListening = false;
            options.onError?.(err);
            return false;
        }
    }

    /** Detiene el dictado por voz en curso */
    public stopListening(): void {
        if (this.activeRecognition) {
            try {
                this.activeRecognition.stop();
            } catch {}
            this.activeRecognition = null;
        }
        this.isSttListening = false;
    }

    /** Indica si el micrófono está escuchando activamente */
    public isListening(): boolean {
        return this.isSttListening;
    }
}

export const TacticalSpeechEngine = new TacticalSpeechEngineClass();

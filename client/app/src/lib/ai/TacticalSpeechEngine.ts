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

    // STT State & Multi-Tier Engine Handlers
    private activeRecognition: any = null;
    private isSttListening = false;
    private isNativeMode = false;
    private isFallbackMode = false;
    private nativeResultListener: any = null;
    private nativeErrorListener: any = null;
    private nativeEndListener: any = null;
    private nativeStartListener: any = null;
    private mediaRecorder: MediaRecorder | null = null;
    private mediaStream: MediaStream | null = null;
    private audioChunks: Blob[] = [];

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

    /**
     * Retorna si el reconocimiento de voz / dictado está disponible en este entorno.
     * Soporta:
     * 1. Android Nativo (Capacitor RedNode SpeechRecognizer)
     * 2. Web Speech API estándar (window.SpeechRecognition / webkitSpeechRecognition)
     * 3. Fallback de captura de micrófono para inferencia Whisper (navigator.mediaDevices.getUserMedia)
     */
    public isSttSupported(): boolean {
        if (typeof window === 'undefined') return false;
        const hasWebSpeech = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
        const hasCapacitor = !!((window as any).Capacitor?.Plugins?.RedNode);
        const hasMediaDevices = typeof navigator !== 'undefined' && !!(navigator?.mediaDevices?.getUserMedia);
        return hasWebSpeech || hasCapacitor || hasMediaDevices;
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
    // SPEECH-TO-TEXT (STT / RECONOCIMIENTO DE VOZ & DICTADO RESILIENTE MULTI-CAPA)
    // ─────────────────────────────────────────────────────────────────────────────

    private cleanNativeListeners(): void {
        if (this.nativeStartListener) {
            try { this.nativeStartListener.remove(); } catch {}
            this.nativeStartListener = null;
        }
        if (this.nativeResultListener) {
            try { this.nativeResultListener.remove(); } catch {}
            this.nativeResultListener = null;
        }
        if (this.nativeErrorListener) {
            try { this.nativeErrorListener.remove(); } catch {}
            this.nativeErrorListener = null;
        }
        if (this.nativeEndListener) {
            try { this.nativeEndListener.remove(); } catch {}
            this.nativeEndListener = null;
        }
    }

    /**
     * Inicia el reconocimiento de voz para dictado en tiempo real.
     * Arquitectura tri-capa:
     * Nivel 1: Android Nativo (Capacitor RedNode SpeechRecognizer)
     * Nivel 2: Web Speech API estándar (Chrome/Edge desktop)
     * Nivel 3: Fallback Whisper Neuronal con captura MediaRecorder
     */
    public startListening(options: STTOptions): boolean {
        if (!this.isSttSupported()) {
            options.onError?.(new Error('Reconocimiento de voz no soportado en este dispositivo'));
            return false;
        }

        this.stopListening();
        const lang = options.lang || 'es-ES';

        // ── Nivel 1: Android Nativo vía Capacitor RedNode ───────────────────────
        const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
        const isAndroid = cap && (cap.isNativePlatform?.() || cap.getPlatform?.() === 'android');
        const redNode = cap?.Plugins?.RedNode;

        if (isAndroid && redNode && typeof redNode.startSpeechRecognition === 'function') {
            this.isNativeMode = true;
            this.cleanNativeListeners();

            Promise.all([
                redNode.addListener('speechStart', () => {
                    this.isSttListening = true;
                    options.onStart?.();
                }),
                redNode.addListener('speechResult', (data: { transcript: string; isFinal: boolean }) => {
                    if (data && typeof data.transcript === 'string') {
                        options.onResult(data.transcript, !!data.isFinal);
                    }
                }),
                redNode.addListener('speechError', (err: any) => {
                    console.warn('[TacticalSpeechEngine] Android Native STT error:', err);
                    this.isSttListening = false;
                    options.onError?.(err);
                }),
                redNode.addListener('speechEnd', () => {
                    this.isSttListening = false;
                    options.onEnd?.();
                })
            ]).then(([startL, resL, errL, endL]) => {
                this.nativeStartListener = startL;
                this.nativeResultListener = resL;
                this.nativeErrorListener = errL;
                this.nativeEndListener = endL;

                redNode.startSpeechRecognition({ lang, preferOffline: true }).catch((err: any) => {
                    console.warn('[TacticalSpeechEngine] Error al iniciar RedNode SpeechRecognizer:', err);
                    this.cleanNativeListeners();
                    this.isNativeMode = false;
                    this.startWebOrFallbackStt(options);
                });
            }).catch(() => {
                this.isNativeMode = false;
                this.startWebOrFallbackStt(options);
            });

            this.isSttListening = true;
            return true;
        }

        // ── Nivel 2 y 3: Web Speech API o Fallback Neuronal ───────────────────────
        return this.startWebOrFallbackStt(options);
    }

    private startWebOrFallbackStt(options: STTOptions): boolean {
        const SpeechRec = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

        if (SpeechRec) {
            try {
                const recognition = new SpeechRec();
                recognition.lang = options.lang || 'es-ES';
                recognition.continuous = true;
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
                        const item = event.results[i];
                        const trans = item[0]?.transcript || '';
                        if (item.isFinal) {
                            finalTranscript += trans;
                        } else {
                            interimTranscript += trans;
                        }
                    }

                    if (finalTranscript.trim()) {
                        options.onResult(finalTranscript.trim(), true);
                    } else if (interimTranscript.trim()) {
                        options.onResult(interimTranscript.trim(), false);
                    }
                };

                recognition.onerror = (event: any) => {
                    if (event.error === 'no-speech') {
                        return;
                    }
                    console.warn('[TacticalSpeechEngine] Error Web Speech STT:', event.error);
                    if (event.error !== 'aborted') {
                        options.onError?.(event);
                    }
                    this.isSttListening = false;
                };

                recognition.onend = () => {
                    if (this.isSttListening) {
                        try {
                            recognition.start();
                            return;
                        } catch {}
                    }
                    this.isSttListening = false;
                    options.onEnd?.();
                };

                this.activeRecognition = recognition;
                recognition.start();
                this.isSttListening = true;
                return true;
            } catch (err) {
                console.warn('[TacticalSpeechEngine] Fallo al inicializar Web Speech, activando fallback de micrófono:', err);
            }
        }

        // ── Nivel 3: MediaRecorder + Local Whisper ASR Fallback ───────────────────
        return this.startMediaRecorderFallback(options);
    }

    private startMediaRecorderFallback(options: STTOptions): boolean {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            options.onError?.(new Error('Ningún motor de audio o micrófono disponible para dictado'));
            return false;
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            this.mediaStream = stream;
            this.isFallbackMode = true;
            this.isSttListening = true;
            this.audioChunks = [];
            options.onStart?.();

            let mimeType: string | undefined = undefined;
            if (typeof MediaRecorder !== 'undefined') {
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
                else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
                else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            }

            const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            this.mediaRecorder = mr;

            mr.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            mr.onstop = async () => {
                const recordedBlob = new Blob(this.audioChunks, { type: mimeType || 'audio/webm' });
                this.audioChunks = [];
                if (this.mediaStream) {
                    this.mediaStream.getTracks().forEach(t => t.stop());
                    this.mediaStream = null;
                }
                this.mediaRecorder = null;
                this.isFallbackMode = false;
                this.isSttListening = false;

                if (recordedBlob.size > 1000) {
                    try {
                        const { LocalAIEngine } = await import('./localAiEngine');
                        const res = await LocalAIEngine.transcribeAudio(recordedBlob);
                        if (res && res.text && res.text.trim()) {
                            options.onResult(res.text.trim(), true);
                        }
                    } catch (err) {
                        console.warn('[TacticalSpeechEngine] Fallback transcription error:', err);
                        options.onError?.(err);
                    }
                }
                options.onEnd?.();
            };

            mr.start(250);
        }).catch((err) => {
            console.error('[TacticalSpeechEngine] Permiso de micrófono denegado para fallback:', err);
            this.isSttListening = false;
            this.isFallbackMode = false;
            options.onError?.(err);
        });

        return true;
    }

    /** Detiene el dictado por voz en curso en cualquiera de los niveles activos */
    public stopListening(): void {
        this.isSttListening = false;

        // 1. Android Nativo
        if (this.isNativeMode) {
            try {
                const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
                cap?.Plugins?.RedNode?.stopSpeechRecognition?.().catch(() => {});
            } catch {}
            this.cleanNativeListeners();
            this.isNativeMode = false;
        }

        // 2. Web Speech API
        if (this.activeRecognition) {
            try {
                this.activeRecognition.stop();
            } catch {}
            this.activeRecognition = null;
        }

        // 3. Fallback MediaRecorder
        if (this.isFallbackMode && this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            try {
                this.mediaRecorder.stop();
            } catch {}
        } else if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
            this.isFallbackMode = false;
        }
    }

    /** Indica si el micrófono está escuchando activamente */
    public isListening(): boolean {
        return this.isSttListening;
    }
}

export const TacticalSpeechEngine = new TacticalSpeechEngineClass();

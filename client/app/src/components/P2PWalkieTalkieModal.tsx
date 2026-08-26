"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { sendVoiceBurst, getVoiceBursts, deleteVoiceBurst, VoiceBurst } from "../lib/api";
import { PayloadCompressor } from "../lib/PayloadCompressor";
import { LowBitrateVocoder } from "../lib/LowBitrateVocoder";
import { SoundMeshEngine } from "../lib/SoundMeshEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";
import { EmptyState } from "./ui/EmptyState";

type WalkieTab = "ptt" | "bursts";

export const P2PWalkieTalkieModal: React.FC = () => {
    const { navigate, identity } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<WalkieTab>("ptt");
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingStop, setIsProcessingStop] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [bursts, setBursts] = useState<VoiceBurst[]>([]);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
    const [vadLevel, setVadLevel] = useState<number>(0);
    const [playingBurstId, setPlayingBurstId] = useState<string | null>(null);
    const [isLoadingBursts, setIsLoadingBursts] = useState(false);
    const [burstsError, setBurstsError] = useState<string | null>(null);
    const [useTacticalVocoder, setUseTacticalVocoder] = useState<boolean>(true);
    const [acousticBroadcast, setAcousticBroadcast] = useState<boolean>(false);

    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const activeAudioBufferNodeRef = useRef<AudioBufferSourceNode | null>(null);

    const myNickname = identity?.nickname || "Operador RED";

    // Helper object to safely interact with VoiceRecorder without returning the proxy from async functions
    const NativeAudio = {
        async requestPermission(): Promise<boolean> {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { VoiceRecorder } = await import("capacitor-voice-recorder");
                    const res = await VoiceRecorder.requestAudioRecordingPermission();
                    return !!res.value;
                }
            } catch {}
            return false;
        },
        async start(): Promise<boolean> {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { VoiceRecorder } = await import("capacitor-voice-recorder");
                    const res = await VoiceRecorder.startRecording();
                    return !!res.value;
                }
            } catch {}
            return false;
        },
        async stop(): Promise<{ base64: string; durationMs: number } | null> {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { VoiceRecorder } = await import("capacitor-voice-recorder");
                    const res = await VoiceRecorder.stopRecording();
                    if (res.value && res.value.recordDataBase64) {
                        return { base64: res.value.recordDataBase64, durationMs: res.value.msDuration || 0 };
                    }
                }
            } catch {}
            return null;
        }
    };

    // Request microphone permission & initialize DSP Audio Context
    useEffect(() => {
        const requestPerm = async () => {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const granted = await NativeAudio.requestPermission();
                    setPermissionGranted(granted);
                } else {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                    setPermissionGranted(true);
                }
            } catch {
                setPermissionGranted(false);
                setStatusMsg("⚠️ Permiso de micrófono denegado. Actívalo en Configuración > Aplicaciones > RED.");
            }
        };
        requestPerm();
    }, []);

    const loadBursts = useCallback(async () => {
        setIsLoadingBursts(true);
        setBurstsError(null);
        try {
            const list = await getVoiceBursts();
            setBursts(Array.isArray(list) ? list : []);
        } catch (e: any) {
            console.error("Voice bursts fetch error:", e);
            setBurstsError(e.message || "Fallo al cargar ráfagas de voz.");
            setBursts([]);
        } finally {
            setIsLoadingBursts(false);
        }
    }, []);

    useEffect(() => {
        loadBursts();
        const interval = setInterval(loadBursts, 3000);
        return () => clearInterval(interval);
    }, [loadBursts]);

    // Recording timer & VAD Voice Activity Detector Loop
    useEffect(() => {
        let timer: any;
        let animationFrame: any;

        if (isRecording) {
            timer = setInterval(() => setRecordingTime((t) => t + 1), 1000);

            const updateVad = () => {
                if (analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
                    setVadLevel(Math.min(100, Math.round(avg * 1.6)));
                }
                animationFrame = requestAnimationFrame(updateVad);
            };
            updateVad();
        } else {
            setRecordingTime(0);
            setVadLevel(0);
        }
        return () => {
            clearInterval(timer);
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [isRecording]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleStartRecording = async () => {
        if (!permissionGranted) {
            toast.error("Permiso de micrófono no otorgado.");
            return;
        }
        setStatusMsg(null);
        setCompressionInfo(null);

        try {
            // Audio context analyzer for VAD
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            audioChunksRef.current = [];
            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mr.start(100);
            setIsRecording(true);
        } catch (e: any) {
            console.error("Recording start error:", e);
            setStatusMsg("Error al iniciar captura de audio.");
        }
    };

    const handleToggleRecording = () => {
        if (isProcessingStop) return;
        if (isRecording) {
            handleStopRecording(false);
        } else {
            handleStartRecording();
        }
    };

    const handleStopRecording = async (isEmergency: boolean = false) => {
        if (!isRecording || isProcessingStop) return;
        setIsProcessingStop(true);
        setIsRecording(false);

        if (audioContextRef.current) {
            try { audioContextRef.current.close(); } catch {}
            audioContextRef.current = null;
        }
        analyserRef.current = null;

        try {
            let base64Audio = "";
            const durationMs = Math.max(1000, recordingTime * 1000);

            if (mediaRecorderRef.current) {
                const mr = mediaRecorderRef.current;
                if (mr.state !== "inactive") {
                    mr.stop();
                    mr.stream.getTracks().forEach(t => t.stop());
                    // Timeout fallback to avoid deadlocks if onstop never fires
                    await Promise.race([
                        new Promise((resolve) => {
                            mr.onstop = resolve;
                        }),
                        new Promise((resolve) => setTimeout(resolve, 500))
                    ]);
                }

                if (audioChunksRef.current.length > 0) {
                    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                    const reader = new FileReader();
                    base64Audio = await new Promise((resolve) => {
                        reader.onloadend = () => {
                            const res = reader.result as string;
                            resolve(res.split(",")[1] || "");
                        };
                        reader.readAsDataURL(blob);
                    });
                }
            }

            if (!base64Audio || base64Audio.length < 50) {
                setStatusMsg("⚠️ Ráfaga de audio demasiado corta.");
                setIsProcessingStop(false);
                return;
            }

            let finalPayload = base64Audio;

            if (useTacticalVocoder) {
                try {
                    // Decode WebM into PCM AudioBuffer and compress with LowBitrateVocoder
                    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                    const dCtx = new AudioCtx();
                    const binStr = atob(base64Audio);
                    const bytes = new Uint8Array(binStr.length);
                    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                    const decodedBuffer = await dCtx.decodeAudioData(bytes.buffer);
                    const voc = LowBitrateVocoder.compressAudioBuffer(decodedBuffer);
                    dCtx.close().catch(() => {});

                    finalPayload = `VOX:${voc.base64}`;
                    setCompressionInfo(`Vocoder 8kHz IMA-ADPCM: ${base64Audio.length}B → ${voc.compressedSizeBytes}B (-${voc.compressionRatioPercent}%)`);

                    if (acousticBroadcast) {
                        toast.info("🔊 Transmitiendo ráfaga acústica ultrasónica...");
                        SoundMeshEngine.transmitVocoderVoiceBurst(voc.base64).catch(() => {});
                    }
                } catch (err) {
                    console.warn("Vocoder DSP fallback to WebM:", err);
                    const rawBytes = base64Audio.length;
                    const compressed = await PayloadCompressor.compress(base64Audio);
                    const compRatio = ((1 - compressed.length / rawBytes) * 100).toFixed(0);
                    setCompressionInfo(`Opus Pack: ${rawBytes}B → ${compressed.length}B (-${compRatio}%)`);
                    finalPayload = base64Audio;
                }
            } else {
                const rawBytes = base64Audio.length;
                const compressed = await PayloadCompressor.compress(base64Audio);
                const compRatio = ((1 - compressed.length / rawBytes) * 100).toFixed(0);
                setCompressionInfo(`Opus Pack: ${rawBytes}B → ${compressed.length}B (-${compRatio}%)`);
            }

            const res = await sendVoiceBurst({
                audio_opus_b64: finalPayload,
                duration_seconds: Math.max(1, Math.round(durationMs / 1000)),
                sender_name: myNickname,
            });

            if (res && res.ok) {
                TacticalAudioEngine.playRogerBeep();
                setTimeout(() => TacticalAudioEngine.playSquelchTail(), 100);
                toast.success(isEmergency ? "🚨 RÁFAGA DE EMERGENCIA EMITIDA" : "🎙️ Ráfaga PTT transmitida por la malla");
                await loadBursts();
            } else {
                toast.error("Error al propagar ráfaga en la red.");
            }
        } catch (e: any) {
            console.error("Recording stop error:", e);
            setStatusMsg("Fallo al procesar audio grabado.");
        } finally {
            setIsProcessingStop(false);
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
        }
    };

    const handlePlayBurst = async (burst: VoiceBurst) => {
        const id = burst.id;

        // Stop active AudioBufferSourceNode if running
        if (activeAudioBufferNodeRef.current) {
            try { activeAudioBufferNodeRef.current.stop(); } catch {}
            activeAudioBufferNodeRef.current = null;
        }

        const currentAudio = audioRefs.current.get(id);

        if (playingBurstId === id) {
            if (currentAudio) currentAudio.pause();
            setPlayingBurstId(null);
            return;
        }

        // Pause any other playing HTMLAudioElement
        if (playingBurstId) {
            const prev = audioRefs.current.get(playingBurstId);
            if (prev) prev.pause();
        }

        const audioData = burst.audio_base64 || "";
        if (!audioData) {
            toast.error("Ráfaga sin datos de audio disponibles");
            return;
        }

        // Check if Vocoder compressed audio
        if (audioData.startsWith("VOX:")) {
            try {
                const vocoderBase64 = audioData.slice(4);
                const bytes = LowBitrateVocoder.base64ToBytes(vocoderBase64);
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                const ctx = new AudioCtx();
                const audioBuffer = LowBitrateVocoder.createAudioBufferFromEncoded(ctx, bytes);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.onended = () => {
                    setPlayingBurstId(null);
                    ctx.close().catch(() => {});
                };
                activeAudioBufferNodeRef.current = source;
                source.start(0);
                setPlayingBurstId(id);
                return;
            } catch (e) {
                console.error("Vocoder playback error:", e);
                toast.error("Error al sintetizar audio de Vocoder");
            }
        }

        if (!currentAudio) {
            const audio = new Audio(`data:audio/webm;base64,${audioData}`);
            audio.onended = () => setPlayingBurstId(null);
            audioRefs.current.set(id, audio);
            audio.play();
            setPlayingBurstId(id);
        } else {
            currentAudio.currentTime = 0;
            currentAudio.play();
            setPlayingBurstId(id);
        }
    };

    const handleDeleteBurst = async (id: string) => {
        try {
            await deleteVoiceBurst(id);
            setBursts(prev => prev.filter(b => b.id !== id));
            toast.info("Ráfaga de voz eliminada de Sled DB");
        } catch {
            toast.error("Error al eliminar ráfaga");
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #FF7043 0%, #E64A19 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(255,112,67,0.35)"
                    }}>🎙️</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t('walkie.title')}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t('walkie.subtitle')}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title={t('common.close')}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("ptt")}
                    className={activeTab === "ptt" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🎙️ {t('walkie.live_tab')}
                </button>
                <button
                    onClick={() => setActiveTab("bursts")}
                    className={activeTab === "bursts" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📻 {t('walkie.bursts_tab')} ({bursts.length})
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: TRANSMISOR PTT ───────────────────────────────── */}
                    {activeTab === "ptt" && (
                        <div className="card-tactical animate-enter" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                    Canal de Ráfagas de Voz Half-Duplex
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Toca para hablar. Toca de nuevo para comprimir y emitir.
                                </div>
                            </div>

                            {/* VAD Dynamic Equalizer Level Bar */}
                            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                    <span>VAD MODULATION</span>
                                    <span>{vadLevel}% LEVEL</span>
                                </div>
                                <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${vadLevel}%`, height: "100%",
                                        background: vadLevel > 70 ? "var(--accent-crimson-bright)" : vadLevel > 30 ? "var(--accent-emerald)" : "var(--accent-cyan)",
                                        transition: "width 0.05s linear"
                                    }} />
                                </div>
                            </div>

                            {/* Botón PTT Circular Táctico */}
                            <div style={{ position: "relative", width: "180px", height: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isRecording && (
                                    <div style={{
                                        position: "absolute", inset: -12, borderRadius: "50%",
                                        border: "2px solid var(--accent-crimson)",
                                        animation: "pulseGlowCrimson 1.5s infinite"
                                    }} />
                                )}

                                <button
                                    onClick={handleToggleRecording}
                                    disabled={isProcessingStop}
                                    style={{
                                        width: "150px", height: "150px", borderRadius: "50%",
                                        background: isRecording
                                            ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)"
                                            : "linear-gradient(135deg, #1E1E34 0%, #121222 100%)",
                                        border: isRecording ? "3px solid #FFF" : "2px solid rgba(255,255,255,0.15)",
                                        boxShadow: isRecording
                                            ? "0 0 35px rgba(232,33,58,0.6)"
                                            : "0 10px 30px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.1)",
                                        color: "#FFF", display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center", gap: "6px",
                                        cursor: isProcessingStop ? "wait" : "pointer", userSelect: "none", touchAction: "none",
                                        opacity: isProcessingStop ? 0.7 : 1
                                    }}
                                >
                                    <span style={{ fontSize: "2.4rem" }}>
                                        {isProcessingStop ? "⏳" : (isRecording ? "⏹️" : "🎙️")}
                                    </span>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 900, letterSpacing: "0.5px" }}>
                                        {isProcessingStop ? "PROCESANDO" : (isRecording ? `${recordingTime}s REC (STOP)` : "TAP PTT")}
                                    </span>
                                </button>
                            </div>

                            {/* Selector de Códec Táctico y Módem Acústico */}
                            <div style={{
                                width: "100%", padding: "12px 14px", borderRadius: "12px",
                                background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)",
                                display: "flex", flexDirection: "column", gap: "10px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                            🎙️ Modo Códec: {useTacticalVocoder ? "Vocoder Militar 8kHz IMA-ADPCM" : "Estándar Opus/WebM"}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                            {useTacticalVocoder ? "1.6–3.2 kbps · Optimizado para LoRaWAN y Módem Acústico (<800B)" : "32–64 kbps · Mayor fidelidad para redes Wi-Fi/Ethernet"}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setUseTacticalVocoder(!useTacticalVocoder)}
                                        className="btn-ghost"
                                        style={{
                                            padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700,
                                            border: useTacticalVocoder ? "1px solid var(--accent-emerald)" : "1px solid var(--glass-border)",
                                            color: useTacticalVocoder ? "var(--accent-emerald)" : "var(--text-muted)"
                                        }}
                                    >
                                        {useTacticalVocoder ? "ACTIVO" : "OFF"}
                                    </button>
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                                            🔊 Emisión Acústica Ultrasónica SoundMesh
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                            Emite el tono FSK (18.5kHz-20.5kHz) por el altavoz físico
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setAcousticBroadcast(!acousticBroadcast)}
                                        className="btn-ghost"
                                        style={{
                                            padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700,
                                            border: acousticBroadcast ? "1px solid var(--accent-cyan)" : "1px solid var(--glass-border)",
                                            color: acousticBroadcast ? "var(--accent-cyan)" : "var(--text-muted)"
                                        }}
                                    >
                                        {acousticBroadcast ? "ON" : "OFF"}
                                    </button>
                                </div>
                            </div>

                            {/* Botón de Ráfaga de Emergencia Instantánea */}
                            <button
                                onClick={() => {
                                    handleStartRecording();
                                    setTimeout(() => handleStopRecording(true), 3000);
                                }}
                                disabled={isRecording}
                                className="btn-tactical-secondary"
                                style={{ width: "100%", padding: "10px", borderColor: "rgba(232,33,58,0.4)", color: "var(--accent-crimson-bright)" }}
                            >
                                🚨 RÁFAGA AUTOMÁTICA SOS (3s)
                            </button>

                            {/* Mensajes de Estado */}
                            {statusMsg && (
                                <div style={{ fontSize: "0.78rem", color: "var(--accent-crimson-bright)", textAlign: "center" }}>
                                    {statusMsg}
                                </div>
                            )}

                            {compressionInfo && (
                                <div className="badge-tactical badge-tactical-emerald animate-pop">
                                    ⚡ {compressionInfo}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TAB 2: RÁFAGAS EN MALLA ─────────────────────────────── */}
                    {activeTab === "bursts" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                        📻 Ráfagas de Voz Recibidas en Malla
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Historial de transmisiones de audio persistidas en Sled DB
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald">SLED PERSISTED</span>
                            </div>

                            {isLoadingBursts ? (
                                <SkeletonCard count={2} />
                            ) : burstsError ? (
                                <ErrorBanner message={burstsError} onRetry={loadBursts} />
                            ) : bursts.length === 0 ? (
                                <EmptyState 
                                    title="Sin Ráfagas de Audio" 
                                    description="No se han recibido notas de voz PTT en la red malla aún." 
                                    icon="📻" 
                                />
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {bursts.map((b) => (
                                        <div
                                            key={b.id}
                                            className="card-tactical"
                                            style={{
                                                padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                borderLeft: b.is_emergency ? "4px solid var(--accent-crimson)" : "4px solid var(--accent-cyan)"
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <button
                                                    onClick={() => handlePlayBurst(b)}
                                                    className="btn-icon"
                                                    style={{
                                                        width: 40, height: 40,
                                                        background: playingBurstId === b.id ? "var(--accent-emerald)" : "var(--glass-bg)",
                                                        color: playingBurstId === b.id ? "#000" : "#fff"
                                                    }}
                                                >
                                                    {playingBurstId === b.id ? "⏸️" : "▶️"}
                                                </button>

                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <strong style={{ fontSize: "0.88rem", color: b.is_emergency ? "var(--accent-crimson-bright)" : "var(--text-primary)" }}>
                                                            {b.is_emergency ? "🚨 [SOS] " : "🎙️ "}{b.sender_name}
                                                        </strong>
                                                        <span className="badge-tactical" style={{ fontSize: "0.68rem" }}>
                                                            {((b.duration_ms || (b.duration_seconds ? b.duration_seconds * 1000 : 3000)) / 1000).toFixed(1)}s
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", marginTop: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                                                        {new Date(b.timestamp).toLocaleTimeString()} · Sled DB Stored
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleDeleteBurst(b.id)}
                                                className="btn-icon"
                                                title="Eliminar de Sled"
                                                style={{ width: 32, height: 32, color: "var(--accent-crimson-bright)" }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

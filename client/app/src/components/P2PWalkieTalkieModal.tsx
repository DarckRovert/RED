"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { sendVoiceBurst, getVoiceBursts, deleteVoiceBurst, VoiceBurst } from "../lib/api";
import { LowBitrateVocoder } from "../lib/LowBitrateVocoder";
import { SoundMeshEngine } from "../lib/SoundMeshEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { AudioContextManager } from "../lib/audio/AudioContextManager";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { meshRouter } from "../lib/mesh/meshRouter";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";
import { EmptyState } from "./ui/EmptyState";

type WalkieTab = "ptt" | "bursts" | "rf";
type PttMode = "hold" | "toggle";

interface TacticalChannel {
    id: string;
    name: string;
    freq: string;
    color: string;
}

const TACTICAL_CHANNELS: TacticalChannel[] = [
    { id: "#general", name: "CANAL GENERAL", freq: "446.006 MHz · CH1", color: "#00E5FF" },
    { id: "#operaciones", name: "OPERACIONES", freq: "446.018 MHz · CH2", color: "#00E676" },
    { id: "#emergencias", name: "EMERGENCIAS SOS", freq: "446.031 MHz · CH3", color: "#FF3355" },
    { id: "#recon", name: "EXPLORACIÓN TÁCTICA", freq: "446.043 MHz · CH4", color: "#FFB300" }
];

export const P2PWalkieTalkieModal: React.FC = () => {
    const { identity, goBack, activeVoiceBursts, setVoiceBursts, removeVoiceBurst, addVoiceBurst } = useRedStore();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<WalkieTab>("ptt");
    const [pttMode, setPttMode] = useState<PttMode>("toggle");
    const [selectedChannel, setSelectedChannel] = useState<string>("#general");

    const [isRecording, setIsRecording] = useState(false);
    const [isProcessingStop, setIsProcessingStop] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [compressionTelemetry, setCompressionTelemetry] = useState<{
        bytes: number;
        reduction: number;
        bitrateKbps: number;
    } | null>(null);
    const [vadLevel, setVadLevel] = useState<number>(0);
    const [playingBurstId, setPlayingBurstId] = useState<string | null>(null);
    const [isLoadingBursts, setIsLoadingBursts] = useState(false);
    const [burstsError, setBurstsError] = useState<string | null>(null);
    const [useTacticalVocoder, setUseTacticalVocoder] = useState<boolean>(true);
    const [vocoderMode, setVocoderMode] = useState<"lpc" | "adpcm">("lpc");
    const [acousticBroadcast, setAcousticBroadcast] = useState<boolean>(false);
    const [isTransmittingAcoustic, setIsTransmittingAcoustic] = useState<boolean>(false);

    const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
    const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const webStreamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const holdTimerRef = useRef<any>(null);

    const myNickname = identity?.nickname || "Operador RED";

    // ── Capacitor Native Audio Fallback Gateway ──────────────────────────
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

    // ── 1. Interceptor de Hardware Físico LIFO (BackHandlerRegistry) ────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (isRecording) {
                // Si está transmitiendo, abortar grabación sin emitir basura y proteger el estado
                handleAbortRecording();
                return true;
            }
            if (playingBurstId) {
                handleStopPlayback();
                return true;
            }
            if (activeTab !== "ptt") {
                TacticalAudioEngine.playTap();
                setActiveTab("ptt");
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return unregister;
    }, [isRecording, playingBurstId, activeTab, goBack]);

    // ── 2. Verificación y Solicitud de Permisos de Micrófono ───────────────
    useEffect(() => {
        const requestPerm = async () => {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const granted = await NativeAudio.requestPermission();
                    setPermissionGranted(granted);
                } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(t => t.stop());
                    setPermissionGranted(true);
                } else {
                    setPermissionGranted(false);
                }
            } catch {
                setPermissionGranted(false);
                setStatusMsg("⚠️ Permiso de micrófono denegado.");
            }
        };
        requestPerm();
    }, []);

    // ── 3. Carga Reactiva Inicial e Hidratación de Ráfagas desde Sled/API ───
    const loadBursts = useCallback(async () => {
        setIsLoadingBursts(true);
        setBurstsError(null);
        try {
            const list = await getVoiceBursts();
            if (Array.isArray(list)) {
                setVoiceBursts(list);
            }
        } catch (e: any) {
            console.error("Voice bursts fetch error:", e);
            setBurstsError(e.message || "Fallo al sincronizar ráfagas.");
        } finally {
            setIsLoadingBursts(false);
        }
    }, [setVoiceBursts]);

    useEffect(() => {
        loadBursts();
    }, [loadBursts]);

    // ── 4. Osciloscopio Táctico y Medidor VAD en Canvas ─────────────────────
    useEffect(() => {
        let timer: any;
        let animationFrameId: number;

        if (isRecording) {
            timer = setInterval(() => setRecordingTime((t) => t + 1), 1000);
        } else {
            setRecordingTime(0);
            setVadLevel(0);
        }

        const renderOscilloscope = () => {
            if (canvasRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    const width = canvas.width;
                    const height = canvas.height;

                    ctx.fillStyle = "rgba(4, 8, 18, 0.4)";
                    ctx.fillRect(0, 0, width, height);

                    // Rejilla de calibración de audio militar
                    ctx.strokeStyle = "rgba(255, 112, 67, 0.12)";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    for (let x = 0; x < width; x += 30) {
                        ctx.moveTo(x, 0); ctx.lineTo(x, height);
                    }
                    for (let y = 0; y < height; y += 20) {
                        ctx.moveTo(0, y); ctx.lineTo(width, y);
                    }
                    ctx.stroke();

                    if (analyserRef.current) {
                        const bufferLength = analyserRef.current.fftSize;
                        const dataArray = new Uint8Array(bufferLength);
                        analyserRef.current.getByteTimeDomainData(dataArray);

                        // Calcular nivel VAD
                        let sum = 0;
                        for (let i = 0; i < bufferLength; i++) {
                            const val = (dataArray[i] - 128) / 128;
                            sum += val * val;
                        }
                        const rms = Math.sqrt(sum / bufferLength);
                        setVadLevel(Math.min(100, Math.round(rms * 280)));

                        // Dibujar forma de onda
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = isRecording ? "#FF3355" : (playingBurstId ? "#FFB300" : "#00E5FF");
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = ctx.strokeStyle;
                        ctx.beginPath();

                        const sliceWidth = (width * 1.0) / bufferLength;
                        let x = 0;
                        for (let i = 0; i < bufferLength; i++) {
                            const v = dataArray[i] / 128.0;
                            const y = (v * height) / 2;
                            if (i === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                            x += sliceWidth;
                        }
                        ctx.lineTo(width, height / 2);
                        ctx.stroke();
                        ctx.shadowBlur = 0;
                    } else {
                        // Línea base continua (Carrier sense en reposo)
                        ctx.lineWidth = 1.5;
                        ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
                        ctx.beginPath();
                        ctx.moveTo(0, height / 2);
                        ctx.lineTo(width, height / 2);
                        ctx.stroke();
                    }
                }
            }
            animationFrameId = requestAnimationFrame(renderOscilloscope);
        };

        animationFrameId = requestAnimationFrame(renderOscilloscope);

        return () => {
            if (timer) clearInterval(timer);
            cancelAnimationFrame(animationFrameId);
        };
    }, [isRecording, playingBurstId]);

    // ── 5. Iniciar Grabación Táctica PTT ─────────────────────────────────────
    const startRecording = async () => {
        if (!permissionGranted) {
            toast.warning("Se requiere permiso de micrófono para transmitir");
            return;
        }
        if (isRecording || isProcessingStop) return;

        try {
            TacticalAudioEngine.playTap();
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([35]);
            }

            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                await NativeAudio.start();
            } else {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                webStreamRef.current = stream;

                // Usar AudioContextManager compartido para prevenir fugas de límite de 6 contextos
                const audioCtx = AudioContextManager.getSharedContext();
                if (audioCtx) {
                    const source = audioCtx.createMediaStreamSource(stream);
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 256;
                    source.connect(analyser);
                    analyserRef.current = analyser;
                }

                recordedChunksRef.current = [];
                const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
                    ? 'audio/webm;codecs=opus'
                    : ((typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : 'audio/ogg');

                if (typeof MediaRecorder !== 'undefined') {
                    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
                    recorder.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) {
                            recordedChunksRef.current.push(e.data);
                        }
                    };
                    recorder.start(50);
                    mediaRecorderRef.current = recorder;
                }
            }

            setIsRecording(true);
            setStatusMsg("🎙️ Transmitiendo por canal de voz...");
        } catch (err: any) {
            toast.error(`Error al iniciar audio: ${err.message}`);
            setIsRecording(false);
        }
    };

    // ── 6. Finalizar Grabación Táctica y Transmitir ─────────────────────────
    const stopRecordingAndTransmit = async () => {
        if (!isRecording || isProcessingStop) return;

        setIsProcessingStop(true);
        setIsRecording(false);
        TacticalAudioEngine.playRogerBeep();

        if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([30, 20, 30]);
        }

        try {
            let base64Audio = "";
            let duration = recordingTime || 1;
            let rawBytesCount = 0;

            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const result = await NativeAudio.stop();
                if (result) {
                    base64Audio = result.base64;
                    duration = Math.round(result.durationMs / 1000) || recordingTime || 1;
                    rawBytesCount = Math.round(base64Audio.length * 0.75);
                }
            } else if (mediaRecorderRef.current) {
                const rec = mediaRecorderRef.current;
                await new Promise<void>((resolve) => {
                    rec.onstop = () => resolve();
                    try { rec.stop(); } catch { resolve(); }
                });

                if (webStreamRef.current) {
                    webStreamRef.current.getTracks().forEach(t => t.stop());
                    webStreamRef.current = null;
                }
                analyserRef.current = null;

                const blob = new Blob(recordedChunksRef.current, { type: rec.mimeType || 'audio/webm' });
                if (blob.size > 0) {
                    rawBytesCount = blob.size;
                    const arrayBuffer = await blob.arrayBuffer();

                    // Aplicar compresión con LowBitrateVocoder si está habilitado
                    if (useTacticalVocoder) {
                        try {
                            const audioCtx = AudioContextManager.getSharedContext();
                            if (audioCtx) {
                                const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
                                const vocoderResult = vocoderMode === "lpc"
                                    ? LowBitrateVocoder.compressForLora(decodedBuffer)
                                    : LowBitrateVocoder.compressAudioBuffer(decodedBuffer);

                                base64Audio = vocoderResult.base64;
                                duration = Math.max(1, Math.round(decodedBuffer.duration));
                                setCompressionTelemetry({
                                    bytes: vocoderResult.compressedSizeBytes,
                                    reduction: vocoderResult.compressionRatioPercent,
                                    bitrateKbps: Math.round((vocoderResult.compressedSizeBytes * 8) / (duration * 1000) * 10) / 10
                                });
                            }
                        } catch (compErr) {
                            console.warn("[Vocoder Encoding Fallback]", compErr);
                        }
                    }

                    // Fallback a base64 de WebM estándar si vocoder no corrió
                    if (!base64Audio) {
                        const bytes = new Uint8Array(arrayBuffer);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                        base64Audio = btoa(binary);
                        duration = recordingTime || 1;
                    }
                }
                mediaRecorderRef.current = null;
            }

            if (base64Audio) {
                const res = await sendVoiceBurst({
                    audio_opus_b64: base64Audio,
                    duration_seconds: duration,
                    sender_name: myNickname
                });

                if (res && res.burst) {
                    addVoiceBurst(res.burst);
                }

                // Radiodifusión en Malla Táctica Off-Grid P2P
                try {
                    const meshPayload = new TextEncoder().encode(JSON.stringify({
                        type: "P2P_VOICE_BURST",
                        channel: selectedChannel,
                        sender: myNickname,
                        duration,
                        audio_b64: base64Audio,
                        timestamp: Date.now()
                    }));
                    await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", meshPayload);
                } catch (meshErr) {
                    console.warn("[P2PWalkieTalkie] Error al difundir ráfaga por malla:", meshErr);
                }

                // Radiodifusión acústica ultrasónica complementaria si está activa
                if (acousticBroadcast) {
                    setIsTransmittingAcoustic(true);
                    SoundMeshEngine.transmitVocoderVoiceBurst(base64Audio.slice(0, 120))
                        .catch(err => console.warn("[SoundMesh Transmit Error]", err))
                        .finally(() => setIsTransmittingAcoustic(false));
                }

                toast.success(`Ráfaga transmitida · ${duration}s (${selectedChannel})`);
            }
        } catch (err: any) {
            toast.error(`Error al procesar audio: ${err.message}`);
        } finally {
            setIsProcessingStop(false);
            setStatusMsg(null);
        }
    };

    // ── 7. Cancelación Inmediata de Grabación ───────────────────────────────
    const handleAbortRecording = () => {
        setIsRecording(false);
        setIsProcessingStop(false);
        if (webStreamRef.current) {
            webStreamRef.current.getTracks().forEach(t => t.stop());
            webStreamRef.current = null;
        }
        if (mediaRecorderRef.current) {
            try { mediaRecorderRef.current.stop(); } catch {}
            mediaRecorderRef.current = null;
        }
        analyserRef.current = null;
        TacticalAudioEngine.playWarning();
        toast.info("Grabación cancelada.");
    };

    // ── 8. Parar Reproducción Activa ───────────────────────────────────────
    const handleStopPlayback = () => {
        if (activeSourceNodeRef.current) {
            try { activeSourceNodeRef.current.stop(); } catch {}
            activeSourceNodeRef.current = null;
        }
        audioRefs.current.forEach(a => {
            try { a.pause(); a.currentTime = 0; } catch {}
        });
        setPlayingBurstId(null);
        TacticalAudioEngine.playSquelchTail();
    };

    // ── 9. Reproducción Inteligente (Vocoder vs Opus/WebM) ──────────────────
    const handlePlayBurst = async (burst: VoiceBurst) => {
        if (playingBurstId === burst.id) {
            handleStopPlayback();
            return;
        }

        handleStopPlayback();

        try {
            const rawBytes = LowBitrateVocoder.base64ToBytes(burst.audio_opus_b64);
            const isVocoderPayload = rawBytes.length > 0 && (rawBytes[0] === 0x56 || rawBytes[0] === 0x58);

            if (isVocoderPayload) {
                // Reproducción nativa mediante Web Audio API sintetizada desde PCM
                const audioCtx = AudioContextManager.getSharedContext();
                if (!audioCtx) throw new Error("AudioContext no disponible");

                const audioBuffer = LowBitrateVocoder.createAudioBufferFromEncoded(audioCtx, rawBytes);
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;

                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                analyser.connect(audioCtx.destination);
                analyserRef.current = analyser;

                source.onended = () => {
                    activeSourceNodeRef.current = null;
                    analyserRef.current = null;
                    setPlayingBurstId(null);
                    TacticalAudioEngine.playSquelchTail();
                };

                source.start();
                activeSourceNodeRef.current = source;
                setPlayingBurstId(burst.id);
            } else {
                // Reproducción estándar de contenedor WebM / Opus / AAC
                const audio = new Audio(`data:audio/webm;base64,${burst.audio_opus_b64}`);
                audio.onended = () => {
                    setPlayingBurstId(null);
                    TacticalAudioEngine.playSquelchTail();
                };
                audioRefs.current.set(burst.id, audio);
                await audio.play();
                setPlayingBurstId(burst.id);
            }
        } catch (err: any) {
            console.error("Playback failure:", err);
            toast.error(`Fallo en reproducción: ${err.message}`);
            setPlayingBurstId(null);
        }
    };

    // ── 10. Eliminación de Ráfaga ──────────────────────────────────────────
    const handleDelete = async (id: string) => {
        try {
            await deleteVoiceBurst(id);
            removeVoiceBurst(id);
            toast.info("Ráfaga eliminada de la malla");
        } catch {
            toast.error("Error al eliminar ráfaga");
        }
    };

    // ── 11. Re-radiar Ráfaga Acústica por Parlante Ultrasónico ─────────────
    const handleRebroadcastAcoustic = async (burst: VoiceBurst) => {
        setIsTransmittingAcoustic(true);
        toast.info("Transmitiendo ráfaga vía ultrasonido SoundMesh...");
        try {
            await SoundMeshEngine.transmitVocoderVoiceBurst(burst.audio_opus_b64.slice(0, 100));
            toast.success("Emisión acústica culminada");
        } catch (err: any) {
            toast.error(`Error acústico: ${err.message}`);
        } finally {
            setIsTransmittingAcoustic(false);
        }
    };

    // Limpieza al desmontar
    useEffect(() => {
        return () => {
            handleStopPlayback();
            if (webStreamRef.current) {
                webStreamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const burstsList = Array.isArray(activeVoiceBursts) ? activeVoiceBursts : [];

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace",
            display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
            {/* ── HEADER TÁCTICO ── */}
            <header style={{
                padding: "calc(10px + var(--safe-top, 0px)) 16px 10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(255, 112, 67, 0.35)",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={() => {
                            if (!BackHandlerRegistry.executeTop()) {
                                TacticalAudioEngine.playTap();
                                goBack();
                            }
                        }}
                        style={{
                            width: 36, height: 36, borderRadius: "10px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.2rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(255, 112, 67, 0.3) 0%, rgba(230, 74, 25, 0.15) 100%)",
                        border: "1px solid rgba(255, 112, 67, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.35rem", boxShadow: "0 0 15px rgba(255, 112, 67, 0.25)"
                    }}>🎙️</div>
                    <div>
                        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#FFFFFF" }}>
                            {t('walkie.title') || "WALKIE-TALKIE PTT"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-amber, #FFB300)", fontWeight: 800 }}>
                            {t('walkie.subtitle') || "RADIO TÁCTICA 1.1 KBPS · HALF-DUPLEX"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {isTransmittingAcoustic && (
                        <span style={{
                            fontSize: "0.62rem", fontWeight: 900, padding: "4px 8px", borderRadius: "6px",
                            background: "rgba(0, 229, 255, 0.2)", color: "#00E5FF", border: "1px solid #00E5FF"
                        }}>
                            ULTRASONIDO TX
                        </span>
                    )}
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 900, padding: "4px 8px", borderRadius: "6px",
                        background: isRecording ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 230, 118, 0.15)",
                        color: isRecording ? "#FF3355" : "#00E676",
                        border: `1px solid ${isRecording ? '#FF3355' : '#00E676'}50`
                    }}>
                        {isRecording ? "TRANSMITIENDO" : (playingBurstId ? "RECIBIENDO" : "STANDBY")}
                    </span>
                </div>
            </header>

            {/* ── SELECTOR DE PESTAÑAS ── */}
            <div style={{
                display: "flex", padding: "8px 16px", gap: "6px",
                background: "rgba(8, 10, 20, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveTab("ptt");
                    }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "ptt" ? "linear-gradient(135deg, rgba(255, 112, 67, 0.25) 0%, rgba(200, 50, 20, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "ptt" ? "1.5px solid #FF7043" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "ptt" ? "#FF7043" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🎙️</span> {t('walkie.live_tab') || "PTT EN VIVO"}
                </button>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveTab("bursts");
                    }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "bursts" ? "linear-gradient(135deg, rgba(255, 112, 67, 0.25) 0%, rgba(200, 50, 20, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "bursts" ? "1.5px solid #FF7043" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "bursts" ? "#FF7043" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>📻</span> {t('walkie.bursts_tab') || "RÁFAGAS"} ({burstsList.length})
                </button>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveTab("rf");
                    }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "rf" ? "linear-gradient(135deg, rgba(255, 112, 67, 0.25) 0%, rgba(200, 50, 20, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "rf" ? "1.5px solid #FF7043" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "rf" ? "#FF7043" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>⚡</span> MODULACIÓN
                </button>
            </div>

            {/* ── SELECTOR DE CANALES TÁCTICOS ── */}
            <div style={{
                display: "flex", overflowX: "auto", padding: "8px 16px", gap: "8px",
                background: "rgba(10, 14, 28, 0.8)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                scrollbarWidth: "none", flexShrink: 0
            }}>
                {TACTICAL_CHANNELS.map(ch => (
                    <button
                        key={ch.id}
                        onClick={() => setSelectedChannel(ch.id)}
                        style={{
                            padding: "5px 10px", borderRadius: "8px", whiteSpace: "nowrap",
                            background: selectedChannel === ch.id ? `${ch.color}25` : "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${selectedChannel === ch.id ? ch.color : 'rgba(255, 255, 255, 0.1)'}`,
                            color: selectedChannel === ch.id ? ch.color : "var(--text-secondary)",
                            fontSize: "0.68rem", fontWeight: 800, cursor: "pointer"
                        }}
                    >
                        {ch.name} · {ch.freq.split("·")[0]}
                    </button>
                ))}
            </div>

            {/* ── CONTENIDO PRINCIPAL ── */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ══ TAB 1: PTT EN VIVO ══ */}
                    {activeTab === "ptt" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 112, 67, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "18px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(255, 112, 67, 0.15)"
                        }}>
                            {/* Carrier Sense HUD */}
                            <div style={{
                                width: "100%", padding: "8px 14px", borderRadius: "12px",
                                background: isRecording
                                    ? "rgba(255, 51, 85, 0.15)"
                                    : (playingBurstId ? "rgba(255, 179, 0, 0.15)" : "rgba(0, 230, 118, 0.12)"),
                                border: `1px solid ${isRecording ? '#FF3355' : (playingBurstId ? '#FFB300' : '#00E676')}50`,
                                display: "flex", alignItems: "center", justifyContent: "space-between"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{
                                        width: 8, height: 8, borderRadius: "50%",
                                        background: isRecording ? "#FF3355" : (playingBurstId ? "#FFB300" : "#00E676"),
                                        boxShadow: `0 0 10px ${isRecording ? '#FF3355' : (playingBurstId ? '#FFB300' : '#00E676')}`,
                                        animation: (isRecording || playingBurstId) ? "pulse 0.8s infinite" : "none"
                                    }} />
                                    <span style={{
                                        fontSize: "0.72rem", fontWeight: 900,
                                        color: isRecording ? "#FF3355" : (playingBurstId ? "#FFB300" : "#00E676")
                                    }}>
                                        {isRecording
                                            ? "TX EN PROGRESO · CANAL BLOQUEADO"
                                            : (playingBurstId ? "RX DETECTADO · CANAL OCUPADO" : "CARRIER SENSE · CANAL DESPEJADO")}
                                    </span>
                                </div>
                                <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", fontWeight: 800 }}>
                                    {selectedChannel}
                                </span>
                            </div>

                            {/* Canvas Osciloscopio Militar en Tiempo Real */}
                            <div style={{
                                width: "100%", height: "90px", borderRadius: "14px", overflow: "hidden",
                                border: "1px solid rgba(255, 112, 67, 0.3)", background: "#040812", position: "relative"
                            }}>
                                <canvas
                                    ref={canvasRef}
                                    width={640}
                                    height={90}
                                    style={{ width: "100%", height: "100%", display: "block" }}
                                />
                                <div style={{
                                    position: "absolute", bottom: 6, right: 10,
                                    fontSize: "0.62rem", color: "rgba(255, 255, 255, 0.5)", fontWeight: 800
                                }}>
                                    VAD: {vadLevel}% · FFT 256
                                </div>
                            </div>

                            {/* Selector de Modo PTT: Hold-to-talk vs Latch */}
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 800 }}>MODO PTT:</span>
                                <button
                                    onClick={() => setPttMode("hold")}
                                    style={{
                                        padding: "4px 10px", borderRadius: "6px",
                                        background: pttMode === "hold" ? "rgba(255, 112, 67, 0.25)" : "rgba(255, 255, 255, 0.05)",
                                        border: `1px solid ${pttMode === 'hold' ? '#FF7043' : 'rgba(255, 255, 255, 0.1)'}`,
                                        color: pttMode === "hold" ? "#FF7043" : "var(--text-secondary)",
                                        fontSize: "0.68rem", fontWeight: 800, cursor: "pointer"
                                    }}
                                >
                                    PULSAR Y MANTENER
                                </button>
                                <button
                                    onClick={() => setPttMode("toggle")}
                                    style={{
                                        padding: "4px 10px", borderRadius: "6px",
                                        background: pttMode === "toggle" ? "rgba(255, 112, 67, 0.25)" : "rgba(255, 255, 255, 0.05)",
                                        border: `1px solid ${pttMode === 'toggle' ? '#FF7043' : 'rgba(255, 255, 255, 0.1)'}`,
                                        color: pttMode === "toggle" ? "#FF7043" : "var(--text-secondary)",
                                        fontSize: "0.68rem", fontWeight: 800, cursor: "pointer"
                                    }}
                                >
                                    ALTERNAR (LATCH)
                                </button>
                            </div>

                            {/* Botón PTT Circular con Ondas Expansivas RF */}
                            <div style={{ position: "relative", width: "210px", height: "210px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isRecording && (
                                    <>
                                        <div style={{
                                            position: "absolute", inset: -8, borderRadius: "50%",
                                            border: "2px solid #FF3355",
                                            animation: "pulse 1.2s infinite",
                                            boxShadow: "0 0 35px rgba(255, 51, 85, 0.6)"
                                        }} />
                                        <div style={{
                                            position: "absolute", inset: -24, borderRadius: "50%",
                                            border: "1.5px solid rgba(255, 112, 67, 0.6)",
                                            animation: "pulse 1.8s infinite 0.3s",
                                            boxShadow: "0 0 50px rgba(255, 112, 67, 0.35)"
                                        }} />
                                    </>
                                )}

                                {playingBurstId && (
                                    <div style={{
                                        position: "absolute", inset: -10, borderRadius: "50%",
                                        border: "2px solid #FFB300",
                                        animation: "pulse 1s infinite",
                                        boxShadow: "0 0 25px rgba(255, 179, 0, 0.5)"
                                    }} />
                                )}

                                <button
                                    onMouseDown={() => {
                                        if (pttMode === "hold") startRecording();
                                    }}
                                    onMouseUp={() => {
                                        if (pttMode === "hold" && isRecording) stopRecordingAndTransmit();
                                    }}
                                    onTouchStart={() => {
                                        if (pttMode === "hold") startRecording();
                                    }}
                                    onTouchEnd={() => {
                                        if (pttMode === "hold" && isRecording) stopRecordingAndTransmit();
                                    }}
                                    onClick={() => {
                                        if (pttMode === "toggle") {
                                            if (isRecording) stopRecordingAndTransmit();
                                            else startRecording();
                                        }
                                    }}
                                    disabled={isProcessingStop}
                                    style={{
                                        width: "155px", height: "155px", borderRadius: "50%",
                                        background: isRecording
                                            ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)"
                                            : (playingBurstId
                                                ? "linear-gradient(135deg, rgba(255, 179, 0, 0.25) 0%, rgba(20, 24, 45, 0.95) 100%)"
                                                : "linear-gradient(135deg, rgba(30, 36, 60, 0.95) 0%, rgba(14, 18, 36, 0.98) 100%)"),
                                        border: isRecording ? "3px solid #FFFFFF" : (playingBurstId ? "2.5px solid #FFB300" : "2px solid rgba(255, 112, 67, 0.4)"),
                                        boxShadow: isRecording
                                            ? "0 0 45px rgba(255, 51, 85, 0.8)"
                                            : (playingBurstId
                                                ? "0 0 30px rgba(255, 179, 0, 0.4)"
                                                : "0 10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.1)"),
                                        color: "#FFFFFF", display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center", gap: "6px",
                                        cursor: isProcessingStop ? "wait" : "pointer",
                                        userSelect: "none", WebkitUserSelect: "none"
                                    }}
                                >
                                    <span style={{ fontSize: "2.4rem" }}>
                                        {isProcessingStop ? "⏳" : (isRecording ? "⏹️" : (playingBurstId ? "🔊" : "🎙️"))}
                                    </span>
                                    <span style={{ fontSize: "0.82rem", fontWeight: 900, letterSpacing: "0.5px" }}>
                                        {isProcessingStop ? "PROCESANDO" : (isRecording ? `${recordingTime}s REC` : (playingBurstId ? "RX AUDIO" : (pttMode === 'hold' ? "MANTENER PTT" : "PULSAR PTT")))}
                                    </span>
                                </button>
                            </div>

                            {/* Telemetría de Compresión Militar en Tiempo Real */}
                            {compressionTelemetry && (
                                <div style={{
                                    width: "100%", padding: "10px 14px", borderRadius: "12px",
                                    background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.25)",
                                    display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem"
                                }}>
                                    <span style={{ color: "#00E676", fontWeight: 800 }}>
                                        📦 Compresión Vocoder: {compressionTelemetry.bytes} Bytes (-{compressionTelemetry.reduction}%)
                                    </span>
                                    <span style={{ color: "var(--accent-cyan)", fontWeight: 800 }}>
                                        {compressionTelemetry.bitrateKbps} kbps · LoRa Ready
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ TAB 2: RÁFAGAS GUARDADAS ══ */}
                    {activeTab === "bursts" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {isLoadingBursts && burstsList.length === 0 ? (
                                <SkeletonCard count={2} />
                            ) : burstsList.length === 0 ? (
                                <EmptyState
                                    icon="📻"
                                    title="Sin Ráfagas Registradas"
                                    description="Usa la pestaña PTT para emitir o recibir transmisiones de voz por la malla."
                                />
                            ) : (
                                burstsList.map((b: VoiceBurst) => {
                                    const rawBytes = LowBitrateVocoder.base64ToBytes(b.audio_opus_b64 || "");
                                    const isLpc = rawBytes.length > 0 && rawBytes[0] === 0x58;
                                    const isAdpcm = rawBytes.length > 0 && rawBytes[0] === 0x56;
                                    const codecLabel = isLpc ? "LPC-10 1.1k" : (isAdpcm ? "ADPCM 1.6k" : "OPUS 32k");
                                    const approxBytes = Math.round((b.audio_opus_b64 || "").length * 0.75);

                                    return (
                                        <div
                                            key={b.id}
                                            style={{
                                                padding: "14px 16px", borderRadius: "14px",
                                                background: "linear-gradient(135deg, rgba(16, 22, 44, 0.9) 0%, rgba(8, 12, 28, 0.95) 100%)",
                                                border: playingBurstId === b.id ? "1.5px solid #FFB300" : "1px solid rgba(255, 112, 67, 0.25)",
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                boxShadow: playingBurstId === b.id ? "0 0 15px rgba(255, 179, 0, 0.25)" : "none"
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <span style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF" }}>
                                                        {b.sender_name || "Operador RED"}
                                                    </span>
                                                    <span style={{
                                                        fontSize: "0.62rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px",
                                                        background: isLpc ? "rgba(0, 230, 118, 0.15)" : (isAdpcm ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.08)"),
                                                        color: isLpc ? "#00E676" : (isAdpcm ? "#00E5FF" : "var(--text-secondary)"),
                                                        border: `1px solid ${isLpc ? '#00E676' : (isAdpcm ? '#00E5FF' : 'rgba(255,255,255,0.15)')}`
                                                    }}>
                                                        {codecLabel}
                                                    </span>
                                                    <span style={{ fontSize: "0.68rem", color: "var(--accent-amber)" }}>
                                                        {b.duration_seconds}s
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                                    {new Date(b.timestamp * (b.timestamp < 10000000000 ? 1000 : 1)).toLocaleTimeString()} · {approxBytes} Bytes
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", gap: "6px" }}>
                                                {/* Re-radiación ultrasónica SoundMesh */}
                                                <button
                                                    onClick={() => handleRebroadcastAcoustic(b)}
                                                    title="Re-radiar por parlante ultrasónico"
                                                    disabled={isTransmittingAcoustic}
                                                    style={{
                                                        padding: "6px 10px", borderRadius: "8px",
                                                        background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                                        color: "#00E5FF", cursor: "pointer", fontSize: "0.72rem", fontWeight: 800
                                                    }}
                                                >
                                                    🔊
                                                </button>

                                                {/* Reproducir / Detener */}
                                                <button
                                                    onClick={() => handlePlayBurst(b)}
                                                    style={{
                                                        padding: "6px 14px", borderRadius: "8px",
                                                        background: playingBurstId === b.id ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 229, 255, 0.15)",
                                                        border: `1px solid ${playingBurstId === b.id ? '#FF3355' : '#00E5FF'}`,
                                                        color: playingBurstId === b.id ? "#FF3355" : "var(--accent-cyan, #00E5FF)",
                                                        fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                                    }}
                                                >
                                                    {playingBurstId === b.id ? "⏹️ STOP" : "▶️ PLAY"}
                                                </button>

                                                {/* Borrar */}
                                                <button
                                                    onClick={() => handleDelete(b.id)}
                                                    style={{
                                                        padding: "6px 10px", borderRadius: "8px",
                                                        background: "rgba(255, 51, 85, 0.1)", border: "1px solid rgba(255, 51, 85, 0.3)",
                                                        color: "#FF3355", cursor: "pointer", fontSize: "0.74rem"
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ══ TAB 3: CONFIGURACIÓN Y MODULACIÓN RF ══ */}
                    {activeTab === "rf" && (
                        <div style={{
                            display: "flex", flexDirection: "column", gap: "14px",
                            background: "rgba(14, 18, 38, 0.95)", border: "1px solid rgba(255, 112, 67, 0.3)",
                            borderRadius: "18px", padding: "18px"
                        }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF" }}>
                                ⚡ PARÁMETROS DE RADIOFRECUENCIA Y VOCODER
                            </div>

                            {/* Vocoder Toggle */}
                            <div style={{
                                padding: "12px", borderRadius: "12px",
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FFFFFF" }}>
                                        Compresión Vocoder Militar (8kHz DSP)
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        {useTacticalVocoder ? "Activo · Comprime audio a <500B apto para LoRa/Ultrasonido" : "Desactivado · WebM estándar 32kbps"}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setUseTacticalVocoder(!useTacticalVocoder)}
                                    style={{
                                        padding: "6px 14px", borderRadius: "8px",
                                        background: useTacticalVocoder ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                        border: `1px solid ${useTacticalVocoder ? '#00E676' : 'rgba(255, 255, 255, 0.15)'}`,
                                        color: useTacticalVocoder ? "#00E676" : "var(--text-secondary)",
                                        fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                    }}
                                >
                                    {useTacticalVocoder ? "HABILITADO" : "DESHABILITADO"}
                                </button>
                            </div>

                            {/* Algoritmo Vocoder: LPC-10 vs ADPCM */}
                            {useTacticalVocoder && (
                                <div style={{
                                    padding: "12px", borderRadius: "12px",
                                    background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                    display: "flex", justifyContent: "space-between", alignItems: "center"
                                }}>
                                    <div>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FFFFFF" }}>
                                            Algoritmo Vocoder: {vocoderMode === "lpc" ? "LPC-10 Paramétrico (1.1 kbps)" : "IMA ADPCM 4-bit (1.6 kbps)"}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                            {vocoderMode === "lpc" ? "Ultra-compacto · Síntesis por polos y residuo" : "Mayor fidelidad · Cuantización adaptativa"}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setVocoderMode(vocoderMode === "lpc" ? "adpcm" : "lpc")}
                                        style={{
                                            padding: "6px 14px", borderRadius: "8px",
                                            background: "rgba(0, 229, 255, 0.15)", border: "1px solid #00E5FF",
                                            color: "#00E5FF", fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                        }}
                                    >
                                        CAMBIAR
                                    </button>
                                </div>
                            )}

                            {/* Difusión Acústica Ultrasónica */}
                            <div style={{
                                padding: "12px", borderRadius: "12px",
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <div>
                                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FFFFFF" }}>
                                        Radiodifusión Acústica Ultrasónica (SoundMesh)
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        Emite tonos FSK (18.5 kHz - 20.5 kHz) por el parlante al terminar PTT
                                    </div>
                                </div>
                                <button
                                    onClick={() => setAcousticBroadcast(!acousticBroadcast)}
                                    style={{
                                        padding: "6px 14px", borderRadius: "8px",
                                        background: acousticBroadcast ? "rgba(0, 229, 255, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                        border: `1px solid ${acousticBroadcast ? '#00E5FF' : 'rgba(255, 255, 255, 0.15)'}`,
                                        color: acousticBroadcast ? "#00E5FF" : "var(--text-secondary)",
                                        fontWeight: 900, fontSize: "0.74rem", cursor: "pointer"
                                    }}
                                >
                                    {acousticBroadcast ? "ON" : "OFF"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

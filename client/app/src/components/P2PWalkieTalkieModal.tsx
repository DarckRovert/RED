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
    const { navigate, identity, goBack } = useRedStore();
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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const webStreamRef = useRef<MediaStream | null>(null);

    const myNickname = identity?.nickname || "Operador RED";

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
                setStatusMsg("⚠️ Permiso de micrófono denegado.");
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
            cancelAnimationFrame(animationFrame);
        };
    }, [isRecording]);

    const handleToggleRecording = async () => {
        if (!permissionGranted) {
            toast.warning("Permiso de micrófono no otorgado.");
            return;
        }

        if (!isRecording) {
            try {
                TacticalAudioEngine.playTap();
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    await NativeAudio.start();
                } else {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    webStreamRef.current = stream;
                    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                    audioContextRef.current = new AudioCtx();
                    const source = audioContextRef.current.createMediaStreamSource(stream);
                    analyserRef.current = audioContextRef.current.createAnalyser();
                    analyserRef.current.fftSize = 64;
                    source.connect(analyserRef.current);

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
                        recorder.start(100);
                        mediaRecorderRef.current = recorder;
                    }
                }
                setIsRecording(true);
                setStatusMsg("🎙️ Transmitiendo por canal de voz...");
            } catch (err: any) {
                toast.error(`Error al iniciar audio: ${err.message}`);
            }
        } else {
            setIsProcessingStop(true);
            setIsRecording(false);
            TacticalAudioEngine.playRogerBeep();

            try {
                let base64Audio = "";
                let duration = recordingTime;

                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const result = await NativeAudio.stop();
                    if (result) {
                        base64Audio = result.base64;
                        duration = Math.round(result.durationMs / 1000) || recordingTime;
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
                    const blob = new Blob(recordedChunksRef.current, { type: rec.mimeType || 'audio/webm' });
                    if (blob.size > 0) {
                        const buffer = await blob.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        base64Audio = btoa(binary);
                        duration = recordingTime || 1;
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
                        setBursts(prev => [res.burst, ...prev]);
                    }
                    toast.success("Ráfaga de voz transmitida a la malla");
                }
            } catch (err: any) {
                toast.error(`Error al procesar audio: ${err.message}`);
            } finally {
                setIsProcessingStop(false);
                setStatusMsg(null);
            }
        }
    };

    const handlePlayBurst = (burst: VoiceBurst) => {
        if (playingBurstId === burst.id) {
            const audio = audioRefs.current.get(burst.id);
            if (audio) audio.pause();
            setPlayingBurstId(null);
            return;
        }

        const audio = new Audio(`data:audio/webm;base64,${burst.audio_opus_b64}`);
        audio.onended = () => setPlayingBurstId(null);
        audioRefs.current.set(burst.id, audio);
        audio.play();
        setPlayingBurstId(burst.id);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteVoiceBurst(id);
            setBursts(prev => prev.filter(b => b.id !== id));
            toast.info("Ráfaga eliminada");
        } catch {
            toast.error("Error al eliminar");
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace",
            display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(255, 112, 67, 0.35)",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={goBack}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.1rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(255, 112, 67, 0.25) 0%, rgba(230, 74, 25, 0.15) 100%)",
                        border: "1px solid rgba(255, 112, 67, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(255, 112, 67, 0.25)"
                    }}>🎙️</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            {t('walkie.title') || "WALKIE-TALKIE PTT"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-amber, #FFB300)", fontWeight: 800 }}>
                            {t('walkie.subtitle') || "RADIO VOCAL 1.6 KBPS · HALF-DUPLEX"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                        background: isRecording ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 230, 118, 0.15)",
                        color: isRecording ? "#FF3355" : "#00E676",
                        border: `1px solid ${isRecording ? '#FF3355' : '#00E676'}50`
                    }}>
                        {isRecording ? "TRANSMITIENDO" : "STANDBY"}
                    </span>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", padding: "8px 16px", gap: "6px",
                background: "rgba(8, 10, 20, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("ptt")}
                    style={{
                        flex: 1, padding: "8px 14px", borderRadius: "10px",
                        background: activeTab === "ptt" ? "linear-gradient(135deg, rgba(255, 112, 67, 0.25) 0%, rgba(200, 50, 20, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "ptt" ? "1.5px solid #FF7043" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "ptt" ? "#FF7043" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🎙️</span> {t('walkie.live_tab') || "PTT EN VIVO"}
                </button>
                <button
                    onClick={() => setActiveTab("bursts")}
                    style={{
                        flex: 1, padding: "8px 14px", borderRadius: "10px",
                        background: activeTab === "bursts" ? "linear-gradient(135deg, rgba(255, 112, 67, 0.25) 0%, rgba(200, 50, 20, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "bursts" ? "1.5px solid #FF7043" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "bursts" ? "#FF7043" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>📻</span> {t('walkie.bursts_tab') || "RÁFAGAS GUARDADAS"} ({bursts.length})
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* TAB 1: PTT */}
                    {activeTab === "ptt" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 112, 67, 0.35)", borderRadius: "22px", padding: "24px",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(255, 112, 67, 0.15)"
                        }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "1rem", fontWeight: 900, color: "#FFFFFF" }}>
                                    CANAL DE VOZ HALF-DUPLEX MIL-STD
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Toca para transmitir ráfaga de voz. El audio se comprime con el Vocoder LPC y se propaga por la malla.
                                </div>
                            </div>

                            {/* VAD Dynamic Modulation Bar */}
                            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                    <span>MODULACIÓN VAD</span>
                                    <span>{vadLevel}% NIVEL</span>
                                </div>
                                <div style={{ width: "100%", height: "8px", background: "rgba(0, 0, 0, 0.5)", borderRadius: "4px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                                    <div style={{
                                        width: `${vadLevel}%`, height: "100%",
                                        background: vadLevel > 70 ? "#FF3355" : vadLevel > 30 ? "#00E676" : "#00E5FF",
                                        transition: "width 0.05s linear",
                                        boxShadow: `0 0 10px ${vadLevel > 70 ? '#FF3355' : '#00E676'}`
                                    }} />
                                </div>
                            </div>

                            {/* Botón PTT Circular Táctico */}
                            <div style={{ position: "relative", width: "190px", height: "190px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isRecording && (
                                    <div style={{
                                        position: "absolute", inset: -14, borderRadius: "50%",
                                        border: "2px solid #FF3355",
                                        animation: "pulse 1.2s infinite",
                                        boxShadow: "0 0 30px rgba(255, 51, 85, 0.5)"
                                    }} />
                                )}

                                <button
                                    onClick={handleToggleRecording}
                                    disabled={isProcessingStop}
                                    style={{
                                        width: "160px", height: "160px", borderRadius: "50%",
                                        background: isRecording
                                            ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)"
                                            : "linear-gradient(135deg, rgba(30, 36, 60, 0.95) 0%, rgba(14, 18, 36, 0.98) 100%)",
                                        border: isRecording ? "3px solid #FFFFFF" : "2px solid rgba(255, 112, 67, 0.4)",
                                        boxShadow: isRecording
                                            ? "0 0 40px rgba(255, 51, 85, 0.7)"
                                            : "0 10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.1)",
                                        color: "#FFFFFF", display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center", gap: "6px",
                                        cursor: isProcessingStop ? "wait" : "pointer"
                                    }}
                                >
                                    <span style={{ fontSize: "2.5rem" }}>
                                        {isProcessingStop ? "⏳" : (isRecording ? "⏹️" : "🎙️")}
                                    </span>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 900, letterSpacing: "0.5px" }}>
                                        {isProcessingStop ? "PROCESANDO" : (isRecording ? `${recordingTime}s REC` : "PULSAR PTT")}
                                    </span>
                                </button>
                            </div>

                            {/* Selector de Códec Táctico */}
                            <div style={{
                                width: "100%", padding: "14px", borderRadius: "14px",
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                display: "flex", flexDirection: "column", gap: "10px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#FFFFFF" }}>
                                            🎙️ Modo Códec: {useTacticalVocoder ? "Vocoder Militar 8kHz ADPCM" : "Estándar Opus"}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                            {useTacticalVocoder ? "1.6 kbps · Ideal para LoRa y radio acústica" : "32 kbps · Alta fidelidad en Wi-Fi"}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setUseTacticalVocoder(!useTacticalVocoder)}
                                        style={{
                                            padding: "5px 12px", borderRadius: "8px",
                                            background: useTacticalVocoder ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                            border: useTacticalVocoder ? "1px solid #00E676" : "1px solid rgba(255, 255, 255, 0.1)",
                                            color: useTacticalVocoder ? "#00E676" : "var(--text-secondary)",
                                            fontWeight: 900, fontSize: "0.72rem", cursor: "pointer"
                                        }}
                                    >
                                        {useTacticalVocoder ? "ACTIVO" : "OFF"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: RÁFAGAS GUARDADAS */}
                    {activeTab === "bursts" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {bursts.length === 0 ? (
                                <div style={{
                                    textAlign: "center", padding: "30px 16px",
                                    background: "rgba(14, 18, 38, 0.9)", borderRadius: "18px",
                                    border: "1px dashed rgba(255, 255, 255, 0.12)"
                                }}>
                                    <div style={{ fontSize: "2rem", marginBottom: "6px" }}>📻</div>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#FFFFFF" }}>
                                        Sin Ráfagas de Voz Registradas
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                        Usa la pestaña PTT para emitir o recibir ráfagas de audio en la malla.
                                    </div>
                                </div>
                            ) : (
                                bursts.map(b => (
                                    <div
                                        key={b.id}
                                        style={{
                                            padding: "14px 16px", borderRadius: "14px",
                                            background: "linear-gradient(135deg, rgba(16, 22, 44, 0.9) 0%, rgba(8, 12, 28, 0.95) 100%)",
                                            border: "1px solid rgba(255, 112, 67, 0.25)",
                                            display: "flex", justifyContent: "space-between", alignItems: "center"
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF" }}>
                                                {b.sender_nickname || "Operador RED"} · {b.duration_seconds}s
                                            </div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                                {new Date(b.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: "8px" }}>
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
                                                {playingBurstId === b.id ? "⏹️ STOP" : "▶️ REPRODUCIR"}
                                            </button>
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
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

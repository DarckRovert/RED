"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { MessageItem } from "../../lib/api";
import { indexedMediaVault } from "../../lib/indexedMediaVault";
import { LocalAIEngine } from "../../lib/localAiEngine";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

// ── Global Voice Note Coordinator (Single active audio & speed sync) ──────────
class VoiceCoordinator {
    private activeMsgId: string | null = null;
    private listeners: Map<string, () => void> = new Map();

    public register(msgId: string, pauseFn: () => void) {
        this.listeners.set(msgId, pauseFn);
    }

    public unregister(msgId: string) {
        this.listeners.delete(msgId);
    }

    public notifyPlaying(msgId: string) {
        if (this.activeMsgId && this.activeMsgId !== msgId) {
            const prevPause = this.listeners.get(this.activeMsgId);
            if (prevPause) {
                try { prevPause(); } catch {}
            }
        }
        this.activeMsgId = msgId;
    }

    public notifyStopped(msgId: string) {
        if (this.activeMsgId === msgId) {
            this.activeMsgId = null;
        }
    }
}
const globalVoiceCoordinator = new VoiceCoordinator();

interface VoiceMessageProps {
    msg: MessageItem;
    isMine: boolean;
}

export function VoiceMessage({ msg, isMine }: VoiceMessageProps) {
    const { t } = useTranslation();
    const audioRef = useRef<HTMLAudioElement>(null);
    const waveContainerRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState<number>((msg.duration_ms || 0) / 1000);
    
    // Load persistent playback speed preference
    const [playbackRate, setPlaybackRate] = useState<number>(() => {
        if (typeof window === "undefined") return 1.0;
        try {
            const saved = localStorage.getItem("red_voice_speed");
            return saved ? (parseFloat(saved) || 1.0) : 1.0;
        } catch { return 1.0; }
    });
    
    const [isDragging, setIsDragging] = useState(false);
    const [resolvedAudioSrc, setResolvedAudioSrc] = useState<string>("");
    const [transcription, setTranscription] = useState<string | null>(msg.transcription || null);
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

    // Register with global coordinator to prevent overlapping playback
    useEffect(() => {
        globalVoiceCoordinator.register(msg.id, () => {
            if (audioRef.current) {
                audioRef.current.pause();
                setPlaying(false);
            }
        });
        return () => {
            globalVoiceCoordinator.unregister(msg.id);
        };
    }, [msg.id]);

    const getAudioDataUrl = (dataStr: string): string => {
        if (!dataStr) return "";
        if (dataStr.startsWith("data:") || dataStr.startsWith("http") || dataStr.startsWith("blob:")) return dataStr;
        if (dataStr.startsWith("GkXf")) return `data:audio/webm;base64,${dataStr}`;
        if (dataStr.startsWith("AAAA")) return `data:audio/mp4;base64,${dataStr}`;
        if (dataStr.startsWith("UklG")) return `data:audio/wav;base64,${dataStr}`;
        if (dataStr.startsWith("T2dn")) return `data:audio/ogg;base64,${dataStr}`;
        return `data:audio/webm;base64,${dataStr}`;
    };

    const rawData = msg.media_data || (msg.content && !msg.content.startsWith("[") ? msg.content : undefined);

    useEffect(() => {
        let isMounted = true;
        if (rawData) {
            if (rawData.startsWith("red_vault://")) {
                indexedMediaVault.resolveMediaUrl(rawData).then(resolved => {
                    if (isMounted) setResolvedAudioSrc(getAudioDataUrl(resolved));
                }).catch(() => {
                    if (isMounted) setResolvedAudioSrc("");
                });
            } else {
                setResolvedAudioSrc(getAudioDataUrl(rawData));
            }
        }
        return () => { isMounted = false; };
    }, [rawData]);

    const audioSrc = resolvedAudioSrc;

    // Generate deterministic tactical waveform profile based on message id/payload
    const waveformBars = useMemo(() => {
        const seedStr = msg.id + (msg.content || "") + (msg.duration_ms || "");
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const bars: number[] = [];
        const count = 26;
        for (let i = 0; i < count; i++) {
            const pseudoRand = Math.abs(Math.sin(hash + i * 1.37) * 10000);
            const val = pseudoRand - Math.floor(pseudoRand);
            // Height between 4px and 22px
            const height = Math.round(4 + val * 18);
            bars.push(height);
        }
        return bars;
    }, [msg.id, msg.content, msg.duration_ms]);

    const togglePlay = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) {
            a.pause();
            setPlaying(false);
            globalVoiceCoordinator.notifyStopped(msg.id);
        } else {
            globalVoiceCoordinator.notifyPlaying(msg.id);
            a.playbackRate = playbackRate;
            a.play().catch(e => console.warn("[VoiceMessage] Play error:", e));
            setPlaying(true);
        }
    };

    const toggleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextRate = playbackRate === 1.0 ? 1.5 : playbackRate === 1.5 ? 2.0 : 1.0;
        setPlaybackRate(nextRate);
        try {
            localStorage.setItem("red_voice_speed", nextRate.toString());
        } catch {}
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            try { navigator.vibrate(10); } catch {}
        }
        if (audioRef.current) {
            audioRef.current.playbackRate = nextRate;
        }
    };

    const handleTimeUpdate = () => {
        if (!isDragging && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
                setDuration(audioRef.current.duration);
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleEnded = () => {
        setPlaying(false);
        setCurrentTime(0);
    };

    const seekToPosition = useCallback((clientX: number) => {
        if (!waveContainerRef.current || !audioRef.current) return;
        const rect = waveContainerRef.current.getBoundingClientRect();
        const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const ratio = clickX / rect.width;
        const totalDuration = duration > 0 ? duration : (msg.duration_ms ? msg.duration_ms / 1000 : 1);
        const newTime = ratio * totalDuration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration, msg.duration_ms]);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        seekToPosition(e.clientX);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            seekToPosition(e.clientX);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (isDragging) {
            setIsDragging(false);
            try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {}
        }
    };

    const handleTranscribe = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioSrc) {
            toast.error("Audio no cargado aún.");
            return;
        }
        setIsTranscribing(true);
        try {
            const res = await LocalAIEngine.transcribeAudio(audioSrc);
            setTranscription(res.text);
            toast.success("📝 Audio transcrito localmente");
        } catch (err: any) {
            toast.error("Error en transcripción local");
        } finally {
            setIsTranscribing(false);
        }
    };

    const formatTime = (secs: number): string => {
        if (isNaN(secs) || secs < 0) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const activeBarIndex = Math.floor(progressRatio * waveformBars.length);

    const primaryColor = isMine ? "var(--primary-bright, #FF3355)" : "var(--accent-cyan, #00E5FF)";
    const inactiveColor = isMine ? "rgba(255, 255, 255, 0.28)" : "rgba(0, 229, 255, 0.25)";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: 230, userSelect: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Play/Pause Button */}
                <button
                    onClick={togglePlay}
                    style={{
                        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                        background: isMine ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 229, 255, 0.18)",
                        border: `1.5px solid ${isMine ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 229, 255, 0.45)"}`,
                        color: "#FFFFFF", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1rem", fontWeight: 900,
                        boxShadow: isMine ? "0 0 10px rgba(255, 51, 85, 0.25)" : "0 0 12px rgba(0, 229, 255, 0.25)",
                        transition: "transform 0.1s ease, background 0.2s ease"
                    }}
                    title={playing ? "Pausar" : "Reproducir"}
                >
                    {playing ? "❚❚" : "▶"}
                </button>

                {/* Interactive Waveform & Scrubbing Zone */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div
                        ref={waveContainerRef}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        style={{
                            display: "flex", alignItems: "center", gap: "2.5px", height: 26,
                            cursor: "pointer", touchAction: "none", position: "relative"
                        }}
                        title="Arrastra para avanzar o retroceder"
                    >
                        {waveformBars.map((height, i) => {
                            const isPlayed = i <= activeBarIndex;
                            return (
                                <div
                                    key={i}
                                    style={{
                                        width: 3.5,
                                        height: height,
                                        borderRadius: 3,
                                        background: isPlayed ? (isMine ? "#FFFFFF" : primaryColor) : inactiveColor,
                                        transform: isPlayed && playing ? "scaleY(1.15)" : "scaleY(1)",
                                        transition: "background 0.1s ease, transform 0.1s ease",
                                        flexShrink: 0
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* Sub-info: Time & Speed Toggle & Transcribe Button */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace" }}>
                        <span style={{ color: "rgba(255, 255, 255, 0.85)", fontWeight: 700 }}>
                            {formatTime(currentTime)} / {formatTime(duration || (msg.duration_ms ? msg.duration_ms / 1000 : 0))}
                        </span>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {!transcription && (
                                <button
                                    onClick={handleTranscribe}
                                    disabled={isTranscribing}
                                    style={{
                                        background: "rgba(255, 255, 255, 0.10)",
                                        border: "1px solid rgba(255, 255, 255, 0.20)",
                                        borderRadius: "6px",
                                        padding: "1px 6px",
                                        fontSize: "0.62rem",
                                        fontWeight: 800,
                                        color: "#FFFFFF",
                                        cursor: "pointer"
                                    }}
                                    title="Transcribir nota de voz"
                                >
                                    {isTranscribing ? "⏳..." : "📝 AI"}
                                </button>
                            )}

                            <button
                                onClick={toggleSpeed}
                                style={{
                                    background: isMine ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 229, 255, 0.12)",
                                    border: `1px solid ${isMine ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 229, 255, 0.25)"}`,
                                    borderRadius: "6px",
                                    padding: "1px 5px",
                                    fontSize: "0.64rem",
                                    fontWeight: 800,
                                    color: isMine ? "#FFFFFF" : primaryColor,
                                    cursor: "pointer"
                                }}
                                title="Cambiar velocidad de reproducción"
                            >
                                {playbackRate}x
                            </button>
                        </div>
                    </div>
                </div>

                {audioSrc && (
                    <audio
                        ref={audioRef}
                        src={audioSrc}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={handleEnded}
                        onError={() => setPlaying(false)}
                        style={{ display: "none" }}
                    />
                )}
            </div>

            {/* Local Whisper Transcription View */}
            {transcription && (
                <div style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    background: "rgba(0, 0, 0, 0.45)",
                    borderLeft: `3px solid ${primaryColor}`,
                    fontSize: "0.78rem",
                    color: "rgba(255, 255, 255, 0.95)",
                    lineHeight: 1.45,
                    marginTop: "4px",
                    animation: "fadeIn 0.2s ease-out"
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.62rem", fontWeight: 800, color: primaryColor, fontFamily: "JetBrains Mono, monospace" }}>
                            📝 TRANSCRIPCIÓN IA LOCAL
                        </span>
                        <div style={{ display: "flex", gap: "6px" }}>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const { TacticalSpeechEngine } = await import("../../lib/ai");
                                    if (TacticalSpeechEngine.isSpeaking()) {
                                        TacticalSpeechEngine.stopSpeaking();
                                    } else {
                                        TacticalSpeechEngine.speak(transcription, { lang: "es-ES" });
                                    }
                                }}
                                style={{
                                    background: "rgba(255, 255, 255, 0.1)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    borderRadius: "4px",
                                    padding: "1px 5px",
                                    fontSize: "0.62rem",
                                    color: "#FFFFFF",
                                    cursor: "pointer"
                                }}
                                title="Escuchar transcripción en voz alta"
                            >
                                🔊
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard?.writeText(transcription);
                                    toast.success("📋 Transcripción copiada");
                                }}
                                style={{
                                    background: "rgba(255, 255, 255, 0.1)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    borderRadius: "4px",
                                    padding: "1px 5px",
                                    fontSize: "0.62rem",
                                    color: "#FFFFFF",
                                    cursor: "pointer"
                                }}
                                title="Copiar texto"
                            >
                                📋
                            </button>
                        </div>
                    </div>
                    <div>{transcription}</div>
                </div>
            )}
            {isTranscribing && (
                <div style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: "rgba(0, 229, 255, 0.08)",
                    border: "1px dashed rgba(0, 229, 255, 0.3)",
                    fontSize: "0.72rem",
                    color: "var(--accent-cyan)",
                    fontFamily: "JetBrains Mono, monospace",
                    marginTop: "2px",
                    animation: "pulse 1s infinite alternate"
                }}>
                    ⏳ Transcribiendo audio con IA local (Whisper)...
                </div>
            )}
        </div>
    );
}
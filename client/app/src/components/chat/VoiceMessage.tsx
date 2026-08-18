"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { MessageItem } from "../../lib/api";

interface VoiceMessageProps {
    msg: MessageItem;
    isMine: boolean;
}

export function VoiceMessage({ msg, isMine }: VoiceMessageProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const waveContainerRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState<number>((msg.duration_ms || 0) / 1000);
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);
    const [isDragging, setIsDragging] = useState(false);

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
    const audioSrc = rawData ? getAudioDataUrl(rawData) : undefined;

    // Generate deterministic tactical waveform profile based on message id/payload
    const waveformBars = useMemo(() => {
        const seedStr = msg.id + (msg.content || "") + (msg.duration_ms || "");
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const bars: number[] = [];
        const count = 28;
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
        } else {
            a.playbackRate = playbackRate;
            a.play().catch(e => console.warn("[VoiceMessage] Play error:", e));
            setPlaying(true);
        }
    };

    const toggleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextRate = playbackRate === 1.0 ? 1.5 : playbackRate === 1.5 ? 2.0 : 1.0;
        setPlaybackRate(nextRate);
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

    const formatTime = (secs: number): string => {
        if (isNaN(secs) || secs < 0) return "0:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const activeBarIndex = Math.floor(progressRatio * waveformBars.length);

    const primaryColor = isMine ? "#000000" : "var(--accent-cyan)";
    const inactiveColor = isMine ? "rgba(0,0,0,0.3)" : "rgba(0,229,255,0.3)";

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 230, userSelect: "none" }}>
            {/* Play/Pause Button */}
            <button
                onClick={togglePlay}
                style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: isMine ? "rgba(0,0,0,0.18)" : "rgba(0,229,255,0.18)",
                    border: `1.5px solid ${isMine ? "rgba(0,0,0,0.3)" : "rgba(0,229,255,0.4)"}`,
                    color: primaryColor, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1rem", fontWeight: 900,
                    boxShadow: isMine ? "none" : "0 0 12px rgba(0,229,255,0.25)",
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
                                    background: isPlayed ? primaryColor : inactiveColor,
                                    transform: isPlayed && playing ? "scaleY(1.15)" : "scaleY(1)",
                                    transition: "background 0.1s ease, transform 0.1s ease",
                                    flexShrink: 0
                                }}
                            />
                        );
                    })}
                </div>

                {/* Sub-info: Time & Speed Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace" }}>
                    <span style={{ color: isMine ? "rgba(0,0,0,0.75)" : "var(--text-muted)", fontWeight: 700 }}>
                        {formatTime(currentTime)} / {formatTime(duration || (msg.duration_ms ? msg.duration_ms / 1000 : 0))}
                    </span>
                    <button
                        onClick={toggleSpeed}
                        style={{
                            background: isMine ? "rgba(0,0,0,0.1)" : "rgba(0,229,255,0.12)",
                            border: `1px solid ${isMine ? "rgba(0,0,0,0.2)" : "rgba(0,229,255,0.25)"}`,
                            borderRadius: "6px",
                            padding: "1px 5px",
                            fontSize: "0.64rem",
                            fontWeight: 800,
                            color: primaryColor,
                            cursor: "pointer"
                        }}
                        title="Cambiar velocidad de reproducción"
                    >
                        {playbackRate}x
                    </button>
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
    );
}
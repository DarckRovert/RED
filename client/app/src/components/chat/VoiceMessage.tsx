"use client";

import React, { useState, useRef } from "react";
import { MessageItem } from "../../lib/api";

interface VoiceWaveProps {
    playing: boolean;
    color: string;
}

export function VoiceWave({ playing, color }: VoiceWaveProps) {
    const heights = [4, 8, 14, 10, 18, 12, 20, 14, 10, 8, 16, 12, 6, 14, 10, 8, 16, 12, 18, 10, 8, 14, 6, 10, 14];
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "2px", height: 24 }}>
            {heights.map((h, i) => (
                <div
                    key={i}
                    style={{
                        width: 3, height: h, borderRadius: 2, background: color,
                        opacity: playing ? 0.95 : 0.45,
                        animation: playing ? "pulse 0.8s infinite ease-in-out" : "none",
                        animationDelay: `${(i * 50) % 800}ms`,
                        transition: "opacity 0.3s ease",
                    }}
                />
            ))}
        </div>
    );
}

interface VoiceMessageProps {
    msg: MessageItem;
    isMine: boolean;
}

export function VoiceMessage({ msg, isMine }: VoiceMessageProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);

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

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) {
            a.pause();
            setPlaying(false);
        } else {
            a.play().catch(() => {});
            setPlaying(true);
        }
    };

    const color = isMine ? "#000" : "var(--accent-cyan)";

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 200 }}>
            <button
                onClick={toggle}
                style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    background: isMine ? "rgba(0,0,0,0.15)" : "rgba(0,229,255,0.15)",
                    border: `1px solid ${isMine ? "rgba(0,0,0,0.2)" : "rgba(0,229,255,0.3)"}`,
                    color: isMine ? "#000" : "var(--accent-cyan)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isMine ? "none" : "0 0 10px rgba(0,229,255,0.2)"
                }}
            >
                {playing ? "❚❚" : "▶"}
            </button>
            <div style={{ flex: 1 }}>
                <VoiceWave playing={playing} color={color} />
                <div style={{ fontSize: "0.68rem", color: isMine ? "rgba(0,0,0,0.7)" : "var(--text-muted)", marginTop: 3, fontFamily: "JetBrains Mono, monospace" }}>
                    {msg.duration_ms ? `${Math.round(msg.duration_ms / 1000)}s` : "Nota de voz"} · OPUS
                </div>
            </div>
            {audioSrc && (
                <audio
                    ref={audioRef}
                    src={audioSrc}
                    onEnded={() => setPlaying(false)}
                    style={{ display: "none" }}
                />
            )}
        </div>
    );
}
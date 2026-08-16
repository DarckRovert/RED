"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

interface LiveStreamViewerProps {
    streamId: string;
    onClose?: () => void;
}

export function LiveStreamViewer({ streamId, onClose }: LiveStreamViewerProps) {
    const { liveStreams, identity, addLiveComment } = useRedStore();

    const stream = liveStreams[streamId];
    const [comment, setComment] = useState("");
    const [lastFrame, setLastFrame] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const s = liveStreams[streamId];
        if (!s) return;
        if (s.frames && s.frames.length > 0) {
            const newestFrame = s.frames[s.frames.length - 1];
            const frameB64 = typeof newestFrame === "string" ? newestFrame : (newestFrame?.media_data || null);
            if (frameB64) {
                setLastFrame(frameB64);
            }
        }
        if (s.is_active === false) {
            const t = setTimeout(() => onClose?.(), 2000);
            return () => clearTimeout(t);
        }
    }, [liveStreams, streamId, onClose]);

    useEffect(() => {
        if (!stream) return;
        const startedAt = stream.started_at;
        elapsedRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
    }, [stream]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [stream?.comments]);

    const sendComment = useCallback(async () => {
        const text = comment.trim();
        if (!text || !stream || !identity) return;
        setComment("");

        addLiveComment(streamId, identity.short_id || identity.identity_hash.substring(0, 6), text);

        try {
            await RedAPI.sendMessage(stream.broadcaster_hash, text, {
                msg_type: "live_comment",
                conversation_id: streamId,
                reaction: `live:${streamId}`,
            });
        } catch {}
    }, [comment, stream, identity, streamId, addLiveComment]);

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    if (!stream) {
        return (
            <div style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "#000", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 16,
            }}>
                <div style={{ fontSize: "2.5rem" }}>📡</div>
                <div style={{ fontWeight: 700 }}>Transmisión no encontrada o finalizada</div>
                <button onClick={onClose} className="btn-tactical-secondary" style={{ padding: "8px 16px" }}>
                    Volver
                </button>
            </div>
        );
    }

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#000", color: "white",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
        }}>
            {/* Video Canvas Container */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070D" }}>
                {lastFrame ? (
                    <img
                        src={lastFrame}
                        alt="Live Frame"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", color: "var(--text-muted)" }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--accent-cyan)", animation: "pulse 1s infinite" }} />
                        <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Conectando con la señal de malla...</div>
                    </div>
                )}
            </div>

            {/* Top HUD Controls */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                padding: "calc(16px + var(--safe-top, 0px)) 16px 16px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
                zIndex: 10
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        padding: "4px 10px", borderRadius: "var(--radius-full)",
                        background: stream.is_active ? "var(--accent-crimson)" : "#444",
                        color: "#fff", fontSize: "0.74rem", fontWeight: 900,
                        display: "flex", alignItems: "center", gap: "6px"
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: stream.is_active ? "pulse 1s infinite" : "none" }} />
                        {stream.is_active ? `EN VIVO · ${formatElapsed(elapsed)}` : "FINALIZADO"}
                    </div>

                    <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>
                        {stream.broadcaster_name}
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="btn-icon"
                    style={{ background: "rgba(0,0,0,0.5)", width: 38, height: 38 }}
                    title="Salir"
                >
                    ✕
                </button>
            </div>

            {/* Live Comments Overlay */}
            <div style={{
                position: "absolute", bottom: "70px", left: "16px", right: "16px",
                maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px",
                zIndex: 10
            }}>
                {stream.comments.map((c, i) => (
                    <div key={i} style={{ padding: "6px 12px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: "12px", fontSize: "0.80rem", color: "#fff", maxWidth: "80%" }}>
                        <strong style={{ color: "var(--accent-cyan)" }}>{c.sender}: </strong>
                        {c.text}
                    </div>
                ))}
                <div ref={commentsEndRef} />
            </div>

            {/* Bottom Comment Input */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "12px 16px calc(12px + var(--safe-bottom, 0px)) 16px",
                display: "flex", gap: "8px",
                background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)",
                zIndex: 10
            }}>
                <input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendComment(); }}
                    placeholder="Enviar un comentario en directo..."
                    style={{ flex: 1, background: "rgba(0,0,0,0.7)", border: "1px solid var(--glass-border)", borderRadius: "var(--radius-full)", padding: "10px 16px", color: "#fff", fontSize: "0.85rem" }}
                />
                <button
                    onClick={sendComment}
                    disabled={!comment.trim()}
                    className="btn-tactical-primary"
                    style={{ padding: "10px 18px", borderRadius: "var(--radius-full)", fontSize: "0.85rem" }}
                >
                    Enviar
                </button>
            </div>
        </div>
    );
}
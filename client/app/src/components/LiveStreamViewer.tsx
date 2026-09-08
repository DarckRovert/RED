"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { toast } from "./Toast";

interface LiveStreamViewerProps {
    streamId: string;
    onClose?: () => void;
}

export function LiveStreamViewer({ streamId, onClose }: LiveStreamViewerProps) {
    const { liveStreams, identity, addLiveComment } = useRedStore();
    const { t } = useTranslation();

    const stream = liveStreams[streamId];
    const [comment, setComment] = useState("");
    const [lastFrame, setLastFrame] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [showReticle, setShowReticle] = useState(false);
    const [framesReceived, setFramesReceived] = useState(0);

    const commentsEndRef = useRef<HTMLDivElement>(null);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastRenderedSeqRef = useRef<number | string>(-1);

    // ─── 1. Interceptor de Hardware Android (BackHandlerRegistry) ─────────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            onClose?.();
            return true;
        });
        return unregister;
    }, [onClose]);

    // ─── 2. Procesamiento de Fotogramas Entrantes ──────────────────────────────
    useEffect(() => {
        const s = liveStreams[streamId];
        if (!s) return;
        if (s.frames && s.frames.length > 0) {
            const newestFrame = s.frames[s.frames.length - 1];
            const frameSeq = typeof newestFrame === "object" && newestFrame !== null ? newestFrame.seq : undefined;
            const frameB64 = typeof newestFrame === "string" ? newestFrame : (newestFrame?.media_data || null);

            const isNewFrame = frameSeq !== undefined 
                ? frameSeq !== lastRenderedSeqRef.current 
                : frameB64 !== lastFrame;

            if (isNewFrame && frameB64) {
                lastRenderedSeqRef.current = frameSeq !== undefined ? frameSeq : frameB64.slice(-32);
                setLastFrame(frameB64);
                setFramesReceived(c => c + 1);
            }
        }
        if (s.is_active === false) {
            const t = setTimeout(() => onClose?.(), 3000);
            return () => clearTimeout(t);
        }
    }, [liveStreams, streamId, onClose, lastFrame]);

    // ─── 3. Temporizador de Transmisión ────────────────────────────────────────
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

    // ─── 4. Enviar Comentario en Directo ───────────────────────────────────────
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

    // ─── 5. Captura Táctica de Fotograma ───────────────────────────────────────
    const handleCaptureSnapshot = () => {
        if (!lastFrame) {
            toast.warning("No hay fotograma activo para capturar");
            return;
        }
        try {
            const a = document.createElement("a");
            a.href = lastFrame;
            a.download = `RED_ISR_Capture_${streamId.slice(0, 10)}_${Date.now()}.jpg`;
            a.click();
            toast.success("📸 Fotograma de inteligencia exportado");
        } catch {
            toast.error("Error al exportar captura");
        }
    };

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    const incomingFps = elapsed > 0 ? (framesReceived / elapsed).toFixed(1) : "0.0";

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
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--accent-cyan)", animation: "pulse 1s infinite" }} />
                        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-cyan)" }}>Sincronizando flujo de video multicast...</div>
                        <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>ID: {streamId}</div>
                    </div>
                )}

                {/* Retícula Táctica Militar C4ISR Overlay */}
                {showReticle && (
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
                        <svg width="100%" height="100%" style={{ opacity: 0.55 }}>
                            <line x1="50%" y1="15%" x2="50%" y2="85%" stroke="var(--accent-cyan)" strokeWidth="1" strokeDasharray="6 4" />
                            <line x1="15%" y1="50%" x2="85%" y2="50%" stroke="var(--accent-cyan)" strokeWidth="1" strokeDasharray="6 4" />
                            <circle cx="50%" cy="50%" r="52" stroke="var(--accent-cyan)" strokeWidth="1.2" fill="none" />
                            <circle cx="50%" cy="50%" r="4" fill="var(--accent-cyan)" />
                            {/* Esquinas tácticas */}
                            <path d="M 30 50 L 30 30 L 50 30" stroke="var(--accent-cyan)" strokeWidth="2" fill="none" />
                            <path d="M 30 calc(100% - 50px) L 30 calc(100% - 30px) L 50 calc(100% - 30px)" stroke="var(--accent-cyan)" strokeWidth="2" fill="none" />
                        </svg>
                        <div style={{ position: "absolute", top: "70px", left: "20px", fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)", background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "4px" }}>
                            OBSERVACIÓN C4ISR · ISR HUD ACTIVO
                        </div>
                    </div>
                )}
            </div>

            {/* Top HUD Controls */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0,
                padding: "calc(16px + var(--safe-top, 0px)) 16px 16px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)",
                zIndex: 10
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{
                        padding: "4px 10px", borderRadius: "var(--radius-full)",
                        background: stream.is_active ? "var(--accent-crimson)" : "#444",
                        color: "#fff", fontSize: "0.74rem", fontWeight: 900,
                        display: "flex", alignItems: "center", gap: "6px"
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: stream.is_active ? "pulse 1s infinite" : "none" }} />
                        {stream.is_active ? `EN VIVO · ${formatElapsed(elapsed)}` : "FINALIZADO"}
                    </div>

                    <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>
                        {stream.broadcaster_name}
                    </div>

                    {stream.is_active && (
                        <div style={{ padding: "4px 8px", borderRadius: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid var(--glass-border)", fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)" }}>
                            {incomingFps} FPS RECIBIDOS · SEQ {stream.frame_seq >= 0 ? stream.frame_seq : 0}
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                        onClick={() => setShowReticle(r => !r)}
                        className="btn-icon"
                        style={{
                            background: showReticle ? "rgba(0, 229, 255, 0.25)" : "rgba(0,0,0,0.5)",
                            border: showReticle ? "1px solid var(--accent-cyan)" : "1px solid transparent",
                            width: 38, height: 38
                        }}
                        title="Alternar retícula táctica C4ISR"
                    >
                        🎯
                    </button>

                    <button
                        onClick={handleCaptureSnapshot}
                        disabled={!lastFrame}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                        title="Capturar y exportar fotograma a disco"
                    >
                        📸 Captura
                    </button>

                    <button
                        onClick={onClose}
                        className="btn-icon"
                        style={{ background: "rgba(0,0,0,0.5)", width: 38, height: 38 }}
                        title="Salir"
                    >
                        ✕
                    </button>
                </div>
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
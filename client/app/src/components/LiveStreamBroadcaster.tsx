"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { toast } from "./Toast";

const FRAME_INTERVAL_MS = 500;
const FRAME_QUALITY = 0.35;
const FRAME_WIDTH = 240;
const FRAME_HEIGHT = 320;

export function LiveStreamBroadcaster({ onClose }: { onClose?: () => void }) {
    const { contacts, identity } = useRedStore();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const frameSeqRef = useRef(0);

    const [streamId] = useState(() => `live-${Date.now()}-${identity?.identity_hash ? identity.identity_hash.slice(0, 6) : "local"}`);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    const [isLive, setIsLive] = useState(false);
    const [camReady, setCamReady] = useState(false);
    const [camError, setCamError] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [framesSent, setFramesSent] = useState(0);
    const [comments, setComments] = useState<{ sender: string; text: string }[]>([]);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const liveStreams = useRedStore(s => s.liveStreams);
    useEffect(() => {
        const stream = liveStreams[streamId];
        if (stream) setComments(stream.comments.slice(-20));
    }, [liveStreams, streamId]);

    useEffect(() => {
        let cancelled = false;
        navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: FRAME_WIDTH }, height: { ideal: FRAME_HEIGHT } },
            audio: false,
        }).then(stream => {
            if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
            }
            setCamReady(true);
            setCamError(null);
        }).catch(err => {
            if (!cancelled) setCamError(err.message || "Cámara no disponible");
        });

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, [facingMode]);

    const captureAndSendFrame = useCallback(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        canvas.width = FRAME_WIDTH;
        canvas.height = FRAME_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
        const dataUrl = canvas.toDataURL("image/jpeg", FRAME_QUALITY);
        const seq = frameSeqRef.current++;

        await RedAPI.sendLiveFrame(contacts, streamId, dataUrl, seq).catch(() => {});
        setFramesSent(s => s + 1);
    }, [contacts, streamId]);

    const startLive = useCallback(async () => {
        if (!camReady || isLive) return;
        setIsLive(true);
        frameSeqRef.current = 0;
        setFramesSent(0);
        setElapsed(0);

        await RedAPI.sendLiveAnnounce(contacts, streamId).catch(console.error);

        useRedStore.setState(s => ({
            liveStreams: {
                ...s.liveStreams,
                [streamId]: {
                    stream_id: streamId,
                    broadcaster_hash: identity?.identity_hash || "",
                    broadcaster_name: identity?.nickname || identity?.short_id || "Yo",
                    started_at: Date.now(),
                    is_active: true,
                    frames: [],
                    frame_seq: -1,
                    comments: [],
                },
            },
            isStreaming: true,
            streamId,
        }));

        elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
        frameIntervalRef.current = setInterval(captureAndSendFrame, FRAME_INTERVAL_MS);
        toast.info("🔴 Transmisión iniciada en la malla P2P");
    }, [camReady, isLive, contacts, streamId, identity, captureAndSendFrame]);

    const stopLive = useCallback(async () => {
        if (!isLive) return;
        setIsLive(false);

        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);

        await RedAPI.sendLiveEnd(contacts, streamId).catch(console.error);

        useRedStore.setState(s => ({
            liveStreams: {
                ...s.liveStreams,
                [streamId]: {
                    ...(s.liveStreams[streamId] || {}),
                    is_active: false,
                },
            },
            isStreaming: false,
            streamId: null,
        }));
        toast.info("Transmisión finalizada");
    }, [isLive, contacts, streamId]);

    const handleClose = () => {
        if (isLive) stopLive();
        onClose?.();
    };

    const formatElapsed = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#000", color: "white",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
        }}>
            {/* Video Canvas Container */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        width: "100%", height: "100%", objectFit: "cover",
                        transform: facingMode === "user" ? "scaleX(-1)" : "none"
                    }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />

                {camError && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
                        <div style={{ color: "var(--accent-crimson-bright)", fontWeight: 800 }}>⚠️ {camError}</div>
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
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                        padding: "4px 10px", borderRadius: "var(--radius-full)",
                        background: isLive ? "var(--accent-crimson)" : "rgba(255,255,255,0.2)",
                        color: "#fff", fontSize: "0.74rem", fontWeight: 900,
                        display: "flex", alignItems: "center", gap: "6px"
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: isLive ? "pulse 1s infinite" : "none" }} />
                        {isLive ? `EN VIVO · ${formatElapsed(elapsed)}` : "VISTA PREVIA"}
                    </div>

                    {isLive && (
                        <div style={{ padding: "4px 8px", borderRadius: "var(--radius-full)", background: "rgba(0,0,0,0.5)", fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace" }}>
                            {framesSent} fps
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}
                        className="btn-icon"
                        style={{ background: "rgba(0,0,0,0.5)", width: 38, height: 38 }}
                        title="Girar cámara"
                    >
                        🔄
                    </button>

                    <button
                        onClick={handleClose}
                        className="btn-icon"
                        style={{ background: "rgba(0,0,0,0.5)", width: 38, height: 38 }}
                        title="Cerrar"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Live Comments Overlay */}
            <div style={{
                position: "absolute", bottom: "100px", left: "16px", right: "16px",
                maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px",
                pointerEvents: "none", zIndex: 10
            }}>
                {comments.map((c, i) => (
                    <div key={i} style={{ padding: "6px 12px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: "12px", fontSize: "0.80rem", color: "#fff", maxWidth: "80%" }}>
                        <strong style={{ color: "var(--accent-cyan)" }}>{c.sender}: </strong>
                        {c.text}
                    </div>
                ))}
            </div>

            {/* Bottom Action Bar */}
            <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "20px 16px calc(24px + var(--safe-bottom, 0px)) 16px",
                display: "flex", justifyContent: "center", alignItems: "center",
                background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)",
                zIndex: 10
            }}>
                {!isLive ? (
                    <button
                        onClick={startLive}
                        disabled={!camReady}
                        className="btn-tactical-primary"
                        style={{ padding: "14px 28px", fontSize: "1rem", borderRadius: "var(--radius-full)", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)", boxShadow: "0 4px 20px rgba(255,51,85,0.4)" }}
                    >
                        🔴 INICIAR TRANSMISIÓN EN VIVO
                    </button>
                ) : (
                    <button
                        onClick={stopLive}
                        className="btn-tactical-primary"
                        style={{ padding: "14px 28px", fontSize: "1rem", borderRadius: "var(--radius-full)", background: "#333" }}
                    >
                        ⏹️ FINALIZAR DIRECTO
                    </button>
                )}
            </div>
        </div>
    );
}
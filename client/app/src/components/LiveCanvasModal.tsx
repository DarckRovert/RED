"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { postChannelMessage, getChannelMessages } from "../lib/api";

const CANVAS_SYNC_CHANNEL = "canvas-sync";
const SYNC_INTERVAL_MS = 2000;

interface PeerFrame {
    senderName: string;
    senderId: string;
    frameBase64: string;
    timestamp: number;
}

export const LiveCanvasModal: React.FC = () => {
    const { goBack, identity } = useRedStore();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("#00E5FF");
    const [lineWidth, setLineWidth] = useState(4);
    const [isEraser, setIsEraser] = useState(false);
    const [peerFrames, setPeerFrames] = useState<PeerFrame[]>([]);
    const hasDrawnSinceLastSync = useRef(false);

    const myNickname = identity?.nickname || "Operador RED";
    const myHash = identity?.identity_hash || "local_node";

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#080A14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    const syncCanvasToNetwork = useCallback(async () => {
        if (!hasDrawnSinceLastSync.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const dataUrl = canvas.toDataURL("image/png", 0.5);
            const base64 = dataUrl.split(",")[1];

            await postChannelMessage({
                channel_id: CANVAS_SYNC_CHANNEL,
                content: `CANVAS_FRAME:${base64}`,
                sender_name: myNickname
            });

            hasDrawnSinceLastSync.current = false;
        } catch {}
    }, [myNickname]);

    const fetchPeerFrames = useCallback(async () => {
        try {
            const response = await getChannelMessages(CANVAS_SYNC_CHANNEL);
            const rawMessages = response.messages ?? [];
            const peerLatestMap = new Map<string, PeerFrame>();

            rawMessages.forEach((m: any) => {
                if (m.content?.startsWith("CANVAS_FRAME:") && m.sender !== myHash) {
                    const base64 = m.content.replace("CANVAS_FRAME:", "");
                    const senderName = m.sender_name || (m.sender ? m.sender.slice(0, 8) : "Nodo Peer");
                    peerLatestMap.set(m.sender || senderName, {
                        senderName,
                        senderId: m.sender || "peer",
                        frameBase64: base64,
                        timestamp: m.timestamp || Date.now()
                    });
                }
            });

            setPeerFrames(Array.from(peerLatestMap.values()).slice(-4));
        } catch {}
    }, [myHash]);

    useEffect(() => {
        const syncInterval = setInterval(syncCanvasToNetwork, SYNC_INTERVAL_MS);
        const fetchInterval = setInterval(fetchPeerFrames, SYNC_INTERVAL_MS);
        return () => {
            clearInterval(syncInterval);
            clearInterval(fetchInterval);
        };
    }, [syncCanvasToNetwork, fetchPeerFrames]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.strokeStyle = isEraser ? "#080A14" : color;
        ctx.lineWidth = isEraser ? lineWidth * 3 : lineWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        hasDrawnSinceLastSync.current = true;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#080A14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasDrawnSinceLastSync.current = true;
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
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
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.4)"
                    }}>🎨</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Pizarra Táctica Colaborativa
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            P2P MESH CANVAS SYNC · CANAL {CANVAS_SYNC_CHANNEL}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={clearCanvas}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    >
                        🗑️ Limpiar
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Toolbar */}
            <div style={{
                padding: "10px 16px", background: "rgba(10,12,22,0.9)", borderBottom: "1px solid var(--glass-border)",
                display: "flex", gap: "12px", alignItems: "center", overflowX: "auto"
            }}>
                {["#00E5FF", "#00E676", "#FF3355", "#FFA726", "#FFFFFF"].map(c => (
                    <div
                        key={c}
                        onClick={() => { setColor(c); setIsEraser(false); }}
                        style={{
                            width: 26, height: 26, borderRadius: "50%", background: c,
                            border: color === c && !isEraser ? "2px solid #fff" : "2px solid rgba(255,255,255,0.2)",
                            cursor: "pointer", flexShrink: 0
                        }}
                    />
                ))}

                <button
                    onClick={() => setIsEraser(e => !e)}
                    className={isEraser ? "btn-tactical-primary" : "btn-tactical-secondary"}
                    style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                >
                    🧹 Borrador
                </button>
            </div>

            {/* Canvas Area */}
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070D" }}>
                <canvas
                    ref={canvasRef}
                    width={360}
                    height={480}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                        background: "#080A14", border: "1px solid var(--glass-border)", borderRadius: "16px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.8)", touchAction: "none"
                    }}
                />

                {/* Trazos y Pizarras Sincronizadas de Pares de la Malla */}
                {peerFrames.length > 0 && (
                    <div style={{
                        position: "absolute", bottom: 16, right: 16, display: "flex", gap: "8px",
                        zIndex: 10, maxWidth: "calc(100% - 32px)", overflowX: "auto"
                    }}>
                        {peerFrames.map((pf) => (
                            <div
                                key={pf.senderId}
                                className="card-tactical animate-enter"
                                style={{
                                    padding: "6px", width: 85, background: "rgba(10,12,24,0.92)",
                                    border: "1px solid var(--accent-cyan)", boxShadow: "0 4px 16px rgba(0,229,255,0.25)"
                                }}
                            >
                                <div style={{
                                    fontSize: "0.60rem", fontWeight: 800, color: "var(--accent-cyan)",
                                    marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                                }}>
                                    ● {pf.senderName}
                                </div>
                                <img
                                    src={`data:image/png;base64,${pf.frameBase64}`}
                                    alt={pf.senderName}
                                    style={{ width: "100%", height: 75, objectFit: "contain", background: "#080A14", borderRadius: "6px" }}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
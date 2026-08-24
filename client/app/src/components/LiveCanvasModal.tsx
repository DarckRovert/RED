"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";

interface VectorStroke {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    color: string;
    width: number;
    isEraser?: boolean;
    sender?: string;
}

const COLOR_PALETTE = [
    { label: "Cian Táctico", value: "#00E5FF" },
    { label: "Esmeralda Neón", value: "#00E676" },
    { label: "Ámbar Alerta", value: "#FFB300" },
    { label: "Carmesí Peligro", value: "#FF1744" },
    { label: "Blanco Táctico", value: "#FFFFFF" },
    { label: "Púrpura Sigilo", value: "#D946EF" }
];

export const LiveCanvasModal: React.FC = () => {
    const { goBack, identity } = useRedStore();
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("#00E5FF");
    const [tool, setTool] = useState<"pen" | "marker" | "eraser">("pen");
    const [lineWidth, setLineWidth] = useState(4);
    const [peerCount, setPeerCount] = useState(0);

    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const myNickname = identity?.nickname || "Operador RED";
    const myHash = identity?.identity_hash || "local_node";

    // Setup canvas background
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set high-DPI canvas
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width || 800;
        canvas.height = rect.height || 600;

        ctx.fillStyle = "#080A14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw tactical grid
        ctx.strokeStyle = "rgba(0, 229, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 30) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
    }, []);

    useEffect(() => {
        initCanvas();
        window.addEventListener("resize", initCanvas);
        return () => window.removeEventListener("resize", initCanvas);
    }, [initCanvas]);

    // Handle remote canvas strokes
    useEffect(() => {
        const handleRemoteEvent = (e: any) => {
            const detail = e.detail;
            if (!detail) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            if (detail.type === "canvas_clear") {
                ctx.fillStyle = "#080A14";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                toast.info("🧹 Pizarra limpiada por un operador de la malla");
                return;
            }

            if (detail.type === "canvas_stroke" || detail.x0 !== undefined) {
                const stroke: VectorStroke = detail;
                ctx.beginPath();
                ctx.moveTo(stroke.x0 * canvas.width, stroke.y0 * canvas.height);
                ctx.lineTo(stroke.x1 * canvas.width, stroke.y1 * canvas.height);
                ctx.strokeStyle = stroke.isEraser ? "#080A14" : stroke.color;
                ctx.lineWidth = stroke.width;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.stroke();
            }
        };

        window.addEventListener("red_canvas_remote_event", handleRemoteEvent);
        return () => window.removeEventListener("red_canvas_remote_event", handleRemoteEvent);
    }, []);

    // Broadcast stroke to mesh
    const broadcastStroke = async (x0: number, y0: number, x1: number, y1: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const effectiveWidth = tool === "eraser" ? lineWidth * 4 : (tool === "marker" ? lineWidth * 2.5 : lineWidth);
        const strokeData: VectorStroke = {
            x0: x0 / canvas.width,
            y0: y0 / canvas.height,
            x1: x1 / canvas.width,
            y1: y1 / canvas.height,
            color,
            width: effectiveWidth,
            isEraser: tool === "eraser",
            sender: myNickname
        };

        try {
            const { meshRouter } = await import("../lib/mesh/meshRouter");
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                msg_type: "canvas_stroke",
                ...strokeData,
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);
        } catch {}
    };

    const broadcastClear = async () => {
        try {
            const { meshRouter } = await import("../lib/mesh/meshRouter");
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                id: `clear_${Date.now()}`,
                msg_type: "canvas_clear",
                sender: myNickname,
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);
        } catch {}
    };

    const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const pos = getPos(e);
        lastPosRef.current = pos;
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !lastPosRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const currentPos = getPos(e);
        const effectiveWidth = tool === "eraser" ? lineWidth * 4 : (tool === "marker" ? lineWidth * 2.5 : lineWidth);

        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.strokeStyle = tool === "eraser" ? "#080A14" : color;
        ctx.lineWidth = effectiveWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        broadcastStroke(lastPosRef.current.x, lastPosRef.current.y, currentPos.x, currentPos.y);
        lastPosRef.current = currentPos;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPosRef.current = null;
    };

    const handleClearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#080A14";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        broadcastClear();
        toast.success("Pizarra limpiada");
    };

    const handleExportSnapshot = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            const dataUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `RED_Tactic_Canvas_${Date.now()}.png`;
            a.click();
            toast.success("📸 Captura táctica exportada");
        } catch {
            toast.error("Error al exportar captura");
        }
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
                padding: "12px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(0,229,255,0.2) 0%, rgba(217,70,239,0.3) 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", border: "1px solid var(--glass-border)"
                    }}>
                        🎨
                    </div>
                    <div>
                        <div style={{ fontSize: "1.02rem", fontWeight: 800 }}>
                            Lienzo Táctico Colaborativo
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                            SINCRONIZACIÓN VECTORIAL EN TIEMPO REAL · P2P MESH
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={handleExportSnapshot}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                        title="Exportar imagen PNG"
                    >
                        📸 Exportar
                    </button>
                    <button
                        onClick={handleClearCanvas}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.74rem", borderColor: "rgba(255,23,68,0.4)", color: "var(--accent-crimson)" }}
                        title="Limpiar pizarra"
                    >
                        🧹 Limpiar
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        style={{ width: 36, height: 36 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Toolbar Táctica */}
            <div style={{
                padding: "8px 16px",
                background: "rgba(10, 12, 22, 0.95)",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "12px", flexWrap: "wrap", flexShrink: 0
            }}>
                {/* Herramientas */}
                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        onClick={() => setTool("pen")}
                        className={tool === "pen" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 12px", fontSize: "0.76rem", borderRadius: "8px" }}
                    >
                        ✏️ Pluma
                    </button>
                    <button
                        onClick={() => setTool("marker")}
                        className={tool === "marker" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 12px", fontSize: "0.76rem", borderRadius: "8px" }}
                    >
                        🖌️ Resaltador
                    </button>
                    <button
                        onClick={() => setTool("eraser")}
                        className={tool === "eraser" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 12px", fontSize: "0.76rem", borderRadius: "8px" }}
                    >
                        🧹 Borrador
                    </button>
                </div>

                {/* Paleta de Colores */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {COLOR_PALETTE.map(c => (
                        <div
                            key={c.value}
                            onClick={() => { setColor(c.value); if (tool === "eraser") setTool("pen"); }}
                            title={c.label}
                            style={{
                                width: 22, height: 22, borderRadius: "50%",
                                background: c.value, cursor: "pointer",
                                border: color === c.value && tool !== "eraser" ? "2px solid #FFFFFF" : "1px solid rgba(0,0,0,0.5)",
                                boxShadow: color === c.value && tool !== "eraser" ? `0 0 10px ${c.value}` : "none",
                                transform: color === c.value && tool !== "eraser" ? "scale(1.18)" : "scale(1)",
                                transition: "all 0.15s ease"
                            }}
                        />
                    ))}
                </div>

                {/* Grosor de Línea */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Grosor:</span>
                    {[2, 4, 8, 14].map(w => (
                        <button
                            key={w}
                            onClick={() => setLineWidth(w)}
                            style={{
                                width: 24, height: 24, borderRadius: "6px",
                                background: lineWidth === w ? "rgba(0, 229, 255, 0.2)" : "rgba(255,255,255,0.05)",
                                border: lineWidth === w ? "1px solid var(--accent-cyan)" : "1px solid transparent",
                                color: lineWidth === w ? "var(--accent-cyan)" : "var(--text-muted)",
                                fontSize: "0.70rem", fontWeight: 800, cursor: "pointer"
                            }}
                        >
                            {w}
                        </button>
                    ))}
                </div>
            </div>

            {/* Canvas Interactivo de Alta Sensibilidad */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#080A14" }}>
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    style={{
                        width: "100%", height: "100%",
                        display: "block", touchAction: "none", cursor: tool === "eraser" ? "cell" : "crosshair"
                    }}
                />
            </div>
        </div>
    );
};
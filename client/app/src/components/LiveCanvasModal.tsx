"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
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
    tool?: "pen" | "marker" | "arrow" | "box" | "eraser";
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

type TacticalTool = "pen" | "marker" | "arrow" | "box" | "eraser";

export const LiveCanvasModal: React.FC = () => {
    const { goBack, identity } = useRedStore();
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("#00E5FF");
    const [tool, setTool] = useState<TacticalTool>("pen");
    const [lineWidth, setLineWidth] = useState(4);
    const [peerCount, setPeerCount] = useState(0);

    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const snapshotImageDataRef = useRef<ImageData | null>(null);
    const pendingStrokesRef = useRef<VectorStroke[]>([]);
    const flushTimerRef = useRef<any>(null);

    const myNickname = identity?.nickname || "Operador RED";

    // ─── 1. Interceptor de Hardware Físico LIFO (BackHandlerRegistry) ────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
        return unregister;
    }, [goBack]);

    // ─── 2. Telemetría Reactiva de Pares Malla ───────────────────────────────
    useEffect(() => {
        let isMounted = true;
        const updatePeers = async () => {
            try {
                const { meshRouter } = await import("../lib/mesh/meshRouter");
                if (isMounted) {
                    setPeerCount(meshRouter.getAllPeers().length);
                }
            } catch {}
        };
        updatePeers();
        const interval = setInterval(updatePeers, 2500);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // ─── 3. Motor de Renderizado Vectorial ────────────────────────────────────
    const drawStrokeOnCanvas = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, stroke: VectorStroke) => {
        ctx.save();
        ctx.lineWidth = stroke.width;
        ctx.strokeStyle = stroke.isEraser ? "#080A14" : stroke.color;
        ctx.fillStyle = stroke.isEraser ? "#080A14" : stroke.color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const x0 = stroke.x0 * canvas.width;
        const y0 = stroke.y0 * canvas.height;
        const x1 = stroke.x1 * canvas.width;
        const y1 = stroke.y1 * canvas.height;

        if (stroke.tool === "arrow") {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();

            const angle = Math.atan2(y1 - y0, x1 - x0);
            const headLen = Math.max(12, stroke.width * 3);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
        } else if (stroke.tool === "box") {
            const rx = Math.min(x0, x1);
            const ry = Math.min(y0, y1);
            const rw = Math.abs(x1 - x0);
            const rh = Math.abs(y1 - y0);
            ctx.beginPath();
            ctx.rect(rx, ry, rw, rh);
            ctx.stroke();
            if (!stroke.isEraser) {
                ctx.fillStyle = stroke.color.length === 7 ? `${stroke.color}22` : "rgba(0, 229, 255, 0.12)";
                ctx.fill();
            }
        } else {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }
        ctx.restore();
    }, []);

    // ─── 4. Inicialización del Fondo y Rejilla Táctica ────────────────────────
    const renderBackgroundAndGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
        ctx.fillStyle = "#080A14";
        ctx.fillRect(0, 0, width, height);

        // Rejilla táctica
        ctx.strokeStyle = "rgba(0, 229, 255, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 30) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
    }, []);

    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width || 800;
        canvas.height = rect.height || 600;

        renderBackgroundAndGrid(ctx, canvas.width, canvas.height);
    }, [renderBackgroundAndGrid]);

    useEffect(() => {
        initCanvas();
        window.addEventListener("resize", initCanvas);
        return () => window.removeEventListener("resize", initCanvas);
    }, [initCanvas]);

    // ─── 5. Escucha de Trazos y Lotes Remotos de la Malla ──────────────────────
    useEffect(() => {
        const handleRemoteEvent = (e: any) => {
            const detail = e.detail;
            if (!detail) return;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            if (detail.type === "canvas_clear") {
                renderBackgroundAndGrid(ctx, canvas.width, canvas.height);
                toast.info("🧹 Pizarra limpiada por un operador de la malla");
                return;
            }

            if (detail.type === "canvas_stroke_batch" && Array.isArray(detail.strokes)) {
                for (const stroke of detail.strokes) {
                    drawStrokeOnCanvas(ctx, canvas, stroke);
                }
                return;
            }

            if (detail.type === "canvas_stroke" || detail.x0 !== undefined) {
                drawStrokeOnCanvas(ctx, canvas, detail as VectorStroke);
            }
        };

        window.addEventListener("red_canvas_remote_event", handleRemoteEvent);
        return () => window.removeEventListener("red_canvas_remote_event", handleRemoteEvent);
    }, [drawStrokeOnCanvas]);

    // ─── 6. Micro-Agrupación (Stroke Batching) Anti-Saturación ────────────────
    const flushPendingStrokes = useCallback(async () => {
        if (pendingStrokesRef.current.length === 0) return;
        const strokesToSend = [...pendingStrokesRef.current];
        pendingStrokesRef.current = [];

        try {
            const { meshRouter } = await import("../lib/mesh/meshRouter");
            if (strokesToSend.length === 1) {
                const payloadBytes = new TextEncoder().encode(JSON.stringify({
                    id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    msg_type: "canvas_stroke",
                    ...strokesToSend[0],
                    timestamp: Date.now()
                }));
                await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);
            } else {
                const payloadBytes = new TextEncoder().encode(JSON.stringify({
                    id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    msg_type: "canvas_stroke_batch",
                    strokes: strokesToSend,
                    timestamp: Date.now()
                }));
                await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);
            }
        } catch {}
    }, []);

    const queueStroke = useCallback((stroke: VectorStroke) => {
        pendingStrokesRef.current.push(stroke);
        if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
                flushTimerRef.current = null;
                flushPendingStrokes();
            }, 45); // Micro-lotes cada 45ms (evita saturación en LoRa / BLE)
        }
    }, [flushPendingStrokes]);

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

    // ─── 7. Interacción Táctil y Ratón ─────────────────────────────────────────
    const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const touch = "touches" in e && e.touches.length > 0 
            ? e.touches[0] 
            : ("changedTouches" in e && (e as any).changedTouches?.length > 0 ? (e as any).changedTouches[0] : null);
        const clientX = touch ? touch.clientX : ("clientX" in e ? (e as React.MouseEvent).clientX : 0);
        const clientY = touch ? touch.clientY : ("clientY" in e ? (e as React.MouseEvent).clientY : 0);
        return {
            x: (clientX - rect.left) * (canvas.width / (rect.width || 1)),
            y: (clientY - rect.top) * (canvas.height / (rect.height || 1))
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const pos = getPos(e);
        lastPosRef.current = pos;
        startPosRef.current = pos;
        setIsDrawing(true);

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx && (tool === "arrow" || tool === "box")) {
                snapshotImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !lastPosRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const currentPos = getPos(e);
        const effectiveWidth = tool === "eraser" ? lineWidth * 4 : (tool === "marker" ? lineWidth * 2.5 : lineWidth);

        if (tool === "arrow" || tool === "box") {
            if (snapshotImageDataRef.current && startPosRef.current) {
                ctx.putImageData(snapshotImageDataRef.current, 0, 0);
                drawStrokeOnCanvas(ctx, canvas, {
                    x0: startPosRef.current.x / canvas.width,
                    y0: startPosRef.current.y / canvas.height,
                    x1: currentPos.x / canvas.width,
                    y1: currentPos.y / canvas.height,
                    color,
                    width: effectiveWidth,
                    tool,
                    isEraser: false,
                    sender: myNickname
                });
            }
        } else {
            const strokeData: VectorStroke = {
                x0: lastPosRef.current.x / canvas.width,
                y0: lastPosRef.current.y / canvas.height,
                x1: currentPos.x / canvas.width,
                y1: currentPos.y / canvas.height,
                color,
                width: effectiveWidth,
                tool,
                isEraser: tool === "eraser",
                sender: myNickname
            };

            drawStrokeOnCanvas(ctx, canvas, strokeData);
            queueStroke(strokeData);
        }
        lastPosRef.current = currentPos;
    };

    const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (canvas && (tool === "arrow" || tool === "box") && startPosRef.current && lastPosRef.current) {
            const finalPos = e ? getPos(e) : lastPosRef.current;
            const dist = Math.hypot(finalPos.x - startPosRef.current.x, finalPos.y - startPosRef.current.y);

            if (dist >= 4) {
                const effectiveWidth = lineWidth;
                const strokeData: VectorStroke = {
                    x0: startPosRef.current.x / canvas.width,
                    y0: startPosRef.current.y / canvas.height,
                    x1: finalPos.x / canvas.width,
                    y1: finalPos.y / canvas.height,
                    color,
                    width: effectiveWidth,
                    tool,
                    isEraser: false,
                    sender: myNickname
                };

                const ctx = canvas.getContext("2d");
                if (ctx && snapshotImageDataRef.current) {
                    ctx.putImageData(snapshotImageDataRef.current, 0, 0);
                    drawStrokeOnCanvas(ctx, canvas, strokeData);
                }

                queueStroke(strokeData);
            } else if (snapshotImageDataRef.current) {
                // Toque accidental menor a 4 píxeles: restaurar estado limpio previo
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.putImageData(snapshotImageDataRef.current, 0, 0);
                }
            }
        }

        setIsDrawing(false);
        lastPosRef.current = null;
        startPosRef.current = null;
        snapshotImageDataRef.current = null;

        // Limpiar temporizador y forzar envío inmediato de los últimos segmentos acumulados
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        flushPendingStrokes();
    };

    const handleClearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderBackgroundAndGrid(ctx, canvas.width, canvas.height);
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
                        <div style={{ fontSize: "1.02rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>Lienzo Táctico Colaborativo</span>
                            <span style={{
                                fontSize: "0.65rem",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                background: peerCount > 0 ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 179, 0, 0.2)",
                                color: peerCount > 0 ? "var(--accent-emerald)" : "var(--accent-amber)",
                                border: `1px solid ${peerCount > 0 ? "var(--accent-emerald)" : "var(--accent-amber)"}`,
                                fontWeight: 800
                            }}>
                                {peerCount > 0 ? `🟢 ${peerCount} PARES EN MALLA` : "🟡 MODO LOCAL / ESPERANDO"}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                            SINCRONIZACIÓN VECTORIAL EN TIEMPO REAL · MICRO-LOTES ANTI-SATURACIÓN (45ms)
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
                {/* Herramientas Tácticas */}
                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        onClick={() => setTool("pen")}
                        className={tool === "pen" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 10px", fontSize: "0.74rem", borderRadius: "8px" }}
                    >
                        ✏️ Pluma
                    </button>
                    <button
                        onClick={() => setTool("marker")}
                        className={tool === "marker" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 10px", fontSize: "0.74rem", borderRadius: "8px" }}
                    >
                        🖌️ Resaltador
                    </button>
                    <button
                        onClick={() => setTool("arrow")}
                        className={tool === "arrow" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 10px", fontSize: "0.74rem", borderRadius: "8px" }}
                        title="Vector táctico de maniobra"
                    >
                        ↗️ Flecha Táctica
                    </button>
                    <button
                        onClick={() => setTool("box")}
                        className={tool === "box" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 10px", fontSize: "0.74rem", borderRadius: "8px" }}
                        title="Perímetro de zona de operaciones"
                    >
                        ▢ Zona Táctica
                    </button>
                    <button
                        onClick={() => setTool("eraser")}
                        className={tool === "eraser" ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "6px 10px", fontSize: "0.74rem", borderRadius: "8px" }}
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
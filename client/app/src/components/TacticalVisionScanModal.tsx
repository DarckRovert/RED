"use client";

import React, { useState, useEffect, useRef } from "react";
import { tacticalEdgeVision, TacticalVisionFilter, DetectedVisionObject } from "../lib/ai/TacticalEdgeVisionEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function TacticalVisionScanModal() {
    const { navigate } = useRedStore();
    const [filter, setFilter] = useState<TacticalVisionFilter>("NVG_PHOSPHOR");
    const [detections, setDetections] = useState<DetectedVisionObject[]>([]);
    const [cameraActive, setCameraActive] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraActive(true);
                startProcessingLoop();
            }
        } catch (e) {
            console.error("[TacticalVisionScanModal] Error starting camera:", e);
            toast.error("No se pudo acceder a la cámara trasera");
        }
    };

    const stopCamera = () => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    const startProcessingLoop = () => {
        const loop = () => {
            if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
                const detected = tacticalEdgeVision.processVideoFrame(
                    videoRef.current,
                    canvasRef.current,
                    filter
                );
                setDetections(detected);
            }
            animFrameRef.current = requestAnimationFrame(loop);
        };
        animFrameRef.current = requestAnimationFrame(loop);
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "#050812", color: "#FFF",
            display: "flex", flexDirection: "column",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 15, 30, 0.95)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>👁️</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            VISIÓN TÁCTICA EDGE AI
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Reconocimiento Óptico y Clasificación de Amenazas en Vivo
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => navigate("commandCenter")}
                    style={{
                        background: "rgba(232, 33, 58, 0.2)", border: "1px solid #E8213A",
                        color: "#FFF", padding: "6px 12px", borderRadius: "8px",
                        cursor: "pointer", fontWeight: 800, fontSize: "0.75rem"
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Video Canvas Container */}
            <div style={{
                flex: 1, position: "relative", background: "#000",
                display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden"
            }}>
                <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{ display: "none" }}
                />
                <canvas
                    ref={canvasRef}
                    width={640}
                    height={480}
                    style={{
                        width: "100%", height: "100%", objectFit: "cover",
                        border: filter === "NVG_PHOSPHOR" ? "2px solid #00E676" : filter === "FLIR_THERMAL" ? "2px solid #FF3355" : "none"
                    }}
                />

                {/* Retícula Holográfica Central */}
                <div style={{
                    position: "absolute", inset: 0, pointerEvents: "none",
                    display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                    <div style={{
                        width: "120px", height: "120px", border: "1px dashed rgba(0, 229, 255, 0.4)",
                        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                        <div style={{ width: "4px", height: "4px", background: "#00E5FF", borderRadius: "50%" }} />
                    </div>
                </div>

                {/* Badge de Detección de Amenazas */}
                {detections.length > 0 && (
                    <div style={{
                        position: "absolute", top: "14px", left: "14px",
                        background: "rgba(232, 33, 58, 0.85)", border: "1px solid #FFF",
                        borderRadius: "8px", padding: "8px 12px", fontSize: "0.75rem", fontWeight: 900
                    }}>
                        ⚠️ {detections.length} AMENAZA(S) DETECTADA(S)
                    </div>
                )}
            </div>

            {/* Bottom Tactical Controls */}
            <div style={{
                padding: "14px", background: "rgba(10, 15, 30, 0.95)",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                display: "flex", flexDirection: "column", gap: "10px"
            }}>
                {/* Selector de Filtros */}
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setFilter("NORMAL")}
                        style={{
                            flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.74rem", fontWeight: 800,
                            background: filter === "NORMAL" ? "#FFF" : "rgba(255,255,255,0.06)",
                            color: filter === "NORMAL" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                        }}
                    >
                        👁️ Óptico Normal
                    </button>
                    <button
                        onClick={() => setFilter("NVG_PHOSPHOR")}
                        style={{
                            flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.74rem", fontWeight: 800,
                            background: filter === "NVG_PHOSPHOR" ? "#00E676" : "rgba(255,255,255,0.06)",
                            color: filter === "NVG_PHOSPHOR" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                        }}
                    >
                        🥽 NVG Fósforo Verde
                    </button>
                    <button
                        onClick={() => setFilter("FLIR_THERMAL")}
                        style={{
                            flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.74rem", fontWeight: 800,
                            background: filter === "FLIR_THERMAL" ? "#FF3355" : "rgba(255,255,255,0.06)",
                            color: filter === "FLIR_THERMAL" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                        }}
                    >
                        🌡️ FLIR Pseudotérmico
                    </button>
                </div>
            </div>
        </div>
    );
}

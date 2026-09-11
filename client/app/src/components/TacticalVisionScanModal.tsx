"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../lib/i18n/i18nEngine";
import {
    tacticalEdgeVision,
    TacticalVisionFilter,
    TacticalEnvironmentMode,
    DetectedVisionObject
} from "../lib/ai/TacticalEdgeVisionEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { RedAPI } from "../lib/api";
import { TacticalSpeechEngine } from "../lib/ai/TacticalSpeechEngine";
import { meshRouter } from "../lib/mesh/meshRouter";

export function TacticalVisionScanModal() {
    const { t } = useTranslation();
    const { goBack } = useRedStore();

    const [filter, setFilter] = useState<TacticalVisionFilter>("NORMAL");
    const [envMode, setEnvMode] = useState<TacticalEnvironmentMode>("AUTO");
    const [detections, setDetections] = useState<DetectedVisionObject[]>([]);
    const [cameraActive, setCameraActive] = useState<boolean>(false);
    const [torchOn, setTorchOn] = useState<boolean>(false);
    const [hasTorch, setHasTorch] = useState<boolean>(false);
    const [capturedFlash, setCapturedFlash] = useState<boolean>(false);
    const [isBroadcastingAlert, setIsBroadcastingAlert] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);

    // Refs mutables para el bucle de requestAnimationFrame (evita closures congeladas)
    const filterRef = useRef<TacticalVisionFilter>(filter);
    const envModeRef = useRef<TacticalEnvironmentMode>(envMode);
    const lastUiUpdateRef = useRef<number>(0);
    const lastThreatAlertTsRef = useRef<number>(0);
    const isMountedRef = useRef<boolean>(true);

    // ── Intercepción Jerárquica LIFO de navegación Atrás ───────────────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            stopCamera();
            goBack();
            return true;
        });
        return unregister;
    }, [goBack]);

    useEffect(() => {
        filterRef.current = filter;
    }, [filter]);

    useEffect(() => {
        envModeRef.current = envMode;
    }, [envMode]);

    useEffect(() => {
        isMountedRef.current = true;
        startCamera();
        return () => {
            isMountedRef.current = false;
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });

            if (!isMountedRef.current) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            streamRef.current = stream;

            // Verificar si el sensor soporta linterna / flash táctico
            const track = stream.getVideoTracks()[0];
            if (track) {
                const capabilities = (track.getCapabilities?.() || {}) as any;
                if (capabilities.torch) {
                    setHasTorch(true);
                }
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => {});
                if (isMountedRef.current) {
                    setCameraActive(true);
                    startProcessingLoop();
                }
            }
        } catch (e) {
            if (isMountedRef.current) {
                console.error("[TacticalVisionScanModal] Error starting camera:", e);
                toast.error("No se pudo acceder a la cámara trasera");
            }
        }
    };

    const toggleTorch = async () => {
        TacticalAudioEngine.playTap();
        if (!streamRef.current) return;
        const track = streamRef.current.getVideoTracks()[0];
        if (!track) return;
        try {
            const nextState = !torchOn;
            await (track as any).applyConstraints({
                advanced: [{ torch: nextState }]
            });
            setTorchOn(nextState);
            toast.info(nextState ? "Iluminador Táctico LED: ACTIVADO" : "Iluminador Táctico LED: DESACTIVADO");
        } catch (err) {
            console.warn("[TacticalVisionScanModal] Torch toggle error:", err);
            toast.error("El hardware no permite alternar el flash");
        }
    };

    const stopCamera = () => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (streamRef.current) {
            const track = streamRef.current.getVideoTracks()[0];
            if (track) {
                try {
                    (track as any).applyConstraints({ advanced: [{ torch: false }] });
                } catch (_) {}
            }
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        tacticalEdgeVision.destroy();
        setCameraActive(false);
        setTorchOn(false);
    };

    const startProcessingLoop = () => {
        const loop = () => {
            if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
                // Siempre leemos de los refs mutables para garantizar respuesta inmediata a los botones
                const currentFilter = filterRef.current;
                const currentEnv = envModeRef.current;

                const detected = tacticalEdgeVision.processVideoFrame(
                    videoRef.current,
                    canvasRef.current,
                    currentFilter,
                    currentEnv
                );

                // Throttling de la actualización de estado en React a ~6 Hz para evitar recargar la CPU
                const now = performance.now();
                if (now - lastUiUpdateRef.current > 160) {
                    lastUiUpdateRef.current = now;
                    setDetections(detected);

                    // Alerta acústica en detección de amenazas (limitada para no saturar audio)
                    if (detected.length > 0 && now - lastThreatAlertTsRef.current > 4000) {
                        lastThreatAlertTsRef.current = now;
                        TacticalAudioEngine.playWarning();
                    }
                }
            }
            animFrameRef.current = requestAnimationFrame(loop);
        };
        animFrameRef.current = requestAnimationFrame(loop);
    };

    const handleFilterChange = (newFilter: TacticalVisionFilter) => {
        TacticalAudioEngine.playTap();
        filterRef.current = newFilter;
        setFilter(newFilter);
    };

    const handleEnvChange = (newEnv: TacticalEnvironmentMode) => {
        TacticalAudioEngine.playTap();
        envModeRef.current = newEnv;
        setEnvMode(newEnv);
        toast.info(
            newEnv === "INDOOR_CQB"
                ? "Modo Interior / CQB: Drones aéreos inhibidos"
                : newEnv === "OUTDOOR_SKY"
                ? "Modo Exterior: Escaneo UAV en cielo activo"
                : "Modo Automático: Calibración ambiental adaptativa"
        );
    };

    const captureForensicSnapshot = () => {
        TacticalAudioEngine.playRogerBeep();
        if (!canvasRef.current) return;
        setCapturedFlash(true);
        setTimeout(() => setCapturedFlash(false), 200);

        try {
            const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.92);
            const link = document.createElement("a");
            link.download = `RED_VISION_CAPTURE_${Date.now()}.jpg`;
            link.href = dataUrl;
            link.click();
            toast.success("Captura forense guardada con éxito");
        } catch (e) {
            console.error("Error capturing snapshot:", e);
            toast.error("Error al capturar fotograma");
        }
    };

    const handleBroadcastThreat = async () => {
        if (detections.length === 0 || isBroadcastingAlert) return;
        setIsBroadcastingAlert(true);
        TacticalAudioEngine.playEmergencyAlarm();
        const threat = detections[0];
        const alertBody = `🚨 [ALERTA ÓPTICA EDGE AI] ${threat.label} detectado (${threat.confidencePct}% certeza). ${threat.details || ''}`;

        try {
            // 1. Difusión P2P primaria por malla (off-grid, sin servidor)
            const alertPayload = new TextEncoder().encode(JSON.stringify({
                id: `vision_threat_${Date.now()}`,
                msg_type: 'VISION_THREAT_DETECTION',
                threat_type: threat.type,
                label: threat.label,
                confidence_pct: threat.confidencePct,
                details: threat.details || '',
                alert_body: alertBody,
                timestamp: Date.now()
            }));
            await meshRouter.send(
                'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                alertPayload
            ).catch(() => {});

            // 2. Fallback HTTP a contactos verificados (solo si hay servidor activo)
            const state = useRedStore.getState();
            const contacts = state.contacts || [];
            const recipients = contacts
                .filter((c: any) => c?.identity_hash && c.verified !== false)
                .map((c: any) => c.identity_hash);

            await Promise.allSettled(
                recipients.slice(0, 15).map(async (peerHash: string) => {
                    try {
                        await RedAPI.sendMessage(peerHash, alertBody, {
                            msg_type: 'tactical_threat_alert',
                            threat_type: threat.type,
                            confidence: threat.confidencePct,
                            timestamp: Date.now()
                        });
                    } catch {}
                })
            );

            TacticalSpeechEngine.speak(`Alerta táctica de ${threat.label} transmitida a la escuadra`, { lang: 'es-ES' });
            toast.success('Alerta táctica propagada por malla P2P');
        } catch {
            toast.error('Error al propagar alerta visual en la malla');
        } finally {
            setIsBroadcastingAlert(false);
        }
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "#050812", color: "#FFF",
            fontFamily: "JetBrains Mono, monospace",
            display: "flex", flexDirection: "column", height: "100%", position: "relative"
        }}>
            {/* Header Táctico */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 15, 30, 0.98)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                zIndex: 10
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: "rgba(0, 229, 255, 0.15)", border: "1px solid #00E5FF",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem"
                    }}>
                        👁️
                    </div>
                    <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 900, color: "#00E5FF", letterSpacing: "0.5px" }}>
                            {t('tactical_vision_modal.title')}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                            {t('tactical_vision_modal.subtitle')}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {hasTorch && (
                        <button
                            onClick={toggleTorch}
                            style={{
                                background: torchOn ? "rgba(255, 220, 0, 0.25)" : "rgba(255,255,255,0.06)",
                                border: torchOn ? "1px solid #FFD700" : "1px solid rgba(255,255,255,0.15)",
                                color: torchOn ? "#FFD700" : "#AAA",
                                padding: "6px 10px", borderRadius: "8px", cursor: "pointer",
                                fontSize: "0.72rem", fontWeight: 800
                            }}
                            title="Iluminador Táctico LED"
                        >
                            {torchOn ? "🔦 ON" : "🔦 OFF"}
                        </button>
                    )}

                    <button
                        onClick={captureForensicSnapshot}
                        style={{
                            background: "rgba(0, 229, 255, 0.15)", border: "1px solid #00E5FF",
                            color: "#00E5FF", padding: "6px 10px", borderRadius: "8px",
                            cursor: "pointer", fontSize: "0.72rem", fontWeight: 800
                        }}
                        title="Capturar fotograma analizado"
                    >
                        📸 FOTO
                    </button>

                    <button
                        onClick={() => { TacticalAudioEngine.playTap(); stopCamera(); goBack(); }}
                        style={{
                            background: "rgba(232, 33, 58, 0.2)", border: "1px solid #E8213A",
                            color: "#FFF", padding: "6px 12px", borderRadius: "8px",
                            cursor: "pointer", fontWeight: 800, fontSize: "0.75rem"
                        }}
                    >
                        ✕ {t('common.close')}
                    </button>
                </div>
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
                        display: "block"
                    }}
                />

                {/* Destello de captura fotográfica */}
                {capturedFlash && (
                    <div style={{
                        position: "absolute", inset: 0, background: "#FFF",
                        opacity: 0.8, pointerEvents: "none", zIndex: 20
                    }} />
                )}

                {/* Badge flotante de Alerta de Amenaza con Broadcast a la Malla */}
                {detections.length > 0 && (
                    <div style={{
                        position: "absolute", top: "14px", left: "14px", right: "14px",
                        background: "rgba(232, 33, 58, 0.94)", border: "1.5px solid #FFF",
                        borderRadius: "12px", padding: "10px 14px", fontSize: "0.74rem", fontWeight: 900,
                        boxShadow: "0 0 25px rgba(232, 33, 58, 0.7)",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
                        zIndex: 25
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                            <div>
                                <div style={{ letterSpacing: "0.5px" }}>{detections.length} AMENAZA(S) IDENTIFICADA(S)</div>
                                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#FFD2D2" }}>
                                    {detections[0].label} ({detections[0].confidencePct}%) {detections[0].details ? `· ${detections[0].details}` : ""}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleBroadcastThreat}
                            disabled={isBroadcastingAlert}
                            style={{
                                background: "#FFFFFF",
                                color: "#E8213A",
                                border: "none",
                                borderRadius: "8px",
                                padding: "6px 12px",
                                fontSize: "0.72rem",
                                fontWeight: 900,
                                cursor: isBroadcastingAlert ? "default" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                whiteSpace: "nowrap",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.4)"
                            }}
                        >
                            {isBroadcastingAlert ? "📡 ENVIANDO..." : "🚨 ALERTAR MALLA"}
                        </button>
                    </div>
                )}
            </div>

            {/* Controles Tácticos Inferiores */}
            <div style={{
                padding: "14px 16px", background: "rgba(8, 12, 24, 0.98)",
                borderTop: "1px solid rgba(255, 255, 255, 0.12)",
                display: "flex", flexDirection: "column", gap: "10px",
                zIndex: 10
            }}>
                {/* Selector de Modo Óptico (3 Modos con respuesta instantánea y shaders reales) */}
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => handleFilterChange("NORMAL")}
                        style={{
                            flex: 1, padding: "10px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 900,
                            background: filter === "NORMAL" ? "linear-gradient(135deg, #FFFFFF 0%, #E2E8F0 100%)" : "rgba(255,255,255,0.05)",
                            color: filter === "NORMAL" ? "#0A0E1A" : "#94A3B8",
                            border: filter === "NORMAL" ? "2px solid #00E5FF" : "1px solid rgba(255,255,255,0.1)",
                            cursor: "pointer",
                            boxShadow: filter === "NORMAL" ? "0 0 16px rgba(0, 229, 255, 0.4)" : "none",
                            transition: "all 0.15s ease"
                        }}
                    >
                        👁️ Óptico Normal
                    </button>

                    <button
                        onClick={() => handleFilterChange("NVG_PHOSPHOR")}
                        style={{
                            flex: 1, padding: "10px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 900,
                            background: filter === "NVG_PHOSPHOR" ? "linear-gradient(135deg, #00FF66 0%, #00C853 100%)" : "rgba(255,255,255,0.05)",
                            color: filter === "NVG_PHOSPHOR" ? "#021A08" : "#94A3B8",
                            border: filter === "NVG_PHOSPHOR" ? "2px solid #00FF66" : "1px solid rgba(255,255,255,0.1)",
                            cursor: "pointer",
                            boxShadow: filter === "NVG_PHOSPHOR" ? "0 0 16px rgba(0, 255, 102, 0.5)" : "none",
                            transition: "all 0.15s ease"
                        }}
                    >
                        🥽 NVG Fósforo Verde
                    </button>

                    <button
                        onClick={() => handleFilterChange("FLIR_THERMAL")}
                        style={{
                            flex: 1, padding: "10px 8px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 900,
                            background: filter === "FLIR_THERMAL" ? "linear-gradient(135deg, #FF3355 0%, #FF9900 100%)" : "rgba(255,255,255,0.05)",
                            color: filter === "FLIR_THERMAL" ? "#FFF" : "#94A3B8",
                            border: filter === "FLIR_THERMAL" ? "2px solid #FF3355" : "1px solid rgba(255,255,255,0.1)",
                            cursor: "pointer",
                            boxShadow: filter === "FLIR_THERMAL" ? "0 0 16px rgba(255, 51, 85, 0.5)" : "none",
                            transition: "all 0.15s ease"
                        }}
                    >
                        🌡️ FLIR Pseudotérmico
                    </button>
                </div>

                {/* Calibración de Entorno (Anti-Falsos Positivos) */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 12px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.06)", fontSize: "0.68rem"
                }}>
                    <span style={{ color: "#94A3B8", fontWeight: 700 }}>ENTORNO TÁCTICO:</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                        {[
                            { id: "AUTO", label: "🌐 Auto" },
                            { id: "INDOOR_CQB", label: "🏠 Interior (CQB)" },
                            { id: "OUTDOOR_SKY", label: "☁️ Cielo (UAV)" }
                        ].map(env => (
                            <button
                                key={env.id}
                                onClick={() => handleEnvChange(env.id as TacticalEnvironmentMode)}
                                style={{
                                    padding: "4px 8px", borderRadius: "6px", fontSize: "0.65rem", fontWeight: 800,
                                    background: envMode === env.id ? "rgba(0, 229, 255, 0.25)" : "transparent",
                                    color: envMode === env.id ? "#00E5FF" : "#64748B",
                                    border: envMode === env.id ? "1px solid #00E5FF" : "1px solid transparent",
                                    cursor: "pointer"
                                }}
                            >
                                {env.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

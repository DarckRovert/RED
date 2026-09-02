"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { opticalGasAqiEngine, AtmosphericTelemetry } from "../lib/sensors/OpticalGasAqiEngine";
import { toast } from "./Toast";

export function AtmosphericSafetyModal() {
    const { navigate, identity, goBack } = useRedStore();

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const prevLumaRef = useRef<number | null>(null);
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [telemetry, setTelemetry] = useState<AtmosphericTelemetry>(() => 
        opticalGasAqiEngine.analyzeOpticalFrame(120, 48, { r: 100, g: 100, b: 100 }, 0)
    );

    useEffect(() => {
        let stream: MediaStream | null = null;
        let animationFrame: number | null = null;

        const startCamera = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment", width: { ideal: 480 }, height: { ideal: 360 } }
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play();
                        setIsCameraActive(true);
                    }
                }
            } catch (e) {
                console.warn("[AtmosphericSafetyModal] Camera access error:", e);
            }
        };

        startCamera();

        let isActive = true;
        let lastProcessTime = 0;

        const loop = (timestamp: number) => {
            if (!isActive) return;

            if (timestamp - lastProcessTime >= 500) {
                lastProcessTime = timestamp;
                if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext("2d", { willReadFrequently: true });
                    if (ctx) {
                        ctx.drawImage(videoRef.current, 0, 0, 160, 120);
                        const frameData = ctx.getImageData(0, 0, 160, 120);
                        const data = frameData.data;

                        let totalLuma = 0;
                        let rTotal = 0, gTotal = 0, bTotal = 0;
                        const count = data.length / 4;

                        if (count > 0) {
                            for (let i = 0; i < data.length; i += 4) {
                                const r = data[i];
                                const g = data[i + 1];
                                const b = data[i + 2];
                                const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                                totalLuma += luma;
                                rTotal += r; gTotal += g; bTotal += b;
                            }

                            const meanLuma = totalLuma / count;
                            let variance = 0;
                            for (let i = 0; i < data.length; i += 4) {
                                const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                                variance += Math.pow(luma - meanLuma, 2);
                            }
                            const stdDev = Math.sqrt(variance / count);

                            // Varianza de parpadeo temporal calculada empíricamente entre fotogramas consecutivos
                            const flickerVariance = prevLumaRef.current !== null
                                ? Math.abs(meanLuma - prevLumaRef.current)
                                : 0;
                            prevLumaRef.current = meanLuma;

                            const result = opticalGasAqiEngine.analyzeOpticalFrame(
                                meanLuma,
                                stdDev,
                                { r: rTotal / count, g: gTotal / count, b: bTotal / count },
                                flickerVariance
                            );
                            setTelemetry(result);
                        }
                    }
                }
            }

            if (isActive) {
                animationFrame = requestAnimationFrame(loop);
            }
        };

        animationFrame = requestAnimationFrame(loop);

        return () => {
            isActive = false;
            if (animationFrame) cancelAnimationFrame(animationFrame);
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const getSeverityColor = (sev: string) => {
        switch (sev) {
            case "GOOD": return "#00E676";
            case "MODERATE": return "#FFB300";
            case "UNHEALTHY_SENSITIVE": return "#FF9100";
            case "UNHEALTHY": return "#FF3355";
            case "VERY_UNHEALTHY": return "#A855F7";
            case "HAZARDOUS_CRITICAL": return "#7E0023";
            default: return "#00E676";
        }
    };

    const handleBroadcastAlert = async () => {
        const { meshSosBeacon } = await import("../lib/emergency/MeshSosBeaconEngine");
        let batt = 100;
        if (typeof window !== 'undefined' && typeof (window as any).__red_last_battery === 'number') {
            batt = (window as any).__red_last_battery;
        } else if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
            try {
                const b: any = await (navigator as any).getBattery();
                if (b && typeof b.level === 'number') batt = Math.round(b.level * 100);
            } catch {}
        }
        const callerId = identity?.identity_hash ? `did:red:${identity.identity_hash.slice(0, 8)}` : "LOCAL_HAZMAT";
        const callerName = identity?.nickname || "Sensor Óptico AQI";
        await meshSosBeacon.activateSosBeacon({
            distressType: "NATURAL_DISASTER",
            triageColor: telemetry.aqiIndex > 200 ? "RED" : "YELLOW",
            note: `ALERTA TOXICIDAD ATMOSFÉRICA: AQI ${telemetry.aqiIndex} (${telemetry.severity}), PM2.5 ${telemetry.pm25Ugm3} ug/m3, CO ${telemetry.estimatedCoPpm} ppm. ${telemetry.recommendedMask}`,
            batteryLevel: batt
        }, callerId, callerName);
        toast.success("🚨 Alerta de Toxicidad Atmosférica transmitida por Malla SOS");
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "#050812", color: "#FFF",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 15, 30, 0.95)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>💨</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            ESPECTROMETRÍA ÓPTICA DE GAS & CALIDAD DE AIRE (AQI)
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Detección de Humo, Densidad PM2.5/PM10 y Riesgo de Asfixia
                        </div>
                    </div>
                </div>
                <button
                    onClick={goBack}
                    style={{

                        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                        color: "#FFF", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem"
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Camera Viewport & Spectral Reticle */}
                <div style={{
                    position: "relative", height: "200px", borderRadius: "12px",
                    overflow: "hidden", border: `2px solid ${getSeverityColor(telemetry.severity)}`,
                    background: "#000", display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                    <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <canvas ref={canvasRef} width={160} height={120} style={{ display: "none" }} />

                    {/* Reticle Overlay */}
                    <div style={{
                        position: "absolute", inset: 0,
                        background: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.6) 90%)",
                        pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "10px"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: getSeverityColor(telemetry.severity) }}>
                            <span>OPTICAL AQI SCAN: {isCameraActive ? "EN VIVO" : "STANDBY"}</span>
                            <span>OPACIDAD HUMO: {telemetry.smokeOpacityPct}%</span>
                        </div>
                        <div style={{ alignSelf: "center", width: "80px", height: "80px", border: `1px dashed ${getSeverityColor(telemetry.severity)}`, borderRadius: "50%" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#AAA" }}>
                            <span>EXTINCIÓN BEER-LAMBERT</span>
                            <span>DISPERSIÓN MIE: PM2.5/PM10</span>
                        </div>
                    </div>
                </div>

                {/* AQI Master Gauge */}
                <div style={{
                    padding: "16px", borderRadius: "12px",
                    background: "rgba(10, 18, 36, 0.8)", border: `1px solid ${getSeverityColor(telemetry.severity)}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                    <div>
                        <div style={{ fontSize: "0.75rem", color: "#AAA", fontWeight: 700 }}>ÍNDICE DE CALIDAD DE AIRE (AQI)</div>
                        <div style={{ fontSize: "2.4rem", fontWeight: 900, color: getSeverityColor(telemetry.severity) }}>
                            {telemetry.aqiIndex} <span style={{ fontSize: "0.9rem", color: "#FFF" }}>/ 500</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: getSeverityColor(telemetry.severity) }}>
                            ESTADO: {telemetry.severity}
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.7rem", color: "#AAA" }}>TIEMPO SEGURO SIN MÁSCARA</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: telemetry.safeStayMinutesWithoutMask < 30 ? "#FF3355" : "#00E676" }}>
                            {telemetry.safeStayMinutesWithoutMask >= 60 ? `${Math.round(telemetry.safeStayMinutesWithoutMask / 60)}h` : `${telemetry.safeStayMinutesWithoutMask} min`}
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={{ fontSize: "0.68rem", color: "#AAA" }}>PARTÍCULAS PM2.5</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#00E5FF" }}>{telemetry.pm25Ugm3} <span style={{ fontSize: "0.7rem" }}>µg/m³</span></div>
                    </div>
                    <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={{ fontSize: "0.68rem", color: "#AAA" }}>PARTÍCULAS PM10</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38BDF8" }}>{telemetry.pm10Ugm3} <span style={{ fontSize: "0.7rem" }}>µg/m³</span></div>
                    </div>
                    <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={{ fontSize: "0.68rem", color: "#AAA" }}>MONÓXIDO CO ESTIMADO</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: telemetry.estimatedCoPpm > 35 ? "#FF3355" : "#FFB300" }}>{telemetry.estimatedCoPpm} <span style={{ fontSize: "0.7rem" }}>PPM</span></div>
                    </div>
                    <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={{ fontSize: "0.68rem", color: "#AAA" }}>LLAMA OSCILANTE (3-15 Hz)</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: telemetry.flameFlickerDetected ? "#FF3355" : "#00E676" }}>
                            {telemetry.flameFlickerDetected ? `DETECTADO (${telemetry.flickerFrequencyHz} Hz)` : "NO DETECTADO"}
                        </div>
                    </div>
                </div>

                {/* PPE Recommendation */}
                <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(255, 179, 0, 0.1)", border: "1px solid rgba(255, 179, 0, 0.4)" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#FFB300", marginBottom: "4px" }}>
                        🛡️ PROTECCIÓN RESPIRATORIA REQUERIDA (EPP):
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#FFF" }}>
                        {telemetry.recommendedMask}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#AAA", marginTop: "4px" }}>
                        {telemetry.description}
                    </div>
                </div>

                {/* SOS Broadcast Action */}
                <button
                    onClick={handleBroadcastAlert}
                    style={{
                        padding: "14px", borderRadius: "10px",
                        background: "linear-gradient(135deg, #FF3355, #E8213A)",
                        border: "none", color: "#FFF", fontSize: "0.85rem", fontWeight: 900,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        boxShadow: "0 0 15px rgba(255, 51, 85, 0.4)"
                    }}
                >
                    <span>🚨</span>
                    <span>DIFUNDIR ALERTA DE TOXICIDAD POR MALLA SOS</span>
                </button>
            </div>
        </div>
    );
}

export default AtmosphericSafetyModal;

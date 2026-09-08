"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { opticalGasAqiEngine, AtmosphericTelemetry } from "../lib/sensors/OpticalGasAqiEngine";
import {
    getNativeBarometerReading,
    getNativeThermometerReading,
    getNativeHygrometerReading
} from "../lib/api";
import {
    recordBaroSample,
    calculateDewPoint,
    analyzeAtmosphere
} from "../lib/weatherBarometerEngine";
import { toast } from "./Toast";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";

export function AtmosphericSafetyModal() {
    const { navigate, identity, goBack } = useRedStore();

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const prevLumaRef = useRef<number | null>(null);
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [telemetry, setTelemetry] = useState<AtmosphericTelemetry>(() => 
        opticalGasAqiEngine.analyzeOpticalFrame(120, 48, { r: 100, g: 100, b: 100 }, 0)
    );

    // Telemetría de Sensores Físicos Ambientales (Barómetro, Altitud Hipsométrica, Termo-Higrómetro)
    const [baroPressure, setBaroPressure] = useState<number | null>(null);
    const [baroAltitudeMeters, setBaroAltitudeMeters] = useState<number | null>(null);
    const [ambientTempC, setAmbientTempC] = useState<number | null>(null);
    const [ambientHumidityRh, setAmbientHumidityRh] = useState<number | null>(null);
    const [dewPointC, setDewPointC] = useState<number | null>(null);
    const [pressureTrendLabel, setPressureTrendLabel] = useState<string>("Buscando sensor...");

    // Adquisición periódica de sensores de hardware del dispositivo
    useEffect(() => {
        let active = true;
        const fetchPhysicalSensors = async () => {
            try {
                const baro = await getNativeBarometerReading();
                const thermo = await getNativeThermometerReading();
                const hygro = await getNativeHygrometerReading();

                if (!active) return;

                let p: number | null = null;
                if (baro && baro.available && typeof baro.pressure_hpa === "number" && baro.pressure_hpa >= 600 && baro.pressure_hpa <= 1150) {
                    p = Math.round(baro.pressure_hpa * 10) / 10;
                    setBaroPressure(p);
                    // Fórmula hipsométrica estándar de la OACI para altitud barométrica
                    const alt = 44330 * (1 - Math.pow(p / 1013.25, 1 / 5.255));
                    if (isFinite(alt)) setBaroAltitudeMeters(Math.round(alt));
                    recordBaroSample({ timestamp: Date.now(), pressureHpa: p });
                }

                let tVal: number | null = null;
                if (thermo && thermo.available && typeof thermo.value === "number") {
                    tVal = Math.round(thermo.value * 10) / 10;
                    setAmbientTempC(tVal);
                }

                let hVal: number | null = null;
                if (hygro && hygro.available && typeof hygro.value === "number") {
                    hVal = Math.round(hygro.value * 10) / 10;
                    setAmbientHumidityRh(hVal);
                }

                if (tVal !== null && hVal !== null) {
                    const dp = calculateDewPoint(tVal, hVal);
                    setDewPointC(dp);
                }

                if (p !== null) {
                    const analysis = analyzeAtmosphere(p, tVal ?? undefined, hVal ?? undefined);
                    setPressureTrendLabel(`${analysis.trendLabel} (${analysis.deltaP3h > 0 ? '+' : ''}${analysis.deltaP3h.toFixed(1)} hPa/3h)`);
                } else {
                    setPressureTrendLabel("Barómetro de hardware no detectado");
                }
            } catch {}
        };

        fetchPhysicalSensors();
        const interval = setInterval(fetchPhysicalSensors, 5000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        let isActive = true;
        let stream: MediaStream | null = null;
        let animationFrame: number | null = null;

        const startCamera = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const camStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment", width: { ideal: 480 }, height: { ideal: 360 } }
                    });
                    if (!isActive) {
                        camStream.getTracks().forEach(t => t.stop());
                        return;
                    }
                    stream = camStream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(() => {});
                        setIsCameraActive(true);
                    }
                }
            } catch (e) {
                console.warn("[AtmosphericSafetyModal] Camera access error:", e);
            }
        };

        startCamera();

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

    // ── LIFO Back Navigation Handler ──────────────────────────────────────────────
    useEffect(() => {
        const unreg = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return unreg;
    }, [goBack]);

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

        const baroDetail = baroPressure !== null
            ? ` Presión: ${baroPressure} hPa (Altitud Barométrica: ${baroAltitudeMeters !== null ? `${baroAltitudeMeters}m` : 'N/D'}).`
            : '';
        const tempDetail = ambientTempC !== null
            ? ` Temp: ${ambientTempC}°C, HR: ${ambientHumidityRh ?? '--'}% (Pto Rocío: ${dewPointC ?? '--'}°C).`
            : '';

        await meshSosBeacon.activateSosBeacon({
            distressType: "NATURAL_DISASTER",
            triageColor: telemetry.aqiIndex > 200 ? "RED" : "YELLOW",
            note: `ALERTA TOXICIDAD ATMOSFÉRICA: AQI ${telemetry.aqiIndex} (${telemetry.severity}), PM2.5 ${telemetry.pm25Ugm3} ug/m3, CO ${telemetry.estimatedCoPpm} ppm.${baroDetail}${tempDetail} ${telemetry.recommendedMask}`,
            batteryLevel: batt
        }, callerId, callerName);
        TacticalAudioEngine.playEmergencyAlarm();
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
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        goBack();
                    }}
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

                {/* Cinta de Telemetría Física de Hardware (Barómetro / Termómetro / Higrómetro) */}
                <div style={{
                    background: "rgba(0, 0, 0, 0.45)",
                    border: "1px solid rgba(0, 229, 255, 0.25)",
                    borderRadius: "14px",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.7rem", color: "#00E5FF", fontWeight: 900 }}>
                            🧭 TELEMETRÍA AMBIENTAL & PRESIÓN FÍSICA (HARDWARE)
                        </span>
                        <span style={{
                            fontSize: "0.6rem", fontWeight: 800, padding: "2px 6px", borderRadius: "5px",
                            background: baroPressure !== null ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 179, 0, 0.15)",
                            color: baroPressure !== null ? "#00E676" : "#FFB300",
                            border: `1px solid ${baroPressure !== null ? '#00E676' : '#FFB300'}50`
                        }}>
                            {baroPressure !== null ? "● SENSOR BAROMÉTRICO NATIVO" : "○ GPS / ESTIMADO"}
                        </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px" }}>
                        <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>PRESIÓN hPa</div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#00E5FF", marginTop: "2px" }}>
                                {baroPressure !== null ? `${baroPressure}` : "--"} <span style={{ fontSize: "0.65rem" }}>hPa</span>
                            </div>
                        </div>

                        <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>ALTITUD HIPSOMÉTRICA</div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#38BDF8", marginTop: "2px" }}>
                                {baroAltitudeMeters !== null ? `${baroAltitudeMeters}` : "--"} <span style={{ fontSize: "0.65rem" }}>m snm</span>
                            </div>
                        </div>

                        <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>TEMPERATURA</div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#FFB300", marginTop: "2px" }}>
                                {ambientTempC !== null ? `${ambientTempC}` : "--"} <span style={{ fontSize: "0.65rem" }}>°C</span>
                            </div>
                        </div>

                        <div style={{ padding: "8px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                            <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>HUMEDAD / ROCÍO</div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#00E676", marginTop: "2px" }}>
                                {ambientHumidityRh !== null ? `${ambientHumidityRh}%` : "--"} {dewPointC !== null ? `(${dewPointC}°C)` : ""}
                            </div>
                        </div>
                    </div>

                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
                        <span>Tendencia: <strong style={{ color: "#FFFFFF" }}>{pressureTrendLabel}</strong></span>
                        <span>{baroPressure && baroPressure < 980 ? "⚠️ ALERTA: BAJA PRESIÓN / ESPACIO CONFINADO" : "Presión Atmosférica Nominal"}</span>
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

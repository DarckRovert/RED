"use client";

import React, { useState, useEffect } from "react";
import { acousticSonar, SonarMediumType, SonarPingResult } from "../lib/sensors/AcousticSonarEngine";
import { seismicTriangulation, SurvivorTriangulationResult, SeismicSensorNode } from "../lib/sensors/SeismicTriangulationEngine";
import { structuralHealthSeismic, StructuralHealthTelemetry } from "../lib/sensors/StructuralHealthSeismicEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function SonarSeismicModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"sonar" | "seismic" | "structural">("sonar");
    
    // Structural Health State
    const [structTelemetry, setStructTelemetry] = useState<StructuralHealthTelemetry>(() => structuralHealthSeismic.getTelemetry());
    
    // Sonar States
    const [medium, setMedium] = useState<SonarMediumType>("AIR_20C");
    const [sonarState, setSonarState] = useState(() => acousticSonar.getState());
    const [lastPing, setLastPing] = useState<SonarPingResult | null>(sonarState.lastResult);

    // Seismic States
    const [seismicResult, setSeismicResult] = useState<SurvivorTriangulationResult | null>(() => seismicTriangulation.getState().lastResult);
    const [nodes, setNodes] = useState<SeismicSensorNode[]>(() => seismicTriangulation.getNodes());

    useEffect(() => {
        const unsubSonar = acousticSonar.subscribe(r => {
            setLastPing(r);
            setSonarState(acousticSonar.getState());
        });
        const unsubSeismic = seismicTriangulation.subscribe(r => {
            setSeismicResult(r);
            setNodes(seismicTriangulation.getNodes());
        });
        const unsubStruct = structuralHealthSeismic.subscribe(setStructTelemetry);

        return () => {
            unsubSonar();
            unsubSeismic();
            unsubStruct();
            acousticSonar.stopContinuousScan();
            structuralHealthSeismic.stopMonitoring();
            acousticSonar.destroy();
        };
    }, []);

    const handleEmitPing = async () => {
        const res = await acousticSonar.emitPing(medium);
        toast.info(`📡 ECO SONAR: ${res.distanceMeters} m (${res.timeOfFlightMs} ms)`);
    };

    const handleToggleContinuous = () => {
        if (sonarState.isScanning) {
            acousticSonar.stopContinuousScan();
            setSonarState(acousticSonar.getState());
            toast.info("Barrido de sonar continuo detenido");
        } else {
            acousticSonar.startContinuousScan(800);
            setSonarState(acousticSonar.getState());
            toast.success("Barrido de sonar activo");
        }
    };

    const handleToggleStructuralMonitoring = () => {
        if (structTelemetry.isMonitoring) {
            structuralHealthSeismic.stopMonitoring();
            toast.info("Monitoreo sísmico estructural detenido");
        } else {
            structuralHealthSeismic.startMonitoring();
            toast.success("Monitoreo sísmico estructural iniciado");
        }
    };

    const handleCalibrateStructuralBaseline = () => {
        structuralHealthSeismic.calibrateBaseline();
        toast.success(`Frecuencia base f₀ calibrada a ${structuralHealthSeismic.getTelemetry().baselineFrequencyHz} Hz`);
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                borderBottom: "1.5px solid rgba(0, 229, 255, 0.35)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={goBack}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.1rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(0, 229, 255, 0.25)"
                    }}>📡</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            SONAR ACÚSTICO & SÍSMICA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            ECO FMCW ToF · TRIANGULACIÓN SÍSMICA TDoA
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                        background: sonarState.isScanning ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        color: sonarState.isScanning ? "#00E676" : "var(--text-secondary)",
                        border: `1px solid ${sonarState.isScanning ? '#00E676' : 'rgba(255,255,255,0.1)'}50`
                    }}>
                        {sonarState.isScanning ? "SONAR ACTIVO" : "STANDBY"}
                    </span>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("sonar")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "sonar" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "sonar" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "sonar" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>📡</span> SONAR ToF {sonarState.isScanning && "▶"}
                </button>
                <button
                    onClick={() => setActiveTab("seismic")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "seismic" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "seismic" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "seismic" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🪨</span> SÍSMICA TDoA
                </button>
                <button
                    onClick={() => setActiveTab("structural")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "structural" ? "linear-gradient(135deg, rgba(255, 179, 0, 0.25) 0%, rgba(180, 120, 0, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "structural" ? "1.5px solid #FFB300" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "structural" ? "#FFB300" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🏢</span> ANTI-COLAPSO {structTelemetry.isMonitoring && "●"}
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: ACOUSTIC SONAR */}
                    {activeTab === "sonar" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div>
                                <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900, display: "block", marginBottom: "4px" }}>
                                    MEDIO DE PROPAGACIÓN ACÚSTICA
                                </label>
                                <select
                                    value={medium}
                                    onChange={(e: any) => setMedium(e.target.value)}
                                    style={{
                                        width: "100%", padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.82rem", outline: "none", fontFamily: "JetBrains Mono, monospace"
                                    }}
                                >
                                    <option value="AIR_20C">Aire (20°C) · 343 m/s</option>
                                    <option value="WATER_FRESH">Agua Dulce (20°C) · 1482 m/s</option>
                                    <option value="CONCRETE">Hormigón / Escombros · 3200 m/s</option>
                                    <option value="STEEL">Acero Estructural · 5960 m/s</option>
                                </select>
                            </div>

                            {/* Distance Result Card */}
                            <div style={{
                                background: "rgba(0, 229, 255, 0.08)", border: "1.5px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "16px", padding: "20px", textAlign: "center",
                                display: "flex", flexDirection: "column", gap: "6px"
                            }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>DISTANCIA AL OBSTÁCULO ESTIMADA:</div>
                                <div style={{ fontSize: "2.8rem", fontWeight: 900, color: "#00E5FF" }}>
                                    {lastPing ? `${lastPing.distanceMeters.toFixed(2)} m` : "-- m"}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                    Tiempo de Vuelo (ToF): {lastPing ? `${lastPing.timeOfFlightMs} ms` : "-- ms"} · Confianza: {lastPing ? `${Math.round(lastPing.confidencePct)}%` : "--"}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={handleEmitPing}
                                    style={{
                                        flex: 1, padding: "12px", borderRadius: "12px",
                                        background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        color: "#000000", fontWeight: 900, fontSize: "0.82rem", border: "none", cursor: "pointer"
                                    }}
                                >
                                    📡 EMITIR PING FMCW
                                </button>
                                <button
                                    onClick={handleToggleContinuous}
                                    style={{
                                        flex: 1, padding: "12px", borderRadius: "12px",
                                        background: sonarState.isScanning ? "rgba(255, 51, 85, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                        border: `1px solid ${sonarState.isScanning ? '#FF3355' : 'rgba(255, 255, 255, 0.15)'}`,
                                        color: sonarState.isScanning ? "#FF3355" : "#FFFFFF",
                                        fontWeight: 900, fontSize: "0.82rem", cursor: "pointer"
                                    }}
                                >
                                    {sonarState.isScanning ? "⏹️ DETENER BARRIDO" : "▶ BARRIDO CONTINUO"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: SEISMIC RESCUE */}
                    {activeTab === "seismic" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                    TRIANGULACIÓN SÍSMICA DE GOLPETEOS TDoA
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Detecta micro-vibraciones causadas por supervivientes atrapados bajo escombros usando acelerómetros MEMS sincronizados.
                                </div>
                            </div>

                            {seismicResult && (
                                <div style={{
                                    background: "rgba(255, 51, 85, 0.15)", border: "1.5px solid #FF3355",
                                    borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "6px"
                                }}>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#FF3355" }}>
                                        🪨 SUPERVIVIENTE DETECTADO:
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace" }}>
                                        Posición Relativa: X={seismicResult.estimatedX}m, Y={seismicResult.estimatedY}m (Profundidad: {seismicResult.estimatedDepthMeters}m)
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                        Confianza TDoA: {(seismicResult.confidencePct * 100).toFixed(0)}% · Nodos usados: {seismicResult.nodesUsed}
                                    </div>
                                </div>
                            )}

                            <div style={{
                                padding: "12px 14px",
                                background: "rgba(255, 51, 85, 0.08)",
                                border: "1px solid rgba(255, 51, 85, 0.25)",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px"
                            }}>
                                <span style={{ fontSize: "1.3rem" }}>🪨</span>
                                <div style={{ fontSize: "0.72rem", color: "#DDD", lineHeight: 1.4 }}>
                                    <strong style={{ color: "#FF3355" }}>Modo Detección Sísmica Activo:</strong> Coloque los nodos sobre escombros o losa estructural. Los impactos físicos por golpes de superviviente son registrados en microsegundos y triangulados por TDoA.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: STRUCTURAL HEALTH */}
                    {activeTab === "structural" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 179, 0, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFB300" }}>
                                        MONITOR DE INTEGRIDAD ESTRUCTURAL
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        Alerta temprana de colapso en túneles, edificios dañados y puentes.
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.68rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                                    background: structTelemetry.isSensorAvailable ? "rgba(0,230,118,0.15)" : "rgba(255,179,0,0.15)",
                                    color: structTelemetry.isSensorAvailable ? "#00E676" : "#FFB300",
                                    border: `1px solid ${structTelemetry.isSensorAvailable ? "#00E676" : "#FFB300"}`
                                }}>
                                    {structTelemetry.isSensorAvailable ? "● Acelerómetro Activo" : "○ Sensor en Espera"}
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>INTEGRIDAD ESTRUCTURAL</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: structTelemetry.structuralIntegrityPct > 70 ? "#00E676" : structTelemetry.structuralIntegrityPct > 40 ? "#FFB300" : "#FF3355" }}>
                                        {structTelemetry.structuralIntegrityPct}%
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>ÍNDICE DE COLAPSO</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: structTelemetry.collapseRiskLevel === "SAFE" ? "#00E676" : "#FF3355" }}>
                                        {structTelemetry.collapseRiskLevel}
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>FRECUENCIA f₀ ACTUAL</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#38BDF8" }}>
                                        {structTelemetry.dominantFrequencyHz} <span style={{ fontSize: "0.7rem" }}>Hz</span>
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>f₀ LÍNEA BASE</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#AAA" }}>
                                        {structTelemetry.baselineFrequencyHz} <span style={{ fontSize: "0.7rem" }}>Hz</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={handleToggleStructuralMonitoring}
                                    style={{
                                        flex: 1, padding: "10px", borderRadius: "10px",
                                        background: structTelemetry.isMonitoring ? "rgba(255,51,85,0.2)" : "rgba(0,230,118,0.2)",
                                        border: `1.5px solid ${structTelemetry.isMonitoring ? "#FF3355" : "#00E676"}`,
                                        color: structTelemetry.isMonitoring ? "#FF3355" : "#00E676",
                                        fontWeight: 800, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    {structTelemetry.isMonitoring ? "⏹️ Detener Monitoreo" : "▶️ Iniciar Monitoreo"}
                                </button>
                                <button
                                    onClick={handleCalibrateStructuralBaseline}
                                    style={{
                                        padding: "10px 14px", borderRadius: "10px",
                                        background: "rgba(255,179,0,0.15)", border: "1.5px solid #FFB300",
                                        color: "#FFB300", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    🎯 Calibrar f₀ Base
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

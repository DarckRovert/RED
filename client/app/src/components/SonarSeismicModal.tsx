"use client";

import React, { useState, useEffect } from "react";
import { acousticSonar, SonarMediumType, SonarPingResult } from "../lib/sensors/AcousticSonarEngine";
import { seismicTriangulation, SurvivorTriangulationResult, SeismicSensorNode } from "../lib/sensors/SeismicTriangulationEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function SonarSeismicModal() {
    const { navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<"sonar" | "seismic">("sonar");
    
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

        return () => {
            unsubSonar();
            unsubSeismic();
            acousticSonar.stopContinuousScan();
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

    const handleSimulateSeismicTaps = () => {
        const res = seismicTriangulation.simulateSurvivorTaps();
        toast.error(`🪨 ¡IMPACTO DETECTADO! Superviviente a X:${res.estimatedX}m Y:${res.estimatedY}m (Prof: ${res.estimatedDepthMeters}m)`);
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
                    <span style={{ fontSize: "1.2rem" }}>📡</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            SONAR ACÚSTICO & SISMOLOGÍA DE RESCATE
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Medición ToF FMCW y Triangulación Sísmica TDoA de Supervivientes
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => {
                        acousticSonar.stopContinuousScan();
                        navigate("commandCenter");
                    }}
                    style={{
                        background: "rgba(232, 33, 58, 0.2)", border: "1px solid #E8213A",
                        color: "#FFF", padding: "6px 12px", borderRadius: "8px",
                        cursor: "pointer", fontWeight: 800, fontSize: "0.75rem"
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Tab Selector */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "6px 16px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                    onClick={() => setActiveTab("sonar")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "sonar" ? "#00E5FF" : "transparent",
                        color: activeTab === "sonar" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    📡 Sonar ToF FMCW {sonarState.isScanning && "▶ BARRIDO"}
                </button>
                <button
                    onClick={() => setActiveTab("seismic")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "seismic" ? "#FF3355" : "transparent",
                        color: activeTab === "seismic" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🪨 Triangulación Sísmica TDoA
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: ACOUSTIC SONAR ── */}
                {activeTab === "sonar" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "0.68rem", color: "#AAA" }}>MEDIO DE PROPAGACIÓN:</label>
                            <select
                                value={medium}
                                onChange={(e: any) => setMedium(e.target.value)}
                                style={{ padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                            >
                                <option value="AIR_20C">Aire a 20°C (343 m/s) — Búnker / Túnel</option>
                                <option value="CONCRETE">Concreto Sólido (3200 m/s) — Losa / Muro</option>
                                <option value="WATER">Agua Dulce (1480 m/s) — Inundación</option>
                                <option value="STEEL">Acero Estructural (5100 m/s) — Tuberías</option>
                            </select>
                        </div>

                        {/* Sonar Scope Visualizer */}
                        <div style={{
                            background: "radial-gradient(circle, rgba(0,229,255,0.1) 0%, rgba(5,8,18,0.9) 75%)",
                            border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "14px",
                            padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "180px", position: "relative"
                        }}>
                            <div style={{ fontSize: "0.7rem", color: "#00E5FF", position: "absolute", top: "12px", left: "14px" }}>
                                FMCW CHIRP: 3.0 kHz → 7.5 kHz
                            </div>
                            
                            <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#00E5FF" }}>
                                {lastPing ? `${lastPing.distanceMeters} m` : "-- m"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#AAA", marginTop: "4px" }}>
                                Tiempo de Vuelo (ToF): <span style={{ color: "#FFF" }}>{lastPing ? `${lastPing.timeOfFlightMs} ms` : "-- ms"}</span> · Confianza: <span style={{ color: "#00E676" }}>{lastPing ? `${lastPing.confidencePct}%` : "--%"}</span>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <button
                                onClick={handleEmitPing}
                                style={{ padding: "12px", borderRadius: "10px", background: "#00E5FF", color: "#000", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer" }}
                            >
                                📡 EMITIR PING FMCW
                            </button>
                            <button
                                onClick={handleToggleContinuous}
                                style={{
                                    padding: "12px", borderRadius: "10px",
                                    background: sonarState.isScanning ? "#FF3355" : "rgba(0,229,255,0.15)",
                                    color: sonarState.isScanning ? "#FFF" : "#00E5FF",
                                    border: `1px solid ${sonarState.isScanning ? "#FF3355" : "#00E5FF"}`,
                                    fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                }}
                            >
                                {sonarState.isScanning ? "DETENER BARRIDO" : "BARRIDO CONTINUO"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: SEISMIC TRIANGULATION ── */}
                {activeTab === "seismic" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(232, 33, 58, 0.08)", border: "1px solid rgba(232, 33, 58, 0.25)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Monitorea las vibraciones sísmicas registradas por 3 o más nodos de la malla en escombros colapsados para triangular el origen de los golpes de supervivientes.
                        </div>

                        {seismicResult && (
                            <div style={{ background: "rgba(232, 33, 58, 0.15)", border: "1.5px solid #FF3355", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ fontSize: "0.72rem", color: "#FF3355", fontWeight: 900 }}>
                                    🎯 UBICACIÓN DE SUPERVIVIENTE ESTIMADA:
                                </div>
                                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#FFF" }}>
                                    X: {seismicResult.estimatedX} m · Y: {seismicResult.estimatedY} m
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#FFB300" }}>
                                    Profundidad estimada: {seismicResult.estimatedDepthMeters} metros
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    Patrón: [{seismicResult.patternType}] · Nodos: {seismicResult.nodesUsed} · Confianza: {seismicResult.confidencePct}%
                                </div>
                            </div>
                        )}

                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ fontSize: "0.7rem", color: "#AAA", fontWeight: 800 }}>NODOS SÍSMICOS DE LA MALLA:</div>
                            {nodes.map(n => (
                                <div key={n.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div>{n.name} (X:{n.xMeters}m, Y:{n.yMeters}m)</div>
                                    <div style={{ color: n.amplitudeG > 0 ? "#00E676" : "#888" }}>
                                        {n.amplitudeG > 0 ? `${n.amplitudeG} G` : "Esperando..."}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleSimulateSeismicTaps}
                            style={{ padding: "12px", borderRadius: "10px", background: "#FF3355", color: "#FFF", fontWeight: 900, fontSize: "0.8rem", border: "none", cursor: "pointer" }}
                        >
                            🪨 SIMULAR DETECCIÓN DE 3 GOLPES DE RESCATE
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}

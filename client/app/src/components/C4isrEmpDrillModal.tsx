"use client";

import React, { useState, useEffect } from "react";
import { c4isrMatrix, C4isrSnapshot } from "../lib/tactical/C4isrTacticalMatrixEngine";
import { empChaosOrchestrator, ChaosEngineState, ChaosScenario } from "../lib/mesh/EmpChaosOrchestratorEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function C4isrEmpDrillModal() {
    const { navigate } = useRedStore();
    const [snapshot, setSnapshot] = useState<C4isrSnapshot>(() => c4isrMatrix.getSnapshot());
    const [chaos, setChaos] = useState<ChaosEngineState>(() => empChaosOrchestrator.getState());
    const [activeTab, setActiveTab] = useState<"c4isr" | "chaos">("c4isr");

    useEffect(() => {
        const interval = setInterval(() => {
            setSnapshot(c4isrMatrix.getSnapshot());
        }, 1000);
        const unsubChaos = empChaosOrchestrator.subscribe(setChaos);

        return () => {
            clearInterval(interval);
            unsubChaos();
        };
    }, []);

    const handleCopyReport = () => {
        const report = c4isrMatrix.generateExecutiveReport();
        navigator.clipboard.writeText(report);
        toast.success("📋 Informe Ejecutivo C4ISR copiado");
    };

    const handleStartChaos = (scenario: ChaosScenario) => {
        empChaosOrchestrator.startScenario(scenario);
        toast.error(`⚠️ INICIANDO ESCENARIO: ${scenario}`);
    };

    const handleStopChaos = () => {
        empChaosOrchestrator.stopScenario();
        toast.success("✓ Ejercicio detenido. Espectro y red restablecidos.");
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
                    <span style={{ fontSize: "1.2rem" }}>🛰️</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            MATRIZ C4ISR & LABORATORIO DE CAOS EMP
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Teatro de Operaciones Unificado y Resiliencia ante Pulso Electromagnético
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

            {/* Tab Selector */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "6px 16px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                    onClick={() => setActiveTab("c4isr")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "c4isr" ? "#00E5FF" : "transparent",
                        color: activeTab === "c4isr" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🛰️ Matriz C4ISR
                </button>
                <button
                    onClick={() => setActiveTab("chaos")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "chaos" ? "#FF3355" : "transparent",
                        color: activeTab === "chaos" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    ⚡ Laboratorio EMP & Caos {chaos.isInjectingErrors && "🚨 ACTIVO"}
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: C4ISR THEATER MATRIX ── */}
                {activeTab === "c4isr" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Quick Stats Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>DEFCON / PORTADOR</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#00E5FF" }}>
                                    DEFCON {snapshot.defconLevel} · {snapshot.primaryBearer}
                                </div>
                            </div>
                            <div style={{ background: "rgba(232, 33, 58, 0.08)", border: "1px solid rgba(232, 33, 58, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>AMENAZA AÉREA SIGINT</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: snapshot.droneThreatLevel === "CLEAR" ? "#00E676" : "#FF3355" }}>
                                    {snapshot.droneThreatLevel}
                                </div>
                            </div>
                            <div style={{ background: "rgba(255, 179, 0, 0.08)", border: "1px solid rgba(255, 179, 0, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>DOSIMETRÍA CBRN</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFB300" }}>
                                    {snapshot.radiationRateUsVh} µSv/h [{snapshot.radiationThreatLevel}]
                                </div>
                            </div>
                            <div style={{ background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>SANIDAD MILITAR TCCC</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: snapshot.hasIschemicAlert ? "#FF3355" : "#00E676" }}>
                                    {snapshot.activeTourniquetsCount} TQ {snapshot.hasIschemicAlert && "⚠️ ISQUEMIA"}
                                </div>
                            </div>
                        </div>

                        {/* Executive Report Card */}
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#00E5FF" }}>INFORME EJECUTIVO C4ISR:</div>
                            <pre style={{
                                background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px",
                                fontSize: "0.65rem", color: "#DDD", overflowX: "auto", margin: 0
                            }}>
                                {c4isrMatrix.generateExecutiveReport()}
                            </pre>
                            <button
                                onClick={handleCopyReport}
                                style={{
                                    padding: "10px", borderRadius: "8px", background: "#00E5FF",
                                    color: "#000", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                }}
                            >
                                📋 COPIAR INFORME C4ISR
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: EMP & CHAOS LAB ── */}
                {activeTab === "chaos" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(232, 33, 58, 0.08)", border: "1px solid rgba(232, 33, 58, 0.3)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Inyecta fallas destructivas simuladas en caliente (Pulso EMP, Jamming agresivo, partición de enjambre) para verificar la auto-recuperación del nodo.
                        </div>

                        {chaos.isInjectingErrors && (
                            <div style={{
                                background: "rgba(232, 33, 58, 0.2)", border: "1.5px solid #FF3355",
                                borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px"
                            }}>
                                <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "#FF3355" }}>
                                    🚨 EJERCICIO DE ESTRÉS EN CURSO: {chaos.activeScenario}
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#DDD" }}>
                                    Tiempo transcurrido: {chaos.elapsedDrillSeconds}s · Pérdida de paquetes: {chaos.packetDropRatePct}% · Aislamiento Faraday: {chaos.faradayIsolationEnabled ? "ACTIVADO" : "NO"}
                                </div>
                                <button
                                    onClick={handleStopChaos}
                                    style={{
                                        marginTop: "6px", padding: "10px", borderRadius: "8px",
                                        background: "#00E676", color: "#000", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                    }}
                                >
                                    ✓ RESTABLECER CONDICIONES NORMALES
                                </button>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <button
                                onClick={() => handleStartChaos("EMP_SIMULATION")}
                                style={{
                                    padding: "12px", borderRadius: "10px", background: "rgba(232,33,58,0.15)",
                                    border: "1px solid #FF3355", color: "#FF3355", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                ⚡ 1. PULSO ELECTROMAGNÉTICO (EMP)
                                <div style={{ fontSize: "0.65rem", color: "#AAA", fontWeight: 400, marginTop: "2px" }}>
                                    Aislamiento Faraday total, caída de enlaces y DEFCON 1.
                                </div>
                            </button>

                            <button
                                onClick={() => handleStartChaos("RF_JAMMING_FLOOD")}
                                style={{
                                    padding: "12px", borderRadius: "10px", background: "rgba(255,179,0,0.15)",
                                    border: "1px solid #FFB300", color: "#FFB300", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                📡 2. INTERFERENCIA AGRESIVA (EW JAMMING)
                                <div style={{ fontSize: "0.65rem", color: "#AAA", fontWeight: 400, marginTop: "2px" }}>
                                    75% de pérdida de paquetes, ruido gaussiano y failover forzado a LoRa.
                                </div>
                            </button>

                            <button
                                onClick={() => handleStartChaos("MESH_PARTITION")}
                                style={{
                                    padding: "12px", borderRadius: "10px", background: "rgba(0,229,255,0.15)",
                                    border: "1px solid #00E5FF", color: "#00E5FF", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                🌐 3. PARTICIÓN DE MALLA
                                <div style={{ fontSize: "0.65rem", color: "#AAA", fontWeight: 400, marginTop: "2px" }}>
                                    División de sub-redes y prueba de reconvergencia CRDT.
                                </div>
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

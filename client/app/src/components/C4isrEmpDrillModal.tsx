"use client";

import React, { useState, useEffect } from "react";
import { c4isrMatrix, C4isrSnapshot } from "../lib/tactical/C4isrTacticalMatrixEngine";
import { empChaosOrchestrator, ChaosEngineState, ChaosScenario } from "../lib/mesh/EmpChaosOrchestratorEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function C4isrEmpDrillModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
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
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(report);
            toast.success("📋 Informe Ejecutivo C4ISR copiado");
        }
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
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", display: "flex", flexDirection: "column",
            fontFamily: "JetBrains Mono, monospace", overflow: "hidden"
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
                    }}>🛰️</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            MATRIZ C4ISR & DRILL EMP
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            COMANDO UNIFICADO & RESILIENCIA A PULSO EMP
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        onClick={handleCopyReport}
                        style={{
                            padding: "6px 12px", borderRadius: "10px",
                            background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                            color: "var(--accent-cyan, #00E5FF)", fontSize: "0.74rem", fontWeight: 900, cursor: "pointer"
                        }}
                    >
                        📋 COPIAR INFORME
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("c4isr")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "c4isr" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "c4isr" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "c4isr" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🛰️</span> MATRIZ C4ISR EN VIVO
                </button>
                <button
                    onClick={() => setActiveTab("chaos")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "chaos" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "chaos" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "chaos" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>⚡</span> DRILL EMP & CAOS {chaos.isInjectingErrors && "🚨"}
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: C4ISR MATRIX */}
                    {activeTab === "c4isr" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {/* Grid de Métricas Tácticas C4ISR */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div style={{
                                    background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                                    border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "16px", padding: "14px"
                                }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>NIVEL DEFCON & ENLACE</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#00E5FF", marginTop: "4px" }}>
                                        DEFCON {snapshot.defconLevel} · {snapshot.primaryBearer}
                                    </div>
                                </div>

                                <div style={{
                                    background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                                    border: `1.5px solid ${snapshot.droneThreatLevel === 'CLEAR' ? 'rgba(0, 230, 118, 0.35)' : 'rgba(255, 51, 85, 0.35)'}`,
                                    borderRadius: "16px", padding: "14px"
                                }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>AMENAZA AÉREA SIGINT</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: snapshot.droneThreatLevel === "CLEAR" ? "#00E676" : "#FF3355", marginTop: "4px" }}>
                                        {snapshot.droneThreatLevel}
                                    </div>
                                </div>

                                <div style={{
                                    background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                                    border: "1.5px solid rgba(255, 179, 0, 0.35)", borderRadius: "16px", padding: "14px"
                                }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>DOSIMETRÍA CBRN</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFB300", marginTop: "4px" }}>
                                        {snapshot.radiationRateUsVh} µSv/h [{snapshot.radiationThreatLevel}]
                                    </div>
                                </div>

                                <div style={{
                                    background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                                    border: `1.5px solid ${snapshot.hasIschemicAlert ? 'rgba(255, 51, 85, 0.35)' : 'rgba(0, 230, 118, 0.35)'}`,
                                    borderRadius: "16px", padding: "14px"
                                }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>SANIDAD MILITAR TCCC</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: snapshot.hasIschemicAlert ? "#FF3355" : "#00E676", marginTop: "4px" }}>
                                        {snapshot.activeTourniquetsCount} TQ {snapshot.hasIschemicAlert && "⚠️ ISQUEMIA"}
                                    </div>
                                </div>
                            </div>

                            {/* Raw Report Preview */}
                            <div style={{
                                background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ fontSize: "0.78rem", fontWeight: 900, color: "var(--accent-cyan, #00E5FF)" }}>
                                    REGISTRO DE TELEMETRÍA UNIFICADA C4ISR
                                </div>
                                <pre style={{
                                    margin: 0, fontSize: "0.72rem", color: "var(--text-secondary)",
                                    lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word"
                                }}>
                                    {c4isrMatrix.generateExecutiveReport()}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: CHAOS & EMP LAB */}
                    {activeTab === "chaos" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                    ORQUESTADOR DE RESILIENCIA EMP & CAOS EN MALLA
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Inyecta pulsos de interferencia electromagnética destructiva, caídas repentinas de nodos y saturación RF para validar el auto-enrutamiento DTN.
                                </div>
                            </div>

                            {chaos.isInjectingErrors && (
                                <div style={{
                                    background: "rgba(255, 51, 85, 0.15)", border: "1.5px solid #FF3355",
                                    borderRadius: "14px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center"
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: "0.88rem", color: "#FF3355" }}>
                                            🚨 INYECCIÓN ACTIVA: {chaos.activeScenario}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                                            Pérdida inducida: {chaos.packetDropRatePct}% · Ruido SNR: {chaos.injectedNoiseSnrDb} dB
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleStopChaos}
                                        style={{
                                            padding: "8px 16px", borderRadius: "10px",
                                            background: "#FF3355", color: "#FFFFFF",
                                            fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                        }}
                                    >
                                        DETENER DRILL
                                    </button>
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {([
                                    { id: "EMP_SIMULATION", title: "⚡ TORMENTA SOLAR / PULSO EMP CLASE X", desc: "Simula desconexión masiva instantánea del 85% de la infraestructura." },
                                    { id: "RF_JAMMING_FLOOD", title: "📡 INHIBICIÓN HOSTIL DE ESPECTRO RF", desc: "Introduce 70% de pérdida de paquetes y fuerza saltos FHSS de canal." },
                                    { id: "MESH_PARTITION", title: "🏃 RUPTURA DINÁMICA DE MALLA (PARTICIÓN)", desc: "Pone a prueba el enrutamiento tolerante a retrasos DTN y memoria Sled." }
                                ] as const).map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleStartChaos(s.id as ChaosScenario)}
                                        style={{
                                            padding: "12px 14px", borderRadius: "12px",
                                            background: "rgba(255, 51, 85, 0.1)", border: "1px solid rgba(255, 51, 85, 0.25)",
                                            color: "#FFFFFF", textAlign: "left", cursor: "pointer"
                                        }}
                                    >
                                        <div style={{ fontWeight: 900, fontSize: "0.82rem", color: "#FF3355" }}>{s.title}</div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{s.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

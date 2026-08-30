"use client";

import React, { useState, useEffect } from "react";
import { acousticScrambler, ScramblerMode } from "../lib/security/AcousticScramblerEngine";
import { tacticalBinaural, TacticalBinauralEngine } from "../lib/sensors/TacticalBinauralEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function AcousticWarfareModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"scrambler" | "binaural">("scrambler");
    const [scramblerState, setScramblerState] = useState(() => acousticScrambler.getState());
    const [binauralState, setBinauralState] = useState(() => tacticalBinaural.getState());

    useEffect(() => {
        const unsubScrambler = acousticScrambler.subscribe(setScramblerState);
        const unsubBinaural = tacticalBinaural.subscribe(setBinauralState);

        return () => {
            unsubScrambler();
            unsubBinaural();
        };
    }, []);

    const handleStartScrambler = (mode: ScramblerMode) => {
        acousticScrambler.startScrambler(mode);
        toast.error(`🔇 BARRERA ACÚSTICA INICIADA: ${mode}`);
    };

    const handleStopScrambler = () => {
        acousticScrambler.stopScrambler();
        toast.info("Barrera acústica detenida");
    };

    const handleStartBinaural = (presetKey: string) => {
        tacticalBinaural.startPreset(presetKey);
        toast.success(`🧠 ONDAS BINAURALES: ${TacticalBinauralEngine.PRESETS[presetKey]?.name}`);
    };

    const handleStopBinaural = () => {
        tacticalBinaural.stopPreset();
        toast.info("Generador binaural detenido");
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
                borderBottom: "1.5px solid rgba(255, 51, 85, 0.35)",
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
                        background: "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(200, 30, 60, 0.15) 100%)",
                        border: "1px solid rgba(255, 51, 85, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(255, 51, 85, 0.3)"
                    }}>🔇</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            GUERRA ACÚSTICA & BINAURAL
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#FF3355", fontWeight: 800 }}>
                            SATURACIÓN MEMS 20.5 KHZ · ENFOQUE COGNITIVO
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                        background: (scramblerState.isRunning || binauralState.isRunning) ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 230, 118, 0.15)",
                        color: (scramblerState.isRunning || binauralState.isRunning) ? "#FF3355" : "#00E676",
                        border: `1px solid ${(scramblerState.isRunning || binauralState.isRunning) ? '#FF3355' : '#00E676'}50`
                    }}>
                        {(scramblerState.isRunning || binauralState.isRunning) ? "ACTIVO" : "STANDBY"}
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
                    onClick={() => setActiveTab("scrambler")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "scrambler" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "scrambler" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "scrambler" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🔇</span> ANTI-MICRÓFONOS MEMS {scramblerState.isRunning && "🚨"}
                </button>
                <button
                    onClick={() => setActiveTab("binaural")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "binaural" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "binaural" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "binaural" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🧠</span> ONDAS BINAURALES {binauralState.isRunning && "▶"}
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: ACOUSTIC SCRAMBLER */}
                    {activeTab === "scrambler" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                    BARRERA ACÚSTICA NO LINEAL DE SATURACIÓN
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Emite tonos ultrasónicos inaudibles (20.5 kHz) y ruido caótico para sobrecargar los transductores capacitivos MEMS en smartphones espías y grabadoras.
                                </div>
                            </div>

                            {scramblerState.isRunning && (
                                <div style={{
                                    background: "rgba(255, 51, 85, 0.15)", border: "1.5px solid #FF3355",
                                    borderRadius: "14px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center"
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: "0.88rem", color: "#FF3355" }}>
                                            🚨 EMISIÓN ACTIVA: {scramblerState.mode}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                                            Potencia de Transductor: {Math.round(scramblerState.volume * 100)}%
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleStopScrambler}
                                        style={{
                                            padding: "8px 16px", borderRadius: "10px",
                                            background: "#FF3355", color: "#FFFFFF",
                                            fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                        }}
                                    >
                                        DETENER
                                    </button>
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <button
                                    onClick={() => handleStartScrambler("PINK_NOISE_CHAOS")}
                                    style={{
                                        padding: "12px", borderRadius: "12px",
                                        background: "rgba(255, 51, 85, 0.12)", border: "1px solid rgba(255, 51, 85, 0.3)",
                                        color: "#FFFFFF", textAlign: "left", cursor: "pointer"
                                    }}
                                >
                                    <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "#FF3355" }}>🌪️ RUIDO ROSA CAÓTICO</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Inundación espectral multi-frecuencia en banda audible y semi-audible.</div>
                                </button>

                                <button
                                    onClick={() => handleStartScrambler("ULTRASONIC_MEMS_JAMMER")}
                                    style={{
                                        padding: "12px", borderRadius: "12px",
                                        background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                        color: "#FFFFFF", textAlign: "left", cursor: "pointer"
                                    }}
                                >
                                    <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "var(--accent-cyan, #00E5FF)" }}>📡 ULTRASONIDO 20.5 KHZ (SILENCIOSO)</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Saturación de diafragma piezoeléctrico imperceptible para el oído humano.</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: BINAURAL WAVES */}
                    {activeTab === "binaural" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E5FF" }}>
                                    SINTETIZADOR BINAURAL TÁCTICO
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Entrenamiento de frecuencias cerebrales para situaciones de estrés operativo y combate prolongado (usar con auriculares estéreo).
                                </div>
                            </div>

                            {binauralState.isRunning && (
                                <div style={{
                                    background: "rgba(0, 229, 255, 0.15)", border: "1.5px solid #00E5FF",
                                    borderRadius: "14px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center"
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 900, fontSize: "0.88rem", color: "#00E5FF" }}>
                                            ▶ REPRODUCIENDO: {binauralState.activePreset}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                                            Volumen de Ondas: {Math.round(binauralState.volume * 100)}%
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleStopBinaural}
                                        style={{
                                            padding: "8px 16px", borderRadius: "10px",
                                            background: "#00E5FF", color: "#000000",
                                            fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                        }}
                                    >
                                        DETENER
                                    </button>
                                </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                {Object.entries(TacticalBinauralEngine.PRESETS).map(([key, preset]) => (
                                    <button
                                        key={key}
                                        onClick={() => handleStartBinaural(key)}
                                        style={{
                                            padding: "14px", borderRadius: "12px",
                                            background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)",
                                            color: "#FFFFFF", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px"
                                        }}
                                    >
                                        <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "#00E5FF" }}>{preset.name}</div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{preset.description}</div>
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

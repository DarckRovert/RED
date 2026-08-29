"use client";

import React, { useState, useEffect } from "react";
import { acousticScrambler, ScramblerMode } from "../lib/security/AcousticScramblerEngine";
import { tacticalBinaural, TacticalBinauralEngine } from "../lib/sensors/TacticalBinauralEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function AcousticWarfareModal() {
    const { navigate } = useRedStore();
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
                    <span style={{ fontSize: "1.2rem" }}>🔇</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            GUERRA ACÚSTICA & ENFOQUE BINAURAL
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Anti-Micrófonos MEMS y Ondas Cerebrales Tácticas
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => {
                        acousticScrambler.stopScrambler();
                        tacticalBinaural.stopPreset();
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
                    onClick={() => setActiveTab("scrambler")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "scrambler" ? "#FF3355" : "transparent",
                        color: activeTab === "scrambler" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🔇 Anti-Micrófonos {scramblerState.isRunning && "🚨 ACTIVO"}
                </button>
                <button
                    onClick={() => setActiveTab("binaural")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "binaural" ? "#00E5FF" : "transparent",
                        color: activeTab === "binaural" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🧠 Ondas Binaurales {binauralState.isRunning && "▶ ACTIVO"}
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: ACOUSTIC SCRAMBLER ── */}
                {activeTab === "scrambler" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(232, 33, 58, 0.08)", border: "1px solid rgba(232, 33, 58, 0.3)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Emite patrones acústicos y señales de 20.5 kHz para saturar los diafragmas no lineales de micrófonos MEMS circundantes y bloquear grabaciones de espionaje.
                        </div>

                        {scramblerState.isRunning && (
                            <div style={{ background: "rgba(232, 33, 58, 0.2)", border: "1.5px solid #FF3355", borderRadius: "10px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "#FF3355" }}>
                                        🚨 MODO ACTIVO: {scramblerState.mode}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "#AAA" }}>Potencia: {Math.round(scramblerState.volume * 100)}%</div>
                                </div>
                                <button
                                    onClick={handleStopScrambler}
                                    style={{ padding: "8px 14px", borderRadius: "8px", background: "#FF3355", color: "#FFF", fontWeight: 900, fontSize: "0.75rem", border: "none", cursor: "pointer" }}
                                >
                                    DETENER
                                </button>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <button
                                onClick={() => handleStartScrambler("PINK_NOISE_CHAOS")}
                                style={{
                                    padding: "12px", borderRadius: "10px", background: "rgba(232,33,58,0.15)",
                                    border: "1px solid #FF3355", color: "#FF3355", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                🌊 1. RUIDO ROSA CAÓTICO
                                <div style={{ fontSize: "0.65rem", color: "#AAA", fontWeight: 400, marginTop: "2px" }}>
                                    Espectro 1/f constante para enmascarar conversaciones de sala.
                                </div>
                            </button>

                            <button
                                onClick={() => handleStartScrambler("ULTRASONIC_MEMS_JAMMER")}
                                style={{
                                    padding: "12px", borderRadius: "10px", background: "rgba(0,229,255,0.15)",
                                    border: "1px solid #00E5FF", color: "#00E5FF", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                ⚡ 2. JAMMER ULTRASÓNICO MEMS (20.5 kHz)
                                <div style={{ fontSize: "0.65rem", color: "#AAA", fontWeight: 400, marginTop: "2px" }}>
                                    Saturación directa de la membrana no lineal de micrófonos de teléfonos móviles.
                                </div>
                            </button>

                            <button
                                onClick={() => handleStartScrambler("VOICE_MASKING_CHOPPER")}
                                style={{
                                    padding: "12px", borderRadius: "10px", background: "rgba(255,179,0,0.15)",
                                    border: "1px solid #FFB300", color: "#FFB300", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                🗣️ 3. ENMASCARADOR DE BANDA VOCAL
                                <div style={{ fontSize: "0.65rem", color: "#AAA", fontWeight: 400, marginTop: "2px" }}>
                                    Ruido de banda media para perturbar algoritmos de reconocimiento de voz.
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: TACTICAL BINAURAL BEATS ── */}
                {activeTab === "binaural" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Utiliza auriculares estéreo para inducir resonancia en ondas cerebrales y optimizar el rendimiento cognitivo bajo combate.
                        </div>

                        {binauralState.isRunning && (
                            <div style={{ background: "rgba(0, 229, 255, 0.2)", border: "1.5px solid #00E5FF", borderRadius: "10px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "#00E5FF" }}>
                                        ▶ ENTONACIÓN: {binauralState.activePreset}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "#AAA" }}>Frecuencia estéreo sincronizada</div>
                                </div>
                                <button
                                    onClick={handleStopBinaural}
                                    style={{ padding: "8px 14px", borderRadius: "8px", background: "#00E5FF", color: "#000", fontWeight: 900, fontSize: "0.75rem", border: "none", cursor: "pointer" }}
                                >
                                    DETENER
                                </button>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {Object.entries(TacticalBinauralEngine.PRESETS).map(([key, p]) => (
                                <button
                                    key={key}
                                    onClick={() => handleStartBinaural(key)}
                                    style={{
                                        padding: "12px", borderRadius: "10px",
                                        background: binauralState.activePreset === key ? "rgba(0,229,255,0.25)" : "rgba(255,255,255,0.03)",
                                        border: `1px solid ${binauralState.activePreset === key ? "#00E5FF" : "rgba(255,255,255,0.08)"}`,
                                        color: "#FFF", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer", textAlign: "left"
                                    }}
                                >
                                    <div>{p.name}</div>
                                    <div style={{ fontSize: "0.65rem", color: "#AAA", fontWeight: 400, marginTop: "2px" }}>
                                        {p.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

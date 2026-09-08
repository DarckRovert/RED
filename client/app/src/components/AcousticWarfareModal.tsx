"use client";

import React, { useState, useEffect, useRef } from "react";
import { acousticScrambler, ScramblerMode } from "../lib/security/AcousticScramblerEngine";
import { tacticalBinaural, TacticalBinauralEngine } from "../lib/sensors/TacticalBinauralEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function AcousticWarfareModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"scrambler" | "binaural">("scrambler");
    const [scramblerState, setScramblerState] = useState(() => acousticScrambler.getState());
    const [binauralState, setBinauralState] = useState(() => tacticalBinaural.getState());

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const unsubScrambler = acousticScrambler.subscribe(setScramblerState);
        const unsubBinaural = tacticalBinaural.subscribe(setBinauralState);

        return () => {
            unsubScrambler();
            unsubBinaural();
            acousticScrambler.stopScrambler();
            tacticalBinaural.stopPreset();
        };
    }, []);

    // ── Espectrograma FFT en Vivo con Web Audio API ─────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dataArray = new Uint8Array(128);

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.clearRect(0, 0, width, height);

            // Fondo de rejilla táctica militar
            ctx.fillStyle = "rgba(4, 6, 14, 0.95)";
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
            ctx.lineWidth = 1;
            for (let x = 0; x < width; x += 25) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            for (let y = 0; y < height; y += 18) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }

            if (scramblerState.isRunning) {
                acousticScrambler.getFrequencyData(dataArray);

                const barWidth = (width / dataArray.length) * 1.5;
                let x = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const barHeight = (dataArray[i] / 255) * height * 0.85;
                    const gradient = ctx.createLinearGradient(0, height, 0, 0);
                    if (scramblerState.mode === 'ULTRASONIC_MEMS_JAMMER') {
                        gradient.addColorStop(0, "rgba(0, 229, 255, 0.15)");
                        gradient.addColorStop(1, "rgba(0, 229, 255, 0.9)");
                    } else if (scramblerState.mode === 'PINK_NOISE_CHAOS') {
                        gradient.addColorStop(0, "rgba(255, 51, 85, 0.15)");
                        gradient.addColorStop(1, "rgba(255, 51, 85, 0.9)");
                    } else {
                        gradient.addColorStop(0, "rgba(255, 170, 0, 0.15)");
                        gradient.addColorStop(1, "rgba(255, 170, 0, 0.9)");
                    }

                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
                    x += barWidth;
                }

                ctx.font = "bold 9px JetBrains Mono, monospace";
                ctx.fillStyle = scramblerState.mode === 'ULTRASONIC_MEMS_JAMMER' ? "#00E5FF" : (scramblerState.mode === 'PINK_NOISE_CHAOS' ? "#FF3355" : "#FFAA00");
                ctx.fillText(`TRANSDUCTOR: ${scramblerState.mode} [SATURACIÓN ACTIVA]`, 8, 14);
            } else {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(0, height / 2);
                ctx.lineTo(width, height / 2);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.font = "bold 9px JetBrains Mono, monospace";
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.fillText("TRANSDUCTOR ACÚSTICO EN ESPERA — SELECCIONE MODO", 8, 14);
            }

            animationFrameRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [scramblerState.isRunning, scramblerState.mode]);

    // Intercepción jerárquica LIFO de hardware (Android Back / Esc)
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (scramblerState.isRunning || binauralState.isRunning) {
                acousticScrambler.stopScrambler();
                tacticalBinaural.stopPreset();
                toast.info("Emisiones acústicas de guerra detenidas");
                return true;
            }
            goBack();
            return true;
        });
        return unregister;
    }, [scramblerState.isRunning, binauralState.isRunning, goBack]);

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
        <div className="modal-viewport-adaptive" style={{
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace"
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
                                    Emite tonos ultrasónicos inaudibles (20.5 kHz), ruido caótico y choque vocal para sobrecargar los transductores capacitivos MEMS en smartphones espías y grabadoras clandestinas.
                                </div>
                            </div>

                            {/* Control Interactivo de Potencia de Transductor MEMS */}
                            <div style={{
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--text-secondary)" }}>
                                        POTENCIA DE EMISIÓN / TRANSDUCTOR MEMS
                                    </span>
                                    <span style={{ fontSize: "0.8rem", fontWeight: 900, color: "#FF3355" }}>
                                        {Math.round(scramblerState.volume * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="1"
                                    step="0.05"
                                    value={scramblerState.volume}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        acousticScrambler.setVolume(v);
                                    }}
                                    style={{ width: "100%", accentColor: "#FF3355", cursor: "pointer" }}
                                />
                            </div>

                            {/* Visualizador FFT de Espectro Acústico */}
                            <div style={{
                                background: "#04060E", border: "1px solid rgba(0, 229, 255, 0.25)",
                                borderRadius: "14px", padding: "8px", overflow: "hidden", position: "relative"
                            }}>
                                <canvas
                                    ref={canvasRef}
                                    width={480}
                                    height={100}
                                    style={{
                                        width: "100%", height: "100px", display: "block",
                                        borderRadius: "8px"
                                    }}
                                />
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
                                        background: scramblerState.isRunning && scramblerState.mode === "PINK_NOISE_CHAOS" ? "rgba(255, 51, 85, 0.22)" : "rgba(255, 51, 85, 0.12)",
                                        border: scramblerState.isRunning && scramblerState.mode === "PINK_NOISE_CHAOS" ? "1.5px solid #FF3355" : "1px solid rgba(255, 51, 85, 0.3)",
                                        color: "#FFFFFF", textAlign: "left", cursor: "pointer", transition: "all 0.2s ease"
                                    }}
                                >
                                    <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "#FF3355" }}>🌪️ RUIDO ROSA CAÓTICO</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Inundación espectral multi-frecuencia en banda audible y semi-audible.</div>
                                </button>

                                <button
                                    onClick={() => handleStartScrambler("ULTRASONIC_MEMS_JAMMER")}
                                    style={{
                                        padding: "12px", borderRadius: "12px",
                                        background: scramblerState.isRunning && scramblerState.mode === "ULTRASONIC_MEMS_JAMMER" ? "rgba(0, 229, 255, 0.22)" : "rgba(0, 229, 255, 0.12)",
                                        border: scramblerState.isRunning && scramblerState.mode === "ULTRASONIC_MEMS_JAMMER" ? "1.5px solid #00E5FF" : "1px solid rgba(0, 229, 255, 0.3)",
                                        color: "#FFFFFF", textAlign: "left", cursor: "pointer", transition: "all 0.2s ease"
                                    }}
                                >
                                    <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "var(--accent-cyan, #00E5FF)" }}>📡 ULTRASONIDO 20.5 KHZ (SILENCIOSO)</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Saturación de diafragma piezoeléctrico imperceptible para el oído humano.</div>
                                </button>

                                <button
                                    onClick={() => handleStartScrambler("VOICE_MASKING_CHOPPER")}
                                    style={{
                                        padding: "12px", borderRadius: "12px",
                                        background: scramblerState.isRunning && scramblerState.mode === "VOICE_MASKING_CHOPPER" ? "rgba(255, 170, 0, 0.22)" : "rgba(255, 170, 0, 0.1)",
                                        border: scramblerState.isRunning && scramblerState.mode === "VOICE_MASKING_CHOPPER" ? "1.5px solid #FFAA00" : "1px solid rgba(255, 170, 0, 0.3)",
                                        color: "#FFFFFF", textAlign: "left", cursor: "pointer", transition: "all 0.2s ease"
                                    }}
                                >
                                    <div style={{ fontWeight: 900, fontSize: "0.85rem", color: "#FFAA00" }}>🗣️ ENMASCARAMIENTO VOCAL (CHOPPER 1.5 KHZ)</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>Frecuencias vocales estocásticas con filtro pasabanda para anular algoritmos de transcripción e IA espía.</div>
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

                            {/* Control Interactivo de Volumen / Amplitud Binaural */}
                            <div style={{
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--text-secondary)" }}>
                                        AMPLITUD DE ONDA ESTÉREO
                                    </span>
                                    <span style={{ fontSize: "0.8rem", fontWeight: 900, color: "#00E5FF" }}>
                                        {Math.round(binauralState.volume * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="1"
                                    step="0.05"
                                    value={binauralState.volume}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        tacticalBinaural.setVolume(v);
                                    }}
                                    style={{ width: "100%", accentColor: "#00E5FF", cursor: "pointer" }}
                                />
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
                                {Object.entries(TacticalBinauralEngine.PRESETS).map(([key, preset]) => {
                                    const isCurrent = binauralState.isRunning && binauralState.activePreset === key;
                                    return (
                                        <div
                                            key={key}
                                            style={{
                                                padding: "14px", borderRadius: "12px",
                                                background: isCurrent ? "linear-gradient(135deg, rgba(0, 229, 255, 0.18) 0%, rgba(10, 40, 70, 0.25) 100%)" : "rgba(255, 255, 255, 0.03)",
                                                border: isCurrent ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.1)",
                                                boxShadow: isCurrent ? "0 0 15px rgba(0, 229, 255, 0.25)" : "none",
                                                display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "8px"
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                                                    <div style={{ fontWeight: 900, fontSize: "0.84rem", color: isCurrent ? "#00E5FF" : "#FFFFFF" }}>
                                                        {preset.name}
                                                    </div>
                                                    <span style={{
                                                        fontSize: "0.58rem", fontWeight: 800, padding: "2px 5px", borderRadius: "4px",
                                                        background: isCurrent ? "rgba(0, 229, 255, 0.3)" : "rgba(255, 255, 255, 0.08)",
                                                        color: isCurrent ? "#00E5FF" : "var(--text-secondary)"
                                                    }}>
                                                        {preset.category}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: "1.3" }}>
                                                    {preset.description}
                                                </div>
                                            </div>

                                            <div style={{
                                                paddingTop: "6px", borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                                                display: "flex", justifyContent: "space-between", alignItems: "center"
                                            }}>
                                                <div style={{ fontSize: "0.64rem", color: "#00E5FF", fontWeight: 700 }}>
                                                    f₀: {preset.baseFreqHz}Hz {preset.beatFreqHz > 0 ? `· Δf: ${preset.beatFreqHz}Hz` : '· Solfeggio'}
                                                </div>
                                                <button
                                                    onClick={() => isCurrent ? handleStopBinaural() : handleStartBinaural(key)}
                                                    style={{
                                                        padding: "5px 10px", borderRadius: "7px",
                                                        background: isCurrent ? "#FF3355" : "rgba(0, 229, 255, 0.15)",
                                                        border: `1px solid ${isCurrent ? '#FF3355' : 'rgba(0, 229, 255, 0.4)'}`,
                                                        color: isCurrent ? "#FFFFFF" : "#00E5FF",
                                                        fontSize: "0.68rem", fontWeight: 900, cursor: "pointer"
                                                    }}
                                                >
                                                    {isCurrent ? "⏹ DETENER" : "▶ ACTIVAR"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

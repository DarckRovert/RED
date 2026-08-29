"use client";

import React, { useState, useEffect } from "react";
import { celestialNav, CelestialEphemeris } from "../lib/sensors/CelestialNavigationEngine";
import { pedestrianDeadReckoning, PdrState } from "../lib/sensors/PedestrianDeadReckoningEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function CelestialPdrModal() {
    const { navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<"celestial" | "pdr">("celestial");
    const [ephemeris, setEphemeris] = useState<CelestialEphemeris>(() => celestialNav.calculateEphemeris());
    const [pdr, setPdr] = useState<PdrState>(() => pedestrianDeadReckoning.getState());

    // Solar Noon calculation inputs
    const [transitTimeStr, setTransitTimeStr] = useState<string>("17:15");
    const [maxSunAltitude, setMaxSunAltitude] = useState<number>(75);
    const [estimatedCoords, setEstimatedCoords] = useState<{ estimatedLat: number; estimatedLon: number } | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setEphemeris(celestialNav.calculateEphemeris());
        }, 5000);
        const unsubPdr = pedestrianDeadReckoning.subscribe(setPdr);

        return () => {
            clearInterval(interval);
            unsubPdr();
        };
    }, []);

    const handleCalculateSolarNoon = () => {
        const res = celestialNav.estimatePositionFromSolarNoon(transitTimeStr, maxSunAltitude);
        setEstimatedCoords(res);
        toast.success(`📍 Posición estimada: Lat ${res.estimatedLat}° · Lon ${res.estimatedLon}°`);
    };

    const handleTogglePdr = () => {
        if (pdr.isTracking) {
            pedestrianDeadReckoning.stopTracking();
            toast.info("Rastreador inercial PDR pausado");
        } else {
            pedestrianDeadReckoning.startTracking();
            toast.success("🧭 Rastreador inercial PDR activado");
        }
    };

    const handleSimulateStep = () => {
        if (!pdr.isTracking) pedestrianDeadReckoning.startTracking();
        pedestrianDeadReckoning.recordStep(pdr.currentHeadingDeg + (Math.random() * 10 - 5));
    };

    const handleResetPdr = () => {
        pedestrianDeadReckoning.resetPdr();
        toast.info("Contador PDR restablecido a 0");
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
                    <span style={{ fontSize: "1.2rem" }}>☀️</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            NAVEGACIÓN CELESTE & PDR INERCIAL
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Efemérides Sol/Luna, Tránsito Solar y Navegación GPS-Denied
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
                    onClick={() => setActiveTab("celestial")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "celestial" ? "#FFB300" : "transparent",
                        color: activeTab === "celestial" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    ☀️ Efemérides & Tránsito Solar
                </button>
                <button
                    onClick={() => setActiveTab("pdr")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "pdr" ? "#00E5FF" : "transparent",
                        color: activeTab === "pdr" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🧭 Inercial PDR ({pdr.totalSteps} Pasos)
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: CELESTIAL EPHEMERIS ── */}
                {activeTab === "celestial" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Sun & Moon Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ background: "rgba(255, 179, 0, 0.08)", border: "1px solid rgba(255, 179, 0, 0.3)", borderRadius: "12px", padding: "12px" }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 900, color: "#FFB300" }}>☀️ SOL</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFF", marginTop: "4px" }}>
                                    Az: {ephemeris.sun.azimuthDeg}°
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    Elev: {ephemeris.sun.altitudeDeg}° {ephemeris.sun.isAboveHorizon ? "(Sobre horizonte)" : "(Bajo horizonte)"}
                                </div>
                            </div>
                            <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "12px", padding: "12px" }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 900, color: "#00E5FF" }}>🌙 LUNA ({ephemeris.moonIlluminationPct}%)</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFF", marginTop: "4px" }}>
                                    {ephemeris.moonPhaseName}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    Az: {ephemeris.moon.azimuthDeg}° · Elev: {ephemeris.moon.altitudeDeg}°
                                </div>
                            </div>
                        </div>

                        {/* Tactical Lighting Banner */}
                        <div style={{
                            background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "10px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>ESTADO DE ILUMINACIÓN TÁCTICA:</div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                                    {ephemeris.tacticalLightingState}
                                </div>
                            </div>
                            <div style={{ fontSize: "1.3rem" }}>
                                {ephemeris.isDaylight ? "☀️" : "🌌"}
                            </div>
                        </div>

                        {/* Solar Noon Transit Calculator */}
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#FFB300" }}>ESTIMADOR DE COORDENADAS POR MEDIODÍA SOLAR:</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <div>
                                    <label style={{ fontSize: "0.65rem", color: "#AAA" }}>HORA TRÁNSITO CÉNIT (UTC):</label>
                                    <input type="text" value={transitTimeStr} onChange={(e) => setTransitTimeStr(e.target.value)} style={{ width: "100%", padding: "6px", borderRadius: "6px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.65rem", color: "#AAA" }}>ELEVACIÓN MÁXIMA (°):</label>
                                    <input type="number" value={maxSunAltitude} onChange={(e) => setMaxSunAltitude(parseFloat(e.target.value))} style={{ width: "100%", padding: "6px", borderRadius: "6px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem", boxSizing: "border-box" }} />
                                </div>
                            </div>
                            <button
                                onClick={handleCalculateSolarNoon}
                                style={{
                                    padding: "10px", borderRadius: "8px", background: "#FFB300",
                                    color: "#000", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                }}
                            >
                                📍 CALCULAR LAT/LON CELESTE
                            </button>
                            {estimatedCoords && (
                                <div style={{ background: "rgba(0,230,118,0.1)", border: "1px solid #00E676", padding: "8px", borderRadius: "8px", fontSize: "0.72rem", color: "#00E676", textAlign: "center" }}>
                                    Latitud: {estimatedCoords.estimatedLat}° N · Longitud: {estimatedCoords.estimatedLon}° W
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── TAB 2: PEDESTRIAN DEAD RECKONING ── */}
                {activeTab === "pdr" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>PASOS / DISTANCIA</div>
                                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E5FF" }}>
                                    {pdr.totalSteps} pasos
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    {pdr.distanceMeters} m recorridos ({pdr.averageSpeedMps} m/s)
                                </div>
                            </div>
                            <div style={{ background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>DESPLAZAMIENTO 2D</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#00E676" }}>
                                    N: {pdr.displacementNorthMeters}m · E: {pdr.displacementEastMeters}m
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    Rumbo: {pdr.currentHeadingDeg}°
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={handleTogglePdr}
                                style={{
                                    flex: 1, padding: "12px", borderRadius: "10px",
                                    background: pdr.isTracking ? "rgba(232,33,58,0.2)" : "rgba(0,230,118,0.2)",
                                    border: `1px solid ${pdr.isTracking ? "#FF3355" : "#00E676"}`,
                                    color: pdr.isTracking ? "#FF3355" : "#00E676", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer"
                                }}
                            >
                                {pdr.isTracking ? "⏸ PAUSAR PDR" : "▶ INICIAR RASTREO"}
                            </button>
                            <button
                                onClick={handleSimulateStep}
                                style={{
                                    flex: 1, padding: "12px", borderRadius: "10px",
                                    background: "rgba(0, 229, 255, 0.15)", border: "1px solid #00E5FF",
                                    color: "#00E5FF", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer"
                                }}
                            >
                                🚶 SIMULAR PASO
                            </button>
                            <button
                                onClick={handleResetPdr}
                                style={{
                                    padding: "12px", borderRadius: "10px",
                                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                                    color: "#AAA", fontWeight: 800, fontSize: "0.75rem", cursor: "pointer"
                                }}
                            >
                                ↺ RESET
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

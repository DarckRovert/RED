"use client";

import React, { useState, useEffect } from "react";
import { tacticalRdf, TargetSignalType } from "../lib/sensors/TacticalRdfEngine";
import { rdfTriangulation, LineOfBearing, RdfTargetFix } from "../lib/sensors/RdfTriangulationEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function TacticalFoxhuntModal() {
    const { navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<"rdf" | "triangulation">("rdf");

    // RDF State
    const [rdfState, setRdfState] = useState(() => tacticalRdf.getState());
    const [simHeading, setSimHeading] = useState<number>(45);
    const [simRssi, setSimRssi] = useState<number>(-65);

    // Triangulation State
    const [triangState, setTriangState] = useState(() => rdfTriangulation.getState());

    useEffect(() => {
        const unsubRdf = tacticalRdf.subscribe(setRdfState);
        const unsubTriang = rdfTriangulation.subscribe(setTriangState);

        return () => {
            unsubRdf();
            unsubTriang();
        };
    }, []);

    const handleRecordSample = () => {
        tacticalRdf.recordSample(simHeading, simRssi);
        toast.info(`Muestreo registrado: ${simHeading}° a ${simRssi} dBm`);
    };

    const handleAddCurrentLob = () => {
        const peak = tacticalRdf.getPeakBearing();
        const lob = rdfTriangulation.addBearing(4.6097, -74.0817, peak.peakHeadingDeg, peak.peakRssiDbm);
        toast.success(`🎯 Marcación LOB añadida: ${lob.bearingDeg}°`);
    };

    const handleSimulateFoxhunt = () => {
        rdfTriangulation.simulateSampleFoxhunt();
        toast.error("🦊 ¡OBJETIVO TRIANGULADO! Coordenadas fijadas");
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
                    <span style={{ fontSize: "1.2rem" }}>🦊</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            RADIOGONIOMETRÍA TÁCTICA & CAZA FOXHUNT
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Localización RDF y Triangulación LOB de Emisores Clandestinos
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
                    onClick={() => setActiveTab("rdf")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "rdf" ? "#00E5FF" : "transparent",
                        color: activeTab === "rdf" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🧭 Radiogoniometría Polar (RDF)
                </button>
                <button
                    onClick={() => setActiveTab("triangulation")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "triangulation" ? "#FF3355" : "transparent",
                        color: activeTab === "triangulation" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🎯 Triangulación LOB ({triangState.lobs.length})
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: POLAR RDF ── */}
                {activeTab === "rdf" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "0.68rem", color: "#AAA" }}>TIPO DE OBJETIVO SIGINT:</label>
                            <select
                                value={rdfState.targetType}
                                onChange={(e: any) => tacticalRdf.setTargetType(e.target.value)}
                                style={{ padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                            >
                                <option value="EMERGENCY_BEACON">Baliza de Emergencia SOS / Amiga</option>
                                <option value="CLANDESTINE_TRANSMITTER">Transmisor Clandestino / Emisor Espía</option>
                                <option value="ROGUE_JAMMER">Jammer RF / Inhibidor Hostil</option>
                                <option value="DRONE_UAV_LINK">Enlace C2 de Dron UAV</option>
                            </select>
                        </div>

                        {/* Peak Bearing Card */}
                        <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>RUMBO ESTIMADO DEL OBJETIVO:</div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#00E5FF" }}>
                                    {rdfState.peakBearing.peakHeadingDeg}°
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "#DDD" }}>
                                    Potencia: <span style={{ color: "#00E676", fontWeight: 800 }}>{rdfState.peakBearing.peakRssiDbm} dBm</span>
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>DISTANCIA APROX.:</div>
                                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#FFB300" }}>
                                    ~{rdfState.peakBearing.estimatedDistMeters} m
                                </div>
                            </div>
                        </div>

                        {/* Polar Simulation Inputs */}
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.68rem", color: "#AAA" }}>ORIENTACIÓN DEL DISPOSITIVO: {simHeading}°</label>
                                <input type="range" min="0" max="359" step="5" value={simHeading} onChange={(e) => setSimHeading(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.68rem", color: "#AAA" }}>INTENSIDAD DE SEÑAL (RSSI): {simRssi} dBm</label>
                                <input type="range" min="-110" max="-30" step="1" value={simRssi} onChange={(e) => setSimRssi(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
                                <button
                                    onClick={handleRecordSample}
                                    style={{ padding: "10px", borderRadius: "8px", background: "#00E5FF", color: "#000", fontWeight: 900, fontSize: "0.75rem", border: "none", cursor: "pointer" }}
                                >
                                    📥 REGISTRAR MUESTRA
                                </button>
                                <button
                                    onClick={handleAddCurrentLob}
                                    style={{ padding: "10px", borderRadius: "8px", background: "rgba(0,229,255,0.15)", border: "1px solid #00E5FF", color: "#00E5FF", fontWeight: 900, fontSize: "0.75rem", cursor: "pointer" }}
                                >
                                    🎯 CREAR LOB
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: LOB TRIANGULATION ── */}
                {activeTab === "triangulation" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(232, 33, 58, 0.08)", border: "1px solid rgba(232, 33, 58, 0.25)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Registra múltiples Líneas de Marcación (LOB) desde diferentes ubicaciones físicas para calcular la intersección geográfica del transmisor.
                        </div>

                        {triangState.lastFix && (
                            <div style={{ background: "rgba(232, 33, 58, 0.15)", border: "1.5px solid #FF3355", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ fontSize: "0.72rem", color: "#FF3355", fontWeight: 900 }}>
                                    🎯 POSICIÓN ESTIMADA DEL EMISOR:
                                </div>
                                <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#FFF" }}>
                                    Lat: {triangState.lastFix.targetLat} · Lon: {triangState.lastFix.targetLon}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#FFB300" }}>
                                    Radio de incertidumbre: ±{triangState.lastFix.uncertaintyRadiusMeters} metros
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    LOBs usados: {triangState.lastFix.lobsUsed} · Confianza: {triangState.lastFix.confidencePct}%
                                </div>
                            </div>
                        )}

                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ fontSize: "0.7rem", color: "#AAA", fontWeight: 800 }}>LÍNEAS DE MARCACIÓN (LOBs):</div>
                            {triangState.lobs.length === 0 ? (
                                <div style={{ fontSize: "0.72rem", color: "#666", padding: "8px 0" }}>No hay marcaciones registradas aún.</div>
                            ) : (
                                triangState.lobs.map((lob, idx) => (
                                    <div key={lob.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                        <div>
                                            LOB #{idx + 1}: {lob.bearingDeg}° ({lob.rssiDbm} dBm)
                                            <div style={{ fontSize: "0.65rem", color: "#888" }}>Obs: {lob.observerLat}, {lob.observerLon}</div>
                                        </div>
                                        <button
                                            onClick={() => rdfTriangulation.removeBearing(lob.id)}
                                            style={{ background: "transparent", border: "none", color: "#FF3355", cursor: "pointer", fontWeight: 900 }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <button
                                onClick={handleSimulateFoxhunt}
                                style={{ padding: "12px", borderRadius: "10px", background: "#FF3355", color: "#FFF", fontWeight: 900, fontSize: "0.76rem", border: "none", cursor: "pointer" }}
                            >
                                🦊 SIMULAR CAZA FOXHUNT
                            </button>
                            <button
                                onClick={() => rdfTriangulation.clearBearings()}
                                style={{ padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", color: "#AAA", fontWeight: 800, fontSize: "0.76rem", border: "none", cursor: "pointer" }}
                            >
                                LIMPIAR LOBS
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

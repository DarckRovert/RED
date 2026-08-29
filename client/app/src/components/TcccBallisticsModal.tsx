"use client";

import React, { useState, useEffect } from "react";
import { tacticalTccc, TourniquetRecord, LimbLocation } from "../lib/tactical/TacticalTcccEngine";
import { tacticalBallistics, BallisticSolution, TacticalBallisticsEngine } from "../lib/tactical/TacticalBallisticsEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function TcccBallisticsModal() {
    const { navigate } = useRedStore();
    const [tourniquets, setTourniquets] = useState<TourniquetRecord[]>(() => tacticalTccc.getActiveTourniquets());
    const [activeTab, setActiveTab] = useState<"tccc" | "ballistics">("tccc");

    // TCCC Inputs
    const [selectedLimb, setSelectedLimb] = useState<LimbLocation>("RIGHT_ARM");

    // Ballistics Inputs
    const [caliber, setCaliber] = useState<string>("5.56_NATO");
    const [distance, setDistance] = useState<number>(300);
    const [windMps, setWindMps] = useState<number>(4);
    const [inclineDeg, setInclineDeg] = useState<number>(0);
    const [solution, setSolution] = useState<BallisticSolution>(() => 
        tacticalBallistics.calculateSolution("5.56_NATO", 300, 4, 0)
    );

    useEffect(() => {
        const unsub = tacticalTccc.subscribe(setTourniquets);
        return unsub;
    }, []);

    useEffect(() => {
        setSolution(tacticalBallistics.calculateSolution(caliber, distance, windMps, inclineDeg));
    }, [caliber, distance, windMps, inclineDeg]);

    const handleApplyTourniquet = () => {
        tacticalTccc.applyTourniquet(selectedLimb);
        toast.error(`🩸 Torniquete CAT aplicado en ${selectedLimb}. Cronómetro iniciado.`);
    };

    const handleRemoveTourniquet = (id: string) => {
        tacticalTccc.removeTourniquet(id);
        toast.info("Torniquete retirado");
    };

    const handleExportCasualtyCard = () => {
        const cardText = tacticalTccc.generateDdForm1380({
            id: `CARD-${Date.now()}`,
            casualtyName: "Operador Desconocido",
            rosterNumber: "OP-DELTA-01",
            evacPriority: "URGENT",
            massiveBleedingControlled: true,
            tourniquets,
            airwayStatus: "INTACT",
            respirationStatus: "VENTED_CHEST_SEAL",
            circulationPulsePresent: true,
            txaAdministered: true,
            hypothermiaCoverApplied: true,
            painMedication: "Fentanilo transmucoso 800mcg",
            antibioticsGiven: true,
            splintApplied: false,
            createdTimestamp: Date.now(),
        });

        navigator.clipboard.writeText(cardText);
        toast.success("📋 Tarjeta de Baja DD Form 1380 copiada al portapapeles");
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
                    <span style={{ fontSize: "1.2rem" }}>🩸</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            TCCC TRIAGE & BALÍSTICA TÁCTICA
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Protocolo MARCH-PAWS, Torniquetes y Calculador Mil-Dot / MRAD
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
                    onClick={() => setActiveTab("tccc")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "tccc" ? "#FF3355" : "transparent",
                        color: activeTab === "tccc" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🩸 TCCC MARCH-PAWS ({tourniquets.length} TQ)
                </button>
                <button
                    onClick={() => setActiveTab("ballistics")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "ballistics" ? "#00E5FF" : "transparent",
                        color: activeTab === "ballistics" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🎯 Balística Mil-Dot / MRAD
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: TCCC MARCH-PAWS ── */}
                {activeTab === "tccc" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Tourniquet Control */}
                        <div style={{ background: "rgba(232, 33, 58, 0.08)", border: "1px solid rgba(232, 33, 58, 0.3)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 900, color: "#FF3355" }}>[M] GESTIÓN DE TORNIQUETES CAT / ISQUEMIA:</div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <select
                                    value={selectedLimb}
                                    onChange={(e: any) => setSelectedLimb(e.target.value)}
                                    style={{ flex: 2, padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                                >
                                    <option value="RIGHT_ARM">Brazo Derecho</option>
                                    <option value="LEFT_ARM">Brazo Izquierdo</option>
                                    <option value="RIGHT_LEG">Pierna Derecha</option>
                                    <option value="LEFT_LEG">Pierna Izquierda</option>
                                </select>
                                <button
                                    onClick={handleApplyTourniquet}
                                    style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "#FF3355", color: "#FFF", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer" }}
                                >
                                    ＋ APLICAR TQ
                                </button>
                            </div>

                            {/* Active Tourniquets List */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {tourniquets.length === 0 ? (
                                    <div style={{ fontSize: "0.72rem", color: "#888", fontStyle: "italic" }}>No hay torniquetes activos registrados</div>
                                ) : (
                                    tourniquets.map(tq => (
                                        <div
                                            key={tq.id}
                                            style={{
                                                padding: "8px 12px", borderRadius: "8px",
                                                background: tq.isIschemicAlert ? "rgba(232,33,58,0.3)" : "rgba(255,255,255,0.04)",
                                                border: `1px solid ${tq.isIschemicAlert ? "#FF3355" : "rgba(255,255,255,0.1)"}`,
                                                display: "flex", justifyContent: "space-between", alignItems: "center"
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: "0.78rem", color: tq.isIschemicAlert ? "#FF3355" : "#FFF" }}>
                                                    {tq.limb} ({tq.type})
                                                </div>
                                                <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                                                    Tiempo: {tq.elapsedMinutes} min {tq.isIschemicAlert && "⚠️ ALERTA ISQUEMIA (>=120m)"}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveTourniquet(tq.id)}
                                                style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.1)", color: "#AAA", border: "none", fontSize: "0.68rem", cursor: "pointer" }}
                                            >
                                                Retirar
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Export DD Form 1380 */}
                        <button
                            onClick={handleExportCasualtyCard}
                            style={{
                                padding: "12px", borderRadius: "10px",
                                background: "linear-gradient(135deg, #00E5FF, #00B0FF)",
                                color: "#000", fontWeight: 900, fontSize: "0.82rem", border: "none", cursor: "pointer"
                            }}
                        >
                            📋 GENERAR TARJETA DE BAJA DD FORM 1380
                        </button>
                    </div>
                )}

                {/* ── TAB 2: BALLISTICS CALCULATOR ── */}
                {activeTab === "ballistics" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>CALIBRE TÁCTICO:</label>
                                <select
                                    value={caliber}
                                    onChange={(e) => setCaliber(e.target.value)}
                                    style={{ padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                                >
                                    {Object.entries(TacticalBallisticsEngine.PROFILES).map(([k, p]) => (
                                        <option key={k} value={k}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>DISTANCIA AL BLANCO: {distance} metros</label>
                                <input type="range" min="50" max="1000" step="25" value={distance} onChange={(e) => setDistance(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>VIENTO CRUZADO: {windMps} m/s</label>
                                <input type="range" min="0" max="15" step="1" value={windMps} onChange={(e) => setWindMps(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>ÁNGULO DE INCLINACIÓN: {inclineDeg}°</label>
                                <input type="range" min="-45" max="45" step="5" value={inclineDeg} onChange={(e) => setInclineDeg(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>
                        </div>

                        {/* Ballistic Solution Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>ELEVACIÓN (DROP)</div>
                                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E5FF" }}>
                                    +{solution.elevationMrad} MRAD
                                </div>
                                <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                    {solution.elevationClicksMrad} Clics (0.1 Mil) · {solution.bulletDropCm} cm
                                </div>
                            </div>
                            <div style={{ background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.2)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>DERIVA VIENTO (WINDAGE)</div>
                                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E676" }}>
                                    {solution.windageMrad} MRAD
                                </div>
                                <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                    {solution.windDriftCm} cm deriva
                                </div>
                            </div>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>TIEMPO DE VUELO</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFF" }}>
                                    {solution.timeOfFlightSec} s
                                </div>
                            </div>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>ENERGÍA TERMINAL</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFB300" }}>
                                    {solution.kineticEnergyJoules} J ({solution.remainingVelocityMps} m/s)
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { waterPurification, WaterSourceType, DisinfectionMethod, PurificationDosageResult } from "../lib/sensors/WaterPurificationEngine";
import { tacticalPowerGovernor, MissionPowerProfile, TacticalPowerGovernorEngine } from "../lib/sensors/TacticalPowerGovernorEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function VitalResourcesModal() {
    const { navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<"water" | "power">("water");

    // Water Inputs
    const [liters, setLiters] = useState<number>(5);
    const [source, setSource] = useState<WaterSourceType>("CLEAR_RIVER");
    const [method, setMethod] = useState<DisinfectionMethod>("SODIUM_HYPOCHLORITE_5PCT");
    const [dosage, setDosage] = useState<PurificationDosageResult>(() => 
        waterPurification.calculateDose(5, "CLEAR_RIVER", "SODIUM_HYPOCHLORITE_5PCT")
    );
    const [tdsPpm, setTdsPpm] = useState<number>(180);

    // Power Inputs
    const [batteryPct, setBatteryPct] = useState<number>(75);
    const [profile, setProfile] = useState<MissionPowerProfile>("ACTIVE_MESH");
    const [panelWatts, setPanelWatts] = useState<number>(15);

    useEffect(() => {
        setDosage(waterPurification.calculateDose(liters, source, method));
    }, [liters, source, method]);

    const autonomy = tacticalPowerGovernor.estimateAutonomy(batteryPct, 5000, 3.85, profile);
    const solar = tacticalPowerGovernor.estimateSolarChargeTime(panelWatts, 5000, batteryPct, 100);
    const tdsClassification = waterPurification.classifyTds(tdsPpm);

    const handleStartContactTimer = () => {
        toast.info(`⏳ Temporizador de desinfección de ${dosage.contactTimeMinutes} minutos iniciado.`);
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
                    <span style={{ fontSize: "1.2rem" }}>💧</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            RECURSOS VITALES: AGUA & ENERGÍA
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Dosimetría de Purificación H2O y Autonomía de Batería de Campaña
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
                    onClick={() => setActiveTab("water")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "water" ? "#00E5FF" : "transparent",
                        color: activeTab === "water" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    💧 Purificación H2O
                </button>
                <button
                    onClick={() => setActiveTab("power")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "power" ? "#FFB300" : "transparent",
                        color: activeTab === "power" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    ⚡ Gestión Energética ({autonomy.remainingHours}h)
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: WATER PURIFICATION ── */}
                {activeTab === "water" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>VOLUMEN DE AGUA A POTABILIZAR: {liters} Litros</label>
                                <input type="range" min="1" max="50" step="1" value={liters} onChange={(e) => setLiters(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <div>
                                    <label style={{ fontSize: "0.65rem", color: "#AAA" }}>FUENTE DE AGUA:</label>
                                    <select
                                        value={source}
                                        onChange={(e: any) => setSource(e.target.value)}
                                        style={{ width: "100%", padding: "6px", borderRadius: "6px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem" }}
                                    >
                                        <option value="CLEAR_RIVER">Río / Manantial Claro</option>
                                        <option value="TURBID_PUDDLE">Charco / Agua Turbia</option>
                                        <option value="RAIN_WATER">Agua de Lluvia</option>
                                        <option value="STAGNANT_SWAMP">Pantano Estancado</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.65rem", color: "#AAA" }}>MÉTODO DISPONIBLE:</label>
                                    <select
                                        value={method}
                                        onChange={(e: any) => setMethod(e.target.value)}
                                        style={{ width: "100%", padding: "6px", borderRadius: "6px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem" }}
                                    >
                                        <option value="SODIUM_HYPOCHLORITE_5PCT">Cloro Líquido 5%</option>
                                        <option value="IODINE_2PCT">Tintura de Yodo 2%</option>
                                        <option value="AQUATABS_NADCC">Pastillas NaDCC (Aquatabs)</option>
                                        <option value="BOILING">Hervor / Ebullición</option>
                                        <option value="SOLAR_UV_SODIS">Desinfección Solar SODIS</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Dosage Result Card */}
                        <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "0.7rem", color: "#AAA" }}>DOSIS RECOMENDADA:</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#00E5FF" }}>
                                {dosage.dosageText}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#DDD" }}>
                                Tiempo de contacto: <span style={{ color: "#00E676", fontWeight: 800 }}>{dosage.contactTimeMinutes} minutos</span>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#AAA", background: "rgba(0,0,0,0.4)", padding: "8px", borderRadius: "6px", marginTop: "4px" }}>
                                {dosage.instructions}
                            </div>
                            <button
                                onClick={handleStartContactTimer}
                                style={{ marginTop: "6px", padding: "10px", borderRadius: "8px", background: "#00E5FF", color: "#000", fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer" }}
                            >
                                ⏳ INICIAR CRONÓMETRO DE CONTACTO
                            </button>
                        </div>

                        {/* TDS Classification */}
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.68rem", color: "#AAA" }}>EVALUADOR TDS (Total Dissolved Solids): {tdsPpm} ppm</label>
                            <input type="range" min="20" max="1200" step="10" value={tdsPpm} onChange={(e) => setTdsPpm(parseInt(e.target.value))} style={{ width: "100%" }} />
                            <div style={{ fontSize: "0.72rem", color: tdsClassification.status === "UNSAFE" ? "#FF3355" : "#00E676", fontWeight: 800 }}>
                                Estado: [{tdsClassification.status}] · {tdsClassification.advice}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: POWER GOVERNOR ── */}
                {activeTab === "power" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>NIVEL DE BATERÍA DEL DISPOSITIVO: {batteryPct}%</label>
                                <input type="range" min="1" max="100" step="1" value={batteryPct} onChange={(e) => setBatteryPct(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.7rem", color: "#AAA" }}>PERFIL DE MISIÓN TÁCTICO:</label>
                                <select
                                    value={profile}
                                    onChange={(e: any) => setProfile(e.target.value)}
                                    style={{ padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem" }}
                                >
                                    {Object.entries(TacticalPowerGovernorEngine.PROFILES).map(([k, p]) => (
                                        <option key={k} value={k}>{p.name} ({p.powerMilliwatts} mW)</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Autonomy Stats Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ background: "rgba(255, 179, 0, 0.08)", border: "1px solid rgba(255, 179, 0, 0.3)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>AUTONOMÍA ESTIMADA</div>
                                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#FFB300" }}>
                                    {autonomy.remainingHours} h
                                </div>
                                <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                    {autonomy.remainingEnergyWh} Wh restantes
                                </div>
                            </div>
                            <div style={{ background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.3)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>RECARGA SOLAR (Panel {panelWatts}W)</div>
                                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#00E676" }}>
                                    {solar.chargeTimeHours} h
                                </div>
                                <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                    {solar.effectiveSolarWatts} W potencia efectiva
                                </div>
                            </div>
                        </div>

                        {/* Solar Panel Selector */}
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.68rem", color: "#AAA" }}>POTENCIA DEL PANEL SOLAR PORTÁTIL:</label>
                            <div style={{ display: "flex", gap: "8px" }}>
                                {[5, 10, 15, 21, 28].map(w => (
                                    <button
                                        key={w}
                                        onClick={() => setPanelWatts(w)}
                                        style={{
                                            flex: 1, padding: "8px", borderRadius: "6px",
                                            background: panelWatts === w ? "#FFB300" : "rgba(255,255,255,0.05)",
                                            color: panelWatts === w ? "#000" : "#AAA", border: "none", fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                                        }}
                                    >
                                        {w}W
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

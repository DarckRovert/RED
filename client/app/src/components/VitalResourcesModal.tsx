"use client";

import React, { useState, useEffect, useRef } from "react";
import { waterPurification, WaterSourceType, DisinfectionMethod, PurificationDosageResult } from "../lib/sensors/WaterPurificationEngine";
import { tacticalPowerGovernor, MissionPowerProfile, TacticalPowerGovernorEngine } from "../lib/sensors/TacticalPowerGovernorEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { meshRouter } from "../lib/mesh/meshRouter";

export function VitalResourcesModal() {
    const { navigate, goBack } = useRedStore();

    const [activeTab, setActiveTab] = useState<"water" | "power">("water");

    // ── Water Inputs ──
    const [liters, setLiters] = useState<number>(5);
    const [source, setSource] = useState<WaterSourceType>("CLEAR_RIVER");
    const [method, setMethod] = useState<DisinfectionMethod>("SODIUM_HYPOCHLORITE_5PCT");
    const [dosage, setDosage] = useState<PurificationDosageResult>(() => 
        waterPurification.calculateDose(5, "CLEAR_RIVER", "SODIUM_HYPOCHLORITE_5PCT")
    );
    const [tdsPpm, setTdsPpm] = useState<number>(180);

    // SODIS Customization
    const [sodisUvIndex, setSodisUvIndex] = useState<number>(7);
    const [sodisCloudCover, setSodisCloudCover] = useState<number>(20);

    // ── Water Contact Countdown Timer ──
    const [timerSecondsRemaining, setTimerSecondsRemaining] = useState<number | null>(null);
    const [timerTotalSeconds, setTimerTotalSeconds] = useState<number>(0);
    const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
    const hasAlarmFiredRef = useRef<boolean>(false);

    // ── Power Inputs ──
    const [batteryPct, setBatteryPct] = useState<number>(() => {
        if (typeof window !== "undefined" && typeof (window as any).__red_last_battery === "number") {
            return (window as any).__red_last_battery;
        }
        return 100;
    });
    const [profile, setProfile] = useState<MissionPowerProfile>("ACTIVE_MESH");
    const [panelWatts, setPanelWatts] = useState<number>(15);
    const [targetSolarChargePct, setTargetSolarChargePct] = useState<number>(100);

    // ── Hardware Battery Sync with real levelchange event listener ──
    useEffect(() => {
        let isMounted = true;
        let batteryObj: any = null;
        let onLevelChange: any = null;

        const fetchHardwareBattery = async () => {
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const cap = window as any;
                    if (cap?.Plugins?.Device?.getBatteryInfo) {
                        const info = await cap.Plugins.Device.getBatteryInfo();
                        if (isMounted && typeof info?.batteryLevel === "number") {
                            const pct = Math.round(info.batteryLevel * 100);
                            setBatteryPct(pct);
                            if (typeof window !== "undefined") (window as any).__red_last_battery = pct;
                            return;
                        }
                    }
                }
                if (typeof navigator !== "undefined" && "getBattery" in navigator) {
                    batteryObj = await (navigator as any).getBattery();
                    if (isMounted && batteryObj && typeof batteryObj.level === "number") {
                        const pct = Math.round(batteryObj.level * 100);
                        setBatteryPct(pct);
                        if (typeof window !== "undefined") (window as any).__red_last_battery = pct;
                    }

                    onLevelChange = () => {
                        if (isMounted && batteryObj && typeof batteryObj.level === "number") {
                            const pct = Math.round(batteryObj.level * 100);
                            setBatteryPct(pct);
                            if (typeof window !== "undefined") (window as any).__red_last_battery = pct;
                        }
                    };
                    batteryObj.addEventListener("levelchange", onLevelChange);
                }
            } catch (err) {
                console.warn("[VitalResourcesModal] Battery sync error:", err);
            }
        };

        fetchHardwareBattery();

        return () => {
            isMounted = false;
            if (batteryObj && onLevelChange) {
                try {
                    batteryObj.removeEventListener("levelchange", onLevelChange);
                } catch {}
            }
        };
    }, []);

    // ── Recalculate Dosage on Water Parameters Change ──
    useEffect(() => {
        let res = waterPurification.calculateDose(liters, source, method);
        if (method === "SOLAR_UV_SODIS") {
            const sodisCalc = waterPurification.calculateSodisHours(sodisUvIndex, sodisCloudCover);
            res = {
                ...res,
                contactTimeMinutes: sodisCalc.exposureHours * 60,
                instructions: sodisCalc.instructions
            };
        }
        setDosage(res);
    }, [liters, source, method, sodisUvIndex, sodisCloudCover]);

    // ── Active Water Contact Countdown Ticker ──
    useEffect(() => {
        if (!isTimerRunning || timerSecondsRemaining === null) return;

        if (timerSecondsRemaining <= 0) {
            setIsTimerRunning(false);
            if (!hasAlarmFiredRef.current) {
                hasAlarmFiredRef.current = true;
                TacticalAudioEngine.playEmergencyAlarm();
                toast.success("💧 ¡DESINFECCIÓN H2O COMPLETADA! Agua apta para consumo táctico.");
            }
            return;
        }

        const interval = setInterval(() => {
            setTimerSecondsRemaining(prev => {
                if (prev === null || prev <= 1) {
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isTimerRunning, timerSecondsRemaining]);

    const autonomy = tacticalPowerGovernor.estimateAutonomy(batteryPct, 5000, 3.85, profile);
    const solar = tacticalPowerGovernor.estimateSolarChargeTime(panelWatts, 5000, batteryPct, targetSolarChargePct);
    const tdsClassification = waterPurification.classifyTds(tdsPpm);

    // ── LIFO Back Navigation Handler: Pestaña Energía -> Pestaña Agua -> Salir ───
    useEffect(() => {
        const unreg = BackHandlerRegistry.register(() => {
            if (activeTab !== "water") {
                setActiveTab("water");
                TacticalAudioEngine.playTap();
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return unreg;
    }, [activeTab, goBack]);

    // ── Timer Handlers ──
    const handleStartContactTimer = () => {
        const totalSecs = Math.max(60, Math.round(dosage.contactTimeMinutes * 60));
        setTimerTotalSeconds(totalSecs);
        setTimerSecondsRemaining(totalSecs);
        setIsTimerRunning(true);
        hasAlarmFiredRef.current = false;
        TacticalAudioEngine.playRogerBeep();
        toast.info(`⏳ Temporizador de desinfección de ${dosage.contactTimeMinutes} minutos iniciado.`);
    };

    const handleTogglePauseTimer = () => {
        TacticalAudioEngine.playTap();
        setIsTimerRunning(prev => !prev);
    };

    const handleResetTimer = () => {
        TacticalAudioEngine.playTap();
        setIsTimerRunning(false);
        setTimerSecondsRemaining(null);
        setTimerTotalSeconds(0);
        hasAlarmFiredRef.current = false;
        toast.info("Temporizador reiniciado");
    };

    const formatCountdownTime = (totalSeconds: number): string => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) {
            return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        }
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    // ── Broadcast Power SITREP / Low Battery Alert ──
    const handleBroadcastPowerSitrep = async (isCritical: boolean = false) => {
        try {
            const sitrepPayload = {
                type: isCritical ? "CRITICAL_BATTERY_ALERT" : "TACTICAL_POWER_SITREP",
                batteryPct,
                profile,
                powerMw: autonomy.powerMw,
                autonomyHours: autonomy.remainingHours,
                remainingEnergyWh: autonomy.remainingEnergyWh,
                solarChargeTimeHours: solar.chargeTimeHours,
                panelWatts,
                timestamp: Date.now()
            };
            const payloadBytes = new TextEncoder().encode(JSON.stringify(sitrepPayload));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);

            if (isCritical) {
                TacticalAudioEngine.playEmergencyAlarm();
                toast.warning(`🚨 Alerta de batería crítica (${batteryPct}%) transmitida a la malla`);
            } else {
                TacticalAudioEngine.playRogerBeep();
                toast.success("⚡ Situación energética transmitida a la red de malla");
            }
        } catch (err: any) {
            toast.error("Error al transmitir telemetría: " + (err?.message || "Fallo"));
        }
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "#050812", color: "#FFF",
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
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            navigate("nodemap");
                        }}
                        style={{
                            background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                            color: "#00E5FF", padding: "6px 10px", borderRadius: "8px",
                            cursor: "pointer", fontWeight: 800, fontSize: "0.7rem"
                        }}
                    >
                        🗺️ MAPA
                    </button>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            goBack();
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
            </div>

            {/* Tab Selector */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "6px 16px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveTab("water");
                    }}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "water" ? "#00E5FF" : "transparent",
                        color: activeTab === "water" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    💧 Purificación H2O {timerSecondsRemaining !== null && timerSecondsRemaining > 0 && `(${formatCountdownTime(timerSecondsRemaining)})`}
                </button>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        setActiveTab("power");
                    }}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "power" ? (batteryPct <= 15 ? "#FF3355" : "#FFB300") : "transparent",
                        color: activeTab === "power" ? "#000" : (batteryPct <= 15 ? "#FF5252" : "#AAA"), border: "none", cursor: "pointer"
                    }}
                >
                    ⚡ Gestión Energética ({batteryPct}% · {autonomy.remainingHours}h)
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: WATER PURIFICATION ── */}
                {activeTab === "water" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <label style={{ fontSize: "0.7rem", color: "#AAA" }}>VOLUMEN DE AGUA A POTABILIZAR:</label>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "#00E5FF" }}>{liters} Litros</span>
                                </div>
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

                            {/* SODIS Atmospheric Settings */}
                            {method === "SOLAR_UV_SODIS" && (
                                <div style={{ background: "rgba(255, 179, 0, 0.08)", border: "1px dashed rgba(255, 179, 0, 0.4)", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#FFB300" }}>☀️ CONDICIONES DE RADIACIÓN SOLAR UV (SODIS):</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                        <div>
                                            <div style={{ fontSize: "0.62rem", color: "#AAA" }}>Índice UV Solar: {sodisUvIndex}</div>
                                            <input type="range" min="1" max="14" step="1" value={sodisUvIndex} onChange={(e) => setSodisUvIndex(parseInt(e.target.value))} style={{ width: "100%" }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.62rem", color: "#AAA" }}>Nubosidad: {sodisCloudCover}%</div>
                                            <input type="range" min="0" max="100" step="10" value={sodisCloudCover} onChange={(e) => setSodisCloudCover(parseInt(e.target.value))} style={{ width: "100%" }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Dosage Result Card */}
                        <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "0.7rem", color: "#AAA" }}>DOSIS RECOMENDADA:</div>
                            <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#00E5FF" }}>
                                {dosage.dosageText}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#DDD" }}>
                                Tiempo de contacto requerido: <span style={{ color: "#00E676", fontWeight: 800 }}>{dosage.contactTimeMinutes >= 60 ? `${Math.round(dosage.contactTimeMinutes / 60)} horas (${dosage.contactTimeMinutes} min)` : `${dosage.contactTimeMinutes} minutos`}</span>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#AAA", background: "rgba(0,0,0,0.4)", padding: "8px", borderRadius: "6px", marginTop: "4px" }}>
                                {dosage.instructions}
                            </div>

                            {/* Active Countdown Timer Block */}
                            {timerSecondsRemaining === null ? (
                                <button
                                    onClick={handleStartContactTimer}
                                    style={{ marginTop: "6px", padding: "11px", borderRadius: "8px", background: "#00E5FF", color: "#000", fontWeight: 900, fontSize: "0.8rem", border: "none", cursor: "pointer" }}
                                >
                                    ⏳ INICIAR CRONÓMETRO DE CONTACTO ({dosage.contactTimeMinutes} MIN)
                                </button>
                            ) : (
                                <div style={{
                                    marginTop: "8px", padding: "12px", borderRadius: "8px",
                                    background: timerSecondsRemaining === 0 ? "rgba(0, 230, 118, 0.15)" : "rgba(0, 0, 0, 0.5)",
                                    border: `1px solid ${timerSecondsRemaining === 0 ? "#00E676" : (isTimerRunning ? "#00E5FF" : "#FFB300")}`,
                                    display: "flex", flexDirection: "column", gap: "8px"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{
                                            fontSize: "0.7rem", fontWeight: 800,
                                            color: timerSecondsRemaining === 0 ? "#00E676" : (isTimerRunning ? "#00E5FF" : "#FFB300")
                                        }}>
                                            {timerSecondsRemaining === 0 
                                                ? "✅ DESINFECCIÓN COMPLETADA (LISTO PARA BEBER)" 
                                                : (isTimerRunning ? "⏱️ CRONÓMETRO DE CONTACTO EN MARCHA" : "⏸️ CRONÓMETRO PAUSADO")}
                                        </div>
                                        <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                            {timerTotalSeconds > 0 ? `${Math.round(((timerTotalSeconds - timerSecondsRemaining) / timerTotalSeconds) * 100)}% transcurrido` : ""}
                                        </div>
                                    </div>

                                    {/* Big Digital Countdown */}
                                    <div style={{
                                        fontSize: "2.2rem", fontWeight: 900, textAlign: "center", letterSpacing: "2px",
                                        color: timerSecondsRemaining === 0 ? "#00E676" : (isTimerRunning ? "#00E5FF" : "#FFB300")
                                    }}>
                                        {formatCountdownTime(timerSecondsRemaining)}
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{ height: "6px", width: "100%", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%",
                                            width: `${timerTotalSeconds > 0 ? Math.min(100, Math.round(((timerTotalSeconds - timerSecondsRemaining) / timerTotalSeconds) * 100)) : 0}%`,
                                            background: timerSecondsRemaining === 0 ? "#00E676" : "#00E5FF",
                                            transition: "width 0.5s ease"
                                        }} />
                                    </div>

                                    {/* Control Buttons */}
                                    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                        {timerSecondsRemaining > 0 && (
                                            <button
                                                onClick={handleTogglePauseTimer}
                                                style={{
                                                    flex: 1, padding: "8px", borderRadius: "6px",
                                                    background: isTimerRunning ? "rgba(255, 179, 0, 0.2)" : "#00E5FF",
                                                    border: `1px solid ${isTimerRunning ? "#FFB300" : "#00E5FF"}`,
                                                    color: isTimerRunning ? "#FFB300" : "#000", fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                                                }}
                                            >
                                                {isTimerRunning ? "⏸️ PAUSAR" : "▶️ REANUDAR"}
                                            </button>
                                        )}
                                        <button
                                            onClick={handleResetTimer}
                                            style={{
                                                flex: 1, padding: "8px", borderRadius: "6px",
                                                background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255,255,255,0.2)",
                                                color: "#FFF", fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                                            }}
                                        >
                                            🔄 REINICIAR
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* TDS Classification */}
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <label style={{ fontSize: "0.68rem", color: "#AAA" }}>EVALUADOR TDS (Total Dissolved Solids):</label>
                                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: tdsClassification.status === "UNSAFE" ? "#FF3355" : "#00E676" }}>{tdsPpm} ppm</span>
                            </div>
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
                        {/* Critical Battery Warning Banner */}
                        {batteryPct <= 15 && (
                            <div style={{
                                background: "rgba(232, 33, 58, 0.15)", border: "1px solid #E8213A",
                                borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "1.2rem" }}>🚨</span>
                                    <div style={{ fontSize: "0.78rem", fontWeight: 900, color: "#FF5252" }}>
                                        ADVERTENCIA DE BATERÍA CRÍTICA ({batteryPct}%)
                                    </div>
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#DDD" }}>
                                    El consumo de radio malla ha sido restringido por el regulador dinámico para prolongar la supervivencia del nodo.
                                </div>
                                <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                                    <button
                                        onClick={() => {
                                            TacticalAudioEngine.playTap();
                                            setProfile("SURVIVAL_STANDBY");
                                            toast.info("Perfil cambiado a Standby de Supervivencia (25 mW)");
                                        }}
                                        style={{
                                            flex: 1, padding: "8px", borderRadius: "6px",
                                            background: profile === "SURVIVAL_STANDBY" ? "#00E676" : "#E8213A",
                                            color: "#FFF", fontWeight: 900, fontSize: "0.7rem", border: "none", cursor: "pointer"
                                        }}
                                    >
                                        🛡️ ACTIVAR STANDBY (25 mW)
                                    </button>
                                    <button
                                        onClick={() => handleBroadcastPowerSitrep(true)}
                                        style={{
                                            flex: 1, padding: "8px", borderRadius: "6px",
                                            background: "rgba(255, 255, 255, 0.1)", border: "1px solid #FF5252",
                                            color: "#FF5252", fontWeight: 900, fontSize: "0.7rem", cursor: "pointer"
                                        }}
                                    >
                                        📡 ALERTAR A LA MALLA
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <label style={{ fontSize: "0.7rem", color: "#AAA" }}>NIVEL DE BATERÍA DEL DISPOSITIVO:</label>
                                    <span style={{ fontSize: "0.9rem", fontWeight: 900, color: batteryPct <= 15 ? "#FF5252" : (batteryPct <= 30 ? "#FFB300" : "#00E676") }}>
                                        {batteryPct}%
                                    </span>
                                </div>
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
                                <div style={{ fontSize: "0.64rem", color: "#888", marginTop: "2px" }}>
                                    {TacticalPowerGovernorEngine.PROFILES[profile]?.description}
                                </div>
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
                                    {autonomy.remainingEnergyWh} Wh ({autonomy.powerMw} mW gasto)
                                </div>
                            </div>
                            <div style={{ background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.3)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>RECARGA SOLAR (al {targetSolarChargePct}%)</div>
                                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#00E676" }}>
                                    {solar.chargeTimeHours} h
                                </div>
                                <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                    {solar.effectiveSolarWatts} W potencia efectiva
                                </div>
                            </div>
                        </div>

                        {/* Solar Panel & Target Selector */}
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "0.68rem", color: "#AAA" }}>POTENCIA DEL PANEL SOLAR PORTÁTIL:</label>
                            <div style={{ display: "flex", gap: "8px" }}>
                                {[5, 10, 15, 21, 28].map(w => (
                                    <button
                                        key={w}
                                        onClick={() => {
                                            TacticalAudioEngine.playTap();
                                            setPanelWatts(w);
                                        }}
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

                            <div style={{ marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.65rem", color: "#888" }}>OBJETIVO DE CARGA SOLAR:</span>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    {[50, 80, 100].map(pct => (
                                        <button
                                            key={pct}
                                            onClick={() => {
                                                TacticalAudioEngine.playTap();
                                                setTargetSolarChargePct(pct);
                                            }}
                                            style={{
                                                padding: "4px 8px", borderRadius: "4px",
                                                background: targetSolarChargePct === pct ? "#00E676" : "rgba(255,255,255,0.05)",
                                                color: targetSolarChargePct === pct ? "#000" : "#888", border: "none", fontWeight: 800, fontSize: "0.68rem", cursor: "pointer"
                                            }}
                                        >
                                            {pct}%
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Broadcast SITREP Button */}
                        <button
                            onClick={() => handleBroadcastPowerSitrep(false)}
                            style={{
                                padding: "12px", borderRadius: "8px", background: "rgba(0, 229, 255, 0.15)",
                                border: "1px solid #00E5FF", color: "#00E5FF", fontWeight: 900,
                                fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center",
                                justifyContent: "center", gap: "8px"
                            }}
                        >
                            <span>📡</span> TRANSMITIR SITREP ENERGÉTICO A LA MALLA
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}

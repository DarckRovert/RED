"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { getBatteryStatus, updateBatteryOptimize, EcoMeshStatus } from "../lib/api";
import { KineticDutyGovernor, KineticTelemetry } from "../lib/KineticDutyGovernor";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";
import { useTranslation } from "../lib/i18n/i18nEngine";

export const EcoMeshPanel: React.FC = () => {
    const { goBack } = useRedStore();
    const { t } = useTranslation();
    const [status, setStatus] = useState<EcoMeshStatus | null>(null);
    const [telemetry, setTelemetry] = useState<KineticTelemetry>(KineticDutyGovernor.getInstance().getTelemetry());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStatus = async () => {
        try {
            const st = await getBatteryStatus();
            if (st) {
                setStatus(st);
            }
        } catch (e: any) {
            setError(e.message || "Error al obtener métricas de Eco-Mesh");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
        const unsubscribe = KineticDutyGovernor.getInstance().subscribe((data) => {
            setTelemetry(data);
            // Sync with Rust backend if level differs
            updateBatteryOptimize(data.batteryLevel).catch(() => {});
        });
        return () => unsubscribe();
    }, []);

    const handleUpdate = async (val: number) => {
        KineticDutyGovernor.getInstance().setManualBattery(val);
        try {
            const res = await updateBatteryOptimize(val);
            setStatus(res.battery_status);
            toast.success(`Nivel de batería ajustado a ${val}%`);
        } catch {
            toast.info(`Simulación de nivel: ${val}%`);
        }
    };

    const handleShakeBoost = () => {
        KineticDutyGovernor.getInstance().triggerShakeBoost();
        toast.info("⚡ ¡RÁFAGA BOOST ACTIVADA! Escaneo BLE acelerado a 800ms por 20 segundos.");
    };

    const batteryLevel = telemetry.batteryLevel;
    const batteryColor = batteryLevel > 50 ? "var(--accent-emerald)" : batteryLevel > 20 ? "var(--accent-amber)" : "var(--accent-crimson)";

    const profileLabels: Record<string, { label: string; desc: string; icon: string; color: string }> = {
        SURVIVAL_SENTRY: {
            label: "CENTINELA DE SUPERVIVENCIA",
            desc: "Escaneo RF desacelerado a 12s para maximizar autonomía en apagón prolongado.",
            icon: "🪫",
            color: "var(--accent-crimson)"
        },
        BALANCED_PATROL: {
            label: "PATRULLA TÁCTICA BALANCEADA",
            desc: "Escaneo RF a 4s con equilibrio óptimo entre detección y consumo.",
            icon: "⚖️",
            color: "var(--accent-amber)"
        },
        HIGH_PERFORMANCE: {
            label: "MÁXIMO RENDIMIENTO TÁCTICO",
            desc: "Escaneo continuo a 1.5s para combate activo o enrutamiento de alta velocidad.",
            icon: "⚡",
            color: "var(--accent-emerald)"
        },
        SHAKE_BOOST: {
            label: "RÁFAGA DE EMPAREJAMIENTO (BOOST)",
            desc: "Escaneo ultra-rápido a 800ms disparado por sacudida o interacción física.",
            icon: "🚀",
            color: "var(--accent-cyan)"
        }
    };

    const currentProfileInfo = profileLabels[telemetry.currentProfile] || profileLabels.BALANCED_PATROL;

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                borderBottom: "1.5px solid rgba(0, 230, 118, 0.35)",
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
                        background: "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                        border: "1px solid rgba(0, 230, 118, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(0, 230, 118, 0.3)"
                    }}>🔋</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            {t.eco_module?.title || "GOBERNADOR ECO-MESH"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#00E676", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>
                            {telemetry.isStationary ? "MODO ESTACIONARIO (AHORRO MÁXIMO)" : "MOVIMIENTO CINÉTICO ACTIVO"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    style={{
                        width: 34, height: 34, borderRadius: "9px",
                        background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#FFFFFF", cursor: "pointer", fontSize: "0.9rem", fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "20px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {isLoading ? (
                        <SkeletonCard count={2} />
                    ) : error ? (
                        <ErrorBanner message={error} onRetry={loadStatus} />
                    ) : (
                        <>
                            {/* Visualizador Central de Batería y Autonomía */}
                            <div className="card-tactical animate-enter" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
                                <div style={{ position: "relative" }}>
                                    <div style={{
                                        width: 110, height: 110, borderRadius: "50%",
                                        background: "rgba(255,255,255,0.03)", border: `3px solid ${batteryColor}`,
                                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                        boxShadow: `0 0 24px ${batteryColor}33`
                                    }}>
                                        <div style={{ fontSize: "1.9rem", fontWeight: 900, color: batteryColor, fontFamily: "JetBrains Mono, monospace" }}>
                                            {batteryLevel}%
                                        </div>
                                        <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                            {telemetry.isCharging ? "⚡ CARGANDO" : "BATERÍA"}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: currentProfileInfo.color }}>
                                        {currentProfileInfo.icon} {currentProfileInfo.label}
                                    </div>
                                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", maxWidth: "460px" }}>
                                        {currentProfileInfo.desc}
                                    </div>
                                </div>

                                {/* Métricas Tácticas en Tiempo Real */}
                                <div style={{
                                    width: "100%", display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: "8px", background: "rgba(255,255,255,0.02)", padding: "12px",
                                    borderRadius: "12px", border: "1px solid var(--glass-border)"
                                }}>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>EST. AUTONOMÍA</div>
                                        <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                            ~{telemetry.estimatedMeshHours}h
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>INTERVALO BLE</div>
                                        <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {telemetry.bleScanIntervalMs}ms
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>POTENCIA LORA</div>
                                        <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {telemetry.loraTxPowerDbm} dBm
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Telemetría Cinemática de Acelerómetro */}
                            <div className="card-tactical animate-enter" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                                        🏃 TELEMETRÍA CINÉTICA DE SENSORES
                                    </div>
                                    <span className="badge-tactical badge-tactical-emerald">
                                        {telemetry.isStationary ? "ESTÁTICO" : "EN MOVIMIENTO"}
                                    </span>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                        <span>ENERGÍA DE MOVIMIENTO (RMS)</span>
                                        <span>{telemetry.kineticEnergyScore}%</span>
                                    </div>
                                    <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                                        <div style={{
                                            width: `${Math.max(5, telemetry.kineticEnergyScore)}%`, height: "100%",
                                            background: telemetry.kineticEnergyScore > 60 ? "var(--accent-cyan)" : "var(--accent-emerald)",
                                            transition: "width 0.2s ease-out"
                                        }} />
                                    </div>
                                </div>

                                <button
                                    onClick={handleShakeBoost}
                                    className="btn-tactical-secondary"
                                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderColor: "var(--accent-cyan)", color: "var(--accent-cyan)" }}
                                >
                                    🚀 FORZAR SACUDIDA / BOOST TEMPORAL (800ms)
                                </button>
                            </div>

                            {/* Perfiles de Ciclo de Trabajo Manual */}
                            <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>⚡ SOBREESCRITURA DE PERFIL DE ENERGÍA</div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                                    <button
                                        onClick={() => handleUpdate(15)}
                                        className="card-tactical-interactive"
                                        style={{ padding: "12px 8px", textAlign: "center", borderColor: batteryLevel <= 20 ? "var(--accent-crimson)" : "var(--glass-border)" }}
                                    >
                                        <div style={{ fontSize: "1.1rem" }}>🪫</div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-crimson)" }}>Supervivencia</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>15% Batería</div>
                                    </button>

                                    <button
                                        onClick={() => handleUpdate(45)}
                                        className="card-tactical-interactive"
                                        style={{ padding: "12px 8px", textAlign: "center", borderColor: (batteryLevel > 20 && batteryLevel <= 50) ? "var(--accent-amber)" : "var(--glass-border)" }}
                                    >
                                        <div style={{ fontSize: "1.1rem" }}>⚖️</div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-amber)" }}>Balanceado</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>45% Batería</div>
                                    </button>

                                    <button
                                        onClick={() => handleUpdate(95)}
                                        className="card-tactical-interactive"
                                        style={{ padding: "12px 8px", textAlign: "center", borderColor: batteryLevel > 50 ? "var(--accent-emerald)" : "var(--glass-border)" }}
                                    >
                                        <div style={{ fontSize: "1.1rem" }}>⚡</div>
                                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-emerald)" }}>Máximo</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>95% Batería</div>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
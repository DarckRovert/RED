"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { getBatteryStatus, updateBatteryOptimize, EcoMeshStatus } from "../lib/api";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";

export const EcoMeshPanel: React.FC = () => {
    const { navigate, goBack } = useRedStore();
    const [status, setStatus] = useState<EcoMeshStatus | null>(null);
    const [batteryInput, setBatteryInput] = useState<number>(85);
    const [isCharging, setIsCharging] = useState<boolean>(false);
    const [isRealHardwareSensor, setIsRealHardwareSensor] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStatus = async () => {
        try {
            const st = await getBatteryStatus();
            if (st) {
                setStatus(st);
                setBatteryInput(st.battery_level ?? 85);
            }
        } catch (e: any) {
            setError(e.message || "Error al obtener métricas de Eco-Mesh");
        }
    };

    const syncRealBattery = async (levelPercent: number) => {
        setBatteryInput(levelPercent);
        try {
            const res = await updateBatteryOptimize(levelPercent);
            setStatus(res.battery_status);
        } catch {}
    };

    const detectHardwareBattery = async () => {
        let detected = false;
        try {
            const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
            if (cap && cap.Plugins && cap.Plugins.Device) {
                const info = await cap.Plugins.Device.getBatteryInfo();
                if (info && typeof info.batteryLevel === "number") {
                    const pct = Math.round(info.batteryLevel * 100);
                    setIsCharging(!!info.isCharging);
                    setIsRealHardwareSensor(true);
                    await syncRealBattery(pct);
                    detected = true;
                }
            }
        } catch {}

        if (!detected && typeof navigator !== "undefined" && "getBattery" in navigator) {
            try {
                const battery: any = await (navigator as any).getBattery();
                const updateHtml5Battery = () => {
                    const pct = Math.round(battery.level * 100);
                    setIsCharging(!!battery.charging);
                    setIsRealHardwareSensor(true);
                    syncRealBattery(pct);
                };
                updateHtml5Battery();
                battery.addEventListener("levelchange", updateHtml5Battery);
                battery.addEventListener("chargingchange", updateHtml5Battery);
                detected = true;
            } catch {}
        }

        if (!detected) {
            await loadStatus();
        }
        setIsLoading(false);
    };

    useEffect(() => {
        detectHardwareBattery();
    }, []);

    const handleUpdate = async (val: number) => {
        await syncRealBattery(val);
        toast.success(`Nivel de batería ajustado a ${val}%`);
    };

    const batteryColor = batteryInput > 50 ? "var(--accent-emerald)" : batteryInput > 20 ? "var(--accent-amber)" : "var(--accent-crimson)";

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E676 0%, #00B0FF 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,230,118,0.4)"
                    }}>🔋</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Gobernador de Batería Eco-Mesh
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {isRealHardwareSensor ? "HARDWARE ANDROID SENSOR ACTIVO" : "PERFIL DE ENERGÍA TÁCTICO"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title="Cerrar gobernador"
                    style={{ width: 38, height: 38 }}
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
                        <ErrorBanner message={error} onRetry={detectHardwareBattery} />
                    ) : (
                        <>
                            {/* Visualizador Central de Batería */}
                            <div className="card-tactical animate-enter" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                        <div style={{
                            width: 100, height: 100, borderRadius: "50%",
                            background: "rgba(255,255,255,0.03)", border: `3px solid ${batteryColor}`,
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            boxShadow: `0 0 24px ${batteryColor}33`
                        }}>
                            <div style={{ fontSize: "1.8rem", fontWeight: 900, color: batteryColor, fontFamily: "JetBrains Mono, monospace" }}>
                                {batteryInput}%
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                {isCharging ? "⚡ CARGANDO" : "DESCARGA"}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>
                                Perfil Operativo: <span style={{ color: batteryColor }}>{status?.duty_cycle_mode || (batteryInput < 20 ? "ULTRA AHORRO" : batteryInput < 50 ? "MODERADO" : "RENDIMIENTO MÁXIMO")}</span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                {status?.recommendation || "El gobernador ajusta automáticamente los intervalos de escaneo BLE y WiFi para maximizar la autonomía del nodo."}
                            </div>
                        </div>
                    </div>

                    {/* Perfiles de Ciclo de Trabajo */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>⚡ PERFILES DE CICLO DE TRABAJO RF</div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                            <button
                                onClick={() => handleUpdate(15)}
                                className="card-tactical-interactive"
                                style={{ padding: "12px 8px", textAlign: "center", borderColor: batteryInput <= 20 ? "var(--accent-crimson)" : "var(--glass-border)" }}
                            >
                                <div style={{ fontSize: "1.1rem" }}>🪫</div>
                                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-crimson)" }}>Ultra Ahorro</div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>15% Batería</div>
                            </button>

                            <button
                                onClick={() => handleUpdate(45)}
                                className="card-tactical-interactive"
                                style={{ padding: "12px 8px", textAlign: "center", borderColor: (batteryInput > 20 && batteryInput <= 50) ? "var(--accent-amber)" : "var(--glass-border)" }}
                            >
                                <div style={{ fontSize: "1.1rem" }}>⚖️</div>
                                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-amber)" }}>Balanceado</div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>45% Batería</div>
                            </button>

                            <button
                                onClick={() => handleUpdate(95)}
                                className="card-tactical-interactive"
                                style={{ padding: "12px 8px", textAlign: "center", borderColor: batteryInput > 50 ? "var(--accent-emerald)" : "var(--glass-border)" }}
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
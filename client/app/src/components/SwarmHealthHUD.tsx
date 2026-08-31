"use client";

import React, { useState, useEffect } from "react";
import { dynamicBearerGovernor, SwarmHealthTelemetry, TacticalBearerType } from "../lib/mesh/DynamicBearerGovernor";
import { frequencyHopping, HoppingChannel } from "../lib/mesh/FrequencyHoppingEngine";
import { toast } from "./Toast";

export function SwarmHealthHUD({ onClose }: { onClose?: () => void }) {
    const [telemetry, setTelemetry] = useState<SwarmHealthTelemetry>(() => dynamicBearerGovernor.getTelemetry());
    const [currentHop, setCurrentHop] = useState<HoppingChannel>(() => frequencyHopping.getCurrentChannel());

    useEffect(() => {
        const unsub = dynamicBearerGovernor.subscribe(setTelemetry);
        const hopInterval = setInterval(() => {
            setCurrentHop(frequencyHopping.getCurrentChannel());
        }, 500);

        return () => {
            unsub();
            clearInterval(hopInterval);
        };
    }, []);

    const handleForceBearer = (b: TacticalBearerType) => {
        if (b === 'LORA_RF' && !currentHop.hasHardwareTransceiver) {
            toast.info("Para activar LoRa Sub-GHz, conecta un transceptor USB o actívalo en Ajustes");
            return;
        }
        if (b === 'SOUNDMESH' || b === 'LIFI_OPTICAL') {
            toast.info(`Portador ${b} listo para transmisión táctica`);
            return;
        }
        dynamicBearerGovernor.forceSwitchBearer(b);
        toast.success(`Portador de enjambre conmutado a: ${b}`);
    };

    const getBearerIcon = (b: string) => {
        switch (b) {
            case "WIFI_DIRECT": return "📶";
            case "BLE": return "🔷";
            case "LORA_RF": return "📻";
            case "SOUNDMESH": return "🔊";
            case "LIFI_OPTICAL": return "⚡";
            default: return "🌐";
        }
    };

    const getBearerColor = (b: string, isOnline: boolean) => {
        if (!isOnline) return "var(--text-muted, #64748B)";
        switch (b) {
            case "WIFI_DIRECT": return "var(--accent-emerald, #00E676)";
            case "BLE": return "var(--accent-cyan, #00E5FF)";
            case "LORA_RF": return "var(--accent-purple, #B388FF)";
            case "SOUNDMESH": return "var(--accent-amber, #FFB300)";
            default: return "#38BDF8";
        }
    };

    return (
        <div style={{
            background: "linear-gradient(180deg, rgba(10, 16, 36, 0.98) 0%, rgba(4, 8, 20, 0.99) 100%)",
            border: "1.5px solid rgba(0, 229, 255, 0.35)",
            borderRadius: "22px",
            padding: "18px",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            boxShadow: "0 15px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 229, 255, 0.15)",
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)",
            maxWidth: "520px",
            width: "100%"
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: "38px", height: "38px", borderRadius: "10px",
                        background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem"
                    }}>
                        🛰️
                    </div>
                    <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 900, color: "#00E5FF", letterSpacing: "0.5px" }}>
                            ENJAMBRE MULTI-BEARER & EW C2
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-secondary, #94A3B8)" }}>
                            Monitoreo de Enlaces Físicos & Matriz de Portadores
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                        fontSize: "0.65rem", fontWeight: 900, padding: "4px 8px", borderRadius: "8px",
                        background: telemetry.connectedPeersCount > 0 ? "rgba(0,230,118,0.18)" : "rgba(255,179,0,0.15)",
                        color: telemetry.connectedPeersCount > 0 ? "#00E676" : "#FFB300",
                        border: `1px solid ${telemetry.connectedPeersCount > 0 ? "#00E676" : "#FFB300"}`
                    }}>
                        {telemetry.connectedPeersCount > 0 ? `🟢 ${telemetry.connectedPeersCount} NODOS ACTIVOS` : "🟡 STANDALONE"}
                    </span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#FFFFFF",
                                width: "28px", height: "28px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem",
                                fontWeight: 900
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* RF Spectrum & Physical Hardware Monitor */}
            <div style={{
                background: "rgba(0, 0, 0, 0.55)", borderRadius: "14px", padding: "12px 14px",
                border: "1px solid rgba(0, 229, 255, 0.2)", display: "flex", flexDirection: "column", gap: "8px",
                boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.6)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#00E5FF", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                        <span style={{ fontSize: "0.72rem", color: "#38BDF8", fontWeight: 900, letterSpacing: "0.3px" }}>
                            ESTADO DE ESPECTRO & RADIOFRECUENCIA
                        </span>
                    </div>
                    <span style={{ fontSize: "0.62rem", color: "#AAA", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px" }}>
                        RTT: {telemetry.lastPingMs || 10} ms
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0, 229, 255, 0.04)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(0, 229, 255, 0.12)" }}>
                    <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "#00E676" }}>
                            {currentHop.rfBandLabel}
                        </div>
                        <div style={{ fontSize: "0.64rem", color: "#94A3B8", marginTop: "2px" }}>
                            Modo: {currentHop.operatingMode}
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 900, color: currentHop.hasHardwareTransceiver ? "#00E676" : "#94A3B8" }}>
                            {currentHop.hasHardwareTransceiver ? "CONECTADO" : "SIN TRANSCEPTOR EXT."}
                        </div>
                        <div style={{ fontSize: "0.60rem", color: "#64748B" }}>
                            {currentHop.hasHardwareTransceiver ? "LoRa SX1262 Activo" : "Operando Wi-Fi / BLE"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bearers Matrix */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", color: "#AAA", fontWeight: 800, textTransform: "uppercase" }}>
                    <span>MATRIZ DE PORTADORES DE RADIO</span>
                    <span style={{ color: "var(--accent-cyan)" }}>{telemetry.totalFailoversExecuted} CONMUTACIONES</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {telemetry.bearers.map(b => {
                        const isPrimary = telemetry.primaryBearer === b.bearer;
                        const bColor = getBearerColor(b.bearer, b.isOnline);

                        return (
                            <button
                                key={b.bearer}
                                type="button"
                                onClick={() => handleForceBearer(b.bearer)}
                                style={{
                                    padding: "10px 12px", borderRadius: "12px",
                                    background: isPrimary ? "linear-gradient(135deg, rgba(0, 229, 255, 0.16) 0%, rgba(10, 25, 45, 0.7) 100%)" : "rgba(255, 255, 255, 0.03)",
                                    border: `1.5px solid ${isPrimary ? "#00E5FF" : b.isOnline ? "rgba(0, 229, 255, 0.25)" : "rgba(255, 255, 255, 0.06)"}`,
                                    boxShadow: isPrimary ? "0 0 12px rgba(0, 229, 255, 0.18)" : "none",
                                    display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                                    textAlign: "left", transition: "all 0.15s ease",
                                    opacity: b.isOnline || isPrimary ? 1 : 0.65
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "1.1rem", width: "22px", textAlign: "center" }}>
                                        {getBearerIcon(b.bearer)}
                                    </span>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ fontSize: "0.78rem", fontWeight: 900, color: isPrimary ? "#00E5FF" : b.isOnline ? "#FFFFFF" : "var(--text-muted)" }}>
                                                {b.bearer}
                                            </span>
                                            {isPrimary && (
                                                <span style={{ fontSize: "0.58rem", color: "#00E5FF", background: "rgba(0, 229, 255, 0.2)", padding: "1px 5px", borderRadius: "4px", fontWeight: 900 }}>
                                                    PRIMARIO
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: "0.64rem", color: b.isOnline ? "#94A3B8" : "var(--text-muted)", marginTop: "1px" }}>
                                            {b.statusLabel}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: "right" }}>
                                    <div style={{
                                        fontSize: "0.70rem", fontWeight: 900,
                                        color: b.isOnline ? (isPrimary ? "#00E5FF" : "#00E676") : "var(--text-muted)"
                                    }}>
                                        {b.isOnline ? (b.throughputKbps > 0 ? `${b.throughputKbps} kbps` : "EN LÍNEA") : "OFFLINE"}
                                    </div>
                                    <div style={{ fontSize: "0.60rem", color: "#64748B" }}>
                                        {b.isOnline ? (b.latencyMs > 0 ? `${b.latencyMs}ms RTT` : "Listo") : "Sin enlace"}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

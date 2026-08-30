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
        }, 100);

        return () => {
            unsub();
            clearInterval(hopInterval);
        };
    }, []);

    const handleForceBearer = (b: TacticalBearerType) => {
        dynamicBearerGovernor.forceSwitchBearer(b);
        toast.info(`Portador táctico forzado a: ${b}`);
    };

    const getBearerIcon = (b: string) => {
        switch (b) {
            case "WIFI_DIRECT": return "📶";
            case "BLE": return "🔷";
            case "LORA_RF": return "📻";
            case "SOUNDMESH": return "🔊";
            case "LASER_VLC": return "⚡";
            default: return "🌐";
        }
    };

    const getBearerColor = (b: string) => {
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
            background: "linear-gradient(180deg, rgba(14, 20, 42, 0.98) 0%, rgba(6, 10, 24, 0.99) 100%)",
            border: "1.5px solid rgba(0, 229, 255, 0.4)",
            borderRadius: "22px",
            padding: "20px",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            boxShadow: "0 15px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 229, 255, 0.2)",
            backdropFilter: "blur(25px)",
            WebkitBackdropFilter: "blur(25px)"
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: "38px", height: "38px", borderRadius: "10px",
                        background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem"
                    }}>
                        🌐
                    </div>
                    <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#00E5FF", letterSpacing: "0.5px" }}>
                            ENJAMBRE MULTI-BEARER & EW C2
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary, #94A3B8)" }}>
                            Orquestador Táctico de Enlaces & Evasión Anti-Jamming
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                        fontSize: "0.68rem", fontWeight: 900, padding: "4px 10px", borderRadius: "8px",
                        background: telemetry.isElectronicWarfareActive ? "rgba(232,33,58,0.25)" : "rgba(0,230,118,0.18)",
                        color: telemetry.isElectronicWarfareActive ? "#FF3355" : "#00E676",
                        border: `1px solid ${telemetry.isElectronicWarfareActive ? "#FF3355" : "#00E676"}`,
                        boxShadow: `0 0 10px ${telemetry.isElectronicWarfareActive ? "rgba(255,51,85,0.3)" : "rgba(0,230,118,0.2)"}`
                    }}>
                        {telemetry.isElectronicWarfareActive ? "🚨 JAMMING DETECTADO" : "🛡️ ESPECTRO LIMPIO"}
                    </span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#FFFFFF",
                                width: "30px", height: "30px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem",
                                fontWeight: 900
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Live FHSS Frequency Hopping Monitor */}
            <div style={{
                background: "rgba(0, 0, 0, 0.5)", borderRadius: "14px", padding: "14px",
                border: "1px solid rgba(0, 229, 255, 0.25)", display: "flex", flexDirection: "column", gap: "10px",
                boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.6)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00E5FF", animation: "pulse 1s infinite", display: "inline-block" }} />
                        <span style={{ fontSize: "0.75rem", color: "#38BDF8", fontWeight: 900, letterSpacing: "0.3px" }}>
                            SALTO DE FRECUENCIA FHSS (902-928 MHz)
                        </span>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#AAA", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px" }}>
                        {currentHop.hopRatePerSec} hops/seg
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0, 229, 255, 0.05)", padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(0, 229, 255, 0.15)" }}>
                    <div>
                        <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E676", letterSpacing: "0.5px" }}>
                            {currentHop.frequencyMhz} <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>MHz</span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>
                            Canal #{currentHop.channelIndex} · Ranura {currentHop.slotEpoch}
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFB300" }}>
                            {currentHop.slotTimeRemainingMs} <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>ms</span>
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#94A3B8", textTransform: "uppercase" }}>Próximo Salto</div>
                    </div>
                </div>
            </div>

            {/* Bearers Matrix */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "#AAA", fontWeight: 800, textTransform: "uppercase" }}>
                    <span>MATRIZ DE PORTADORES DE RADIO</span>
                    <span style={{ color: "var(--accent-cyan)" }}>{telemetry.totalFailoversExecuted} Failovers</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {telemetry.bearers.map(b => {
                        const isPrimary = telemetry.primaryBearer === b.bearer;
                        const bColor = getBearerColor(b.bearer);
                        const qos = 100 - b.packetLossRatePct;

                        return (
                            <button
                                key={b.bearer}
                                type="button"
                                onClick={() => handleForceBearer(b.bearer)}
                                style={{
                                    padding: "10px 14px", borderRadius: "12px",
                                    background: isPrimary ? "linear-gradient(135deg, rgba(0, 229, 255, 0.16) 0%, rgba(10, 25, 45, 0.7) 100%)" : "rgba(255, 255, 255, 0.03)",
                                    border: `1.5px solid ${isPrimary ? "#00E5FF" : b.isJammed ? "#FF3355" : "rgba(255, 255, 255, 0.08)"}`,
                                    boxShadow: isPrimary ? "0 0 15px rgba(0, 229, 255, 0.2)" : "none",
                                    display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                                    textAlign: "left", transition: "all 0.15s ease"
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "1.2rem", width: "24px", textAlign: "center" }}>
                                        {getBearerIcon(b.bearer)}
                                    </span>
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{ fontSize: "0.82rem", fontWeight: 900, color: isPrimary ? "#00E5FF" : "#FFFFFF" }}>
                                                {b.bearer}
                                            </span>
                                            {isPrimary && (
                                                <span style={{ fontSize: "0.6rem", color: "#00E5FF", background: "rgba(0, 229, 255, 0.2)", padding: "1px 6px", borderRadius: "4px", fontWeight: 900 }}>
                                                    PRIMARIO
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "#94A3B8" }}>
                                            {b.throughputKbps} kbps · {b.latencyMs}ms latencia
                                        </div>
                                    </div>
                                </div>

                                <div style={{ textAlign: "right" }}>
                                    <div style={{
                                        fontSize: "0.75rem", fontWeight: 900,
                                        color: b.isJammed ? "#FF3355" : qos > 80 ? "#00E676" : qos > 50 ? "#FFB300" : "#FF3355"
                                    }}>
                                        {b.isJammed ? "🚨 JAMMED" : `${qos}% QoS`}
                                    </div>
                                    <div style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                                        Pérdida: {b.packetLossRatePct}%
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

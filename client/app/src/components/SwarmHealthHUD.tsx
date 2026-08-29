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
        toast.info(`Portador forzado a: ${b}`);
    };

    return (
        <div style={{
            background: "rgba(10, 15, 30, 0.95)", border: "1px solid rgba(0, 229, 255, 0.3)",
            borderRadius: "16px", padding: "16px", color: "#FFF",
            fontFamily: "JetBrains Mono, monospace", display: "flex", flexDirection: "column", gap: "14px",
            boxShadow: "0 0 24px rgba(0, 229, 255, 0.15)"
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>🌐</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            ENJAMBRE MULTI-BEARER & EW C2
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Orquestador de Enlaces y Evasión Anti-Jamming
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                        fontSize: "0.68rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                        background: telemetry.isElectronicWarfareActive ? "rgba(232,33,58,0.3)" : "rgba(0,230,118,0.2)",
                        color: telemetry.isElectronicWarfareActive ? "#FF3355" : "#00E676",
                        border: `1px solid ${telemetry.isElectronicWarfareActive ? "#FF3355" : "#00E676"}`
                    }}>
                        {telemetry.isElectronicWarfareActive ? "🚨 JAMMING ACTIVO" : "🛡️ ESPECTRO SEGURO"}
                    </span>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: "rgba(255,255,255,0.06)", border: "none", color: "#AAA",
                                padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem"
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Live FHSS Frequency Hopping Monitor */}
            <div style={{
                background: "rgba(0, 0, 0, 0.4)", borderRadius: "10px", padding: "12px",
                border: "1px solid rgba(0, 229, 255, 0.2)", display: "flex", flexDirection: "column", gap: "8px"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "#38BDF8", fontWeight: 800 }}>
                        📡 Salto de Frecuencia FHSS (902-928 MHz)
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "#AAA" }}>
                        {currentHop.hopRatePerSec} hops/seg
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#00E676" }}>
                            {currentHop.frequencyMhz} MHz
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#888" }}>
                            Canal #{currentHop.channelIndex} · Ranura {currentHop.slotEpoch}
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFB300" }}>
                            {currentHop.slotTimeRemainingMs} ms
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#888" }}>Próximo Salto</div>
                    </div>
                </div>
            </div>

            {/* Bearers Matrix */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "0.72rem", color: "#AAA", fontWeight: 800, textTransform: "uppercase" }}>
                    Estado de Portadores ({telemetry.totalFailoversExecuted} Failovers ejecutados)
                </div>
                {telemetry.bearers.map(b => {
                    const isPrimary = telemetry.primaryBearer === b.bearer;
                    return (
                        <div
                            key={b.bearer}
                            onClick={() => handleForceBearer(b.bearer)}
                            style={{
                                padding: "8px 12px", borderRadius: "8px",
                                background: isPrimary ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 255, 255, 0.03)",
                                border: `1px solid ${isPrimary ? "#00E5FF" : b.isJammed ? "#FF3355" : "rgba(255, 255, 255, 0.08)"}`,
                                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "1rem" }}>
                                    {b.bearer === "WIFI_DIRECT" ? "📶" : b.bearer === "BLE" ? "🔷" : b.bearer === "LORA_RF" ? "📻" : b.bearer === "SOUNDMESH" ? "🔊" : "💡"}
                                </span>
                                <div>
                                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: isPrimary ? "#00E5FF" : "#FFF" }}>
                                        {b.bearer} {isPrimary && "★ (PRIMARIO)"}
                                    </div>
                                    <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                        {b.throughputKbps} kbps · {b.latencyMs}ms lat
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{
                                    fontSize: "0.7rem", fontWeight: 900,
                                    color: b.isJammed ? "#FF3355" : b.packetLossRatePct > 20 ? "#FFB300" : "#00E676"
                                }}>
                                    {b.isJammed ? "🚨 JAMMED" : `${100 - b.packetLossRatePct}% QoS`}
                                </div>
                                <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                    Pérdida: {b.packetLossRatePct}%
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

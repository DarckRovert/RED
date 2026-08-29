"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { RedAPI } from "../lib/api";
import { SettingsManager } from "../lib/settingsManager";
import { KineticDutyGovernor } from "../lib/KineticDutyGovernor";

export default function StatusHeader() {
    const { nodeOnline, status, identity, navigate, preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();
    const [meshCounts, setMeshCounts] = useState({ wifi: 0, ble: 0, lora: 0, total: 0 });
    const [loraActive, setLoraActive] = useState(false);
    const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean; profile: string }>({
        level: 100,
        charging: false,
        profile: 'BALANCED_PATROL'
    });
    const [showModeModal, setShowModeModal] = useState(false);

    useEffect(() => {
        setLoraActive(typeof window !== "undefined" && localStorage.getItem("red_lora_enabled") === "true");
        
        // Refresh battery duty state
        const governor = KineticDutyGovernor.getInstance();
        const telem = governor.getTelemetry();
        setBatteryInfo({
            level: telem.batteryLevel,
            charging: telem.isCharging,
            profile: telem.currentProfile
        });

        if (!nodeOnline) return;
        const refresh = async () => {
            try {
                const peers = await RedAPI.getPeers();
                let wifi = 0, ble = 0, lora = 0, total = 0;
                for (const p of peers) {
                    const tr = (p.transport || "").toLowerCase();
                    if (tr === "wifi_direct" || tr === "websocket" || tr === "quic") wifi++;
                    else if (tr === "ble") ble++;
                    else if (tr === "lorawan" || tr === "lora") lora++;
                    total++;
                }
                setMeshCounts({ wifi, ble, lora, total });
            } catch {}
        };
        refresh();
        const timer = setInterval(refresh, 4000);
        return () => clearInterval(timer);
    }, [nodeOnline]);

    const activeNetwork = (() => {
        if (loraActive && meshCounts.lora > 0) return "LORA";
        if (meshCounts.wifi > 0) return "WIFI";
        if (meshCounts.ble > 0) return "BLE";
        if ((status?.peer_count ?? 0) > 0) return "P2P MESH";
        return "STANDALONE";
    })();

    const networkColor: Record<string, string> = {
        LORA:       "var(--accent-purple, #B388FF)",
        WIFI:       "var(--accent-emerald)",
        BLE:        "var(--accent-cyan)",
        "P2P MESH": "var(--accent-amber)",
        STANDALONE: "var(--accent-crimson)",
    };

    const currentMode = preferences.operationalMode || 'stealth';

    const operationalModes = [
        { id: 'stealth', label: 'Sigilo OLED', icon: '🕶️', desc: 'Carbón profundo, baja fatiga ocular (Standard)' },
        { id: 'scotopic_red', label: 'Luz Roja (650nm)', icon: '🔴', desc: 'Visión nocturna militar sin deslumbramiento' },
        { id: 'solar', label: 'Luz Solar / Exterior', icon: '☀️', desc: 'Alto contraste y bordes reforzados anti-reflejo' },
        { id: 'survival', label: 'Apagón / Supervivencia', icon: '⚡', desc: 'DEFCON 1, pure black OLED, máximo ahorro' },
        { id: 'offgrid', label: 'Comercio & Campo', icon: '🛒', desc: 'Terminal de vales Ed25519 y radar 360°' },
    ];

    const currentModeObj = operationalModes.find(m => m.id === currentMode) || operationalModes[0];

    const handleSelectMode = (modeId: any) => {
        updatePreferences({ operationalMode: modeId });
        setShowModeModal(false);
    };

    const isOffline = !nodeOnline;
    const color = networkColor[activeNetwork] || "var(--accent-cyan)";

    if (isOffline) {
        return (
            <div style={{
                width: "100%",
                background: "linear-gradient(90deg, #FF3355, #E8213A)",
                color: "white",
                textAlign: "center",
                padding: "calc(4px + var(--safe-top, 0px)) 8px 4px 8px",
                fontSize: "11px",
                fontWeight: 800,
                zIndex: 50,
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                flexShrink: 0
            }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "white", display: "inline-block", animation: "pulse 1s infinite" }} />
                {t('status_header.node_inaccessible')}
            </div>
        );
    }

    return (
        <>
            <div style={{
                width: "100%",
                background: "linear-gradient(180deg, rgba(12, 15, 30, 0.98) 0%, rgba(6, 8, 16, 0.99) 100%)",
                borderBottom: "1.5px solid var(--glass-border)",
                boxShadow: "0 4px 25px rgba(0, 0, 0, 0.7)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "calc(4px + var(--safe-top, 0px)) 12px 4px 12px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
                zIndex: 50,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                flexShrink: 0,
                gap: "8px"
            }}>
                {/* ── Left: Operational Mode Pill ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        type="button"
                        onClick={() => setShowModeModal(true)}
                        style={{
                            padding: "4px 8px",
                            background: "rgba(0, 0, 0, 0.6)",
                            border: "1px solid rgba(255, 255, 255, 0.18)",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            color: "#FFFFFF",
                            fontSize: "11px",
                            fontFamily: "JetBrains Mono, monospace",
                            fontWeight: 800,
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.4)"
                        }}
                        title={t('status_header.switch_mode') || "Cambiar Modo Operacional"}
                    >
                        <span>{currentModeObj.icon}</span>
                        <span style={{ letterSpacing: "0.5px", textTransform: "uppercase" }}>{currentModeObj.label}</span>
                        <span style={{ fontSize: "9px", opacity: 0.6 }}>▼</span>
                    </button>

                    {/* Active Transport Pill */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        padding: "3px 8px",
                        borderRadius: "8px",
                        fontSize: "10px"
                    }}>
                        <span style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: color, boxShadow: `0 0 8px ${color}`,
                            display: "inline-block", flexShrink: 0
                        }} />
                        <span style={{ color: "#FFFFFF", fontWeight: 900, letterSpacing: "0.5px" }}>
                            {activeNetwork}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                            ({meshCounts.total})
                        </span>
                    </div>
                </div>

                {/* ── Right: Telemetry & Tactical Actions ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {/* Kinematic Battery Indicator */}
                    <div 
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "rgba(0, 0, 0, 0.4)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            padding: "3px 8px",
                            borderRadius: "8px",
                            fontSize: "10px",
                            fontWeight: 800
                        }}
                        title={`Batería Cinemática: ${batteryInfo.level}% (${batteryInfo.profile})`}
                    >
                        <span>{batteryInfo.charging ? "⚡" : "🔋"}</span>
                        <span style={{ color: "#FFFFFF" }} className="tactical-tabular">{batteryInfo.level}%</span>
                    </div>

                    {/* Shortcuts */}
                    <button
                        type="button"
                        onClick={() => navigate("aiCopilot")}
                        style={{
                            padding: "4px 8px",
                            background: "rgba(0, 229, 255, 0.12)",
                            border: "1px solid rgba(0, 229, 255, 0.5)",
                            borderRadius: "8px",
                            color: "var(--accent-cyan)",
                            fontWeight: 900,
                            fontSize: "10px",
                            cursor: "pointer",
                            boxShadow: "0 0 8px rgba(0,229,255,0.2)"
                        }}
                        title="Asistente de IA Táctico Offline"
                    >
                        🤖 IA
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate("commercialHub")}
                        style={{
                            padding: "4px 8px",
                            background: "rgba(0, 230, 118, 0.12)",
                            border: "1px solid rgba(0, 230, 118, 0.5)",
                            borderRadius: "8px",
                            color: "var(--accent-emerald)",
                            fontWeight: 900,
                            fontSize: "10px",
                            cursor: "pointer",
                            boxShadow: "0 0 8px rgba(0,230,118,0.2)"
                        }}
                        title="Hub Comercial y Vales P2P"
                    >
                        💳 Hub
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate("nodemap")}
                        style={{
                            padding: "4px 8px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.14)",
                            borderRadius: "8px",
                            color: "#FFFFFF",
                            fontWeight: 900,
                            fontSize: "10px",
                            cursor: "pointer"
                        }}
                        title="Mapa Táctico de Nodos"
                    >
                        🗺️
                    </button>
                </div>
            </div>

            {/* ── Modal de Selección de Modo Operacional (HUD Overlay) ── */}
            {showModeModal && (
                <div 
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(2, 4, 10, 0.88)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px"
                    }}
                    onClick={() => setShowModeModal(false)}
                >
                    <div 
                        style={{
                            width: "100%",
                            maxWidth: "460px",
                            background: "linear-gradient(180deg, rgba(16, 20, 38, 0.98) 0%, rgba(8, 10, 22, 0.99) 100%)",
                            border: "1px solid rgba(0, 229, 255, 0.4)",
                            borderRadius: "20px",
                            padding: "20px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 229, 255, 0.15)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "14px"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "1.5rem" }}>🎛️</span>
                                <div>
                                    <h3 style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.8px", textTransform: "uppercase", margin: 0 }}>
                                        MODO OPERACIONAL TÁCTICO
                                    </h3>
                                    <p style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0 0" }}>
                                        Calibración HMI MIL-STD-1472
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowModeModal(false)}
                                style={{
                                    background: "rgba(255, 255, 255, 0.08)",
                                    border: "1px solid rgba(255, 255, 255, 0.15)",
                                    color: "#FFFFFF",
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    fontSize: "0.9rem",
                                    fontWeight: 900
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {operationalModes.map(m => {
                                const isSelected = m.id === currentMode;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => handleSelectMode(m.id)}
                                        style={{
                                            width: "100%",
                                            padding: "12px 14px",
                                            borderRadius: "14px",
                                            border: isSelected ? "1.5px solid var(--accent-cyan)" : "1px solid rgba(255, 255, 255, 0.1)",
                                            background: isSelected ? "linear-gradient(135deg, rgba(0, 229, 255, 0.18) 0%, rgba(10, 25, 45, 0.8) 100%)" : "rgba(255, 255, 255, 0.03)",
                                            boxShadow: isSelected ? "0 0 16px rgba(0, 229, 255, 0.25)" : "none",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "12px",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            transition: "all 0.15s ease"
                                        }}
                                    >
                                        <div style={{ fontSize: "1.6rem", width: "36px", textAlign: "center" }}>{m.icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.3px" }}>{m.label}</span>
                                                {isSelected && (
                                                    <span style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", background: "rgba(0, 229, 255, 0.15)", padding: "2px 6px", borderRadius: "6px" }}>
                                                        ACTIVO
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: "0.74rem", color: "var(--text-secondary)", margin: "3px 0 0 0", lineHeight: 1.3 }}>{m.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
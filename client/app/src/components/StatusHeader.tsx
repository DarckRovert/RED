"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { RedAPI } from "../lib/api";
import { KineticDutyGovernor } from "../lib/sensors/KineticDutyGovernor";
import { SwarmHealthHUD } from "./SwarmHealthHUD";
import { satelliteMeshGateway, SatelliteGatewayTelemetry } from "../lib/mesh/SatelliteMeshGatewayEngine";

export default function StatusHeader() {
    const { nodeOnline, status, navigate, preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();
    
    // Telemetry & Mesh state
    const [meshCounts, setMeshCounts] = useState({ wifi: 0, ble: 0, lora: 0, sound: 0, total: 0 });
    const [loraActive, setLoraActive] = useState(false);
    const [satTelem, setSatTelem] = useState<SatelliteGatewayTelemetry>(() => satelliteMeshGateway.getTelemetry());
    const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean; profile: string }>({
        level: 100,
        charging: false,
        profile: 'BALANCED_PATROL'
    });
    
    // Modals
    const [showModeModal, setShowModeModal] = useState(false);
    const [showSwarmModal, setShowSwarmModal] = useState(false);

    // Hardware Telemetry & Peers Polling
    const syncTelemetry = useCallback(async () => {
        // 1. Kinetic & Real Hardware Battery
        const governor = KineticDutyGovernor.getInstance();
        const telem = governor.getTelemetry();
        
        let realLevel = telem.batteryLevel;
        let isCharging = telem.isCharging;

        // Native Capacitor Device check
        try {
            const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
            if (cap?.Plugins?.Device) {
                const info = await cap.Plugins.Device.getBatteryInfo();
                if (typeof info?.batteryLevel === 'number') {
                    realLevel = Math.round(info.batteryLevel * 100);
                    isCharging = !!info.isCharging;
                }
            }
        } catch {}

        if (typeof window !== 'undefined') {
            (window as any).__red_last_battery = realLevel;
        }

        setBatteryInfo({
            level: Math.max(1, Math.min(100, realLevel)),
            charging: isCharging,
            profile: telem.currentProfile
        });

        // 2. Mesh Transport Peers
        if (nodeOnline) {
            try {
                const peers = await RedAPI.getPeers();
                let wifi = 0, ble = 0, lora = 0, sound = 0, total = 0;
                for (const p of peers) {
                    const tr = (p.transport || "").toLowerCase();
                    if (tr.includes("wifi") || tr.includes("websocket") || tr.includes("quic")) wifi++;
                    else if (tr.includes("ble")) ble++;
                    else if (tr.includes("lora")) lora++;
                    else if (tr.includes("sound") || tr.includes("ultrasonic")) sound++;
                    total++;
                }
                setMeshCounts({ wifi, ble, lora, sound, total });
            } catch {}
        }
    }, [nodeOnline]);

    useEffect(() => {
        setLoraActive(typeof window !== "undefined" && localStorage.getItem("red_lora_enabled") === "true");
        syncTelemetry();

        const unsubSat = satelliteMeshGateway.subscribe(setSatTelem);
        const timer = setInterval(syncTelemetry, 3500);
        return () => {
            clearInterval(timer);
            unsubSat();
        };
    }, [syncTelemetry]);

    const activeNetwork = (() => {
        if (loraActive && meshCounts.lora > 0) return "LORA RF";
        if (meshCounts.wifi > 0) return "WIFI DIRECT";
        if (meshCounts.ble > 0) return "BLE GATT";
        if (meshCounts.sound > 0) return "SOUNDMESH";
        if ((status?.peer_count ?? 0) > 0) return "P2P MESH";
        if (satTelem.isUplinkAvailable) return "SAT LEO";
        return "STANDALONE";
    })();

    const networkColor: Record<string, string> = {
        "LORA RF":     "var(--accent-purple, #B388FF)",
        "WIFI DIRECT": "var(--accent-emerald, #00E676)",
        "BLE GATT":    "var(--accent-cyan, #00E5FF)",
        "SOUNDMESH":   "var(--accent-amber, #FFB300)",
        "P2P MESH":    "var(--accent-cyan, #00E5FF)",
        "SAT LEO":     "var(--accent-cyan, #00E5FF)",
        "STANDALONE":  "var(--accent-crimson, #FF3355)",
    };

    const currentMode = preferences.operationalMode || 'stealth';

    const operationalModes = [
        { id: 'stealth', label: 'Sigilo OLED', icon: '🕶️', tag: 'DARK', desc: 'Negro puro (#000000), contraste ultra-alto, cero emisión de luz parasitaria.' },
        { id: 'scotopic_red', label: 'Luz Roja (650nm)', icon: '🔴', tag: 'NVG', desc: 'Monocromático rojo militar para preservación de visión nocturna en campo.' },
        { id: 'solar', label: 'Luz Solar / Exterior', icon: '☀️', tag: 'HI-CONTRAST', desc: 'Bordes reforzados y tipografía de máxima luminancia contra luz directa.' },
        { id: 'survival', label: 'Apagón / DEFCON 1', icon: '⚡', tag: 'ECO', desc: 'CPU throttled a 50%, radio duty cycle ultra-bajo para 48h+ de autonomía.' },
        { id: 'offgrid', label: 'Comercio & Campo', icon: '🛒', tag: 'BARTER', desc: 'Terminal de intercambio zk-Merkle y radar de proximidad activo.' },
    ];

    const currentModeObj = operationalModes.find(m => m.id === currentMode) || operationalModes[0];

    const handleSelectMode = (modeId: any) => {
        updatePreferences({ operationalMode: modeId });
        setShowModeModal(false);
    };

    const isOffline = !nodeOnline;
    const color = networkColor[activeNetwork] || "var(--accent-cyan)";
    const batteryLevel = batteryInfo.level;
    const batteryColor = batteryLevel > 50 ? "#00E676" : batteryLevel > 20 ? "#FFB300" : "#FF3355";

    if (isOffline) {
        return (
            <div style={{
                width: "100%",
                background: "linear-gradient(90deg, #D32F2F 0%, #B71C1C 50%, #D32F2F 100%)",
                color: "#FFFFFF",
                textAlign: "center",
                padding: "calc(6px + var(--safe-top, 0px)) 12px 6px 12px",
                fontSize: "11px",
                fontWeight: 900,
                zIndex: 50,
                letterSpacing: "1px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                flexShrink: 0,
                boxShadow: "0 2px 15px rgba(211, 47, 47, 0.5)",
                fontFamily: "JetBrains Mono, monospace"
            }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#FFFFFF", display: "inline-block", animation: "pulse 1s infinite" }} />
                <span>⚠️ {t('status_header.node_inaccessible') || "NODO LOCAL OFFLINE — INICIANDO SERVICIOS DE RESILIENCIA"}</span>
            </div>
        );
    }

    return (
        <>
            <header style={{
                width: "100%",
                background: "linear-gradient(180deg, rgba(8, 12, 24, 0.96) 0%, rgba(4, 6, 14, 0.98) 100%)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.2)",
                boxShadow: "0 4px 30px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "calc(6px + var(--safe-top, 0px)) 12px 6px 12px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.72rem",
                color: "var(--text-secondary)",
                zIndex: 50,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                flexShrink: 0,
                gap: "8px"
            }}>
                {/* ── Left: Operational Mode & Radio Bearer HUD ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flexShrink: 1, overflow: "hidden" }}>
                    {/* Operational Mode Pill */}
                    <button
                        type="button"
                        onClick={() => setShowModeModal(true)}
                        style={{
                            padding: "4px 8px",
                            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(0, 0, 0, 0.6) 100%)",
                            border: "1px solid rgba(255, 255, 255, 0.18)",
                            borderRadius: "9px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "#FFFFFF",
                            fontSize: "10.5px",
                            fontFamily: "JetBrains Mono, monospace",
                            fontWeight: 800,
                            cursor: "pointer",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                            transition: "all 0.15s ease",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                            flexShrink: 1
                        }}
                        title={t('status_header.switch_mode') || "Cambiar Modo Operacional"}
                    >
                        <span style={{ fontSize: "12px", flexShrink: 0 }}>{currentModeObj.icon}</span>
                        <span className="status-label-truncate" style={{ letterSpacing: "0.4px", textTransform: "uppercase" }}>{currentModeObj.label}</span>
                        <span style={{ fontSize: "8px", opacity: 0.5, marginLeft: "2px", flexShrink: 0 }}>▼</span>
                    </button>

                    {/* Active Transport Pill & Pulse */}
                    <button
                        type="button"
                        onClick={() => setShowSwarmModal(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "rgba(0, 0, 0, 0.55)",
                            border: `1px solid ${color}40`,
                            padding: "4px 8px",
                            borderRadius: "9px",
                            fontSize: "10px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: `0 0 10px ${color}15`,
                            flexShrink: 0
                        }}
                        title="Abrir HUD de Enjambre Multi-Bearer & Salto FHSS"
                    >
                        <span style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: color,
                            boxShadow: `0 0 8px ${color}`,
                            display: "inline-block",
                            flexShrink: 0,
                            animation: meshCounts.total > 0 ? "pulse 2s infinite" : "none"
                        }} />
                        <span style={{ color: "#FFFFFF", fontWeight: 900, letterSpacing: "0.4px" }}>
                            {activeNetwork}
                        </span>
                        <span style={{ color: color, fontWeight: 900, background: `${color}20`, padding: "1px 5px", borderRadius: "5px", fontSize: "9px" }}>
                            {meshCounts.total}
                        </span>
                    </button>

                    {/* Quantum Shield Status Tag (Desktop/Tablet) */}
                    <div className="quantum-shield-badge" title="Blindaje Criptográfico Post-Cuántico NIST FIPS 203 (ML-KEM-768)">
                        <span>🛡️</span>
                        <span>ML-KEM-768</span>
                    </div>
                </div>

                {/* ── Right: Real Hardware Telemetry & Tactical Actions ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                    {/* Orbital LEO Gateway Satellite Badge */}
                    <button
                        type="button"
                        onClick={() => navigate("cbrnSatellite")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            background: satTelem.isUplinkAvailable ? "linear-gradient(135deg, rgba(0, 229, 255, 0.22) 0%, rgba(10, 25, 45, 0.8) 100%)" : "rgba(0, 0, 0, 0.55)",
                            border: `1px solid ${satTelem.isUplinkAvailable ? "#00E5FF" : "rgba(255, 255, 255, 0.12)"}`,
                            padding: "4px 8px",
                            borderRadius: "9px",
                            fontSize: "10px",
                            cursor: "pointer",
                            boxShadow: satTelem.isUplinkAvailable ? "0 0 10px rgba(0, 229, 255, 0.35)" : "none",
                            color: satTelem.isUplinkAvailable ? "#00E5FF" : "#94A3B8",
                            fontFamily: "JetBrains Mono, monospace",
                            fontWeight: 800,
                            flexShrink: 0,
                            transition: "all 0.15s ease"
                        }}
                        title={satTelem.isUplinkAvailable
                            ? `🛰️ Satélite LEO en AOS: ${satTelem.bestAvailableSatellite?.satelliteId} (${satTelem.bestAvailableSatellite?.constellation}) · Huella ~${satTelem.activeFootprintRadiusKm}km`
                            : `🛰️ Satélites LEO en seguimiento orbital · Próximo AOS en ${satTelem.activePasses[0]?.timeToAosSec || 0}s`
                        }
                    >
                        <span style={{ fontSize: "11px" }}>🛰️</span>
                        <span style={{ color: satTelem.isUplinkAvailable ? "#FFFFFF" : "#AAA", letterSpacing: "0.4px" }}>
                            {satTelem.isUplinkAvailable ? "LEO AOS" : "LEO"}
                        </span>
                        {satTelem.isUplinkAvailable && (
                            <span style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: "#00E5FF",
                                boxShadow: "0 0 6px #00E5FF",
                                display: "inline-block",
                                animation: "pulse 1.2s infinite"
                            }} />
                        )}
                    </button>

                    {/* Live Hardware Battery Gauge */}
                    <div 
                        onClick={() => navigate("ecoMesh")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            background: "rgba(0, 0, 0, 0.6)",
                            border: `1px solid ${batteryColor}50`,
                            padding: "4px 8px",
                            borderRadius: "9px",
                            fontSize: "10px",
                            fontWeight: 900,
                            cursor: "pointer",
                            boxShadow: `0 0 8px ${batteryColor}20`
                        }}
                        title={`Batería Hardware: ${batteryLevel}% (${batteryInfo.profile}) ${batteryInfo.charging ? '⚡ Cargando' : ''}`}
                    >
                        {/* Mini Battery Graphic */}
                        <div style={{
                            width: "16px",
                            height: "9px",
                            border: "1px solid rgba(255, 255, 255, 0.6)",
                            borderRadius: "2px",
                            padding: "1px",
                            display: "flex",
                            alignItems: "center",
                            position: "relative"
                        }}>
                            <div style={{
                                width: `${batteryLevel}%`,
                                height: "100%",
                                background: batteryColor,
                                borderRadius: "1px",
                                transition: "width 0.3s ease"
                            }} />
                            {/* Battery terminal pin */}
                            <div style={{
                                position: "absolute",
                                right: "-3px",
                                width: "2px",
                                height: "4px",
                                background: "rgba(255, 255, 255, 0.6)",
                                borderRadius: "0 1px 1px 0"
                            }} />
                        </div>

                        {batteryInfo.charging && <span style={{ color: "#FFD600", fontSize: "10px" }}>⚡</span>}
                        <span style={{ color: "#FFFFFF" }} className="tactical-tabular">{batteryLevel}%</span>
                    </div>

                    {/* Tactical Action: IA Copilot */}
                    <button
                        type="button"
                        onClick={() => navigate("aiCopilot")}
                        style={{
                            padding: "4px 8px",
                            background: "linear-gradient(135deg, rgba(0, 229, 255, 0.16) 0%, rgba(0, 150, 255, 0.08) 100%)",
                            border: "1px solid rgba(0, 229, 255, 0.5)",
                            borderRadius: "9px",
                            color: "var(--accent-cyan, #00E5FF)",
                            fontWeight: 900,
                            fontSize: "10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            boxShadow: "0 0 10px rgba(0,229,255,0.2)",
                            transition: "all 0.15s ease"
                        }}
                        title="Asistente de IA Táctico Offline"
                    >
                        <span>🧠</span>
                        <span className="status-text-hide-compact">IA</span>
                    </button>

                    {/* Tactical Action: Commercial Hub */}
                    <button
                        type="button"
                        onClick={() => navigate("commercialHub")}
                        style={{
                            padding: "4px 8px",
                            background: "linear-gradient(135deg, rgba(0, 230, 118, 0.16) 0%, rgba(0, 180, 80, 0.08) 100%)",
                            border: "1px solid rgba(0, 230, 118, 0.5)",
                            borderRadius: "9px",
                            color: "var(--accent-emerald, #00E676)",
                            fontWeight: 900,
                            fontSize: "10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            boxShadow: "0 0 10px rgba(0,230,118,0.2)",
                            transition: "all 0.15s ease"
                        }}
                        title="Hub Comercial y Vales P2P zk-Merkle"
                    >
                        <span>💳</span>
                        <span className="status-text-hide-compact">HUB</span>
                    </button>

                    {/* Tactical Action: Node Map */}
                    <button
                        type="button"
                        onClick={() => navigate("nodemap")}
                        style={{
                            padding: "4px 8px",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid rgba(255, 255, 255, 0.16)",
                            borderRadius: "9px",
                            color: "#FFFFFF",
                            fontWeight: 900,
                            fontSize: "10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            transition: "all 0.15s ease"
                        }}
                        title="Mapa Táctico de Nodos Mesh"
                    >
                        <span>🗺️</span>
                    </button>
                </div>
            </header>

            {/* ── Modal de Selección de Modo Operacional (HUD Overlay) ── */}
            {showModeModal && (
                <div 
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(2, 4, 10, 0.88)",
                        backdropFilter: "blur(25px)",
                        WebkitBackdropFilter: "blur(25px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px",
                        animation: "fadeIn 0.2s ease"
                    }}
                    onClick={() => setShowModeModal(false)}
                >
                    <div 
                        style={{
                            width: "100%",
                            maxWidth: "480px",
                            background: "linear-gradient(180deg, rgba(14, 18, 36, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                            border: "1px solid rgba(0, 229, 255, 0.4)",
                            borderRadius: "22px",
                            padding: "22px",
                            boxShadow: "0 15px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 229, 255, 0.2)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "14px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div style={{
                                    width: "40px", height: "40px", borderRadius: "12px",
                                    background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem"
                                }}>
                                    🎛️
                                </div>
                                <div>
                                    <h3 style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.8px", textTransform: "uppercase", margin: 0 }}>
                                        MODO OPERACIONAL TÁCTICO
                                    </h3>
                                    <p style={{ fontSize: "0.72rem", color: "var(--accent-cyan, #00E5FF)", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0 0" }}>
                                        Calibración HMI MIL-STD-1472 & Perfil de Emisión
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
                                    borderRadius: "9px",
                                    cursor: "pointer",
                                    fontSize: "0.9rem",
                                    fontWeight: 900
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modes List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {operationalModes.map(m => {
                                const isSelected = m.id === currentMode;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => handleSelectMode(m.id)}
                                        style={{
                                            width: "100%",
                                            padding: "14px 16px",
                                            borderRadius: "15px",
                                            border: isSelected ? "1.5px solid var(--accent-cyan, #00E5FF)" : "1px solid rgba(255, 255, 255, 0.09)",
                                            background: isSelected ? "linear-gradient(135deg, rgba(0, 229, 255, 0.18) 0%, rgba(10, 25, 50, 0.85) 100%)" : "rgba(255, 255, 255, 0.03)",
                                            boxShadow: isSelected ? "0 0 20px rgba(0, 229, 255, 0.25)" : "none",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "14px",
                                            textAlign: "left",
                                            cursor: "pointer",
                                            transition: "all 0.15s ease"
                                        }}
                                    >
                                        <div style={{ fontSize: "1.8rem", width: "40px", textAlign: "center", flexShrink: 0 }}>{m.icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.3px" }}>{m.label}</span>
                                                    <span style={{ fontSize: "0.62rem", color: isSelected ? "#00E5FF" : "#888", border: `1px solid ${isSelected ? "#00E5FF" : "#444"}`, padding: "1px 5px", borderRadius: "4px", fontWeight: 800 }}>
                                                        {m.tag}
                                                    </span>
                                                </div>
                                                {isSelected && (
                                                    <span style={{ fontSize: "0.68rem", color: "#00E5FF", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", background: "rgba(0, 229, 255, 0.15)", padding: "2px 8px", borderRadius: "6px" }}>
                                                        ACTIVO
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ fontSize: "0.74rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.35 }}>{m.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de Enjambre Multi-Bearer & Salto FHSS (Overlay) ── */}
            {showSwarmModal && (
                <div 
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9999,
                        background: "rgba(2, 4, 10, 0.88)",
                        backdropFilter: "blur(25px)",
                        WebkitBackdropFilter: "blur(25px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px",
                        animation: "fadeIn 0.2s ease"
                    }}
                    onClick={() => setShowSwarmModal(false)}
                >
                    <div 
                        style={{ width: "100%", maxWidth: "520px" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <SwarmHealthHUD onClose={() => setShowSwarmModal(false)} />
                    </div>
                </div>
            )}
        </>
    );
}
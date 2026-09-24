"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { RedAPI } from "../lib/api";
import { KineticDutyGovernor } from "../lib/sensors/KineticDutyGovernor";
import { SwarmHealthHUD } from "./SwarmHealthHUD";
import { satelliteMeshGateway, SatelliteGatewayTelemetry } from "../lib/mesh/SatelliteMeshGatewayEngine";
import { globalShield, GlobalShieldTelemetry } from "../lib/network/GlobalShieldEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { tacticalGhostGps } from "../lib/sensors/TacticalGhostGpsEngine";
import { redCyberTunnel } from "../lib/network/RedCyberTunnelEngine";
import TacIcon, { TacIconName } from "./ui/TacIcon";
import { meshRouter, MeshPeer } from "../lib/mesh/meshRouter";
import { toast } from "./Toast";

export default function StatusHeader() {
    const { nodeOnline, status, navigate, preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();
    
    // Telemetry & Mesh state
    const [meshCounts, setMeshCounts] = useState({ wifi: 0, ble: 0, lora: 0, sound: 0, total: 0 });
    const [loraActive, setLoraActive] = useState(false);
    const [satTelem, setSatTelem] = useState<SatelliteGatewayTelemetry>(() => satelliteMeshGateway.getTelemetry());
    const [shieldTelem, setShieldTelem] = useState<GlobalShieldTelemetry>(() => globalShield.getTelemetry());
    const [isGhostGpsActive, setIsGhostGpsActive] = useState(() => tacticalGhostGps.isGhostActive());
    const [isCyberTunnelActive, setIsCyberTunnelActive] = useState(() => redCyberTunnel.isTunnelActive());
    const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean; profile: string }>({
        level: 100,
        charging: false,
        profile: 'BALANCED_PATROL'
    });
    
    // Modals
    const [showModeModal, setShowModeModal] = useState(false);
    const [showSwarmModal, setShowSwarmModal] = useState(false);

    // Hardware Battery Sync (Capacitor Native + Fallback)
    const syncBattery = useCallback(async () => {
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
    }, []);

    // Reactive Mesh Peer Counts (Subscribed to MeshRouter 0-latency Event Bus)
    useEffect(() => {
        const computeCounts = (peersMap: Map<string, MeshPeer>) => {
            let wifi = 0, ble = 0, lora = 0, sound = 0, total = 0;
            for (const p of peersMap.values()) {
                const tr = (p.transport || "").toLowerCase();
                const trs = (p.transports || []).map(t => String(t).toLowerCase());
                const matches = (bearer: string) => tr.includes(bearer) || trs.some(t => t.includes(bearer));

                if (matches("wifi") || matches("websocket") || matches("quic")) wifi++;
                else if (matches("ble")) ble++;
                else if (matches("lora")) lora++;
                else if (matches("sound") || matches("ultrasonic")) sound++;
                total++;
            }
            setMeshCounts({ wifi, ble, lora, sound, total });
        };

        computeCounts(meshRouter.peers);
        const unsubPeers = meshRouter.onPeersChange(computeCounts);
        return unsubPeers;
    }, []);

    useEffect(() => {
        setLoraActive(typeof window !== "undefined" && localStorage.getItem("red_lora_enabled") === "true");
        syncBattery();

        const unsubKinetic = KineticDutyGovernor.getInstance().subscribe(telem => {
            setBatteryInfo(prev => ({
                level: Math.max(1, Math.min(100, telem.batteryLevel)),
                charging: telem.isCharging,
                profile: telem.currentProfile
            }));
        });
        const unsubSat = satelliteMeshGateway.subscribe(setSatTelem);
        const unsubShield = globalShield.subscribe(setShieldTelem);
        const unsubGhost = tacticalGhostGps.addListener(() => {
            setIsGhostGpsActive(tacticalGhostGps.isGhostActive());
        });
        const unsubTunnel = redCyberTunnel.addListener((stats) => {
            setIsCyberTunnelActive(stats.isActive);
        });
        const timer = setInterval(syncBattery, 3500);
        return () => {
            clearInterval(timer);
            unsubKinetic();
            unsubSat();
            unsubShield();
            unsubGhost();
            unsubTunnel();
        };
    }, [syncBattery]);

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
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';

    const operationalModes: Array<{ id: string; label: string; icon: TacIconName; tag: string; desc: string }> = [
        { id: 'stealth', label: 'Sigilo OLED', icon: 'moon', tag: 'DARK', desc: 'Negro puro (#000000), contraste ultra-alto, cero emisión de luz parasitaria.' },
        { id: 'scotopic_red', label: 'Luz Roja (650nm)', icon: 'beacon', tag: 'NVG', desc: 'Monocromático rojo militar para preservación de visión nocturna en campo.' },
        { id: 'solar', label: 'Luz Solar / Exterior', icon: 'sun', tag: 'HI-CONTRAST', desc: 'Bordes reforzados y tipografía de máxima luminancia contra luz directa.' },
        { id: 'survival', label: 'Apagón / DEFCON 1', icon: 'zap', tag: 'ECO', desc: 'CPU throttled a 50%, radio duty cycle ultra-bajo para 48h+ de autonomía.' },
        { id: 'offgrid', label: 'Comercio & Campo', icon: 'wallet', tag: 'BARTER', desc: 'Terminal de intercambio zk-Merkle y radar de proximidad activo.' },
    ];

    const currentModeObj = operationalModes.find(m => m.id === currentMode) || operationalModes[0];

    // ── LIFO Back Navigation Handler para Modales de Cabecera ─────────────────────
    useEffect(() => {
        if (!showModeModal && !showSwarmModal) return;
        const unreg = BackHandlerRegistry.register(() => {
            if (showModeModal) {
                setShowModeModal(false);
                TacticalAudioEngine.playTap();
                return true;
            }
            if (showSwarmModal) {
                setShowSwarmModal(false);
                TacticalAudioEngine.playTap();
                return true;
            }
            return false;
        });
        return unreg;
    }, [showModeModal, showSwarmModal]);

    const handleSelectMode = (modeId: any) => {
        TacticalAudioEngine.playRogerBeep();
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
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <TacIcon name="alert-triangle" size={13} color="#FFFFFF" />
                    {t('status_header.node_inaccessible') || "NODO LOCAL OFFLINE — INICIANDO SERVICIOS DE RESILIENCIA"}
                </span>
            </div>
        );
    }

    return (
        <>
            <header style={{
                width: "100%",
                background: isFamiliar
                    ? "#111B21"
                    : "linear-gradient(180deg, rgba(8, 12, 24, 0.96) 0%, rgba(4, 6, 14, 0.98) 100%)",
                borderBottom: isFamiliar
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 229, 255, 0.2)",
                boxShadow: "0 4px 30px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "calc(6px + var(--safe-top, 0px)) 12px 6px 12px",
                fontFamily: isFamiliar
                    ? "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    : "JetBrains Mono, monospace",
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
                            background: isFamiliar
                                ? "#202C33"
                                : "linear-gradient(135deg, rgba(255, 255, 255, 0.07) 0%, rgba(0, 0, 0, 0.6) 100%)",
                            border: isFamiliar
                                ? "1px solid rgba(255, 255, 255, 0.12)"
                                : "1px solid rgba(255, 255, 255, 0.18)",
                            borderRadius: "9px",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            color: "#FFFFFF",
                            fontSize: "10.5px",
                            fontFamily: isFamiliar ? "inherit" : "JetBrains Mono, monospace",
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
                        <span style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                            <TacIcon name={currentModeObj.icon} size={13} color="#00E5FF" />
                        </span>
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
                            background: isFamiliar ? "#202C33" : "rgba(0, 0, 0, 0.55)",
                            border: isFamiliar ? `1px solid ${color}40` : `1px solid ${color}40`,
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
                        <TacIcon name="shield" size={11} color="var(--accent-cyan, #00E5FF)" />
                        <span>ML-KEM-768</span>
                    </div>
                </div>

                {/* ── Right: Real Hardware Telemetry & Tactical Actions ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                    {/* Ghost GPS Active Tactical Badge */}
                    {isGhostGpsActive && (
                        <button
                            type="button"
                            onClick={() => navigate("tacticalGhostGps")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "rgba(239, 68, 68, 0.2)",
                                border: "1px solid #ef4444",
                                padding: "4px 7px",
                                borderRadius: "9px",
                                fontSize: "10px",
                                fontFamily: "JetBrains Mono, monospace",
                                fontWeight: 900,
                                color: "#fca5a5",
                                cursor: "pointer",
                                boxShadow: "0 0 10px rgba(239, 68, 68, 0.4)",
                                flexShrink: 0
                            }}
                            title="Modo Señuelo GPS Activo. Transmitiendo ubicación falsa. Clic para gestionar."
                        >
                            <TacIcon name="ghost" size={12} color="#fca5a5" />
                            <span>SEÑUELO</span>
                        </button>
                    )}

                    {/* Zero-Rating CyberTunnel Active Badge */}
                    {isCyberTunnelActive && (
                        <button
                            type="button"
                            onClick={() => navigate("cyberTunnel")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "rgba(56, 189, 248, 0.2)",
                                border: "1px solid #38bdf8",
                                padding: "4px 7px",
                                borderRadius: "9px",
                                fontSize: "10px",
                                fontFamily: "JetBrains Mono, monospace",
                                fontWeight: 900,
                                color: "#38bdf8",
                                cursor: "pointer",
                                boxShadow: "0 0 10px rgba(56, 189, 248, 0.4)",
                                flexShrink: 0
                            }}
                            title="Túnel Zero-Rating Activo. Clic para abrir control."
                        >
                            <TacIcon name="zap" size={12} color="#38bdf8" />
                            <span>SIN SALDO</span>
                        </button>
                    )}

                    {/* DEFCON Tactical Pill */}
                    <button
                        type="button"
                        className="status-badge-hide-compact"
                        onClick={() => navigate("globalShield")}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "rgba(0, 0, 0, 0.55)",
                            border: `1px solid ${shieldTelem.activeProfile.color || '#00E676'}60`,
                            padding: "4px 7px",
                            borderRadius: "9px",
                            fontSize: "10px",
                            fontFamily: "JetBrains Mono, monospace",
                            fontWeight: 900,
                            color: shieldTelem.activeProfile.color || "#00E676",
                            cursor: "pointer",
                            boxShadow: `0 0 8px ${shieldTelem.activeProfile.color || '#00E676'}20`,
                            flexShrink: 0,
                            transition: "all 0.15s ease"
                        }}
                        title={`Escudo Global DEFCON ${shieldTelem.currentDefcon}: ${shieldTelem.activeProfile.label}. Clic para abrir matriz`}
                    >
                        <TacIcon name="shield" size={12} color={shieldTelem.activeProfile.color || "#00E676"} />
                        <span style={{ letterSpacing: "0.4px" }}>D-{shieldTelem.currentDefcon}</span>
                    </button>

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
                            ? `Satélite LEO en AOS: ${satTelem.bestAvailableSatellite?.satelliteId} (${satTelem.bestAvailableSatellite?.constellation}) · Huella ~${satTelem.activeFootprintRadiusKm}km`
                            : `Satélites LEO en seguimiento orbital · Próximo AOS en ${satTelem.activePasses[0]?.timeToAosSec || 0}s`
                        }
                    >
                        <TacIcon name="satellite" size={12} color={satTelem.isUplinkAvailable ? "#00E5FF" : "#94A3B8"} />
                        <span className="status-text-hide-compact" style={{ color: satTelem.isUplinkAvailable ? "#FFFFFF" : "#AAA", letterSpacing: "0.4px" }}>
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

                        {batteryInfo.charging && <TacIcon name="zap" size={10} color="#FFD600" />}
                        <span style={{ color: "#FFFFFF" }} className="tactical-tabular">{batteryLevel}%</span>
                    </div>

                    {/* Layout Viewport Switcher (Tablet Master-Detail vs Mobile Single-Column) */}
                    <button
                        type="button"
                        onClick={() => {
                            const currentLayout = preferences?.layoutMode || (typeof window !== 'undefined' ? localStorage.getItem('red_layout_mode') : null) || 'auto';
                            let nextLayout: 'auto' | 'tablet' | 'mobile' = 'tablet';
                            if (currentLayout === 'tablet') nextLayout = 'mobile';
                            else if (currentLayout === 'mobile') nextLayout = 'auto';
                            else nextLayout = 'tablet';

                            updatePreferences({ layoutMode: nextLayout });
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('red_layout_mode', nextLayout);
                                window.dispatchEvent(new CustomEvent('red:switch_layout', { detail: nextLayout }));
                            }
                            const label = nextLayout === 'tablet' ? 'Modo Tablet Dividido (Master-Detail)' : nextLayout === 'mobile' ? 'Modo Móvil (Una Columna)' : 'Detección Automática';
                            toast.info(`📐 ${label}`);
                        }}
                        style={{
                            padding: "4px 8px",
                            background: (preferences?.layoutMode === 'tablet') 
                                ? (isFamiliar ? "rgba(0, 168, 132, 0.2)" : "rgba(0, 229, 255, 0.18)")
                                : (isFamiliar ? "#202C33" : "rgba(0, 0, 0, 0.55)"),
                            border: (preferences?.layoutMode === 'tablet')
                                ? (isFamiliar ? "1px solid #00A884" : "1px solid rgba(0, 229, 255, 0.5)")
                                : "1px solid rgba(255, 255, 255, 0.14)",
                            borderRadius: "9px",
                            color: (preferences?.layoutMode === 'tablet') ? (isFamiliar ? "#00A884" : "#00E5FF") : "#CBD5E1",
                            fontWeight: 800,
                            fontSize: "10px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            flexShrink: 0,
                            boxShadow: (preferences?.layoutMode === 'tablet') ? "0 0 8px rgba(0,229,255,0.25)" : "none",
                            transition: "all 0.15s ease"
                        }}
                        title={`Diseño: ${preferences?.layoutMode === 'tablet' ? 'Tablet Forzado' : preferences?.layoutMode === 'mobile' ? 'Móvil Forzado' : 'Automático'} (Clic para alternar)`}
                    >
                        <TacIcon name="maximize" size={11} color={(preferences?.layoutMode === 'tablet') ? (isFamiliar ? "#00A884" : "#00E5FF") : "#CBD5E1"} />
                        <span className="status-text-hide-compact">
                            {preferences?.layoutMode === 'tablet' ? 'TABLET' : preferences?.layoutMode === 'mobile' ? 'MÓVIL' : 'AUTO'}
                        </span>
                    </button>

                    {/* Tactical Action Shortcuts: Only in Tactical Mode & hidden on ultra-compact */}
                    {!isFamiliar && (
                        <>
                            {/* Tactical Action: IA Copilot */}
                            <button
                                type="button"
                                className="status-badge-hide-compact"
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
                                <TacIcon name="cpu" size={12} color="var(--accent-cyan, #00E5FF)" />
                                <span className="status-text-hide-compact">IA</span>
                            </button>

                            {/* Tactical Action: Commercial Hub */}
                            <button
                                type="button"
                                className="status-badge-hide-compact"
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
                                <TacIcon name="wallet" size={12} color="var(--accent-emerald, #00E676)" />
                                <span className="status-text-hide-compact">HUB</span>
                            </button>

                            {/* Tactical Action: Node Map */}
                            <button
                                type="button"
                                className="status-badge-hide-compact"
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
                                <TacIcon name="compass" size={12} color="#FFFFFF" />
                            </button>
                        </>
                    )}
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
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                }}>
                                    <TacIcon name="sliders" size={20} color="#00E5FF" />
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
                                        <div style={{ width: "40px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <TacIcon name={m.icon} size={22} color={isSelected ? "#00E5FF" : "#94A3B8"} />
                                        </div>
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
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { dynamicBearerGovernor, SwarmHealthTelemetry, TacticalBearerType } from "../lib/mesh/DynamicBearerGovernor";
import { frequencyHopping, HoppingChannel } from "../lib/mesh/FrequencyHoppingEngine";
import { dtnStorage } from "../lib/mesh/dtnStorage";
import { meshRouter } from "../lib/mesh/meshRouter";
import { useRedStore } from "../store/useRedStore";
import { ScreenView } from "../store/types";
import { toast } from "./Toast";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";

interface BearerTacticalInfo {
    name: string;
    category: string;
    summary: string;
    howToUse: string;
    hardwareDetails: (hasTransceiver: boolean) => string;
    maxRange: string;
    bestFor: string;
    actionLabel: string;
    actionScreen: ScreenView;
}

function getBearerInfoMap(t: any): Record<TacticalBearerType, BearerTacticalInfo> {
    return {
        WIFI_DIRECT: {
            name: t('swarm_health_hud.bearer_wifi_direct') || "Wi-Fi Direct P2P",
            category: t('swarm_health_hud.bearer_wifi_category') || "Alta Velocidad / Corto Alcance",
            summary: t('swarm_health_hud.bearer_wifi_summary') || "Enlace punto a punto inalámbrico de alta velocidad sin depender de routers ni antenas externas.",
            howToUse: t('swarm_health_hud.bearer_wifi_how') || "Se activa automáticamente al detectar otros nodos RED cercanos (<100m). Soporta streaming de video, llamadas de voz P2P y transferencia de mapas.",
            hardwareDetails: () => "🟢 " + (t('swarm_health_hud.hw_wifi_native') || "Hardware nativo integrado (Wi-Fi 802.11ac)."),
            maxRange: t('swarm_health_hud.bearer_wifi_range') || "50 a 100 metros (Línea de vista directa)",
            bestFor: t('swarm_health_hud.bearer_wifi_best') || "Llamadas de voz en tiempo real, streaming, mapas offline y archivos grandes.",
            actionLabel: t('swarm_health_hud.bearer_wifi_action') || "Abrir Mapa Táctico 🗺️",
            actionScreen: "nodemap"
        },
        BLE: {
            name: t('swarm_health_hud.bearer_ble') || "Bluetooth Low Energy (BLE Mesh)",
            category: t('swarm_health_hud.bearer_ble_category') || "Ultra Bajo Consumo / Malla Silenciosa",
            summary: t('swarm_health_hud.bearer_ble_summary') || "Malla epidémica continua con consumo mínimo de batería que opera incluso con la pantalla apagada.",
            howToUse: t('swarm_health_hud.bearer_ble_how') || "Los paquetes de datos saltan de teléfono en teléfono formando un enjambre descentralizado sin intervención del usuario.",
            hardwareDetails: () => "🟢 " + (t('swarm_health_hud.hw_ble_native') || "Hardware nativo integrado (Bluetooth 5.0+ LE)."),
            maxRange: t('swarm_health_hud.bearer_ble_range') || "10 a 25 metros por salto (extensible por múltiples saltos en el enjambre)",
            bestFor: t('swarm_health_hud.bearer_ble_best') || "Mensajería de texto cifrada, balizas SOS y sincronización de coordenadas GPS.",
            actionLabel: t('swarm_health_hud.bearer_ble_action') || "Radar de Proximidad 📡",
            actionScreen: "proximity"
        },
        LORA_RF: {
            name: t('swarm_health_hud.bearer_lora') || "LoRa Sub-GHz (915 MHz)",
            category: t('swarm_health_hud.bearer_lora_category') || "Largo Alcance Táctico / Anti-Corte",
            summary: t('swarm_health_hud.bearer_lora_summary') || "Ondas de radiofrecuencia de espectro ensanchado (CSS) con alcance de hasta 25 km, inmune a la caída celular.",
            howToUse: t('swarm_health_hud.bearer_lora_how') || "Conecta un transceptor LoRa (ej. Heltec V3, T-Beam o dongle USB-C SX1262) al puerto USB OTG o vincúlalo por Bluetooth.",
            hardwareDetails: (hasTx) => hasTx ? ("🟢 " + (t('swarm_health_hud.lora_active') || "Transceptor USB/Serial Conectado y Activo")) : ("🟡 " + (t('swarm_health_hud.lora_required') || "Requiere módulo externo LoRa USB-C OTG o Bluetooth")),
            maxRange: t('swarm_health_hud.bearer_lora_range') || "Hasta 25 km en campo abierto / 3 a 5 km en entorno urbano",
            bestFor: t('swarm_health_hud.bearer_lora_best') || "Telemetría de campo, reportes de situación SITREP, balizas de emergencia a larga distancia.",
            actionLabel: t('swarm_health_hud.bearer_lora_action') || "Consola LoRa Táctica 📻",
            actionScreen: "loraTransceiver"
        },
        SOUNDMESH: {
            name: t('swarm_health_hud.bearer_soundmesh') || "SoundMesh Acústico",
            category: t('swarm_health_hud.bearer_soundmesh_category') || "Anti-Inhibición / Canal Ultrasónico",
            summary: t('swarm_health_hud.bearer_soundmesh_summary') || "Modulación de datos en frecuencias audibles y near-ultrasound (18 a 20 kHz) usando altavoces y micrófonos.",
            howToUse: t('swarm_health_hud.bearer_soundmesh_how') || "Ideal en búnkeres o durante ataques de guerra electrónica (EW/Jammers) donde todas las frecuencias de radio estén bloqueadas.",
            hardwareDetails: () => "🟢 " + (t('swarm_health_hud.hw_soundmesh_native') || "Utiliza los transductores de altavoz y micrófono nativos."),
            maxRange: t('swarm_health_hud.bearer_soundmesh_range') || "1 a 8 metros en la misma habitación, trinchera o vehículo blindado.",
            bestFor: t('swarm_health_hud.bearer_soundmesh_best') || "Intercambio de claves criptográficas, alertas breves y autenticación sin RF.",
            actionLabel: t('swarm_health_hud.bearer_soundmesh_action') || "Guerra Acústica & Jammer 🔊",
            actionScreen: "acousticWarfare"
        },
        LIFI_OPTICAL: {
            name: t('swarm_health_hud.bearer_lifi') || "LiFi Óptico Esteganográfico",
            category: t('swarm_health_hud.bearer_lifi_category') || "Silencio Radial Absoluto / Óptico",
            summary: t('swarm_health_hud.bearer_lifi_summary') || "Transmisión binaria mediante pulsos de luz del Flash LED y decodificación por sensor de cámara CMOS.",
            howToUse: t('swarm_health_hud.bearer_lifi_how') || "Apunta la cámara al flash del otro teléfono. Cero emisión de radiofrecuencia: imposible de detectar o triangular con analizadores de espectro hostiles.",
            hardwareDetails: () => "🟢 " + (t('swarm_health_hud.hw_lifi_native') || "Utiliza el Flash LED trasero y la cámara CMOS nativa."),
            maxRange: t('swarm_health_hud.bearer_lifi_range') || "Línea de vista directa (hasta 50 metros en oscuridad / 10 metros de día)",
            bestFor: t('swarm_health_hud.bearer_lifi_best') || "Transmisiones ultra-secretas en condiciones de sigilo electromagnético estricto.",
            actionLabel: t('swarm_health_hud.bearer_lifi_action') || "Consola LiFi & Morse ⚡",
            actionScreen: "airGapStego"
        },
        SATELLITE_LEO: {
            name: t('swarm_health_hud.bearer_satellite') || "Pasarela Satelital LEO",
            category: t('swarm_health_hud.bearer_satellite_category') || "Cobertura Global Espacial",
            summary: t('swarm_health_hud.bearer_satellite_summary') || "Enlace con constelaciones orbitales de baja altitud para contingencias extremas.",
            howToUse: t('swarm_health_hud.bearer_satellite_how') || "Calcula los pasos satelitales sobre tus coordenadas. Cuando un satélite está a más de 25° de elevación (AOS), despacha ráfagas de datos breves (SBD). Si no hay satélite visible, los guarda en el búfer DTN cifrado.",
            hardwareDetails: () => "🟢 " + (t('swarm_health_hud.hw_sat_native') || "Cálculo orbital SGP4 integrado + Despacho de ráfagas SBD."),
            maxRange: t('swarm_health_hud.bearer_satellite_range') || "Global (cobertura inter-continental e inter-malla sin fronteras)",
            bestFor: t('swarm_health_hud.bearer_satellite_best') || "SITREPs de evacuación, telemetría radiológica CBRN, balizas SOS satelitales.",
            actionLabel: t('swarm_health_hud.bearer_satellite_action') || "Radar SkyView Satelital 🛰️",
            actionScreen: "cbrnSatellite"
        }
    };
}

export function SwarmHealthHUD({ onClose }: { onClose?: () => void }) {
    const { t } = useTranslation();
    const { navigate } = useRedStore();
    const bearerInfoMap = useMemo(() => getBearerInfoMap(t), [t]);
    const [telemetry, setTelemetry] = useState<SwarmHealthTelemetry>(() => dynamicBearerGovernor.getTelemetry());
    const [currentHop, setCurrentHop] = useState<HoppingChannel>(() => frequencyHopping.getCurrentChannel());
    const [dtnCount, setDtnCount] = useState<number>(() => dtnStorage.count);
    const [expandedBearer, setExpandedBearer] = useState<TacticalBearerType | null>(null);

    useEffect(() => {
        if (!onClose) return;
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
        return unregister;
    }, [onClose]);

    useEffect(() => {
        const unsub = dynamicBearerGovernor.subscribe(setTelemetry);
        const hopInterval = setInterval(() => {
            setCurrentHop(frequencyHopping.getCurrentChannel());
        }, 500);
        const dtnTimer = setInterval(() => {
            setDtnCount(dtnStorage.count);
        }, 2000);

        return () => {
            unsub();
            clearInterval(hopInterval);
            clearInterval(dtnTimer);
        };
    }, []);

    const handleForceBearer = (b: TacticalBearerType) => {
        TacticalAudioEngine.playTap();
        if (b === 'LORA_RF' && !currentHop.hasHardwareTransceiver) {
            TacticalAudioEngine.playWarning();
            toast.info("Para activar LoRa Sub-GHz, conecta un transceptor USB o actívalo en Ajustes");
            return;
        }
        if (b === 'SOUNDMESH' || b === 'LIFI_OPTICAL') {
            dynamicBearerGovernor.forceSwitchBearer(b);
            TacticalAudioEngine.playRogerBeep();
            toast.info(`Portador ${b} forzado para transmisión táctica`);
            return;
        }
        if (b === 'SATELLITE_LEO') {
            dynamicBearerGovernor.forceSwitchBearer(b);
            TacticalAudioEngine.playRogerBeep();
            toast.success("🛰️ Portador primario conmutado a: Pasarela Satelital LEO");
            return;
        }
        dynamicBearerGovernor.forceSwitchBearer(b);
        TacticalAudioEngine.playRogerBeep();
        toast.success(t('swarm_health_hud.bearer_switched', { bearer: b }) || `Portador de enjambre conmutado a: ${b}`);
    };

    const handleResumeAutoMode = () => {
        TacticalAudioEngine.playRogerBeep();
        dynamicBearerGovernor.resumeAutomaticMode();
        toast.success(t('swarm_health_hud.auto_qos_restored') || '🔄 Enrutamiento Autónomo QoS Restablecido');
    };

    const getBearerIcon = (b: string) => {
        switch (b) {
            case "WIFI_DIRECT": return "📶";
            case "BLE": return "🔷";
            case "LORA_RF": return "📻";
            case "SOUNDMESH": return "🔊";
            case "LIFI_OPTICAL": return "⚡";
            case "SATELLITE_LEO": return "🛰️";
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
            case "SATELLITE_LEO": return "var(--accent-cyan, #00E5FF)";
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
            maxWidth: "560px",
            width: "100%",
            maxHeight: "88vh",
            overflowY: "auto"
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: "40px", height: "40px", borderRadius: "10px",
                        background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem"
                    }}>
                        🛰️
                    </div>
                    <div>
                        <div style={{ fontSize: "0.90rem", fontWeight: 900, color: "#00E5FF", letterSpacing: "0.5px" }}>
                            {t('swarm_health_hud.title')}
                        </div>
                        <div style={{ fontSize: "0.66rem", color: "var(--text-secondary, #94A3B8)" }}>
                            {t('swarm_health_hud.subtitle')}
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
                        {telemetry.connectedPeersCount > 0 ? `🟢 ${telemetry.connectedPeersCount} ` + (t('swarm_health_hud.nodes_count', { count: telemetry.connectedPeersCount }) || 'NODOS') : `🟡 ` + (t('swarm_health_hud.standalone') || 'STANDALONE')}
                    </span>
                    {onClose && (
                        <button
                            onClick={() => {
                                TacticalAudioEngine.playTap();
                                onClose();
                            }}
                            style={{
                                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#FFFFFF",
                                width: "30px", height: "30px", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem",
                                fontWeight: 900
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Banner de Modo de Gobernanza QoS (Automático vs Manual) */}
            <div style={{
                background: telemetry.isManualOverride
                    ? "linear-gradient(135deg, rgba(255, 171, 0, 0.15) 0%, rgba(20, 15, 5, 0.5) 100%)"
                    : "linear-gradient(135deg, rgba(0, 230, 118, 0.12) 0%, rgba(5, 25, 15, 0.5) 100%)",
                border: `1px solid ${telemetry.isManualOverride ? "rgba(255, 171, 0, 0.4)" : "rgba(0, 230, 118, 0.35)"}`,
                borderRadius: "12px", padding: "10px 12px",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px"
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{
                        fontSize: "0.74rem", fontWeight: 900,
                        color: telemetry.isManualOverride ? "#FFB300" : "#00E676",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}>
                        <span>{telemetry.isManualOverride ? "⚠️" : "🛡️"}</span>
                        {telemetry.isManualOverride
                            ? (t('swarm_health_hud.manual_mode_forced', { bearer: telemetry.primaryBearer }) || `MODO MANUAL: FORZADO EN ${telemetry.primaryBearer}`)
                            : t('swarm_health_hud.auto_governor')}
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "#94A3B8", marginTop: "2px", lineHeight: "1.3" }}>
                        {telemetry.isManualOverride
                            ? (t('swarm_health_hud.manual_mode_desc') || 'Has fijado este canal manualmente.')
                            : (t('swarm_health_hud.auto_mode_desc') || 'RED evalúa continuamente la señal...')}
                    </div>
                </div>

                {telemetry.isManualOverride && (
                    <button
                        type="button"
                        onClick={handleResumeAutoMode}
                        style={{
                            padding: "6px 10px", borderRadius: "8px", fontSize: "0.68rem", fontWeight: 900,
                            background: "rgba(0, 230, 118, 0.2)", border: "1px solid #00E676",
                            color: "#00E676", cursor: "pointer", whiteSpace: "nowrap"
                        }}
                    >
                        🔄 Auto QoS
                    </button>
                )}
            </div>

            {/* RF Spectrum & Hardware Monitor */}
            <div style={{
                background: "rgba(0, 0, 0, 0.55)", borderRadius: "14px", padding: "10px 12px",
                border: "1px solid rgba(0, 229, 255, 0.2)", display: "flex", flexDirection: "column", gap: "6px"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#00E5FF", animation: "pulse 1.5s infinite", display: "inline-block" }} />
                        <span style={{ fontSize: "0.72rem", color: "#38BDF8", fontWeight: 900 }}>
                            {t('swarm_health_hud.rf_hopping')}
                        </span>
                    </div>
                    <span style={{ fontSize: "0.62rem", color: "#AAA", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px" }}>
                        RTT: {telemetry.lastPingMs || 10} ms · {telemetry.totalFailoversExecuted} saltos
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0, 229, 255, 0.04)", padding: "6px 10px", borderRadius: "8px" }}>
                    <div>
                        <div style={{ fontSize: "0.78rem", fontWeight: 900, color: "#00E676" }}>
                            {currentHop.rfBandLabel}
                        </div>
                        <div style={{ fontSize: "0.62rem", color: "#94A3B8" }}>
                            {currentHop.operatingMode}
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.74rem", fontWeight: 900, color: currentHop.hasHardwareTransceiver ? "#00E676" : "#94A3B8" }}>
                            {currentHop.hasHardwareTransceiver ? (t('swarm_health_hud.connected') || 'CONECTADO') : (t('swarm_health_hud.no_ext_transceiver') || 'SIN TRANSCEPTOR EXT.')}
                        </div>
                        <div style={{ fontSize: "0.58rem", color: "#64748B" }}>
                            {currentHop.hasHardwareTransceiver ? (t('swarm_health_hud.lora_active') || 'LoRa SX1262 Activo') : (t('swarm_health_hud.operating_wifi_ble') || 'Operando Wi-Fi / BLE')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Matriz de Portadores (Conexiones) con Guía Interactiva */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", color: "#AAA", fontWeight: 800 }}>
                    <span>{t('swarm_health_hud.available_connections', { count: telemetry.bearers.length }) || `CONEXIONES DISPONIBLES (${telemetry.bearers.length} CAPAS)`}</span>
                    <span style={{ color: 'var(--accent-cyan)', fontSize: '0.62rem' }}>{t('swarm_health_hud.tap_for_details') || 'TOCA PARA DETALLES & ACCIONES'}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {telemetry.bearers.map(b => {
                        const isPrimary = telemetry.primaryBearer === b.bearer;
                        const isExpanded = expandedBearer === b.bearer;
                        const info = bearerInfoMap[b.bearer];

                        return (
                            <div
                                key={b.bearer}
                                style={{
                                    borderRadius: "12px",
                                    background: isPrimary
                                        ? "linear-gradient(135deg, rgba(0, 229, 255, 0.16) 0%, rgba(10, 25, 45, 0.7) 100%)"
                                        : "rgba(255, 255, 255, 0.03)",
                                    border: `1.5px solid ${isPrimary ? "#00E5FF" : b.isOnline ? "rgba(0, 229, 255, 0.25)" : "rgba(255, 255, 255, 0.06)"}`,
                                    boxShadow: isPrimary ? "0 0 12px rgba(0, 229, 255, 0.18)" : "none",
                                    overflow: "hidden",
                                    transition: "all 0.15s ease"
                                }}
                            >
                                {/* Barra Principal del Portador */}
                                <div
                                    onClick={() => {
                                        TacticalAudioEngine.playTap();
                                        setExpandedBearer(prev => prev === b.bearer ? null : b.bearer);
                                    }}
                                    style={{
                                        padding: "10px 12px",
                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                        cursor: "pointer", userSelect: "none"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <span style={{ fontSize: "1.2rem", width: "24px", textAlign: "center" }}>
                                            {getBearerIcon(b.bearer)}
                                        </span>
                                        <div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                <span style={{ fontSize: "0.80rem", fontWeight: 900, color: isPrimary ? "#00E5FF" : b.isOnline ? "#FFFFFF" : "var(--text-muted)" }}>
                                                    {(t as any)(`swarm_health_hud.bearer_${b.bearer.toLowerCase()}`) || info?.name || b.bearer}
                                                </span>
                                                {isPrimary && (
                                                    <span style={{ fontSize: "0.58rem", color: "#00E5FF", background: "rgba(0, 229, 255, 0.2)", padding: "1px 5px", borderRadius: "4px", fontWeight: 900 }}>
                                                        {t('swarm_health_hud.in_use') || 'EN USO'}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: "0.62rem", color: b.isOnline ? "#94A3B8" : "var(--text-muted)", marginTop: "1px" }}>
                                                {b.statusLabel} · {info?.category || "Enlace"}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <div>
                                            <div style={{
                                                fontSize: "0.70rem", fontWeight: 900,
                                                color: b.isOnline ? (isPrimary ? "#00E5FF" : "#00E676") : "var(--text-muted)"
                                            }}>
                                                {b.isOnline ? (b.throughputKbps > 0 ? `${b.throughputKbps} kbps` : (t('swarm_health_hud.online') || 'EN LÍNEA')) : (t('swarm_health_hud.standby') || 'STANDBY')}
                                            </div>
                                            <div style={{ fontSize: "0.58rem", color: "#64748B" }}>
                                                {b.isOnline ? (b.latencyMs > 0 ? `${b.latencyMs}ms RTT` : (t('swarm_health_hud.ready') || 'Listo')) : (t('swarm_health_hud.no_traffic') || 'Sin tráfico')}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: "0.75rem", color: isExpanded ? "#00E5FF" : "#64748B", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                                            ▼
                                        </span>
                                    </div>
                                </div>

                                {/* Despliegue Explicativo y Operativo al Expandir */}
                                {isExpanded && info && (
                                    <div style={{
                                        padding: "10px 14px 12px 14px",
                                        background: "rgba(0, 0, 0, 0.4)",
                                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                                        display: "flex", flexDirection: "column", gap: "8px",
                                        fontSize: "0.68rem"
                                    }}>
                                        <div>
                                            <span style={{ color: '#00E5FF', fontWeight: 800 }}>{t('swarm_health_hud.what_is_it') || '📖 ¿Qué es y para qué sirve?'}</span>
                                            <div style={{ color: "#CBD5E1", marginTop: "2px", lineHeight: "1.35" }}>
                                                {info.summary}
                                            </div>
                                        </div>

                                        <div>
                                            <span style={{ color: '#00E676', fontWeight: 800 }}>{t('swarm_health_hud.how_to_use') || '💡 ¿Cómo se usa en este dispositivo?'}</span>
                                            <div style={{ color: "#CBD5E1", marginTop: "2px", lineHeight: "1.35" }}>
                                                {info.howToUse}
                                            </div>
                                        </div>

                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", background: "rgba(255,255,255,0.03)", padding: "6px 8px", borderRadius: "6px" }}>
                                            <div>
                                                <span style={{ color: '#94A3B8', fontSize: '0.60rem' }}>{t('swarm_health_hud.est_range') || 'ALCANCE ESTIMADO:'}</span>
                                                <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.65rem" }}>{info.maxRange}</div>
                                            </div>
                                            <div>
                                                <span style={{ color: '#94A3B8', fontSize: '0.60rem' }}>{t('swarm_health_hud.hw_status') || 'ESTADO DE HARDWARE:'}</span>
                                                <div style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.65rem" }}>
                                                    {info.hardwareDetails(currentHop.hasHardwareTransceiver)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Botones de Acción Táctica */}
                                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleForceBearer(b.bearer);
                                                }}
                                                disabled={isPrimary}
                                                style={{
                                                    flex: 1, padding: "7px 10px", borderRadius: "8px",
                                                    background: isPrimary ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(2, 132, 199, 0.4) 100%)",
                                                    border: `1px solid ${isPrimary ? "rgba(255,255,255,0.1)" : "#00E5FF"}`,
                                                    color: isPrimary ? "#64748B" : "#FFFFFF",
                                                    fontWeight: 800, fontSize: "0.66rem", cursor: isPrimary ? "default" : "pointer"
                                                }}
                                            >
                                                {isPrimary ? (t('swarm_health_hud.active_bearer') || '✅ Portador Activo') : (t('swarm_health_hud.force_bearer') || '⚡ Forzar este Portador')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    TacticalAudioEngine.playTap();
                                                    navigate(info.actionScreen);
                                                    onClose?.();
                                                }}
                                                style={{
                                                    flex: 1, padding: "7px 10px", borderRadius: "8px",
                                                    background: "rgba(255, 255, 255, 0.08)",
                                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                                    color: "#38BDF8", fontWeight: 800, fontSize: "0.66rem", cursor: "pointer"
                                                }}
                                            >
                                                {info.actionLabel}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Búfer DTN Store & Forward */}
            <div style={{
                background: "rgba(0, 0, 0, 0.45)", borderRadius: "14px", padding: "10px 14px",
                border: "1px solid rgba(0, 229, 255, 0.2)", display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.1rem" }}>📦</span>
                    <div>
                        <div style={{ fontSize: "0.74rem", fontWeight: 900, color: "#FFFFFF" }}>
                            {t('swarm_health_hud.dtn_buffer')}
                        </div>
                        <div style={{ fontSize: "0.60rem", color: "#94A3B8" }}>
                            PBKDF2-SHA256 (310k) · {t('swarm_health_hud.dtn_waiting', { count: dtnCount }) || `${dtnCount} en espera`}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={async () => {
                        TacticalAudioEngine.playTap();
                        await meshRouter.flushPendingQueue();
                        setDtnCount(dtnStorage.count);
                        TacticalAudioEngine.playRogerBeep();
                        toast.success(t('swarm_health_hud.dtn_flushed', { count: dtnStorage.count }) || `⚡ Búfer DTN transmitido (${dtnStorage.count} en cola)`);
                    }}
                    style={{
                        padding: "6px 12px", borderRadius: "8px", fontSize: "0.68rem", fontWeight: 900,
                        background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                        color: "#00E5FF", cursor: "pointer"
                    }}
                >
                    ⚡ {t('swarm_health_hud.forced_carrier')}
                </button>
            </div>
        </div>
    );
}

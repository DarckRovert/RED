"use client";

import React, { useState, useEffect, useRef } from "react";
import { cbrnRadiation, RadiationTelemetry, CbrnSimulationScenario } from "../lib/sensors/CbrnRadiationEngine";
import { satelliteMeshGateway, SatelliteGatewayTelemetry, SatellitePass, SatelliteRelayMode } from "../lib/mesh/SatelliteMeshGatewayEngine";
import { cbrnPlumeDispersionEngine, PlumeHazardZone, CbrnIncidentSource } from "../lib/tactical/CbrnPlumeDispersionEngine";
import { TacticalLocationEngine } from "../lib/sensors/TacticalLocationEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function CbrnSatelliteModal() {
    const { navigate, identity, goBack } = useRedStore();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<"cbrn" | "plume" | "satellite">("cbrn");
    const [cbrn, setCbrn] = useState<RadiationTelemetry>(() => cbrnRadiation.getTelemetry());
    const [sat, setSat] = useState<SatelliteGatewayTelemetry>(() => satelliteMeshGateway.getTelemetry());

    // Estado Interactivo de la Pluma Atmosférica
    const [incidentSource, setIncidentSource] = useState<CbrnIncidentSource>({
        id: `INCIDENT-${Date.now()}`,
        lat: -12.0464,
        lon: -77.0428,
        hazardType: "RADIOACTIVE_FALLOUT",
        releaseRateKgSec: 15,
        windSpeedKmh: 18,
        windDirectionDegrees: 45,
        stabilityClass: "D",
        timestamp: Date.now()
    });

    const [operatorPos, setOperatorPos] = useState<{ lat: number; lon: number }>({
        lat: -12.0440,
        lon: -77.0400
    });

    const [plumeZone, setPlumeZone] = useState<PlumeHazardZone>(() =>
        cbrnPlumeDispersionEngine.calculatePlumeDispersion(incidentSource, operatorPos.lat, operatorPos.lon)
    );

    // Compositor Satelital SBD y Repetidor Orbital
    const [satMessageText, setSatMessageText] = useState<string>("ALERTA CBRN: EVACUACION ACTIVA. SOLICITO ENLACE MEDICO.");
    const [satelliteRelayMode, setSatelliteRelayMode] = useState<SatelliteRelayMode>("BENT_PIPE");
    const [targetMeshId, setTargetMeshId] = useState<string>("MESH-GLOBAL-ALL");

    useEffect(() => {
        cbrnRadiation.startMonitoring();
        const unsubCbrn = cbrnRadiation.subscribe(setCbrn);
        const unsubSat = satelliteMeshGateway.subscribe(setSat);

        // Ubicación GPS síncrona en tiempo real con cleanup garantizado
        const unsubGps = TacticalLocationEngine.watchLocation((loc) => {
            if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                const lat = loc.lat!;
                const lon = loc.lon!;
                satelliteMeshGateway.setObserverLocation(lat, lon);
                setOperatorPos({ lat, lon });

                // Si el incidente tiene las coordenadas por defecto (-12.0464), adaptarlo dinámicamente
                // a 400m hacia barlovento (contra el viento) de la posición real del operador
                setIncidentSource(prev => {
                    if (Math.abs(prev.lat - (-12.0464)) < 0.0001 && Math.abs(prev.lon - (-77.0428)) < 0.0001) {
                        const upwindBearing = (prev.windDirectionDegrees + 180) % 360;
                        const R = 6371000;
                        const d = 400 / R;
                        const brng = upwindBearing * (Math.PI / 180);
                        const lat1 = lat * (Math.PI / 180);
                        const lon1 = lon * (Math.PI / 180);
                        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
                        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
                        return {
                            ...prev,
                            lat: lat2 * (180 / Math.PI),
                            lon: lon2 * (180 / Math.PI)
                        };
                    }
                    return prev;
                });
            }
        });

        return () => {
            if (unsubGps) unsubGps();
            unsubCbrn();
            unsubSat();
            cbrnRadiation.stopCmosCameraCapture();
            cbrnRadiation.stopMonitoring();
        };
    }, []);

    // Recalcular pluma cuando cambian parámetros del incidente o posición
    useEffect(() => {
        const calculated = cbrnPlumeDispersionEngine.calculatePlumeDispersion(
            incidentSource,
            operatorPos.lat,
            operatorPos.lon
        );
        setPlumeZone(calculated);
    }, [incidentSource, operatorPos]);

    // Handlers para Cámara CMOS
    const handleToggleCmosCamera = async () => {
        if (cbrn.isCameraCmosActive) {
            cbrnRadiation.stopCmosCameraCapture();
            toast.info("Sensor fotónico CMOS apagado");
        } else {
            toast.info("Iniciando cámara CMOS... Cubra el lente para medir radiación");
            const success = await cbrnRadiation.startCmosCameraCapture();
            if (success) {
                toast.success("📷 Sensor CMOS activo. Cubra el lente contra una mesa o con cinta negra");
            } else {
                toast.error("No se pudo acceder a la cámara trasera. Verifique permisos");
            }
        }
    };

    const handleSelectSimulationScenario = (sc: CbrnSimulationScenario) => {
        cbrnRadiation.setSimulationScenario(sc);
        if (sc === 'NONE') {
            toast.info("Simulación desactivada. Modo sensor real restaurado");
        } else {
            toast.warning(`Escenario táctico aplicado: ${sc}`);
        }
    };

    // Handlers para Satélite
    const handleEnqueueSbdMessage = () => {
        if (!satMessageText.trim()) return;
        const res = satelliteMeshGateway.composeAndEnqueueSbd(satMessageText, 9);
        toast.success(`🛰️ Paquete SBD encolado: ${res.id}`);
    };

    const handleEnqueueRelayMessage = () => {
        if (!satMessageText.trim()) return;
        const res = satelliteMeshGateway.composeAndEnqueueRelay(
            satMessageText,
            targetMeshId,
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
            satelliteRelayMode,
            9
        );
        toast.success(`🛰️ Retransmisión [${satelliteRelayMode}] encolada para ${targetMeshId}: ${res.relayId}`);
    };

    const handleTriggerSatBurst = () => {
        const success = satelliteMeshGateway.triggerSatelliteBurst();
        if (success) {
            toast.success("🛰️ Ráfaga SBD transmitida con éxito a la constelación LEO");
        } else {
            toast.error("Sin satélites en rango cenital (Elevación < 25°)");
        }
    };

    // Color temático de amenaza radiológica
    const getThreatColor = (level: string) => {
        switch (level) {
            case "LETHAL": return "#FF3355";
            case "HAZARDOUS": return "#FF8008";
            case "ELEVATED": return "#FFB300";
            default: return "#00E676";
        }
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header Táctico C4ISR */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                borderBottom: "1.5px solid rgba(0, 229, 255, 0.35)",
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
                        background: "linear-gradient(135deg, rgba(255, 179, 0, 0.25) 0%, rgba(255, 51, 85, 0.15) 100%)",
                        border: "1px solid rgba(255, 179, 0, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(255, 179, 0, 0.25)"
                    }}>☢️</div>
                    <div>
                        <div style={{ fontSize: "0.96rem", fontWeight: 900, color: "#FFFFFF", display: "flex", alignItems: "center", gap: "6px" }}>
                            CBRN DEFENSE & SAT-LEO
                            <span style={{
                                fontSize: "0.58rem", fontWeight: 900, letterSpacing: "0.08em",
                                background: cbrn.isCameraCmosActive ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 179, 0, 0.2)",
                                color: cbrn.isCameraCmosActive ? "#00E676" : "#FFB300",
                                border: `1px solid ${cbrn.isCameraCmosActive ? '#00E676' : '#FFB300'}60`,
                                borderRadius: "4px", padding: "2px 6px"
                            }}>
                                {cbrn.isCameraCmosActive ? "CMOS ACTIVO" : "FÍSICO STANDBY"}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.66rem", color: "var(--text-secondary)" }}>
                            Dosimetría Nuclear CMOS · Pluma Atmosférica · Pasarela LEO
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 900, padding: "4px 8px", borderRadius: "6px",
                        background: sat.isUplinkAvailable ? "rgba(0, 229, 255, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        color: sat.isUplinkAvailable ? "#00E5FF" : "var(--text-secondary)",
                        border: `1px solid ${sat.isUplinkAvailable ? '#00E5FF' : 'rgba(255,255,255,0.1)'}60`
                    }}>
                        {sat.isUplinkAvailable ? `🛰️ AOS LEO (${sat.activePasses.filter(s => s.isInAos).length})` : "🛰️ BUSCANDO PASO"}
                    </span>
                </div>
            </header>

            {/* Selector de Pestañas Tácticas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("cbrn")}
                    style={{
                        flex: 1, padding: "8px 10px", borderRadius: "10px",
                        background: activeTab === "cbrn" ? "linear-gradient(135deg, rgba(255, 179, 0, 0.25) 0%, rgba(180, 120, 0, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "cbrn" ? "1.5px solid #FFB300" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "cbrn" ? "#FFB300" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.74rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                    }}
                >
                    <span>☢️</span> DOSIMETRÍA {cbrn.threatLevel !== "SAFE_BACKGROUND" && "⚠️"}
                </button>
                <button
                    onClick={() => setActiveTab("plume")}
                    style={{
                        flex: 1, padding: "8px 10px", borderRadius: "10px",
                        background: activeTab === "plume" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "plume" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "plume" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.74rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                    }}
                >
                    <span>☣️</span> PLUMA & ESCAPE
                </button>
                <button
                    onClick={() => setActiveTab("satellite")}
                    style={{
                        flex: 1, padding: "8px 10px", borderRadius: "10px",
                        background: activeTab === "satellite" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "satellite" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "satellite" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.74rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px"
                    }}
                >
                    <span>🛰️</span> RADAR LEO ({sat.activePasses.filter(s => s.isInAos).length})
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* ════════════════════════════════════════════════════════════════
                        TAB 1: DOSIMETRÍA NUCLEAR & SENSOR CMOS REAL
                    ════════════════════════════════════════════════════════════════ */}
                    {activeTab === "cbrn" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            
                            {/* Panel Maestro de Tasa de Dosis */}
                            <div style={{
                                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                                border: `1.5px solid ${getThreatColor(cbrn.threatLevel)}`,
                                borderRadius: "20px", padding: "20px",
                                display: "flex", flexDirection: "column", gap: "12px",
                                boxShadow: `0 8px 32px ${getThreatColor(cbrn.threatLevel)}25`
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 900 }}>
                                        TASA DE RADIACIÓN IONIZANTE (H*10)
                                    </div>
                                    <span style={{
                                        fontSize: "0.66rem", fontWeight: 900, padding: "3px 9px", borderRadius: "6px",
                                        background: `${getThreatColor(cbrn.threatLevel)}25`,
                                        color: getThreatColor(cbrn.threatLevel),
                                        border: `1px solid ${getThreatColor(cbrn.threatLevel)}`
                                    }}>
                                        {cbrn.threatLevel}
                                    </span>
                                </div>

                                <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                                    <span style={{ fontSize: "3.2rem", fontWeight: 900, color: "#FFFFFF", lineHeight: 1 }}>
                                        {cbrn.doseRateUsVh.toFixed(2)}
                                    </span>
                                    <span style={{ fontSize: "1.15rem", color: "#FFB300", fontWeight: 900 }}>
                                        µSv/h
                                    </span>
                                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginLeft: "auto", fontWeight: 800 }}>
                                        {cbrn.countsPerMinuteCpm} CPM
                                    </span>
                                </div>

                                {/* Barra de Tasa Segmentada */}
                                <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "4px", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${Math.min(100, (cbrn.doseRateUsVh / 50) * 100)}%`,
                                        height: "100%",
                                        background: `linear-gradient(90deg, #00E676 0%, #FFB300 50%, #FF3355 100%)`,
                                        transition: "width 0.4s ease"
                                    }} />
                                </div>

                                <div style={{ fontSize: "0.74rem", color: "#DDD", lineHeight: 1.4 }}>
                                    {cbrn.arsRiskDescription}
                                </div>
                            </div>

                            {/* Sensor de Cámara CMOS Hardware */}
                            <div style={{
                                background: "rgba(10, 15, 30, 0.9)",
                                border: "1.5px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "18px", padding: "16px",
                                display: "flex", flexDirection: "column", gap: "12px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div>
                                        <div style={{ fontSize: "0.86rem", fontWeight: 900, color: "#00E5FF" }}>
                                            DETECTOR RADIOLÓGICO CMOS (CÁMARA)
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                                            Detección de pares electrón-hueco en matriz de silicio con lente cubierto
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleToggleCmosCamera}
                                        style={{
                                            padding: "8px 14px", borderRadius: "10px",
                                            background: cbrn.isCameraCmosActive ? "rgba(255, 51, 85, 0.2)" : "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                            color: cbrn.isCameraCmosActive ? "#FF3355" : "#000000",
                                            fontWeight: 900, fontSize: "0.76rem", border: cbrn.isCameraCmosActive ? "1px solid #FF3355" : "none",
                                            cursor: "pointer"
                                        }}
                                    >
                                        {cbrn.isCameraCmosActive ? "⏹️ DETENER" : "📷 ACTIVAR CÁMARA"}
                                    </button>
                                </div>

                                {cbrn.isCameraCmosActive && (
                                    <div style={{
                                        padding: "12px", borderRadius: "12px",
                                        background: cbrn.isLensCovered ? "rgba(0, 230, 118, 0.12)" : "rgba(255, 179, 0, 0.12)",
                                        border: `1px solid ${cbrn.isLensCovered ? '#00E676' : '#FFB300'}`,
                                        display: "flex", alignItems: "center", gap: "10px"
                                    }}>
                                        <span style={{ fontSize: "1.4rem" }}>{cbrn.isLensCovered ? "🟢" : "⚠️"}</span>
                                        <div style={{ fontSize: "0.72rem", color: "#FFFFFF", lineHeight: 1.4 }}>
                                            {cbrn.isLensCovered ? (
                                                <>
                                                    <strong style={{ color: "#00E676" }}>Lente Cubierto:</strong> Escaneando fotones gamma en matriz de silicio ({cbrn.hotPixelHitsLastFrame} hits/frame).
                                                </>
                                            ) : (
                                                <>
                                                    <strong style={{ color: "#FFB300" }}>Luz Ambiente Detectada (Lum: {cbrn.averageLuminance}):</strong> Cubra el lente de la cámara trasera contra una mesa o con cinta negra opaca para aislar impactos radiactivos.
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dosis Acumulada & T_stay */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div style={{
                                    background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                    borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "4px"
                                }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 800 }}>DOSIS BIOLÓGICA ACUMULADA</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E5FF" }}>
                                        {cbrn.cumulativeDoseMsv.toFixed(4)} mSv
                                    </div>
                                    <div style={{ fontSize: "0.64rem", color: "var(--text-secondary)" }}>
                                        Límite rescate: 50 mSv ({((cbrn.cumulativeDoseMsv / 50) * 100).toFixed(1)}%)
                                    </div>
                                    <button
                                        onClick={() => cbrnRadiation.resetCumulativeDose()}
                                        style={{
                                            marginTop: "6px", padding: "5px 8px", borderRadius: "6px",
                                            background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.15)",
                                            color: "#AAA", fontSize: "0.62rem", cursor: "pointer", fontWeight: 700
                                        }}
                                    >
                                        ↺ Reiniciar Dosis
                                    </button>
                                </div>

                                <div style={{
                                    background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                    borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "4px"
                                }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 800 }}>TIEMPO SEGURO (T_stay)</div>
                                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#00E676" }}>
                                        {cbrn.safeStayTimeMinutes > 9999 ? "∞" : `${cbrn.safeStayTimeMinutes} min`}
                                    </div>
                                    <div style={{ fontSize: "0.64rem", color: "var(--text-secondary)" }}>
                                        Permanencia hasta umbral ARS de 50 mSv
                                    </div>
                                </div>
                            </div>

                            {/* Simulador Táctico de Escenarios para Ejercicios */}
                            <div style={{
                                background: "rgba(255, 179, 0, 0.06)", border: "1px solid rgba(255, 179, 0, 0.25)",
                                borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ fontSize: "0.72rem", color: "#FFB300", fontWeight: 900 }}>
                                    SIMULADOR TÁCTICO DE DRILLS CBRN
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px" }}>
                                    <button
                                        onClick={() => handleSelectSimulationScenario('NONE')}
                                        style={{
                                            padding: "8px 4px", borderRadius: "8px", fontSize: "0.65rem", fontWeight: 800,
                                            background: cbrn.activeSimulationScenario === 'NONE' ? "#FFB300" : "rgba(255,255,255,0.04)",
                                            color: cbrn.activeSimulationScenario === 'NONE' ? "#000" : "#AAA",
                                            border: "none", cursor: "pointer"
                                        }}
                                    >
                                        REAL
                                    </button>
                                    <button
                                        onClick={() => handleSelectSimulationScenario('ELEVATED')}
                                        style={{
                                            padding: "8px 4px", borderRadius: "8px", fontSize: "0.65rem", fontWeight: 800,
                                            background: cbrn.activeSimulationScenario === 'ELEVATED' ? "#FFB300" : "rgba(255,255,255,0.04)",
                                            color: cbrn.activeSimulationScenario === 'ELEVATED' ? "#000" : "#AAA",
                                            border: "none", cursor: "pointer"
                                        }}
                                    >
                                        4.8 µSv
                                    </button>
                                    <button
                                        onClick={() => handleSelectSimulationScenario('HOT_ZONE')}
                                        style={{
                                            padding: "8px 4px", borderRadius: "8px", fontSize: "0.65rem", fontWeight: 800,
                                            background: cbrn.activeSimulationScenario === 'HOT_ZONE' ? "#FF8008" : "rgba(255,255,255,0.04)",
                                            color: cbrn.activeSimulationScenario === 'HOT_ZONE' ? "#FFF" : "#AAA",
                                            border: "none", cursor: "pointer"
                                        }}
                                    >
                                        85 µSv
                                    </button>
                                    <button
                                        onClick={() => handleSelectSimulationScenario('LETHAL')}
                                        style={{
                                            padding: "8px 4px", borderRadius: "8px", fontSize: "0.65rem", fontWeight: 800,
                                            background: cbrn.activeSimulationScenario === 'LETHAL' ? "#FF3355" : "rgba(255,255,255,0.04)",
                                            color: cbrn.activeSimulationScenario === 'LETHAL' ? "#FFF" : "#AAA",
                                            border: "none", cursor: "pointer"
                                        }}
                                    >
                                        1.4 mSv
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════════════
                        TAB 2: PLUMA GAUSSIANA & VECTOR DE ESCAPE 90°
                    ════════════════════════════════════════════════════════════════ */}
                    {activeTab === "plume" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            
                            {/* HUD Maestro de Vector de Escape */}
                            <div style={{
                                padding: "18px", borderRadius: "18px",
                                background: plumeZone.escapeVector.isInDangerZone ? "rgba(255, 51, 85, 0.22)" : "rgba(0, 230, 118, 0.15)",
                                border: `1.5px solid ${plumeZone.escapeVector.isInDangerZone ? "#FF3355" : "#00E676"}`,
                                display: "flex", alignItems: "center", justifyContent: "space-between"
                            }}>
                                <div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 800 }}>ESTADO EN CONO DE PLUMA</div>
                                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: plumeZone.escapeVector.isInDangerZone ? "#FF3355" : "#00E676" }}>
                                        {plumeZone.escapeVector.currentDangerLevel}
                                    </div>
                                    <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "#FFB300", marginTop: "2px" }}>
                                        Agente: {incidentSource.hazardType}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: "0.70rem", color: "var(--text-secondary)", fontWeight: 800 }}>RUMBO ÓPTIMO DE ESCAPE</div>
                                    <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#00E5FF", lineHeight: 1.1 }}>
                                        {plumeZone.escapeVector.recommendedAzimuthDegrees}°
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                                        {plumeZone.escapeVector.distanceToSafetyMeters}m a zona fría ({plumeZone.escapeVector.estimatedWalkTimeMinutes} min)
                                    </div>
                                </div>
                            </div>

                            {/* Radar SVG Táctico de Dispersión Atmosférica */}
                            <div style={{
                                background: "rgba(10, 15, 30, 0.95)",
                                border: "1.5px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "18px", padding: "16px",
                                display: "flex", flexDirection: "column", alignItems: "center", gap: "10px"
                            }}>
                                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.74rem", color: "#00E5FF", fontWeight: 900 }}>
                                        RADAR DE CONO DE DISPERSIÓN SOTAVENTO
                                    </span>
                                    <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)" }}>
                                        Viento: {incidentSource.windSpeedKmh} km/h @ {incidentSource.windDirectionDegrees}°
                                    </span>
                                </div>

                                <svg width="240" height="240" viewBox="-120 -120 240 240" style={{ overflow: "visible" }}>
                                    {/* Círculos de distancia */}
                                    <circle cx="0" cy="0" r="100" fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                                    <circle cx="0" cy="0" r="60" fill="none" stroke="rgba(255,255,255,0.12)" />
                                    <circle cx="0" cy="0" r="25" fill="none" stroke="rgba(255,255,255,0.15)" />

                                    {/* Ejes Cardinales */}
                                    <line x1="0" y1="-110" x2="0" y2="110" stroke="rgba(255,255,255,0.1)" />
                                    <line x1="-110" y1="0" x2="110" y2="0" stroke="rgba(255,255,255,0.1)" />
                                    <text x="0" y="-112" fill="#AAA" fontSize="9" textAnchor="middle" fontWeight="bold">N</text>
                                    <text x="114" y="3" fill="#AAA" fontSize="9" textAnchor="start" fontWeight="bold">E</text>
                                    <text x="0" y="120" fill="#AAA" fontSize="9" textAnchor="middle" fontWeight="bold">S</text>
                                    <text x="-114" y="3" fill="#AAA" fontSize="9" textAnchor="end" fontWeight="bold">O</text>

                                    {/* Cono de la Pluma Tóxica a Sotavento */}
                                    {(() => {
                                        const windRad = (incidentSource.windDirectionDegrees - 90) * (Math.PI / 180);
                                        const coneSpreadRad = 35 * (Math.PI / 180);
                                        const coneLength = 95;
                                        const x1 = coneLength * Math.cos(windRad - coneSpreadRad);
                                        const y1 = coneLength * Math.sin(windRad - coneSpreadRad);
                                        const x2 = coneLength * Math.cos(windRad + coneSpreadRad);
                                        const y2 = coneLength * Math.sin(windRad + coneSpreadRad);
                                        return (
                                            <polygon
                                                points={`0,0 ${x1},${y1} ${x2},${y2}`}
                                                fill="rgba(255, 128, 8, 0.28)"
                                                stroke="#FF8008"
                                                strokeWidth="1.5"
                                            />
                                        );
                                    })()}

                                    {/* Zona Caliente Inmediata (Centro Foco) */}
                                    <circle cx="0" cy="0" r="22" fill="rgba(255, 51, 85, 0.5)" stroke="#FF3355" strokeWidth="2" />
                                    <text x="0" y="3" fill="#FFF" fontSize="10" textAnchor="middle">☢️</text>

                                    {/* Flecha Vector de Escape Óptimo (90° Perpendicular) */}
                                    {(() => {
                                        const escRad = (plumeZone.escapeVector.recommendedAzimuthDegrees - 90) * (Math.PI / 180);
                                        const escX = 75 * Math.cos(escRad);
                                        const escY = 75 * Math.sin(escRad);
                                        return (
                                            <g>
                                                <line x1="0" y1="0" x2={escX} y2={escY} stroke="#00E676" strokeWidth="3" markerEnd="url(#arrow)" />
                                                <circle cx={escX} cy={escY} r="5" fill="#00E676" />
                                            </g>
                                        );
                                    })()}
                                </svg>

                                <div style={{ fontSize: "0.68rem", color: "#AAA", textAlign: "center" }}>
                                    <span style={{ color: "#FF3355" }}>● Foco</span> · <span style={{ color: "#FF8008" }}>▲ Cono Pluma</span> · <span style={{ color: "#00E676" }}>➜ Vector Escape (90° Crosswind)</span>
                                </div>
                            </div>

                            {/* Configuración Táctica del Incidente */}
                            <div style={{
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px"
                            }}>
                                <div style={{ fontSize: "0.76rem", color: "#FFB300", fontWeight: 900 }}>
                                    PARÁMETROS DEL INCIDENTE CBRN
                                </div>

                                <div>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                                        AGENTE AMENAZA:
                                    </label>
                                    <select
                                        value={incidentSource.hazardType}
                                        onChange={(e: any) => setIncidentSource(prev => ({ ...prev, hazardType: e.target.value }))}
                                        style={{
                                            width: "100%", padding: "10px", background: "rgba(0,0,0,0.5)",
                                            border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
                                            color: "#FFF", fontSize: "0.80rem", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    >
                                        <option value="RADIOACTIVE_FALLOUT">☢️ Fallout Radiactivo (Cesio-137 / Yodo-131)</option>
                                        <option value="CHLORINE_GAS">🧪 Gas Cloro Industrial (Cl₂)</option>
                                        <option value="AMMONIA_TOXIC">🏭 Amoníaco Anhidro Tóxico (NH₃)</option>
                                        <option value="SARIN_ORGANOPHOSPHATE">☠️ Gas Nervioso Sarín (GB)</option>
                                        <option value="INDUSTRIAL_SMOKE">🌫️ Humo Químico Asfixiante</option>
                                    </select>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <div>
                                        <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                                            DIRECCIÓN VIENTO: {incidentSource.windDirectionDegrees}°
                                        </label>
                                        <input
                                            type="range" min="0" max="359"
                                            value={incidentSource.windDirectionDegrees}
                                            onChange={(e) => setIncidentSource(prev => ({ ...prev, windDirectionDegrees: parseInt(e.target.value, 10) }))}
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                                            VELOCIDAD VIENTO: {incidentSource.windSpeedKmh} km/h
                                        </label>
                                        <input
                                            type="range" min="2" max="60"
                                            value={incidentSource.windSpeedKmh}
                                            onChange={(e) => setIncidentSource(prev => ({ ...prev, windSpeedKmh: parseInt(e.target.value, 10) }))}
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                </div>

                                {/* Ajuste Geográfico Real del Foco respecto al GPS */}
                                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                    <button
                                        onClick={() => {
                                            const upwindBearing = (incidentSource.windDirectionDegrees + 180) % 360;
                                            const R = 6371000;
                                            const d = 400 / R;
                                            const brng = upwindBearing * (Math.PI / 180);
                                            const lat1 = operatorPos.lat * (Math.PI / 180);
                                            const lon1 = operatorPos.lon * (Math.PI / 180);
                                            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
                                            const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
                                            setIncidentSource(prev => ({
                                                ...prev,
                                                lat: lat2 * (180 / Math.PI),
                                                lon: lon2 * (180 / Math.PI)
                                            }));
                                            toast.success("📍 Foco fijado a 400m barlovento de tu posición GPS");
                                        }}
                                        style={{
                                            flex: 1, padding: "8px", borderRadius: "8px",
                                            background: "rgba(0, 229, 255, 0.12)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                            color: "#00E5FF", fontSize: "0.68rem", fontWeight: 800, cursor: "pointer"
                                        }}
                                    >
                                        📍 400M BARLOVENTO (GPS)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIncidentSource(prev => ({
                                                ...prev,
                                                lat: operatorPos.lat,
                                                lon: operatorPos.lon
                                            }));
                                            toast.warning("🎯 Foco posicionado en tu ubicación GPS actual");
                                        }}
                                        style={{
                                            flex: 1, padding: "8px", borderRadius: "8px",
                                            background: "rgba(255, 51, 85, 0.12)", border: "1px solid rgba(255, 51, 85, 0.3)",
                                            color: "#FF3355", fontSize: "0.68rem", fontWeight: 800, cursor: "pointer"
                                        }}
                                    >
                                        🎯 EN MI POSICIÓN (GPS)
                                    </button>
                                </div>
                                <div style={{ fontSize: "0.64rem", color: "var(--text-secondary)", textAlign: "center" }}>
                                    Foco: {incidentSource.lat.toFixed(5)}, {incidentSource.lon.toFixed(5)} · Operador: {operatorPos.lat.toFixed(5)}, {operatorPos.lon.toFixed(5)}
                                </div>
                            </div>

                            {/* Botón Transmisión SOS a la Malla */}
                            <button
                                onClick={async () => {
                                    const { meshSosBeacon } = await import("../lib/emergency/MeshSosBeaconEngine");
                                    const callerId = identity?.identity_hash ? `did:red:${identity.identity_hash.slice(0, 8)}` : "CBRN_UNIT";
                                    const callerName = identity?.nickname || "Oficial CBRN";
                                    await meshSosBeacon.activateSosBeacon({
                                        distressType: "NATURAL_DISASTER",
                                        triageColor: "RED",
                                        note: `EVACUACION CBRN [${incidentSource.hazardType}]: Escape por rumbo ${plumeZone.escapeVector.recommendedAzimuthDegrees}°. Salir a 90° del viento (${incidentSource.windDirectionDegrees}°). Zona caliente: ${plumeZone.hotZoneRadiusMeters}m.`,
                                        batteryLevel: 90
                                    }, callerId, callerName);
                                    toast.success("🚨 Vector de escape y orden de evacuación transmitidos a la malla");
                                }}
                                style={{
                                    padding: "14px", borderRadius: "12px",
                                    background: "linear-gradient(135deg, #FF3355, #D50000)",
                                    color: "#FFFFFF", fontWeight: 900, fontSize: "0.84rem", border: "none", cursor: "pointer",
                                    boxShadow: "0 8px 24px rgba(255, 51, 85, 0.4)"
                                }}
                            >
                                🚨 TRANSMITIR VECTOR DE ESCAPE A LA MALLA SOS
                            </button>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════════════
                        TAB 3: RADAR SATELITAL SKYVIEW LEO & UPLINK SBD
                    ════════════════════════════════════════════════════════════════ */}
                    {activeTab === "satellite" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            
                            {/* Banner de Estado de Enlace LEO & Repetidor */}
                            <div style={{
                                background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "16px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <div>
                                    <div style={{ fontSize: "0.84rem", fontWeight: 900, color: "#00E5FF" }}>
                                        {sat.isUplinkAvailable ? "🛰️ ENLACE CENITAL & REPETIDOR AOS ACTIVO" : "🛰️ BUSCANDO PASO ORBITAL"}
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        Huella: ~{sat.activeFootprintRadiusKm} km · {sat.totalRelaysUplinked} relays subidos · {sat.totalRelaysDownlinked} bajadas · {sat.queuedOutboundPackets} en cola
                                    </div>
                                </div>
                                <button
                                    onClick={handleTriggerSatBurst}
                                    style={{
                                        padding: "10px 18px", borderRadius: "10px",
                                        background: sat.isUplinkAvailable ? "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)" : "rgba(255,255,255,0.06)",
                                        color: sat.isUplinkAvailable ? "#000000" : "#666",
                                        fontWeight: 900, fontSize: "0.78rem", border: "none", cursor: "pointer",
                                        boxShadow: sat.isUplinkAvailable ? "0 0 20px rgba(0, 229, 255, 0.35)" : "none"
                                    }}
                                >
                                    ⚡ DISPARAR UPLINK
                                </button>
                            </div>

                            {/* Radar SkyView Polar SVG con Huella Orbital */}
                            <div style={{
                                background: "rgba(10, 15, 30, 0.95)",
                                border: "1.5px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "18px", padding: "18px",
                                display: "flex", flexDirection: "column", alignItems: "center", gap: "12px"
                            }}>
                                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.76rem", color: "#00E5FF", fontWeight: 900 }}>
                                        BÓVEDA CELESTE SKYVIEW & HUELLA DE COBERTURA
                                    </span>
                                    <span style={{ fontSize: "0.66rem", color: "var(--text-secondary)" }}>
                                        AOS: Elevación &gt; 25° · Huella ~{sat.activeFootprintRadiusKm}km
                                    </span>
                                </div>

                                <svg width="240" height="240" viewBox="-120 -120 240 240" style={{ overflow: "visible" }}>
                                    {/* Anillos de Elevación: 0° (borde), 30°, 60°, 90° (centro) */}
                                    <circle cx="0" cy="0" r="100" fill="rgba(0, 229, 255, 0.02)" stroke="rgba(0, 229, 255, 0.2)" />
                                    <circle cx="0" cy="0" r="66" fill="none" stroke="rgba(0, 229, 255, 0.25)" strokeDasharray="3 3" />
                                    <circle cx="0" cy="0" r="33" fill="none" stroke="rgba(0, 229, 255, 0.35)" strokeDasharray="3 3" />
                                    <circle cx="0" cy="0" r="72" fill="rgba(0, 230, 118, 0.04)" stroke="#00E676" strokeWidth="1" strokeDasharray="2 2" />

                                    {/* Ejes Cardinales */}
                                    <line x1="0" y1="-105" x2="0" y2="105" stroke="rgba(255,255,255,0.12)" />
                                    <line x1="-105" y1="0" x2="105" y2="0" stroke="rgba(255,255,255,0.12)" />
                                    <text x="0" y="-110" fill="#00E5FF" fontSize="10" textAnchor="middle" fontWeight="bold">N</text>
                                    <text x="114" y="3" fill="#00E5FF" fontSize="10" textAnchor="start" fontWeight="bold">E</text>
                                    <text x="0" y="120" fill="#00E5FF" fontSize="10" textAnchor="middle" fontWeight="bold">S</text>
                                    <text x="-114" y="3" fill="#00E5FF" fontSize="10" textAnchor="end" fontWeight="bold">W</text>
                                    <text x="0" y="4" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">ZENIT</text>

                                    {/* Satélites graficados en coordenadas polares */}
                                    {sat.activePasses.map(s => {
                                        const px = s.polarX * 100;
                                        const py = s.polarY * 100;
                                        const satColor = s.constellation === 'IRIDIUM_NEXT' ? '#00E5FF' : s.constellation === 'DIRECT_TO_CELL' ? '#B388FF' : '#00E676';
                                        return (
                                            <g key={s.satelliteId}>
                                                {s.isInAos && (
                                                    <>
                                                        {/* Cono de Huella Terrestre del Repetidor */}
                                                        <circle cx={px} cy={py} r="26" fill="rgba(0, 229, 255, 0.08)" stroke={satColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
                                                        <circle cx={px} cy={py} r="10" fill="none" stroke={satColor} strokeWidth="1.5" opacity="0.6">
                                                            <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
                                                            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                                                        </circle>
                                                    </>
                                                )}
                                                <circle cx={px} cy={py} r="5" fill={satColor} />
                                                <text x={px + 7} y={py + 3} fill="#FFF" fontSize="8" fontWeight="bold">
                                                    {s.satelliteId.split('-')[0]}
                                                </text>
                                            </g>
                                        );
                                    })}
                                </svg>

                                <div style={{ fontSize: "0.68rem", color: "#AAA", textAlign: "center" }}>
                                    <span style={{ color: "#00E5FF" }}>● Iridium-NEXT</span> · <span style={{ color: "#B388FF" }}>● Starlink D2C</span> · <span style={{ color: "#00E676" }}>● Orbcomm OG2</span>
                                </div>
                            </div>

                            {/* Compositor de Mensaje Satelital & Repetidor Orbital */}
                            <div style={{
                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.76rem", color: "#00E5FF", fontWeight: 900 }}>
                                        COMPOSITOR DE MENSAJE & REPETIDOR ORBITAL
                                    </span>
                                    <span style={{ fontSize: "0.66rem", color: satMessageText.length > 200 ? "#FF3355" : "var(--text-secondary)" }}>
                                        {satMessageText.length}/240 caracteres
                                    </span>
                                </div>

                                {/* Selector de Modo de Enlace */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                                    <button
                                        onClick={() => setSatelliteRelayMode("BENT_PIPE")}
                                        style={{
                                            padding: "6px 4px", borderRadius: "8px", fontSize: "0.66rem", fontWeight: 800,
                                            background: satelliteRelayMode === "BENT_PIPE" ? "rgba(0, 229, 255, 0.25)" : "rgba(255,255,255,0.04)",
                                            color: satelliteRelayMode === "BENT_PIPE" ? "#00E5FF" : "#888",
                                            border: satelliteRelayMode === "BENT_PIPE" ? "1px solid #00E5FF" : "1px solid transparent",
                                            cursor: "pointer"
                                        }}
                                    >
                                        🛰️ BENT-PIPE
                                    </button>
                                    <button
                                        onClick={() => setSatelliteRelayMode("STORE_AND_FORWARD")}
                                        style={{
                                            padding: "6px 4px", borderRadius: "8px", fontSize: "0.66rem", fontWeight: 800,
                                            background: satelliteRelayMode === "STORE_AND_FORWARD" ? "rgba(179, 136, 255, 0.25)" : "rgba(255,255,255,0.04)",
                                            color: satelliteRelayMode === "STORE_AND_FORWARD" ? "#B388FF" : "#888",
                                            border: satelliteRelayMode === "STORE_AND_FORWARD" ? "1px solid #B388FF" : "1px solid transparent",
                                            cursor: "pointer"
                                        }}
                                    >
                                        📦 STORE & FWD
                                    </button>
                                    <button
                                        onClick={() => setSatelliteRelayMode("BENT_PIPE")}
                                        style={{
                                            padding: "6px 4px", borderRadius: "8px", fontSize: "0.66rem", fontWeight: 800,
                                            background: "rgba(255,255,255,0.04)",
                                            color: "#888", border: "1px solid transparent", cursor: "pointer"
                                        }}
                                    >
                                        📡 SBD DIRECTO
                                    </button>
                                </div>

                                {/* Selector de Malla Destino para Repetidor */}
                                <div>
                                    <label style={{ fontSize: "0.66rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                                        MALLA DESTINO REPETIDOR:
                                    </label>
                                    <select
                                        value={targetMeshId}
                                        onChange={(e) => setTargetMeshId(e.target.value)}
                                        style={{
                                            width: "100%", padding: "8px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(0, 229, 255, 0.25)", borderRadius: "8px",
                                            color: "#00E5FF", fontSize: "0.74rem", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    >
                                        <option value="MESH-GLOBAL-ALL">🌐 MESH-GLOBAL-ALL (Difusión Continental Total)</option>
                                        <option value="MESH-LIMA-01">📍 MESH-LIMA-01 (Sector Central)</option>
                                        <option value="MESH-CUSCO-02">📍 MESH-CUSCO-02 (Sector Sur / Andes)</option>
                                        <option value="MESH-IQUITOS-03">📍 MESH-IQUITOS-03 (Sector Selva Amazónica)</option>
                                        <option value="MESH-VALPARAISO-04">📍 MESH-VALPARAISO-04 (Sector Costero Sur)</option>
                                    </select>
                                </div>

                                <textarea
                                    value={satMessageText}
                                    onChange={(e) => setSatMessageText(e.target.value)}
                                    maxLength={240}
                                    rows={3}
                                    placeholder="Redacte mensaje de telemetría de emergencia o coordenadas..."
                                    style={{
                                        width: "100%", padding: "10px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(0, 229, 255, 0.25)", borderRadius: "8px",
                                        color: "#FFF", fontSize: "0.76rem", outline: "none", resize: "none",
                                        fontFamily: "JetBrains Mono, monospace"
                                    }}
                                />

                                <div style={{ display: "flex", gap: "10px" }}>
                                    <button
                                        onClick={handleEnqueueRelayMessage}
                                        style={{
                                            flex: 2, padding: "10px", borderRadius: "8px",
                                            background: "linear-gradient(135deg, rgba(0, 229, 255, 0.3) 0%, rgba(179, 136, 255, 0.3) 100%)",
                                            border: "1px solid #00E5FF",
                                            color: "#00E5FF", fontWeight: 900, fontSize: "0.76rem", cursor: "pointer"
                                        }}
                                    >
                                        🛰️ ENCOLAR REPETIDOR ORBITAL
                                    </button>
                                    <button
                                        onClick={handleEnqueueSbdMessage}
                                        style={{
                                            flex: 1, padding: "10px", borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.15)",
                                            color: "#FFF", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer"
                                        }}
                                    >
                                        📥 ENCOLAR PAQUETE SBD
                                    </button>
                                    <button
                                        onClick={() => satelliteMeshGateway.clearOutboundQueue()}
                                        style={{
                                            padding: "10px 14px", borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)",
                                            color: "#888", fontWeight: 700, fontSize: "0.76rem", cursor: "pointer"
                                        }}
                                    >
                                        Vaciar
                                    </button>
                                </div>
                            </div>

                            {/* Consola de Tráfico de Repetidor Satelital */}
                            {sat.recentRelays.length > 0 && (
                                <div style={{
                                    background: "rgba(10, 15, 30, 0.9)", border: "1px solid rgba(0, 229, 255, 0.2)",
                                    borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px"
                                }}>
                                    <div style={{ fontSize: "0.72rem", color: "#00E5FF", fontWeight: 900 }}>
                                        TRÁFICO DE REPETIDOR ORBITAL RECIENTE ({sat.recentRelays.length}):
                                    </div>
                                    <div style={{ maxHeight: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {sat.recentRelays.slice(0, 5).map(r => (
                                            <div
                                                key={r.relayId}
                                                style={{
                                                    background: "rgba(255, 255, 255, 0.03)", borderRadius: "8px", padding: "8px",
                                                    fontSize: "0.68rem", display: "flex", justifyContent: "space-between", alignItems: "center"
                                                }}
                                            >
                                                <div>
                                                    <span style={{ color: "#00E5FF", fontWeight: 800 }}>[{r.mode}]</span> {r.satelliteId} · <span style={{ color: "#FFB300" }}>{r.targetMeshId}</span>
                                                    <div style={{ color: "#AAA", fontSize: "0.64rem" }}>{r.payload}</div>
                                                </div>
                                                <span style={{ fontSize: "0.60rem", color: "#666" }}>
                                                    Huella {r.footprintRadiusKm}km
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Lista de Satélites en Orbita */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-secondary)", fontWeight: 900 }}>
                                    CONSTELACIONES EN SEGUIMIENTO ORBITAL:
                                </div>
                                {sat.activePasses.map(s => (
                                    <div
                                        key={s.satelliteId}
                                        style={{
                                            padding: "10px 14px", borderRadius: "12px",
                                            background: s.isInAos ? "rgba(0, 229, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
                                            border: `1px solid ${s.isInAos ? "#00E5FF" : "rgba(255, 255, 255, 0.06)"}`,
                                            display: "flex", justifyContent: "space-between", alignItems: "center"
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 900, fontSize: "0.82rem", color: s.isInAos ? "#00E5FF" : "#FFF" }}>
                                                {s.satelliteId} ({s.constellation})
                                            </div>
                                            <div style={{ fontSize: "0.66rem", color: "var(--text-secondary)" }}>
                                                Az: {s.azimuthDeg}° · Elev: {s.elevationDeg}° · {s.uplinkFrequencyMhz} MHz
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{
                                                fontSize: "0.65rem", fontWeight: 900, padding: "3px 8px", borderRadius: "5px",
                                                background: s.isInAos ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                                color: s.isInAos ? "#00E676" : "#888",
                                                border: `1px solid ${s.isInAos ? '#00E676' : 'rgba(255,255,255,0.1)'}`
                                            }}>
                                                {s.isInAos ? `AOS (${s.passDurationSec}s)` : `En: ${s.timeToAosSec}s`}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { cbrnRadiation, RadiationTelemetry } from "../lib/sensors/CbrnRadiationEngine";
import { satelliteMeshGateway, SatelliteGatewayTelemetry } from "../lib/mesh/SatelliteMeshGatewayEngine";
import { cbrnPlumeDispersionEngine, PlumeHazardZone } from "../lib/tactical/CbrnPlumeDispersionEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function CbrnSatelliteModal() {
    const { navigate, identity, goBack } = useRedStore();

    const [cbrn, setCbrn] = useState<RadiationTelemetry>(() => cbrnRadiation.getTelemetry());
    const [sat, setSat] = useState<SatelliteGatewayTelemetry>(() => satelliteMeshGateway.getTelemetry());
    const [activeTab, setActiveTab] = useState<"cbrn" | "satellite" | "plume">("cbrn");
    const [plumeZone, setPlumeZone] = useState<PlumeHazardZone>(() => 
        cbrnPlumeDispersionEngine.calculatePlumeDispersion({
            id: `INCIDENT-${Date.now()}`,
            lat: 0,
            lon: 0,
            hazardType: 'RADIOACTIVE_FALLOUT',
            releaseRateKgSec: 10,
            windSpeedKmh: 15,
            windDirectionDegrees: 45,
            stabilityClass: 'D',
            timestamp: Date.now()
        }, 0, 0)
    );

    useEffect(() => {
        cbrnRadiation.startMonitoring();
        const unsubCbrn = cbrnRadiation.subscribe(setCbrn);
        const unsubSat = satelliteMeshGateway.subscribe(setSat);

        // Fetch live GPS location for plume and satellite orbital calculation
        if (typeof navigator !== "undefined" && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    satelliteMeshGateway.setObserverLocation(lat, lon);
                    setPlumeZone(cbrnPlumeDispersionEngine.calculatePlumeDispersion({
                        id: `INCIDENT-${Date.now()}`,
                        lat,
                        lon,
                        hazardType: 'RADIOACTIVE_FALLOUT',
                        releaseRateKgSec: 10,
                        windSpeedKmh: 15,
                        windDirectionDegrees: 45,
                        stabilityClass: 'D',
                        timestamp: Date.now()
                    }, lat + 0.002, lon + 0.002));
                },
                () => {},
                { timeout: 5000, enableHighAccuracy: true }
            );
        }

        return () => {
            unsubCbrn();
            unsubSat();
            cbrnRadiation.stopMonitoring();
        };
    }, []);

    const handleTriggerSatBurst = () => {
        const success = satelliteMeshGateway.triggerSatelliteBurst();
        if (success) {
            toast.success("🛰️ Ráfaga DTN inyectada a la constelación LEO exitosamente");
        } else {
            toast.error("Sin satélites en rango cenital (Elevación < 25°)");
        }
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "#050812", color: "#FFF",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 15, 30, 0.95)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>☢️</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF", display: "flex", alignItems: "center", gap: "6px" }}>
                            TELEMETRÍA CBRN & ENLACE SATELITAL LEO
                            <span style={{
                                fontSize: "0.55rem", fontWeight: 800, letterSpacing: "0.08em",
                                background: "rgba(0, 230, 118, 0.18)", color: "#00E676",
                                border: "1px solid rgba(0, 230, 118, 0.4)",
                                borderRadius: "3px", padding: "1px 5px"
                            }}>📡 TELEMETRÍA EN VIVO</span>
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Dosimetría Nuclear y Pasarela Espacial DTN Store-and-Forward
                        </div>
                    </div>
                </div>
                <button
                    onClick={goBack}
                    style={{

                        background: "rgba(232, 33, 58, 0.2)", border: "1px solid #E8213A",
                        color: "#FFF", padding: "6px 12px", borderRadius: "8px",
                        cursor: "pointer", fontWeight: 800, fontSize: "0.75rem"
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Tab Selector */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "6px 16px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                    onClick={() => setActiveTab("cbrn")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 800,
                        background: activeTab === "cbrn" ? "#FFB300" : "transparent",
                        color: activeTab === "cbrn" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    ☢️ Dosimetría
                </button>
                <button
                    onClick={() => setActiveTab("plume")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 800,
                        background: activeTab === "plume" ? "#FF3355" : "transparent",
                        color: activeTab === "plume" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    ☣️ Pluma & Escape
                </button>
                <button
                    onClick={() => setActiveTab("satellite")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.72rem", fontWeight: 800,
                        background: activeTab === "satellite" ? "#00E5FF" : "transparent",
                        color: activeTab === "satellite" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🛰️ Satélite ({sat.activePasses.filter(s => s.isInAos).length})
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: CBRN NUCLEAR DOSIMETRY ── */}
                {activeTab === "cbrn" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Radiation Rate Display */}
                        <div style={{
                            background: "rgba(0, 0, 0, 0.5)", border: `1.5px solid ${cbrn.threatLevel === "LETHAL" ? "#FF3355" : cbrn.threatLevel === "HAZARDOUS" ? "#FF9100" : cbrn.threatLevel === "ELEVATED" ? "#FFD600" : "#00E676"}`,
                            borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.74rem", color: "#AAA", fontWeight: 800 }}>TASA DE DOSIS INSTANTÁNEA</span>
                                <span style={{
                                    fontSize: "0.68rem", fontWeight: 900, padding: "2px 8px", borderRadius: "6px",
                                    background: cbrn.threatLevel === "SAFE_BACKGROUND" ? "rgba(0,230,118,0.2)" : "rgba(232,33,58,0.3)",
                                    color: cbrn.threatLevel === "SAFE_BACKGROUND" ? "#00E676" : "#FF3355"
                                }}>
                                    {cbrn.threatLevel}
                                </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                                <span style={{ fontSize: "2.4rem", fontWeight: 900, color: "#FFF" }}>
                                    {cbrn.doseRateUsVh}
                                </span>
                                <span style={{ fontSize: "1rem", color: "#FFB300", fontWeight: 800 }}>
                                    µSv/h
                                </span>
                                <span style={{ fontSize: "0.85rem", color: "#888", marginLeft: "auto" }}>
                                    {cbrn.countsPerMinuteCpm} CPM
                                </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#DDD", lineHeight: "1.4" }}>
                                {cbrn.arsRiskDescription}
                            </div>
                        </div>

                        {/* Cumulative Dose & Safe Stay Time */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>DOSIS ACUMULADA</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#00E5FF" }}>
                                    {cbrn.cumulativeDoseMsv} mSv
                                </div>
                                <div style={{ fontSize: "0.62rem", color: "#888" }}>Límite civil: 50 mSv</div>
                            </div>
                            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "10px", padding: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>TIEMPO SEGURO (T_stay)</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#00E676" }}>
                                    {cbrn.safeStayTimeMinutes > 9999 ? "∞" : `${cbrn.safeStayTimeMinutes} min`}
                                </div>
                                <div style={{ fontSize: "0.62rem", color: "#888" }}>Hasta umbral de riesgo</div>
                            </div>
                        </div>

                        {/* Sensor State Banner */}
                        <div style={{
                            padding: "10px 14px",
                            background: "rgba(0, 230, 118, 0.06)",
                            border: "1px solid rgba(0, 230, 118, 0.25)",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px"
                        }}>
                            <span style={{ fontSize: "1.1rem" }}>📷</span>
                            <div style={{ fontSize: "0.70rem", color: "#DDD", lineHeight: 1.3 }}>
                                <strong style={{ color: "#00E676" }}>Sensor CMOS Activo:</strong> Detección fotónica de radiación ionizante por análisis de ruido en matriz de píxeles.
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: SATELLITE LEO GATEWAY ── */}
                {activeTab === "satellite" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{
                            background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.2)",
                            borderRadius: "12px", padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "#00E5FF" }}>
                                    UPLINK SATELITAL DISPONIBLE
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    {sat.queuedOutboundPackets} paquetes encolados · {sat.totalUplinksTransmitted} ráfagas enviadas
                                </div>
                            </div>
                            <button
                                onClick={handleTriggerSatBurst}
                                style={{
                                    padding: "10px 16px", borderRadius: "8px",
                                    background: sat.isUplinkAvailable ? "#00E5FF" : "rgba(255,255,255,0.1)",
                                    color: sat.isUplinkAvailable ? "#000" : "#888",
                                    fontWeight: 900, fontSize: "0.76rem", border: "none", cursor: "pointer"
                                }}
                            >
                                ⚡ DISPARAR UPLINK
                            </button>
                        </div>

                        {/* Visible Satellites Pass List */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "0.7rem", color: "#AAA", fontWeight: 800 }}>CONSTELACIONES EN SEGUIMIENTO ORBITAL:</div>
                            {sat.activePasses.map(s => (
                                <div
                                    key={s.satelliteId}
                                    style={{
                                        padding: "10px 12px", borderRadius: "10px",
                                        background: s.isInAos ? "rgba(0, 229, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
                                        border: `1px solid ${s.isInAos ? "#00E5FF" : "rgba(255, 255, 255, 0.08)"}`,
                                        display: "flex", justifyContent: "space-between", alignItems: "center"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: "0.8rem", color: s.isInAos ? "#00E5FF" : "#FFF" }}>
                                            {s.satelliteId} ({s.constellation})
                                        </div>
                                        <div style={{ fontSize: "0.65rem", color: "#888" }}>
                                            Az: {s.azimuthDeg}° · Elev: {s.elevationDeg}° · {s.uplinkFrequencyMhz} MHz
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "right" }}>
                                        <span style={{
                                            fontSize: "0.65rem", fontWeight: 900, padding: "2px 6px", borderRadius: "4px",
                                            background: s.isInAos ? "rgba(0,230,118,0.2)" : "rgba(255,255,255,0.05)",
                                            color: s.isInAos ? "#00E676" : "#AAA"
                                        }}>
                                            {s.isInAos ? `AOS (${s.passDurationSec}s)` : `Próximo: ${s.timeToAosSec}s`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── TAB 3: CBRN GAUSSIAN PLUME & SAFE ESCAPE CORRIDOR ── */}
                {activeTab === "plume" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 51, 85, 0.08)", border: "1px solid rgba(255, 51, 85, 0.3)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Modelo de dispersión atmosférica Pasquill-Gifford. Calcula el cono de peligro de viento a sotavento y genera el rumbo de escape a 90° barlovento para salir de la pluma tóxica.
                        </div>

                        {/* Escape Vector Master HUD */}
                        <div style={{
                            padding: "16px", borderRadius: "14px",
                            background: plumeZone.escapeVector.isInDangerZone ? "rgba(255, 51, 85, 0.25)" : "rgba(0, 230, 118, 0.15)",
                            border: `1.5px solid ${plumeZone.escapeVector.isInDangerZone ? "#FF3355" : "#00E676"}`,
                            display: "flex", alignItems: "center", justifyContent: "space-between"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.72rem", color: "#AAA", fontWeight: 800 }}>ESTADO DE PELIGRO EN PLUMA</div>
                                <div style={{ fontSize: "1.8rem", fontWeight: 900, color: plumeZone.escapeVector.isInDangerZone ? "#FF3355" : "#00E676" }}>
                                    {plumeZone.escapeVector.currentDangerLevel}
                                </div>
                                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#FFB300" }}>
                                    Agente: {plumeZone.source.hazardType}
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.7rem", color: "#AAA" }}>RUMBO DE ESCAPE</div>
                                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#00E5FF" }}>
                                    {plumeZone.escapeVector.recommendedAzimuthDegrees}°
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>
                                    {plumeZone.escapeVector.distanceToSafetyMeters}m a zona segura ({plumeZone.escapeVector.estimatedWalkTimeMinutes} min)
                                </div>
                            </div>
                        </div>

                        {/* Plume Metrics Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>ZONA CALIENTE (LETAL)</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FF3355" }}>{plumeZone.hotZoneRadiusMeters} m radio</div>
                            </div>
                            <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>LONGITUD PLUMA TIBIA</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFB300" }}>{plumeZone.warmZoneLengthMeters} m</div>
                            </div>
                            <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>VIENTO SOTAVENTO</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#38BDF8" }}>{plumeZone.source.windSpeedKmh} km/h @ {plumeZone.source.windDirectionDegrees}°</div>
                            </div>
                            <div style={{ padding: "12px", background: "rgba(10, 18, 36, 0.6)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <div style={{ fontSize: "0.68rem", color: "#AAA" }}>PERÍMETRO SEGURO</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#00E676" }}>&gt; {plumeZone.coldZonePerimeterMeters} m</div>
                            </div>
                        </div>

                        {/* Broadcast Escape Vector to Mesh */}
                        <button
                            onClick={async () => {
                                const { meshSosBeacon } = await import("../lib/emergency/MeshSosBeaconEngine");
                                let batt = 100;
                                if (typeof window !== 'undefined' && typeof (window as any).__red_last_battery === 'number') {
                                    batt = (window as any).__red_last_battery;
                                } else if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
                                    try {
                                        const b: any = await (navigator as any).getBattery();
                                        if (b && typeof b.level === 'number') batt = Math.round(b.level * 100);
                                    } catch {}
                                }
                                const callerId = identity?.identity_hash ? `did:red:${identity.identity_hash.slice(0, 8)}` : "CBRN_COMMAND";
                                const callerName = identity?.nickname || "Oficial de Seguridad CBRN";
                                await meshSosBeacon.activateSosBeacon({
                                    distressType: "NATURAL_DISASTER",
                                    triageColor: "RED",
                                    note: `ALERTA EVACUACIÓN CBRN: Escape por Rumbo ${plumeZone.escapeVector.recommendedAzimuthDegrees}°. Zona Caliente: ${plumeZone.hotZoneRadiusMeters}m. Salir del cono de viento inmediatamente.`,
                                    batteryLevel: batt
                                }, callerId, callerName);
                                toast.success("🚨 Corredor de Evacuación y Vector de Escape transmitido por la Malla SOS");
                            }}
                            style={{
                                padding: "14px", borderRadius: "10px",
                                background: "linear-gradient(135deg, #FF3355, #E8213A)",
                                color: "#FFF", fontWeight: 900, fontSize: "0.82rem", border: "none", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                            }}
                        >
                            <span>🚨</span>
                            <span>TRANSMITIR VECTOR DE ESCAPE A LA MALLA</span>
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}

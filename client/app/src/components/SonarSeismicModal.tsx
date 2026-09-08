"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { acousticSonar, SonarMediumType, SonarPingResult } from "../lib/sensors/AcousticSonarEngine";
import { seismicTriangulation, SurvivorTriangulationResult, SeismicSensorNode } from "../lib/sensors/SeismicTriangulationEngine";
import { structuralHealthSeismic, StructuralHealthTelemetry } from "../lib/sensors/StructuralHealthSeismicEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { meshSosBeacon } from "../lib/emergency/MeshSosBeaconEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function SonarSeismicModal() {
    const { navigate, goBack, identity } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"sonar" | "seismic" | "structural">("sonar");
    
    // Structural Health State
    const [structTelemetry, setStructTelemetry] = useState<StructuralHealthTelemetry>(() => structuralHealthSeismic.getTelemetry());
    
    // Sonar States
    const [medium, setMedium] = useState<SonarMediumType>("AIR_20C");
    const [sonarState, setSonarState] = useState(() => acousticSonar.getState());
    const [lastPing, setLastPing] = useState<SonarPingResult | null>(sonarState.lastResult);

    // Seismic States
    const [seismicResult, setSeismicResult] = useState<SurvivorTriangulationResult | null>(() => seismicTriangulation.getState().lastResult);
    const [nodes, setNodes] = useState<SeismicSensorNode[]>(() => seismicTriangulation.getNodes());

    // Live Physical Geophone Sensor State
    const [isListeningGeophone, setIsListeningGeophone] = useState<boolean>(false);
    const [currentVibrationG, setCurrentVibrationG] = useState<number>(0);
    const [localNodeCoords, setLocalNodeCoords] = useState<{ x: number; y: number }>({ x: 3.0, y: 2.6 });
    const [lastImpact, setLastImpact] = useState<{ timestamp: number; amplitudeG: number; nodeName: string } | null>(null);
    const gravityEmaRef = useRef<number>(9.81);
    const lastTapTsRef = useRef<number>(0);
    const tapCadenceRef = useRef<number[]>([]);

    // Intercepción LIFO de hardware Android y tecla Escape
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (isListeningGeophone) {
                setIsListeningGeophone(false);
                return true;
            }
            if (activeTab !== "sonar") {
                setActiveTab("sonar");
                return true;
            }
            goBack();
            return true;
        });
        return () => unregister();
    }, [activeTab, isListeningGeophone, goBack]);

    useEffect(() => {
        const unsubSonar = acousticSonar.subscribe(r => {
            setLastPing(r);
            setSonarState(acousticSonar.getState());
        });
        const unsubSeismic = seismicTriangulation.subscribe(r => {
            setSeismicResult(r);
            setNodes(seismicTriangulation.getNodes());
        });
        const unsubStruct = structuralHealthSeismic.subscribe(setStructTelemetry);

        return () => {
            unsubSonar();
            unsubSeismic();
            unsubStruct();
            acousticSonar.stopContinuousScan();
            structuralHealthSeismic.stopMonitoring();
            acousticSonar.destroy();
        };
    }, []);

    // Escucha de acelerómetro físico para Modo Geófono Local en Vivo
    useEffect(() => {
        if (!isListeningGeophone) return;

        const onMotion = (e: DeviceMotionEvent) => {
            let mag = 0;
            if (e.acceleration && typeof e.acceleration.x === "number" && typeof e.acceleration.y === "number" && typeof e.acceleration.z === "number") {
                const x = e.acceleration.x || 0;
                const y = e.acceleration.y || 0;
                const z = e.acceleration.z || 0;
                mag = Math.sqrt(x * x + y * y + z * z);
            } else if (e.accelerationIncludingGravity && typeof e.accelerationIncludingGravity.x === "number") {
                const acc = e.accelerationIncludingGravity;
                const x = acc.x || 0;
                const y = acc.y || 0;
                const z = acc.z || 0;
                const total = Math.sqrt(x * x + y * y + z * z);
                gravityEmaRef.current = 0.92 * gravityEmaRef.current + 0.08 * (total > 0 ? total : 9.81);
                mag = Math.abs(total - gravityEmaRef.current);
            }

            if (!isFinite(mag) || mag < 0) mag = 0;
            setCurrentVibrationG(Math.round(mag * 100) / 100);

            // Detección de impacto cinemático sobre escombros (> 1.15 G)
            const now = Date.now();
            if (mag > 1.15 && (now - lastTapTsRef.current > 150)) {
                lastTapTsRef.current = now;
                TacticalAudioEngine.playTap();
                
                tapCadenceRef.current.push(now);
                if (tapCadenceRef.current.length > 5) tapCadenceRef.current.shift();

                const localId = identity?.identity_hash ? `geo_${identity.identity_hash.slice(0, 8)}` : "geophone-local";
                seismicTriangulation.registerSensorNode({
                    id: localId,
                    name: `Geófono Local (${identity?.nickname || "Dispositivo"})`,
                    xMeters: localNodeCoords.x,
                    yMeters: localNodeCoords.y,
                    arrivalTimestampMs: now,
                    amplitudeG: Math.round(mag * 100) / 100
                });

                // Si ya existen nodos complementarios (ej. red de geófonos USAR), recalcular TDoA
                const currentNodes = seismicTriangulation.getNodes();
                if (currentNodes.length >= 3) {
                    const res = seismicTriangulation.recordAccelerometerImpact(localId, now, mag);
                    setSeismicResult(res);
                }
                setNodes(seismicTriangulation.getNodes());
                setLastImpact({ timestamp: now, amplitudeG: mag, nodeName: "Geófono Local" });

                // Retransmitir impacto acústico a la malla táctica
                import("../lib/mesh/meshRouter").then(({ meshRouter }) => {
                    const impactPkt = new TextEncoder().encode(JSON.stringify({
                        msg_type: "seismic_geophone_hit",
                        nodeId: localId,
                        timestamp: now,
                        amplitudeG: Math.round(mag * 100) / 100,
                        xMeters: localNodeCoords.x,
                        yMeters: localNodeCoords.y
                    }));
                    meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", impactPkt).catch(() => {});
                }).catch(() => {});
            }
        };

        window.addEventListener("devicemotion", onMotion, true);
        return () => {
            window.removeEventListener("devicemotion", onMotion, true);
        };
    }, [isListeningGeophone, localNodeCoords, identity]);

    // Escucha de impactos sísmicos remotos transmitidos por otros nodos de la malla
    useEffect(() => {
        const handleRemoteSeismic = (e: any) => {
            const detail = e.detail;
            if (!detail || !detail.nodeId) return;
            const myLocalId = identity?.identity_hash ? `geo_${identity.identity_hash.slice(0, 8)}` : "geophone-local";
            if (detail.nodeId === myLocalId) return;

            seismicTriangulation.registerSensorNode({
                id: String(detail.nodeId),
                name: `Geófono Remoto (${String(detail.nodeId).slice(0, 8)})`,
                xMeters: Number(detail.xMeters) || 0,
                yMeters: Number(detail.yMeters) || 0,
                arrivalTimestampMs: Number(detail.timestamp) || Date.now(),
                amplitudeG: Number(detail.amplitudeG) || 0.5
            });

            const currentNodes = seismicTriangulation.getNodes();
            if (currentNodes.length >= 3) {
                const res = seismicTriangulation.triangulate();
                setSeismicResult(res);
            }
            setNodes(seismicTriangulation.getNodes());
            setLastImpact({
                timestamp: Number(detail.timestamp) || Date.now(),
                amplitudeG: Number(detail.amplitudeG) || 0.5,
                nodeName: `Geófono Remoto (${String(detail.nodeId).slice(0, 8)})`
            });
            TacticalAudioEngine.playTap();
        };

        window.addEventListener("red_seismic_geophone_event", handleRemoteSeismic);
        return () => {
            window.removeEventListener("red_seismic_geophone_event", handleRemoteSeismic);
        };
    }, [identity]);

    const effectiveSpeed = useMemo(() => {
        return acousticSonar.getEffectiveSpeedOfSound(medium);
    }, [medium]);

    const handleEmitPing = async () => {
        toast.info("📡 Emitiendo chirp FMCW...");
        const res = await acousticSonar.emitPing(medium);
        if (res.isRealAudioTof) {
            toast.success(`🎯 ECO REAL: ${res.distanceMeters} m (${res.timeOfFlightMs} ms, SNR +${res.peakSnrDb}dB)`);
        } else {
            toast.info(`📡 SONDEO ToF: ${res.distanceMeters} m (${res.timeOfFlightMs} ms)`);
        }
    };

    const handleToggleContinuous = () => {
        if (sonarState.isScanning) {
            acousticSonar.stopContinuousScan();
            setSonarState(acousticSonar.getState());
            toast.info("Barrido de sonar continuo detenido");
        } else {
            acousticSonar.startContinuousScan(800);
            setSonarState(acousticSonar.getState());
            toast.success("Barrido de sonar activo");
        }
    };

    const handleDeployUsarTriangle = () => {
        const now = Date.now();
        seismicTriangulation.registerSensorNode({
            id: "geophone-alpha",
            name: "Geófono Alfa",
            xMeters: 0,
            yMeters: 0,
            arrivalTimestampMs: now,
            amplitudeG: 0.85
        });
        seismicTriangulation.registerSensorNode({
            id: "geophone-bravo",
            name: "Geófono Bravo",
            xMeters: 6,
            yMeters: 0,
            arrivalTimestampMs: now + 3,
            amplitudeG: 0.62
        });
        seismicTriangulation.registerSensorNode({
            id: "geophone-charlie",
            name: "Geófono Charlie",
            xMeters: 3,
            yMeters: 5.2,
            arrivalTimestampMs: now + 2,
            amplitudeG: 0.74
        });
        const res = seismicTriangulation.triangulate();
        setNodes(seismicTriangulation.getNodes());
        setSeismicResult(res);
        toast.success("📐 Triángulo de geófonos USAR desplegado y calibrado");
    };

    const handleClearSeismicNodes = () => {
        seismicTriangulation.clearNodes();
        setNodes([]);
        setSeismicResult(null);
        setLastImpact(null);
        toast.info("Geófonos sísmicos purgados");
    };

    const handleSimulateSurvivorTap = () => {
        if (nodes.length < 3) {
            handleDeployUsarTriangle();
        }
        const now = Date.now();
        seismicTriangulation.recordAccelerometerImpact("geophone-alpha", now + 2, 0.95);
        seismicTriangulation.recordAccelerometerImpact("geophone-bravo", now + 4, 0.68);
        const res = seismicTriangulation.recordAccelerometerImpact("geophone-charlie", now + 1, 0.88);
        setNodes(seismicTriangulation.getNodes());
        setSeismicResult(res);
        TacticalAudioEngine.playTap();
        toast.success(`🪨 ¡Impacto acústico registrado! Superviviente a X=${res.estimatedX}m, Y=${res.estimatedY}m (Prof: ${res.estimatedDepthMeters}m)`);
    };

    const handleNavigateToVictim = () => {
        if (!seismicResult) return;
        TacticalAudioEngine.playTap();
        try {
            const rawWp = localStorage.getItem("red_offgrid_waypoints");
            const wps = rawWp ? JSON.parse(rawWp) : [];
            const newWp = {
                id: `seismic_victim_${Date.now()}`,
                name: `VÍCTIMA USAR (X=${seismicResult.estimatedX}m, Y=${seismicResult.estimatedY}m, Prof=${seismicResult.estimatedDepthMeters}m)`,
                lat: 0,
                lon: 0,
                createdAt: Date.now()
            };
            wps.unshift(newWp);
            localStorage.setItem("red_offgrid_waypoints", JSON.stringify(wps.slice(0, 30)));
            localStorage.setItem("red_active_target", JSON.stringify({
                name: newWp.name,
                lat: 0,
                lon: 0,
                type: "SURVIVOR_TDOA",
                depthMeters: seismicResult.estimatedDepthMeters
            }));
            toast.success("🧭 Posición de víctima fijada. Abriendo navegación.");
            navigate("compass");
        } catch {
            navigate("nodemap");
        }
    };

    const handleBroadcastVictimSos = async () => {
        if (!seismicResult) return;
        TacticalAudioEngine.playTap();
        try {
            const callerId = identity?.identity_hash ? `did:red:${identity.identity_hash.slice(0, 8)}` : "USAR_RESCUE";
            const callerName = identity?.nickname || "Operador USAR Sísmico";
            await meshSosBeacon.activateSosBeacon({
                distressType: "NATURAL_DISASTER",
                triageColor: "RED",
                note: `SUPERVIVIENTE ATRAPADO BAJO ESCOMBROS: Triangulado a X=${seismicResult.estimatedX}m, Y=${seismicResult.estimatedY}m, Profundidad aprox ${seismicResult.estimatedDepthMeters}m. Confianza TDoA ${Math.round(seismicResult.confidencePct)}%. Patrón: ${seismicResult.patternType}.`,
                batteryLevel: 100
            }, callerId, callerName);
            TacticalAudioEngine.playEmergencyAlarm();
            toast.success("🚨 Localización de víctima transmitida por Malla SOS");
        } catch (e: any) {
            toast.error("Error al difundir SOS: " + e.message);
        }
    };

    const handleToggleStructuralMonitoring = () => {
        if (structTelemetry.isMonitoring) {
            structuralHealthSeismic.stopMonitoring();
            toast.info("Monitoreo sísmico estructural detenido");
        } else {
            structuralHealthSeismic.startMonitoring();
            toast.success("Monitoreo sísmico estructural iniciado");
        }
    };

    const handleCalibrateStructuralBaseline = () => {
        structuralHealthSeismic.calibrateBaseline();
        toast.success(`Frecuencia base f₀ calibrada a ${structuralHealthSeismic.getTelemetry().baselineFrequencyHz} Hz`);
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header Táctico */}
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
                        background: "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(0, 229, 255, 0.25)"
                    }}>📡</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            SONAR ACÚSTICO & SÍSMICA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            ECO FMCW ToF · TRIANGULACIÓN SÍSMICA TDoA
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{
                        fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                        background: sonarState.isScanning ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        color: sonarState.isScanning ? "#00E676" : "var(--text-secondary)",
                        border: `1px solid ${sonarState.isScanning ? '#00E676' : 'rgba(255,255,255,0.1)'}50`
                    }}>
                        {sonarState.isScanning ? "SONAR ACTIVO" : "STANDBY"}
                    </span>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("sonar")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "sonar" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "sonar" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "sonar" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>📡</span> SONAR ToF {sonarState.isScanning && "▶"}
                </button>
                <button
                    onClick={() => setActiveTab("seismic")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "seismic" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "seismic" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "seismic" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🪨</span> SÍSMICA TDoA ({nodes.length})
                </button>
                <button
                    onClick={() => setActiveTab("structural")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "structural" ? "linear-gradient(135deg, rgba(255, 179, 0, 0.25) 0%, rgba(180, 120, 0, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "structural" ? "1.5px solid #FFB300" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "structural" ? "#FFB300" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🏢</span> ANTI-COLAPSO {structTelemetry.isMonitoring && "●"}
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: ACOUSTIC SONAR */}
                    {activeTab === "sonar" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 229, 255, 0.12)"
                        }}>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900 }}>
                                        MEDIO DE PROPAGACIÓN ACÚSTICA
                                    </label>
                                    <span style={{ fontSize: "0.68rem", color: "#00E5FF", fontWeight: 800 }}>
                                        c = {effectiveSpeed} m/s
                                    </span>
                                </div>
                                <select
                                    value={medium}
                                    onChange={(e: any) => setMedium(e.target.value)}
                                    style={{
                                        width: "100%", padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.82rem", outline: "none", fontFamily: "JetBrains Mono, monospace"
                                    }}
                                >
                                    <option value="AIR_20C">Aire (Laplace f(T)) · ~343 m/s</option>
                                    <option value="WATER">Agua Dulce / Mar (Bilaniuk-Wong) · ~1480 m/s</option>
                                    <option value="CONCRETE">Hormigón / Escombros · 3200 m/s</option>
                                    <option value="STEEL">Acero Estructural · 5100 m/s</option>
                                </select>
                            </div>

                            {/* ─── OSCILOSCOPIO A-SCAN ToF FMCW (SVG) ─── */}
                            <div style={{
                                background: "rgba(4, 8, 20, 0.95)", border: "1.5px solid rgba(0, 229, 255, 0.25)",
                                borderRadius: "16px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                                    <span>REFLECTOMETRÍA ACÚSTICA A-SCAN</span>
                                    <span>RANGO ToF: 0 - 100 ms</span>
                                </div>

                                <svg width="100%" height="80" viewBox="0 0 300 80" style={{ overflow: "visible" }}>
                                    <defs>
                                        <linearGradient id="tofGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(0, 229, 255, 0.6)" />
                                            <stop offset="100%" stopColor="rgba(0, 229, 255, 0.05)" />
                                        </linearGradient>
                                    </defs>

                                    {/* Cuadrícula de Referencia */}
                                    <line x1="10" y1="20" x2="290" y2="20" stroke="rgba(0, 229, 255, 0.1)" strokeDasharray="3 3" />
                                    <line x1="10" y1="45" x2="290" y2="45" stroke="rgba(0, 229, 255, 0.1)" strokeDasharray="3 3" />
                                    <line x1="10" y1="70" x2="290" y2="70" stroke="rgba(0, 229, 255, 0.2)" />

                                    {/* Pulso Emitido Tx a t=0 */}
                                    <path d="M 12 70 L 18 15 L 24 70" fill="none" stroke="#00E676" strokeWidth="2" />
                                    <text x="18" y="10" fill="#00E676" fontSize="8" textAnchor="middle" fontWeight="900">Tx</text>

                                    {/* Ruido Basal */}
                                    <path d="M 24 70 Q 50 67 80 69 T 140 68 T 200 69 T 290 70" fill="none" stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1" />

                                    {/* Pulso Eco Rx Detectado */}
                                    {lastPing && lastPing.timeOfFlightMs > 0 && (
                                        (() => {
                                            const tofClamped = Math.max(5, Math.min(95, lastPing.timeOfFlightMs));
                                            const echoX = 20 + (tofClamped / 100) * 260;
                                            const peakH = Math.max(15, Math.min(45, (lastPing.peakSnrDb || 12) * 1.8));
                                            const echoY = 70 - peakH;
                                            return (
                                                <g>
                                                    <line x1="20" y1="75" x2={echoX} y2="75" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="2 2" />
                                                    <path
                                                        d={`M ${echoX - 10} 70 L ${echoX} ${echoY} L ${echoX + 10} 70 Z`}
                                                        fill="url(#tofGrad)" stroke="#00E5FF" strokeWidth="2"
                                                    />
                                                    <circle cx={echoX} cy={echoY} r="3" fill="#00E5FF" />
                                                    <text x={echoX} y={Math.max(12, echoY - 5)} fill="#00E5FF" fontSize="8" textAnchor="middle" fontWeight="900">
                                                        Rx ({lastPing.timeOfFlightMs}ms)
                                                    </text>
                                                </g>
                                            );
                                        })()
                                    )}
                                </svg>
                            </div>

                            {/* Distance Result Card */}
                            <div style={{
                                background: "rgba(0, 229, 255, 0.08)", border: "1.5px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "16px", padding: "20px", textAlign: "center",
                                display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>DISTANCIA AL OBSTÁCULO:</div>
                                    <span style={{
                                        fontSize: "0.60rem", fontWeight: 900, padding: "2px 7px", borderRadius: "5px",
                                        background: lastPing?.isRealAudioTof ? "rgba(0, 230, 118, 0.2)" : "rgba(0, 229, 255, 0.15)",
                                        color: lastPing?.isRealAudioTof ? "#00E676" : "#00E5FF",
                                        border: `1px solid ${lastPing?.isRealAudioTof ? '#00E676' : '#00E5FF'}60`
                                    }}>
                                        {lastPing?.isRealAudioTof ? "🎙️ RETORNO ACÚSTICO MICRO" : "📐 MODELO LAPLACE"}
                                    </span>
                                </div>
                                <div style={{ fontSize: "2.8rem", fontWeight: 900, color: "#00E5FF" }}>
                                    {lastPing ? `${lastPing.distanceMeters.toFixed(2)} m` : "-- m"}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                    Tiempo de Vuelo (ToF): {lastPing ? `${lastPing.timeOfFlightMs} ms` : "-- ms"} · Confianza: {lastPing ? `${Math.round(lastPing.confidencePct)}%` : "--"}
                                </div>

                                {lastPing && (
                                    <div style={{
                                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px",
                                        paddingTop: "8px", borderTop: "1px solid rgba(0, 229, 255, 0.15)", fontSize: "0.68rem"
                                    }}>
                                        <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "6px", borderRadius: "8px", textAlign: "left" }}>
                                            <span style={{ color: "var(--text-secondary)", display: "block" }}>Relación SNR Eco:</span>
                                            <strong style={{ color: (lastPing.peakSnrDb || 0) > 6 ? "#00E676" : "#FFB300" }}>
                                                {lastPing.peakSnrDb !== undefined ? `+${lastPing.peakSnrDb} dB` : "N/A"}
                                            </strong>
                                        </div>
                                        <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "6px", borderRadius: "8px", textAlign: "left" }}>
                                            <span style={{ color: "var(--text-secondary)", display: "block" }}>Resonancia Cavidad:</span>
                                            <strong style={{ color: "#00E5FF" }}>
                                                {lastPing.cavityResonanceHz ? `${lastPing.cavityResonanceHz} Hz (~${lastPing.estimatedVolumeM3} m³)` : "N/A"}
                                            </strong>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={handleEmitPing}
                                    style={{
                                        flex: 1, padding: "12px", borderRadius: "12px",
                                        background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        color: "#000000", fontWeight: 900, fontSize: "0.82rem", border: "none", cursor: "pointer",
                                        boxShadow: "0 0 16px rgba(0, 229, 255, 0.3)"
                                    }}
                                >
                                    📡 EMITIR PING FMCW
                                </button>
                                <button
                                    onClick={handleToggleContinuous}
                                    style={{
                                        flex: 1, padding: "12px", borderRadius: "12px",
                                        background: sonarState.isScanning ? "rgba(255, 51, 85, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                        border: `1px solid ${sonarState.isScanning ? '#FF3355' : 'rgba(255, 255, 255, 0.15)'}`,
                                        color: sonarState.isScanning ? "#FF3355" : "#FFFFFF",
                                        fontWeight: 900, fontSize: "0.82rem", cursor: "pointer"
                                    }}
                                >
                                    {sonarState.isScanning ? "⏹️ DETENER BARRIDO" : "▶ BARRIDO CONTINUO"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: SEISMIC RESCUE */}
                    {activeTab === "seismic" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                        TRIANGULACIÓN SÍSMICA DE GOLPETEOS TDoA
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                        Localización hiperbólica bajo escombros mediante diferencias de tiempo de arribo (TDoA).
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    {nodes.length > 0 && (
                                        <button
                                            onClick={handleClearSeismicNodes}
                                            style={{
                                                padding: "5px 10px", borderRadius: "8px",
                                                background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                                                color: "#FFFFFF", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer"
                                            }}
                                        >
                                            🗑️ PURGAR
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ─── MAPA 2D TÁCTICO DE GEÓFONOS & ESCOMBROS (SVG) ─── */}
                            <div style={{
                                background: "rgba(4, 8, 20, 0.95)", border: "1.5px solid rgba(255, 51, 85, 0.25)",
                                borderRadius: "16px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                                    <span>PLANO TÁCTICO USAR (CUADRÍCULA 8x6m)</span>
                                    <span>ESCALA: 1m = 25px</span>
                                </div>

                                <svg width="100%" height="160" viewBox="0 0 280 160" style={{ overflow: "visible" }}>
                                    <defs>
                                        <pattern id="gridPattern" width="25" height="25" patternUnits="userSpaceOnUse">
                                            <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.8" />
                                        </pattern>
                                        <radialGradient id="survivorGlow" cx="50%" cy="50%" r="50%">
                                            <stop offset="0%" stopColor="rgba(255, 51, 85, 0.8)" />
                                            <stop offset="100%" stopColor="rgba(255, 51, 85, 0.05)" />
                                        </radialGradient>
                                    </defs>

                                    <rect width="280" height="160" fill="url(#gridPattern)" />

                                    {/* Ejes de Referencia */}
                                    <line x1="30" y1="130" x2="260" y2="130" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
                                    <line x1="30" y1="15" x2="30" y2="130" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />

                                    {/* Sensores Geófonos */}
                                    {nodes.map((n, idx) => {
                                        const px = 30 + n.xMeters * 25;
                                        const py = 130 - n.yMeters * 20;
                                        return (
                                            <g key={n.id}>
                                                <rect
                                                    x={px - 6} y={py - 6} width="12" height="12"
                                                    fill="#FFB300" stroke="#FFFFFF" strokeWidth="1.5" rx="2"
                                                />
                                                <text x={px} y={py + 15} fill="#FFB300" fontSize="7" textAnchor="middle" fontWeight="900">
                                                    {n.name}
                                                </text>
                                            </g>
                                        );
                                    })}

                                    {/* Superviviente Triangulado */}
                                    {seismicResult && (
                                        (() => {
                                            const sx = 30 + seismicResult.estimatedX * 25;
                                            const sy = 130 - seismicResult.estimatedY * 20;
                                            return (
                                                <g>
                                                    <circle cx={sx} cy={sy} r="25" fill="url(#survivorGlow)" />
                                                    <circle cx={sx} cy={sy} r="8" fill="#FF3355" stroke="#FFFFFF" strokeWidth="2" />
                                                    <text x={sx} y={sy - 12} fill="#FF3355" fontSize="8" textAnchor="middle" fontWeight="900">
                                                        🎯 VÍCTIMA (-{seismicResult.estimatedDepthMeters}m)
                                                    </text>
                                                </g>
                                            );
                                        })()
                                    )}
                                </svg>
                            </div>

                            {/* ─── PANEL DE GEÓFONO LOCAL EN VIVO (ACELERÓMETRO FÍSICO) ─── */}
                            <div style={{
                                background: "rgba(0, 0, 0, 0.4)", border: "1px solid rgba(255, 51, 85, 0.3)",
                                borderRadius: "14px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.72rem", color: "#FF3355", fontWeight: 900 }}>
                                        🎙️ MODO GEÓFONO LOCAL EN VIVO (ESTE DISPOSITIVO)
                                    </span>
                                    <span style={{
                                        fontSize: "0.62rem", fontWeight: 900, padding: "2px 6px", borderRadius: "5px",
                                        background: isListeningGeophone ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.05)",
                                        color: isListeningGeophone ? "#00E676" : "var(--text-secondary)",
                                        border: `1px solid ${isListeningGeophone ? '#00E676' : 'rgba(255,255,255,0.1)'}50`
                                    }}>
                                        {isListeningGeophone ? "● ACTIVO (ESCUCHANDO IMPACTOS)" : "○ EN ESPERA"}
                                    </span>
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                    <div>Vibración Cinética: <strong style={{ color: currentVibrationG > 0.5 ? "#FFB300" : "#00E5FF" }}>{currentVibrationG} G</strong></div>
                                    {lastImpact && (
                                        <div style={{ color: "#00E676" }}>
                                            Último Impacto: +{lastImpact.amplitudeG}G ({new Date(lastImpact.timestamp).toLocaleTimeString()})
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <button
                                        onClick={() => {
                                            setIsListeningGeophone(!isListeningGeophone);
                                            TacticalAudioEngine.playTap();
                                            toast.info(isListeningGeophone ? "Geófono local detenido" : "Geófono local activo: coloque el teléfono sobre la losa o escombros.");
                                        }}
                                        style={{
                                            flex: 1, padding: "10px", borderRadius: "10px",
                                            background: isListeningGeophone ? "rgba(255, 51, 85, 0.2)" : "rgba(0, 230, 118, 0.2)",
                                            border: `1.5px solid ${isListeningGeophone ? '#FF3355' : '#00E676'}`,
                                            color: isListeningGeophone ? "#FF3355" : "#00E676",
                                            fontWeight: 900, fontSize: "0.76rem", cursor: "pointer"
                                        }}
                                    >
                                        {isListeningGeophone ? "⏹️ DETENER ESCUCHA GEÓFONO" : "▶️ ACTIVAR ESCUCHA GEÓFONO"}
                                    </button>
                                </div>
                            </div>

                            {/* Controles de Acción Sísmica */}
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                <button
                                    onClick={handleDeployUsarTriangle}
                                    style={{
                                        flex: 1, minWidth: "140px", padding: "11px", borderRadius: "12px",
                                        background: "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(200, 20, 50, 0.15) 100%)",
                                        border: "1.5px solid #FF3355", color: "#FF3355",
                                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    📐 DESPLEGAR TRIÁNGULO USAR
                                </button>
                                <button
                                    onClick={handleSimulateSurvivorTap}
                                    style={{
                                        flex: 1, minWidth: "140px", padding: "11px", borderRadius: "12px",
                                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                        border: "none", color: "#FFFFFF",
                                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer",
                                        boxShadow: "0 0 16px rgba(255, 51, 85, 0.35)"
                                    }}
                                >
                                    🪨 SIMULAR GOLPETEO RESCATE
                                </button>
                            </div>

                            {seismicResult && (
                                <div style={{
                                    background: "rgba(255, 51, 85, 0.15)", border: "1.5px solid #FF3355",
                                    borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px"
                                }}>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#FF3355" }}>
                                        🪨 SUPERVIVIENTE DETECTADO:
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace" }}>
                                        Posición Relativa: X={seismicResult.estimatedX}m, Y={seismicResult.estimatedY}m (Profundidad: {seismicResult.estimatedDepthMeters}m)
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                        Confianza TDoA: {(seismicResult.confidencePct * 100).toFixed(0)}% · Nodos usados: {seismicResult.nodesUsed} · Patrón: {seismicResult.patternType}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                                        <button
                                            onClick={handleNavigateToVictim}
                                            style={{
                                                flex: 1, minWidth: "130px", padding: "9px 12px", borderRadius: "10px",
                                                background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                                border: "none", color: "#000000",
                                                fontWeight: 900, fontSize: "0.76rem", cursor: "pointer",
                                                boxShadow: "0 0 12px rgba(0, 229, 255, 0.3)"
                                            }}
                                        >
                                            🧭 NAVEGAR A VÍCTIMA
                                        </button>
                                        <button
                                            onClick={handleBroadcastVictimSos}
                                            style={{
                                                flex: 1, minWidth: "130px", padding: "9px 12px", borderRadius: "10px",
                                                background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                                border: "none", color: "#FFFFFF",
                                                fontWeight: 900, fontSize: "0.76rem", cursor: "pointer",
                                                boxShadow: "0 0 12px rgba(255, 51, 85, 0.35)"
                                            }}
                                        >
                                            🚨 DIFUNDIR SOS
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{
                                padding: "12px 14px",
                                background: "rgba(255, 51, 85, 0.08)",
                                border: "1px solid rgba(255, 51, 85, 0.25)",
                                borderRadius: "12px",
                                display: "flex",
                                alignItems: "center",
                                gap: "10px"
                            }}>
                                <span style={{ fontSize: "1.3rem" }}>🪨</span>
                                <div style={{ fontSize: "0.72rem", color: "#DDD", lineHeight: 1.4 }}>
                                    <strong style={{ color: "#FF3355" }}>Protocolo INSARAG / USAR:</strong> Coloque los nodos sobre la losa o escombros. Los impactos físicos por golpes de superviviente son registrados en microsegundos y triangulados por TDoA.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: STRUCTURAL HEALTH */}
                    {activeTab === "structural" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 179, 0, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFB300" }}>
                                        MONITOR DE INTEGRIDAD ESTRUCTURAL
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                        Alerta temprana de colapso en túneles, edificios dañados y puentes.
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.68rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                                    background: structTelemetry.isSensorAvailable ? "rgba(0,230,118,0.15)" : "rgba(255,179,0,0.15)",
                                    color: structTelemetry.isSensorAvailable ? "#00E676" : "#FFB300",
                                    border: `1px solid ${structTelemetry.isSensorAvailable ? "#00E676" : "#FFB300"}`
                                }}>
                                    {structTelemetry.isSensorAvailable ? "● Acelerómetro Activo" : "○ Sensor en Espera"}
                                </span>
                            </div>

                            {/* Tacómetro Visual de Integridad */}
                            <div style={{
                                background: "rgba(0,0,0,0.4)", borderRadius: "16px", padding: "14px",
                                border: "1px solid rgba(255, 179, 0, 0.2)", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", fontWeight: 900 }}>
                                    <span style={{ color: "var(--text-secondary)" }}>ESTABILIDAD ESTRUCTURAL:</span>
                                    <span style={{
                                        color: structTelemetry.structuralIntegrityPct > 70 ? "#00E676" : structTelemetry.structuralIntegrityPct > 40 ? "#FFB300" : "#FF3355"
                                    }}>
                                        {structTelemetry.structuralIntegrityPct}%
                                    </span>
                                </div>
                                <div style={{ width: "100%", height: "10px", background: "rgba(255,255,255,0.08)", borderRadius: "6px", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${structTelemetry.structuralIntegrityPct}%`, height: "100%",
                                        background: structTelemetry.structuralIntegrityPct > 70
                                            ? "linear-gradient(90deg, #00E676, #00B0FF)"
                                            : structTelemetry.structuralIntegrityPct > 40
                                                ? "linear-gradient(90deg, #FFB300, #FF8008)"
                                                : "linear-gradient(90deg, #FF3355, #E8213A)",
                                        transition: "width 0.3s ease"
                                    }} />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>INTEGRIDAD ESTRUCTURAL</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: structTelemetry.structuralIntegrityPct > 70 ? "#00E676" : structTelemetry.structuralIntegrityPct > 40 ? "#FFB300" : "#FF3355" }}>
                                        {structTelemetry.structuralIntegrityPct}%
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>ÍNDICE DE COLAPSO</div>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: structTelemetry.collapseRiskLevel === "SAFE" ? "#00E676" : "#FF3355" }}>
                                        {structTelemetry.collapseRiskLevel}
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>FRECUENCIA f₀ ACTUAL</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#38BDF8" }}>
                                        {structTelemetry.dominantFrequencyHz} <span style={{ fontSize: "0.7rem" }}>Hz</span>
                                    </div>
                                </div>
                                <div style={{ padding: "12px", background: "rgba(0,0,0,0.5)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>f₀ LÍNEA BASE</div>
                                    <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#AAA" }}>
                                        {structTelemetry.baselineFrequencyHz} <span style={{ fontSize: "0.7rem" }}>Hz</span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "10px" }}>
                                <button
                                    onClick={handleToggleStructuralMonitoring}
                                    style={{
                                        flex: 1, padding: "10px", borderRadius: "10px",
                                        background: structTelemetry.isMonitoring ? "rgba(255,51,85,0.2)" : "rgba(0,230,118,0.2)",
                                        border: `1.5px solid ${structTelemetry.isMonitoring ? "#FF3355" : "#00E676"}`,
                                        color: structTelemetry.isMonitoring ? "#FF3355" : "#00E676",
                                        fontWeight: 800, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    {structTelemetry.isMonitoring ? "⏹️ Detener Monitoreo" : "▶️ Iniciar Monitoreo"}
                                </button>
                                <button
                                    onClick={handleCalibrateStructuralBaseline}
                                    style={{
                                        padding: "10px 14px", borderRadius: "10px",
                                        background: "rgba(255,179,0,0.15)", border: "1.5px solid #FFB300",
                                        color: "#FFB300", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    🎯 Calibrar f₀ Base
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { celestialNav, CelestialEphemeris } from "../lib/sensors/CelestialNavigationEngine";
import { pedestrianDeadReckoning, PdrState } from "../lib/sensors/PedestrianDeadReckoningEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";

export function CelestialPdrModal() {
    const { navigate, goBack } = useRedStore();

    const [activeTab, setActiveTab] = useState<"celestial" | "pdr">("celestial");
    const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 0, lon: 0 });
    const [ephemeris, setEphemeris] = useState<CelestialEphemeris>(() => celestialNav.calculateEphemeris(0, 0));
    const [pdr, setPdr] = useState<PdrState>(() => pedestrianDeadReckoning.getState());

    // Solar Noon calculation inputs
    const [transitTimeStr, setTransitTimeStr] = useState<string>(() => {
        const d = new Date();
        return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
    });
    const [maxSunAltitude, setMaxSunAltitude] = useState<number>(() => Math.max(0, Math.round(ephemeris.sun?.altitudeDeg || 45)));
    const [estimatedCoords, setEstimatedCoords] = useState<{ estimatedLat: number; estimatedLon: number } | null>(null);

    // Sextante Digital (Inclinómetro de Hardware)
    const [isMeasuringPitch, setIsMeasuringPitch] = useState(false);
    const [livePitch, setLivePitch] = useState<number | null>(null);

    // Zancada PDR ajustable
    const [strideLength, setStrideLength] = useState<number>(0.75);

    // ── Interceptor LIFO Android Back Button ──────────────────────────────
    useEffect(() => {
        return BackHandlerRegistry.register(() => {
            if (isMeasuringPitch) {
                setIsMeasuringPitch(false);
                return true;
            }
            if (activeTab !== "celestial") {
                setActiveTab("celestial");
                return true;
            }
            goBack();
            return true;
        });
    }, [isMeasuringPitch, activeTab, goBack]);

    // ── Sincronización GPS & Efemérides en Tiempo Real ───────────────────
    useEffect(() => {
        let isMounted = true;
        let unsubGps: (() => void) | null = null;
        import("../lib/sensors/TacticalLocationEngine").then(({ TacticalLocationEngine }) => {
            if (!isMounted) return;
            unsubGps = TacticalLocationEngine.watchLocation((loc) => {
                if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                    setCoords({ lat: loc.lat!, lon: loc.lon! });
                    setEphemeris(celestialNav.calculateEphemeris(loc.lat!, loc.lon!));
                }
            });
        });

        const interval = setInterval(() => {
            setEphemeris(celestialNav.calculateEphemeris(coords.lat, coords.lon));
        }, 4000);
        const unsubPdr = pedestrianDeadReckoning.subscribe(setPdr);

        return () => {
            isMounted = false;
            if (unsubGps) (unsubGps as any)();
            clearInterval(interval);
            unsubPdr();
        };
    }, [coords.lat, coords.lon]);

    // ── Sextante Digital con Acelerómetro / Sensor Inercial ──────────────
    useEffect(() => {
        if (!isMeasuringPitch) return;

        const handleOrientation = (e: DeviceOrientationEvent) => {
            if (typeof e.beta === "number" && isFinite(e.beta)) {
                // Pitch ángulo de inclinación vertical entre 0° (horizontal) y 90° (zenith)
                const pitch = Math.max(0, Math.min(90, Math.abs(Math.round(e.beta * 10) / 10)));
                setLivePitch(pitch);
            }
        };

        window.addEventListener("deviceorientation", handleOrientation);
        return () => {
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [isMeasuringPitch]);

    const handleCapturePitch = () => {
        if (livePitch !== null) {
            setMaxSunAltitude(livePitch);
            setIsMeasuringPitch(false);
            toast.success(`📐 Inclinación de sextante capturada: ${livePitch}°`);
        } else {
            toast.warning("Esperando lecturas del sensor de inclinación");
        }
    };

    const handleSetCurrentUtcTransit = () => {
        const now = new Date();
        const utcStr = `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}:${now.getUTCSeconds().toString().padStart(2, "0")}`;
        setTransitTimeStr(utcStr);
        toast.info(`⏱️ Hora tránsito UTC fijada: ${utcStr}`);
    };

    const handleCalculateSolarNoon = () => {
        const res = celestialNav.estimatePositionFromSolarNoon(transitTimeStr, maxSunAltitude);
        setEstimatedCoords(res);
        toast.success(`📍 Posición estimada: Lat ${res.estimatedLat}° · Lon ${res.estimatedLon}°`);
    };

    const handleSaveCoordsAsWaypoint = () => {
        if (!estimatedCoords) return;
        if (typeof window !== "undefined") {
            try {
                const rawWps = localStorage.getItem("red_offgrid_waypoints");
                const wps = rawWps ? JSON.parse(rawWps) : [];
                wps.unshift({
                    id: `celestial_${Date.now()}`,
                    name: `FIJACIÓN CELESTE (Sol)`,
                    lat: estimatedCoords.estimatedLat,
                    lon: estimatedCoords.estimatedLon,
                    createdAt: Date.now()
                });
                localStorage.setItem("red_offgrid_waypoints", JSON.stringify(wps.slice(0, 30)));
                localStorage.setItem("red_last_known_gps", JSON.stringify({
                    lat: estimatedCoords.estimatedLat,
                    lng: estimatedCoords.estimatedLon,
                    lon: estimatedCoords.estimatedLon,
                    timestamp: Date.now(),
                    source: "CELESTIAL_SOLAR_NOON"
                }));
                toast.success("💾 Fijación celeste almacenada en waypoints tácticos");
            } catch (e: any) {
                toast.error("Error al guardar waypoint: " + e.message);
            }
        }
    };

    const handleApplyCoordsToNavigation = () => {
        if (!estimatedCoords) return;
        if (typeof window !== "undefined") {
            try {
                handleSaveCoordsAsWaypoint();
                const target = {
                    lat: estimatedCoords.estimatedLat,
                    lon: estimatedCoords.estimatedLon,
                    name: "FIJACIÓN CELESTE",
                    type: "CELESTIAL",
                    createdAt: Date.now()
                };
                localStorage.setItem("red_active_target", JSON.stringify(target));
                localStorage.setItem("red_tactical_target_point", JSON.stringify(target));
                toast.success(`🧭 Posición celeste [${estimatedCoords.estimatedLat}°, ${estimatedCoords.estimatedLon}°] fijada. Abriendo Brújula...`);
                navigate("compass");
            } catch (e: any) {
                toast.error("Error al transferir posición: " + e.message);
            }
        }
    };

    const handleTogglePdr = () => {
        if (pdr.isTracking) {
            pedestrianDeadReckoning.stopTracking();
            toast.info("Rastreador inercial PDR pausado");
        } else {
            pedestrianDeadReckoning.startTracking();
            toast.success("🧭 Rastreador inercial PDR activado");
        }
    };

    const handleResetPdr = () => {
        pedestrianDeadReckoning.resetPdr();
        toast.info("Contador PDR restablecido a 0");
    };

    // ── Cálculo Trigonométrico para Cúpula Celeste (Sky Dome SVG) ─────────
    const domeRadius = 100;
    const domeCenter = 120;

    // Proyección cenital estereográfica: radio proporcional a (90 - altitud)
    const sunDist = (Math.max(0, 90 - Math.max(0, ephemeris.sun.altitudeDeg)) / 90) * domeRadius;
    const sunRad = (ephemeris.sun.azimuthDeg * Math.PI) / 180;
    const sunX = domeCenter + sunDist * Math.sin(sunRad);
    const sunY = domeCenter - sunDist * Math.cos(sunRad);

    const moonDist = (Math.max(0, 90 - Math.max(0, ephemeris.moon.altitudeDeg)) / 90) * domeRadius;
    const moonRad = (ephemeris.moon.azimuthDeg * Math.PI) / 180;
    const moonX = domeCenter + moonDist * Math.sin(moonRad);
    const moonY = domeCenter - moonDist * Math.cos(moonRad);

    // Vector de sombra Gnomon (opuesto al sol)
    const shadowDist = ephemeris.sun.isAboveHorizon ? Math.min(domeRadius, 25 * ephemeris.gnomonShadowRatio) : 0;
    const shadowRad = (ephemeris.gnomonShadowAzimuthDeg * Math.PI) / 180;
    const shadowX = domeCenter + shadowDist * Math.sin(shadowRad);
    const shadowY = domeCenter - shadowDist * Math.cos(shadowRad);

    // Formateador de horas UTC
    const formatUtcTime = (val: number) => {
        const h = Math.floor(val);
        const m = Math.floor((val - h) * 60);
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} UTC`;
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "#04060A", color: "var(--text-primary, #FFF)",
            fontFamily: "JetBrains Mono, monospace", display: "flex", flexDirection: "column"
        }}>
            {/* Header Táctico Responsive */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 14, 26, 0.98)",
                borderBottom: "1px solid var(--glass-border, rgba(0, 229, 255, 0.3))",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                backdropFilter: "blur(20px)", flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "10px",
                        background: "linear-gradient(135deg, #FFB300 0%, #E65100 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", boxShadow: "0 4px 14px rgba(255,179,0,0.35)", flexShrink: 0
                    }}>
                        ☀️
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#FFB300", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            NAVEGACIÓN CELESTE & PDR INERCIAL
                        </div>
                        <div style={{ fontSize: "0.64rem", color: "var(--text-muted, #AAA)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            Efemérides Sol/Luna · Bóveda J2000 · Brújula Solar GPS-Denied
                        </div>
                    </div>
                </div>
                <button
                    onClick={goBack}
                    className="btn-icon"
                    style={{ width: 34, height: 34, flexShrink: 0 }}
                    title="Cerrar ventana"
                >
                    ✕
                </button>
            </div>

            {/* Selector de Pestañas Táctico */}
            <div style={{
                display: "flex", background: "rgba(12, 16, 28, 0.95)",
                padding: "6px 14px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("celestial")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "celestial" ? "var(--accent-amber, #FFB300)" : "transparent",
                        color: activeTab === "celestial" ? "#000" : "var(--text-muted, #AAA)", border: "none", cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    ☀️ Cúpula Celeste & Tránsito
                </button>
                <button
                    onClick={() => setActiveTab("pdr")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "pdr" ? "var(--accent-cyan, #00E5FF)" : "transparent",
                        color: activeTab === "pdr" ? "#000" : "var(--text-muted, #AAA)", border: "none", cursor: "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    🧭 Inercial PDR ({pdr.totalSteps}p)
                </button>
            </div>

            {/* Cuerpo de Contenido Scrollable */}
            <div style={{
                flex: 1, overflowY: "auto", padding: "14px 16px",
                display: "flex", flexDirection: "column", gap: "12px",
                maxWidth: "600px", margin: "0 auto", width: "100%", boxSizing: "border-box"
            }}>
                {/* ── TAB 1: EFEMÉRIDES & CÚPULA CELESTE ── */}
                {activeTab === "celestial" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        
                        {/* Cúpula Visual Táctica Celeste (Sky Dome Radar SVG) */}
                        <div className="card-tactical" style={{
                            padding: "12px", display: "flex", flexDirection: "column", alignItems: "center",
                            background: "rgba(10, 14, 26, 0.92)", border: "1px solid var(--glass-border, rgba(0, 229, 255, 0.25))",
                            borderRadius: "14px"
                        }}>
                            <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "var(--accent-cyan, #00E5FF)", marginBottom: "6px", letterSpacing: "0.5px" }}>
                                PROYECCIÓN CENITAL DE BÓVEDA CELESTE (360° AZIMUT / 90° CÉNIT)
                            </div>
                            
                            <svg width="240" height="240" viewBox="0 0 240 240" style={{ overflow: "visible" }}>
                                {/* Círculo Exterior del Horizonte (0° elevación) */}
                                <circle cx={domeCenter} cy={domeCenter} r={domeRadius} fill="rgba(0, 20, 35, 0.7)" stroke="#00E5FF" strokeWidth="1.5" />
                                
                                {/* Anillos de Elevación Concéntricos: 30° y 60° */}
                                <circle cx={domeCenter} cy={domeCenter} r={domeRadius * 0.66} fill="none" stroke="rgba(0, 229, 255, 0.25)" strokeDasharray="3 3" />
                                <circle cx={domeCenter} cy={domeCenter} r={domeRadius * 0.33} fill="none" stroke="rgba(0, 229, 255, 0.25)" strokeDasharray="3 3" />
                                
                                {/* Cénit Central (90°) */}
                                <circle cx={domeCenter} cy={domeCenter} r="2.5" fill="#00E5FF" />
                                <text x={domeCenter + 4} y={domeCenter - 4} fontSize="8" fill="rgba(0, 229, 255, 0.7)" fontWeight="700">90°</text>

                                {/* Ejes Cardinales */}
                                <line x1={domeCenter} y1={domeCenter - domeRadius} x2={domeCenter} y2={domeCenter + domeRadius} stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1" />
                                <line x1={domeCenter - domeRadius} y1={domeCenter} x2={domeCenter + domeRadius} y2={domeCenter} stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1" />
                                
                                {/* Puntos Cardinales */}
                                <text x={domeCenter} y={domeCenter - domeRadius - 6} textAnchor="middle" fontSize="11" fontWeight="900" fill="#FFB300">N</text>
                                <text x={domeCenter + domeRadius + 10} y={domeCenter + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#00E5FF">E</text>
                                <text x={domeCenter} y={domeCenter + domeRadius + 14} textAnchor="middle" fontSize="10" fontWeight="900" fill="#00E5FF">S</text>
                                <text x={domeCenter - domeRadius - 10} y={domeCenter + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#00E5FF">W</text>

                                {/* Vector de Sombra Gnomon */}
                                {ephemeris.sun.isAboveHorizon && (
                                    <>
                                        <line x1={domeCenter} y1={domeCenter} x2={shadowX} y2={shadowY} stroke="#FF3355" strokeWidth="2" strokeDasharray="4 2" />
                                        <circle cx={shadowX} cy={shadowY} r="3" fill="#FF3355" />
                                    </>
                                )}

                                {/* Vector Radial del Sol */}
                                {ephemeris.sun.isAboveHorizon && (
                                    <line x1={domeCenter} y1={domeCenter} x2={sunX} y2={sunY} stroke="rgba(255, 179, 0, 0.4)" strokeWidth="1.2" />
                                )}

                                {/* Posición del Sol ☀️ */}
                                <g transform={`translate(${sunX}, ${sunY})`}>
                                    <circle r={ephemeris.sun.isAboveHorizon ? 9 : 6} fill={ephemeris.sun.isAboveHorizon ? "#FFB300" : "rgba(255, 179, 0, 0.25)"} stroke="#FFF" strokeWidth="1.5" />
                                    <text y="3" textAnchor="middle" fontSize="9" fontWeight="900" fill="#000">☀️</text>
                                </g>

                                {/* Posición de la Luna 🌙 */}
                                <g transform={`translate(${moonX}, ${moonY})`}>
                                    <circle r={ephemeris.moon.isAboveHorizon ? 8 : 5} fill={ephemeris.moon.isAboveHorizon ? "#00E5FF" : "rgba(0, 229, 255, 0.2)"} stroke="#FFF" strokeWidth="1" />
                                    <text y="3" textAnchor="middle" fontSize="8" fontWeight="900" fill="#000">🌙</text>
                                </g>

                                {/* Estrella Polar (Polaris) en Norte */}
                                {ephemeris.polarisAltitudeDeg > 0 && (
                                    <g transform={`translate(${domeCenter}, ${domeCenter - (ephemeris.polarisAltitudeDeg / 90) * domeRadius})`}>
                                        <polygon points="0,-4 3,3 -3,3" fill="#00E676" />
                                        <text x="5" y="2" fontSize="7" fill="#00E676" fontWeight="700">Polaris</text>
                                    </g>
                                )}
                            </svg>

                            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: "6px", fontSize: "0.65rem", color: "var(--text-muted, #AAA)" }}>
                                <span>☀️ Sol: {ephemeris.sun.azimuthDeg}° (El: {ephemeris.sun.altitudeDeg}°)</span>
                                <span>🌙 Luna: {ephemeris.moon.azimuthDeg}° (El: {ephemeris.moon.altitudeDeg}°)</span>
                            </div>
                        </div>

                        {/* Banner de Iluminación Táctica y Horas de Luz */}
                        <div style={{
                            background: "rgba(14, 18, 30, 0.7)", border: "1px solid var(--glass-border, rgba(255, 255, 255, 0.08))",
                            borderRadius: "12px", padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.58rem", color: "var(--text-muted, #AAA)", fontWeight: 700 }}>ILUMINACIÓN TÁCTICA</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--accent-cyan, #00E5FF)", marginTop: "2px" }}>
                                    {ephemeris.tacticalLightingState.replace(/_/g, " ")}
                                </div>
                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted, #AAA)" }}>
                                    {ephemeris.isDaylight ? "☀️ Operación Diurna" : "🌌 Modo Visión Nocturna / Sigilo"}
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "0.58rem", color: "var(--text-muted, #AAA)", fontWeight: 700 }}>VENTANA SOLAR UTC</div>
                                <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "#FFB300", marginTop: "2px" }}>
                                    🌅 {formatUtcTime(ephemeris.sunriseUtcHours)}
                                </div>
                                <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "var(--accent-crimson, #FF3355)" }}>
                                    🌇 {formatUtcTime(ephemeris.sunsetUtcHours)}
                                </div>
                            </div>
                        </div>

                        {/* Estimador de Coordenadas por Mediodía Solar con Sextante Digital */}
                        <div className="card-tactical" style={{
                            background: "rgba(10, 14, 26, 0.95)", border: "1px solid rgba(255, 179, 0, 0.3)",
                            borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.78rem", fontWeight: 900, color: "#FFB300" }}>
                                    📐 SEXTANTE & ESTIMADOR DE MEDIODÍA SOLAR
                                </div>
                                <button
                                    onClick={handleSetCurrentUtcTransit}
                                    style={{
                                        background: "rgba(255, 179, 0, 0.15)", border: "1px solid rgba(255, 179, 0, 0.4)",
                                        color: "#FFB300", padding: "3px 8px", borderRadius: "6px", fontSize: "0.65rem",
                                        fontWeight: 800, cursor: "pointer"
                                    }}
                                >
                                    ⏱️ Fijar UTC Actual
                                </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <div>
                                    <label style={{ fontSize: "0.62rem", color: "var(--text-muted, #AAA)", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                                        HORA TRÁNSITO CÉNIT (UTC):
                                    </label>
                                    <input
                                        type="text"
                                        value={transitTimeStr}
                                        onChange={(e) => setTransitTimeStr(e.target.value)}
                                        placeholder="12:00:00"
                                        style={{
                                            width: "100%", padding: "7px 10px", borderRadius: "6px",
                                            background: "rgba(0,0,0,0.6)", color: "#FFF",
                                            border: "1px solid rgba(255,255,255,0.2)", fontSize: "0.74rem",
                                            boxSizing: "border-box", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.62rem", color: "var(--text-muted, #AAA)", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                                        ELEVACIÓN MÁXIMA (°):
                                    </label>
                                    <input
                                        type="number"
                                        value={maxSunAltitude}
                                        onChange={(e) => setMaxSunAltitude(parseFloat(e.target.value) || 0)}
                                        style={{
                                            width: "100%", padding: "7px 10px", borderRadius: "6px",
                                            background: "rgba(0,0,0,0.6)", color: "#FFF",
                                            border: "1px solid rgba(255,255,255,0.2)", fontSize: "0.74rem",
                                            boxSizing: "border-box", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Control del Sextante Inclinómetro */}
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    onClick={() => setIsMeasuringPitch(!isMeasuringPitch)}
                                    style={{
                                        flex: 1, padding: "8px", borderRadius: "8px",
                                        background: isMeasuringPitch ? "rgba(0, 229, 255, 0.25)" : "rgba(255, 255, 255, 0.06)",
                                        border: `1px solid ${isMeasuringPitch ? "var(--accent-cyan, #00E5FF)" : "rgba(255, 255, 255, 0.15)"}`,
                                        color: isMeasuringPitch ? "var(--accent-cyan, #00E5FF)" : "var(--text-primary, #FFF)",
                                        fontSize: "0.72rem", fontWeight: 800, cursor: "pointer"
                                    }}
                                >
                                    {isMeasuringPitch ? `📐 Inclinómetro: ${livePitch ?? 0}°` : "📐 Activar Sextante de Hardware"}
                                </button>
                                {isMeasuringPitch && (
                                    <button
                                        onClick={handleCapturePitch}
                                        style={{
                                            padding: "8px 12px", borderRadius: "8px",
                                            background: "var(--accent-emerald, #00E676)", color: "#000",
                                            fontWeight: 900, fontSize: "0.72rem", border: "none", cursor: "pointer"
                                        }}
                                    >
                                        ✓ Capturar
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={handleCalculateSolarNoon}
                                className="btn-tactical-primary"
                                style={{ padding: "10px", fontSize: "0.80rem", background: "#FFB300", color: "#000", fontWeight: 900 }}
                            >
                                📍 CALCULAR LAT/LON CELESTE (SIN GPS)
                            </button>

                            {/* Resultado del Cálculo y Botón de Aplicación */}
                            {estimatedCoords && (
                                <div style={{
                                    background: "rgba(0,230,118,0.12)", border: "1px solid var(--accent-emerald, #00E676)",
                                    padding: "10px", borderRadius: "10px", display: "flex", flexDirection: "column", gap: "8px"
                                }}>
                                    <div style={{ fontSize: "0.76rem", color: "var(--accent-emerald, #00E676)", fontWeight: 800, textAlign: "center" }}>
                                        Lat: {estimatedCoords.estimatedLat}° · Lon: {estimatedCoords.estimatedLon}°
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={handleSaveCoordsAsWaypoint}
                                            style={{
                                                flex: 1, padding: "8px", fontSize: "0.74rem",
                                                background: "rgba(0, 230, 118, 0.15)", border: "1px solid #00E676",
                                                color: "#00E676", borderRadius: "8px", fontWeight: 800, cursor: "pointer"
                                            }}
                                        >
                                            💾 Guardar Waypoint
                                        </button>
                                        <button
                                            onClick={handleApplyCoordsToNavigation}
                                            className="btn-tactical-primary"
                                            style={{ flex: 1, padding: "8px", fontSize: "0.74rem" }}
                                        >
                                            🧭 Brújula / Mapa
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── TAB 2: INERCIAL PEDESTRIAN DEAD RECKONING ── */}
                {activeTab === "pdr" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <div className="card-tactical" style={{
                                background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.25)",
                                borderRadius: "12px", padding: "12px"
                            }}>
                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted, #AAA)", fontWeight: 700 }}>PASOS & DISTANCIA</div>
                                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--accent-cyan, #00E5FF)", marginTop: "2px" }}>
                                    {pdr.totalSteps} <span style={{ fontSize: "0.8rem" }}>pasos</span>
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted, #AAA)", marginTop: "2px" }}>
                                    {pdr.distanceMeters}m ({pdr.averageSpeedMps} m/s)
                                </div>
                            </div>
                            <div className="card-tactical" style={{
                                background: "rgba(0, 230, 118, 0.08)", border: "1px solid rgba(0, 230, 118, 0.25)",
                                borderRadius: "12px", padding: "12px"
                            }}>
                                <div style={{ fontSize: "0.62rem", color: "var(--text-muted, #AAA)", fontWeight: 700 }}>DESPLAZAMIENTO 2D</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-emerald, #00E676)", marginTop: "2px" }}>
                                    N: {pdr.displacementNorthMeters}m · E: {pdr.displacementEastMeters}m
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#FFB300", marginTop: "2px", fontWeight: 800 }}>
                                    🧭 Rumbo: {pdr.currentHeadingDeg}°
                                </div>
                            </div>
                        </div>

                        {/* Selector de Longitud de Zancada */}
                        <div style={{
                            background: "rgba(14, 18, 30, 0.7)", border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
                            borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px"
                        }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted, #AAA)", fontWeight: 700 }}>
                                CALIBRACIÓN DE ZANCADA TÁCTICA:
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                                {[
                                    { val: 0.65, label: "0.65m (Sigilo)" },
                                    { val: 0.75, label: "0.75m (Táctico)" },
                                    { val: 0.85, label: "0.85m (Marcha)" }
                                ].map(s => (
                                    <button
                                        key={s.val}
                                        onClick={() => {
                                            setStrideLength(s.val);
                                            toast.info(`Zancada ajustada a ${s.val}m`);
                                        }}
                                        style={{
                                            padding: "6px", borderRadius: "6px",
                                            background: strideLength === s.val ? "var(--accent-cyan, #00E5FF)" : "rgba(255,255,255,0.06)",
                                            color: strideLength === s.val ? "#000" : "var(--text-primary, #FFF)",
                                            fontWeight: 800, fontSize: "0.68rem", border: "none", cursor: "pointer"
                                        }}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Botones de Control Inercial */}
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={handleTogglePdr}
                                style={{
                                    flex: 2, padding: "12px", borderRadius: "10px",
                                    background: pdr.isTracking ? "rgba(232,33,58,0.2)" : "rgba(0,230,118,0.2)",
                                    border: `1px solid ${pdr.isTracking ? "var(--accent-crimson, #FF3355)" : "var(--accent-emerald, #00E676)"}`,
                                    color: pdr.isTracking ? "var(--accent-crimson, #FF3355)" : "var(--accent-emerald, #00E676)",
                                    fontWeight: 900, fontSize: "0.80rem", cursor: "pointer"
                                }}
                            >
                                {pdr.isTracking ? "⏸ PAUSAR PDR INERCIAL" : "▶ INICIAR RASTREO FÍSICO"}
                            </button>
                            <button
                                onClick={handleResetPdr}
                                style={{
                                    flex: 1, padding: "12px", borderRadius: "10px",
                                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                                    color: "var(--text-muted, #AAA)", fontWeight: 800, fontSize: "0.75rem", cursor: "pointer"
                                }}
                            >
                                ↺ RESET
                            </button>
                        </div>

                        {/* Enlace al Mapa */}
                        <button
                            onClick={() => navigate("nodemap")}
                            className="btn-tactical-secondary"
                            style={{ padding: "10px", fontSize: "0.76rem" }}
                        >
                            🗺️ Ver Vector Inercial en Mapa Táctico Offline
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

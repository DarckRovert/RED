"use client";

import React, { useState, useEffect } from "react";
import { tacticalRdf, TargetSignalType } from "../lib/sensors/TacticalRdfEngine";
import { rdfTriangulation, LineOfBearing, RdfTargetFix } from "../lib/sensors/RdfTriangulationEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export function TacticalFoxhuntModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"rdf" | "triangulation">("rdf");

    // RDF State
    const [rdfState, setRdfState] = useState(() => tacticalRdf.getState());
    const [currentHeading, setCurrentHeading] = useState<number>(0);
    const [currentRssi, setCurrentRssi] = useState<number>(-65);
    const [coords, setCoords] = useState<{ lat: number; lon: number }>({ lat: 0, lon: 0 });

    // Triangulation State
    const [triangState, setTriangState] = useState(() => rdfTriangulation.getState());

    useEffect(() => {
        const unsubRdf = tacticalRdf.subscribe(setRdfState);
        const unsubTriang = rdfTriangulation.subscribe(setTriangState);

        // Live Device Orientation / Compass Listener
        const handleOrientation = (e: any) => {
            const heading = e.webkitCompassHeading ?? (e.alpha !== null ? (360 - e.alpha) % 360 : null);
            if (heading !== null && !isNaN(heading)) {
                setCurrentHeading(Math.round(heading));
            }
        };

        window.addEventListener("deviceorientation", handleOrientation, true);
        window.addEventListener("deviceorientationabsolute" as any, handleOrientation, true);

        // Live Geolocation for RDF fixes
        let unsubGps: (() => void) | null = null;
        import("../lib/sensors/TacticalLocationEngine").then(({ TacticalLocationEngine }) => {
            unsubGps = TacticalLocationEngine.watchLocation((loc) => {
                if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                    setCoords({ lat: loc.lat!, lon: loc.lon! });
                }
            });
        });

        return () => {
            if (unsubGps) (unsubGps as any)();
            unsubRdf();
            unsubTriang();
            window.removeEventListener("deviceorientation", handleOrientation, true);
            window.removeEventListener("deviceorientationabsolute" as any, handleOrientation, true);
        };
    }, []);

    const handleRecordSample = () => {
        tacticalRdf.recordSample(currentHeading, currentRssi);
        toast.info(`Muestreo registrado: ${currentHeading}° a ${currentRssi} dBm`);
    };

    const handleAddCurrentLob = () => {
        const peak = tacticalRdf.getPeakBearing();
        const lob = rdfTriangulation.addBearing(coords.lat, coords.lon, peak.peakHeadingDeg || currentHeading, peak.peakRssiDbm || currentRssi);
        toast.success(`🎯 Marcación LOB añadida: ${lob.bearingDeg}° (GPS: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`);
    };

    const handleTriangulate = () => {
        const fix = rdfTriangulation.triangulateTarget();
        if (fix) {
            toast.success(`🎯 Objetivo fijado con ${fix.lobsUsed} marcaciones LOB`);
        } else {
            toast.info("Se requieren al menos 2 marcaciones LOB para triangular");
        }
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
                    }}>🦊</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            RADIOGONIOMETRÍA & CAZA FOXHUNT
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            LOCALIZACIÓN RDF & TRIANGULACIÓN LOB
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        onClick={handleTriangulate}
                        style={{
                            padding: "6px 12px", borderRadius: "10px",
                            background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                            color: "#00E5FF", fontSize: "0.74rem", fontWeight: 900, cursor: "pointer"
                        }}
                    >
                        🎯 TRIANGULAR
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("rdf")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "rdf" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "rdf" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "rdf" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🧭</span> RADIOGONIOMETRÍA POLAR
                </button>
                <button
                    onClick={() => setActiveTab("triangulation")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "triangulation" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "triangulation" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "triangulation" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🎯</span> TRIANGULACIÓN LOB ({triangState.lobs.length})
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: POLAR RDF */}
                    {activeTab === "rdf" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div>
                                <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900, display: "block", marginBottom: "4px" }}>
                                    TIPO DE EMISOR A CAZAR (SIGINT)
                                </label>
                                <select
                                    value={rdfState.targetType}
                                    onChange={(e: any) => tacticalRdf.setTargetType(e.target.value)}
                                    style={{
                                        width: "100%", padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.82rem", outline: "none", fontFamily: "JetBrains Mono, monospace"
                                    }}
                                >
                                    <option value="EMERGENCY_BEACON">Baliza de Emergencia SOS / Amiga</option>
                                    <option value="CLANDESTINE_TRANSMITTER">Transmisor Clandestino / Emisor Espía</option>
                                    <option value="ROGUE_JAMMER">Jammer RF / Inhibidor Hostil</option>
                                    <option value="DRONE_UAV_LINK">Enlace C2 de Dron UAV</option>
                                </select>
                            </div>

                            {/* Peak Bearing Card */}
                            <div style={{
                                background: "rgba(0, 229, 255, 0.08)", border: "1.5px solid rgba(0, 229, 255, 0.3)",
                                borderRadius: "16px", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center"
                            }}>
                                <div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>RUMBO ESTIMADO DEL OBJETIVO:</div>
                                    <div style={{ fontSize: "2rem", fontWeight: 900, color: "#00E5FF", marginTop: "2px" }}>
                                        {rdfState.peakBearing.peakHeadingDeg}°
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                        Potencia Máxima: <span style={{ color: "#00E676", fontWeight: 900 }}>{rdfState.peakBearing.peakRssiDbm} dBm</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddCurrentLob}
                                    style={{
                                        padding: "10px 16px", borderRadius: "10px",
                                        background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        border: "none", color: "#000000", fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    + FIJAR LOB
                                </button>
                            </div>

                            {/* Sampling Controls */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 900, color: "#FFFFFF" }}>CALIBRACIÓN DE MUESTREO MANUAL</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <div>
                                        <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>RUMBO ({currentHeading}°)</label>
                                        <input
                                            type="range" min="0" max="359" value={currentHeading}
                                            onChange={e => setCurrentHeading(Number(e.target.value))}
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>RSSI ({currentRssi} dBm)</label>
                                        <input
                                            type="range" min="-110" max="-30" value={currentRssi}
                                            onChange={e => setCurrentRssi(Number(e.target.value))}
                                            style={{ width: "100%" }}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleRecordSample}
                                    style={{
                                        padding: "10px", background: "rgba(255, 255, 255, 0.05)",
                                        border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                                        color: "#FFFFFF", fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    REGISTRAR MUESTRA EN VIVO
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: TRIANGULATION LOB */}
                    {activeTab === "triangulation" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {triangState.lastFix && (
                                <div style={{
                                    background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                                    border: "1.5px solid #00E676", borderRadius: "20px", padding: "18px",
                                    display: "flex", flexDirection: "column", gap: "8px",
                                    boxShadow: "0 0 25px rgba(0, 230, 118, 0.25)"
                                }}>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676" }}>
                                        🎯 POSICIÓN DE OBJETIVO FIJADA CON ÉXITO
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace" }}>
                                        Lat: {triangState.lastFix.targetLat.toFixed(5)} · Lon: {triangState.lastFix.targetLon.toFixed(5)}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                        Radio de Error: ±{triangState.lastFix.uncertaintyRadiusMeters.toFixed(1)} metros · Confianza: {triangState.lastFix.confidencePct}%
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 900, color: "#FFFFFF" }}>
                                    LÍNEAS DE MARCACIÓN (LOB) REGISTRADAS:
                                </div>
                                {triangState.lobs.length === 0 ? (
                                    <div style={{ padding: "20px", textAlign: "center", background: "rgba(14, 18, 38, 0.9)", borderRadius: "14px", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                        Sin líneas de marcación. Añade marcaciones desde la pestaña RDF.
                                    </div>
                                ) : (
                                    triangState.lobs.map(lob => (
                                        <div
                                            key={lob.id}
                                            style={{
                                                padding: "12px 14px", borderRadius: "12px",
                                                background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)",
                                                display: "flex", justifyContent: "space-between", alignItems: "center"
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#00E5FF" }}>
                                                    Marcación: {lob.bearingDeg}° ({lob.rssiDbm} dBm)
                                                </div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {lob.observerLat.toFixed(4)}, {lob.observerLon.toFixed(4)}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: "0.65rem", color: "#00E676", fontWeight: 900 }}>VÁLIDA</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

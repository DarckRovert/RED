"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { tacticalRdf, TargetSignalType, PolarSector } from "../lib/sensors/TacticalRdfEngine";
import { rdfTriangulation, LineOfBearing, RdfTargetFix } from "../lib/sensors/RdfTriangulationEngine";
import { rfSigintWatchdog, DetectedEmitter, SigintTelemetry } from "../lib/sensors/RfSigintWatchdogEngine";
import { loraBridge, LoraTelemetry } from "../lib/hardware/LoraSerialBridgeEngine";
import { tacticalCompass } from "../lib/sensors/TacticalCompassEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { meshRouter } from "../lib/mesh/meshRouter";
import { copyToClipboard } from "../lib/clipboard";
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

    // Live Target Selection & SIGINT Feed
    const [selectedTargetId, setSelectedTargetId] = useState<string>("AUTO_WATCHDOG");
    const [sigintTelemetry, setSigintTelemetry] = useState<SigintTelemetry>(() => rfSigintWatchdog.getTelemetry());
    const [availableEmitters, setAvailableEmitters] = useState<DetectedEmitter[]>(() => rfSigintWatchdog.getEmitters());
    const [loraTelemetry, setLoraTelemetry] = useState<LoraTelemetry>(() => loraBridge.getTelemetry());
    const [autoSampling, setAutoSampling] = useState<boolean>(false);
    const lastAutoSampleHeadingRef = useRef<number>(-999);

    // Triangulation State
    const [triangState, setTriangState] = useState(() => rdfTriangulation.getState());

    // Intercepción LIFO de hardware Android y Escape
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (activeTab !== "rdf") {
                setActiveTab("rdf");
                return true;
            }
            goBack();
            return true;
        });
        return () => unregister();
    }, [activeTab, goBack]);

    // Subscripción a RDF, Triangulación, Watchdog SIGINT y LoRa
    useEffect(() => {
        const unsubRdf = tacticalRdf.subscribe(setRdfState);
        const unsubTriang = rdfTriangulation.subscribe(setTriangState);
        
        // Iniciar escaneo pasivo de espectro si no está activo
        rfSigintWatchdog.startScanning().catch(() => {});
        const unsubSigint = rfSigintWatchdog.subscribe(t => {
            setSigintTelemetry(t);
            setAvailableEmitters(rfSigintWatchdog.getEmitters());
        });

        // Live LoRa packet receiver for RSSI feed
        const unbindLoraRx = loraBridge.onPacketReceived((_p, rssi) => {
            setLoraTelemetry(loraBridge.getTelemetry());
            if (selectedTargetId === "LORA_TRANSCEIVER" && rssi !== undefined && typeof rssi === "number" && isFinite(rssi)) {
                setCurrentRssi(rssi);
            }
        });

        // Telemetría unificada de orientación táctica (Giroscopio 3D + Magnetómetro + Filtro Circular)
        const unsubCompass = tacticalCompass.subscribe((telemetry) => {
            setCurrentHeading(telemetry.headingDeg);
        });

        // Live Geolocation for RDF fixes
        let isMounted = true;
        let unsubGps: (() => void) | null = null;
        import("../lib/sensors/TacticalLocationEngine").then(({ TacticalLocationEngine }) => {
            if (!isMounted) return;
            const last = TacticalLocationEngine.getLastKnownLocation();
            if (last && TacticalLocationEngine.isValidCoordinates(last.lat, last.lon)) {
                setCoords({ lat: last.lat!, lon: last.lon! });
            }
            unsubGps = TacticalLocationEngine.watchLocation((loc) => {
                if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                    setCoords({ lat: loc.lat!, lon: loc.lon! });
                }
            });
        });

        return () => {
            isMounted = false;
            if (unsubGps) (unsubGps as any)();
            unsubRdf();
            unsubTriang();
            unsubSigint();
            unbindLoraRx();
            unsubCompass();
        };
    }, [selectedTargetId]);

    // Actualización reactiva del RSSI según el objetivo seleccionado
    useEffect(() => {
        if (selectedTargetId === "MANUAL") {
            return;
        }
        if (selectedTargetId === "LORA_TRANSCEIVER") {
            if (loraTelemetry.lastRssiDbm !== null) {
                setCurrentRssi(loraTelemetry.lastRssiDbm);
            }
            return;
        }
        if (selectedTargetId === "AUTO_WATCHDOG") {
            // Priorizar dron, luego emisor sospechoso, luego el más cercano
            const target = sigintTelemetry.closestDrone || sigintTelemetry.closestSuspiciousEmitter || availableEmitters[0];
            if (target && typeof target.rssi === "number" && isFinite(target.rssi)) {
                setCurrentRssi(target.rssi);
            }
            return;
        }

        // Buscar emisor específico por deviceId
        const match = availableEmitters.find(e => e.deviceId === selectedTargetId);
        if (match && typeof match.rssi === "number" && isFinite(match.rssi)) {
            setCurrentRssi(match.rssi);
        }
    }, [selectedTargetId, sigintTelemetry, availableEmitters, loraTelemetry]);

    // Auto-muestreo continuo al girar el dispositivo con el blanco enganchado
    useEffect(() => {
        if (!autoSampling) return;
        const diff = Math.abs(currentHeading - lastAutoSampleHeadingRef.current);
        if (diff >= 15 && diff <= 345) {
            lastAutoSampleHeadingRef.current = currentHeading;
            tacticalRdf.recordSample(currentHeading, currentRssi);
        }
    }, [autoSampling, currentHeading, currentRssi]);

    const handleRecordSample = () => {
        TacticalAudioEngine.playTap();
        tacticalRdf.recordSample(currentHeading, currentRssi);
        lastAutoSampleHeadingRef.current = currentHeading;
        toast.info(`Muestreo registrado: ${currentHeading}° a ${currentRssi} dBm`);
        // Difundir muestra RDF activa al enjambre
        meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            new TextEncoder().encode(JSON.stringify({
                id: `rdf_sample_${Date.now()}`,
                msg_type: 'RF_FOXHUNT_SAMPLE',
                bearing_deg: currentHeading,
                rssi_dbm: currentRssi,
                lat: coords.lat,
                lon: coords.lon,
                timestamp: Date.now()
            }))
        ).catch(() => {});
    };

    const handleAddCurrentLob = () => {
        if (!coords || (Math.abs(coords.lat) < 0.0001 && Math.abs(coords.lon) < 0.0001)) {
            toast.warning("Fijación GPS inválida o ausente (0,0). Espera señal de satélites antes de fijar LOB.");
            return;
        }
        const peak = tacticalRdf.getPeakBearing();
        const bearing = peak.peakHeadingDeg || currentHeading;
        const rssi = peak.peakRssiDbm || currentRssi;
        const lob = rdfTriangulation.addBearing(coords.lat, coords.lon, bearing, rssi);
        TacticalAudioEngine.playMessageSent();
        toast.success(`🎯 Marcación LOB añadida: ${lob.bearingDeg}° (GPS: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`);
        // Difundir marcación LOB al enjambre para triangulación colaborativa
        meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
            new TextEncoder().encode(JSON.stringify({
                id: `lob_${lob.id}`,
                msg_type: 'RF_FOXHUNT_LOB',
                bearing_deg: lob.bearingDeg,
                rssi_dbm: lob.rssiDbm,
                observer_lat: lob.observerLat,
                observer_lon: lob.observerLon,
                timestamp: lob.timestamp
            }))
        ).catch(() => {});
    };

    const handleNavigateToTarget = (fix: RdfTargetFix) => {
        TacticalAudioEngine.playTap();
        try {
            const target = {
                lat: fix.targetLat,
                lon: fix.targetLon,
                name: `BLANCO FOXHUNT (${fix.lobsUsed} LOBs)`,
                createdAt: Date.now(),
            };
            useRedStore.getState().setTacticalTarget(target, 'Foxhunt');
            const rawWp = localStorage.getItem("red_offgrid_waypoints");
            const wps = rawWp ? JSON.parse(rawWp) : [];
            wps.unshift({
                id: `rdf_${Date.now()}`,
                name: `BLANCO FOXHUNT (±${fix.uncertaintyRadiusMeters.toFixed(0)}m)`,
                lat: fix.targetLat,
                lon: fix.targetLon,
                createdAt: Date.now()
            });
            localStorage.setItem("red_offgrid_waypoints", JSON.stringify(wps.slice(0, 30)));
            toast.success("🎯 Blanco transferido a Brújula de Navegación Táctica");
            navigate("compass");
        } catch {
            navigate("nodemap");
        }
    };

    const handleTriangulate = () => {
        const fix = rdfTriangulation.triangulateTarget();
        if (fix) {
            toast.success(`🎯 Objetivo fijado con ${fix.lobsUsed} marcaciones LOB`);
        } else {
            toast.info("Se requieren al menos 2 marcaciones LOB para triangular");
        }
    };

    const handleClearRdf = () => {
        tacticalRdf.clearData();
        toast.info("Datos de radiogoniometría reiniciados");
    };

    const handleClearLobs = () => {
        rdfTriangulation.clearBearings();
        toast.info("Líneas de marcación LOB purgadas");
    };

    const handleRemoveLob = (id: string) => {
        rdfTriangulation.removeBearing(id);
        toast.info("Marcación LOB eliminada");
    };

    const copyCoords = (lat: number, lon: number) => {
        TacticalAudioEngine.playTap();
        copyToClipboard(`${lat.toFixed(6)}, ${lon.toFixed(6)}`).then((ok) => {
            if (ok) {
                toast.success("Coordenadas copiadas al portapapeles");
            } else {
                toast.error("Error al copiar coordenadas");
            }
        });
    };

    // Cálculos de geometría para el Radar Polar de Radiogoniometría (SVG)
    const polarSectorsPath = useMemo(() => {
        const cx = 140;
        const cy = 140;
        const maxR = 105;
        const minR = 25;

        // Encontrar mejor sector para resaltarlo
        let bestIndex = -1;
        let maxRssi = -140;
        rdfState.sectors.forEach((s, idx) => {
            if (s.sampleCount > 0 && s.averageRssiDbm > maxRssi) {
                maxRssi = s.averageRssiDbm;
                bestIndex = idx;
            }
        });

        return rdfState.sectors.map((sector) => {
            const startRad = ((sector.startAngleDeg - 90) * Math.PI) / 180;
            const endRad = ((sector.endAngleDeg - 90) * Math.PI) / 180;

            // Normalizar RSSI: -105 dBm (minR) a -30 dBm (maxR)
            const norm = Math.max(0, Math.min(1, (sector.averageRssiDbm + 105) / 75));
            const r = sector.sampleCount > 0 ? minR + norm * (maxR - minR) : minR;

            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);

            const isBest = sector.sectorIndex === bestIndex && sector.sampleCount > 0;
            const pathData = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;

            return {
                pathData,
                sectorIndex: sector.sectorIndex,
                sampleCount: sector.sampleCount,
                rssi: sector.averageRssiDbm,
                isBest
            };
        });
    }, [rdfState.sectors]);

    const activeSectorsCount = useMemo(() => {
        return rdfState.sectors.filter(s => s.sampleCount > 0).length;
    }, [rdfState.sectors]);

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
                        onClick={() => navigate("nodemap")}
                        style={{
                            padding: "6px 10px", borderRadius: "8px",
                            background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)",
                            color: "#00E5FF", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer"
                        }}
                    >
                        🗺️ MAPA
                    </button>
                    <button
                        onClick={handleTriangulate}
                        style={{
                            padding: "6px 12px", borderRadius: "10px",
                            background: "rgba(0, 229, 255, 0.18)", border: "1.5px solid rgba(0, 229, 255, 0.5)",
                            color: "#00E5FF", fontSize: "0.74rem", fontWeight: 900, cursor: "pointer",
                            boxShadow: "0 0 12px rgba(0, 229, 255, 0.25)"
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
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 229, 255, 0.12)"
                        }}>
                            {/* Selector de Objetivo RF en Vivo (SIGINT & Hardware) */}
                            <div style={{
                                background: "rgba(0, 0, 0, 0.4)",
                                border: "1px solid rgba(0, 229, 255, 0.25)",
                                borderRadius: "14px",
                                padding: "12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "8px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <label style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 900 }}>
                                        🎯 OBJETIVO RF EN VIVO (SENSORES & ESPECTRO)
                                    </label>
                                    <span style={{
                                        fontSize: "0.62rem", fontWeight: 900, padding: "2px 6px", borderRadius: "5px",
                                        background: selectedTargetId !== "MANUAL" ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 179, 0, 0.2)",
                                        color: selectedTargetId !== "MANUAL" ? "#00E676" : "#FFB300",
                                        border: `1px solid ${selectedTargetId !== "MANUAL" ? "#00E676" : "#FFB300"}50`
                                    }}>
                                        {selectedTargetId !== "MANUAL" ? "🟢 SEÑAL VINCULADA" : "🟡 MUESTREO MANUAL"}
                                    </span>
                                </div>
                                <select
                                    value={selectedTargetId}
                                    onChange={(e) => setSelectedTargetId(e.target.value)}
                                    style={{
                                        width: "100%", padding: "10px 12px", background: "rgba(4, 8, 20, 0.95)",
                                        border: "1px solid rgba(0, 229, 255, 0.35)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.78rem", outline: "none", fontFamily: "JetBrains Mono, monospace"
                                    }}
                                >
                                    <option value="AUTO_WATCHDOG">
                                        🤖 Automático SIGINT ({availableEmitters.length} emisores detectados)
                                    </option>
                                    {availableEmitters.map(em => (
                                        <option key={em.deviceId} value={em.deviceId}>
                                            {em.type === 'OPEN_DRONE_ID' ? '🛸 Dron' : em.isSuspicious ? '⚠️ Rastreador' : '📡 Emisor'}: {em.name || em.deviceId.slice(0, 12)} ({em.rssi} dBm)
                                        </option>
                                    ))}
                                    <option value="LORA_TRANSCEIVER">
                                        📻 Transceptor LoRa RF ({loraTelemetry.lastRssiDbm ? `${loraTelemetry.lastRssiDbm} dBm` : 'Standby'})
                                    </option>
                                    <option value="MANUAL">
                                        🎛️ Calibración Manual / Slider
                                    </option>
                                </select>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ flex: 1 }}>
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
                                <button
                                    onClick={handleClearRdf}
                                    style={{
                                        marginLeft: "10px", marginTop: "18px", padding: "8px 12px",
                                        background: "rgba(255, 51, 85, 0.12)", border: "1px solid rgba(255, 51, 85, 0.35)",
                                        borderRadius: "10px", color: "#FF3355", fontSize: "0.72rem", fontWeight: 800,
                                        cursor: "pointer", whiteSpace: "nowrap"
                                    }}
                                    title="Reiniciar sectores de radiogoniometría"
                                >
                                    🗑️ REINICIAR
                                </button>
                            </div>

                            {/* ─── OSCILOSCOPIO POLAR TÁCTICO DE RADIOGONIOMETRÍA (16 SECTORES) ─── */}
                            <div style={{
                                position: "relative", width: "280px", height: "280px", margin: "0 auto",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                <svg width="280" height="280" viewBox="0 0 280 280" style={{ overflow: "visible" }}>
                                    <defs>
                                        <radialGradient id="polarGlow" cx="50%" cy="50%" r="50%">
                                            <stop offset="0%" stopColor="rgba(0, 229, 255, 0.15)" />
                                            <stop offset="70%" stopColor="rgba(4, 8, 20, 0.95)" />
                                            <stop offset="100%" stopColor="rgba(2, 4, 10, 0.98)" />
                                        </radialGradient>
                                        <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="3" result="blur" />
                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                        </filter>
                                    </defs>

                                    {/* Fondo Polar */}
                                    <circle cx="140" cy="140" r="125" fill="url(#polarGlow)" stroke="rgba(0, 229, 255, 0.4)" strokeWidth="1.5" />

                                    {/* Anillos de Distancia / Potencia RF (-105, -80, -55, -30 dBm) */}
                                    <circle cx="140" cy="140" r="105" fill="none" stroke="rgba(0, 229, 255, 0.2)" strokeDasharray="3 3" />
                                    <circle cx="140" cy="140" r="75" fill="none" stroke="rgba(0, 229, 255, 0.15)" strokeDasharray="3 3" />
                                    <circle cx="140" cy="140" r="45" fill="none" stroke="rgba(0, 229, 255, 0.15)" strokeDasharray="2 2" />
                                    <circle cx="140" cy="140" r="20" fill="none" stroke="rgba(0, 229, 255, 0.3)" />

                                    {/* Ejes Cardinales */}
                                    <line x1="140" y1="15" x2="140" y2="265" stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1" />
                                    <line x1="15" y1="140" x2="265" y2="140" stroke="rgba(0, 229, 255, 0.2)" strokeWidth="1" />

                                    {/* 16 Sectores Polares Discretizados */}
                                    {polarSectorsPath.map(s => (
                                        <path
                                            key={s.sectorIndex}
                                            d={s.pathData}
                                            fill={s.isBest ? "rgba(0, 229, 255, 0.45)" : s.sampleCount > 0 ? "rgba(0, 230, 118, 0.25)" : "transparent"}
                                            stroke={s.isBest ? "#00E5FF" : s.sampleCount > 0 ? "rgba(0, 230, 118, 0.4)" : "rgba(255, 255, 255, 0.05)"}
                                            strokeWidth={s.isBest ? 2 : 0.8}
                                            filter={s.isBest ? "url(#glowCyan)" : "none"}
                                        />
                                    ))}

                                    {/* Vector Direccional del Rumbo Pico Estimado (LOB) */}
                                    {rdfState.peakBearing.peakHeadingDeg !== undefined && (
                                        <g transform={`rotate(${rdfState.peakBearing.peakHeadingDeg} 140 140)`}>
                                            <line
                                                x1="140" y1="140" x2="140" y2="15"
                                                stroke="#00E5FF" strokeWidth="2.5" strokeDasharray={rdfState.peakBearing.isSignalLocked ? "none" : "5 3"}
                                                filter="url(#glowCyan)"
                                            />
                                            <polygon
                                                points="140,8 135,22 145,22"
                                                fill="#00E5FF" filter="url(#glowCyan)"
                                            />
                                        </g>
                                    )}

                                    {/* Aguja Giroscópica del Rumbo Actual del Dispositivo */}
                                    <g transform={`rotate(${currentHeading} 140 140)`}>
                                        <line x1="140" y1="140" x2="140" y2="28" stroke="#FF3355" strokeWidth="2" />
                                        <polygon points="140,20 136,34 144,34" fill="#FF3355" />
                                        <circle cx="140" cy="140" r="4" fill="#FF3355" />
                                    </g>

                                    {/* Etiquetas Cardinales */}
                                    <text x="140" y="28" textAnchor="middle" fill="rgba(0, 229, 255, 0.85)" fontSize="9" fontWeight="900">N (0°)</text>
                                    <text x="256" y="143" textAnchor="middle" fill="rgba(0, 229, 255, 0.85)" fontSize="9" fontWeight="900">E</text>
                                    <text x="140" y="258" textAnchor="middle" fill="rgba(0, 229, 255, 0.85)" fontSize="9" fontWeight="900">S</text>
                                    <text x="24" y="143" textAnchor="middle" fill="rgba(0, 229, 255, 0.85)" fontSize="9" fontWeight="900">W</text>
                                </svg>
                            </div>

                            {/* Telemetría Polar */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                <div>
                                    Sectores Muestreados: <span style={{ color: "#00E5FF", fontWeight: 900 }}>{activeSectorsCount}/16</span>
                                </div>
                                <div>
                                    Muestras Totales: <span style={{ color: "#00E676", fontWeight: 900 }}>{rdfState.sampleCount}</span>
                                </div>
                                <div>
                                    Estado: <span style={{
                                        color: rdfState.peakBearing.isSignalLocked ? "#00E676" : "#FFB300",
                                        fontWeight: 900
                                    }}>
                                        {rdfState.peakBearing.isSignalLocked ? "🟢 ENGANCHADO" : "🟡 BARRIDO"}
                                    </span>
                                </div>
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
                                        Potencia Pico: <span style={{ color: "#00E676", fontWeight: 900 }}>{rdfState.peakBearing.peakRssiDbm} dBm</span>
                                        {rdfState.peakBearing.estimatedDistMeters > 0 && (
                                            <span> · Distancia Est.: <span style={{ color: "#FFFFFF", fontWeight: 900 }}>~{rdfState.peakBearing.estimatedDistMeters}m</span></span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleAddCurrentLob}
                                    style={{
                                        padding: "12px 18px", borderRadius: "12px",
                                        background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        border: "none", color: "#000000", fontWeight: 900, fontSize: "0.82rem", cursor: "pointer",
                                        boxShadow: "0 0 16px rgba(0, 229, 255, 0.35)"
                                    }}
                                >
                                    + FIJAR LOB
                                </button>
                            </div>

                            {/* Sampling Controls & Auto-Scanning Mode */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "#FFFFFF" }}>MUESTREO & CALIBRACIÓN RF</span>
                                    <button
                                        onClick={() => {
                                            setAutoSampling(!autoSampling);
                                            TacticalAudioEngine.playTap();
                                            toast.info(autoSampling ? "Auto-barrido pausado" : "Auto-barrido 360° activado (registra muestras al girar)");
                                        }}
                                        style={{
                                            padding: "4px 10px", borderRadius: "8px",
                                            background: autoSampling ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.08)",
                                            border: `1px solid ${autoSampling ? '#00E676' : 'rgba(255, 255, 255, 0.15)'}`,
                                            color: autoSampling ? "#00E676" : "var(--text-secondary)",
                                            fontSize: "0.7rem", fontWeight: 800, cursor: "pointer"
                                        }}
                                    >
                                        {autoSampling ? "🔄 AUTO-BARRIDO: ON" : "⏸️ AUTO-BARRIDO: OFF"}
                                    </button>
                                </div>

                                {selectedTargetId === "MANUAL" ? (
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
                                ) : (
                                    <div style={{
                                        background: "rgba(0, 229, 255, 0.05)", border: "1px solid rgba(0, 229, 255, 0.2)",
                                        borderRadius: "10px", padding: "10px", display: "flex", justifyContent: "space-between", alignItems: "center"
                                    }}>
                                        <div>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>SEÑAL DE OBJETIVO VINCULADA:</div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#00E5FF" }}>
                                                {currentRssi} dBm · Azimut: {currentHeading}°
                                            </div>
                                        </div>
                                        <span style={{ fontSize: "0.7rem", color: "#00E676", fontWeight: 800 }}>
                                            EN VIVO
                                        </span>
                                    </div>
                                )}

                                <button
                                    onClick={handleRecordSample}
                                    style={{
                                        padding: "11px", background: "linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(0, 150, 255, 0.1) 100%)",
                                        border: "1.5px solid #00E5FF", borderRadius: "10px",
                                        color: "#00E5FF", fontWeight: 900, fontSize: "0.8rem", cursor: "pointer",
                                        boxShadow: "0 0 12px rgba(0, 229, 255, 0.2)"
                                    }}
                                >
                                    📡 REGISTRAR MUESTRA EN VIVO ({currentHeading}° / {currentRssi} dBm)
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
                                    display: "flex", flexDirection: "column", gap: "10px",
                                    boxShadow: "0 0 25px rgba(0, 230, 118, 0.25)"
                                }}>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span>🎯</span> POSICIÓN DE OBJETIVO FIJADA CON ÉXITO
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace" }}>
                                        Lat: {triangState.lastFix.targetLat.toFixed(5)} · Lon: {triangState.lastFix.targetLon.toFixed(5)}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                        Radio de Error: ±{triangState.lastFix.uncertaintyRadiusMeters.toFixed(1)} metros · Confianza: {triangState.lastFix.confidencePct}% · LOBs: {triangState.lastFix.lobsUsed}
                                    </div>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                                        <button
                                            onClick={() => handleNavigateToTarget(triangState.lastFix!)}
                                            style={{
                                                flex: 1, minWidth: "140px", padding: "9px 14px", borderRadius: "9px",
                                                background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                                border: "none", color: "#000000",
                                                fontWeight: 900, fontSize: "0.78rem", cursor: "pointer",
                                                boxShadow: "0 0 14px rgba(0, 229, 255, 0.35)"
                                            }}
                                        >
                                            🧭 NAVEGAR HACIA BLANCO
                                        </button>
                                        <button
                                            onClick={() => navigate("nodemap")}
                                            style={{
                                                padding: "9px 14px", borderRadius: "9px",
                                                background: "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 180, 80, 0.15) 100%)",
                                                border: "1px solid #00E676", color: "#00E676",
                                                fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                            }}
                                        >
                                            🗺️ MAPA
                                        </button>
                                        <button
                                            onClick={() => copyCoords(triangState.lastFix!.targetLat, triangState.lastFix!.targetLon)}
                                            style={{
                                                padding: "9px 14px", borderRadius: "9px",
                                                background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                                                color: "#FFFFFF", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer"
                                            }}
                                        >
                                            📋 COPIAR
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 900, color: "#FFFFFF" }}>
                                    LÍNEAS DE MARCACIÓN (LOB) REGISTRADAS ({triangState.lobs.length}):
                                </div>
                                {triangState.lobs.length > 0 && (
                                    <button
                                        onClick={handleClearLobs}
                                        style={{
                                            padding: "5px 10px", borderRadius: "8px",
                                            background: "rgba(255, 51, 85, 0.12)", border: "1px solid rgba(255, 51, 85, 0.35)",
                                            color: "#FF3355", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer"
                                        }}
                                    >
                                        🗑️ PURGAR TODAS
                                    </button>
                                )}
                            </div>

                            {triangState.lobs.length === 0 ? (
                                <div style={{ padding: "24px 16px", textAlign: "center", background: "rgba(14, 18, 38, 0.9)", borderRadius: "14px", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                    <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>📡</div>
                                    <div style={{ fontWeight: 900, color: "#FFFFFF" }}>Sin líneas de marcación</div>
                                    <div style={{ marginTop: "4px" }}>Añade al menos 2 marcaciones desde la pestaña RDF desplazándote a diferentes posiciones físicas para triangular el emisor.</div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {triangState.lobs.map(lob => (
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
                                                    GPS: {lob.observerLat.toFixed(5)}, {lob.observerLon.toFixed(5)}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "0.65rem", color: "#00E676", fontWeight: 900 }}>VÁLIDA</span>
                                                <button
                                                    onClick={() => handleRemoveLob(lob.id)}
                                                    style={{
                                                        width: "26px", height: "26px", borderRadius: "6px",
                                                        background: "rgba(255, 51, 85, 0.15)", border: "1px solid rgba(255, 51, 85, 0.35)",
                                                        color: "#FF3355", fontSize: "0.8rem", fontWeight: 900,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        cursor: "pointer"
                                                    }}
                                                    title="Eliminar esta marcación"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

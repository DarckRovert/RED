"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { getProximityNodes, ProximityNode } from "../lib/api";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalLocationEngine, TacticalLocation } from "../lib/sensors/TacticalLocationEngine";
import { tacticalCompass, TacticalCompassTelemetry } from "../lib/sensors/TacticalCompassEngine";
import { toast } from "./Toast";
import { TacIcon } from "./ui/TacIcon";

function calculateGreatCircleBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return Math.round((((theta * 180) / Math.PI) + 360) % 360);
}

function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

export const P2PCompassModal: React.FC = () => {
    const { navigate } = useRedStore();
    const { t } = useTranslation();
    const [heading, setHeading] = useState<number>(0);
    const [headingSource, setHeadingSource] = useState<"sensor" | "manual">("manual");
    const [compassTelemetry, setCompassTelemetry] = useState<TacticalCompassTelemetry>(() => tacticalCompass.getTelemetry());
    const [nodes, setNodes] = useState<ProximityNode[]>([]);
    const [activeTab, setActiveTab] = useState<"compass" | "nodes">("compass");
    const [trackedPeerId, setTrackedPeerId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [myCoords, setMyCoords] = useState<{ lat: number; lon: number } | null>(null);

    // Inicialización del par rastreado desde el blanco táctico del sistema
    useEffect(() => {
        try {
            const raw = localStorage.getItem("red_active_target") || localStorage.getItem("red_tactical_target_point");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.peerId) {
                    setTrackedPeerId(parsed.peerId);
                } else if (parsed.deviceId) {
                    setTrackedPeerId(parsed.deviceId);
                }
            }
        } catch {}
    }, []);

    // Sincronización continua de posición GNSS de alta precisión
    useEffect(() => {
        const last = TacticalLocationEngine.getLastKnownLocation();
        if (last && TacticalLocationEngine.isValidCoordinates(last.lat, last.lon)) {
            setMyCoords({ lat: last.lat!, lon: last.lon! });
        }
        const unsub = TacticalLocationEngine.watchLocation((loc: TacticalLocation) => {
            if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                setMyCoords({ lat: loc.lat!, lon: loc.lon! });
            }
        });
        return () => unsub();
    }, []);


    // Intercepción LIFO de hardware Android y tecla Escape
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (activeTab !== "compass") {
                setActiveTab("compass");
                return true;
            }
            navigate("sidebar");
            return true;
        });
        return () => unregister();
    }, [activeTab, navigate]);

    // Load real proximity nodes from backend API
    const loadNodes = useCallback(async (isManual: boolean = false) => {
        if (isManual) setIsScanning(true);
        try {
            const list = await getProximityNodes().catch(() => []);
            const rawList = Array.isArray(list) ? list : [];
            setNodes(rawList);
            if (isManual) toast.success(`Escaneo completado: ${rawList.length} nodos en proximidad`);
        } catch {
            setNodes([]);
            if (isManual) toast.error("Fallo al escanear espectro P2P");
        } finally {
            if (isManual) setIsScanning(false);
        }
    }, []);

    useEffect(() => {
        loadNodes();
        const interval = setInterval(() => loadNodes(false), 3000);
        return () => clearInterval(interval);
    }, [loadNodes]);

    // Telemetría unificada de orientación táctica (Giroscopio 3D + Magnetómetro + Filtro Circular + Fallbacks)
    useEffect(() => {
        const unsub = tacticalCompass.subscribe((telemetry) => {
            setCompassTelemetry(telemetry);
            setHeading(telemetry.headingDeg);
            setHeadingSource(telemetry.source === "manual" ? "manual" : "sensor");
        });
        return () => unsub();
    }, []);

    const getCardinal = (deg: number) => {
        const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        const idx = Math.round(((deg % 360) / 45)) % 8;
        return dirs[idx];
    };

    const getTransportBadge = (transport?: string) => {
        if (!transport || transport.includes("BLE")) return "badge-tactical-cyan";
        if (transport.includes("WiFi")) return "badge-tactical-emerald";
        return "badge-tactical-amber";
    };

    // Par activo fijado para seguimiento vectorial
    const trackedPeer = useMemo(() => {
        if (!trackedPeerId) return null;
        const found = nodes.find(n => (n.peer_id || n.identity_hash) === trackedPeerId);
        if (found) return found;

        try {
            const raw = localStorage.getItem("red_active_target") || localStorage.getItem("red_tactical_target_point");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.peerId === trackedPeerId || parsed.deviceId === trackedPeerId) {
                    return {
                        identity_hash: trackedPeerId,
                        peer_id: trackedPeerId,
                        display_name: parsed.name || "Blanco Táctico",
                        nickname: parsed.name || "Blanco Táctico",
                        latitude: parsed.lat,
                        longitude: parsed.lon,
                        rssi: parsed.rssi ?? -65,
                        rssi_dbm: parsed.rssi ?? -65,
                        distance_meters: null,
                        last_seen: Date.now(),
                        transport: "MESH"
                    } as ProximityNode;
                }
            }
        } catch {}
        return null;
    }, [nodes, trackedPeerId]);

    // Derivación de azimut: Great-Circle real si hay coordenadas, hardware bearing si existe, o hash determinista como fallback
    const getNodeBearing = useCallback((n: ProximityNode, index: number) => {
        if (typeof n.bearing_deg === "number" && isFinite(n.bearing_deg)) {
            return n.bearing_deg;
        }
        const peerLat = n.latitude ?? (n as any).lat;
        const peerLon = n.longitude ?? (n as any).lon;
        if (myCoords && typeof peerLat === "number" && typeof peerLon === "number" && TacticalLocationEngine.isValidCoordinates(peerLat, peerLon)) {
            return calculateGreatCircleBearing(myCoords.lat, myCoords.lon, peerLat, peerLon);
        }
        const id = n.peer_id || n.identity_hash || `node-${index}`;
        const sum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return (sum * 23 + index * 47) % 360;
    }, [myCoords]);

    const handlePinPeerAsTarget = useCallback((peer: ProximityNode) => {
        const name = peer.nickname || peer.display_name || `Par ${peer.peer_id?.slice(0, 6) || "P2P"}`;
        let targetLat = peer.latitude ?? (peer as any).lat;
        let targetLon = peer.longitude ?? (peer as any).lon;

        if ((typeof targetLat !== "number" || typeof targetLon !== "number") && myCoords) {
            const bearing = getNodeBearing(peer, 0);
            const distM = (typeof peer.distance_meters === "number" && peer.distance_meters > 0)
                ? peer.distance_meters
                : ((typeof peer.distance === "number" && peer.distance > 0) ? peer.distance : 40);
            const rad = (bearing * Math.PI) / 180;
            const dLat = (distM * Math.cos(rad)) / 111000;
            const dLon = (distM * Math.sin(rad)) / (111000 * Math.cos((myCoords.lat * Math.PI) / 180));
            targetLat = Math.round((myCoords.lat + dLat) * 100000) / 100000;
            targetLon = Math.round((myCoords.lon + dLon) * 100000) / 100000;
        }

        if (typeof targetLat === "number" && typeof targetLon === "number") {
            const target = {
                lat: targetLat,
                lon: targetLon,
                name: `PAR: ${name}`,
                type: "PEER",
                peerId: peer.peer_id || peer.identity_hash,
                createdAt: Date.now()
            };
            localStorage.setItem("red_active_target", JSON.stringify(target));
            localStorage.setItem("red_tactical_target_point", JSON.stringify(target));
            toast.success(`🎯 ${name} fijado como blanco táctico`);
        } else {
            toast.warning("Se requieren coordenadas GNSS para fijar el blanco");
        }
    }, [myCoords, getNodeBearing]);

    // Cálculo de guía táctica hacia el par fijado
    const trackingGuidance = useMemo(() => {
        if (!trackedPeer) return null;
        const targetBearing = getNodeBearing(trackedPeer, 0);
        let diff = (targetBearing - heading + 360) % 360;
        if (diff > 180) diff -= 360;
        const relativeSteeringDeg = Math.round(diff);

        let steeringInstruction = "🎯 EN RUMBO DIRECTO";
        if (Math.abs(relativeSteeringDeg) <= 8) {
            steeringInstruction = "🎯 EN RUMBO DIRECTO (Avanzar)";
        } else if (relativeSteeringDeg > 0) {
            steeringInstruction = `➡️ Virar ${relativeSteeringDeg}° a Estribor (Derecha)`;
        } else {
            steeringInstruction = `⬅️ Virar ${Math.abs(relativeSteeringDeg)}° a Babor (Izquierda)`;
        }

        return {
            targetBearing,
            relativeSteeringDeg,
            steeringInstruction,
            cardinal: getCardinal(targetBearing)
        };
    }, [trackedPeer, heading, getNodeBearing]);

    // Filtrado de nodos por consulta de búsqueda
    const filteredNodes = useMemo(() => {
        if (!searchQuery.trim()) return nodes;
        const q = searchQuery.toLowerCase();
        return nodes.filter(n => {
            const name = (n.nickname || n.display_name || "").toLowerCase();
            const id = (n.peer_id || n.identity_hash || "").toLowerCase();
            const tr = (n.transport || "").toLowerCase();
            return name.includes(q) || id.includes(q) || tr.includes(q);
        });
    }, [nodes, searchQuery]);

    const handleSelectTrackedPeer = (peer: ProximityNode) => {
        const id = peer.peer_id || peer.identity_hash;
        if (trackedPeerId === id) {
            setTrackedPeerId(null);
            toast.info("Seguimiento de par desactivado");
        } else {
            setTrackedPeerId(id);
            setActiveTab("compass");
            toast.success(`🎯 Rastreando a ${peer.nickname || peer.display_name || "Par P2P"}`);
        }
    };

    const handleOpenChat = (peer: ProximityNode) => {
        const id = peer.peer_id || peer.identity_hash;
        if (id) {
            navigate("chat", id);
        } else {
            toast.warning("Identificador de nodo no disponible");
        }
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "14px 18px",
                height: "var(--header-h, 64px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 16px rgba(0,229,255,0.35)"
                    }}>
                        <TacIcon name="compass" size={22} color="#000" />
                    </div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t('compass.title') || "Brújula Táctica P2P"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {trackedPeer
                                ? `● RASTREANDO: ${trackedPeer.nickname || trackedPeer.display_name || "Nodo P2P"}`
                                : `● ${tacticalCompass.getSourceDescription(compassTelemetry.source)}`
                            }
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={() => loadNodes(true)}
                        className="btn-icon"
                        title="Escanear Nodos"
                        style={{ width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        disabled={isScanning}
                    >
                        <TacIcon name="refresh" size={16} className={isScanning ? "spin-pulse" : ""} />
                    </button>
                    <button
                        onClick={() => navigate("sidebar")}
                        className="btn-icon"
                        title={t('common.close') || "Cerrar"}
                        style={{ width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <TacIcon name="x" size={16} />
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "8px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border, rgba(255,255,255,0.1))",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("compass")}
                    className={activeTab === "compass" ? "glow-pill-active" : "btn-ghost"}
                    style={{
                        padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700,
                        borderRadius: "var(--radius-full, 9999px)", whiteSpace: "nowrap",
                        background: activeTab === "compass" ? "#00E5FF" : "transparent",
                        color: activeTab === "compass" ? "#000" : "#AAA",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    <TacIcon name="compass" size={14} />
                    <span>Rosa Táctica</span>
                    {trackedPeer && <TacIcon name="crosshair" size={12} color={activeTab === "compass" ? "#000" : "#FF3355"} />}
                </button>
                <button
                    onClick={() => setActiveTab("nodes")}
                    className={activeTab === "nodes" ? "glow-pill-active" : "btn-ghost"}
                    style={{
                        padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700,
                        borderRadius: "var(--radius-full, 9999px)", whiteSpace: "nowrap",
                        background: activeTab === "nodes" ? "#00E5FF" : "transparent",
                        color: activeTab === "nodes" ? "#000" : "#AAA",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "6px"
                    }}
                >
                    <TacIcon name="radio" size={14} />
                    <span>Nodos en Alcance ({nodes.length})</span>
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "14px 16px 80px 16px", overflowY: "auto" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>

                    {/* ─── TAB 1: BRÚJULA TÁCTICA ─────────────────────────────── */}
                    {activeTab === "compass" && (
                        <div className="card-tactical animate-enter" style={{
                            padding: "20px 16px", display: "flex", flexDirection: "column",
                            alignItems: "center", gap: "16px",
                            background: "rgba(15, 23, 42, 0.85)", borderRadius: "16px",
                            border: "1px solid rgba(0, 229, 255, 0.25)"
                        }}>
                            {/* HUD de Telemetría Central */}
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "2.6rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan, #00E5FF)", lineHeight: 1 }}>
                                    {heading}°
                                </div>
                                <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--accent-crimson-bright, #FF3355)", letterSpacing: "2px", marginTop: "4px" }}>
                                    RUMBO {getCardinal(heading)}
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "#888", marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                                    {tacticalCompass.getSourceDescription(compassTelemetry.source)}
                                </div>
                            </div>

                            {/* Controles de Calibración / Ajuste Manual para dispositivos sin Magnetómetro (Lenovo Tablet) */}
                            {!compassTelemetry.hasMagnetometer && (
                                <div style={{
                                    display: "flex", gap: "8px", alignItems: "center", justifyContent: "center",
                                    padding: "6px 12px", borderRadius: "10px",
                                    background: "rgba(255,179,0,0.1)", border: "1px solid rgba(255,179,0,0.3)"
                                }}>
                                    <span style={{ fontSize: "0.72rem", color: "#FFB300", fontWeight: 700 }}>
                                        Sin Magnetómetro:
                                    </span>
                                    <button
                                        onClick={() => tacticalCompass.adjustManualHeading(-15)}
                                        style={{
                                            padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 800,
                                            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                                            color: "#FFF", cursor: "pointer",
                                            display: "flex", alignItems: "center", gap: "4px"
                                        }}
                                        title="Ajustar rumbo -15°"
                                    >
                                        <TacIcon name="chevron-left" size={10} />
                                        <span>-15°</span>
                                    </button>
                                    <button
                                        onClick={() => tacticalCompass.adjustManualHeading(15)}
                                        style={{
                                            padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 800,
                                            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)",
                                            color: "#FFF", cursor: "pointer",
                                            display: "flex", alignItems: "center", gap: "4px"
                                        }}
                                        title="Ajustar rumbo +15°"
                                    >
                                        <span>+15°</span>
                                        <TacIcon name="chevron-right" size={10} />
                                    </button>
                                    {myCoords && (
                                        <button
                                            onClick={() => tacticalCompass.calibrateSolarAzimuth(myCoords.lat, myCoords.lon)}
                                            style={{
                                                padding: "4px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 800,
                                                background: "rgba(255,179,0,0.25)", border: "1px solid #FFB300",
                                                color: "#FFB300", cursor: "pointer",
                                                display: "flex", alignItems: "center", gap: "4px"
                                            }}
                                            title="Calibrar apuntando hacia el Sol"
                                        >
                                            <TacIcon name="sun" size={12} />
                                            <span>Calibrar Sol</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Tarjeta de Par Rastreado en Tiempo Real (Peer Vector Guidance) */}
                            {trackedPeer && trackingGuidance && (
                                <div style={{
                                    width: "100%", padding: "12px 14px", borderRadius: "12px",
                                    background: "linear-gradient(135deg, rgba(255,51,85,0.18) 0%, rgba(14,20,36,0.95) 100%)",
                                    border: "1.5px solid #FF3355",
                                    display: "flex", flexDirection: "column", gap: "8px",
                                    boxShadow: "0 0 20px rgba(255,51,85,0.25)",
                                    boxSizing: "border-box"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <TacIcon name="crosshair" size={18} color="#FF3355" style={{ animation: "pulse 1.2s infinite" }} />
                                            <div>
                                                <div style={{ fontSize: "0.86rem", fontWeight: 900, color: "#FFF" }}>
                                                    RASTREANDO: {trackedPeer.nickname || trackedPeer.display_name || "Nodo P2P"}
                                                </div>
                                                <div className="tabular-telemetry" style={{ fontSize: "0.68rem", color: "#AAA", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {(trackedPeer.peer_id || trackedPeer.identity_hash || "").slice(0, 16)}...
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setTrackedPeerId(null)}
                                            style={{
                                                background: "rgba(255,255,255,0.1)", border: "none",
                                                color: "#FF5252", padding: "4px 8px", borderRadius: "6px",
                                                cursor: "pointer", fontSize: "0.72rem", fontWeight: 800,
                                                display: "flex", alignItems: "center", gap: "4px"
                                            }}
                                        >
                                            <TacIcon name="x" size={12} />
                                            <span>Cancelar</span>
                                        </button>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                        <div style={{ background: "rgba(0,0,0,0.4)", padding: "8px 10px", borderRadius: "8px" }}>
                                            <div style={{ fontSize: "0.62rem", color: "#AAA", textTransform: "uppercase" }}>RUMBO AL PAR</div>
                                            <div className="tabular-telemetry" style={{ fontSize: "1.1rem", fontWeight: 900, color: "#00E5FF", fontFamily: "JetBrains Mono, monospace" }}>
                                                {trackingGuidance.targetBearing}° {trackingGuidance.cardinal}
                                            </div>
                                            <div style={{ fontSize: "0.65rem", color: "#FFB300", fontWeight: 700, marginTop: "2px" }}>
                                                {trackingGuidance.steeringInstruction}
                                            </div>
                                        </div>
                                        <div style={{ background: "rgba(0,0,0,0.4)", padding: "8px 10px", borderRadius: "8px" }}>
                                            <div style={{ fontSize: "0.62rem", color: "#AAA", textTransform: "uppercase" }}>ALCANCE ESTIMADO</div>
                                            <div className="tabular-telemetry" style={{ fontSize: "1.1rem", fontWeight: 900, color: "#00E676", fontFamily: "JetBrains Mono, monospace" }}>
                                                {trackedPeer.distance_meters != null ? `${trackedPeer.distance_meters.toFixed(1)}m` : "~ En rango"}
                                            </div>
                                            <div className="tabular-telemetry" style={{ fontSize: "0.65rem", color: "#AAA", marginTop: "2px" }}>
                                                RSSI: {trackedPeer.rssi_dbm != null ? `${trackedPeer.rssi_dbm} dBm` : "Radio P2P"}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => handlePinPeerAsTarget(trackedPeer)}
                                            style={{
                                                flex: 1, padding: "8px", borderRadius: "8px",
                                                background: "rgba(0,230,118,0.2)", border: "1px solid #00E676",
                                                color: "#00E676", fontWeight: 800, fontSize: "0.76rem", cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                            }}
                                        >
                                            <TacIcon name="crosshair" size={14} />
                                            <span>Fijar Blanco</span>
                                        </button>
                                        <button
                                            onClick={() => handleOpenChat(trackedPeer)}
                                            style={{
                                                flex: 1, padding: "8px", borderRadius: "8px",
                                                background: "rgba(0,229,255,0.2)", border: "1px solid #00E5FF",
                                                color: "#00E5FF", fontWeight: 800, fontSize: "0.76rem", cursor: "pointer",
                                                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                            }}
                                        >
                                            <TacIcon name="chats" size={14} />
                                            <span>Abrir Canal</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Disco Circular de la Brújula Militar */}
                            <div style={{
                                position: "relative", width: "260px", height: "260px",
                                borderRadius: "50%",
                                background: "radial-gradient(circle, rgba(14,24,36,0.95) 0%, rgba(6,10,18,0.98) 70%)",
                                border: "2px solid rgba(0,229,255,0.35)",
                                boxShadow: "0 0 40px rgba(0,229,255,0.15), inset 0 0 20px rgba(0,0,0,0.8)",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                {/* Retícula Central Fija */}
                                <div style={{ position: "absolute", width: "100%", height: "1px", background: "rgba(255,255,255,0.1)" }} />
                                <div style={{ position: "absolute", width: "1px", height: "100%", background: "rgba(255,255,255,0.1)" }} />

                                {/* Anillos Concéntricos de Distancia Relativa */}
                                <div style={{ position: "absolute", width: "70%", height: "70%", borderRadius: "50%", border: "1px dashed rgba(0,229,255,0.15)" }} />
                                <div style={{ position: "absolute", width: "40%", height: "40%", borderRadius: "50%", border: "1px dashed rgba(0,229,255,0.15)" }} />

                                {/* Marcador de Proa Superior Fijo */}
                                <div style={{
                                    position: "absolute", top: 4, width: 0, height: 0,
                                    borderLeft: "8px solid transparent",
                                    borderRight: "8px solid transparent",
                                    borderTop: "14px solid var(--accent-crimson-bright, #FF3355)",
                                    zIndex: 5
                                }} />

                                {/* Disco Giratorio Acoplado al Giroscopio Suavizado */}
                                <div style={{
                                    position: "absolute", inset: 0, borderRadius: "50%",
                                    transform: `rotate(${-heading}deg)`,
                                    transition: "transform 0.08s linear",
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                }}>
                                    {/* Puntos Cardinales */}
                                    <span style={{ position: "absolute", top: 12, fontWeight: 900, fontSize: "1.1rem", color: "var(--accent-crimson-bright, #FF3355)" }}>N</span>
                                    <span style={{ position: "absolute", right: 14, fontWeight: 900, fontSize: "0.95rem", color: "var(--text-secondary, #AAA)" }}>E</span>
                                    <span style={{ position: "absolute", bottom: 12, fontWeight: 900, fontSize: "0.95rem", color: "var(--text-secondary, #AAA)" }}>S</span>
                                    <span style={{ position: "absolute", left: 14, fontWeight: 900, fontSize: "0.95rem", color: "var(--text-secondary, #AAA)" }}>W</span>

                                    {/* Nodos proyectados en el radar de la brújula */}
                                    {nodes.map((n, i) => {
                                        const nodeBearing = getNodeBearing(n, i);
                                        const angle = (nodeBearing * Math.PI) / 180;
                                        const dist = Math.min(100, Math.max(25, n.distance_meters ? n.distance_meters * 4 : 60));
                                        const x = Math.sin(angle) * dist;
                                        const y = -Math.cos(angle) * dist;
                                        const isTracked = (n.peer_id || n.identity_hash) === trackedPeerId;

                                        return (
                                            <div
                                                key={n.peer_id || n.identity_hash || i}
                                                onClick={() => handleSelectTrackedPeer(n)}
                                                style={{
                                                    position: "absolute",
                                                    transform: `translate(${x}px, ${y}px)`,
                                                    width: isTracked ? 16 : 12,
                                                    height: isTracked ? 16 : 12,
                                                    borderRadius: "50%",
                                                    background: isTracked ? "#FF3355" : "var(--accent-emerald, #00E676)",
                                                    border: isTracked ? "2px solid #FFF" : "1.5px solid #000",
                                                    boxShadow: isTracked ? "0 0 16px #FF3355" : "0 0 10px rgba(0,230,118,0.6)",
                                                    cursor: "pointer",
                                                    zIndex: isTracked ? 8 : 4
                                                }}
                                                title={`${n.nickname || n.display_name || "Par"} (${n.distance_meters || "?"}m)`}
                                            />
                                        );
                                    })}

                                    {/* Renderizar par fijado como blanco táctico si no está en la lista de escaneo local */}
                                    {trackedPeer && !nodes.some(n => (n.peer_id || n.identity_hash) === trackedPeerId) && (() => {
                                        const nodeBearing = getNodeBearing(trackedPeer, 0);
                                        const angle = (nodeBearing * Math.PI) / 180;
                                        const dist = 85;
                                        const x = Math.sin(angle) * dist;
                                        const y = -Math.cos(angle) * dist;
                                        return (
                                            <div
                                                key="tracked-remote-target"
                                                onClick={() => handleSelectTrackedPeer(trackedPeer)}
                                                style={{
                                                    position: "absolute",
                                                    transform: `translate(${x}px, ${y}px)`,
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: "50%",
                                                    background: "#FF3355",
                                                    border: "2px solid #FFF",
                                                    boxShadow: "0 0 20px #FF3355",
                                                    cursor: "pointer",
                                                    zIndex: 9
                                                }}
                                                title={`${trackedPeer.nickname || trackedPeer.display_name || "Blanco Fijado"} (${trackedPeer.distance_meters || "?"}m)`}
                                            />
                                        );
                                    })()}
                                </div>

                                {/* Aguja Vectorial Táctica hacia el Blanco Rastreado (Alineada con proa) */}
                                {trackingGuidance && (
                                    <div style={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        transform: `rotate(${trackingGuidance.relativeSteeringDeg}deg)`,
                                        transition: "transform 0.08s linear",
                                        pointerEvents: "none",
                                        zIndex: 7
                                    }}>
                                        <div style={{
                                            position: "absolute",
                                            top: "14px",
                                            width: 0,
                                            height: 0,
                                            borderLeft: "7px solid transparent",
                                            borderRight: "7px solid transparent",
                                            borderBottom: "22px solid #00E676",
                                            filter: "drop-shadow(0 0 8px rgba(0,230,118,0.9))"
                                        }} />
                                        <div style={{
                                            position: "absolute",
                                            top: "34px",
                                            bottom: "50%",
                                            width: "2px",
                                            background: "linear-gradient(to bottom, #00E676, rgba(0,230,118,0.1))"
                                        }} />
                                    </div>
                                )}

                                {/* Centro Óptico */}
                                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--accent-cyan, #00E5FF)", boxShadow: "0 0 12px #00E5FF", zIndex: 8 }} />
                            </div>

                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted, #888)", textAlign: "center" }}>
                                Toca cualquier nodo en el radar para fijar su rumbo de seguimiento táctico
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 2: NODOS EN ALCANCE ─────────────────────────────── */}
                    {activeTab === "nodes" && (
                        <div className="card-tactical animate-enter" style={{
                            padding: "18px 16px", display: "flex", flexDirection: "column", gap: "14px",
                            background: "rgba(15, 23, 42, 0.85)", borderRadius: "16px",
                            border: "1px solid rgba(0, 229, 255, 0.25)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary, #FFF)" }}>
                                        <TacIcon name="radio" size={16} color="var(--accent-cyan, #00E5FF)" />
                                        <span>Nodos de Proximidad Detectados ({filteredNodes.length})</span>
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted, #888)", marginTop: "2px" }}>
                                        Dispositivos detectados por RSSI BLE, WiFi-Direct y radiofrecuencia local
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald" style={{
                                    fontSize: "0.68rem", fontWeight: 800, padding: "3px 8px", borderRadius: "6px",
                                    background: "rgba(0,230,118,0.15)", color: "#00E676", border: "1px solid #00E676"
                                }}>
                                    PROXIMITY ENGINE
                                </span>
                            </div>

                            {/* Buscador de Nodos */}
                            <div style={{ position: "relative" }}>
                                <div style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
                                    <TacIcon name="search" size={14} color="rgba(255,255,255,0.4)" />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar nodo por nombre, hash o transporte..."
                                    style={{
                                        width: "100%", padding: "9px 12px 9px 32px", borderRadius: "8px",
                                        background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)",
                                        color: "#FFF", fontSize: "0.8rem", boxSizing: "border-box"
                                    }}
                                />
                            </div>

                            {filteredNodes.length === 0 ? (
                                <div style={{ padding: "30px 20px", textAlign: "center", color: "#888" }}>
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                                        <TacIcon name="radio" size={32} color="#64748b" />
                                    </div>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#DDD", marginTop: "8px" }}>
                                        {searchQuery ? "No se encontraron nodos que coincidan" : "Escaneando Espectro..."}
                                    </div>
                                    <div style={{ fontSize: "0.72rem", marginTop: "4px" }}>
                                        {searchQuery ? "Prueba con otro término o borra el filtro" : "Buscando balizas BLE y señales WiFi-Direct en proximidad física."}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {filteredNodes.map((n, i) => {
                                        const id = n.peer_id || n.identity_hash || `node-${i}`;
                                        const isTracked = id === trackedPeerId;
                                        const nodeBearing = getNodeBearing(n, i);

                                        return (
                                            <div
                                                key={id}
                                                style={{
                                                    padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                    background: isTracked ? "rgba(255,51,85,0.12)" : "rgba(255,255,255,0.04)",
                                                    border: `1px solid ${isTracked ? "#FF3355" : "rgba(255,255,255,0.08)"}`,
                                                    borderRadius: "10px",
                                                    borderLeft: `4px solid ${isTracked ? "#FF3355" : "var(--accent-cyan, #00E5FF)"}`
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <strong style={{ fontSize: "0.92rem", color: "#FFF" }}>
                                                            {n.nickname || n.display_name || `Nodo (${id.slice(0, 8)})`}
                                                        </strong>
                                                        <span className={`badge-tactical ${getTransportBadge(n.transport)}`} style={{
                                                            fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px"
                                                        }}>
                                                            {n.transport || "Mesh P2P"}
                                                        </span>
                                                    </div>

                                                    <div className="tabular-telemetry" style={{ fontSize: "0.72rem", color: "#AAA", marginTop: "4px" }}>
                                                        RSSI: {n.rssi_dbm != null ? `${n.rssi_dbm} dBm` : "N/D"} · Distancia: {n.distance_meters != null ? `${n.distance_meters.toFixed(1)} m` : "~ En rango"}
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <div className="tabular-telemetry" style={{ textAlign: "right", fontSize: "0.82rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800, marginRight: "4px" }}>
                                                        {nodeBearing}° {getCardinal(nodeBearing)}
                                                    </div>
                                                    <button
                                                        onClick={() => handleSelectTrackedPeer(n)}
                                                        style={{
                                                            display: "inline-flex", alignItems: "center", gap: "4px",
                                                            padding: "5px 10px", borderRadius: "6px",
                                                            background: isTracked ? "#FF3355" : "rgba(0,229,255,0.15)",
                                                            border: `1px solid ${isTracked ? "#FF3355" : "rgba(0,229,255,0.4)"}`,
                                                            color: isTracked ? "#FFF" : "#00E5FF",
                                                            fontSize: "0.72rem", fontWeight: 800, cursor: "pointer"
                                                        }}
                                                        title="Fijar objetivo en la rosa táctica"
                                                    >
                                                        <TacIcon name="crosshair" size={12} color={isTracked ? "#FFF" : "#00E5FF"} />
                                                        <span>{isTracked ? "Guiando" : "Rastrear"}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenChat(n)}
                                                        style={{
                                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                            padding: "5px 8px", borderRadius: "6px",
                                                            background: "rgba(255,255,255,0.06)",
                                                            border: "1px solid rgba(255,255,255,0.15)",
                                                            color: "#FFF", fontSize: "0.72rem", cursor: "pointer"
                                                        }}
                                                        title="Abrir chat cifrado"
                                                    >
                                                        <TacIcon name="chats" size={13} color="#FFF" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
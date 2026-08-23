"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { getProximityNodes, ProximityNode } from "../lib/api";

export const P2PCompassModal: React.FC = () => {
    const { navigate } = useRedStore();
    const { t } = useTranslation();
    const [heading, setHeading] = useState<number>(0);
    const [headingSource, setHeadingSource] = useState<"sensor" | "manual">("manual");
    const [nodes, setNodes] = useState<ProximityNode[]>([]);
    const [activeTab, setActiveTab] = useState<"compass" | "nodes">("compass");

    // Load real proximity nodes from backend API
    const loadNodes = useCallback(async () => {
        try {
            const list = await getProximityNodes().catch(() => []);
            const rawList = Array.isArray(list) ? list : [];
            setNodes(rawList);
        } catch {
            setNodes([]);
        }
    }, []);

    useEffect(() => {
        loadNodes();
        const interval = setInterval(loadNodes, 3000);
        return () => clearInterval(interval);
    }, [loadNodes]);

    // Real magnetic heading & GPS orientation listeners
    useEffect(() => {
        const handleOrientation = (event: any) => {
            const webkit = event.webkitCompassHeading;
            const alpha = event.alpha;

            if (webkit != null && !isNaN(webkit)) {
                setHeading(Math.round(webkit));
                setHeadingSource("sensor");
            } else if (alpha != null && !isNaN(alpha)) {
                const h = Math.round((360 - alpha) % 360);
                setHeading(h);
                setHeadingSource("sensor");
            }
        };

        window.addEventListener("deviceorientation", handleOrientation, true);
        window.addEventListener("deviceorientationabsolute" as any, handleOrientation, true);

        // Geolocation GPS heading fallback
        let watchId: number | null = null;
        if (typeof navigator !== "undefined" && navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
                        setHeading(Math.round(pos.coords.heading));
                        setHeadingSource("sensor");
                    }
                },
                () => {},
                { enableHighAccuracy: true }
            );
        }

        return () => {
            window.removeEventListener("deviceorientation", handleOrientation, true);
            window.removeEventListener("deviceorientationabsolute" as any, handleOrientation, true);
            if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
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

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.35)"
                    }}>🧭</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t('compass.title')}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {headingSource === "sensor" ? `● ${t('compass.subtitle')}` : t('compass.calibrate_hint')}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title={t('common.close')}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("compass")}
                    className={activeTab === "compass" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🧭 Rosa de los Vientos
                </button>
                <button
                    onClick={() => setActiveTab("nodes")}
                    className={activeTab === "nodes" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📡 Nodos en Alcance ({nodes.length})
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: BRÚJULA TÁCTICA ─────────────────────────────── */}
                    {activeTab === "compass" && (
                        <div className="card-tactical animate-enter" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                            {/* HUD Telemetría Central */}
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "2.8rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)" }}>
                                    {heading}°
                                </div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--accent-crimson-bright)", letterSpacing: "2px" }}>
                                    RUMBO {getCardinal(heading)}
                                </div>
                            </div>

                            {/* Disco Circular de la Brújula Militar */}
                            <div style={{
                                position: "relative", width: "260px", height: "260px",
                                borderRadius: "50%",
                                background: "radial-gradient(circle, rgba(14,24,36,0.9) 0%, rgba(6,10,18,0.98) 70%)",
                                border: "2px solid rgba(0,229,255,0.3)",
                                boxShadow: "0 0 40px rgba(0,229,255,0.15), inset 0 0 20px rgba(0,0,0,0.8)",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                {/* Retícula Central Fija */}
                                <div style={{ position: "absolute", width: "100%", height: "1px", background: "rgba(255,255,255,0.1)" }} />
                                <div style={{ position: "absolute", width: "1px", height: "100%", background: "rgba(255,255,255,0.1)" }} />

                                {/* Marcador de Proa Superior Fijo */}
                                <div style={{
                                    position: "absolute", top: 4, width: 0, height: 0,
                                    borderLeft: "8px solid transparent",
                                    borderRight: "8px solid transparent",
                                    borderTop: "14px solid var(--accent-crimson-bright)",
                                    zIndex: 5
                                }} />

                                {/* Disco Giratorio Acoplado al Giroscopio */}
                                <div style={{
                                    position: "absolute", inset: 0, borderRadius: "50%",
                                    transform: `rotate(${-heading}deg)`,
                                    transition: "transform 0.1s ease-out",
                                    display: "flex", alignItems: "center", justifyContent: "center"
                                }}>
                                    {/* Puntos Cardinales */}
                                    <span style={{ position: "absolute", top: 12, fontWeight: 900, fontSize: "1.1rem", color: "var(--accent-crimson-bright)" }}>N</span>
                                    <span style={{ position: "absolute", right: 14, fontWeight: 900, fontSize: "0.95rem", color: "var(--text-secondary)" }}>E</span>
                                    <span style={{ position: "absolute", bottom: 12, fontWeight: 900, fontSize: "0.95rem", color: "var(--text-secondary)" }}>S</span>
                                    <span style={{ position: "absolute", left: 14, fontWeight: 900, fontSize: "0.95rem", color: "var(--text-secondary)" }}>W</span>

                                    {/* Nodos proyectados en el radar de la brújula */}
                                    {nodes.map((n, i) => {
                                        const angle = (n.bearing_deg || (i * 75)) * (Math.PI / 180);
                                        const dist = Math.min(100, Math.max(25, n.distance_meters ? n.distance_meters * 4 : 50));
                                        const x = Math.sin(angle) * dist;
                                        const y = -Math.cos(angle) * dist;

                                        return (
                                            <div
                                                key={n.peer_id}
                                                style={{
                                                    position: "absolute",
                                                    transform: `translate(${x}px, ${y}px)`,
                                                    width: 12, height: 12, borderRadius: "50%",
                                                    background: "var(--accent-emerald)",
                                                    boxShadow: "0 0 10px var(--accent-emerald)"
                                                }}
                                                title={`${n.nickname} (${n.distance_meters || "?"}m)`}
                                            />
                                        );
                                    })}
                                </div>

                                {/* Centro Óptico */}
                                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "var(--accent-cyan)", boxShadow: "0 0 12px var(--accent-cyan)", zIndex: 6 }} />
                            </div>

                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textAlign: "center" }}>
                                Alinea el marcador carmesí superior con tu objetivo para fijar el rumbo táctico
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 2: NODOS EN ALCANCE ─────────────────────────────── */}
                    {activeTab === "nodes" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                        📡 Nodos de Proximidad Detectados
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Dispositivos detectados por RSSI BLE y WiFi-Direct en el radio operativo
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald">PROXIMITY ENGINE</span>
                            </div>

                            {nodes.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">📡</div>
                                    <div className="empty-state-title">Escaneando Espectro...</div>
                                    <div className="empty-state-desc">
                                        Buscando balizas BLE y señales WiFi-Direct en proximidad física.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {nodes.map((n) => (
                                        <div
                                            key={n.peer_id}
                                            className="card-tactical"
                                            style={{
                                                padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                borderLeft: "4px solid var(--accent-cyan)"
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <strong style={{ fontSize: "0.92rem", color: "var(--text-primary)" }}>
                                                        {n.nickname}
                                                    </strong>
                                                    <span className={`badge-tactical ${getTransportBadge(n.transport)}`}>
                                                        {n.transport}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                                                    RSSI: {n.rssi_dbm != null ? `${n.rssi_dbm} dBm` : "N/D"} · Distancia: {n.distance_meters != null ? `${n.distance_meters.toFixed(1)} m` : "~"}
                                                </div>
                                            </div>

                                            {n.bearing_deg != null && (
                                                <div style={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: "0.85rem", color: "var(--accent-cyan)", fontWeight: 800 }}>
                                                    {n.bearing_deg}° {getCardinal(n.bearing_deg)}
                                                </div>
                                            )}
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
};
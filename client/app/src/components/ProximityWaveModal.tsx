"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { getProximityNodes, triggerWaveHandshake, ProximityNode, getDiscoveryConfig } from "../lib/api";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export const ProximityWaveModal: React.FC = () => {
    const { navigate, goBack, addContact } = useRedStore();
    const { t } = useTranslation();
    const [nodes, setNodes] = useState<ProximityNode[]>([]);
    const [wavingId, setWavingId] = useState<string | null>(null);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        getDiscoveryConfig().then(setConfig).catch(() => {});
    }, []);

    const loadProximity = async () => {
        try {
            const list = await getProximityNodes();
            let finalNodes = Array.isArray(list) ? list : [];
            
            // Apply Proximity Filters locally
            if (config) {
                if (config.stealth_mode === "contacts_only") {
                    const storeContacts = useRedStore.getState().contacts || [];
                    finalNodes = finalNodes.filter(n => {
                        const hash = n.identity_hash || n.node_hash;
                        return storeContacts.some((c: any) => c.identity_hash === hash || hash?.startsWith(c.identity_hash));
                    });
                }
                if (config.rssi_threshold != null) {
                    finalNodes = finalNodes.filter(n => {
                        const realRssi = n.rssi ?? n.rssi_dbm;
                        if (realRssi == null) return true; // Don't filter out TCP/store nodes lacking real RSSI
                        return realRssi >= config.rssi_threshold!;
                    });
                }
            }

            setNodes(finalNodes);
        } catch {
            setNodes([]);
        }
    };

    useEffect(() => {
        loadProximity();
        const interval = setInterval(loadProximity, 3000);
        return () => clearInterval(interval);
    }, [config]);

    const handleWave = async (node: ProximityNode) => {
        const targetHash = node.identity_hash || node.node_hash || "node";
        setWavingId(targetHash);
        try {
            await triggerWaveHandshake(targetHash);
            await addContact(targetHash, node.nickname || node.display_name || targetHash.substring(0, 8));
            toast.success("👋 ¡Saludo P2P enviado! Enlace cifrado establecido.");
            navigate("chat", targetHash);
        } catch (e: any) {
            toast.error(`Error al saludar: ${e.message}`);
        } finally {
            setWavingId(null);
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
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.4)"
                    }}>👋</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.proximity_module?.title || "Proximidad Zero-Touch P2P"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t.proximity_module?.subtitle || "BLE PROXIMITY WAVE · INSTANT HANDSHAKE"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => navigate("proximity_settings")}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    >
                        ⚙️ Filtros
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "20px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>NODOS DETECTADOS POR PROXIMIDAD ({nodes.length})</div>

                        {nodes.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">📡</div>
                                <div className="empty-state-title">Escaneando Proximidad...</div>
                                <div className="empty-state-desc">
                                    Acércate a otro operador RED para intercambiar credenciales de forma táctica.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {nodes.map(n => {
                                    const hash = n.node_hash || n.identity_hash || "node";
                                    return (
                                        <div key={hash} className="card-tactical" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>{n.nickname || n.display_name || hash.substring(0, 8)}</div>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {n.distance_meters ? `~${n.distance_meters.toFixed(1)}m de distancia` : "Proximidad Inmediata"}
                                                    {(n.rssi != null || n.rssi_dbm != null) ? ` · ${n.rssi ?? n.rssi_dbm} dBm` : " · [Sin lectura de antena]"}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleWave(n)}
                                                disabled={wavingId === hash}
                                                className="btn-tactical-primary"
                                                style={{ padding: "8px 16px", fontSize: "0.80rem" }}
                                            >
                                                {wavingId === hash ? "Enlazando..." : "Saludar 👋"}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
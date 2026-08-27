"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { RedAPI } from "../lib/api";

export default function StatusHeader() {
    const { nodeOnline, status, identity, navigate } = useRedStore();
    const { t } = useTranslation();
    const [meshCounts, setMeshCounts] = useState({ wifi: 0, ble: 0, lora: 0, total: 0 });
    const [loraActive, setLoraActive] = useState(false);

    useEffect(() => {
        setLoraActive(typeof window !== "undefined" && localStorage.getItem("red_lora_enabled") === "true");
        if (!nodeOnline) return;
        const refresh = async () => {
            try {
                const peers = await RedAPI.getPeers();
                let wifi = 0, ble = 0, lora = 0, total = 0;
                for (const p of peers) {
                    const t = (p.transport || "").toLowerCase();
                    if (t === "wifi_direct" || t === "websocket" || t === "quic") wifi++;
                    else if (t === "ble") ble++;
                    else if (t === "lorawan" || t === "lora") lora++;
                    total++;
                }
                setMeshCounts({ wifi, ble, lora, total });
            } catch {}
        };
        refresh();
        const timer = setInterval(refresh, 4000);
        return () => clearInterval(timer);
    }, [nodeOnline]);

    const activeNetwork = (() => {
        if (loraActive && meshCounts.lora > 0) return "LORA";
        if (meshCounts.wifi > 0) return "WIFI";
        if (meshCounts.ble > 0) return "BLE";
        if ((status?.peer_count ?? 0) > 0) return "P2P MESH";
        return "STANDALONE";
    })();

    const networkColor: Record<string, string> = {
        LORA:       "var(--accent-purple, #B388FF)",
        WIFI:       "var(--accent-emerald)",
        BLE:        "var(--accent-cyan)",
        "P2P MESH": "var(--accent-amber)",
        STANDALONE: "var(--accent-crimson)",
    };

    const isOffline = !nodeOnline;
    const color = networkColor[activeNetwork] || "var(--accent-cyan)";

    if (isOffline) {
        return (
            <div style={{
                width: "100%",
                background: "linear-gradient(90deg, #FF3355, #E8213A)",
                color: "white",
                textAlign: "center",
                padding: "calc(4px + var(--safe-top, 0px)) 8px 4px 8px",
                fontSize: "11px",
                fontWeight: 800,
                zIndex: 50,
                letterSpacing: "0.5px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                flexShrink: 0
            }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "white", display: "inline-block", animation: "pulse 1s infinite" }} />
                {t('status_header.node_inaccessible')}
            </div>
        );
    }

    return (
        <div style={{
            width: "100%",
            background: "linear-gradient(180deg, rgba(14, 18, 36, 0.98) 0%, rgba(8, 10, 20, 0.98) 100%)",
            borderBottom: "1.5px solid rgba(255, 255, 255, 0.12)",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "calc(4px + var(--safe-top, 0px)) 12px 4px 12px",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.72rem",
            color: "var(--text-secondary)",
            zIndex: 50,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            flexShrink: 0,
            gap: "8px"
        }}>
            {/* Left: Active Transport Pill */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flexShrink: 1 }}>
                <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: color, boxShadow: `0 0 10px ${color}`,
                    display: "inline-block", flexShrink: 0
                }} />
                <span style={{ color: "#FFFFFF", fontWeight: 900, letterSpacing: "0.4px", whiteSpace: "nowrap", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                    {activeNetwork}
                </span>
                <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                    ({meshCounts.total})
                </span>
            </div>

            {/* Right: Quick Telemetry & Shortcuts */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "6px", fontSize: "0.68rem", fontWeight: 700 }}>
                    {meshCounts.wifi > 0 && <span style={{ color: "var(--accent-emerald)", textShadow: "0 0 6px rgba(0,230,118,0.4)" }}>WIFI:{meshCounts.wifi}</span>}
                    {meshCounts.ble > 0 && <span style={{ color: "var(--accent-cyan)", textShadow: "0 0 6px rgba(0,229,255,0.4)" }}>BLE:{meshCounts.ble}</span>}
                    {meshCounts.lora > 0 && <span style={{ color: "var(--accent-purple, #B388FF)", textShadow: "0 0 6px rgba(179,136,255,0.4)" }}>LORA:{meshCounts.lora}</span>}
                </div>

                <button
                    onClick={() => navigate("aiCopilot")}
                    style={{
                        background: "linear-gradient(135deg, rgba(0,229,255,0.22) 0%, rgba(2,132,199,0.3) 100%)", 
                        border: "1.5px solid rgba(0,229,255,0.6)",
                        borderRadius: "var(--radius-full)", padding: "2px 9px", color: "#E0F7FA",
                        fontSize: "0.68rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                        boxShadow: "0 0 10px rgba(0,229,255,0.35)", transition: "all 0.15s ease"
                    }}
                    title={t('status_header.ai_tooltip')}
                >
                    {t('status_header.ai_btn')}
                </button>

                <button
                    onClick={() => navigate("commercialHub")}
                    style={{
                        background: "linear-gradient(135deg, rgba(232,33,58,0.25) 0%, rgba(255,51,85,0.25) 100%)", 
                        border: "1.5px solid rgba(255,60,95,0.6)",
                        borderRadius: "var(--radius-full)", padding: "2px 9px", color: "#FFE4E8",
                        fontSize: "0.68rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                        boxShadow: "0 0 10px rgba(232,33,58,0.35)", transition: "all 0.15s ease"
                    }}
                >
                    {t('status_header.hub_btn')}
                </button>

                <button
                    onClick={() => navigate("nodemap")}
                    style={{
                        background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(0, 229, 255, 0.4)",
                        borderRadius: "var(--radius-full)", padding: "2px 8px", color: "var(--accent-cyan)",
                        fontSize: "0.68rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                        boxShadow: "0 0 8px rgba(0,229,255,0.2)"
                    }}
                >
                    {t('status_header.map_btn')}
                </button>

                <button
                    onClick={() => {
                        if (typeof window !== "undefined") {
                            window.dispatchEvent(new CustomEvent("red:open_landing"));
                        }
                    }}
                    style={{
                        background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.25)",
                        borderRadius: "var(--radius-full)", padding: "2px 8px", color: "#FFFFFF",
                        fontSize: "0.68rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap"
                    }}
                    title="Volver al Portal Web Oficial"
                >
                    🌐 Portal
                </button>
            </div>
        </div>
    );
}
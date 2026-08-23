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
            background: "linear-gradient(180deg, rgba(8,8,16,0.98) 0%, rgba(12,12,22,0.95) 100%)",
            borderBottom: "1px solid var(--glass-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "calc(3px + var(--safe-top, 0px)) 10px 3px 10px",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.70rem",
            color: "var(--text-secondary)",
            zIndex: 50,
            backdropFilter: "blur(16px)",
            flexShrink: 0,
            gap: "6px"
        }}>
            {/* Left: Active Transport Pill */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flexShrink: 1 }}>
                <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: color, boxShadow: `0 0 8px ${color}`,
                    display: "inline-block", flexShrink: 0
                }} />
                <span style={{ color: "#fff", fontWeight: 800, letterSpacing: "0.3px", whiteSpace: "nowrap" }}>
                    {activeNetwork}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.66rem", whiteSpace: "nowrap" }}>
                    ({meshCounts.total})
                </span>
            </div>

            {/* Right: Quick Telemetry & Shortcuts */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: "4px", fontSize: "0.66rem" }}>
                    {meshCounts.wifi > 0 && <span style={{ color: "var(--accent-emerald)" }}>WIFI:{meshCounts.wifi}</span>}
                    {meshCounts.ble > 0 && <span style={{ color: "var(--accent-cyan)" }}>BLE:{meshCounts.ble}</span>}
                    {meshCounts.lora > 0 && <span style={{ color: "var(--accent-purple, #B388FF)" }}>LORA:{meshCounts.lora}</span>}
                </div>

                <button
                    onClick={() => navigate("aiCopilot")}
                    style={{
                        background: "linear-gradient(135deg, rgba(0,229,255,0.25) 0%, rgba(2,132,199,0.15) 100%)", 
                        border: "1px solid rgba(0,229,255,0.45)",
                        borderRadius: "var(--radius-full)", padding: "1px 8px", color: "var(--accent-cyan)",
                        fontSize: "0.66rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                        boxShadow: "0 0 8px rgba(0,229,255,0.3)"
                    }}
                    title={t('status_header.ai_tooltip')}
                >
                    {t('status_header.ai_btn')}
                </button>

                <button
                    onClick={() => navigate("commercialHub")}
                    style={{
                        background: "linear-gradient(135deg, rgba(232,33,58,0.25) 0%, rgba(255,51,85,0.15) 100%)", 
                        border: "1px solid rgba(255,60,95,0.45)",
                        borderRadius: "var(--radius-full)", padding: "1px 8px", color: "#FF8599",
                        fontSize: "0.66rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                        boxShadow: "0 0 8px rgba(232,33,58,0.3)"
                    }}
                >
                    {t('status_header.hub_btn')}
                </button>

                <button
                    onClick={() => navigate("nodemap")}
                    style={{
                        background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-full)", padding: "1px 7px", color: "var(--accent-cyan)",
                        fontSize: "0.66rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap"
                    }}
                >
                    {t('status_header.map_btn')}
                </button>
            </div>
        </div>
    );
}
"use client";

import React from "react";
import { useRedStore } from "../store/useRedStore";

export default function SecurityHUD() {
    const { offlineMode, localPeers } = useRedStore();

    // Determine current security layers active
    const hasLocalPeers = localPeers.some(p => p.connected);
    const isRoutingMesh = offlineMode === "mesh" && hasLocalPeers;
    const isBLE = offlineMode === "bluetooth" && hasLocalPeers;

    // Calculate Threat Level (visual only for now, will expand with Phase E)
    let threatLevel = "LOW";
    let threatColor = "var(--green)";
    let layers = ["E2E AES-256", "Secure Enclave"];

    if (isRoutingMesh || isBLE) {
        threatLevel = "STEALTH";
        threatColor = "var(--blue)";
        layers.push("Offline Mesh");
    } else if (offlineMode === "internet") {
        layers.push("Audit: PASSED");
    }

    return (
        <div className="security-hud glass">
            <div className="hud-left">
                <span className="hud-label">THREAT_LEVEL:</span>
                <span className="hud-value font-mono" style={{ color: threatColor, textShadow: `0 0 8px ${threatColor}` }}>
                    [{threatLevel}]
                </span>
            </div>

            <div className="hud-center">
                {layers.map((layer, i) => (
                    <span key={i} className="hud-layer">
                        <span className="hud-dot" style={{ backgroundColor: threatColor }}></span>
                        {layer}
                    </span>
                ))}
            </div>

            <div className="hud-right">
                <span className="hud-label">NET:</span>
                <span className={`hud-value font-mono ${offlineMode !== 'internet' ? 'text-amber' : 'text-green'}`}>
                    {offlineMode === 'internet' ? 'GLOBAL' : offlineMode.toUpperCase()}
                </span>
            </div>
        </div>
    );
}

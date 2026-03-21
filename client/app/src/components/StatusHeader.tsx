"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";

export default function StatusHeader() {
    const { nodeOnline, status } = useRedStore();
    const [networkType, setNetworkType] = useState<"LAN" | "INTERNET" | "BLE" | "LORA">("INTERNET");
    const [loraActive, setLoraActive] = useState(false);

    // Mocking the detection logic based on status polling
    useEffect(() => {
        setLoraActive(localStorage.getItem("red_lora_enabled") === "true");
        if (!nodeOnline) return;
        // In reality, this would query Capacitor Network plugin or RedAPI.getNetworkRoutes()
        if (loraActive) {
            setNetworkType("LORA");
        } else if (status && status.peer_count < 2) {
            setNetworkType("BLE");
        } else {
            setNetworkType("INTERNET");
        }
    }, [nodeOnline, status, loraActive]);

    if (!nodeOnline) {
        return (
            <div style={{ 
                width: '100%', background: 'var(--danger)', color: 'white', 
                textAlign: 'center', padding: '4px', fontSize: '11px', 
                fontWeight: 'bold', zIndex: 999 
            }}>
                ⚠ SIN CONEXIÓN AL NODO CRIPTOGRÁFICO
            </div>
        );
    }

    const getNetworkColor = () => {
        if (networkType === "LORA") return "#9b59b6";  // Purple for Sub-GHz RF
        if (networkType === "LAN") return "#2ecc71";   // Green
        if (networkType === "BLE") return "#3498db";   // Blue
        return "var(--primary)"; // Red for Global Internet
    };

    return (
        <div style={{
            width: '100%', background: 'var(--bg-lifted)', borderBottom: '1px solid var(--solid-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '4px 12px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-secondary)', zIndex: 999, height: '24px'
        }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div className="pulsing-dot" style={{ width: 6, height: 6, borderRadius: 3, background: getNetworkColor() }} />
                    {networkType === "LORA" ? "🛰️ SUB-GHz" : networkType}
                </span>
                <span>PEERS: {status?.peer_count || 0}</span>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ color: 'var(--success)', opacity: 0.8 }}>AES-GCM ACTIVO</span>
                <span>{status?.version || 'v5.0'}</span>
            </div>
        </div>
    );
}

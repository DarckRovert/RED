"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

export default function StatusHeader() {
    const { nodeOnline, status, identity } = useRedStore();
    const [meshCounts, setMeshCounts] = useState({ wifi: 0, ble: 0, lora: 0, total: 0 });
    const [loraActive, setLoraActive] = useState(false);

    useEffect(() => {
        setLoraActive(localStorage.getItem("red_lora_enabled") === "true");
        if (!nodeOnline) return;
        const refresh = async () => {
            try {
                const peers = await RedAPI.getPeers();
                let wifi = 0, ble = 0, lora = 0, total = 0;
                for (const p of peers) {
                    const t = (p.transport || '').toLowerCase();
                    if (t === 'wifi_direct' || t === 'websocket' || t === 'quic') wifi++;
                    else if (t === 'ble') ble++;
                    else if (t === 'lorawan' || t === 'lora') lora++;
                    total++;
                }
                setMeshCounts({ wifi, ble, lora, total });
            } catch {
                // Fallback: if node unreachable, keep zeroes
            }
        };
        refresh();
        const timer = setInterval(refresh, 5000);
        return () => clearInterval(timer);
    }, [nodeOnline]);

    const activeNetwork = (() => {
        if (loraActive && meshCounts.lora > 0) return "LORA";
        if (meshCounts.wifi > 0) return "WIFI";
        if (meshCounts.ble > 0) return "BLE";
        if ((status?.peer_count ?? 0) > 0) return "P2P";
        return "INTERNET";
    })();

    const networkColor: Record<string, string> = {
        LORA:    '#9b59b6',
        WIFI:    '#00D97E',
        BLE:     '#3498db',
        P2P:     '#FF7043',
        INTERNET:'var(--primary)',
    };

    const networkIcon: Record<string, string> = {
        LORA:    '📻',
        WIFI:    '📶',
        BLE:     '🔵',
        P2P:     '⚡',
        INTERNET:'🌐',
    };

    const isOffline = !nodeOnline;
    const hasMesh = meshCounts.total > 0;
    const color = networkColor[activeNetwork];

    if (isOffline) {
        return (
            <div style={{
                width: '100%',
                background: 'linear-gradient(90deg, rgba(232,33,58,0.95), rgba(200,20,45,0.9))',
                color: 'white',
                textAlign: 'center',
                padding: '5px',
                fontSize: '11px',
                fontWeight: 700,
                zIndex: 5,
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
            }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', display: 'inline-block', animation: 'pulse-glow 1s infinite' }} />
                NODO CRIPTOGRÁFICO INACCESIBLE
            </div>
        );
    }

    return (
        <div style={{
            width: '100%',
            background: hasMesh
                ? `linear-gradient(90deg, rgba(8,8,16,0.98) 0%, rgba(${meshCounts.wifi > 0 ? '0,40,20' : meshCounts.ble > 0 ? '10,25,45' : '30,0,40'},0.98) 100%)`
                : 'var(--bg-lifted)',
            borderBottom: `1px solid ${hasMesh ? color + '30' : 'var(--solid-border)'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 14px',
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-secondary)',
            zIndex: 5,
            height: '28px',
            transition: 'all 0.4s ease',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Animated background shimmer when mesh is active */}
            {hasMesh && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(90deg, transparent 0%, ${color}08 50%, transparent 100%)`,
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 3s linear infinite',
                    pointerEvents: 'none',
                }} />
            )}

            {/* LEFT: Network type + mesh breakdown */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                {/* Animated status dot with radar pings */}
                <div style={{ position: 'relative', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {/* The pings are absolutely positioned within this 14x14 container */}
                    {hasMesh && (
                        <>
                            <div className="radar-ping" style={{ width: '100%', height: '100%', top: 0, left: 0, borderColor: color }} />
                            <div className="radar-ping" style={{ width: '100%', height: '100%', top: 0, left: 0, borderColor: color, animationDelay: '0.7s' }} />
                        </>
                    )}
                    {/* Core dot in center */}
                    <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: hasMesh ? color : 'var(--text-muted)',
                        boxShadow: hasMesh ? `0 0 6px ${color}` : 'none',
                        transition: 'all 0.4s ease',
                        position: 'relative', zIndex: 1,
                    }} />
                </div>

                {/* Network label */}
                <span style={{ color, fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px' }}>
                    {networkIcon[activeNetwork]} {activeNetwork}
                </span>

                {/* Mesh peer breakdown — WiFi / BLE / LoRa badges */}
                {hasMesh ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {meshCounts.wifi > 0  && <span className="mesh-badge mesh-badge-wifi">{meshCounts.wifi}📶</span>}
                        {meshCounts.ble  > 0  && <span className="mesh-badge mesh-badge-ble">{meshCounts.ble}🔵</span>}
                        {meshCounts.lora > 0  && <span className="mesh-badge mesh-badge-lora">{meshCounts.lora}📻</span>}
                        {/* Flowing data dots when relaying */}
                        <span style={{ position: 'relative', width: 32, height: 7, display: 'inline-flex', alignItems: 'center', overflow: 'hidden' }}>
                            <span className="data-dot" />
                            <span className="data-dot" />
                            <span className="data-dot" />
                        </span>
                        <span style={{ color: 'var(--success)', fontSize: '10px', fontWeight: 600 }}>
                            {meshCounts.total} {meshCounts.total === 1 ? 'nodo' : 'nodos'}
                        </span>
                    </div>
                ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                        NODOS: {status?.peer_count ?? 0}
                    </span>
                )}
            </div>

            {/* RIGHT: Crypto status + identity short + version */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative' }}>
                <span style={{ color: 'var(--success)', fontSize: '10px', opacity: 0.9, letterSpacing: '0.2px' }}>
                    🔐 E2E
                </span>
                {identity && (
                    <span style={{
                        fontSize: '9px',
                        color: 'var(--text-muted)',
                        fontFamily: 'JetBrains Mono, monospace',
                        letterSpacing: '0.3px',
                    }}>
                        {identity.short_id}
                    </span>
                )}
                <span className="font-mono text-[10px] tracking-wider text-orange-400/80 uppercase mt-0.5">
                    {status?.version || 'v7.2.0'}
                </span>
            </div>
        </div>
    );
}

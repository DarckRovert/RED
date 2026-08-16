"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { localTransport } from "../lib/mesh/localTransport";
import { meshRouter, MeshPeer } from "../lib/mesh/meshRouter";
import { RedAPI } from "../lib/api";
import { toast } from "./Toast";

function RssiBar({ rssi }: { rssi?: number }) {
    if (!rssi) return null;
    const pct = Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100));
    const color = rssi > -65 ? "var(--accent-emerald)" : rssi > -80 ? "var(--accent-amber)" : "var(--accent-crimson)";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 44, height: 4, borderRadius: "2px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "2px" }} />
            </div>
            <span style={{ fontSize: "10px", color, fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{rssi}dBm</span>
        </div>
    );
}

interface UnifiedDevice {
    id: string;              // Canonical hash or raw device ID
    canonicalId: string;     // Resolved canonical identity_hash
    name: string;
    transports: string[];
    rssi?: number;
    isContact: boolean;
    isOnline: boolean;
    rawBleId?: string;
}

export default function NearbyDevicesPanel() {
    const { navigate, goBack, contacts, identity } = useRedStore();
    const [devices, setDevices] = useState<UnifiedDevice[]>([]);
    const [scanAngle, setScanAngle] = useState(0);
    const [connecting, setConnecting] = useState<string | null>(null);

    const myHash = identity?.identity_hash || "";
    const myNickname = (identity?.nickname || "").toLowerCase();

    useEffect(() => {
        const refresh = async () => {
            const contactList = Array.isArray(contacts) ? contacts : [];
            const unifiedMap = new Map<string, UnifiedDevice>();

            // 1. Gather BLE scan results
            const bleList = localTransport.discoveredBluetoothPeers || [];
            for (const b of bleList) {
                const rawId = b.id;
                let name = (b.name || "").trim();
                const lowerName = name.toLowerCase();

                // Filter out non-RED third party devices & own reflection
                if (lowerName.includes("[tv]") || lowerName.includes("samsung") || lowerName.includes("darckpc") || lowerName.includes("desktop-")) continue;
                if (myNickname && (lowerName === myNickname || lowerName === `red-${myNickname}`)) continue;

                const canonicalId = meshRouter.getCanonicalId(rawId) || rawId;
                if (canonicalId === myHash) continue;

                const matchingContact = contactList.find(c =>
                    c.identity_hash === canonicalId ||
                    (canonicalId.length >= 8 && c.identity_hash.startsWith(canonicalId.slice(0, 8))) ||
                    (name && c.display_name.toLowerCase() === name.toLowerCase())
                );

                const finalName = matchingContact?.display_name || (name && name !== "Dispositivo RED" ? name : `Nodo ${canonicalId.slice(0, 6)}…`);
                const isContact = !!matchingContact;

                unifiedMap.set(canonicalId, {
                    id: canonicalId,
                    canonicalId,
                    name: finalName,
                    transports: ['ble'],
                    rssi: b.rssi,
                    isContact,
                    isOnline: true,
                    rawBleId: rawId,
                });
            }

            // 2. Gather active Mesh / WiFi peers
            const meshPeers = meshRouter.getPeerList();
            for (const p of meshPeers) {
                const canonicalId = p.canonicalId || meshRouter.getCanonicalId(p.id) || p.id;
                if (canonicalId === myHash) continue;

                const matchingContact = contactList.find(c =>
                    c.identity_hash === canonicalId ||
                    (canonicalId.length >= 8 && c.identity_hash.startsWith(canonicalId.slice(0, 8)))
                );

                const finalName = matchingContact?.display_name || p.name || `Nodo ${canonicalId.slice(0, 6)}…`;
                const isContact = !!matchingContact;
                const pTransports = p.transports || (p.transport ? [p.transport] : ['wifi']);

                const existing = unifiedMap.get(canonicalId);
                if (existing) {
                    pTransports.forEach(t => {
                        if (!existing.transports.includes(t)) existing.transports.push(t);
                    });
                    if (p.rssi != null && (existing.rssi == null || p.rssi > existing.rssi)) existing.rssi = p.rssi;
                    if (isContact) {
                        existing.isContact = true;
                        existing.name = finalName;
                    }
                } else {
                    unifiedMap.set(canonicalId, {
                        id: canonicalId,
                        canonicalId,
                        name: finalName,
                        transports: pTransports,
                        rssi: p.rssi,
                        isContact,
                        isOnline: true,
                    });
                }
            }

            // 3. Gather Rust node API peers (WiFi Direct / libp2p)
            try {
                const apiPeers = await RedAPI.getPeers().catch(() => []);
                for (const ap of apiPeers) {
                    const canonicalId = meshRouter.getCanonicalId(ap.id) || ap.id;
                    if (canonicalId === myHash) continue;

                    const existing = unifiedMap.get(canonicalId);
                    if (existing) {
                        if (!existing.transports.includes('wifi')) existing.transports.push('wifi');
                    } else {
                        const matchingContact = contactList.find(c => c.identity_hash === canonicalId);
                        unifiedMap.set(canonicalId, {
                            id: canonicalId,
                            canonicalId,
                            name: matchingContact?.display_name || `Nodo ${canonicalId.slice(0, 6)}…`,
                            transports: ['wifi'],
                            isContact: !!matchingContact,
                            isOnline: true,
                        });
                    }
                }
            } catch {}

            setDevices(Array.from(unifiedMap.values()));
        };

        refresh();
        const interval = setInterval(refresh, 2500);
        return () => clearInterval(interval);
    }, [contacts, identity]);

    useEffect(() => {
        const t = setInterval(() => setScanAngle(a => (a + 4) % 360), 30);
        return () => clearInterval(t);
    }, []);

    const handleConnect = async (dev: UnifiedDevice) => {
        setConnecting(dev.id);
        try {
            if (dev.rawBleId) {
                await localTransport.connectBluetooth(dev.rawBleId);
            }
            const store = useRedStore.getState();
            await store.addContact(dev.canonicalId, dev.name);
            toast.success(`✅ Enlace con ${dev.name} establecido`);
        } catch {
            toast.error("Error al conectar dispositivo");
        } finally {
            setConnecting(null);
        }
    };

    const handleOpenChat = (dev: UnifiedDevice) => {
        navigate("chat", dev.canonicalId);
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
                    }}>📡</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Radar de Dispositivos Cercanos
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            MULTI-TRANSPORT · BLE & WIFI DIRECT DISCOVERY
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
                        title="Cerrar radar"
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "20px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Radar Visual */}
                    <div className="card-tactical animate-enter" style={{ padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                        <div style={{
                            position: "relative", width: "180px", height: "180px",
                            borderRadius: "50%", border: "2px solid rgba(0,229,255,0.3)",
                            background: "radial-gradient(circle, rgba(0,229,255,0.06) 0%, rgba(8,8,16,0.9) 70%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            overflow: "hidden"
                        }}>
                            <div style={{ position: "absolute", width: "120px", height: "120px", borderRadius: "50%", border: "1px dashed rgba(0,229,255,0.2)" }} />
                            <div style={{ position: "absolute", width: "60px", height: "60px", borderRadius: "50%", border: "1px dashed rgba(0,229,255,0.2)" }} />
                            
                            {/* Sweeper beam */}
                            <div style={{
                                position: "absolute", inset: 0,
                                background: `conic-gradient(from ${scanAngle}deg at 50% 50%, rgba(0,229,255,0.4) 0deg, transparent 60deg, transparent 360deg)`
                            }} />

                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 0 10px #fff" }} />
                        </div>

                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                            ESCANEANDO FRECUENCIAS BLUETOOTH LE & WIFI DIRECT
                        </div>
                    </div>

                    {/* Lista de Dispositivos Detectados */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>DISPOSITIVOS EN RADIO ({devices.length})</span>
                            <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                RESOLUCIÓN CANÓNICA ACTIVA
                            </span>
                        </div>

                        {devices.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">📡</div>
                                <div className="empty-state-title">Buscando Nodos Cercanos...</div>
                                <div className="empty-state-desc">
                                    Los nodos RED con Bluetooth LE o WiFi activo aparecerán automáticamente.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {devices.map(dev => (
                                    <div key={dev.id} className="card-tactical" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <div style={{ fontSize: "0.90rem", fontWeight: 800, color: dev.isContact ? "var(--accent-emerald)" : "#fff" }}>
                                                    {dev.name}
                                                </div>
                                                <div style={{ display: "flex", gap: "4px" }}>
                                                    {dev.transports.map(t => (
                                                        <span key={t} className={`badge-tactical ${t === 'ble' ? 'badge-tactical-cyan' : t === 'wifi' ? 'badge-tactical-emerald' : 'badge-tactical-amber'}`} style={{ fontSize: "0.60rem", padding: "1px 5px" }}>
                                                            {t.toUpperCase()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                                                    DID: {dev.canonicalId.slice(0, 16)}…
                                                </span>
                                                {dev.rssi != null && <RssiBar rssi={dev.rssi} />}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {dev.isContact ? (
                                                <button
                                                    onClick={() => handleOpenChat(dev)}
                                                    className="btn-tactical-primary"
                                                    style={{ padding: "6px 14px", fontSize: "0.76rem", background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)", color: "#000" }}
                                                >
                                                    💬 Chat
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleConnect(dev)}
                                                    disabled={connecting === dev.id}
                                                    className="btn-tactical-primary"
                                                    style={{ padding: "6px 14px", fontSize: "0.76rem" }}
                                                >
                                                    {connecting === dev.id ? "Enlazando..." : "+ Guardar"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
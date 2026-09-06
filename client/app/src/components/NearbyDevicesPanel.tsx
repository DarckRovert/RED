"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { localTransport } from "../lib/mesh/localTransport";
import { meshRouter, MeshPeer, normalizeIdentity, isNameSimilar } from "../lib/mesh/meshRouter";
import { RedAPI, getProximityNodes } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";

function RssiBar({ rssi }: { rssi?: number | null }) {
    if (rssi == null) return null;
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
    rssi?: number | null;
    isContact: boolean;
    isOnline: boolean;
    rawBleId?: string;
    distance_meters?: number | null;
    azimuth?: number | null;
}

export default function NearbyDevicesPanel() {
    const { t } = useTranslation();
    const { navigate, goBack, contacts, identity } = useRedStore();
    const [devices, setDevices] = useState<UnifiedDevice[]>([]);
    const [scanAngle, setScanAngle] = useState(0);
    const [connecting, setConnecting] = useState<string | null>(null);

    useEffect(() => {
        const refresh = async () => {
            const contactList = Array.isArray(contacts) ? contacts : [];
            const myHash = normalizeIdentity(identity?.identity_hash || "");
            const myNickname = (identity?.nickname || "").toLowerCase();

            // Unified map of devices keyed by resolved canonical ID
            const unifiedMap = new Map<string, UnifiedDevice>();

            const findMatchingContact = (id: string, name?: string) => {
                const normId = normalizeIdentity(id);
                return contactList.find(c => {
                    const cHash = normalizeIdentity(c.identity_hash || "");
                    if (cHash && (cHash === normId || (normId.length >= 8 && cHash.startsWith(normId.slice(0, 8))) || (cHash.length >= 8 && normId.startsWith(cHash.slice(0, 8))))) {
                        return true;
                    }
                    if (name && c.display_name && isNameSimilar(c.display_name, name)) {
                        return true;
                    }
                    return false;
                });
            };

            const registerOrMergeDevice = (
                rawId: string,
                initialName: string,
                transport: string,
                rssi?: number | null,
                rawBleId?: string,
                distance_meters?: number | null,
                azimuth?: number | null
            ) => {
                const normId = normalizeIdentity(rawId);
                let resolvedCanonical = meshRouter.getCanonicalId(normId) || normId;
                if (resolvedCanonical === myHash || normId === myHash) return;

                const contact = findMatchingContact(resolvedCanonical, initialName) || findMatchingContact(normId, initialName);
                if (contact?.identity_hash) {
                    resolvedCanonical = normalizeIdentity(contact.identity_hash);
                }

                // Check if already present in unifiedMap by canonicalId, rawId, or similar name
                let existingKey: string | undefined;
                if (unifiedMap.has(resolvedCanonical)) {
                    existingKey = resolvedCanonical;
                } else if (unifiedMap.has(normId)) {
                    existingKey = normId;
                } else {
                    for (const [k, d] of unifiedMap.entries()) {
                        if (
                            d.canonicalId === resolvedCanonical || 
                            d.id === normId || 
                            (d.rawBleId && normalizeIdentity(d.rawBleId) === normId) ||
                            (initialName && d.name && isNameSimilar(d.name, initialName))
                        ) {
                            existingKey = k;
                            break;
                        }
                    }
                }

                const isContact = !!contact;
                let finalName = contact?.display_name || (initialName && initialName !== 'Dispositivo RED' ? initialName : '');
                
                if (existingKey) {
                    const existing = unifiedMap.get(existingKey)!;
                    if (!existing.transports.includes(transport)) {
                        existing.transports.push(transport);
                    }
                    if (rssi != null && (existing.rssi == null || rssi > existing.rssi)) {
                        existing.rssi = rssi;
                    }
                    if (distance_meters != null) {
                        existing.distance_meters = distance_meters;
                    }
                    if (azimuth != null) {
                        existing.azimuth = azimuth;
                    }
                    if (rawBleId && !existing.rawBleId) {
                        existing.rawBleId = rawBleId;
                    }
                    if (resolvedCanonical.length === 64 && existing.canonicalId.length !== 64) {
                        existing.canonicalId = resolvedCanonical;
                        existing.id = resolvedCanonical;
                    }
                    if (isContact) {
                        existing.isContact = true;
                        if (finalName) existing.name = finalName;
                    } else if (finalName && (!existing.name || existing.name.startsWith('Nodo ') || existing.name === 'Dispositivo RED')) {
                        existing.name = finalName;
                    }
                    // Re-key if canonical upgraded to 64-hex
                    if (existingKey !== existing.canonicalId) {
                        unifiedMap.delete(existingKey);
                        unifiedMap.set(existing.canonicalId, existing);
                    }
                } else {
                    if (!finalName) {
                        finalName = `Nodo ${resolvedCanonical.slice(0, 6)}…`;
                    }
                    unifiedMap.set(resolvedCanonical, {
                        id: resolvedCanonical,
                        canonicalId: resolvedCanonical,
                        name: finalName,
                        transports: [transport],
                        rssi,
                        distance_meters,
                        azimuth,
                        isContact,
                        isOnline: true,
                        rawBleId: rawBleId || (transport === 'ble' ? rawId : undefined)
                    });
                }
            };

            // 1. Process BLE scan results
            const bleList = localTransport.discoveredBluetoothPeers || [];
            for (const b of bleList) {
                const name = (b.name || "").trim();
                const lowerName = name.toLowerCase();

                if (lowerName.includes("[tv]") || lowerName.includes("samsung") || lowerName.includes("darckpc") || lowerName.includes("desktop-")) continue;
                if (myNickname && (lowerName === myNickname || lowerName === `red-${myNickname}`)) continue;

                registerOrMergeDevice(b.id, name, 'ble', b.rssi, b.id);
            }

            // 2. Process active Mesh / WiFi peers
            const meshPeers = meshRouter.getPeerList();
            for (const p of meshPeers) {
                const pTransports = p.transports || (p.transport ? [p.transport] : ['wifi']);
                for (const t of pTransports) {
                    registerOrMergeDevice(p.canonicalId || p.id, p.name || '', t, p.rssi);
                }
            }

            // 3. Process Rust node API peers
            try {
                const apiPeers = await RedAPI.getPeers().catch(() => []);
                for (const ap of apiPeers) {
                    registerOrMergeDevice(ap.id, ap.name || '', 'wifi');
                }
            } catch {}

            // 4. Process Proximity Radar nodes from Rust core (/api/proximity)
            try {
                const proxNodes = await getProximityNodes().catch(() => []);
                for (const pn of proxNodes) {
                    registerOrMergeDevice(pn.id, pn.name, pn.transport || 'mesh', pn.rssi, undefined, pn.distance_meters, pn.azimuth);
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
            const resolvedCanonical = meshRouter.getCanonicalId(dev.canonicalId) || dev.canonicalId;
            const store = useRedStore.getState();
            await store.addContact(resolvedCanonical, dev.name);
            toast.success(`✅ Enlace con ${dev.name} establecido`);
        } catch {
            toast.error("Error al conectar dispositivo");
        } finally {
            setConnecting(null);
        }
    };

    const handleOpenChat = (dev: UnifiedDevice) => {
        const resolvedCanonical = meshRouter.getCanonicalId(dev.canonicalId) || dev.canonicalId;
        navigate("chat", resolvedCanonical);
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
                            {t.diagnostics_module?.nearby_devices || "Radar de Dispositivos Cercanos"}
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
                        ⚙️ {t.nav?.settings || "Filtros"}
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar radar"}
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

                            {/* Detected Devices Radar Blips */}
                            {devices.map((dev, idx) => {
                                const angle = (dev.azimuth ?? ((idx * (360 / Math.max(devices.length, 1)) + 30) % 360)) * (Math.PI / 180);
                                const maxR = 74;
                                const minR = 24;
                                const r = dev.distance_meters != null
                                    ? Math.min(maxR, Math.max(minR, (dev.distance_meters / 40) * maxR))
                                    : dev.rssi != null
                                        ? Math.min(maxR, Math.max(minR, ((Math.abs(dev.rssi) - 40) / 60) * maxR))
                                        : minR + ((idx * 17) % (maxR - minR));
                                const x = 90 + r * Math.cos(angle);
                                const y = 90 + r * Math.sin(angle);
                                const isGreen = dev.isContact;
                                return (
                                    <div
                                        key={dev.id}
                                        title={`${dev.name} ${dev.distance_meters != null ? `(${dev.distance_meters.toFixed(1)}m)` : dev.rssi != null ? `(${dev.rssi}dBm)` : ''}`}
                                        style={{
                                            position: "absolute",
                                            left: `${x}px`,
                                            top: `${y}px`,
                                            transform: "translate(-50%, -50%)",
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            background: isGreen ? "var(--accent-emerald, #00E676)" : "var(--accent-cyan, #00E5FF)",
                                            boxShadow: isGreen ? "0 0 10px #00E676" : "0 0 10px #00E5FF",
                                            zIndex: 5,
                                            transition: "all 0.5s ease"
                                        }}
                                    />
                                );
                            })}

                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 0 10px #fff", zIndex: 6 }} />
                        </div>

                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                            {t.sidebar?.status_mesh || "ESCANEANDO FRECUENCIAS BLUETOOTH LE & WIFI DIRECT"}
                        </div>
                    </div>

                    {/* Lista de Dispositivos Detectados */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{t.diagnostics_module?.nearby_devices || "DISPOSITIVOS EN RADIO"} ({devices.length})</span>
                            <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                RESOLUCIÓN CANÓNICA ACTIVA
                            </span>
                        </div>

                        {devices.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">📡</div>
                                <div className="empty-state-title">{t.sidebar?.no_contacts || "Buscando Nodos Cercanos..."}</div>
                                <div className="empty-state-desc">
                                    {t.sidebar?.no_contacts_desc || "Los nodos RED con Bluetooth LE o WiFi activo aparecerán automáticamente."}
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
                                                    💬 {t.dock?.chats || "Chat"}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleConnect(dev)}
                                                    disabled={connecting === dev.id}
                                                    className="btn-tactical-primary"
                                                    style={{ padding: "6px 14px", fontSize: "0.76rem" }}
                                                >
                                                    {connecting === dev.id ? (t.common?.loading || "Enlazando...") : `+ ${t.common?.save || "Guardar"}`}
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
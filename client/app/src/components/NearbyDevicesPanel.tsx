"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { localTransport } from "../lib/mesh/localTransport";
import { RedDevice } from "../lib/mesh/bluetoothTransport";
import { MeshPeer } from "../lib/mesh/meshRouter";
import { RedAPI } from "../lib/api";

const TRANSPORT_COLOR: Record<string, string> = {
    wifi:      '#00D97E',
    ble:       '#3498db',
    lorawan:   '#9b59b6',
};
const TRANSPORT_ICON: Record<string, string> = {
    wifi:    '📶',
    ble:     '🔵',
    lorawan: '📻',
};

function RssiBar({ rssi }: { rssi?: number }) {
    if (!rssi) return null;
    // -50 = excellent, -70 = good, -90 = weak
    const pct = Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100));
    const color = rssi > -65 ? '#00D97E' : rssi > -80 ? '#FFA726' : '#E8213A';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 48, height: 4, borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ fontSize: '10px', color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{rssi}dBm</span>
        </div>
    );
}

export default function NearbyDevicesPanel() {
    const { navigate } = useRedStore();
    const [bleDevices, setBleDevices] = useState<RedDevice[]>([]);
    const [meshPeers, setMeshPeers] = useState<MeshPeer[]>([]);
    const [scanAngle, setScanAngle] = useState(0);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const refresh = async () => {
            setBleDevices([...localTransport.discoveredBluetoothPeers]);
            try {
                const apiPeers = await RedAPI.getPeers().catch(() => []);
                const localPeers = localTransport.allPeers;
                const map = new Map<string, MeshPeer>();
                for (const p of localPeers) {
                    map.set(p.id, p);
                }
                for (const ap of apiPeers) {
                    if (!map.has(ap.id)) {
                        map.set(ap.id, {
                            id: ap.id,
                            transport: (ap.transport as any) || 'wifi',
                            lastSeen: Date.now(),
                        });
                    }
                }
                setMeshPeers(Array.from(map.values()));
            } catch {
                setMeshPeers([...localTransport.allPeers]);
            }
        };
        refresh();
        const interval = setInterval(refresh, 2500);
        return () => clearInterval(interval);
    }, []);

    // Radar sweep animation
    useEffect(() => {
        const t = setInterval(() => setScanAngle(a => (a + 3) % 360), 30);
        return () => clearInterval(t);
    }, []);

    const handleConnect = async (deviceId: string, deviceName?: string) => {
        setConnecting(deviceId);
        try {
            await localTransport.connectBluetooth(deviceId);
            setConnectedIds(s => new Set(s).add(deviceId));
            const store = useRedStore.getState();
            await store.addContact(deviceId, deviceName || `Nodo RED (${deviceId.substring(0, 6)})`);
            // Add peer directly to meshPeers list so it moves to active relay section
            setMeshPeers(prev => {
                if (prev.some(p => p.id === deviceId)) return prev;
                return [...prev, { id: deviceId, transport: 'ble', lastSeen: Date.now(), rssi: -50 }];
            });
            const { toast } = await import("./Toast");
            toast.success(`✅ Conectado y enlazado con ${deviceName || 'Nodo RED'}`);
        } catch (e) {
            console.error("BLE connect failed:", e);
            const { toast } = await import("./Toast");
            toast.error(`❌ Error de conexión BLE`);
        } finally {
            setConnecting(null);
        }
    };

    const totalNodes = meshPeers.length + bleDevices.length;

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(8,8,16,0.98), rgba(13,13,22,0.98))',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--solid-border)',
            margin: '16px', overflow: 'hidden',
        }}>
            {/* Panel header */}
            <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--solid-border)',
                display: 'flex', alignItems: 'center', gap: '14px',
                background: 'linear-gradient(90deg, rgba(232,33,58,0.05), transparent)',
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{ background: 'transparent', border: 'none', color: '#00D97E', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}
                >
                    ← Volver
                </button>

                {/* Mini radar */}
                <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        border: '1.5px solid rgba(0,217,126,0.2)',
                    }} />
                    <div style={{
                        position: 'absolute', inset: 6, borderRadius: '50%',
                        border: '1px solid rgba(0,217,126,0.12)',
                    }} />
                    {/* Sweep */}
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: `conic-gradient(transparent ${scanAngle - 60}deg, rgba(0,217,126,0.25) ${scanAngle - 20}deg, rgba(0,217,126,0.08) ${scanAngle}deg, transparent ${scanAngle + 5}deg)`,
                    }} />
                    {/* Center dot */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        width: 5, height: 5, marginTop: -2.5, marginLeft: -2.5,
                        borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)',
                    }} />
                    {/* Blips for each peer */}
                    {meshPeers.slice(0, 4).map((_, i) => {
                        const angle = (i * 90 + 30) * (Math.PI / 180);
                        const r = 10 + (i % 2) * 5;
                        return (
                            <div key={i} style={{
                                position: 'absolute', width: 3, height: 3, borderRadius: '50%',
                                background: 'var(--success)', boxShadow: '0 0 4px var(--success)',
                                top: `calc(50% + ${Math.sin(angle) * r}px - 1.5px)`,
                                left: `calc(50% + ${Math.cos(angle) * r}px - 1.5px)`,
                            }} />
                        );
                    })}
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
                        RED MESH — NODOS CERCANOS
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', boxShadow: '0 0 4px var(--success)', animation: 'pulse-glow 2s infinite' }} />
                        Escaneando · {totalNodes} nodo{totalNodes !== 1 ? 's' : ''} en rango
                    </div>
                </div>

                {totalNodes > 0 && (
                    <div style={{
                        padding: '4px 10px', borderRadius: '20px',
                        background: 'rgba(0,217,126,0.1)', border: '1px solid rgba(0,217,126,0.25)',
                        color: 'var(--success)', fontSize: '0.72rem', fontWeight: 800,
                        fontFamily: 'JetBrains Mono, monospace',
                    }}>
                        +{totalNodes}
                    </div>
                )}
            </div>

            {/* Content */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Active mesh peers */}
                {meshPeers.length > 0 && (
                    <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Malla Activa — {meshPeers.length} Relay{meshPeers.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {meshPeers.map(peer => {
                                const color = TRANSPORT_COLOR[peer.transport] || '#888';
                                return (
                                    <div key={peer.id} className="mesh-peer-active" style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                        background: `${color}08`,
                                        border: `1px solid ${color}30`,
                                        transition: 'all 0.3s ease',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                                                background: `${color}15`, border: `1px solid ${color}30`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.1rem',
                                            }}>
                                                {TRANSPORT_ICON[peer.transport] || '📡'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                                                    {peer.id.slice(0, 18)}…
                                                </div>
                                                <div style={{ marginTop: '3px' }}>
                                                    <RssiBar rssi={peer.rssi} />
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <span style={{
                                                fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
                                                background: `${color}18`, color, fontWeight: 800,
                                                border: `1px solid ${color}30`,
                                                fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.3px',
                                            }}>
                                                {peer.transport.toUpperCase()} RELAY
                                            </span>
                                            <span style={{ fontSize: '9px', color: 'var(--success)', fontWeight: 600 }}>✓ Enrutando</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* BLE discovered */}
                {bleDevices.length > 0 && (
                    <div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Descubiertos por BLE — Sin conectar
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {bleDevices.map((dev, i) => {
                                const isConnecting = connecting === dev.id;
                                const isConnected = connectedIds.has(dev.id);
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 14px', borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-deep)', border: '1px solid var(--solid-border)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                                                background: 'rgba(52,152,219,0.1)', border: '1px solid rgba(52,152,219,0.25)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                                            }}>🔵</div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                    {dev.name || 'Nodo RED'}
                                                </div>
                                                <div style={{ marginTop: '3px' }}>
                                                    <RssiBar rssi={dev.rssi} />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => !isConnected && handleConnect(dev.id, dev.name)}
                                            disabled={isConnecting}
                                            className="btn-secondary"
                                            style={{
                                                padding: '7px 14px', fontSize: '0.75rem', fontWeight: 700,
                                                background: isConnected ? 'rgba(0,217,126,0.12)' : undefined,
                                                borderColor: isConnected ? 'rgba(0,217,126,0.3)' : undefined,
                                                color: isConnected ? 'var(--success)' : undefined,
                                                minWidth: 80, cursor: 'pointer',
                                            }}
                                        >
                                            {isConnecting ? (
                                                <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                            ) : isConnected ? '✓ Enlazado' : 'Conectar'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {meshPeers.length === 0 && bleDevices.length === 0 && (
                    <div style={{ padding: '28px 0', textAlign: 'center' }}>
                        {/* Pulsing radar rings */}
                        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 20px' }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    position: 'absolute', inset: `${i * 10}px`,
                                    borderRadius: '50%', border: '1px solid rgba(0,217,126,0.2)',
                                    animation: `radarPing ${1.5 + i * 0.5}s ease-out infinite`,
                                    animationDelay: `${i * 0.5}s`,
                                }} />
                            ))}
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.8rem',
                            }}>📡</div>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>Escaneando el perímetro…</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px', lineHeight: 1.5 }}>
                            Activa WiFi y Bluetooth<br/>Los nodos RED aparecerán aquí
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

/**
 * RED — Nearby Devices Panel
 * Shows discovered BLE and WiFi Direct peers with a radar animation,
 * connection controls, and real-time signal strength indicators.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getLocalTransport, LocalPeer, TransportMode } from '../lib/localTransport';
import { meshProtocol } from '../lib/meshProtocol';

// ─────────────────────────────── TYPES ───────────────────────────────

interface NearbyDevicesPanelProps {
    localId: string;
    onPeerConnected?: (peer: LocalPeer) => void;
}

// ─────────────────────────────── HELPERS ───────────────────────────────

const TRANSPORT_ICONS: Record<TransportMode, string> = {
    bluetooth: '📶',
    wifi: '📡',
    mesh: '🕸️',
    internet: '🌐',
};

const TRANSPORT_LABELS: Record<TransportMode, string> = {
    bluetooth: 'Bluetooth',
    wifi: 'WiFi Direct',
    mesh: 'Mesh Relay',
    internet: 'Internet',
};

function SignalBar({ strength }: { strength: number }) {
    // strength: 0–4 bars
    return (
        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
            {[1, 2, 3, 4].map(level => (
                <div
                    key={level}
                    style={{
                        width: '4px',
                        height: `${level * 4}px`,
                        borderRadius: '1px',
                        background: level <= strength
                            ? (strength >= 3 ? '#22c55e' : strength === 2 ? '#f59e0b' : '#ef4444')
                            : 'rgba(255,255,255,0.12)',
                        transition: 'background 0.3s',
                    }}
                />
            ))}
        </div>
    );
}

function RadarCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rawCtx = canvas.getContext('2d');
        if (!rawCtx) return;
        // Reassign to non-nullable type so closures keep the narrowed type
        const ctx: CanvasRenderingContext2D = rawCtx;
        const SIZE = 180;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const cx = SIZE / 2, cy = SIZE / 2;
        let angle = 0;
        let raf: number;

        const DOTS = [
            { a: 0.8, d: 48 }, { a: 2.2, d: 65 }, { a: 3.9, d: 42 }, { a: 5.1, d: 70 },
        ];

        function draw() {
            ctx.clearRect(0, 0, SIZE, SIZE);
            // Rings
            [28, 52, 76, 86].forEach(r => {
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(232,0,28,0.13)';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
            // Cross
            ctx.strokeStyle = 'rgba(232,0,28,0.08)';
            ctx.beginPath(); ctx.moveTo(cx - 86, cy); ctx.lineTo(cx + 86, cy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx, cy - 86); ctx.lineTo(cx, cy + 86); ctx.stroke();

            // Sweep
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            const g = ctx.createLinearGradient(0, 0, 86, 0);
            g.addColorStop(0, 'rgba(232,0,28,0.65)');
            g.addColorStop(1, 'rgba(232,0,28,0)');
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 86, -0.35, 0);
            ctx.closePath();
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();

            // Dots
            DOTS.forEach(d => {
                const dx = cx + Math.cos(d.a) * d.d;
                const dy = cy + Math.sin(d.a) * d.d;
                const diff = ((angle - d.a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
                const fade = Math.max(0, 1 - diff / (Math.PI * 0.7));
                ctx.beginPath();
                ctx.arc(dx, dy, 5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,45,71,${0.3 + fade * 0.7})`;
                ctx.fill();
                if (fade > 0.4) {
                    ctx.beginPath();
                    ctx.arc(dx, dy, 10, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(232,0,28,${fade * 0.2})`;
                    ctx.fill();
                }
            });

            // Center
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#00a884';
            ctx.fill();

            angle = (angle + 0.025) % (2 * Math.PI);
            raf = requestAnimationFrame(draw);
        }
        draw();
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-label="Radar de dispositivos cercanos"
            style={{ borderRadius: '50%', display: 'block' }}
        />
    );
}

// ─────────────────────────────── MAIN COMPONENT ───────────────────────────────

export default function NearbyDevicesPanel({ localId, onPeerConnected }: NearbyDevicesPanelProps) {
    const [peers, setPeers] = useState<LocalPeer[]>([]);
    const [scanning, setScanning] = useState(false);
    const [wifiActive, setWifiActive] = useState(false);
    const [meshCount, setMeshCount] = useState(0);
    const [log, setLog] = useState<string[]>([]);
    const transportRef = useRef<ReturnType<typeof getLocalTransport> | null>(null);

    const addLog = useCallback((msg: string) => {
        setLog(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 20));
    }, []);

    useEffect(() => {
        const transport = getLocalTransport(localId);
        transportRef.current = transport;

        const unsub = transport.onMessage((msg) => {
            addLog(`📨 Mensaje de ${msg.from.slice(0, 12)}… vía ${msg.transport}`);
        });

        // Poll peers every 2s
        const interval = setInterval(() => {
            setPeers(transport.localPeers);
            setMeshCount(meshProtocol.storedCount);
        }, 2000);

        return () => {
            unsub();
            clearInterval(interval);
        };
    }, [localId, addLog]);

    const handleToggleWifi = async () => {
        const transport = transportRef.current;
        if (!transport) return;
        if (wifiActive) {
            transport.stopWifi();
            setWifiActive(false);
            addLog('📡 WiFi Direct desactivado');
        } else {
            addLog('📡 Iniciando WiFi Direct...');
            await transport.startWifi();
            setWifiActive(true);
            addLog('📡 WiFi Direct activo — escuchando en LAN');
        }
    };

    const handleScanBluetooth = async () => {
        const transport = transportRef.current;
        if (!transport) return;
        setScanning(true);
        addLog('📶 Escaneando dispositivos Bluetooth...');
        try {
            const peer = await transport.scanBluetooth();
            if (peer) {
                setPeers(prev => [...prev.filter(p => p.id !== peer.id), peer]);
                addLog(`✅ Conectado: ${peer.name} vía BLE`);
                onPeerConnected?.(peer);
            } else {
                addLog('❌ Ningún dispositivo seleccionado');
            }
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
            addLog(`❌ Error BLE: ${errorMsg}`);
        } finally {
            setScanning(false);
        }
    };

    const transportColor = (mode: TransportMode) => ({
        bluetooth: '#3b82f6',
        wifi: '#22c55e',
        mesh: '#f59e0b',
        internet: '#6366f1',
    }[mode] ?? '#888');

    return (
        <div id="nearby-devices-panel" style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            padding: '24px',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, sans-serif',
            maxWidth: '480px',
            width: '100%',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                    width: '40px', height: '40px', background: 'var(--primary-dim)',
                    border: '1px solid var(--primary)', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                }}>📡</div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Dispositivos Cercanos</div>
                    <div style={{ fontSize: '0.75rem', color: '#55556a' }}>
                        {peers.filter(p => p.connected).length} conectados • {meshCount} mensajes en mesh
                    </div>
                </div>
            </div>

            {/* Radar + controls */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
                <RadarCanvas />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                        id="btn-scan-wifi"
                        onClick={handleToggleWifi}
                        style={{
                            padding: '11px 16px',
                            borderRadius: '10px',
                            border: `1px solid ${wifiActive ? '#22c55e44' : 'rgba(255,255,255,0.1)'}`,
                            background: wifiActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                            color: wifiActive ? '#22c55e' : '#a0a0b8',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <span>📡</span>
                        {wifiActive ? 'WiFi Activo' : 'Activar WiFi LAN'}
                    </button>

                    <button
                        id="btn-scan-ble"
                        onClick={handleScanBluetooth}
                        disabled={scanning}
                        style={{
                            padding: '11px 16px',
                            borderRadius: '10px',
                            border: '1px solid var(--glass-border)',
                            background: scanning ? 'var(--primary-glow)' : 'var(--surface)',
                            color: scanning ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: scanning ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <span>📶</span>
                        {scanning ? 'Escaneando…' : 'Escanear BLE'}
                    </button>

                    {/* Stats mini */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '0.78rem',
                        color: '#55556a',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span>📦 Mesh store</span>
                            <span style={{ color: '#f4f4f8', fontWeight: 600 }}>{meshCount} msgs</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>📊 Entregados</span>
                            <span style={{ color: '#22c55e', fontWeight: 600 }}>
                                {meshProtocol.stats_.delivered}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Peer list */}
            {peers.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {peers.map(peer => (
                        <div
                            key={peer.id}
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid ${peer.connected ? 'rgba(255,255,255,0.08)' : 'rgba(232,0,28,0.15)'}`,
                                borderRadius: '12px',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: peer.connected ? '#22c55e' : '#ef4444',
                                boxShadow: peer.connected ? '0 0 6px #22c55e' : 'none',
                                flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {peer.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#55556a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: transportColor(peer.transport) }}>
                                        {TRANSPORT_ICONS[peer.transport]}
                                    </span>
                                    {TRANSPORT_LABELS[peer.transport]}
                                    {peer.rssi !== undefined && ` · ${peer.rssi} dBm`}
                                </div>
                            </div>
                            <SignalBar strength={peer.connected ? (peer.rssi !== undefined ? Math.max(0, Math.min(4, Math.round((peer.rssi + 100) / 25))) : 3) : 0} />
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{
                    textAlign: 'center', padding: '24px 0', color: '#55556a',
                    fontSize: '0.85rem', marginBottom: '16px',
                }}>
                    Sin dispositivos cercanos detectados.<br />
                    Activa WiFi LAN o escanea Bluetooth.
                </div>
            )}

            {/* Activity log */}
            {log.length > 0 && (
                <div style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.7rem',
                    color: '#55556a',
                }}>
                    {log.map((entry, i) => (
                        <div key={i} style={{ marginBottom: '4px', color: i === 0 ? '#a0a0b8' : '#55556a' }}>
                            {entry}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

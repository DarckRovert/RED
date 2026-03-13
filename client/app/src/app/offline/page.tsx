'use client';

/**
 * RED — Offline Mode Page (/offline)
 * Dedicated page for managing BLE, WiFi Direct, and mesh connectivity
 * when internet/cellular is unavailable.
 */

import { useState } from 'react';
import NearbyDevicesPanel from '../../components/NearbyDevicesPanel';
import { LocalPeer, TransportMode } from '../../lib/localTransport';
import { meshProtocol } from '../../lib/meshProtocol';

// Generate an ephemeral device ID if the main DB is unreachable in strict offline mode
const FALLBACK_LOCAL_ID = typeof window !== 'undefined'
    ? (localStorage.getItem('red_ephemeral_id') || (() => {
        const newId = 'n-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('red_ephemeral_id', newId);
        return newId;
    })())
    : 'n-offline';

const MODE_CONFIG: Record<string, { icon: string; title: string; desc: string; color: string }> = {
    bluetooth: { icon: '📶', title: 'Bluetooth BLE', desc: 'Hasta ~100m · Bajo consumo', color: '#3b82f6' },
    wifi: { icon: '📡', title: 'WiFi Direct', desc: 'LAN local · Alta velocidad', color: '#22c55e' },
    mesh: { icon: '🕸️', title: 'Mesh Relay', desc: 'Store-and-forward entre nodos', color: '#f59e0b' },
    internet: { icon: '🌐', title: 'Internet', desc: 'RED P2P sobre internet', color: '#6366f1' },
};

interface MeshStatsBoxProps {
    stored: number;
    delivered: number;
    dropped: number;
    forwarded: number;
}

function MeshStatsBox({ stored, delivered, dropped, forwarded }: MeshStatsBoxProps) {
    return (
        <div style={{
            background: '#10101a',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '16px',
            padding: '20px 24px',
            color: '#f4f4f8',
        }}>
            <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.9rem' }}>
                📦 Estadísticas Mesh
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                    { label: 'En espera', value: stored, color: '#f59e0b' },
                    { label: 'Entregados', value: delivered, color: '#22c55e' },
                    { label: 'Descartados', value: dropped, color: '#ef4444' },
                    { label: 'Reenviados', value: forwarded, color: '#3b82f6' },
                ].map(({ label, value, color }) => (
                    <div key={label} style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '10px',
                        padding: '12px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: '0.72rem', color: '#55556a', marginTop: '4px' }}>{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ActiveModeCard({ mode }: { mode: string }) {
    const cfg = MODE_CONFIG[mode];
    if (!cfg) return null;
    return (
        <div style={{
            background: `rgba(${mode === 'bluetooth' ? '59,130,246' : mode === 'wifi' ? '34,197,94' : mode === 'mesh' ? '245,158,11' : '99,102,241'},0.08)`,
            border: `1px solid ${cfg.color}44`,
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            color: '#f4f4f8',
        }}>
            <div style={{
                width: '48px', height: '48px',
                background: `${cfg.color}22`,
                border: `1px solid ${cfg.color}44`,
                borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', flexShrink: 0,
            }}>{cfg.icon}</div>
            <div>
                <div style={{ fontWeight: 700 }}>{cfg.title}</div>
                <div style={{ fontSize: '0.8rem', color: '#a0a0b8' }}>{cfg.desc}</div>
            </div>
            <div style={{
                marginLeft: 'auto',
                width: '10px', height: '10px', borderRadius: '50%',
                background: cfg.color,
                boxShadow: `0 0 8px ${cfg.color}`,
                animation: 'pulse 2s infinite',
            }} />
        </div>
    );
}

export default function OfflinePage() {
    const [connectedPeers, setConnectedPeers] = useState<LocalPeer[]>([]);
    const [activeMode, setActiveMode] = useState<TransportMode>('internet');
    const stats = meshProtocol.stats_;

    const handlePeerConnected = (peer: LocalPeer) => {
        setConnectedPeers(prev => [...prev.filter(p => p.id !== peer.id), peer]);
        setActiveMode(peer.transport);
    };

    return (
        <main id="offline-page" style={{
            minHeight: '100vh',
            background: '#030305',
            color: '#f4f4f8',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '0',
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.85)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

            {/* Header */}
            <div style={{
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(10,10,15,0.9)',
                backdropFilter: 'blur(20px)',
                position: 'sticky', top: 0, zIndex: 10,
            }}>
                <button
                    id="btn-back-offline"
                    onClick={() => window.history.back()}
                    style={{ background: 'none', border: 'none', color: '#a0a0b8', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
                    aria-label="Volver"
                >←</button>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Modo Sin Conexión</div>
                <div style={{
                    marginLeft: 'auto',
                    padding: '4px 12px',
                    borderRadius: '100px',
                    background: activeMode === 'internet' ? 'rgba(232,0,28,0.12)' : 'rgba(34,197,94,0.12)',
                    border: `1px solid ${activeMode === 'internet' ? '#e8001c44' : '#22c55e44'}`,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: activeMode === 'internet' ? '#ff2d47' : '#22c55e',
                }}>
                    {activeMode === 'internet' ? '∅ Sin conexión local' : `● ${MODE_CONFIG[activeMode]?.title}`}
                </div>
            </div>

            <div style={{ padding: '24px 20px', maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Info banner */}
                <div style={{
                    background: 'rgba(232,0,28,0.06)',
                    border: '1px solid rgba(232,0,28,0.2)',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    fontSize: '0.875rem',
                    color: '#a0a0b8',
                    lineHeight: '1.6',
                }}>
                    <strong style={{ color: '#f4f4f8' }}>🔴 RED Modo Offline</strong><br />
                    Sin internet ni señal celular, RED puede comunicarse con dispositivos cercanos
                    mediante <strong style={{ color: '#3b82f6' }}>Bluetooth</strong> o <strong style={{ color: '#22c55e' }}>WiFi Direct</strong>,
                    formando una red mesh que retransmite mensajes automáticamente.
                </div>

                {/* Active mode */}
                {activeMode !== 'internet' && <ActiveModeCard mode={activeMode} />}

                {/* Nearby panel */}
                <NearbyDevicesPanel
                    localId={FALLBACK_LOCAL_ID}
                    onPeerConnected={handlePeerConnected}
                />

                {/* Connected peers summary */}
                {connectedPeers.length > 0 && (
                    <div style={{
                        background: '#10101a',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '16px',
                        padding: '20px 24px',
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.9rem' }}>
                            🔗 Peers Activos ({connectedPeers.length})
                        </div>
                        {connectedPeers.map(peer => (
                            <div key={peer.id} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: peer.connected ? '#22c55e' : '#ef4444',
                                    boxShadow: peer.connected ? '0 0 6px #22c55e' : 'none',
                                    flexShrink: 0,
                                }} />
                                <span style={{ fontSize: '0.85rem', flex: 1 }}>{peer.name}</span>
                                <span style={{ fontSize: '0.72rem', color: '#55556a' }}>
                                    {MODE_CONFIG[peer.transport]?.icon} {MODE_CONFIG[peer.transport]?.title}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mesh stats */}
                <MeshStatsBox
                    stored={stats.stored}
                    delivered={stats.delivered}
                    dropped={stats.dropped}
                    forwarded={stats.forwarded}
                />

                {/* How it works */}
                <div style={{
                    background: '#10101a',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    fontSize: '0.82rem',
                    color: '#55556a',
                    lineHeight: '1.8',
                }}>
                    <div style={{ fontWeight: 700, color: '#a0a0b8', marginBottom: '12px' }}>¿Cómo funciona?</div>
                    <ol style={{ paddingLeft: '18px' }}>
                        <li>Activa <strong style={{ color: '#22c55e' }}>WiFi LAN</strong> para conectar con dispositivos en la misma red local.</li>
                        <li>Escanea <strong style={{ color: '#3b82f6' }}>Bluetooth</strong> para conectar con dispositivos cercanos (&lt;100m).</li>
                        <li>Los mensajes cifrados viajan de dispositivo en dispositivo hasta llegar al destinatario (<strong style={{ color: '#f59e0b' }}>mesh relay</strong>).</li>
                        <li>Si el destinatario no está cerca, el mensaje se guarda y se entrega cuando haya una ruta.</li>
                    </ol>
                </div>

            </div>
        </main>
    );
}

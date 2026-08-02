'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';

interface PeerNodeInfo {
    id: string;
    name: string;
    distanceMeters: number;
    bearingDegrees: number;
    rssiDbm: number;
    transport: 'BLE' | 'WiFi-Direct' | 'LoRa';
}

export const P2PCompassModal: React.FC = () => {
    const { navigate } = useRedStore();
    const [heading, setHeading] = useState<number>(0);
    const [peers, setPeers] = useState<PeerNodeInfo[]>([
        { id: 'peer_alice_94f8', name: 'Nodo Alice (BLE)', distanceMeters: 8.4, bearingDegrees: 45, rssiDbm: -58, transport: 'BLE' },
        { id: 'peer_bob_21c9', name: 'Nodo Bob (WiFi-D)', distanceMeters: 24.1, bearingDegrees: 195, rssiDbm: -72, transport: 'WiFi-Direct' },
        { id: 'peer_carol_a7b8', name: 'Nodo Carol (LoRa)', distanceMeters: 140.0, bearingDegrees: 310, rssiDbm: -94, transport: 'LoRa' },
    ]);

    // Giro dinámico de la aguja de la brújula
    useEffect(() => {
        const interval = setInterval(() => {
            setHeading((prev) => (prev + (Math.random() * 4 - 2) + 360) % 360);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: '#04060A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* TOP BAR */}
            <div style={{
                height: '60px',
                padding: '0 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(10,12,18,0.8)',
                backdropFilter: 'blur(10px)'
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.5px' }}>
                    🧭 BRÚJULA TÁCTICA & RADAR P2P
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 800, fontFamily: 'monospace' }}>
                    RADIO MESH EN VIVO
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                
                {/* COMPASS ROSSETTE */}
                <div style={{
                    position: 'relative',
                    width: '280px',
                    height: '280px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(14,165,233,0.1) 0%, rgba(3,7,18,0.95) 70%)',
                    border: '2px solid rgba(56,189,248,0.4)',
                    boxShadow: '0 0 30px rgba(56,189,248,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '10px 0 24px'
                }}>
                    {/* CARDINAL MARKS */}
                    <span style={{ position: 'absolute', top: '10px', color: '#ef4444', fontWeight: 900, fontSize: '1rem' }}>N</span>
                    <span style={{ position: 'absolute', right: '14px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>E</span>
                    <span style={{ position: 'absolute', bottom: '10px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>S</span>
                    <span style={{ position: 'absolute', left: '14px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>W</span>

                    {/* ROTATING COMPASS NEEDLE */}
                    <div style={{
                        position: 'absolute',
                        width: '4px',
                        height: '200px',
                        borderRadius: '2px',
                        transform: `rotate(${heading}deg)`,
                        transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '24px solid #ef4444' }}></div>
                        <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '24px solid #38bdf8' }}></div>
                    </div>

                    {/* PEER DOTS ON RADAR */}
                    {peers.map((peer) => {
                        const rad = (peer.bearingDegrees - heading) * (Math.PI / 180);
                        const radius = Math.min(110, (peer.distanceMeters / 150) * 110);
                        const x = Math.sin(rad) * radius;
                        const y = -Math.cos(rad) * radius;

                        return (
                            <div
                                key={peer.id}
                                style={{
                                    position: 'absolute',
                                    transform: `translate(${x}px, ${y}px)`,
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: peer.transport === 'BLE' ? '#38bdf8' : peer.transport === 'WiFi-Direct' ? '#4ade80' : '#f59e0b',
                                    boxShadow: '0 0 10px currentColor'
                                }}
                                title={`${peer.name} (${peer.distanceMeters}m)`}
                            />
                        );
                    })}

                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', border: '2px solid #000' }} />
                </div>

                {/* HEADING DISPLAY */}
                <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', marginBottom: '20px' }}>
                    ORIENTACIÓN: {Math.round(heading)}° MAGNÉTICO
                </div>

                {/* PEERS LIST TABLE */}
                <div style={{ width: '100%', maxWidth: '600px', background: 'rgba(15,23,42,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        NODOS EN RANGO RADIAL BLE / WIFI-DIRECT / LORA
                    </div>

                    {peers.map((p) => (
                        <div key={p.id} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            fontSize: '0.88rem'
                        }}>
                            <div>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{p.name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                                    Azi: {p.bearingDegrees}° | RSSI: {p.rssiDbm} dBm
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, color: '#4ade80', fontFamily: 'monospace' }}>
                                    ~{p.distanceMeters} m
                                </div>
                                <span style={{
                                    fontSize: '0.7rem',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: 'rgba(56,189,248,0.15)',
                                    color: '#38bdf8',
                                    fontWeight: 700
                                }}>
                                    {p.transport}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

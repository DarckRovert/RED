'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getProximityNodes, ProximityNode } from '../lib/api';

export const P2PCompassModal: React.FC = () => {
    const { navigate } = useRedStore();
    const [heading, setHeading] = useState<number>(0);
    const [headingSource, setHeadingSource] = useState<'sensor' | 'manual'>('manual');
    const [nodes, setNodes] = useState<ProximityNode[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Load real proximity nodes from backend API with contacts fallback
    const loadNodes = useCallback(async () => {
        try {
            const list = await getProximityNodes().catch(() => []);
            const rawList = Array.isArray(list) ? list : [];
            if (rawList.length > 0) {
                setNodes(rawList);
            } else {
                setNodes([]);
            }
            setLoadError(null);
        } catch (e: any) {
            setNodes([]);
        }
    }, []);

    useEffect(() => {
        loadNodes();
        const interval = setInterval(loadNodes, 3000);
        return () => clearInterval(interval);
    }, [loadNodes]);

    // Real magnetic heading & GPS orientation listeners
    useEffect(() => {
        const handleOrientation = (event: any) => {
            const webkit = event.webkitCompassHeading;
            const alpha = event.alpha;

            if (webkit != null && !isNaN(webkit)) {
                setHeading(Math.round(webkit));
                setHeadingSource('sensor');
            } else if (alpha != null && !isNaN(alpha)) {
                const h = Math.round((360 - alpha) % 360);
                setHeading(h);
                setHeadingSource('sensor');
            }
        };

        window.addEventListener('deviceorientation', handleOrientation, true);
        window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);

        // Geolocation GPS heading fallback
        let watchId: number | null = null;
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
                        setHeading(Math.round(pos.coords.heading));
                        setHeadingSource('sensor');
                    }
                },
                () => {},
                { enableHighAccuracy: true }
            );
        }

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation, true);
            window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
            if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, []);

    const transportColor = (transport: string) => {
        if (transport.includes('BLE')) return '#38bdf8';
        if (transport.includes('WiFi')) return '#4ade80';
        return '#f59e0b';
    };

    return (
        <div style={{
            height: '100%',
            width: '100%',
            background: '#04060A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden'
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
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.5px' }}>
                    🧭 BRÚJULA TÁCTICA & RADAR P2P
                </div>
                <div style={{ fontSize: '0.75rem', color: headingSource === 'sensor' ? '#4ade80' : '#f59e0b', fontWeight: 800, fontFamily: 'monospace' }}>
                    {headingSource === 'sensor' ? 'SENSOR MAGNÉTICO ✓' : 'SENSOR NO DISPONIBLE'}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* COMPASS ROSETTE */}
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
                    <span style={{ position: 'absolute', top: '10px', color: '#ef4444', fontWeight: 900, fontSize: '1rem' }}>N</span>
                    <span style={{ position: 'absolute', right: '14px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>E</span>
                    <span style={{ position: 'absolute', bottom: '10px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>S</span>
                    <span style={{ position: 'absolute', left: '14px', color: '#94a3b8', fontWeight: 700, fontSize: '0.9rem' }}>W</span>

                    {/* ROTATING COMPASS NEEDLE — real heading */}
                    <div style={{
                        position: 'absolute',
                        width: '4px',
                        height: '200px',
                        borderRadius: '2px',
                        transform: `rotate(${heading}deg)`,
                        transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '24px solid #ef4444' }} />
                        <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '24px solid #38bdf8' }} />
                    </div>

                    {/* REAL PEER DOTS from backend API */}
                    {nodes.map((node) => {
                        // We don't have real bearing from RSSI — map nodes in a circle by index
                        const idx = nodes.indexOf(node);
                        const angle = (idx / Math.max(nodes.length, 1)) * 2 * Math.PI;
                        const maxRadius = 110;
                        // Use real distance if available; fallback to fixed radius when null
                        const radius = node.distance_meters !== null
                            ? Math.min(maxRadius, (Math.min(node.distance_meters, 150) / 150) * maxRadius + 20)
                            : 60; // Fixed position when no real ranging data
                        const x = Math.sin(angle) * radius;
                        const y = -Math.cos(angle) * radius;

                        return (
                            <div
                                key={node.identity_hash}
                                title={`${node.display_name} (~${node.distance_meters !== null ? node.distance_meters + 'm' : '—'}, ${node.rssi_dbm !== null ? node.rssi_dbm + ' dBm' : '— dBm'})`}
                                style={{
                                    position: 'absolute',
                                    transform: `translate(${x}px, ${y}px)`,
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: transportColor(node.transport),
                                    boxShadow: `0 0 8px ${transportColor(node.transport)}`
                                }}
                            />
                        );
                    })}

                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', border: '2px solid #000' }} />
                </div>

                {/* HEADING DISPLAY */}
                <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', marginBottom: '20px' }}>
                    ORIENTACIÓN: {Math.round(heading)}° MAGNÉTICO
                    {headingSource === 'manual' && (
                        <span style={{ fontSize: '0.7rem', color: '#f59e0b', marginLeft: '8px' }}>(requiere sensor en dispositivo físico)</span>
                    )}
                </div>

                {/* ERROR STATE */}
                {loadError && (
                    <div style={{ color: '#f59e0b', fontSize: '0.82rem', marginBottom: '16px', padding: '10px 16px', background: 'rgba(245,158,11,0.1)', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.3)' }}>
                        ⚠️ {loadError}
                    </div>
                )}

                {/* REAL NODES LIST from backend */}
                <div style={{ width: '100%', maxWidth: '600px', background: 'rgba(15,23,42,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        NODOS EN RANGO RADIAL ({nodes.length} detectados)
                    </div>

                    {nodes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '20px', fontSize: '0.85rem' }}>
                            Buscando dispositivos RED cercanos...<br />
                            <span style={{ fontSize: '0.75rem' }}>Mantente a menos de 100 metros de otro nodo activo.</span>
                        </div>
                    ) : (
                        nodes.map((n) => (
                            <div key={n.identity_hash} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.88rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#fff' }}>{n.display_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                                        RSSI: {n.rssi_dbm !== null ? `${n.rssi_dbm} dBm` : '—'} | {n.transport}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, color: '#4ade80', fontFamily: 'monospace' }}>
                                        ~{n.distance_meters} m
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        background: `${transportColor(n.transport)}22`,
                                        color: transportColor(n.transport),
                                        fontWeight: 700
                                    }}>
                                        {n.transport}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

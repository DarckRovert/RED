'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getProximityNodes, triggerWaveHandshake, ProximityNode } from '../lib/api';

export const ProximityWaveModal: React.FC = () => {
    const { navigate } = useRedStore();
    const [nodes, setNodes] = useState<ProximityNode[]>([]);
    const [wavingId, setWavingId] = useState<string | null>(null);

    const loadProximity = async () => {
        try {
            const list = await getProximityNodes();
            setNodes(list);
        } catch (e) {
            console.error('Proximity error:', e);
        }
    };

    useEffect(() => {
        loadProximity();
        const interval = setInterval(loadProximity, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleWave = async (targetHash: string) => {
        setWavingId(targetHash);
        try {
            await triggerWaveHandshake(targetHash);
            alert('👋 ¡Saludo P2P enviado! Conexión cifrada E2E establecida en proximidad zero-touch.');
            navigate('chat', targetHash);
        } catch (e: any) {
            alert(`Error al saludar: ${e.message}`);
        } finally {
            setWavingId(null);
        }
    };

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
                background: 'rgba(15,23,42,0.9)'
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f43f5e',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    👋 PROXIMIDAD ZERO-TOUCH P2P
                </div>
                <button
                    onClick={() => navigate('proximitySettings')}
                    style={{
                        background: 'rgba(244,63,94,0.15)',
                        border: '1px solid #f43f5e',
                        color: '#f43f5e',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                    }}
                >
                    ⚙️ Filtro Anti-Spam
                </button>
            </div>

            {/* MAIN NODES LIST */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '540px',
                    background: 'rgba(15,23,42,0.6)',
                    borderRadius: '16px',
                    border: '1px solid rgba(244,63,94,0.3)',
                    padding: '20px'
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f43f5e', marginBottom: '16px', letterSpacing: '0.5px' }}>
                        DISPOSITIVOS DETECTADOS EN PROXIMIDAD INMEDIATA
                    </div>

                    {nodes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '30px', fontSize: '0.9rem' }}>
                            Buscando dispositivos cercanos... Mantente a menos de 5 metros de otro usuario RED.
                        </div>
                    ) : (
                        nodes.map((n) => (
                            <div key={n.identity_hash} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '12px',
                                padding: '14px',
                                marginBottom: '12px'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>{n.display_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                                        Distancia: ~{n.distance_meters}m | RSSI: {n.rssi_dbm} dBm ({n.transport})
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleWave(n.identity_hash)}
                                    disabled={wavingId === n.identity_hash}
                                    style={{
                                        background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '10px 18px',
                                        borderRadius: '10px',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {wavingId === n.identity_hash ? '...' : '👋 Saludar P2P'}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

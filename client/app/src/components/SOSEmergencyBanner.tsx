'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { emitSos, getActiveSos, resolveSos, SosBeacon } from '../lib/api';

export const SOSEmergencyBanner: React.FC = () => {
    const { navigate } = useRedStore();
    const [beacons, setBeacons] = useState<SosBeacon[]>([]);
    const [isTriggering, setIsTriggering] = useState(false);
    const [noteText, setNoteText] = useState('Emergencia médica / Auxilio táctico');

    const loadBeacons = async () => {
        try {
            const list = await getActiveSos();
            setBeacons(list);
        } catch (e) {
            console.error('SOS fetch error:', e);
        }
    };

    useEffect(() => {
        loadBeacons();
        const interval = setInterval(loadBeacons, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleBroadcastSos = async () => {
        try {
            await emitSos({
                sender_name: 'Usuario RED',
                lat: -12.04637,
                lon: -77.04279,
                battery_level: 85,
                note: noteText
            });
            setIsTriggering(false);
            await loadBeacons();
            alert('🚨 ¡Baliza SOS emitida a la red P2P!');
        } catch (e: any) {
            alert(`Error al emitir SOS: ${e.message}`);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            await resolveSos(id);
            await loadBeacons();
        } catch (e: any) {
            alert(`Error al resolver SOS: ${e.message}`);
        }
    };

    return (
        <>
            {/* ACTIVE SOS BANNER AT THE TOP IF BEACONS EXIST */}
            {beacons.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                    color: '#fff',
                    padding: '12px 20px',
                    boxShadow: '0 4px 20px rgba(220,38,38,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem', animation: 'pulse 1s infinite' }}>🚨</span>
                        <div>
                            <div style={{ fontWeight: 900, fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                                ¡ALERTA SOS DE AUXILIO ACTIVA! ({beacons.length})
                            </div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                {beacons[0].sender_name}: {beacons[0].note} (Lat: {beacons[0].lat}, Lon: {beacons[0].lon})
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={() => handleResolve(beacons[0].id)}
                            style={{
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: '#fff',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer'
                            }}
                        >
                            ✓ Marcar a Salvo
                        </button>
                    </div>
                </div>
            )}

            {/* FULLSCREEN SOS TRIGGER MODAL IF TRIGGERED */}
            {isTriggering && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10000,
                    background: 'rgba(3,7,18,0.95)',
                    backdropFilter: 'blur(12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '420px',
                        background: '#0f172a',
                        border: '2px solid #ef4444',
                        borderRadius: '20px',
                        padding: '24px',
                        textAlign: 'center',
                        boxShadow: '0 0 40px rgba(239,68,68,0.3)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🚨</div>
                        <h2 style={{ color: '#ef4444', fontWeight: 900, marginBottom: '8px' }}>EMITIR SOS TÁCTICO</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.4' }}>
                            Se transmitirá una baliza de socorro con tu ubicación GPS aproximada a todos los nodos P2P en rango radio.
                        </p>

                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '10px',
                                padding: '10px',
                                color: '#fff',
                                fontSize: '0.85rem',
                                marginBottom: '20px'
                            }}
                        />

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setIsTriggering(false)}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '10px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#94a3b8',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBroadcastSos}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                                    border: 'none',
                                    color: '#fff',
                                    fontWeight: 900,
                                    cursor: 'pointer'
                                }}
                            >
                                Transmitir SOS
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

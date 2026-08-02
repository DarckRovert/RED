'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { emitSos, getActiveSos, resolveSos, SosBeacon } from '../lib/api';

// Capacitor Geolocation — dynamically imported to avoid SSR issues in Next.js
let Geolocation: any = null;
if (typeof window !== 'undefined') {
    import('@capacitor/geolocation').then((m) => {
        Geolocation = m.Geolocation;
    });
}

export const SOSEmergencyBanner: React.FC = () => {
    const { navigate, identity } = useRedStore();
    const [beacons, setBeacons] = useState<SosBeacon[]>([]);
    const [isTriggering, setIsTriggering] = useState(false);
    const [noteText, setNoteText] = useState('Emergencia médica / Auxilio táctico');
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'error'>('idle');
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);

    const loadBeacons = useCallback(async () => {
        try {
            const list = await getActiveSos();
            setBeacons(list);
        } catch (e) {
            console.error('SOS fetch error:', e);
        }
    }, []);

    useEffect(() => {
        loadBeacons();
        const interval = setInterval(loadBeacons, 3000);
        return () => clearInterval(interval);
    }, [loadBeacons]);

    const getGpsCoords = async (): Promise<{ lat: number; lon: number }> => {
        setGpsStatus('locating');

        // Try Capacitor Geolocation first (native Android)
        if (Geolocation) {
            try {
                const perm = await Geolocation.requestPermissions();
                if (perm.location === 'granted') {
                    const pos = await Geolocation.getCurrentPosition({
                        enableHighAccuracy: true,
                        timeout: 8000
                    });
                    const coords = {
                        lat: parseFloat(pos.coords.latitude.toFixed(6)),
                        lon: parseFloat(pos.coords.longitude.toFixed(6))
                    };
                    setGpsCoords(coords);
                    setGpsStatus('ok');
                    return coords;
                }
            } catch (e) {
                console.warn('Capacitor Geolocation failed, trying browser API', e);
            }
        }

        // Web fallback: navigator.geolocation
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                setGpsStatus('error');
                reject(new Error('GPS no disponible en este dispositivo o navegador.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = {
                        lat: parseFloat(pos.coords.latitude.toFixed(6)),
                        lon: parseFloat(pos.coords.longitude.toFixed(6))
                    };
                    setGpsCoords(coords);
                    setGpsStatus('ok');
                    resolve(coords);
                },
                (err) => {
                    setGpsStatus('error');
                    reject(new Error(`GPS Error (${err.code}): ${err.message}`));
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
            );
        });
    };

    const handleBroadcastSos = async () => {
        try {
            const coords = await getGpsCoords();

            // Get real battery level if available
            let batteryLevel = 100;
            try {
                if ('getBattery' in navigator) {
                    const battery: any = await (navigator as any).getBattery();
                    batteryLevel = Math.round(battery.level * 100);
                }
            } catch {
                // Battery API not supported — default to 100
            }

            await emitSos({
                sender_name: identity?.nickname || 'Usuario RED',
                lat: coords.lat,
                lon: coords.lon,
                battery_level: batteryLevel,
                note: noteText
            });

            setIsTriggering(false);
            await loadBeacons();
            alert(`🚨 ¡Baliza SOS emitida!\nUbicación: ${coords.lat}, ${coords.lon}\nBatería: ${batteryLevel}%`);
        } catch (e: any) {
            setGpsStatus('error');
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
            {/* ACTIVE SOS BANNER */}
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
                                {beacons[0].sender_name}: {beacons[0].note}
                                {beacons[0].lat !== 0 && ` · GPS: ${beacons[0].lat}, ${beacons[0].lon}`}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => handleResolve(beacons[0].id)}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                        ✓ Marcar a Salvo
                    </button>
                </div>
            )}

            {/* FULLSCREEN SOS TRIGGER MODAL */}
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
                        <h2 style={{ color: '#ef4444', fontWeight: 900, marginBottom: '8px', fontSize: '1.1rem' }}>EMITIR SOS TÁCTICO</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '12px', lineHeight: '1.4' }}>
                            Se transmitirá una baliza de socorro con tu <strong>ubicación GPS real</strong> a todos los nodos P2P en rango radio.
                        </p>

                        {/* GPS STATUS INDICATOR */}
                        <div style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            marginBottom: '14px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: gpsStatus === 'ok'
                                ? 'rgba(34,197,94,0.1)'
                                : gpsStatus === 'error'
                                ? 'rgba(239,68,68,0.1)'
                                : gpsStatus === 'locating'
                                ? 'rgba(56,189,248,0.1)'
                                : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${gpsStatus === 'ok' ? '#22c55e' : gpsStatus === 'error' ? '#ef4444' : gpsStatus === 'locating' ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
                            color: gpsStatus === 'ok' ? '#4ade80' : gpsStatus === 'error' ? '#fca5a5' : gpsStatus === 'locating' ? '#7dd3fc' : '#94a3b8'
                        }}>
                            {gpsStatus === 'idle' && '📍 GPS se obtendrá al transmitir'}
                            {gpsStatus === 'locating' && '📡 Obteniendo ubicación GPS...'}
                            {gpsStatus === 'ok' && gpsCoords && `✅ GPS: ${gpsCoords.lat}, ${gpsCoords.lon}`}
                            {gpsStatus === 'error' && '❌ GPS no disponible — se emitirá sin coordenadas'}
                        </div>

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
                                marginBottom: '20px',
                                boxSizing: 'border-box'
                            }}
                        />

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => { setIsTriggering(false); setGpsStatus('idle'); setGpsCoords(null); }}
                                disabled={gpsStatus === 'locating'}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#94a3b8', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBroadcastSos}
                                disabled={gpsStatus === 'locating'}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none', color: '#fff', fontWeight: 900, cursor: 'pointer', opacity: gpsStatus === 'locating' ? 0.6 : 1 }}
                            >
                                {gpsStatus === 'locating' ? '📡 Localizando...' : 'Transmitir SOS'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

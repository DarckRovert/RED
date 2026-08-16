'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { emitSos, getActiveSos, resolveSos, SosBeacon } from '../lib/api';
import { toast } from './Toast';
import { ErrorBanner } from './ui/ErrorBanner';

// NOTE: @capacitor/geolocation is imported dynamically inside getGpsCoords()
// to guarantee it is always resolved before use, avoiding the race condition
// where a module-level async import may not complete before the function fires.

export const SOSEmergencyBanner: React.FC = () => {
    const { navigate, identity, isAuthenticated, currentScreen, activeSosBeacons, setSosBeacons } = useRedStore();
    const beacons = activeSosBeacons || [];
    const [isTriggering, setIsTriggering] = useState(false);
    const [noteText, setNoteText] = useState('Emergencia médica / Auxilio táctico');
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'error'>('idle');
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number }>({ lat: 0, lon: 0 });
    const [loadError, setLoadError] = useState<string | null>(null);

    const loadBeacons = useCallback(async () => {
        try {
            const list = await getActiveSos();
            setSosBeacons(list);
            setLoadError(null);
        } catch (e: any) {
            console.error('SOS fetch error:', e);
            setLoadError(e.message || "Error al sincronizar balizas SOS");
        }
    }, [setSosBeacons]);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadBeacons();
        // Polling erradicado: Los eventos SSE 'sos_beacon' y 'sos_resolved' actualizan el store en tiempo real (<1ms).
    }, [loadBeacons, isAuthenticated]);

    // Open trigger modal automatically when user selects SOS from menu
    useEffect(() => {
        if (currentScreen === 'sos') {
            setIsTriggering(true);
        }
    }, [currentScreen]);

    const getGpsCoords = async (): Promise<{ lat: number; lon: number }> => {
        setGpsStatus('locating');

        // Fast non-blocking GPS attempt (2500ms max timeout)
        return new Promise((resolve) => {
            let done = false;

            const finish = (coords: { lat: number; lon: number }, status: 'ok' | 'error') => {
                if (done) return;
                done = true;
                setGpsCoords(coords);
                setGpsStatus(status);
                resolve(coords);
            };

            // Fast fallback timer: 2.5s max wait for GPS
            const timer = setTimeout(() => {
                finish({ lat: 0, lon: 0 }, 'error');
            }, 2500);

            // FIX 1.5: Import Geolocation dynamically HERE, not at module level.
            // Module-level async import may not complete before this function fires.
            import('@capacitor/geolocation').then(({ Geolocation: GeoPlugin }) => {
                GeoPlugin.getCurrentPosition({ enableHighAccuracy: false, timeout: 2000 })
                    .then((pos: any) => {
                        clearTimeout(timer);
                        finish({
                            lat: parseFloat(pos.coords.latitude.toFixed(6)),
                            lon: parseFloat(pos.coords.longitude.toFixed(6))
                        }, 'ok');
                    })
                    .catch(() => {
                        // Web fallback
                        if (typeof navigator !== 'undefined' && navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                                (pos) => {
                                    clearTimeout(timer);
                                    finish({
                                        lat: parseFloat(pos.coords.latitude.toFixed(6)),
                                        lon: parseFloat(pos.coords.longitude.toFixed(6))
                                    }, 'ok');
                                },
                                () => {
                                    clearTimeout(timer);
                                    finish({ lat: 0, lon: 0 }, 'error');
                                },
                                { enableHighAccuracy: false, timeout: 2000 }
                            );
                        } else {
                            clearTimeout(timer);
                            finish({ lat: 0, lon: 0 }, 'error');
                        }
                    });
            }).catch(() => {
                // Capacitor not available (web) — fall back to browser geolocation
                if (typeof navigator !== 'undefined' && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            clearTimeout(timer);
                            finish({
                                lat: parseFloat(pos.coords.latitude.toFixed(6)),
                                lon: parseFloat(pos.coords.longitude.toFixed(6))
                            }, 'ok');
                        },
                        () => {
                            clearTimeout(timer);
                            finish({ lat: 0, lon: 0 }, 'error');
                        },
                        { enableHighAccuracy: false, timeout: 2000 }
                    );
                } else {
                    clearTimeout(timer);
                    finish({ lat: 0, lon: 0 }, 'error');
                }
            });
        });
    };

    const handleBroadcastSos = async () => {
        try {
            const coords = await getGpsCoords();

            let batteryLevel = 90;
            try {
                if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
                    const battery: any = await (navigator as any).getBattery();
                    batteryLevel = Math.round(battery.level * 100);
                }
            } catch {}

            const res = await emitSos({
                sender_name: identity?.nickname || 'Usuario RED',
                lat: coords.lat,
                lon: coords.lon,
                battery_level: batteryLevel,
                note: noteText || 'EMERGENCIA SOS AUXILIO'
            });

            setIsTriggering(false);
            if (currentScreen === 'sos') {
                navigate('sidebar');
            }
            await loadBeacons();
            toast.success(`🚨 ¡BALIZA SOS EMITIDA! Operador: ${identity?.nickname || 'RED'}`);
        } catch (e: any) {
            setIsTriggering(false);
            if (currentScreen === 'sos') {
                navigate('sidebar');
            }
            toast.error(`Error al emitir SOS: ${e.message}`);
        }
    };

    const handleResolve = async (id: string) => {
        try {
            await resolveSos(id);
            await loadBeacons();
            toast.info("Baliza SOS resuelta y archivada");
        } catch (e: any) {
            toast.error(`Error al resolver SOS: ${e.message}`);
        }
    };


    return (
        <>
            {/* ACTIVE SOS BANNER */}
            {loadError ? (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                    <ErrorBanner message={loadError} onRetry={loadBeacons} />
                </div>
            ) : (() => {
                const safeBeacons = Array.isArray(beacons) ? beacons : [];
                if (safeBeacons.length === 0) return null;
                const active = safeBeacons[0];
                return (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff',
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px',
                        boxShadow: '0 4px 20px rgba(239,68,68,0.5)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.4rem', animation: 'pulse 1s infinite' }}>🚨</span>
                            <div>
                                <div style={{ fontWeight: 900, fontSize: '0.9rem', letterSpacing: '0.5px' }}>
                                    ¡ALERTA SOS DE AUXILIO ACTIVA! ({safeBeacons.length})
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                    {active.sender_name || 'Operador'}: {active.note || 'Auxilio'}
                                    {active.lat !== 0 && ` · GPS: ${active.lat}, ${active.lon}`}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => handleResolve(active.id)}
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}
                        >
                            ✓ Marcar a Salvo
                        </button>
                    </div>
                );
            })()}

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

                        {/* SMART SOS NOTE SUGGESTION CHIPS */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setNoteText('🚑 HEMORRAGIA ACTIVA — Requiero torniquete y atención médica urgente')}
                                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                🚑 Médica
                            </button>
                            <button
                                onClick={() => setNoteText('🏚️ ATRAPADO EN ESTRUCTURA — Inmueble con riesgo de colapso')}
                                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                🏚️ Rescate
                            </button>
                            <button
                                onClick={() => setNoteText('🔥 EVACUACIÓN POR INCENDIO — Visibilidad nula y humo denso')}
                                style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid #ea580c', color: '#fdba74', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                🔥 Incendio
                            </button>
                            <button
                                onClick={() => setNoteText('⚡ SIN ENERGÍA NI COMUNICACIÓN — Transmitiendo por malla radio RED')}
                                style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                                ⚡ Apagón
                            </button>
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
                                onClick={() => { setIsTriggering(false); setGpsStatus('idle'); setGpsCoords({ lat: 0, lon: 0 }); if (currentScreen === 'sos') navigate('sidebar'); }}
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

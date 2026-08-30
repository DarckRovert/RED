'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { emitSos, getActiveSos, resolveSos, SosBeacon } from '../lib/api';
import { toast } from './Toast';
import { useTranslation } from '../lib/i18n/i18nEngine';

export const SOSEmergencyBanner: React.FC = () => {
    const { navigate, identity, isAuthenticated, currentScreen, activeSosBeacons, setSosBeacons } = useRedStore();
    const { t } = useTranslation();
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
    }, [loadBeacons, isAuthenticated]);

    useEffect(() => {
        if (currentScreen === 'sos') {
            setIsTriggering(true);
        }
    }, [currentScreen]);

    const getGpsCoords = async (): Promise<{ lat: number; lon: number }> => {
        setGpsStatus('locating');

        return new Promise((resolve) => {
            let done = false;

            const finish = (coords: { lat: number; lon: number }, status: 'ok' | 'error') => {
                if (done) return;
                done = true;
                setGpsCoords(coords);
                setGpsStatus(status);
                resolve(coords);
            };

            const timer = setTimeout(() => {
                finish({ lat: 0, lon: 0 }, 'error');
            }, 2500);

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

            let batteryLevel = 100;
            if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
                try {
                    const battery: any = await (navigator as any).getBattery();
                    batteryLevel = Math.round(battery.level * 100);
                } catch {}
            }

            const senderName = identity?.nickname || 'Operador RED';
            const res = await emitSos({
                sender_name: senderName,
                lat: coords.lat,
                lon: coords.lon,
                note: noteText.trim() || 'Emergencia médica / Auxilio táctico',
                battery_level: batteryLevel
            });

            if (res && res.ok && res.sos) {
                setSosBeacons([res.sos, ...beacons]);
                toast.error('🚨 ¡BALIZA SOS DIFUNDIDA A TODA LA MALLA P2P!');
                setIsTriggering(false);
            }
        } catch (err: any) {
            toast.error(`Error al emitir SOS: ${err.message}`);
        }
    };

    const handleResolve = async (beaconId: string) => {
        try {
            await resolveSos(beaconId);
            setSosBeacons(beacons.filter(b => b.beacon_id !== beaconId));
            toast.success('Baliza SOS resuelta y desactivada');
        } catch {
            toast.error('Error al resolver SOS');
        }
    };

    if (beacons.length === 0 && !isTriggering) {
        return null;
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
            background: 'linear-gradient(180deg, rgba(232, 33, 58, 0.98) 0%, rgba(160, 15, 35, 0.95) 100%)',
            color: '#FFFFFF', padding: '10px 16px', borderBottom: '2px solid #FFFFFF',
            boxShadow: '0 4px 25px rgba(232, 33, 58, 0.6)', backdropFilter: 'blur(16px)'
        }}>
            {/* Banner de Emergencia Activo */}
            {beacons.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem', animation: 'pulse 1s infinite' }}>🚨</span>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 900, letterSpacing: '0.5px' }}>
                                ALERTA SOS ACTIVA ({beacons.length} BALIZAS EN MALLA)
                            </div>
                            <div style={{ fontSize: '0.68rem', opacity: 0.9, fontFamily: 'JetBrains Mono, monospace' }}>
                                {beacons[0].sender_name}: {beacons[0].note || 'Auxilio inmediato requerido'}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => navigate('survivalBeacon')}
                            style={{
                                padding: '6px 12px', borderRadius: '8px', background: '#FFFFFF',
                                color: '#E8213A', fontWeight: 900, fontSize: '0.74rem', border: 'none', cursor: 'pointer'
                            }}
                        >
                            VER RADAR SOS
                        </button>
                        {beacons[0].is_mine && (
                            <button
                                onClick={() => handleResolve(beacons[0].beacon_id)}
                                style={{
                                    padding: '6px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)',
                                    color: '#FFFFFF', fontWeight: 800, fontSize: '0.74rem', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer'
                                }}
                            >
                                RESOLVER
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Disparo de SOS */}
            {isTriggering && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10001,
                    background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(20px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
                }}>
                    <div style={{
                        maxWidth: '440px', width: '100%',
                        background: 'linear-gradient(180deg, #18080C 0%, #080305 100%)',
                        border: '2px solid #FF3355', borderRadius: '22px', padding: '24px',
                        display: 'flex', flexDirection: 'column', gap: '16px',
                        boxShadow: '0 0 50px rgba(255, 51, 85, 0.4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: '12px',
                                background: 'rgba(255, 51, 85, 0.2)', border: '1px solid #FF3355',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.5rem'
                            }}>🚨</div>
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#FF3355' }}>
                                    EMISIÓN DE AUXILIO SOS
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                    Propagación de emergencia por radio LoRa, BLE y SoundMesh.
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 900, display: 'block', marginBottom: '4px' }}>
                                MENSAJE DE EMERGENCIA / TRIAGE
                            </label>
                            <input
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                style={{
                                    width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.6)',
                                    border: '1px solid rgba(255, 51, 85, 0.4)', borderRadius: '10px',
                                    color: '#FFFFFF', fontSize: '0.85rem', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{
                            padding: '10px 14px', background: 'rgba(0,0,0,0.5)',
                            borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                            fontSize: '0.72rem', color: 'var(--text-secondary)'
                        }}>
                            GPS: {gpsStatus === 'locating' ? 'Obteniendo coordenadas satelitales...' : `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lon.toFixed(4)}`}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleBroadcastSos}
                                style={{
                                    flex: 2, padding: '14px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #FF3355 0%, #E8213A 100%)',
                                    color: '#FFFFFF', fontWeight: 900, fontSize: '0.85rem', border: 'none', cursor: 'pointer',
                                    boxShadow: '0 0 20px rgba(255, 51, 85, 0.5)'
                                }}
                            >
                                🚨 EMITIR SOS AHORA
                            </button>
                            <button
                                onClick={() => setIsTriggering(false)}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: '#FFFFFF', fontWeight: 800, fontSize: '0.85rem',
                                    border: '1px solid rgba(255, 255, 255, 0.15)', cursor: 'pointer'
                                }}
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

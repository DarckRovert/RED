'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getDiscoveryConfig, setDiscoveryConfig, ProximityFilterConfig } from '../lib/api';

export const ProximitySettingsModal: React.FC = () => {
    const { navigate } = useRedStore();
    const [config, setConfig] = useState<ProximityFilterConfig | null>(null);

    const loadConfig = async () => {
        try {
            const cfg = await getDiscoveryConfig();
            setConfig(cfg);
        } catch (e) {
            console.error('Config fetch error:', e);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleSave = async (updated: ProximityFilterConfig) => {
        setConfig(updated);
        try {
            await setDiscoveryConfig(updated);
            alert('🔕 Configuración Anti-Spam y Modo Sigilo de Proximidad actualizada.');
        } catch (e: any) {
            alert(`Error al guardar: ${e.message}`);
        }
    };

    if (!config) return <div style={{ background: '#04060A', height: '100dvh' }} />;

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
                    onClick={() => navigate('proximity')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f43f5e',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Proximidad
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🔕 FILTRO ANTI-SPAM & MODO SIGILO
                </div>
                <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800, fontFamily: 'monospace' }}>
                    PROXIMITY GUARD v23.0
                </div>
            </div>

            {/* FORM BODY */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '540px',
                    background: 'rgba(15,23,42,0.7)',
                    borderRadius: '16px',
                    border: '1px solid rgba(244,63,94,0.3)',
                    padding: '24px',
                    boxShadow: '0 0 30px rgba(244,63,94,0.1)'
                }}>
                    {/* STEALTH MODE SELECTOR */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#f43f5e', marginBottom: '8px' }}>
                            MODO DE NOTIFICACIÓN DE PROXIMIDAD
                        </label>
                        <select
                            value={config.stealth_mode}
                            onChange={(e) => handleSave({ ...config, stealth_mode: e.target.value as any })}
                            style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '10px',
                                padding: '10px',
                                color: '#fff',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="silent">🔕 Silencioso Total (Solo actualización en pantalla)</option>
                            <option value="vibrate">📳 Vibración Táctil Suave (Recomendado - Imperceptible)</option>
                            <option value="discreet_sound">🔊 Sonido Discreto de Bajo Volumen</option>
                        </select>
                    </div>

                    {/* COOLDOWN TIMER SELECTOR */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8', marginBottom: '8px' }}>
                            TIEMPO DE REPOSO (COOLDOWN ANTI-SPAM POR NODO)
                        </label>
                        <select
                            value={config.cooldown_seconds}
                            onChange={(e) => handleSave({ ...config, cooldown_seconds: parseInt(e.target.value) })}
                            style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '10px',
                                padding: '10px',
                                color: '#fff',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value={900}>15 Minutos (No repetir aviso en 15m)</option>
                            <option value={3600}>1 Hora (Recomendado - Evita notificar en trabajo/casa)</option>
                            <option value={86400}>24 Horas (Una sola notificación diaria por persona)</option>
                        </select>
                    </div>

                    {/* DIGEST TOGGLE */}
                    <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '10px' }}>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>Resumen Inteligente por Lote</div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Agrupa alertas en lugares concurridos ("3 nodos detectados")</div>
                        </div>
                        <input
                            type="checkbox"
                            checked={config.digest_enabled}
                            onChange={(e) => handleSave({ ...config, digest_enabled: e.target.checked })}
                            style={{ accentColor: '#38bdf8', width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                    </div>

                    {/* SAFE ZONES LIST */}
                    <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4ade80', marginBottom: '8px' }}>
                            ZONAS SEGURAS GEOFENCED (SILENCIO AUTOMÁTICO)
                        </div>
                        {config.safe_zones.map((z, idx) => (
                            <div key={idx} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '8px', padding: '10px', fontSize: '0.8rem' }}>
                                <div style={{ fontWeight: 800, color: '#4ade80' }}>📍 {z.name}</div>
                                <div style={{ color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                                    Radio de Silencio: {z.radius_meters}m | Coordenadas: [{z.lat.toFixed(4)}, {z.lon.toFixed(4)}]
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

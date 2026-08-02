'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getWeatherReports, postWeatherReport, WeatherReport } from '../lib/api';

export const WeatherAlertPanel: React.FC = () => {
    const { navigate } = useRedStore();
    const [reports, setReports] = useState<WeatherReport[]>([]);
    const [pressure, setPressure] = useState<number>(1013.25);
    const [summary, setSummary] = useState('Despejado — Presión Estable');
    const [isAlert, setIsAlert] = useState(false);

    const loadReports = async () => {
        try {
            const list = await getWeatherReports();
            setReports(list);
        } catch (e) {
            console.error('Weather fetch error:', e);
        }
    };

    useEffect(() => {
        loadReports();
        const interval = setInterval(loadReports, 4000);
        return () => clearInterval(interval);
    }, []);

    const handleBroadcastReport = async () => {
        try {
            await postWeatherReport({
                sender_name: 'Estación Vecinal',
                pressure_hpa: pressure,
                temperature_c: 21.5,
                humidity_percent: 68,
                condition_summary: summary,
                is_disaster_alert: isAlert
            });
            await loadReports();
            alert('🌤️ Boletín barométrico/clima emitido a la red P2P.');
        } catch (e: any) {
            alert(`Error al emitir boletín: ${e.message}`);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: '#020617',
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
                        color: '#f59e0b',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🌤️ ALERTAS BAROMÉTRICAS & CLIMA MESH
                </div>
                <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 800, fontFamily: 'monospace' }}>
                    BAROMETER SENSOR ACTIVE
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                
                {/* BAROMETER CARDS */}
                <div style={{
                    width: '100%',
                    maxWidth: '600px',
                    background: 'rgba(15,23,42,0.7)',
                    borderRadius: '16px',
                    border: '1px solid rgba(245,158,11,0.3)',
                    padding: '20px',
                    marginBottom: '20px',
                    boxShadow: '0 0 24px rgba(245,158,11,0.1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>PRESIÓN BAROMÉTRICA LOCAL</div>
                            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'monospace' }}>
                                {pressure} hPa
                            </div>
                        </div>
                        <button
                            onClick={handleBroadcastReport}
                            style={{
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                border: 'none',
                                color: '#fff',
                                padding: '10px 18px',
                                borderRadius: '10px',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            📢 Transmitir Boletín
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#fff',
                                fontSize: '0.85rem'
                            }}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>
                            <input type="checkbox" checked={isAlert} onChange={(e) => setIsAlert(e.target.checked)} />
                            Alerta de Desastre
                        </label>
                    </div>
                </div>

                {/* REPORTS FEED */}
                <div style={{ width: '100%', maxWidth: '600px', background: 'rgba(15,23,42,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        BOLETINES CLIMÁTICOS TRANSMITIDOS EN LA MALLA
                    </div>

                    {reports.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '20px' }}>
                            No hay alertas ni boletines registrados.
                        </div>
                    ) : (
                        reports.map((r) => (
                            <div key={r.id} style={{
                                background: r.is_disaster_alert ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.02)',
                                border: r.is_disaster_alert ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '10px',
                                padding: '12px',
                                marginBottom: '10px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                                    <span style={{ fontWeight: 800, color: r.is_disaster_alert ? '#ef4444' : '#f59e0b' }}>
                                        {r.is_disaster_alert ? '🚨 ALERTA: ' : '🌤️ '}{r.sender_name}
                                    </span>
                                    <span style={{ color: '#64748b', fontFamily: 'monospace' }}>
                                        {new Date(r.timestamp * 1000).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>{r.condition_summary}</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>
                                    Presión: {r.pressure_hpa} hPa | Temp: {r.temperature_c || 21.5}°C
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

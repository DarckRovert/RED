'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getWeatherReports, postWeatherReport, WeatherReport } from '../lib/api';

export const WeatherAlertPanel: React.FC = () => {
    const { navigate, isAuthenticated } = useRedStore();
    const [reports, setReports] = useState<WeatherReport[]>([]);
    const [pressure, setPressure] = useState<string>('');
    const [temperature, setTemperature] = useState<string>('');
    const [humidity, setHumidity] = useState<string>('');
    const [summary, setSummary] = useState('');
    const [isAlert, setIsAlert] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const loadReports = useCallback(async () => {
        try {
            const list = await getWeatherReports();
            setReports(list);
        } catch (e) {
            console.error('Weather fetch error:', e);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadReports();
        const interval = setInterval(loadReports, 4000);
        return () => clearInterval(interval);
    }, [loadReports, isAuthenticated]);

    const validateForm = (): boolean => {
        if (!pressure || isNaN(parseFloat(pressure))) {
            setFormError('La presión barométrica es requerida (ej: 1013.25 hPa).');
            return false;
        }
        if (!summary.trim()) {
            setFormError('El resumen de condición climática es requerido.');
            return false;
        }
        const pressureVal = parseFloat(pressure);
        if (pressureVal < 870 || pressureVal > 1085) {
            setFormError('Presión fuera de rango válido (870 – 1085 hPa).');
            return false;
        }
        setFormError(null);
        return true;
    };

    const handleBroadcastReport = async () => {
        if (!validateForm()) return;

        const pressureVal = parseFloat(pressure);
        const tempVal = temperature !== '' ? parseFloat(temperature) : undefined;
        const humidityVal = humidity !== '' ? parseFloat(humidity) : undefined;

        // Validate optional fields if provided
        if (temperature !== '' && isNaN(tempVal!)) {
            setFormError('Temperatura inválida (ej: 21.5).');
            return;
        }
        if (humidity !== '' && (isNaN(humidityVal!) || humidityVal! < 0 || humidityVal! > 100)) {
            setFormError('Humedad inválida: debe ser un número entre 0 y 100.');
            return;
        }

        try {
            await postWeatherReport({
                sender_name: 'Estación Vecinal RED',
                pressure_hpa: pressureVal,
                temperature_c: tempVal,
                humidity_percent: humidityVal,
                condition_summary: summary.trim(),
                is_disaster_alert: isAlert
            });
            await loadReports();

            // Clear form after successful submission
            setPressure('');
            setTemperature('');
            setHumidity('');
            setSummary('');
            setIsAlert(false);
            setFormError(null);

            alert('🌤️ Boletín barométrico emitido a la red P2P.');
        } catch (e: any) {
            alert(`Error al emitir boletín: ${e.message}`);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '8px 12px',
        color: '#fff',
        fontSize: '0.85rem',
        boxSizing: 'border-box'
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
                    style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🌤️ ALERTAS BAROMÉTRICAS & CLIMA MESH
                </div>
                <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 800, fontFamily: 'monospace' }}>
                    RED SENSOR MESH
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* BROADCAST FORM */}
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
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, marginBottom: '14px' }}>
                        REGISTRAR CONDICIONES CLIMÁTICAS LOCALES
                    </div>

                    {/* PRESSURE — required */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                            PRESIÓN BAROMÉTRICA (hPa) — <span style={{ color: '#ef4444' }}>requerido</span>
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="870"
                            max="1085"
                            value={pressure}
                            onChange={(e) => setPressure(e.target.value)}
                            placeholder="Ej: 1013.25"
                            style={inputStyle}
                        />
                    </div>

                    {/* TEMPERATURE — optional */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                            TEMPERATURA (°C) — opcional
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="-60"
                            max="60"
                            value={temperature}
                            onChange={(e) => setTemperature(e.target.value)}
                            placeholder="Ej: 21.5 (lee el termómetro real)"
                            style={inputStyle}
                        />
                    </div>

                    {/* HUMIDITY — optional */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                            HUMEDAD RELATIVA (%) — opcional
                        </label>
                        <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={humidity}
                            onChange={(e) => setHumidity(e.target.value)}
                            placeholder="Ej: 65"
                            style={inputStyle}
                        />
                    </div>

                    {/* CONDITION SUMMARY — required */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                            RESUMEN DE CONDICIÓN — <span style={{ color: '#ef4444' }}>requerido</span>
                        </label>
                        <input
                            type="text"
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            placeholder="Ej: Lluvia moderada — Tormenta eléctrica al NE"
                            style={inputStyle}
                        />
                    </div>

                    {/* DISASTER ALERT TOGGLE + SUBMIT */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>
                            <input type="checkbox" checked={isAlert} onChange={(e) => setIsAlert(e.target.checked)} />
                            🚨 Marcar como Alerta de Desastre
                        </label>
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

                    {/* VALIDATION ERROR */}
                    {formError && (
                        <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#fca5a5' }}>
                            ⚠️ {formError}
                        </div>
                    )}
                </div>

                {/* REPORTS FEED */}
                <div style={{ width: '100%', maxWidth: '600px', background: 'rgba(15,23,42,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        BOLETINES CLIMÁTICOS EN LA MALLA ({reports.length})
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
                                <div style={{ fontSize: '0.88rem', color: '#e2e8f0', marginBottom: '4px' }}>{r.condition_summary}</div>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                    Presión: {r.pressure_hpa} hPa
                                    {r.temperature_c != null && ` | Temp: ${r.temperature_c}°C`}
                                    {r.humidity_percent != null && ` | Humedad: ${r.humidity_percent}%`}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

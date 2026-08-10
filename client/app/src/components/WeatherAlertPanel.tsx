'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getWeatherReports, postWeatherReport, WeatherReport } from '../lib/api';

export const WeatherAlertPanel: React.FC = () => {
    const { navigate, isAuthenticated, identity } = useRedStore();
    const myNickname = identity?.nickname || 'Estación Vecinal RED';
    const [reports, setReports] = useState<WeatherReport[]>([]);
    const [pressure, setPressure] = useState<string>('');
    const [temperature, setTemperature] = useState<string>('');
    const [humidity, setHumidity] = useState<string>('');
    const [summary, setSummary] = useState('');
    const [isAlert, setIsAlert] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [detecting, setDetecting] = useState(false);
    const [sensorMeta, setSensorMeta] = useState<string | null>(null);

    const parseWmoCode = (code: number): string => {
        switch (code) {
            case 0: return 'Cielos Limpios (Despejado)';
            case 1: case 2: case 3: return 'Parcialmente Nublado';
            case 45: case 48: return 'Niebla Banco Denso';
            case 51: case 53: case 55: return 'Llovizna Ligera';
            case 61: case 63: case 65: return 'Lluvia Moderada';
            case 71: case 73: case 75: return 'Nieve / Helada';
            case 80: case 81: case 82: return 'Chubascos Intensos';
            case 95: case 96: case 99: return 'Tormenta Eléctrica Severa';
            default: return 'Condición Atmosférica Variable';
        }
    };

    const autoDetectWeather = useCallback(async () => {
        setDetecting(true);
        setFormError(null);
        try {
            let lat = 4.6097, lon = -74.0817; // Default Bogotá coordinates fallback
            try {
                const { Geolocation } = await import('@capacitor/geolocation');
                const pos = await Geolocation.getCurrentPosition({ timeout: 5000, enableHighAccuracy: true });
                lat = pos.coords.latitude;
                lon = pos.coords.longitude;
            } catch {
                if ('geolocation' in navigator) {
                    await new Promise<void>((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            (p) => { lat = p.coords.latitude; lon = p.coords.longitude; resolve(); },
                            () => resolve(),
                            { timeout: 4000 }
                        );
                    });
                }
            }

            // Fetch real meteorological & barometric data from Open-Meteo (100% free, real atmospheric sensor grid)
            const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,surface_pressure,weather_code`,
                { signal: AbortSignal.timeout(6000) }
            );
            if (res.ok) {
                const data = await res.json();
                const cur = data.current || {};
                if (cur.surface_pressure) setPressure(cur.surface_pressure.toFixed(2));
                if (cur.temperature_2m !== undefined) setTemperature(cur.temperature_2m.toFixed(1));
                if (cur.relative_humidity_2m !== undefined) setHumidity(cur.relative_humidity_2m.toString());
                
                const conditionStr = parseWmoCode(cur.weather_code || 0);
                setSummary(conditionStr);

                const isThunderstorm = (cur.weather_code || 0) >= 95 || (cur.surface_pressure && cur.surface_pressure < 980);
                setIsAlert(isThunderstorm);

                setSensorMeta(`📍 GPS: ${lat.toFixed(3)}°, ${lon.toFixed(3)}° | Estación Atmosférica Real`);
            } else {
                setSensorMeta('⚠️ API Meteorológica inaccesible. Puedes ingresar los datos manualmente.');
            }
        } catch (e: any) {
            console.warn('[Weather AutoDetect] Sensor offline fallback', e);
            setSensorMeta('🌐 Modo Fuera de Línea — ingresa la lectura del barómetro o selecciona datos de la malla.');
        } finally {
            setDetecting(false);
        }
    }, []);

    const loadReports = useCallback(async () => {
        try {
            const list = await getWeatherReports();
            setReports(Array.isArray(list) ? list : []);
        } catch (e) {
            console.error('Weather fetch error:', e);
            setReports([]);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        loadReports();
        autoDetectWeather(); // Automatically scan & auto-fill real sensors on mount
        const interval = setInterval(loadReports, 4000);
        return () => clearInterval(interval);
    }, [loadReports, autoDetectWeather, isAuthenticated]);

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
                sender_name: myNickname,
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>
                            REGISTRAR CONDICIONES CLIMÁTICAS LOCALES
                        </div>
                        <button
                            onClick={autoDetectWeather}
                            disabled={detecting}
                            style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                color: '#60a5fa',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: detecting ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            {detecting ? (
                                <>
                                    <span style={{ animation: 'spin 1s linear infinite' }}>⚙</span>
                                    Detectando GPS & Sensores...
                                </>
                            ) : (
                                <>🛰️ Auto-Detectar GPS & Sensores Real-Time</>
                            )}
                        </button>
                    </div>

                    {sensorMeta && (
                        <div style={{
                            marginBottom: '14px',
                            padding: '8px 12px',
                            background: 'rgba(0, 217, 126, 0.1)',
                            border: '1px solid rgba(0, 217, 126, 0.25)',
                            borderRadius: '8px',
                            fontSize: '0.78rem',
                            color: '#00D97E',
                            fontWeight: 600,
                        }}>
                            {sensorMeta}
                        </div>
                    )}

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
                {(() => {
                    const safeReports = Array.isArray(reports) ? reports : [];
                    return (
                        <div style={{ width: '100%', maxWidth: '600px', background: 'rgba(15,23,42,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' }}>
                                BOLETINES CLIMÁTICOS EN LA MALLA ({safeReports.length})
                            </div>

                            {safeReports.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '20px' }}>
                                    No hay alertas ni boletines registrados.
                                </div>
                            ) : (
                                safeReports.map((r) => (
                                    <div key={r.id || Math.random().toString()} style={{
                                        background: r.is_disaster_alert ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.02)',
                                        border: r.is_disaster_alert ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '10px',
                                        padding: '12px',
                                        marginBottom: '10px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.82rem' }}>
                                            <span style={{ fontWeight: 800, color: r.is_disaster_alert ? '#ef4444' : '#f59e0b' }}>
                                                {r.is_disaster_alert ? '🚨 ALERTA: ' : '🌤️ '}{r.sender_name || 'Estación RED'}
                                            </span>
                                            <span style={{ color: '#64748b', fontFamily: 'monospace' }}>
                                                {r.timestamp ? new Date(r.timestamp * 1000).toLocaleTimeString() : 'Ahora'}
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
                    );
                })()}
            </div>
        </div>
    );
};

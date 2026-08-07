'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getBatteryStatus, updateBatteryOptimize, EcoMeshStatus } from '../lib/api';

export const EcoMeshPanel: React.FC = () => {
    const { navigate } = useRedStore();
    const [status, setStatus] = useState<EcoMeshStatus | null>(null);
    const [batteryInput, setBatteryInput] = useState<number>(85);
    const [isCharging, setIsCharging] = useState<boolean>(false);
    const [isRealHardwareSensor, setIsRealHardwareSensor] = useState<boolean>(false);

    const loadStatus = async () => {
        try {
            const st = await getBatteryStatus();
            if (st) {
                setStatus(st);
                setBatteryInput(st.battery_level ?? 85);
            }
        } catch (e) {
            console.error('Battery status error:', e);
        }
    };

    const syncRealBattery = async (levelPercent: number) => {
        setBatteryInput(levelPercent);
        try {
            const res = await updateBatteryOptimize(levelPercent);
            setStatus(res.battery_status);
        } catch (e: any) {
            console.error('Battery update error:', e);
        }
    };

    const detectHardwareBattery = async () => {
        let detected = false;
        // Attempt 1: Capacitor Device Plugin (Mobile Android/iOS)
        try {
            const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
            if (cap && cap.Plugins && cap.Plugins.Device) {
                const info = await cap.Plugins.Device.getBatteryInfo();
                if (info && typeof info.batteryLevel === 'number') {
                    const pct = Math.round(info.batteryLevel * 100);
                    setIsCharging(!!info.isCharging);
                    setIsRealHardwareSensor(true);
                    await syncRealBattery(pct);
                    detected = true;
                }
            }
        } catch {}

        // Attempt 2: HTML5 Navigator Battery Status API (Desktop Chrome/Edge/Firefox)
        if (!detected && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
            try {
                const battery: any = await (navigator as any).getBattery();
                const updateHtml5Battery = () => {
                    const pct = Math.round(battery.level * 100);
                    setIsCharging(!!battery.charging);
                    setIsRealHardwareSensor(true);
                    syncRealBattery(pct);
                };
                updateHtml5Battery();
                battery.addEventListener('levelchange', updateHtml5Battery);
                battery.addEventListener('chargingchange', updateHtml5Battery);
                detected = true;
            } catch {}
        }

        if (!detected) {
            loadStatus();
        }
    };

    useEffect(() => {
        detectHardwareBattery();
    }, []);

    const handleUpdate = async (val: number) => {
        await syncRealBattery(val);
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
                        color: '#22c55e',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🔋 RESILIENCIA DE BATERÍA ECO-MESH
                </div>
                <div style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 800, fontFamily: 'monospace' }}>
                    DUTY-CYCLE OPTIMIZER
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '540px',
                    background: 'rgba(15,23,42,0.7)',
                    borderRadius: '16px',
                    border: '1px solid rgba(34,197,94,0.3)',
                    padding: '24px',
                    boxShadow: '0 0 30px rgba(34,197,94,0.1)'
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#22c55e', marginBottom: '16px', letterSpacing: '0.5px' }}>
                        CALCULADOR DE AUTONOMÍA RADIO MESH EN EMERGENCIA
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{ fontSize: '3rem', fontWeight: 900, color: '#22c55e', fontFamily: 'monospace' }}>
                            ~{status?.estimated_mesh_hours || 48.5} HORAS
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                            AUTONOMÍA ESTIMADA EN MALLA DESCENTRALIZADA SIN RED ELÉCTRICA
                        </div>
                    </div>

                    {/* BATTERY SLIDER */}
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
                            <span>NIVEL DE BATERÍA DEL TELÉFONO:</span>
                            <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {isRealHardwareSensor && <span style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid #22c55e', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem' }}>⚡ SENSOR REAL DISPOSITIVO {isCharging ? '(CARGANDO)' : ''}</span>}
                                {batteryInput}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={batteryInput}
                            onChange={(e) => handleUpdate(parseInt(e.target.value))}
                            style={{ width: '100%', accentColor: '#22c55e', cursor: 'pointer' }}
                        />
                    </div>

                    {/* ECO STATUS TELEMETRY */}
                    <div style={{ background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '12px', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#94a3b8' }}>INTERVALO ESCANEO BLE:</span>
                            <span style={{ color: '#fff', fontWeight: 700 }}>{status?.ble_scan_interval_ms || 2500} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ color: '#94a3b8' }}>POTENCIA TRANSMISIÓN LORA:</span>
                            <span style={{ color: '#fff', fontWeight: 700 }}>{status?.lora_tx_power_dbm || 14} dBm</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#94a3b8' }}>MODO AHORRO ECO-MESH:</span>
                            <span style={{ color: status?.eco_mode_enabled ? '#22c55e' : '#e2e8f0', fontWeight: 800 }}>
                                {status?.eco_mode_enabled ? 'ACTIVADO ✓' : 'ESTÁNDAR'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getBatteryStatus, updateBatteryOptimize, EcoMeshStatus } from '../lib/api';

export const EcoMeshPanel: React.FC = () => {
    const { navigate } = useRedStore();
    const [status, setStatus] = useState<EcoMeshStatus | null>(null);
    const [batteryInput, setBatteryInput] = useState<number>(85);

    const loadStatus = async () => {
        try {
            const st = await getBatteryStatus();
            setStatus(st);
            setBatteryInput(st.battery_level);
        } catch (e) {
            console.error('Battery status error:', e);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const handleUpdate = async (val: number) => {
        setBatteryInput(val);
        try {
            const res = await updateBatteryOptimize(val);
            setStatus(res.battery_status);
        } catch (e: any) {
            console.error('Battery update error:', e);
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
                            <span style={{ color: '#22c55e' }}>{batteryInput}%</span>
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

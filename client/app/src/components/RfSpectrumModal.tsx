"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { RfSpectrumAnalyzerEngine, RfSpectrumMetrics } from "../lib/RfSpectrumAnalyzerEngine";

export function RfSpectrumModal() {
    const { navigate } = useRedStore();

    const [metrics, setMetrics] = useState<RfSpectrumMetrics>(RfSpectrumAnalyzerEngine.analyzeEnvironment([]));
    const [isScanning, setIsScanning] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            if (isScanning) {
                // Generate live RSSI sample list
                const baseRssi = Math.floor(Math.random() * -30) - 50;
                const sampleRssiList = Array.from({ length: 6 }, () => baseRssi + Math.floor(Math.random() * 15) - 7);
                const updated = RfSpectrumAnalyzerEngine.analyzeEnvironment(sampleRssiList);
                setMetrics(updated);
            }
        }, 1500);

        return () => clearInterval(interval);
    }, [isScanning]);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(4,6,10,0.96)', color: '#fff',
            display: 'flex', flexDirection: 'column', padding: '20px',
            overflowY: 'auto', backdropFilter: 'blur(12px)'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #A855F7, #7E22CE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🛡️</div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Analizador de Espectro RF & Guerra Electrónica</div>
                        <div style={{ fontSize: '0.72rem', color: '#A855F7' }}>Detección de Jammers, Inhibitores & Ataques Deauth</div>
                    </div>
                </div>
                <button onClick={() => navigate('sidebar')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
            </div>

            {/* Jamming Alert Banner */}
            <div style={{
                background: metrics.jammingThreatLevel === 'CRÍTICO_JAMMING' ? 'rgba(232,33,58,0.2)' : metrics.jammingThreatLevel === 'ELEVADO' ? 'rgba(255,179,0,0.2)' : 'rgba(0,230,118,0.15)',
                border: `1px solid ${metrics.jammingThreatLevel === 'CRÍTICO_JAMMING' ? '#E8213A' : metrics.jammingThreatLevel === 'ELEVADO' ? '#FFB300' : '#00E676'}`,
                borderRadius: '16px', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: '#AAA', textTransform: 'uppercase' }}>Estado del Espectro Radioeléctrico</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: metrics.jammingThreatLevel === 'CRÍTICO_JAMMING' ? '#E8213A' : metrics.jammingThreatLevel === 'ELEVADO' ? '#FFB300' : '#00E676' }}>
                        {metrics.jammingThreatLevel === 'CRÍTICO_JAMMING' ? '🚨 SATURACIÓN DETECTADA (POSIBLE JAMMER)' : metrics.jammingThreatLevel === 'ELEVADO' ? '⚠️ INTERFERENCIA ELEVADA EN 2.4 GHz' : '✅ ESPECTRO LIMPIO (ENTORNO SEGURO)'}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#AAA' }}>Confianza del Diagnóstico</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>{metrics.confidenceScorePercent}%</div>
                </div>
            </div>

            {/* 2.4 GHz Channel Waterfall Simulation */}
            <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#A855F7', marginBottom: '12px' }}>📊 Distribución de Potencia de Canales ISM (2.4 GHz)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {metrics.activeChannels.map((ch, idx) => {
                        const heightPct = Math.max(10, Math.min(100, (ch.rssiDb + 100) * 1.6));
                        return (
                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                <div style={{ fontSize: '0.7rem', color: '#AAA', marginBottom: '4px' }}>{ch.rssiDb}dB</div>
                                <div style={{
                                    width: '100%', height: `${heightPct}%`,
                                    background: 'linear-gradient(180deg, #A855F7 0%, #3B82F6 100%)',
                                    borderRadius: '6px 6px 0 0', transition: 'height 0.3s ease'
                                }} />
                                <div style={{ fontSize: '0.68rem', color: '#888', marginTop: '6px' }}>Ch {idx + 1}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tactical Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'rgba(15,23,42,0.9)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#AAA' }}>Potencia Promedio (RSSI)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38BDF8' }}>{metrics.averageRssiDb} dBm</div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.9)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#AAA' }}>Varianza del Ruido (σ²)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#00E676' }}>{metrics.rssiVariance}</div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.9)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#AAA' }}>Tasa Pérdida de Paquetes</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: metrics.packetLossRatePercent > 20 ? '#E8213A' : '#00E676' }}>{metrics.packetLossRatePercent}%</div>
                </div>
            </div>
        </div>
    );
}

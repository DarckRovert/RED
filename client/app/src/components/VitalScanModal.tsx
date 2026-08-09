"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { VitalScanEngine, PPGScanResult, StartTriageResult } from "../lib/VitalScanEngine";

export function VitalScanModal() {
    const { navigate } = useRedStore();

    // PPG Scanner States
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [redIntensity, setRedIntensity] = useState(0);
    const [scanResult, setScanResult] = useState<PPGScanResult | null>(null);

    // START Triage Form States
    const [canWalk, setCanWalk] = useState(false);
    const [isBreathing, setIsBreathing] = useState(true);
    const [respRate, setRespRate] = useState(20);
    const [capRefillSec, setCapRefillSec] = useState(1.5);
    const [canFollowCommands, setCanFollowCommands] = useState(true);
    const [triageResult, setTriageResult] = useState<StartTriageResult | null>(null);

    // Water purification calculator states
    const [waterLiters, setWaterLiters] = useState("2");
    const [altitudeMeters, setAltitudeMeters] = useState("1500");

    const handleStartPPG = async () => {
        setIsScanning(true);
        setScanResult(null);
        setScanProgress(0);

        const ok = await VitalScanEngine.startPPGScan(
            (sample) => {
                setRedIntensity(sample.redIntensity);
                setScanProgress(sample.progress);
            },
            (result) => {
                setIsScanning(false);
                setScanResult(result);
            }
        );

        if (!ok) {
            setIsScanning(false);
            alert("No se pudo acceder a la cámara o activar el destello LED. Verifica los permisos.");
        }
    };

    const handleEvaluateTriage = () => {
        const res = VitalScanEngine.evaluateStartTriage(
            canWalk,
            isBreathing,
            respRate,
            capRefillSec,
            canFollowCommands
        );
        setTriageResult(res);
    };

    const liters = parseFloat(waterLiters) || 1;
    const alt = parseFloat(altitudeMeters) || 0;
    const chlorineDrops = Math.ceil(liters * 2);
    const boilingTempC = (100 - (alt / 300)).toFixed(1);

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
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #E8213A, #C0152A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🫀</div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Escáner de Signos Vitales & Triaje START</div>
                        <div style={{ fontSize: '0.72rem', color: '#E8213A' }}>Fotopletismografía por Cámara (PPG) & Asistencia Médica</div>
                    </div>
                </div>
                <button onClick={() => { VitalScanEngine.stopPPGScan(); navigate('sidebar'); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {/* PPG Camera Pulse Scanner */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(232,33,58,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#E8213A', marginBottom: '8px' }}>📸 Fotopletismografía (Pulso Cardiaco)</div>
                    <div style={{ fontSize: '0.75rem', color: '#AAA', textAlign: 'center', marginBottom: '14px' }}>
                        Coloca la yema de tu dedo sobre el lente de la cámara principal cubriendo el Flash LED:
                    </div>

                    <div style={{ width: 140, height: 140, borderRadius: '50%', border: '4px solid #E8213A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,33,58,0.1)', boxShadow: isScanning ? '0 0 24px rgba(232,33,58,0.6)' : 'none', transition: 'all 0.3s' }}>
                        {isScanning ? (
                            <>
                                <div style={{ fontSize: '1.8rem', animation: 'pulse 0.8s infinite' }}>❤️</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#E8213A', marginTop: 4 }}>{(scanProgress * 100).toFixed(0)}%</div>
                            </>
                        ) : scanResult ? (
                            <>
                                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace' }}>{scanResult.bpm}</div>
                                <div style={{ fontSize: '0.75rem', color: '#AAA' }}>BPM</div>
                            </>
                        ) : (
                            <div style={{ fontSize: '2rem' }}>☝️</div>
                        )}
                    </div>

                    {isScanning && (
                        <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                            <div style={{ width: `${scanProgress * 100}%`, height: '100%', background: '#E8213A', transition: 'width 0.1s linear' }} />
                        </div>
                    )}

                    <button
                        onClick={handleStartPPG}
                        disabled={isScanning}
                        style={{
                            marginTop: '16px', width: '100%', padding: '12px',
                            background: 'linear-gradient(90deg, #E8213A, #C0152A)',
                            color: '#fff', border: 'none', borderRadius: '10px',
                            fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(232,33,58,0.4)'
                        }}
                    >
                        {isScanning ? "MEDICIÓN EN PROCESO..." : "⚡ ESCANEAR PULSO CARDIACO (10 SEG)"}
                    </button>
                </div>

                {/* START Triage Assistant */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFB300', marginBottom: '8px' }}>🩺 Clasificación de Triaje START</div>
                    <div style={{ fontSize: '0.75rem', color: '#AAA', marginBottom: '10px' }}>Responde las preguntas de evaluación primaria para el paciente:</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="checkbox" checked={canWalk} onChange={e => setCanWalk(e.target.checked)} />
                            <span>¿El paciente puede caminar solo?</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="checkbox" checked={isBreathing} onChange={e => setIsBreathing(e.target.checked)} />
                            <span>¿El paciente está respirando?</span>
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Frecuencia respiratoria (RPM): <strong>{respRate}</strong></span>
                            <input type="range" min={5} max={45} value={respRate} onChange={e => setRespRate(parseInt(e.target.value))} style={{ width: '100px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Llenado capilar (segundos): <strong>{capRefillSec}s</strong></span>
                            <input type="range" min={0.5} max={4} step={0.5} value={capRefillSec} onChange={e => setCapRefillSec(parseFloat(e.target.value))} style={{ width: '100px' }} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="checkbox" checked={canFollowCommands} onChange={e => setCanFollowCommands(e.target.checked)} />
                            <span>¿Obedece órdenes sencillas (ej. apriete la mano)?</span>
                        </label>

                        <button onClick={handleEvaluateTriage} style={{ padding: '10px', background: '#FFB300', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', marginTop: '6px' }}>
                            📋 EVALUAR TRIAGE START
                        </button>

                        {triageResult && (
                            <div style={{
                                marginTop: '8px', padding: '12px', borderRadius: '10px',
                                border: `2px solid ${triageResult.category === 'VERDE' ? '#00E676' : triageResult.category === 'AMARILLO' ? '#FFB300' : triageResult.category === 'ROJO' ? '#E8213A' : '#777'}`,
                                background: 'rgba(0,0,0,0.4)'
                            }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: triageResult.category === 'VERDE' ? '#00E676' : triageResult.category === 'AMARILLO' ? '#FFB300' : triageResult.category === 'ROJO' ? '#E8213A' : '#AAA' }}>
                                    Categoría: {triageResult.category} — {triageResult.label}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#DDD', marginTop: '4px' }}>
                                    {triageResult.actionRequired}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Water Purification & Altitude Calculator */}
            <div style={{ marginTop: '20px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '16px' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38BDF8', marginBottom: '8px' }}>💧 Dosificación de Potabilización de Agua & Altitud</div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', color: '#AAA', marginBottom: '4px' }}>Volumen de Agua (Litros):</label>
                        <input value={waterLiters} onChange={e => setWaterLiters(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} />
                        <div style={{ marginTop: '6px', color: '#00E676', fontWeight: 700 }}>
                            🧪 Desinfección: Usar <strong>{chlorineDrops} gotas</strong> de cloro limpio por {liters}L (reposar 30 min).
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', color: '#AAA', marginBottom: '4px' }}>Altitud Barométrica Estimada (Metros):</label>
                        <input value={altitudeMeters} onChange={e => setAltitudeMeters(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }} />
                        <div style={{ marginTop: '6px', color: '#FFB300', fontWeight: 700 }}>
                            🔥 Ebullición: El agua hierve a <strong>{boilingTempC}°C</strong>. Mantener hervor durante al menos 3 minutos continuos.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { VitalScanEngine, PPGScanResult, StartTriageResult, TriageRecord } from "../lib/VitalScanEngine";

export function VitalScanModal() {
    const { navigate } = useRedStore();

    // PPG Scanner States
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [scanResult, setScanResult] = useState<PPGScanResult | null>(null);
    const [isFingerDetected, setIsFingerDetected] = useState(true);

    // Live PPG Cardiac Waveform Buffer
    const waveBuffer = useRef<number[]>(new Array(100).fill(0));
    const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // START Triage Form States
    const [canWalk, setCanWalk] = useState(false);
    const [isBreathing, setIsBreathing] = useState(true);
    const [breathesAfterAirway, setBreathesAfterAirway] = useState(false);
    const [respRate, setRespRate] = useState(20);
    const [capRefillSec, setCapRefillSec] = useState(1.5);
    const [canFollowCommands, setCanFollowCommands] = useState(true);
    const [triageResult, setTriageResult] = useState<StartTriageResult | null>(null);

    // Triage Records History
    const [triageRecords, setTriageRecords] = useState<TriageRecord[]>([]);
    const [victimLabelInput, setVictimLabelInput] = useState("");

    // Water purification calculator states
    const [waterLiters, setWaterLiters] = useState("2");
    const [altitudeMeters, setAltitudeMeters] = useState("0");
    const [isTurbidWater, setIsTurbidWater] = useState(false);

    useEffect(() => {
        try {
            const savedTriage = localStorage.getItem("red_triage_records");
            if (savedTriage) setTriageRecords(JSON.parse(savedTriage));
        } catch {}

        // Read real altitude from device GPS if available
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (pos.coords.altitude !== null && pos.coords.altitude !== undefined) {
                        setAltitudeMeters(Math.round(pos.coords.altitude).toString());
                    }
                },
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        // Cleanup camera stream and Flash LED on unmount
        return () => {
            VitalScanEngine.stopPPGScan();
        };
    }, []);

    // Draw Real-time PPG Pulse Waveform on Canvas with Dynamic Automatic Gain Control (AGC)
    const drawWaveform = (waveSample: number) => {
        waveBuffer.current.push(waveSample);
        if (waveBuffer.current.length > 100) waveBuffer.current.shift();

        const canvas = waveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(232, 33, 58, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // Calculate dynamic Automatic Gain Control (AGC) peak-to-peak amplitude
        const buf = waveBuffer.current;
        let maxVal = Math.max(...buf);
        let minVal = Math.min(...buf);
        const p2p = Math.max(0.1, maxVal - minVal);
        const gain = (h * 0.35) / (p2p / 2); // Scale wave to occupy 70% of canvas height

        ctx.strokeStyle = "#E8213A";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#E8213A";
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const step = w / (buf.length - 1);
        buf.forEach((val, i) => {
            const x = i * step;
            const y = h / 2 - val * gain;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
        ctx.shadowBlur = 0;
    };

    const handleStartPPG = async () => {
        setIsScanning(true);
        setScanResult(null);
        setScanProgress(0);
        setIsFingerDetected(true);
        waveBuffer.current = new Array(100).fill(0);

        const ok = await VitalScanEngine.startPPGScan(
            (sample) => {
                setScanProgress(sample.progress);
                setIsFingerDetected(sample.isFingerDetected);
                drawWaveform(sample.waveSample);
            },
            (result) => {
                setIsScanning(false);
                setScanResult(result);
            }
        );

        if (!ok) {
            setIsScanning(false);
            alert("No se pudo acceder a la cámara o activar el destello LED. Verifica los permisos de cámara.");
        }
    };

    const handleEvaluateTriage = () => {
        const res = VitalScanEngine.evaluateStartTriage(
            canWalk,
            isBreathing,
            breathesAfterAirway,
            respRate,
            capRefillSec,
            canFollowCommands
        );
        setTriageResult(res);
    };

    const handleSaveTriageRecord = () => {
        if (!triageResult) return;
        const label = victimLabelInput.trim() || `Víctima #${triageRecords.length + 1}`;
        const record: TriageRecord = {
            id: Date.now().toString(),
            victimLabel: label,
            category: triageResult.category,
            bpm: (scanResult && scanResult.bpm > 0) ? scanResult.bpm : undefined,
            spo2: (scanResult && scanResult.spo2 > 0) ? scanResult.spo2 : undefined,
            timestamp: Date.now(),
            notes: triageResult.label
        };

        const updated = [record, ...triageRecords];
        setTriageRecords(updated);
        try { localStorage.setItem("red_triage_records", JSON.stringify(updated)); } catch {}
        setVictimLabelInput("");
        alert(`✅ Víctima '${label}' clasificada como ${triageResult.category} y guardada en registro.`);
    };

    const handleDeleteRecord = (id: string) => {
        const updated = triageRecords.filter(r => r.id !== id);
        setTriageRecords(updated);
        try { localStorage.setItem("red_triage_records", JSON.stringify(updated)); } catch {}
    };

    const liters = Math.max(0.1, parseFloat(waterLiters) || 1);
    const alt = Math.max(0, parseFloat(altitudeMeters) || 0);
    const chlorineMultiplier = isTurbidWater ? 4 : 2;
    const chlorineDrops = Math.ceil(liters * chlorineMultiplier);
    const dropsText = chlorineDrops === 1 ? "1 gota" : `${chlorineDrops} gotas`;
    const boilingTempC = (100 - (alt / 300)).toFixed(1);
    const requiredBoilingMins = alt > 2000 ? 3 : 1;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(4,6,10,0.98)', color: '#fff',
            display: 'flex', flexDirection: 'column',
            padding: '14px 14px 90px 14px',
            overflowY: 'auto', overflowX: 'hidden',
            backdropFilter: 'blur(12px)', boxSizing: 'border-box'
        }}>
            <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '12px', background: 'linear-gradient(135deg, #E8213A, #C0152A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🫀</div>
                        <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Escáner Signos Vitales & Triaje START</div>
                            <div style={{ fontSize: '0.7rem', color: '#E8213A' }}>Fotopletismografía por Cámara (PPG) & Asistencia Médica</div>
                        </div>
                    </div>
                    <button onClick={() => { VitalScanEngine.stopPPGScan(); navigate('sidebar'); }} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>✕ Cerrar</button>
                </div>

                {/* PPG Camera Pulse & Waveform Card */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(232,33,58,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#E8213A', marginBottom: '4px' }}>📸 Fotopletismografía Óptica (Pulso & SpO2)</div>
                    <div style={{ fontSize: '0.72rem', color: '#AAA', textAlign: 'center', marginBottom: '14px' }}>
                        Cubre el lente de la cámara principal y el Flash LED con la yema del dedo:
                    </div>

                    <div style={{ width: 130, height: 130, borderRadius: '50%', border: `4px solid ${isScanning && !isFingerDetected ? '#FFB300' : '#E8213A'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,33,58,0.1)', boxShadow: isScanning ? '0 0 24px rgba(232,33,58,0.6)' : 'none', transition: 'all 0.3s' }}>
                        {isScanning ? (
                            <>
                                <div style={{ fontSize: '1.8rem', animation: 'pulse 0.8s infinite' }}>❤️</div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: isFingerDetected ? '#E8213A' : '#FFB300', marginTop: 4 }}>
                                    {isFingerDetected ? `${(scanProgress * 100).toFixed(0)}%` : '¡COLOCA EL DEDO!'}
                                </div>
                            </>
                        ) : scanResult && scanResult.bpm > 0 ? (
                            <>
                                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#00E676', fontFamily: 'monospace', lineHeight: 1 }}>{scanResult.bpm}</div>
                                <div style={{ fontSize: '0.68rem', color: '#AAA', fontWeight: 700 }}>BPM (Frecuencia)</div>
                                <div style={{ fontSize: '0.85rem', color: '#38BDF8', fontWeight: 800, marginTop: 4 }}>{scanResult.spo2}% SpO2</div>
                            </>
                        ) : scanResult && scanResult.bpm === 0 ? (
                            <div style={{ fontSize: '0.7rem', color: '#FFB300', textAlign: 'center', padding: '10px' }}>⚠️ Señal Débil / Repetir</div>
                        ) : (
                            <div style={{ fontSize: '2rem' }}>☝️</div>
                        )}
                    </div>

                    {/* Live PPG BVP Cardiac Waveform Canvas */}
                    <div style={{ width: '100%', marginTop: '14px', background: 'rgba(0,0,0,0.5)', borderRadius: '10px', padding: '8px', border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: '0.68rem', color: '#AAA', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Onda de Pulso Pulmonar (BVP) en Tiempo Real</div>
                        <canvas ref={waveCanvasRef} width={280} height={45} style={{ width: '100%', height: '45px', display: 'block' }} />
                    </div>

                    {isScanning && !isFingerDetected && (
                        <div style={{ marginTop: '10px', fontSize: '0.74rem', color: '#FFB300', background: 'rgba(255,179,0,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,179,0,0.3)', textAlign: 'center' }}>
                            ⚠️ Por favor cubre bien el lente de la cámara con el dedo para detectar el pulso capilar.
                        </div>
                    )}

                    {scanResult && scanResult.bpm === 0 && (
                        <div style={{ marginTop: '10px', fontSize: '0.74rem', color: '#FFB300', background: 'rgba(255,179,0,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,179,0,0.3)', textAlign: 'center' }}>
                            ⚠️ Señal óptica insuficiente. Mantén el dedo firme sobre la cámara sin presionar fuerte y enciende la luz ambiente si no hay Flash.
                        </div>
                    )}

                    {isScanning && (
                        <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                            <div style={{ width: `${scanProgress * 100}%`, height: '100%', background: '#E8213A', transition: 'width 0.1s linear' }} />
                        </div>
                    )}

                    <button
                        onClick={handleStartPPG}
                        disabled={isScanning}
                        style={{
                            marginTop: '14px', width: '100%', padding: '12px',
                            background: isScanning ? 'rgba(255,255,255,0.1)' : 'linear-gradient(90deg, #E8213A, #C0152A)',
                            color: '#fff', border: 'none', borderRadius: '10px',
                            fontWeight: 800, fontSize: '0.82rem', cursor: isScanning ? 'default' : 'pointer',
                            boxShadow: isScanning ? 'none' : '0 4px 14px rgba(232,33,58,0.4)'
                        }}
                    >
                        {isScanning ? "MEDICIÓN EN PROCESO..." : "⚡ ESCANEAR PULSO CARDIACO & SpO2 (10 SEG)"}
                    </button>
                </div>

                {/* START Triage Assistant */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                    <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#FFB300' }}>🩺 Clasificación de Triaje START (Desastres)</div>
                        <div style={{ fontSize: '0.72rem', color: '#AAA', marginTop: '2px' }}>Algoritmo estandarizado para incidentes con múltiples víctimas:</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                            <input type="checkbox" checked={canWalk} onChange={e => setCanWalk(e.target.checked)} style={{ width: 16, height: 16 }} />
                            <span>¿El paciente puede caminar solo?</span>
                        </label>

                        {!canWalk && (
                            <>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                                    <input type="checkbox" checked={isBreathing} onChange={e => setIsBreathing(e.target.checked)} style={{ width: 16, height: 16 }} />
                                    <span>¿El paciente está respirando espontáneamente?</span>
                                </label>

                                {!isBreathing && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(232,33,58,0.15)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(232,33,58,0.4)' }}>
                                        <input type="checkbox" checked={breathesAfterAirway} onChange={e => setBreathesAfterAirway(e.target.checked)} style={{ width: 16, height: 16 }} />
                                        <span style={{ color: '#FF8A80', fontWeight: 700 }}>¿Comienza a respirar tras abrir/reposicionar la vía aérea?</span>
                                    </label>
                                )}

                                {isBreathing && (
                                    <>
                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Frecuencia Respiratoria (RPM):</span>
                                                <strong style={{ color: respRate > 30 || respRate < 10 ? '#E8213A' : '#00E676', fontSize: '0.9rem' }}>{respRate} RPM</strong>
                                            </div>
                                            <input type="range" min={5} max={45} value={respRate} onChange={e => setRespRate(parseInt(e.target.value))} style={{ width: '100%' }} />
                                        </div>

                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Tiempo Llenado Capilar (Llenado Ungueal):</span>
                                                <strong style={{ color: capRefillSec > 2 ? '#E8213A' : '#00E676', fontSize: '0.9rem' }}>{capRefillSec} seg</strong>
                                            </div>
                                            <input type="range" min={0.5} max={4} step={0.5} value={capRefillSec} onChange={e => setCapRefillSec(parseFloat(e.target.value))} style={{ width: '100%' }} />
                                        </div>

                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                                            <input type="checkbox" checked={canFollowCommands} onChange={e => setCanFollowCommands(e.target.checked)} style={{ width: 16, height: 16 }} />
                                            <span>¿Obedece órdenes sencillas (ej. apriete la mano)?</span>
                                        </label>
                                    </>
                                )}
                            </>
                        )}

                        <button onClick={handleEvaluateTriage} style={{ width: '100%', padding: '11px', background: '#FFB300', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 900, cursor: 'pointer', fontSize: '0.82rem', marginTop: '4px' }}>
                            📋 EVALUAR CLASIFICACIÓN DE TRIAJE
                        </button>

                        {triageResult && (
                            <div style={{
                                marginTop: '6px', padding: '12px', borderRadius: '12px',
                                border: `2px solid ${triageResult.category === 'VERDE' ? '#00E676' : triageResult.category === 'AMARILLO' ? '#FFB300' : triageResult.category === 'ROJO' ? '#E8213A' : '#777'}`,
                                background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px'
                            }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: triageResult.category === 'VERDE' ? '#00E676' : triageResult.category === 'AMARILLO' ? '#FFB300' : triageResult.category === 'ROJO' ? '#E8213A' : '#AAA' }}>
                                    Categoría: {triageResult.category} — {triageResult.label}
                                </div>
                                <div style={{ fontSize: '0.76rem', color: '#DDD', lineHeight: 1.4 }}>
                                    {triageResult.actionRequired}
                                </div>

                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                    <input
                                        value={victimLabelInput}
                                        onChange={e => setVictimLabelInput(e.target.value)}
                                        style={{ flex: 1, minWidth: 0, padding: '7px 10px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.78rem' }}
                                        placeholder="Etiqueta / Nombre víctima (opcional)"
                                    />
                                    <button
                                        onClick={handleSaveTriageRecord}
                                        style={{ padding: '7px 12px', background: '#00E676', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                                    >
                                        💾 Guardar Registro
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mass Casualty Incident (MCI) Triage Log Viewer */}
                {triageRecords.length > 0 && (
                    <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFF' }}>📊 Registro de Víctimas Triadas ({triageRecords.length})</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                            {triageRecords.map(rec => {
                                const catColor = rec.category === 'VERDE' ? '#00E676' : rec.category === 'AMARILLO' ? '#FFB300' : rec.category === 'ROJO' ? '#E8213A' : '#888';
                                return (
                                    <div key={rec.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', borderLeft: `4px solid ${catColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                        <div>
                                            <strong style={{ color: catColor }}>[{rec.category}] {rec.victimLabel}</strong>
                                            <div style={{ fontSize: '0.7rem', color: '#AAA' }}>
                                                {rec.notes} {rec.bpm ? `• ${rec.bpm} BPM` : ''} {rec.spo2 ? `• ${rec.spo2}% SpO2` : ''}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteRecord(rec.id)} style={{ background: 'transparent', border: 'none', color: '#E8213A', cursor: 'pointer', fontSize: '0.9rem' }}>🗑️</button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Water Purification & Altitude Calculator */}
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38BDF8' }}>💧 Dosificación de Potabilización de Agua & Altitud Barométrica</div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <label style={{ display: 'block', color: '#AAA', marginBottom: '4px', fontSize: '0.74rem' }}>Volumen de Agua (Litros):</label>
                                <input value={waterLiters} onChange={e => setWaterLiters(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', boxSizing: 'border-box' }} placeholder="Litros" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <label style={{ display: 'block', color: '#AAA', marginBottom: '4px', fontSize: '0.74rem' }}>Altitud Estimada (Metros):</label>
                                <input value={altitudeMeters} onChange={e => setAltitudeMeters(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '0.8rem', boxSizing: 'border-box' }} placeholder="Metros msnm" />
                            </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                            <input type="checkbox" checked={isTurbidWater} onChange={e => setIsTurbidWater(e.target.checked)} style={{ width: 15, height: 15 }} />
                            <span style={{ fontSize: '0.76rem' }}>¿El agua está turbia, sucia o con sedimentos? (Duplica cloro)</span>
                        </label>

                        <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', padding: '10px 12px', borderRadius: '8px', color: '#00E676', fontSize: '0.78rem' }}>
                            🧪 <strong>Desinfección Química:</strong> Agregar <strong>{dropsText}</strong> de hipoclorito de sodio sin aroma por {liters}L ({isTurbidWater ? 'dosis turbia' : 'dosis estándar'}). Reposar tapado por 30 minutos antes de consumir.
                        </div>

                        <div style={{ background: 'rgba(255,179,0,0.1)', border: '1px solid rgba(255,179,0,0.3)', padding: '10px 12px', borderRadius: '8px', color: '#FFB300', fontSize: '0.78rem' }}>
                            🔥 <strong>Punto de Ebullición:</strong> A {alt}m de altitud, el agua hierve a <strong>{boilingTempC}°C</strong>. Hervir a borbotones durante al menos <strong>{requiredBoilingMins} minuto(s) continuo(s)</strong> para esterilización biológica completa.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

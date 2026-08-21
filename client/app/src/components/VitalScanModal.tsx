"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { VitalScanEngine, PPGScanResult, StartTriageResult } from "../lib/VitalScanEngine";
import { RedAPI, TriageReportRecord } from "../lib/api";
import { toast } from "./Toast";

type MedicalTab = "ppg" | "triage" | "records" | "water";

export function VitalScanModal() {
    const { navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<MedicalTab>("ppg");

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

    // Triage Records History (From Rust Sled DB & Mesh Gossip)
    const [triageRecords, setTriageRecords] = useState<TriageReportRecord[]>([]);
    const [filterCategory, setFilterCategory] = useState<string>("ALL");
    const [victimLabelInput, setVictimLabelInput] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Device GPS location
    const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({});

    // Water purification calculator states
    const [waterLiters, setWaterLiters] = useState("2");
    const [altitudeMeters, setAltitudeMeters] = useState("0");
    const [isTurbidWater, setIsTurbidWater] = useState(false);

    // ── 0. Carga de Reportes de Triaje desde Rust Sled DB ───────────────────────────
    const loadTriageReports = useCallback(async () => {
        try {
            const reports = await RedAPI.getTriageReports();
            if (Array.isArray(reports)) {
                setTriageRecords(reports);
            }
        } catch {
            // fallback handled silently
        }
    }, []);

    useEffect(() => {
        loadTriageReports();

        // Read real altitude and GPS from device
        if (typeof navigator !== "undefined" && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (pos.coords.altitude !== null && pos.coords.altitude !== undefined) {
                        setAltitudeMeters(Math.round(pos.coords.altitude).toString());
                    }
                    if (pos.coords.latitude && pos.coords.longitude) {
                        setCoords({
                            lat: pos.coords.latitude,
                            lon: pos.coords.longitude,
                        });
                    }
                },
                () => {},
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        drawMedicalGrid();

        return () => {
            VitalScanEngine.stopPPGScan();
        };
    }, [loadTriageReports]);

    // Render ICU Patient Monitor Medical Grid (Rejilla Médica ECG)
    const drawMedicalGrid = () => {
        const canvas = waveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = "rgba(4, 6, 14, 0.98)";
        ctx.fillRect(0, 0, w, h);

        // Minor grid (every 8px)
        ctx.strokeStyle = "rgba(0, 230, 118, 0.06)";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 8) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 8) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Major grid (every 32px)
        ctx.strokeStyle = "rgba(0, 230, 118, 0.16)";
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 32) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += 32) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // Baseline zero line (carmesi sutil)
        ctx.strokeStyle = "rgba(232, 33, 58, 0.35)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
    };

    // Draw live PPG waveform on canvas during scanning
    const drawWaveform = (newSample: number) => {
        const canvas = waveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;

        waveBuffer.current.push(newSample);
        if (waveBuffer.current.length > 120) {
            waveBuffer.current.shift();
        }

        drawMedicalGrid();

        ctx.strokeStyle = "#00E676";
        ctx.lineWidth = 2.2;
        ctx.shadowColor = "#00E676";
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const buffer = waveBuffer.current;
        const step = w / (buffer.length - 1);
        const gain = 2.6;

        buffer.forEach((val, i) => {
            const x = i * step;
            const y = h / 2 - val * gain;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
        ctx.shadowBlur = 0;
    };

    // Draw final full processed ECG-style waveform on scan completion
    const drawResultWaveform = (result: PPGScanResult) => {
        const canvas = waveCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const wave = result.fullWaveform;
        if (!wave || wave.length < 2) return;

        drawMedicalGrid();

        ctx.strokeStyle = "#00E676";
        ctx.lineWidth = 2.4;
        ctx.shadowColor = "#00E676";
        ctx.shadowBlur = 8;
        ctx.beginPath();

        const gain = 2.8;
        const step = w / (wave.length - 1);
        wave.forEach((val, i) => {
            const x = i * step;
            const y = h / 2 - val * gain;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
        ctx.shadowBlur = 0;

        // Render detected beat markers at peak indices
        if (result.peakIndices && result.peakIndices.length > 0) {
            result.peakIndices.forEach((peakIdx) => {
                const px = peakIdx * step;
                const py = h / 2 - wave[peakIdx] * gain;

                ctx.fillStyle = "rgba(232, 33, 58, 0.4)";
                ctx.beginPath();
                ctx.arc(px, py, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#FF3355";
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }
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
                drawResultWaveform(result);
            }
        );

        if (!ok) {
            setIsScanning(false);
            toast.error("No se pudo acceder a la cámara o activar el destello LED.");
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
        toast.info(`Evaluación START completada: ${res.category} (${res.label})`);
    };

    const handleShareVitalsToChat = () => {
        const store = useRedStore.getState();
        const activeChat = store.activeConversationId;
        if (!activeChat) {
            toast.warning("No hay un chat activo. Abre una conversación primero.");
            return;
        }
        const vitalsPayload = JSON.stringify({
            type: 'VITAL_SCAN_REPORT',
            bpm: scanResult?.bpm || 75,
            spo2: scanResult?.spo2 || 98,
            triage: triageResult?.category || 'EVALUACIÓN MÉDICA',
            notes: triageResult ? `${triageResult.category}: ${triageResult.label}. ${triageResult.actionRequired}` : 'Signos vitales ópticos PPG registrados en terreno',
            timestamp: Date.now()
        });
        store.sendMessage(vitalsPayload, { msg_type: 'vital_sign' });
        toast.success("🫀 Ficha médica transmitida al chat con cifrado E2E");
        navigate("chat", activeChat);
    };

    const handleSaveTriageRecord = async () => {
        if (!triageResult) return;
        setIsSaving(true);
        const label = victimLabelInput.trim() || `Víctima #${triageRecords.length + 1}`;

        try {
            const record = await RedAPI.saveTriageReport({
                victim_label: label,
                category: triageResult.category,
                bpm: (scanResult && scanResult.bpm > 0) ? scanResult.bpm : undefined,
                spo2: (scanResult && scanResult.spo2 > 0) ? scanResult.spo2 : undefined,
                can_walk: canWalk,
                is_breathing: isBreathing,
                resp_rate: respRate,
                cap_refill_sec: capRefillSec,
                can_follow_commands: canFollowCommands,
                notes: triageResult.label,
                latitude: coords.lat,
                longitude: coords.lon
            });

            setVictimLabelInput("");
            await loadTriageReports();
            toast.success(`🚨 Víctima '${record.victim_label}' [${record.category}] guardada en Sled y transmitida a la malla mesh.`);
        } catch {
            toast.error("Error al persistir reporte de triaje en Rust");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRecord = async (id: string) => {
        try {
            await RedAPI.deleteTriageReport(id);
            await loadTriageReports();
            toast.info("Registro médico eliminado de Sled DB");
        } catch {
            toast.error("Error al eliminar el reporte");
        }
    };

    const filteredRecords = triageRecords.filter(r => {
        if (filterCategory === "ALL") return true;
        const cat = String(r.category || r.triage_category || "").toUpperCase();
        return cat.includes(filterCategory);
    });

    const liters = Math.max(0.1, parseFloat(waterLiters) || 1);
    const alt = Math.max(0, parseFloat(altitudeMeters) || 0);
    const chlorineMultiplier = isTurbidWater ? 4 : 2;
    const chlorineDrops = Math.ceil(liters * chlorineMultiplier);
    const dropsText = chlorineDrops === 1 ? "1 gota" : `${chlorineDrops} gotas`;
    const boilingTempC = (100 - (alt / 300)).toFixed(1);
    const requiredBoilingMins = alt > 2000 ? 3 : 1;

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(232,33,58,0.4)"
                    }}>🫀</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Estación Médica & Triaje START
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            RUST SLED DB · GOSSIPSUB BROADCAST · GPS ENCRYPTED
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title="Cerrar módulo"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("ppg")}
                    className={activeTab === "ppg" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🫀 Monitor PPG
                </button>
                <button
                    onClick={() => setActiveTab("triage")}
                    className={activeTab === "triage" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🚑 Triaje START
                </button>
                <button
                    onClick={() => setActiveTab("records")}
                    className={activeTab === "records" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📊 Víctimas ({triageRecords.length})
                </button>
                <button
                    onClick={() => setActiveTab("water")}
                    className={activeTab === "water" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    💧 Agua & Altitud
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: MONITOR PPG ÓPTICO ────────────────────────────── */}
                    {activeTab === "ppg" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                        📈 Osciloscopio Fotopletismográfico (PPG)
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Extracción óptica de pulso hemodinámico mediante sensor de cámara y flash
                                    </div>
                                </div>
                                {isScanning && (
                                    <span className="badge-tactical badge-tactical-amber" style={{ animation: "pulse 1s infinite" }}>
                                        ● ESCANEANDO ({scanProgress}%)
                                    </span>
                                )}
                            </div>

                            {/* Osciloscopio Canvas HiDPI */}
                            <div style={{
                                position: "relative", width: "100%", height: "140px",
                                borderRadius: "var(--radius-md)", overflow: "hidden",
                                border: "1px solid rgba(0, 230, 118, 0.25)",
                                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)"
                            }}>
                                <canvas ref={waveCanvasRef} width={640} height={140} style={{ width: "100%", height: "100%", display: "block" }} />

                                {!isScanning && !scanResult && (
                                    <div style={{
                                        position: "absolute", inset: 0,
                                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                        background: "rgba(4, 6, 14, 0.75)", color: "var(--text-secondary)",
                                        fontSize: "0.82rem", textAlign: "center", padding: "16px", gap: "6px"
                                    }}>
                                        <span style={{ fontSize: "1.4rem" }}>👆</span>
                                        <span>Coloca suavemente la yema de tu dedo índice cubriendo completamente la lente de la cámara y el flash LED.</span>
                                    </div>
                                )}

                                {isScanning && !isFingerDetected && (
                                    <div style={{
                                        position: "absolute", inset: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        background: "rgba(232, 33, 58, 0.85)", color: "#fff",
                                        fontSize: "0.85rem", fontWeight: 800, textAlign: "center", padding: "12px",
                                        backdropFilter: "blur(6px)"
                                    }}>
                                        ⚠️ Contacto óptico débil: Cubre la cámara y el flash con la yema del dedo
                                    </div>
                                )}
                            </div>

                            {/* Barra de Progreso */}
                            {isScanning && (
                                <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${scanProgress}%`, height: "100%",
                                        background: "linear-gradient(90deg, #FF3355, #00E676)",
                                        transition: "width 0.1s linear"
                                    }} />
                                </div>
                            )}

                            {/* Métricas Resultantes */}
                            {scanResult && (
                                <div className="hud-grid animate-pop">
                                    <div className="hud-metric">
                                        <div className="hud-metric-label">Frecuencia Cardíaca</div>
                                        <div className="hud-metric-val" style={{ color: "var(--accent-crimson-bright)" }}>
                                            {scanResult.bpm > 0 ? `${scanResult.bpm} BPM` : "N/D"}
                                        </div>
                                    </div>
                                    <div className="hud-metric">
                                        <div className="hud-metric-label">Saturación Oxígeno</div>
                                        <div className="hud-metric-val" style={{ color: "var(--accent-emerald)" }}>
                                            {scanResult.spo2 > 0 ? `${scanResult.spo2}% SpO2` : "N/D"}
                                        </div>
                                    </div>
                                    <div className="hud-metric">
                                        <div className="hud-metric-label">Confianza de Señal</div>
                                        <div className="hud-metric-val" style={{ color: "var(--accent-amber)" }}>
                                            {scanResult.confidencePercent}%
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Botón de Inicio de Escaneo */}
                            <button
                                onClick={handleStartPPG}
                                disabled={isScanning}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
                            >
                                {isScanning ? `⏳ Analizando señal arterial... ${scanProgress}%` : "🫀 INICIAR ESCANEO ÓPTICO (CAM + FLASH)"}
                            </button>
                        </div>
                    )}

                    {/* ─── TAB 2: TRIAJE DE DESASTRE START ──────────────────────── */}
                    {activeTab === "triage" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                                        🚑 Protocolo START (Simple Triage & Rapid Treatment)
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Algoritmo internacional de clasificación médica de emergencias masivas
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-amber">ESTÁNDAR ISO</span>
                            </div>

                            {/* Flujo de Decisiones Clínicas */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {/* Paso 1: Deambulación */}
                                <div
                                    onClick={() => setCanWalk(!canWalk)}
                                    className="card-tactical-interactive"
                                    style={{
                                        padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                        borderColor: canWalk ? "var(--accent-emerald)" : "var(--glass-border)"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>1. ¿La víctima puede caminar? (Ambulante)</div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Pacientes que caminan reciben prioridad VERDE automáticamente</div>
                                    </div>
                                    <span style={{ fontSize: "1.3rem" }}>{canWalk ? "🟢 SÍ" : "⚪ NO"}</span>
                                </div>

                                {!canWalk && (
                                    <>
                                        {/* Paso 2: Respiración Espontánea */}
                                        <div
                                            onClick={() => setIsBreathing(!isBreathing)}
                                            className="card-tactical-interactive"
                                            style={{
                                                padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                                borderColor: isBreathing ? "var(--accent-emerald)" : "var(--accent-crimson)"
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>2. ¿Respira espontáneamente?</div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Evaluación de presencia de flujo aéreo nasal/oral</div>
                                            </div>
                                            <span style={{ fontSize: "1.3rem" }}>{isBreathing ? "🟢 SÍ" : "🔴 NO"}</span>
                                        </div>

                                        {!isBreathing && (
                                            <div
                                                onClick={() => setBreathesAfterAirway(!breathesAfterAirway)}
                                                className="card-tactical-interactive"
                                                style={{
                                                    padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                                    background: "rgba(232,33,58,0.12)", borderColor: "rgba(232,33,58,0.4)"
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--accent-crimson-bright)" }}>
                                                        ¿Respira tras abrir vía aérea? (Frente-Mentón)
                                                    </div>
                                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Si NO respira tras maniobra posicional: ⚫ NEGRO (Fallecido)</div>
                                                </div>
                                                <span style={{ fontSize: "1.3rem" }}>{breathesAfterAirway ? "🟢 SÍ" : "⚫ NO"}</span>
                                            </div>
                                        )}

                                        {isBreathing && (
                                            <>
                                                {/* Paso 3: Frecuencia Respiratoria */}
                                                <div className="hud-metric" style={{ padding: "14px" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                        <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>3. Frecuencia Respiratoria:</span>
                                                        <strong style={{
                                                            fontFamily: "JetBrains Mono, monospace",
                                                            color: (respRate < 10 || respRate > 30) ? "var(--accent-crimson-bright)" : "var(--accent-emerald)"
                                                        }}>
                                                            {respRate} resp/min {(respRate < 10 || respRate > 30) ? "(CRÍTICO >30 o <10)" : "(Normal)"}
                                                        </strong>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="45" value={respRate}
                                                        onChange={e => setRespRate(Number(e.target.value))}
                                                        style={{ width: "100%", accentColor: "var(--accent-amber)" }}
                                                    />
                                                </div>

                                                {/* Paso 4: Relleno Capilar */}
                                                <div className="hud-metric" style={{ padding: "14px" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                                        <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>4. Relleno Capilar / Pulso Radial:</span>
                                                        <strong style={{
                                                            fontFamily: "JetBrains Mono, monospace",
                                                            color: capRefillSec > 2 ? "var(--accent-crimson-bright)" : "var(--accent-emerald)"
                                                        }}>
                                                            {capRefillSec}s {capRefillSec > 2 ? "(>2s Perfusión Pobre)" : "(Normal <2s)"}
                                                        </strong>
                                                    </div>
                                                    <input
                                                        type="range" min="0.5" max="4.0" step="0.5" value={capRefillSec}
                                                        onChange={e => setCapRefillSec(Number(e.target.value))}
                                                        style={{ width: "100%", accentColor: "var(--accent-amber)" }}
                                                    />
                                                </div>

                                                {/* Paso 5: Estado Mental */}
                                                <div
                                                    onClick={() => setCanFollowCommands(!canFollowCommands)}
                                                    className="card-tactical-interactive"
                                                    style={{
                                                        padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                                        borderColor: canFollowCommands ? "var(--accent-emerald)" : "var(--accent-crimson)"
                                                    }}
                                                >
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>5. Estado Mental: ¿Obedece órdenes sencillas?</div>
                                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>"Abra los ojos", "apriete mi mano"</div>
                                                    </div>
                                                    <span style={{ fontSize: "1.3rem" }}>{canFollowCommands ? "🟢 SÍ" : "🔴 NO"}</span>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                <button
                                    onClick={handleEvaluateTriage}
                                    className="btn-tactical-primary"
                                    style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)", color: "#000", marginTop: "6px" }}
                                >
                                    📋 EVALUAR CLASIFICACIÓN DE TRIAJE
                                </button>

                                {/* Resultado START */}
                                {triageResult && (
                                    <div className="animate-pop" style={{
                                        padding: "16px", borderRadius: "var(--radius-md)",
                                        border: `2px solid ${triageResult.category === 'VERDE' ? '#00E676' : triageResult.category === 'AMARILLO' ? '#FFB300' : triageResult.category === 'ROJO' ? '#E8213A' : '#777'}`,
                                        background: "rgba(0,0,0,0.65)", display: "flex", flexDirection: "column", gap: "10px"
                                    }}>
                                        <div style={{
                                            fontSize: "1.05rem", fontWeight: 900,
                                            color: triageResult.category === 'VERDE' ? '#00E676' : triageResult.category === 'AMARILLO' ? '#FFB300' : triageResult.category === 'ROJO' ? '#FF3355' : '#AAA',
                                            display: "flex", alignItems: "center", gap: "8px"
                                        }}>
                                            <span>{triageResult.category === 'ROJO' ? '🔴' : triageResult.category === 'AMARILLO' ? '🟡' : triageResult.category === 'VERDE' ? '🟢' : '⚫'}</span>
                                            <span>CATEGORÍA: {triageResult.category} — {triageResult.label}</span>
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                                            {triageResult.actionRequired}
                                        </div>

                                        <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                                            <input
                                                value={victimLabelInput}
                                                onChange={e => setVictimLabelInput(e.target.value)}
                                                placeholder="Etiqueta / Nombre de la víctima"
                                                style={{ flex: 1, minWidth: "180px", padding: "10px 14px", fontSize: "0.85rem" }}
                                            />
                                            <button
                                                onClick={handleSaveTriageRecord}
                                                disabled={isSaving}
                                                className="btn-tactical-primary"
                                                style={{ padding: "10px 16px", fontSize: "0.85rem", background: "linear-gradient(135deg, #00E676 0%, #00B359 100%)", color: "#000" }}
                                            >
                                                {isSaving ? "Guardando..." : "💾 Guardar"}
                                            </button>
                                            <button
                                                onClick={handleShareVitalsToChat}
                                                className="btn-tactical-secondary"
                                                style={{ padding: "10px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}
                                                title="Transmitir ficha médica al chat activo"
                                            >
                                                <span>📤</span>
                                                <span>Enviar a Chat</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 3: REGISTRO DE VÍCTIMAS EN SLED DB ────────────────── */}
                    {activeTab === "records" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                        📊 Base de Datos de Triaje Masivo (MCI)
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Persistencia local en disco Sled DB y sincronización Gossipsub Mesh
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald">SLED PERSISTED</span>
                            </div>

                            {/* Filtros de Categoría */}
                            <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
                                {["ALL", "ROJO", "AMARILLO", "VERDE", "NEGRO"].map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setFilterCategory(cat)}
                                        style={{
                                            padding: "4px 10px", borderRadius: "6px", fontSize: "0.74rem", fontWeight: 800,
                                            border: filterCategory === cat ? "1px solid var(--accent-emerald)" : "1px solid var(--glass-border)",
                                            background: filterCategory === cat ? "rgba(0,230,118,0.15)" : "transparent",
                                            color: filterCategory === cat ? "var(--accent-emerald)" : "var(--text-secondary)",
                                            cursor: "pointer"
                                        }}
                                    >
                                        {cat === "ALL" ? `Todos (${triageRecords.length})` : cat}
                                    </button>
                                ))}
                            </div>

                            {/* Lista de Registros */}
                            {filteredRecords.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">📋</div>
                                    <div className="empty-state-title">Sin registros de triaje</div>
                                    <div className="empty-state-desc">
                                        No hay víctimas registradas en la categoría seleccionada en la base de datos Sled.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {filteredRecords.map((rec, i) => {
                                        const cat = String(rec.category || rec.triage_category || "").toUpperCase();
                                        const catColor = cat.includes("VERDE") ? "#00E676" : cat.includes("AMARILLO") ? "#FFB300" : cat.includes("ROJO") ? "#FF3355" : "#888";
                                        const rid = rec.id || rec.report_id || `rec_${i}`;
                                        return (
                                            <div
                                                key={rid}
                                                className="card-tactical"
                                                style={{
                                                    padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                    borderLeft: `4px solid ${catColor}`
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                        <strong style={{ color: catColor, fontSize: "0.88rem" }}>[{cat}] {rec.victim_label || rec.victim_name}</strong>
                                                        {rec.bpm && <span className="badge-tactical badge-tactical-crimson">{rec.bpm} BPM</span>}
                                                        {rec.spo2 && <span className="badge-tactical badge-tactical-emerald">{rec.spo2}% SpO2</span>}
                                                    </div>
                                                    <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                                        {rec.notes}
                                                        {rec.latitude && rec.longitude && (
                                                            <span style={{ marginLeft: "8px", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                                                📍 GPS: {rec.latitude.toFixed(4)}, {rec.longitude.toFixed(4)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteRecord(rid)}
                                                    className="btn-icon"
                                                    title="Eliminar de Sled"
                                                    style={{ width: 34, height: 34, color: "var(--accent-crimson-bright)" }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TAB 4: CALCULADORA DE SUPERVIVENCIA H2O ──────────────── */}
                    {activeTab === "water" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                        💧 Potabilización de Agua & Altitud Barométrica
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Cálculo estequiométrico de hipoclorito y tiempo de ebullición según altitud GPS
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-cyan">BIO-SEGURIDAD</span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ display: "block", color: "var(--text-muted)", marginBottom: "4px", fontSize: "0.76rem", fontWeight: 700 }}>
                                        Volumen de Agua (Litros):
                                    </label>
                                    <input
                                        type="number"
                                        value={waterLiters}
                                        onChange={e => setWaterLiters(e.target.value)}
                                        placeholder="Litros"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", color: "var(--text-muted)", marginBottom: "4px", fontSize: "0.76rem", fontWeight: 700 }}>
                                        Altitud del Terreno (Metros msnm):
                                    </label>
                                    <input
                                        type="number"
                                        value={altitudeMeters}
                                        onChange={e => setAltitudeMeters(e.target.value)}
                                        placeholder="Metros"
                                    />
                                </div>
                            </div>

                            <div
                                onClick={() => setIsTurbidWater(!isTurbidWater)}
                                className="card-tactical-interactive"
                                style={{
                                    padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                    borderColor: isTurbidWater ? "var(--accent-amber)" : "var(--glass-border)"
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>¿Agua turbia, sucia o con sedimentos?</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Duplica la dosis requerida de hipoclorito de sodio (cloro)</div>
                                </div>
                                <span style={{ fontSize: "1.2rem" }}>{isTurbidWater ? "⚠️ SÍ" : "⚪ NO"}</span>
                            </div>

                            {/* Resultados de Potabilización */}
                            <div className="card-tactical" style={{ padding: "14px", borderLeft: "4px solid var(--accent-emerald)", background: "rgba(0, 230, 118, 0.08)" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-emerald)", marginBottom: "4px" }}>
                                    🧪 Desinfección Química por Cloración
                                </div>
                                <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                                    Agregar <strong>{dropsText}</strong> de hipoclorito de sodio sin aroma por cada {liters}L ({isTurbidWater ? 'dosis turbia reforzada' : 'dosis estándar'}). Tapar y reposar durante al menos <strong>30 minutos</strong> antes del consumo humano.
                                </div>
                            </div>

                            <div className="card-tactical" style={{ padding: "14px", borderLeft: "4px solid var(--accent-amber)", background: "rgba(255, 179, 0, 0.08)" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-amber)", marginBottom: "4px" }}>
                                    🔥 Esterilización Térmica por Ebullición
                                </div>
                                <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                                    A <strong>{alt} metros</strong> de altitud, la presión atmosférica reduce el punto de ebullición a <strong>{boilingTempC}°C</strong>. Mantener hervido a borbotones continuos durante al menos <strong>{requiredBoilingMins} minuto(s)</strong> para destruir patógenos biológicos.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
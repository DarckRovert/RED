"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { 
    RfSpectrumAnalyzerEngine, 
    RfSpectrumMetrics, 
    RfBandMode, 
    ChannelSignalData 
} from "../lib/RfSpectrumAnalyzerEngine";
import { bluetoothTransport, RedDevice } from "../lib/mesh/bluetoothTransport";
import { getRfMetrics, triggerChannelHop, setRfFecMode, RfMetricsResponse } from "../lib/api";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

type RfTab = "spectrum" | "jamming" | "devices";

export function RfSpectrumModal() {
    const { navigate } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<RfTab>("spectrum");

    const [bandMode, setBandMode] = useState<RfBandMode>("BLE_2_4GHZ");
    const [metrics, setMetrics] = useState<RfSpectrumMetrics>(() => RfSpectrumAnalyzerEngine.getInitialMetrics("BLE_2_4GHZ"));
    const [isScanning, setIsScanning] = useState(true);
    const [scannedBleDevices, setScannedBleDevices] = useState<Map<string, RedDevice>>(new Map());
    const [acousticChannels, setAcousticChannels] = useState<ChannelSignalData[]>([]);
    
    // Rust Native RF State
    const [rfState, setRfState] = useState<RfMetricsResponse | null>(null);
    const [isHopping, setIsHopping] = useState(false);
    const [isUpdatingFec, setIsUpdatingFec] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);

    // ── 0. Carga de Telemetría Real de Radiofrecuencia desde Rust ───────────────────
    const loadRfMetrics = useCallback(async () => {
        try {
            const data = await getRfMetrics();
            if (data) setRfState(data);
        } catch {
            // silent fallback
        }
    }, []);

    useEffect(() => {
        loadRfMetrics();
        const interval = setInterval(loadRfMetrics, 3000);
        return () => clearInterval(interval);
    }, [loadRfMetrics]);

    // ── 1. Captura Real BLE & Telemetría Red P2P ──────────────────────────────────
    useEffect(() => {
        if (!isScanning) return;

        if (bandMode === "BLE_2_4GHZ") {
            let active = true;

            bluetoothTransport.scan((device) => {
                if (!active) return;
                setScannedBleDevices(prev => {
                    const updated = new Map(prev);
                    updated.set(device.id, device);
                    return updated;
                });
            }, 60000).catch(() => {});

            return () => { active = false; };
        }
    }, [bandMode, isScanning]);

    // ── 2. Captura Real de Micrófono Web Audio API FFT ─────────────────────────────
    const cleanupAudio = () => {
        if (audioCtxRef.current) {
            try { audioCtxRef.current.close(); } catch {}
            audioCtxRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
    };

    useEffect(() => {
        if (bandMode !== "ACOUSTIC_FFT" || !isScanning) {
            cleanupAudio();
            return;
        }

        let animationFrameId: number;

        const initAudioMic = async () => {
            try {
                if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                micStreamRef.current = stream;

                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                const audioCtx = new AudioCtxClass();
                audioCtxRef.current = audioCtx;

                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.75;
                source.connect(analyser);
                analyserRef.current = analyser;

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const updateAcousticFft = () => {
                    if (!analyserRef.current || bandMode !== "ACOUSTIC_FFT") return;
                    analyserRef.current.getByteFrequencyData(dataArray);

                    const baseFreq = 16000;
                    const stepFreq = 400;
                    const channels: ChannelSignalData[] = [];

                    for (let ch = 0; ch < 12; ch++) {
                        const targetFreq = baseFreq + ch * stepFreq;
                        const binIndex = Math.min(
                            bufferLength - 1,
                            Math.floor((targetFreq / (audioCtx.sampleRate / 2)) * bufferLength)
                        );
                        const rawAmp = dataArray[binIndex] || 0;
                        const rssiCalculated = Math.round(-110 + (rawAmp / 255) * 80);

                        channels.push({
                            channelNumber: ch + 1,
                            frequencyMhz: Number((targetFreq / 1000).toFixed(1)),
                            rssiCurrentDbm: rssiCalculated,
                            rssiMaxHoldDbm: rssiCalculated,
                            signalQualityPct: Math.round((rawAmp / 255) * 100),
                            isOccupied: rawAmp > 60,
                            noiseFloorDbm: -105,
                            snrDb: Math.max(0, rssiCalculated - (-105)),
                            detectedDevicesCount: rawAmp > 70 ? 1 : 0
                        });
                    }

                    setAcousticChannels(channels);
                    animationFrameId = requestAnimationFrame(updateAcousticFft);
                };

                updateAcousticFft();
            } catch {
                toast.error("Permiso de micrófono denegado para análisis FFT.");
            }
        };

        initAudioMic();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            cleanupAudio();
        };
    }, [bandMode, isScanning]);

    // ── 3. Motor de Análisis de Espectro ──────────────────────────────────────────
    useEffect(() => {
        let timer: any;
        if (isScanning) {
            timer = setInterval(() => {
                if (bandMode === "ACOUSTIC_FFT") {
                    const acousticMetrics = RfSpectrumAnalyzerEngine.processAcousticChannels(acousticChannels);
                    setMetrics(acousticMetrics);
                } else {
                    const freshMetrics = RfSpectrumAnalyzerEngine.analyzeSpectrum(
                        bandMode,
                        Array.from(scannedBleDevices.values())
                    );
                    setMetrics(freshMetrics);
                }
            }, 600);
        }
        return () => clearInterval(timer);
    }, [bandMode, isScanning, scannedBleDevices, acousticChannels]);

    // ── 4. Renderizado Canvas Waterfall Espectrograma HiDPI ────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;

        // Limpiar fondo
        ctx.fillStyle = "#04060A";
        ctx.fillRect(0, 0, w, h);

        // Cuadrícula y escala en dBm (-110 a -30)
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        for (let db = -110; db <= -30; db += 20) {
            const y = h - ((db - (-110)) / 80) * (h - 30) - 20;
            ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 10, y); ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.font = "10px 'JetBrains Mono', monospace";
            ctx.fillText(`${db}dB`, 5, y + 3);
        }

        // Barras de espectro por canal
        const channels = metrics.channels;
        if (channels.length > 0) {
            const chWidth = (w - 60) / channels.length;

            channels.forEach((ch, idx) => {
                const x = 50 + idx * chWidth;
                const chRssi = ch.rssiCurrentDbm ?? ch.rssiDb ?? -90;
                const normalizedVal = Math.min(1, Math.max(0, (chRssi - (-110)) / 80));
                const barHeight = normalizedVal * (h - 40);
                const y = h - barHeight - 20;

                // Gradiente según intensidad
                const grad = ctx.createLinearGradient(0, y, 0, h - 20);
                if (chRssi > -60) {
                    grad.addColorStop(0, "#FF3355");
                    grad.addColorStop(1, "rgba(232,33,58,0.2)");
                } else if (chRssi > -80) {
                    grad.addColorStop(0, "#00E5FF");
                    grad.addColorStop(1, "rgba(0,229,255,0.2)");
                } else {
                    grad.addColorStop(0, "#00E676");
                    grad.addColorStop(1, "rgba(0,230,118,0.2)");
                }

                ctx.fillStyle = grad;
                ctx.fillRect(x + 2, y, chWidth - 4, barHeight);

                // Etiqueta de canal
                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.font = "9px 'JetBrains Mono', monospace";
                ctx.fillText(`C${ch.channelNumber}`, x + 2, h - 6);
            });
        }
    }, [metrics]);

    const handleTriggerHop = async () => {
        setIsHopping(true);
        try {
            const res = await triggerChannelHop();
            if (res && res.ok) {
                toast.success(`⚡ Salto ejecutado: Nuevo Canal ${res.current_channel_mhz} MHz.`);
                await loadRfMetrics();
            } else {
                toast.error("Error al forzar salto de frecuencia.");
            }
        } catch {
            toast.error("Error de comunicación con Rust.");
        } finally {
            setIsHopping(false);
        }
    };

    const handleToggleFec = async () => {
        const nextMode = rfState?.fec_mode === "FEC_REED_SOLOMON_2X" ? "FEC_CONVOLUTIONAL_1_2" : "FEC_REED_SOLOMON_2X";
        setIsUpdatingFec(true);
        try {
            const res = await setRfFecMode(nextMode);
            if (res && res.ok) {
                toast.success(`🛡️ FEC actualizado: ${nextMode}`);
                await loadRfMetrics();
            }
        } catch {
            toast.error("Fallo al cambiar modo FEC.");
        } finally {
            setIsUpdatingFec(false);
        }
    };

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
                        background: metrics.isJammingSuspected ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" : "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: metrics.isJammingSuspected ? "0 0 20px rgba(232,33,58,0.6)" : "0 4px 16px rgba(0,229,255,0.35)"
                    }}>📊</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.rf_module?.title || "Analizador de Espectro RF & Anti-Jamming"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: metrics.isJammingSuspected ? "var(--accent-crimson-bright)" : "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {metrics.isJammingSuspected ? "⚠️ ALERTA DE INHIBICIÓN DETECTADA" : (t.rf_module?.subtitle || "ESPECTRO NOMINAL · ESCANEANDO")}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar analizador"}
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
                    onClick={() => setActiveTab("spectrum")}
                    className={activeTab === "spectrum" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📊 {t.rf_module?.waterfall || "Espectro Waterfall"}
                </button>
                <button
                    onClick={() => setActiveTab("jamming")}
                    className={activeTab === "jamming" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    🛡️ Guerra Electrónica & Salto
                </button>
                <button
                    onClick={() => setActiveTab("devices")}
                    className={activeTab === "devices" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📡 {t.rf_module?.signals_detected || "Dispositivos RF"} ({scannedBleDevices.size})
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: ESPECTRO WATERFALL ──────────────────────────── */}
                    {activeTab === "spectrum" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            {/* Selector de Banda */}
                            <div style={{ display: "flex", gap: "6px" }}>
                                {[
                                    { id: "BLE_2_4GHZ", label: "BLE 2.4 GHz" },
                                    { id: "LORA_915MHZ", label: "LoRa 915 MHz" },
                                    { id: "ACOUSTIC_FFT", label: "Ultrasonido FFT" }
                                ].map((b) => (
                                    <button
                                        key={b.id}
                                        onClick={() => setBandMode(b.id as RfBandMode)}
                                        className="btn-tactical-secondary"
                                        style={{
                                            flex: 1, padding: "8px", fontSize: "0.78rem",
                                            borderColor: bandMode === b.id ? "var(--accent-cyan)" : "var(--glass-border)",
                                            background: bandMode === b.id ? "rgba(0,229,255,0.15)" : "var(--bg-lifted)",
                                            color: bandMode === b.id ? "var(--accent-cyan)" : "var(--text-primary)",
                                            fontWeight: 700
                                        }}
                                    >
                                        {b.label}
                                    </button>
                                ))}
                            </div>

                            {/* Canvas del Espectrograma */}
                            <div style={{ width: "100%", height: "200px", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--glass-border)", background: "#04060A" }}>
                                <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
                            </div>

                            {/* Telemetría Instantánea del Espectro */}
                            <div className="hud-grid">
                                <div className="hud-metric">
                                    <div className="hud-metric-label">SNR Promedio</div>
                                    <div className="hud-metric-val" style={{ fontSize: "0.95rem", color: "var(--accent-emerald)" }}>
                                        {metrics.avgSnrDb.toFixed(1)} dB
                                    </div>
                                </div>
                                <div className="hud-metric">
                                    <div className="hud-metric-label">Congestión del Espectro</div>
                                    <div className="hud-metric-val" style={{ fontSize: "0.95rem", color: metrics.congestionPct > 60 ? "var(--accent-crimson-bright)" : "var(--accent-amber)" }}>
                                        {metrics.congestionPct}%
                                    </div>
                                </div>
                                <div className="hud-metric">
                                    <div className="hud-metric-label">Canal Óptimo</div>
                                    <div className="hud-metric-val" style={{ fontSize: "0.95rem", color: "var(--accent-cyan)" }}>
                                        CH {metrics.optimalChannelNumber}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 2: GUERRA ELECTRÓNICA & ANTI-JAMMING ───────────── */}
                    {activeTab === "jamming" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    🛡️ Contramedidas Electrónicas & Salto de Frecuencia
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Maniobras dinámicas para evadir guerra electrónica, jamming o interferencia severa
                                </div>
                            </div>

                            {/* Estado del Canal Actual en Rust */}
                            <div className="card-tactical" style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Frecuencia de Malla Asignada
                                    </div>
                                    <div style={{ fontSize: "1.4rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-emerald)" }}>
                                        {rfState?.current_channel_mhz || 2402} MHz
                                    </div>
                                </div>

                                <div style={{ textAlign: "right" }}>
                                    <span className="badge-tactical badge-tactical-emerald">FHSS ACTIVO</span>
                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                        Saltos: {rfState?.total_hops_count || 0}
                                    </div>
                                </div>
                            </div>

                            {/* Disparo de Salto de Canal Pseudoaleatorio */}
                            <button
                                onClick={handleTriggerHop}
                                disabled={isHopping}
                                className="btn-tactical-primary"
                                style={{
                                    width: "100%", padding: "14px", fontSize: "0.95rem",
                                    background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)", color: "#000"
                                }}
                            >
                                {isHopping ? "Sincronizando salto..." : "⚡ FORZAR SALTO DE FRECUENCIA ANTI-JAMMING"}
                            </button>

                            {/* Modo FEC Convolucional / Reed-Solomon */}
                            <div
                                onClick={handleToggleFec}
                                className="card-tactical-interactive"
                                style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                            >
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>Corrección de Errores (FEC)</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        {rfState?.fec_mode || "FEC_CONVOLUTIONAL_1_2"}
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-cyan">
                                    {isUpdatingFec ? "..." : "CAMBIAR"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ─── TAB 3: DISPOSITIVOS DETECTADOS ──────────────────────── */}
                    {activeTab === "devices" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                        📡 Nodos y Balizas BLE en Cobertura
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Dispositivos físicos capturados por el adaptador Bluetooth
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald">RADIO HARDWARE</span>
                            </div>

                            {scannedBleDevices.size === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">📡</div>
                                    <div className="empty-state-title">Escaneando Espectro BLE...</div>
                                    <div className="empty-state-desc">
                                        Buscando paquetes de descubrimiento en la frecuencia de 2.4 GHz.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {Array.from(scannedBleDevices.values()).map((dev) => (
                                        <div
                                            key={dev.id}
                                            className="card-tactical"
                                            style={{
                                                padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                borderLeft: "4px solid var(--accent-cyan)"
                                            }}
                                        >
                                            <div>
                                                <strong style={{ fontSize: "0.90rem", color: "var(--text-primary)" }}>
                                                    {dev.name || "Nodo Anónimo"}
                                                </strong>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    MAC: {dev.id}
                                                </div>
                                            </div>

                                            <div style={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace" }}>
                                                <span className="badge-tactical badge-tactical-cyan">
                                                    {dev.rssi !== undefined ? `${dev.rssi} dBm` : "ACTIVO"}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
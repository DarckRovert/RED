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
    const { navigate, goBack } = useRedStore();
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

    // Carga de Telemetría Real de Radiofrecuencia desde Rust
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

    // Captura Real BLE & Telemetría Red P2P
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

    // Captura Real de Micrófono Web Audio API FFT
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
                            rssiDb: rssiCalculated,
                            rssiCurrentDbm: rssiCalculated,
                            rssiMaxHoldDbm: rssiCalculated,
                            signalQualityPct: Math.round((rawAmp / 255) * 100),
                            isOccupied: rawAmp > 60,
                            noiseFloorDb: -105,
                            noiseFloorDbm: -105,
                            occupiedByProtocol: rawAmp > 60 ? "SoundMesh Ultra" : undefined
                        });
                    }

                    setAcousticChannels(channels);
                    animationFrameId = requestAnimationFrame(updateAcousticFft);
                };

                updateAcousticFft();
            } catch {
                // Mic permission fallback
            }
        };

        initAudioMic();

        return () => {
            cancelAnimationFrame(animationFrameId);
            cleanupAudio();
        };
    }, [bandMode, isScanning]);

    // Motor de Análisis de Espectro Continuo
    useEffect(() => {
        if (!isScanning) return;

        const interval = setInterval(() => {
            const currentBleList = Array.from(scannedBleDevices.values());
            const currentAcousticList = acousticChannels;

            const nextMetrics = bandMode === "ACOUSTIC_FFT"
                ? RfSpectrumAnalyzerEngine.processAcousticChannels(currentAcousticList)
                : RfSpectrumAnalyzerEngine.analyzeSpectrum(bandMode, currentBleList);
            setMetrics(nextMetrics);
        }, 1200);

        return () => clearInterval(interval);
    }, [bandMode, isScanning, scannedBleDevices, acousticChannels]);

    // Waterfall Canvas Renderer
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const chCount = metrics.channels.length;
        if (chCount === 0) return;

        const barWidth = (width - (chCount - 1) * 4) / chCount;

        ctx.clearRect(0, 0, width, height);

        // Background Grid Lines
        ctx.strokeStyle = "rgba(0, 229, 255, 0.1)";
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Render Channel Bars
        metrics.channels.forEach((ch, idx) => {
            const x = idx * (barWidth + 4);
            const rawRssi = ch.rssiCurrentDbm ?? ch.rssiDb ?? -100;
            const normRssi = Math.max(0, Math.min(100, (rawRssi + 120) * 1.25));
            const barHeight = (normRssi / 100) * (height - 20);
            const y = height - barHeight;

            const grad = ctx.createLinearGradient(0, height, 0, y);
            if (ch.isOccupied) {
                grad.addColorStop(0, "rgba(255, 51, 85, 0.2)");
                grad.addColorStop(1, "rgba(255, 51, 85, 0.9)");
            } else {
                grad.addColorStop(0, "rgba(0, 229, 255, 0.15)");
                grad.addColorStop(1, "rgba(0, 229, 255, 0.85)");
            }

            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barWidth, barHeight);

            // Channel Label
            ctx.fillStyle = ch.isOccupied ? "#FF3355" : "rgba(255, 255, 255, 0.6)";
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.fillText(`CH${ch.channelNumber}`, x + barWidth / 2, height - 4);
        });
    }, [metrics]);

    const handleTriggerHop = async () => {
        setIsHopping(true);
        try {
            const res = await triggerChannelHop();
            if (res && res.ok) {
                toast.success(`⚡ Salto forzado a canal: ${res.new_channel}`);
                await loadRfMetrics();
            }
        } catch {
            toast.error("Error al forzar salto FHSS");
        } finally {
            setIsHopping(false);
        }
    };

    const handleSetFec = async (fec: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME') => {
        setIsUpdatingFec(true);
        try {
            const res = await setRfFecMode(fec);
            if (res && res.ok) {
                toast.success(`🛡️ FEC actualizado a: ${res.fec_mode}`);
                await loadRfMetrics();
            }
        } catch {
            toast.error("Error al configurar FEC");
        } finally {
            setIsUpdatingFec(false);
        }
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                borderBottom: "1.5px solid rgba(0, 229, 255, 0.35)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={goBack}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.1rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(0, 150, 255, 0.15) 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(0, 229, 255, 0.25)"
                    }}>📊</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            ANALIZADOR DE ESPECTRO RF
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            BLE 2.4 GHZ · LORA SUB-GHZ · ULTRASONIDO FFT
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        onClick={handleTriggerHop}
                        disabled={isHopping}
                        style={{
                            padding: "6px 12px", borderRadius: "10px",
                            background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                            color: "var(--accent-cyan, #00E5FF)", fontSize: "0.74rem", fontWeight: 900, cursor: "pointer"
                        }}
                    >
                        {isHopping ? "SALTANDO..." : "⚡ SALTO FHSS"}
                    </button>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("spectrum")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "spectrum" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "spectrum" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "spectrum" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>📊</span> CASCADA ESPECTRAL
                </button>
                <button
                    onClick={() => setActiveTab("jamming")}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "jamming" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "jamming" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "jamming" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🛡️</span> JAMMING & FEC {metrics.isJammingSuspected && "🚨"}
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: SPECTRUM WATERFALL */}
                    {activeTab === "spectrum" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            {/* Selector de Banda */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF" }}>BANDA DE MONITOREO</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{bandMode} · ISM & SoundMesh</div>
                                </div>
                                <select
                                    value={bandMode}
                                    onChange={e => setBandMode(e.target.value as RfBandMode)}
                                    style={{
                                        background: "rgba(0,0,0,0.6)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                        color: "#FFFFFF", borderRadius: "8px", padding: "6px 10px", fontSize: "0.75rem",
                                        fontFamily: "JetBrains Mono, monospace"
                                    }}
                                >
                                    <option value="BLE_2_4GHZ">Bluetooth LE (2.4 GHz)</option>
                                    <option value="LORA_433MHZ">LoRaWAN (433 MHz)</option>
                                    <option value="LORA_915MHZ">LoRaWAN (915 MHz)</option>
                                    <option value="ACOUSTIC_FFT">SoundMesh Acústico (16-20 kHz)</option>
                                </select>
                            </div>

                            {/* Canvas Waterfall Spectrum */}
                            <div style={{
                                width: "100%", height: "160px", background: "rgba(0, 0, 0, 0.6)",
                                border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "12px",
                                overflow: "hidden", position: "relative"
                            }}>
                                <canvas
                                    ref={canvasRef}
                                    width={640}
                                    height={160}
                                    style={{ width: "100%", height: "100%", display: "block" }}
                                />
                            </div>

                            {/* Spectrum Stats */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", textAlign: "center" }}>
                                <div style={{ padding: "10px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>RSSI PROMEDIO</div>
                                    <div style={{ fontSize: "1rem", fontWeight: 900, color: "#00E5FF", marginTop: "2px" }}>{metrics.averageRssiDb} dBm</div>
                                </div>
                                <div style={{ padding: "10px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>CANAL ÓPTIMO</div>
                                    <div style={{ fontSize: "1rem", fontWeight: 900, color: "#00E676", marginTop: "2px" }}>CH {metrics.optimalChannelNumber}</div>
                                </div>
                                <div style={{ padding: "10px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)" }}>ESTADO BANDA</div>
                                    <div style={{ fontSize: "1rem", fontWeight: 900, color: metrics.isJammingSuspected ? "#FF3355" : "#00E676", marginTop: "2px" }}>
                                        {metrics.isJammingSuspected ? "JAMMED" : "CLEAR"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: JAMMING & FEC CONTROLLER */}
                    {activeTab === "jamming" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                    CONTROLADOR DE CORRECCIÓN DE ERRORES (FEC)
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                    Ajusta la redundancia Reed-Solomon en tiempo real para sobrevivir a interferencia intencional (Jamming).
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                {(["LOW", "MEDIUM", "HIGH", "EXTREME"] as const).map(f => {
                                    const isCurrent = rfState?.fec_mode === f;
                                    return (
                                        <button
                                            key={f}
                                            onClick={() => handleSetFec(f)}
                                            disabled={isUpdatingFec}
                                            style={{
                                                padding: "12px", borderRadius: "10px",
                                                background: isCurrent ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                                border: isCurrent ? "1.5px solid #00E676" : "1px solid rgba(255, 255, 255, 0.08)",
                                                color: isCurrent ? "#00E676" : "#FFFFFF",
                                                fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                            }}
                                        >
                                            FEC {f}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
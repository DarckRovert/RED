"use client";

import React, { useState, useEffect, useRef } from "react";
import { airGapAnimatedQr } from "../lib/crypto/AirGapAnimatedQrEngine";
import { psychoacousticStego } from "../lib/crypto/PsychoacousticStegoEngine";
import { opticalMorseRxEngine, MorseRxState } from "../lib/sensors/OpticalMorseRxEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { meshRouter } from "../lib/mesh/meshRouter";

export function AirGapStegoModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<"animatedQr" | "audioStego" | "morseRx">("animatedQr");

    // Registro LIFO de retroceso físico / Esc
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (activeTab !== "animatedQr") {
                TacticalAudioEngine.playTap();
                setActiveTab("animatedQr");
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return unregister;
    }, [activeTab, goBack]);

    // Copia resiliente con degradación a textarea
    const copyToClipboard = async (text: string, label: string) => {
        TacticalAudioEngine.playMessageSent();
        let copied = false;
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch {}
        }
        if (!copied && typeof document !== "undefined") {
            try {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                copied = document.execCommand("copy");
                document.body.removeChild(ta);
            } catch {}
        }
        if (copied) {
            toast.success(`📋 ${label} copiado al portapapeles`);
        } else {
            toast.error(`Error al copiar ${label}`);
        }
    };

    // Morse RX State
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [morseState, setMorseState] = useState<MorseRxState>(() => opticalMorseRxEngine.getState());

    // QR Animated State
    const [qrText, setQrText] = useState<string>("");
    const [qrChunks, setQrChunks] = useState<string[]>([]);
    const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [isStreaming, setIsStreaming] = useState<boolean>(true);

    // Audio Stego State
    const [secretMessage, setSecretMessage] = useState<string>("");
    const [carrierAudioUrl, setCarrierAudioUrl] = useState<string | null>(null);
    const [extractedMessage, setExtractedMessage] = useState<string | null>(null);

    // Dynamic QR generation
    useEffect(() => {
        const chunks = airGapAnimatedQr.encodeIntoChunks(qrText, 60);
        setQrChunks(chunks);
        setCurrentChunkIdx(0);
    }, [qrText]);

    useEffect(() => {
        if (qrChunks.length === 0) return;

        let interval: any = null;
        if (isStreaming && qrChunks.length > 1) {
            interval = setInterval(() => {
                setCurrentChunkIdx((prev) => (prev + 1) % qrChunks.length);
            }, 300); // ~3.3 FPS
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isStreaming, qrChunks]);

    useEffect(() => {
        let isMounted = true;
        if (qrChunks.length === 0) return;
        const currentFrame = qrChunks[currentChunkIdx] || qrChunks[0];

        import("../lib/qr/OfflineQrEngine").then(async ({ OfflineQrEngine }) => {
            try {
                const url = await OfflineQrEngine.generateDataUrl(currentFrame, {
                    width: 260,
                    margin: 1,
                    darkColor: "#00E5FF",
                    lightColor: "#050812"
                });
                if (isMounted) setQrDataUrl(url);
            } catch (e) {
                console.error("Error generating animated QR:", e);
            }
        });
        return () => { isMounted = false; };
    }, [qrChunks, currentChunkIdx]);

    const handleSynthesizeAudio = () => {
        TacticalAudioEngine.playTap();
        if (carrierAudioUrl) {
            try { URL.revokeObjectURL(carrierAudioUrl); } catch {}
        }
        const blob = psychoacousticStego.synthesizeCarrierWav(secretMessage, 4);
        const url = URL.createObjectURL(blob);
        setCarrierAudioUrl(url);
        setExtractedMessage(secretMessage);
        TacticalAudioEngine.playRogerBeep();
        toast.success("🎵 Audio sintetizado con mensaje psicoacústico embebido");
    };

    const handleDownloadWav = () => {
        if (!carrierAudioUrl) return;
        TacticalAudioEngine.playMessageSent();
        const a = document.createElement("a");
        a.href = carrierAudioUrl;
        a.download = `stego_audio_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("💾 Audio WAV descargado");
    };

    const handleBroadcastMorse = async () => {
        if (!morseState.decodedText) return;
        try {
            const payload = new TextEncoder().encode(JSON.stringify({
                type: "OPTICAL_MORSE_INTEL",
                decodedText: morseState.decodedText,
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payload);
            TacticalAudioEngine.playRogerBeep();
            toast.success("📡 Mensaje Morse transmitido a la malla táctica");
        } catch (e: any) {
            toast.error("Error al transmitir Morse: " + e.message);
        }
    };

    const handleBroadcastAudioStego = async () => {
        if (!secretMessage.trim()) return;
        try {
            const payload = new TextEncoder().encode(JSON.stringify({
                type: "AUDIO_STEGO_INTEL",
                message: secretMessage.trim(),
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payload);
            TacticalAudioEngine.playRogerBeep();
            toast.success("📡 Carga útil de audio transmitida a la malla");
        } catch (e: any) {
            toast.error("Error al transmitir carga útil: " + e.message);
        }
    };

    // Cleanup audio blob URL on unmount
    useEffect(() => {
        return () => {
            if (carrierAudioUrl) {
                try { URL.revokeObjectURL(carrierAudioUrl); } catch {}
            }
        };
    }, [carrierAudioUrl]);

    useEffect(() => {
        const unsub = opticalMorseRxEngine.subscribe(setMorseState);
        return () => {
            unsub();
            opticalMorseRxEngine.reset();
        };
    }, []);

    // Camera Stream for Optical Morse RX
    useEffect(() => {
        if (activeTab !== "morseRx") return;

        let stream: MediaStream | null = null;
        let animationFrame: number | null = null;
        let isActive = true;
        let lastSampleTime = 0;

        const startCamera = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    const s = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: "environment", width: { ideal: 320 }, height: { ideal: 240 } }
                    });
                    if (!isActive) {
                        s.getTracks().forEach(t => t.stop());
                        return;
                    }
                    stream = s;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play().catch(() => {});
                    }
                }
            } catch (e) {
                console.warn("[AirGapStegoModal] Morse RX camera error:", e);
            }
        };

        startCamera();

        const processLuma = (time: number) => {
            if (!isActive) return;

            if (time - lastSampleTime >= 50) { // Estricto muestreo a 20 FPS (cero bucles explosivos)
                lastSampleTime = time;
                if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
                    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
                    if (ctx) {
                        ctx.drawImage(videoRef.current, 0, 0, 64, 48);
                        const imgData = ctx.getImageData(16, 12, 32, 24); // Center ROI
                        const data = imgData.data;
                        let totalLuma = 0;
                        const count = data.length / 4;
                        for (let i = 0; i < data.length; i += 4) {
                            totalLuma += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                        }
                        const avgLuma = totalLuma / count;
                        opticalMorseRxEngine.processFrameLuminance(avgLuma);
                    }
                }
            }
            animationFrame = requestAnimationFrame(processLuma);
        };

        animationFrame = requestAnimationFrame(processLuma);

        return () => {
            isActive = false;
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
            if (stream) stream.getTracks().forEach(t => t.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, [activeTab]);

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
                        onClick={() => { TacticalAudioEngine.playTap(); goBack(); }}
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
                    }}>🎞️</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            ENLACE AIR-GAP & ESTEGANOGRAFÍA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            QR ANIMADO · ESTEGANOGRAFÍA DE AUDIO · MORSE RX
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{
                        fontSize: "0.65rem", fontWeight: 900, padding: "4px 8px", borderRadius: "6px",
                        background: "rgba(0, 229, 255, 0.15)", color: "#00E5FF", border: "1px solid rgba(0, 229, 255, 0.3)"
                    }}>
                        ZERO-RF
                    </span>
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", background: "rgba(8, 10, 20, 0.95)",
                padding: "8px 16px", gap: "6px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                <button
                    onClick={() => { TacticalAudioEngine.playTap(); setActiveTab("animatedQr"); }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "animatedQr" ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 35, 60, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "animatedQr" ? "1.5px solid #00E5FF" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "animatedQr" ? "#00E5FF" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🎞️</span> QR ANIMADO ({qrChunks.length})
                </button>
                <button
                    onClick={() => { TacticalAudioEngine.playTap(); setActiveTab("morseRx"); }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "morseRx" ? "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(10, 60, 35, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "morseRx" ? "1.5px solid #00E676" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "morseRx" ? "#00E676" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>💡</span> DECODIFICADOR MORSE RX {morseState.isLightOn && "●"}
                </button>
                <button
                    onClick={() => { TacticalAudioEngine.playTap(); setActiveTab("audioStego"); }}
                    style={{
                        flex: 1, padding: "8px 12px", borderRadius: "10px",
                        background: activeTab === "audioStego" ? "linear-gradient(135deg, rgba(255, 51, 85, 0.25) 0%, rgba(180, 20, 40, 0.1) 100%)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "audioStego" ? "1.5px solid #FF3355" : "1px solid rgba(255, 255, 255, 0.08)",
                        color: activeTab === "audioStego" ? "#FF3355" : "var(--text-secondary)",
                        fontWeight: 900, fontSize: "0.76rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                    }}
                >
                    <span>🎧</span> AUDIO STEGO
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                    
                    {/* TAB 1: ANIMATED QR AIR-GAP */}
                    {activeTab === "animatedQr" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px", alignItems: "center",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div style={{ width: "100%" }}>
                                <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900, display: "block", marginBottom: "4px" }}>
                                    CARGA ÚTIL A TRANSMITIR (FLUJO ÓPTICO AIR-GAP)
                                </label>
                                <textarea
                                    value={qrText}
                                    onChange={(e) => setQrText(e.target.value)}
                                    rows={3}
                                    style={{
                                        width: "100%", padding: "10px 14px", borderRadius: "10px",
                                        background: "rgba(0,0,0,0.6)", color: "#FFF",
                                        border: "1px solid rgba(0, 229, 255, 0.4)", fontSize: "0.78rem", resize: "none", boxSizing: "border-box"
                                    }}
                                />
                            </div>

                            {/* Animated QR Player Screen */}
                            <div style={{
                                background: "#050812", border: "2px solid #00E5FF", borderRadius: "16px",
                                padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                                boxShadow: "0 0 30px rgba(0, 229, 255, 0.25)"
                            }}>
                                <div style={{ fontSize: "0.82rem", fontWeight: 900, color: "#00E5FF" }}>
                                    FRAME {currentChunkIdx + 1} / {qrChunks.length}
                                </div>
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="AirGap QR Frame" style={{ width: "220px", height: "220px", borderRadius: "8px" }} />
                                ) : (
                                    <div style={{ width: "220px", height: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "0.75rem" }}>
                                        Generando frame...
                                    </div>
                                )}
                                <button
                                    onClick={() => { TacticalAudioEngine.playTap(); setIsStreaming(!isStreaming); }}
                                    style={{
                                        padding: "8px 16px", borderRadius: "10px",
                                        background: isStreaming ? "rgba(255, 51, 85, 0.15)" : "rgba(0, 230, 118, 0.15)",
                                        border: `1px solid ${isStreaming ? "#FF3355" : "#00E676"}`,
                                        color: isStreaming ? "#FF3355" : "#00E676", fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    {isStreaming ? "⏸ PAUSAR FLUJO" : "▶ REANUDAR FLUJO"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: MORSE RX */}
                    {activeTab === "morseRx" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 230, 118, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676" }}>
                                    DECODIFICADOR ÓPTICO MORSE / LI-FI RX
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Apunta la cámara a pulsos de luz para decodificar texto en tiempo real.
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                <video ref={videoRef} playsInline muted style={{ width: "160px", height: "120px", borderRadius: "10px", background: "#000", objectFit: "cover" }} />
                                <canvas ref={canvasRef} width={64} height={48} style={{ display: "none" }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>LUMINANCIA CENTRO:</div>
                                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: morseState.isLightOn ? "#00E676" : "#FFFFFF" }}>
                                        {Math.round(morseState.currentLuminance)} / 255
                                    </div>
                                    <div style={{ fontSize: "0.68rem", color: morseState.isLightOn ? "#00E676" : "var(--text-secondary)" }}>
                                        {morseState.isLightOn ? "💡 LUZ DETECTADA" : "🌑 OSCURO"}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,230,118,0.3)",
                                borderRadius: "12px", padding: "14px"
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>TEXTO DECODIFICADO:</div>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        {morseState.decodedText && (
                                            <>
                                                <button
                                                    onClick={() => copyToClipboard(morseState.decodedText, "Texto Morse Decodificado")}
                                                    style={{
                                                        background: "rgba(0, 230, 118, 0.2)", border: "1px solid #00E676",
                                                        color: "#00E676", borderRadius: "6px", padding: "4px 8px", fontSize: "0.68rem",
                                                        cursor: "pointer", fontWeight: 800
                                                    }}
                                                >
                                                    📋 Copiar
                                                </button>
                                                <button
                                                    onClick={handleBroadcastMorse}
                                                    style={{
                                                        background: "rgba(0, 229, 255, 0.2)", border: "1px solid #00E5FF",
                                                        color: "#00E5FF", borderRadius: "6px", padding: "4px 8px", fontSize: "0.68rem",
                                                        cursor: "pointer", fontWeight: 800
                                                    }}
                                                >
                                                    📡 Transmitir a Malla
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        TacticalAudioEngine.playTap();
                                                        navigate("chat");
                                                    }}
                                                    style={{
                                                        background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)",
                                                        color: "#FFFFFF", borderRadius: "6px", padding: "4px 8px", fontSize: "0.68rem",
                                                        cursor: "pointer", fontWeight: 800
                                                    }}
                                                >
                                                    💬 Chat
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                TacticalAudioEngine.playTap();
                                                opticalMorseRxEngine.reset();
                                                toast.info("Búfer óptico Morse restablecido");
                                            }}
                                            style={{
                                                background: "rgba(255, 51, 85, 0.15)", border: "1px solid rgba(255, 51, 85, 0.3)",
                                                color: "#FF5252", borderRadius: "6px", padding: "4px 8px", fontSize: "0.68rem",
                                                cursor: "pointer", fontWeight: 800
                                            }}
                                        >
                                            🔄 Reiniciar
                                        </button>
                                    </div>
                                </div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#00E676", marginTop: "4px", minHeight: "28px", wordBreak: "break-all" }}>
                                    {morseState.decodedText || "Esperando pulsos ópticos..."}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: AUDIO STEGANOGRAPHY */}
                    {activeTab === "audioStego" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(255, 51, 85, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FF3355" }}>
                                    ESTEGANOGRAFÍA DE AUDIO WAV
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    Oculta cargas útiles de texto dentro de archivos WAV usando modulación de fase inaudible.
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900, display: "block", marginBottom: "4px" }}>
                                    MENSAJE A OCULTAR
                                </label>
                                <input
                                    value={secretMessage}
                                    onChange={e => setSecretMessage(e.target.value)}
                                    style={{
                                        width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.6)",
                                        border: "1px solid rgba(255, 51, 85, 0.4)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.82rem"
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleSynthesizeAudio}
                                style={{
                                    padding: "12px", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                    color: "#FFFFFF", fontWeight: 900, fontSize: "0.85rem", border: "none", borderRadius: "12px", cursor: "pointer"
                                }}
                            >
                                🎵 GENERAR PORTADORA DE AUDIO WAV
                            </button>

                            {carrierAudioUrl && (
                                <div style={{
                                    background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,51,85,0.3)",
                                    borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px"
                                }}>
                                    <audio controls src={carrierAudioUrl} style={{ width: "100%" }} />
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                                        <div style={{ fontSize: "0.72rem", color: "#00E676" }}>
                                            ✓ Mensaje embebido exitosamente en audio portador.
                                        </div>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            <button
                                                onClick={handleDownloadWav}
                                                style={{
                                                    background: "rgba(0, 230, 118, 0.2)", border: "1px solid #00E676",
                                                    color: "#00E676", borderRadius: "6px", padding: "4px 8px", fontSize: "0.68rem",
                                                    cursor: "pointer", fontWeight: 800
                                                }}
                                            >
                                                💾 Descargar WAV
                                            </button>
                                            <button
                                                onClick={handleBroadcastAudioStego}
                                                style={{
                                                    background: "rgba(0, 229, 255, 0.2)", border: "1px solid #00E5FF",
                                                    color: "#00E5FF", borderRadius: "6px", padding: "4px 8px", fontSize: "0.68rem",
                                                    cursor: "pointer", fontWeight: 800
                                                }}
                                            >
                                                📡 Transmitir a Malla
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

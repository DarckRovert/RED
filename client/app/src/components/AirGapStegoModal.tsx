"use client";

import React, { useState, useEffect, useRef } from "react";
import { airGapAnimatedQr } from "../lib/crypto/AirGapAnimatedQrEngine";
import { psychoacousticStego } from "../lib/crypto/PsychoacousticStegoEngine";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function AirGapStegoModal() {
    const { navigate } = useRedStore();
    const [activeTab, setActiveTab] = useState<"animatedQr" | "audioStego">("animatedQr");

    // QR Animated State
    const [qrText, setQrText] = useState<string>("MENSAJE TÁCTICO ULTRA-CONFIDENCIAL RED 2.0 AIR-GAP :: CLAVE MAESTRA SHA-256 VALIDADA :: C4ISR TEATRO DE OPERACIONES MILITARES");
    const [qrChunks, setQrChunks] = useState<string[]>([]);
    const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");
    const [isStreaming, setIsStreaming] = useState<boolean>(true);

    // Audio Stego State
    const [secretMessage, setSecretMessage] = useState<string>("COORDENADAS: LAT 4.6097 LON -74.0817 ALT 2640M");
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
        if (qrChunks.length === 0) return;
        const currentFrame = qrChunks[currentChunkIdx] || qrChunks[0];

        import("qrcode").then(async (QRCode) => {
            const qrLib: any = (QRCode as any).default || QRCode;
            try {
                const url = await qrLib.toDataURL(currentFrame, {
                    width: 260,
                    margin: 1,
                    color: { dark: "#00E5FF", light: "#050812" }
                });
                setQrDataUrl(url);
            } catch (e) {
                console.error("Error generating animated QR:", e);
            }
        });
    }, [qrChunks, currentChunkIdx]);

    const handleSynthesizeAudio = () => {
        const blob = psychoacousticStego.synthesizeCarrierWav(secretMessage, 4);
        const url = URL.createObjectURL(blob);
        setCarrierAudioUrl(url);
        setExtractedMessage(secretMessage);
        toast.success("🎵 Audio sintetizado con mensaje psicoacústico embebido");
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "#050812", color: "#FFF",
            display: "flex", flexDirection: "column",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 15, 30, 0.95)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>🎞️</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            TRANSFERENCIA AIR-GAP & ESTEGANOGRAFÍA DE AUDIO
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Flujo Óptico QR Animado y Ocultación Psicoacústica WAV
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => navigate("commandCenter")}
                    style={{
                        background: "rgba(232, 33, 58, 0.2)", border: "1px solid #E8213A",
                        color: "#FFF", padding: "6px 12px", borderRadius: "8px",
                        cursor: "pointer", fontWeight: 800, fontSize: "0.75rem"
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Tab Selector */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "6px 16px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                    onClick={() => setActiveTab("animatedQr")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "animatedQr" ? "#00E5FF" : "transparent",
                        color: activeTab === "animatedQr" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🎞️ QR Animado Air-Gap ({qrChunks.length} Frames)
                </button>
                <button
                    onClick={() => setActiveTab("audioStego")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "audioStego" ? "#FF3355" : "transparent",
                        color: activeTab === "audioStego" ? "#FFF" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🎧 Audio Psicoacústico WAV
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: ANIMATED QR AIR-GAP ── */}
                {activeTab === "animatedQr" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
                        <div style={{ width: "100%", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "0.7rem", color: "#AAA" }}>CARGA ÚTIL A TRANSMITIR (AIR-GAP):</label>
                            <textarea
                                value={qrText}
                                onChange={(e) => setQrText(e.target.value)}
                                rows={3}
                                style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.72rem", resize: "none", boxSizing: "border-box" }}
                            />
                        </div>

                        {/* Animated QR Player Screen */}
                        <div style={{
                            background: "#050812", border: "2px solid #00E5FF", borderRadius: "16px",
                            padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                            boxShadow: "0 0 20px rgba(0, 229, 255, 0.2)"
                        }}>
                            <div style={{ fontSize: "0.75rem", fontWeight: 900, color: "#00E5FF" }}>
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
                                onClick={() => setIsStreaming(!isStreaming)}
                                style={{
                                    padding: "6px 14px", borderRadius: "8px",
                                    background: isStreaming ? "rgba(232, 33, 58, 0.2)" : "rgba(0, 230, 118, 0.2)",
                                    border: `1px solid ${isStreaming ? "#E8213A" : "#00E676"}`,
                                    color: isStreaming ? "#FF3355" : "#00E676", fontWeight: 800, fontSize: "0.72rem", cursor: "pointer"
                                }}
                            >
                                {isStreaming ? "⏸ PAUSAR FLUJO" : "▶ REANUDAR FLUJO"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB 2: AUDIO STEGANOGRAPHY ── */}
                {activeTab === "audioStego" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <label style={{ fontSize: "0.7rem", color: "#AAA" }}>MENSAJE SECRETO A OCULTAR EN AUDIO:</label>
                            <input
                                type="text"
                                value={secretMessage}
                                onChange={(e) => setSecretMessage(e.target.value)}
                                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.6)", color: "#FFF", border: "1px solid rgba(255,255,255,0.15)", fontSize: "0.74rem", boxSizing: "border-box" }}
                            />
                            <button
                                onClick={handleSynthesizeAudio}
                                style={{
                                    padding: "12px", borderRadius: "10px",
                                    background: "linear-gradient(135deg, #FF3355, #E8213A)",
                                    color: "#FFF", fontWeight: 900, fontSize: "0.82rem", border: "none", cursor: "pointer"
                                }}
                            >
                                🎵 GENERAR PORTADORA DE AUDIO WAV
                            </button>
                        </div>

                        {carrierAudioUrl && (
                            <div style={{ background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#00E5FF" }}>REPRODUCTOR DE AUDIO CAMUFLADO:</div>
                                <audio controls src={carrierAudioUrl} style={{ width: "100%" }} />
                                <div style={{ fontSize: "0.68rem", color: "#AAA", background: "rgba(0,0,0,0.4)", padding: "8px", borderRadius: "6px" }}>
                                    ✓ Carga oculta verificada: <span style={{ color: "#00E676" }}>{extractedMessage}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}

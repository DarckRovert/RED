"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { StegoEngine } from "../lib/StegoEngine";

export function StegoVaultModal() {
    const { navigate } = useRedStore();

    const [mode, setMode] = useState<"embed" | "extract">("embed");

    // Embed states
    const [payloadText, setPayloadText] = useState("RED_TACTICAL_COORDINATES_4.6097_-74.0817");
    const [stegoResultUrl, setStegoResultUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Extract states
    const [extractedText, setExtractedText] = useState<string | null>(null);

    // Default base canvas image generator for testing
    const createBaseCanvasImage = (): string => {
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 300, 300);
            grad.addColorStop(0, "#0EA5E9");
            grad.addColorStop(1, "#0284C7");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 300, 300);
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 20px sans-serif";
            ctx.fillText("RED MESH PHOTO", 60, 150);
        }
        return canvas.toDataURL("image/png");
    };

    const handleEmbed = async () => {
        if (!payloadText.trim()) return;
        setIsProcessing(true);
        try {
            const baseImg = createBaseCanvasImage();
            const resultUrl = await StegoEngine.embedTextInImage(baseImg, payloadText.trim());
            setStegoResultUrl(resultUrl);
        } catch (e) {
            alert("Error al incrustar datos esteganográficos: " + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExtract = async () => {
        if (!stegoResultUrl) {
            alert("Primero incrusta o selecciona una imagen con esteganografía RED.");
            return;
        }
        setIsProcessing(true);
        try {
            const res = await StegoEngine.extractTextFromImage(stegoResultUrl);
            setExtractedText(res);
        } catch {
            setExtractedText(null);
        } finally {
            setIsProcessing(false);
        }
    };

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
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #EC4899, #BE185D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🖼️</div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Bóveda Esteganográfica LSB</div>
                        <div style={{ fontSize: '0.72rem', color: '#EC4899' }}>Camuflaje de Tramas Cifradas en Píxeles de Imagen</div>
                    </div>
                </div>
                <button onClick={() => navigate('sidebar')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
            </div>

            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button onClick={() => setMode("embed")} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: mode === "embed" ? "#EC4899" : "rgba(255,255,255,0.06)", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
                    🔒 OCULTAR EN IMAGEN
                </button>
                <button onClick={() => setMode("extract")} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: mode === "extract" ? "#EC4899" : "rgba(255,255,255,0.06)", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>
                    🔓 EXTRAER DE IMAGEN
                </button>
            </div>

            {mode === "embed" ? (
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '0.82rem', color: '#AAA' }}>Payload de Texto Cifrado a Ocultar:</label>
                    <textarea
                        rows={3}
                        value={payloadText}
                        onChange={e => setPayloadText(e.target.value)}
                        style={{ padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                    <button
                        onClick={handleEmbed}
                        disabled={isProcessing}
                        style={{ padding: '12px', background: '#EC4899', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        {isProcessing ? "PROCESANDO PÍXELES LSB..." : "⚡ INCRUSTAR EN IMAGEN PNG"}
                    </button>

                    {stegoResultUrl && (
                        <div style={{ marginTop: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.8rem', color: '#00E676', fontWeight: 700, marginBottom: '8px' }}>✅ Imagen Esteganográfica Generada (Imperceptible):</div>
                            <img src={stegoResultUrl} alt="Stego Result" style={{ width: '180px', height: '180px', borderRadius: '12px', border: '2px solid #00E676' }} />
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={handleExtract}
                        disabled={isProcessing}
                        style={{ padding: '12px', background: '#38BDF8', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        {isProcessing ? "ANALIZANDO BÚFER LSB..." : "🔍 EXTRAER MENSAJE OCULTO"}
                    </button>

                    {extractedText !== null && (
                        <div style={{ marginTop: '12px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', padding: '12px', borderRadius: '10px', color: '#00E676', fontWeight: 700 }}>
                            🔓 Mensaje Extraído Exitosamente:
                            <div style={{ marginTop: '6px', fontFamily: 'monospace', color: '#fff' }}>{extractedText}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

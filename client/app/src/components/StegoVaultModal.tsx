'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { StegoEngine } from '../lib/StegoEngine';

export function StegoVaultModal() {
    const { navigate, identity } = useRedStore();

    const [mode, setMode] = useState<'embed' | 'extract'>('embed');

    // Embed states
    const [payloadText, setPayloadText] = useState('');
    const [customEmbedImage, setCustomEmbedImage] = useState<string | null>(null);
    const [stegoResultUrl, setStegoResultUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Extract states
    const [customExtractImage, setCustomExtractImage] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string | null>(null);

    const operatorName = identity?.nickname || 'Operador RED';

    useEffect(() => {
        setPayloadText(`TRAMA_TACTICA_RED_${operatorName.toUpperCase()}_${Date.now()}`);
    }, [operatorName]);

    // Default base canvas image generator if user does not upload a photo
    const createBaseCanvasImage = (): string => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 400, 400);
            grad.addColorStop(0, '#0F172A');
            grad.addColorStop(0.5, '#0284C7');
            grad.addColorStop(1, '#0F172A');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 400, 400);

            // Add grid pattern
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            for (let x = 0; x < 400; x += 20) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 400); ctx.stroke();
            }
            for (let y = 0; y < 400; y += 20) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke();
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 22px Inter, sans-serif';
            ctx.fillText('🔴 RED MESH STEGO PHOTO', 50, 190);
            ctx.font = '14px monospace';
            ctx.fillStyle = '#94A3B8';
            ctx.fillText(`OPERADOR: ${operatorName}`, 50, 220);
        }
        return canvas.toDataURL('image/png');
    };

    const handleEmbedImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) setCustomEmbedImage(ev.target.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleExtractImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                const src = ev.target.result as string;
                setCustomExtractImage(src);
                setStegoResultUrl(src);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleEmbed = async () => {
        if (!payloadText.trim()) return;
        setIsProcessing(true);
        try {
            const baseImg = customEmbedImage || createBaseCanvasImage();
            const resultUrl = await StegoEngine.embedTextInImage(baseImg, payloadText.trim());
            setStegoResultUrl(resultUrl);
        } catch (e) {
            alert('Error al incrustar datos esteganográficos: ' + (e as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExtract = async () => {
        const targetUrl = customExtractImage || stegoResultUrl;
        if (!targetUrl) {
            alert('Selecciona una imagen con datos esteganográficos para extraer.');
            return;
        }
        setIsProcessing(true);
        try {
            const res = await StegoEngine.extractTextFromImage(targetUrl);
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
            overflowY: 'auto', backdropFilter: 'blur(12px)',
            fontFamily: 'Inter, sans-serif'
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
                <button onClick={() => setMode('embed')} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: mode === 'embed' ? '#EC4899' : 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                    🔒 OCULTAR EN IMAGEN
                </button>
                <button onClick={() => setMode('extract')} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: mode === 'extract' ? '#EC4899' : 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                    🔓 EXTRAER DE IMAGEN
                </button>
            </div>

            {mode === 'embed' ? (
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '0.82rem', color: '#AAA' }}>Imagen de Cobertura (Opcional — o usa plantilla nativa):</label>
                    <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleEmbedImageFile}
                        style={{ fontSize: '0.8rem', color: '#94A3B8' }}
                    />

                    {customEmbedImage && (
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                            <img src={customEmbedImage} alt="Custom base" style={{ width: '120px', height: '120px', borderRadius: '8px', objectFit: 'cover' }} />
                        </div>
                    )}

                    <label style={{ fontSize: '0.82rem', color: '#AAA', marginTop: '6px' }}>Payload de Texto a Ocultar:</label>
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
                        {isProcessing ? 'PROCESANDO PÍXELES LSB...' : '⚡ INCRUSTAR EN IMAGEN PNG'}
                    </button>

                    {stegoResultUrl && (
                        <div style={{ marginTop: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#00E676', fontWeight: 700 }}>✅ Imagen Esteganográfica Generada (Imperceptible):</div>
                            <img src={stegoResultUrl} alt="Stego Result" style={{ width: '180px', height: '180px', borderRadius: '12px', border: '2px solid #00E676', objectFit: 'cover' }} />
                            <a
                                href={stegoResultUrl}
                                download="red_stego_photo.png"
                                style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid #00E676', color: '#00E676', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, textDecoration: 'none' }}
                            >
                                💾 Descargar Imagen Esteganográfica
                            </a>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '0.82rem', color: '#AAA' }}>Seleccionar Imagen con Esteganografía:</label>
                    <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleExtractImageFile}
                        style={{ fontSize: '0.8rem', color: '#94A3B8' }}
                    />

                    {customExtractImage && (
                        <div style={{ textAlign: 'center', marginTop: '4px' }}>
                            <img src={customExtractImage} alt="Extract candidate" style={{ width: '140px', height: '140px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #38BDF8' }} />
                        </div>
                    )}

                    <button
                        onClick={handleExtract}
                        disabled={isProcessing}
                        style={{ padding: '12px', background: '#38BDF8', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        {isProcessing ? 'ANALIZANDO BÚFER LSB...' : '🔍 EXTRAER MENSAJE OCULTO'}
                    </button>

                    {extractedText !== null && (
                        <div style={{ marginTop: '12px', background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', padding: '12px', borderRadius: '10px', color: '#00E676', fontWeight: 700 }}>
                            🔓 Mensaje Extraído Exitosamente:
                            <div style={{ marginTop: '6px', fontFamily: 'monospace', color: '#fff', wordBreak: 'break-all' }}>{extractedText}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

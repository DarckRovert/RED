import React, { useState } from "react";
import { toast } from "../Toast";

interface ImageViewerModalProps {
    src: string;
    alt?: string;
    onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ src, alt, onClose }) => {
    const [zoom, setZoom] = useState(1);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(src);
            toast.success("✅ Enlace/Base64 copiado.");
        } catch {
            toast.error("❌ No se pudo copiar.");
        }
    };

    const handleDownload = () => {
        const a = document.createElement("a");
        a.href = src;
        a.download = `RED_media_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("📥 Imagen guardada.");
    };

    return (
        <div 
            className="animate-fade"
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(5,5,12,0.95)', backdropFilter: 'blur(16px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                userSelect: 'none',
            }}
            onClick={onClose}
        >
            {/* Header controls */}
            <div 
                style={{
                    position: 'absolute', top: 16, right: 16, display: 'flex', gap: '10px', zIndex: 10001
                }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={() => setZoom(z => (z === 1 ? 1.8 : 1))}
                    style={{
                        padding: '8px 14px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    {zoom === 1 ? '🔍 Zoom 1.8x' : '🔎 Zoom 1x'}
                </button>
                <button
                    onClick={handleDownload}
                    style={{
                        padding: '8px 14px', borderRadius: '12px',
                        background: 'rgba(0,217,126,0.15)', border: '1px solid rgba(0,217,126,0.3)',
                        color: '#00D97E', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    📥 Guardar
                </button>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 14px', borderRadius: '12px',
                        background: 'rgba(232,33,58,0.2)', border: '1px solid rgba(232,33,58,0.4)',
                        color: '#ff4444', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Main Image */}
            <div 
                style={{
                    maxWidth: '92vw', maxHeight: '82vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.25s var(--ease-spring)', transform: `scale(${zoom})`,
                }}
                onClick={e => e.stopPropagation()}
            >
                <img 
                    src={src} 
                    alt={alt || "Adjunto HD"} 
                    style={{
                        maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: '16px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)'
                    }}
                />
            </div>
        </div>
    );
};

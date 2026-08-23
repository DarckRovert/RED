"use client";

import React, { useState } from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

interface ImageViewerModalProps {
    src: string;
    alt?: string;
    onClose?: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ src, alt, onClose }) => {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(1);

    const handleDownload = () => {
        const a = document.createElement("a");
        a.href = src;
        a.download = `RED_media_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("📥 Imagen guardada");
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(3,3,8,0.96)", backdropFilter: "blur(20px)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                userSelect: "none",
            }}
            onClick={onClose}
        >
            {/* Header controls */}
            <div
                style={{
                    position: "absolute", top: 16, right: 16, display: "flex", gap: "10px", zIndex: 10001
                }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={() => setZoom(z => (z === 1 ? 1.8 : 1))}
                    className="btn-tactical-secondary"
                    style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                >
                    {zoom === 1 ? "🔍 Zoom 1.8x" : "🔎 Zoom 1x"}
                </button>
                <button
                    onClick={handleDownload}
                    className="btn-tactical-primary"
                    style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                >
                    📥 {t.common?.save || "Guardar"}
                </button>
                <button
                    onClick={onClose}
                    className="btn-icon"
                    style={{ width: 36, height: 36 }}
                    title={t.common?.close || "Cerrar"}
                >
                    ✕
                </button>
            </div>

            {/* Main Image */}
            <div
                style={{
                    maxWidth: "92vw", maxHeight: "82vh", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "transform 0.25s ease", transform: `scale(${zoom})`,
                }}
                onClick={e => e.stopPropagation()}
            >
                <img
                    src={src}
                    alt={alt || "Adjunto Táctico HD"}
                    style={{
                        maxWidth: "100%", maxHeight: "82vh", objectFit: "contain", borderRadius: "16px",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.9)", border: "1px solid var(--glass-border)"
                    }}
                />
            </div>
        </div>
    );
};
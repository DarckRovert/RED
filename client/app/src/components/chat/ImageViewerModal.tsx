import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";

interface ImageViewerModalProps {
    src: string;
    alt?: string;
    onClose?: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ src, alt, onClose }) => {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [hasError, setHasError] = useState(false);
    const didDragRef = useRef(false);

    const [prevSrc, setPrevSrc] = useState(src);
    if (prevSrc !== src) {
        setPrevSrc(src);
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setHasError(false);
    }

    // Intercepción LIFO (retroceso físico / Esc)
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            if (zoom > 1) {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                return true;
            }
            if (onClose) onClose();
            return true;
        });
        return unregister;
    }, [zoom, onClose]);

    const handleToggleZoom = () => {
        TacticalAudioEngine.playTap();
        setZoom(z => {
            if (z === 1) return 1.8;
            setPan({ x: 0, y: 0 });
            return 1;
        });
    };

    const handleDownload = () => {
        TacticalAudioEngine.playTap();
        const a = document.createElement("a");
        a.href = src;
        a.download = `RED_media_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("📥 Imagen guardada");
    };

    // Control gestual de Paneo
    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        didDragRef.current = false;
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || zoom <= 1) return;
        didDragRef.current = true;
        setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (zoom <= 1 || e.touches.length !== 1) return;
        setIsDragging(true);
        didDragRef.current = false;
        setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || zoom <= 1) return;
        didDragRef.current = true;
        setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
    };

    const handleTouchEnd = () => setIsDragging(false);

    const handleBackdropClick = () => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }
        TacticalAudioEngine.playTap();
        if (onClose) onClose();
    };

    return (
        <div
            className="scroll-container"
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(3,3,8,0.96)", backdropFilter: "blur(20px)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                userSelect: "none",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
            }}
            onClick={handleBackdropClick}
        >
            {/* Header controls con protección de Notch / Safe-Area */}
            <div
                style={{
                    position: "absolute",
                    top: "calc(16px + env(safe-area-inset-top, 0px))",
                    right: "calc(16px + env(safe-area-inset-right, 0px))",
                    display: "flex", gap: "8px", zIndex: 10001,
                    maxWidth: "calc(100vw - 32px)", flexWrap: "wrap", justifyContent: "flex-end"
                }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={handleToggleZoom}
                    className="btn-tactical-secondary"
                    style={{ padding: "8px 12px", fontSize: "0.75rem" }}
                >
                    {zoom === 1 ? "🔍 Zoom 1.8x" : "🔎 Zoom 1x"}
                </button>
                <button
                    onClick={handleDownload}
                    className="btn-tactical-primary"
                    style={{ padding: "8px 12px", fontSize: "0.75rem" }}
                >
                    📥 {t.common?.save || "Guardar"}
                </button>
                <button
                    onClick={() => {
                        TacticalAudioEngine.playTap();
                        if (onClose) onClose();
                    }}
                    className="btn-icon"
                    style={{ width: 36, height: 36 }}
                    title={t.common?.close || "Cerrar"}
                >
                    ✕
                </button>
            </div>

            {/* Viewport Táctico con Paneo 2D */}
            <div
                style={{
                    flex: 1, width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                    cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                    touchAction: zoom > 1 ? "none" : "auto",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={handleToggleZoom}
            >
                {hasError ? (
                    <div style={{
                        padding: "24px", borderRadius: "16px", background: "rgba(255, 23, 68, 0.12)",
                        border: "1.5px solid var(--accent-crimson)", color: "#FFF", textAlign: "center",
                        maxWidth: "340px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center"
                    }}>
                        <span style={{ fontSize: "2rem" }}>⚠️</span>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>Error al cargar imagen</div>
                        <div style={{ fontSize: "0.72rem", color: "#FF8A80", fontFamily: "JetBrains Mono, monospace" }}>
                            El adjunto no se pudo decodificar o el paquete de malla está incompleto.
                        </div>
                    </div>
                ) : (
                    <div
                        style={{
                            maxWidth: "92vw", maxHeight: "82vh", display: "flex", alignItems: "center", justifyContent: "center",
                            transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: "center center",
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <img
                            src={src}
                            alt={alt || "Adjunto Táctico HD"}
                            onError={() => setHasError(true)}
                            draggable={false}
                            style={{
                                maxWidth: "100%", maxHeight: "82vh", objectFit: "contain", borderRadius: "16px",
                                boxShadow: "0 20px 60px rgba(0,0,0,0.9)", border: "1px solid var(--glass-border)",
                                pointerEvents: zoom > 1 ? "none" : "auto",
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
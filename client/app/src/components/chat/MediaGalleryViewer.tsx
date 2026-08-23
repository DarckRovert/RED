"use client";

import React, { useState, useEffect, useCallback } from "react";
import { MessageItem } from "../../lib/api";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

interface MediaGalleryViewerProps {
    activeMedia: MessageItem | null;
    allMessages?: MessageItem[];
    onClose: () => void;
}

export const MediaGalleryViewer: React.FC<MediaGalleryViewerProps> = ({
    activeMedia,
    allMessages = [],
    onClose,
}) => {
    const { t } = useTranslation();
    // Filter all media messages (images, videos)
    const mediaItems = React.useMemo(() => {
        return allMessages.filter(
            (m) =>
                m.msg_type === "image" ||
                m.msg_type === "video" ||
                (m.media_data && (m.media_data.startsWith("data:image/") || m.media_data.startsWith("data:video/")))
        );
    }, [allMessages]);

    const initialIdx = mediaItems.findIndex((m) => m.id === activeMedia?.id);
    const [currentIndex, setCurrentIndex] = useState(initialIdx >= 0 ? initialIdx : 0);
    const [zoomScale, setZoomScale] = useState(1);
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

    const currentItem = mediaItems[currentIndex] || activeMedia;

    const handlePrev = useCallback(() => {
        setZoomScale(1);
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
    }, [mediaItems.length]);

    const handleNext = useCallback(() => {
        setZoomScale(1);
        setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
    }, [mediaItems.length]);

    // Keyboard navigation
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowLeft") handlePrev();
            if (e.key === "ArrowRight") handleNext();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose, handlePrev, handleNext]);

    const handleDoubleTap = () => {
        setZoomScale((prev) => (prev > 1 ? 1 : 2.5));
    };

    const handleSaveMedia = async () => {
        if (!currentItem?.media_data && !currentItem?.content) return;
        const dataUrl = currentItem.media_data || currentItem.content;
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { Filesystem, Directory } = await import("@capacitor/filesystem");
                const fileName = `RED_MEDIA_${Date.now()}.${currentItem.msg_type === "video" ? "mp4" : "jpg"}`;
                const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
                await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Documents,
                    recursive: true,
                });
                toast.success(`💾 Guardado en Documentos: ${fileName}`);
            } else {
                const a = document.createElement("a");
                a.href = dataUrl;
                a.download = `RED_MEDIA_${Date.now()}.${currentItem.msg_type === "video" ? "mp4" : "jpg"}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast.success("💾 Descarga iniciada");
            }
        } catch (e: any) {
            toast.error(`Error al guardar: ${e.message || e}`);
        }
    };

    const handleShareMedia = async () => {
        if (!currentItem?.media_data && !currentItem?.content) return;
        const dataUrl = currentItem.media_data || currentItem.content;
        try {
            const { Share } = await import("@capacitor/share");
            await Share.share({
                title: "RED Media",
                text: "Compartido mediante RED Sovereign Mesh",
                url: dataUrl.startsWith("http") ? dataUrl : undefined,
                dialogTitle: "Compartir Medio",
            });
        } catch {
            if (navigator.share) {
                navigator.share({ title: "RED Media", url: window.location.href }).catch(() => {});
            } else {
                navigator.clipboard.writeText(dataUrl);
                toast.success("📋 Enlace copiado al portapapeles");
            }
        }
    };

    if (!currentItem) return null;

    const isVideo = currentItem.msg_type === "video" || (currentItem.media_data && currentItem.media_data.startsWith("data:video/"));
    const src = currentItem.media_data || currentItem.content;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 99999,
                background: "rgba(0, 0, 0, 0.96)",
                backdropFilter: "blur(20px)",
                display: "flex",
                flexDirection: "column",
                userSelect: "none",
                animation: "fadeIn 0.2s ease-out",
            }}
            onTouchStart={(e) => {
                if (e.touches.length === 1) {
                    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                }
            }}
            onTouchEnd={(e) => {
                if (!touchStart) return;
                const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
                const diffX = touchEnd.x - touchStart.x;
                const diffY = touchEnd.y - touchStart.y;
                if (Math.abs(diffX) > 60 && Math.abs(diffY) < 50) {
                    if (diffX > 0) handlePrev();
                    else handleNext();
                } else if (diffY > 100 && Math.abs(diffX) < 60) {
                    onClose();
                }
                setTouchStart(null);
            }}
        >
            {/* Header Táctico Superior */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
                    zIndex: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                        onClick={onClose}
                        className="btn-icon"
                        style={{ width: 38, height: 38, fontSize: "1.2rem", background: "rgba(255,255,255,0.1)" }}
                    >
                        ✕
                    </button>
                    <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff" }}>
                            {currentItem.is_mine ? "Tú" : `Operador ${currentItem.sender.substring(0, 8)}`}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                            {new Date((currentItem.timestamp > 1e11 ? currentItem.timestamp : currentItem.timestamp * 1000)).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={handleShareMedia}
                        className="btn-icon"
                        style={{ width: 38, height: 38, fontSize: "1rem", background: "rgba(255,255,255,0.1)" }}
                        title="Compartir"
                    >
                        📤
                    </button>
                    <button
                        onClick={handleSaveMedia}
                        className="btn-icon"
                        style={{ width: 38, height: 38, fontSize: "1rem", background: "rgba(255,255,255,0.1)" }}
                        title="Guardar en dispositivo"
                    >
                        💾
                    </button>
                </div>
            </div>

            {/* Visualizador Central de Medios */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                }}
                onDoubleClick={handleDoubleTap}
            >
                {isVideo ? (
                    <video
                        src={src}
                        controls
                        autoPlay
                        playsInline
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            borderRadius: "8px",
                        }}
                    />
                ) : (
                    <img
                        src={src}
                        alt="RED Media Viewer"
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            transform: `scale(${zoomScale})`,
                            transition: "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
                            cursor: zoomScale > 1 ? "zoom-out" : "zoom-in",
                        }}
                        onClick={() => zoomScale > 1 && setZoomScale(1)}
                    />
                )}

                {/* Botones de Navegación Lateral en Desktop / Tablet */}
                {mediaItems.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            style={{
                                position: "absolute",
                                left: "16px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "rgba(0,0,0,0.5)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                color: "#fff",
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.2rem",
                                cursor: "pointer",
                                backdropFilter: "blur(10px)",
                            }}
                        >
                            ‹
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            style={{
                                position: "absolute",
                                right: "16px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "rgba(0,0,0,0.5)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                color: "#fff",
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.2rem",
                                cursor: "pointer",
                                backdropFilter: "blur(10px)",
                            }}
                        >
                            ›
                        </button>
                    </>
                )}
            </div>

            {/* Footer de Miniaturas / Indicador */}
            {mediaItems.length > 1 && (
                <div
                    style={{
                        padding: "12px 16px",
                        background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "8px",
                        overflowX: "auto",
                    }}
                >
                    <span
                        style={{
                            fontSize: "0.75rem",
                            color: "var(--accent-cyan)",
                            fontFamily: "JetBrains Mono, monospace",
                            fontWeight: 800,
                        }}
                    >
                        {currentIndex + 1} / {mediaItems.length}
                    </span>
                </div>
            )}
        </div>
    );
};

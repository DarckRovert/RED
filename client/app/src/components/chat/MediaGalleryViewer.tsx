"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MessageItem } from "../../lib/api";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";
import { indexedMediaVault } from "../../lib/storage/indexedMediaVault";

interface MediaGalleryViewerProps {
    activeMedia: MessageItem | null;
    allMessages?: MessageItem[];
    onClose: () => void;
}

function isValidMediaSource(src?: string | null): boolean {
    if (!src) return false;
    const s = src.trim();
    return s.startsWith("data:image/") ||
           s.startsWith("data:video/") ||
           s.startsWith("data:audio/") ||
           s.startsWith("blob:") ||
           s.startsWith("http://") ||
           s.startsWith("https://") ||
           s.startsWith("red_vault://") ||
           s.startsWith("capacitor://");
}

export const MediaGalleryViewer: React.FC<MediaGalleryViewerProps> = ({
    activeMedia,
    allMessages = [],
    onClose,
}) => {
    const { t } = useTranslation();

    // Filter valid media messages (images, videos)
    const mediaItems = useMemo(() => {
        const filtered = allMessages.filter(
            (m) =>
                (m.msg_type === "image" || m.msg_type === "video") &&
                (isValidMediaSource(m.media_data) || isValidMediaSource(m.content))
        );
        if (filtered.length === 0 && activeMedia) {
            return [activeMedia];
        }
        return filtered;
    }, [allMessages, activeMedia]);

    const initialIdx = mediaItems.findIndex((m) => m.id === activeMedia?.id);
    const [currentIndex, setCurrentIndex] = useState(initialIdx >= 0 ? initialIdx : 0);
    const [zoomScale, setZoomScale] = useState(1);
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
    const [imgError, setImgError] = useState(false);

    const currentItem = mediaItems[currentIndex] || activeMedia;

    // Resolve vault or data URL
    useEffect(() => {
        let isMounted = true;
        setImgError(false);
        setZoomScale(1);

        if (!currentItem) {
            setResolvedSrc(null);
            return;
        }

        const rawSrc = currentItem.media_data || currentItem.content;
        if (!rawSrc) {
            setResolvedSrc(null);
            return;
        }

        if (rawSrc.startsWith("red_vault://")) {
            const vaultId = rawSrc.replace("red_vault://", "");
            indexedMediaVault.getMedia(vaultId).then((data) => {
                if (isMounted) {
                    setResolvedSrc(data || rawSrc);
                }
            }).catch(() => {
                if (isMounted) setResolvedSrc(rawSrc);
            });
        } else {
            setResolvedSrc(rawSrc);
        }

        return () => { isMounted = false; };
    }, [currentItem]);

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
        if (!resolvedSrc && !currentItem?.media_data && !currentItem?.content) return;
        const dataUrl = resolvedSrc || currentItem?.media_data || currentItem?.content || "";
        if (!isValidMediaSource(dataUrl)) {
            toast.error("El contenido no es un archivo multimedia válido para guardar.");
            return;
        }
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { Filesystem, Directory } = await import("@capacitor/filesystem");
                const fileName = `RED_MEDIA_${Date.now()}.${currentItem?.msg_type === "video" ? "mp4" : "jpg"}`;
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
                a.download = `RED_MEDIA_${Date.now()}.${currentItem?.msg_type === "video" ? "mp4" : "jpg"}`;
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
        const dataUrl = resolvedSrc || currentItem?.media_data || currentItem?.content || "";
        if (!dataUrl) return;
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

    const isVideo = currentItem.msg_type === "video" || (resolvedSrc && resolvedSrc.startsWith("data:video/"));
    const isValid = isValidMediaSource(resolvedSrc);

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
                {!isValid || imgError ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "32px 24px",
                        background: "rgba(18, 18, 30, 0.85)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "16px",
                        maxWidth: "400px",
                        textAlign: "center",
                        gap: "12px",
                        margin: "16px"
                    }}>
                        <div style={{ fontSize: "2.5rem" }}>🖼️</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            Archivo multimedia no disponible
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                            {currentItem.content && !currentItem.content.startsWith("data:") ? currentItem.content : "La carga multimedia no contiene un formato de imagen válido o ha expirado."}
                        </div>
                    </div>
                ) : isVideo ? (
                    <video
                        src={resolvedSrc!}
                        controls
                        autoPlay
                        playsInline
                        onError={() => setImgError(true)}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            borderRadius: "8px",
                        }}
                    />
                ) : (
                    <img
                        src={resolvedSrc!}
                        alt="RED Media Viewer"
                        onError={() => setImgError(true)}
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

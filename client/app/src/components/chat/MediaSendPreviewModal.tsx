import React, { useState, useEffect } from "react";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { TacticalEmojiPicker } from "./TacticalEmojiPicker";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";
import { toast } from "../Toast";

interface MediaSendPreviewModalProps {
    file: File | null;
    dataUrl: string;
    type: "image" | "video";
    recipientName: string;
    onSend: (caption: string) => void;
    onCancel: () => void;
}

export const MediaSendPreviewModal: React.FC<MediaSendPreviewModalProps> = ({
    file,
    dataUrl,
    type,
    recipientName,
    onSend,
    onCancel,
}) => {
    const { t } = useTranslation();
    const [caption, setCaption] = useState("");
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [viewportHeight, setViewportHeight] = useState<string>("100%");

    // Sincronización reactiva con visualViewport para esquivar el teclado virtual en Android/iOS
    useEffect(() => {
        if (typeof window === "undefined" || !window.visualViewport) return;

        let rafId: number | null = null;
        let lastHeight = -1;

        const handleResize = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                const vv = window.visualViewport;
                if (!vv) return;

                const roundedHeight = Math.round(vv.height);
                if (Math.abs(roundedHeight - lastHeight) < 1) return;

                lastHeight = roundedHeight;

                if (Math.abs(roundedHeight - window.innerHeight) <= 4) {
                    setViewportHeight("100%");
                } else {
                    setViewportHeight(`${roundedHeight}px`);
                }
            });
        };

        window.visualViewport.addEventListener("resize", handleResize);

        return () => {
            window.visualViewport?.removeEventListener("resize", handleResize);
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
        };
    }, []);

    // Intercepción LIFO (retroceso físico / Esc)
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (isSending) {
                TacticalAudioEngine.playWarning();
                toast.info("⏳ Cifrando y transmitiendo archivo multimedia...");
                return true; // Blindar la transmisión en vuelo consumiendo el evento
            }
            TacticalAudioEngine.playTap();
            if (emojiOpen) {
                setEmojiOpen(false);
                return true;
            }
            onCancel();
            return true;
        });
        return unregister;
    }, [isSending, emojiOpen, onCancel]);

    const handleConfirmSend = () => {
        if (isSending) return;
        TacticalAudioEngine.playMessageSent();
        setIsSending(true);
        onSend(caption.trim());
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                height: viewportHeight,
                backgroundColor: "#0B141A",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                animation: "fadeIn 0.15s ease-out",
                overflow: "hidden",
            }}
        >
            {/* Top Bar */}
            <header style={{
                height: "56px",
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(11, 20, 26, 0.9)",
                zIndex: 10,
                flexShrink: 0,
                gap: "12px"
            }}>
                <button
                    onClick={() => {
                        if (isSending) return;
                        TacticalAudioEngine.playTap();
                        onCancel();
                    }}
                    disabled={isSending}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#FFFFFF",
                        fontSize: "1.4rem",
                        cursor: isSending ? "not-allowed" : "pointer",
                        opacity: isSending ? 0.4 : 1,
                        padding: "4px 8px",
                        flexShrink: 0
                    }}
                    title={t('common.cancel')}
                >
                    ✕
                </button>
                <div style={{
                    color: "#E9EDEF",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    flex: 1,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0
                }}>
                    Enviar a {recipientName}
                </div>
                <div style={{ width: 36, flexShrink: 0 }} />
            </header>

            {/* Media Content Area */}
            <div style={{
                flex: "1 1 0%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                minHeight: 0,
                overflow: "hidden",
                position: "relative"
            }}>
                {type === "video" ? (
                    <video
                        src={dataUrl}
                        controls
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            borderRadius: "12px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                            objectFit: "contain"
                        }}
                    />
                ) : (
                    <img
                        src={dataUrl}
                        alt="Vista previa"
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            borderRadius: "12px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
                        }}
                    />
                )}
            </div>

            {/* Bottom Caption Input Bar */}
            <div style={{
                position: "relative",
                padding: "12px 16px",
                paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))",
                background: "#111B21",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                zIndex: 10,
                flexShrink: 0
            }}>
                <div style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#2A3942",
                    borderRadius: "24px",
                    padding: "6px 14px",
                    minHeight: "46px",
                    minWidth: 0
                }}>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            setEmojiOpen(!emojiOpen);
                        }}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#8696A0",
                            fontSize: "1.25rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "2px",
                            flexShrink: 0
                        }}
                        title="Emojis"
                    >
                        😊
                    </button>
                    <input
                        type="text"
                        value={caption}
                        onChange={e => setCaption(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleConfirmSend();
                            }
                        }}
                        placeholder={t('chat_modals.add_comment_placeholder') || "Añade un comentario..."}
                        style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#FFFFFF",
                            fontSize: "0.95rem",
                            minWidth: 0
                        }}
                    />
                </div>

                <button
                    onClick={handleConfirmSend}
                    disabled={isSending}
                    style={{
                        width: "46px",
                        height: "46px",
                        borderRadius: "50%",
                        background: isSending ? "#005C4B" : "#00A884",
                        border: "none",
                        color: "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: isSending ? "wait" : "pointer",
                        boxShadow: "0 2px 10px rgba(0, 168, 132, 0.4)",
                        flexShrink: 0,
                        transition: "all 0.15s ease"
                    }}
                    title="Enviar"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>

                {/* Emoji Picker Popover anclado a la barra de entrada */}
                <TacticalEmojiPicker
                    isOpen={emojiOpen}
                    onClose={() => setEmojiOpen(false)}
                    onSelectEmoji={emoji => {
                        setCaption(prev => prev + emoji);
                    }}
                />
            </div>
        </div>
    );
};
export default MediaSendPreviewModal;

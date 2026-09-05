"use client";

import React, { useState } from "react";
import { TacticalEmojiPicker } from "./TacticalEmojiPicker";

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
    const [caption, setCaption] = useState("");
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);

    const handleConfirmSend = () => {
        if (isSending) return;
        setIsSending(true);
        onSend(caption.trim());
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "#0B141A",
                zIndex: 99999,
                display: "flex",
                flexDirection: "column",
                animation: "fadeIn 0.15s ease-out"
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
                flexShrink: 0
            }}>
                <button
                    onClick={onCancel}
                    disabled={isSending}
                    style={{
                        background: "transparent",
                        border: "none",
                        color: "#FFFFFF",
                        fontSize: "1.4rem",
                        cursor: "pointer",
                        padding: "4px 8px"
                    }}
                    title="Descartar"
                >
                    ✕
                </button>
                <div style={{ color: "#E9EDEF", fontSize: "0.95rem", fontWeight: 600 }}>
                    Enviar a {recipientName}
                </div>
                <div style={{ width: 36 }} />
            </header>

            {/* Media Content Area */}
            <div style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
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
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
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
                    minHeight: "46px"
                }}>
                    <button
                        onClick={() => setEmojiOpen(!emojiOpen)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#8696A0",
                            fontSize: "1.25rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            padding: "2px"
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
                        placeholder="Añade un comentario..."
                        style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#FFFFFF",
                            fontSize: "0.95rem"
                        }}
                        autoFocus
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
            </div>

            {/* Emoji Picker Popover */}
            <TacticalEmojiPicker
                isOpen={emojiOpen}
                onClose={() => setEmojiOpen(false)}
                onSelectEmoji={emoji => {
                    setCaption(prev => prev + emoji);
                }}
            />
        </div>
    );
};
export default MediaSendPreviewModal;

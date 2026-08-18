"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { MessageItem } from "../../lib/api";

export interface ChatInputProps {
    inputText?: string;
    setInputText?: (text: string) => void;
    handleSend?: () => void;
    onSendMessage?: (text: string, replyToId?: string) => Promise<void> | void;
    onSendVoice?: (blob?: Blob) => void;
    sendTyping?: () => void;
    attachOpen?: boolean;
    setAttachOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    replyTo?: MessageItem | null;
    setReplyTo?: (msg: MessageItem | null) => void;
    peerName?: string;
    peerHash?: string;
    burnTimer?: number;
    isRecording?: boolean;
    recordSec?: number;
    startRecording?: () => void;
    stopRecording?: () => void;
    cancelRecording?: () => void;
    handleCamera?: () => void;
    handleGallery?: () => void;
    handleDocument?: () => void;
    handleLocation?: () => void;
    setShowPollModal?: (show: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    inputText, setInputText, handleSend, onSendMessage, onSendVoice, sendTyping,
    attachOpen, setAttachOpen, replyTo, setReplyTo, peerName, peerHash, burnTimer,
    isRecording = false, recordSec = 0,
    startRecording = () => {}, stopRecording = () => {}, cancelRecording = () => {},
    handleCamera = () => {}, handleGallery = () => {}, handleDocument = () => {},
    handleLocation = () => {}, setShowPollModal = () => {}
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localText, setLocalText] = useState("");
    const [localAttachOpen, setLocalAttachOpen] = useState(false);
    const [multiline, setMultiline] = useState(false);

    const text = inputText !== undefined ? inputText : localText;
    const setText = setInputText || setLocalText;
    const isAttachOpen = attachOpen !== undefined ? attachOpen : localAttachOpen;
    const setIsAttachOpen = setAttachOpen || setLocalAttachOpen;

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        const maxH = 20 * 5 + 20;
        const newH = Math.min(ta.scrollHeight, maxH);
        ta.style.height = newH + "px";
        ta.style.overflowY = ta.scrollHeight > maxH ? "auto" : "hidden";
        setMultiline(newH > 40);
    }, [text]);

    const onSend = useCallback(() => {
        if (!text.trim()) return;
        if (onSendMessage) onSendMessage(text.trim(), replyTo?.id);
        else if (handleSend) handleSend();
        setText("");
        setMultiline(false);
        const ta = textareaRef.current;
        if (ta) { ta.style.height = "auto"; ta.style.overflowY = "hidden"; }
    }, [text, onSendMessage, handleSend, setText, replyTo]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
    };

    const formatTimer = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec < 10 ? "0" : ""}${sec}`;
    };

    return (
        <React.Fragment>
            {isAttachOpen && (
                <div style={{
                    display: "flex", gap: "10px", padding: "12px 16px",
                    background: "rgba(10,12,22,0.98)", borderTop: "1px solid var(--glass-border)",
                    overflowX: "auto", flexShrink: 0
                }}>
                    {[
                        { icon: "📷", label: "Cámara", action: () => { setIsAttachOpen(false); handleCamera(); } },
                        { icon: "🖼️", label: "Galería", action: () => { setIsAttachOpen(false); handleGallery(); } },
                        { icon: "📄", label: "Documento", action: () => { setIsAttachOpen(false); handleDocument(); } },
                        { icon: "📍", label: "Ubicación", action: () => { setIsAttachOpen(false); handleLocation(); } },
                        { icon: "📊", label: "Encuesta", action: () => { setIsAttachOpen(false); setShowPollModal(true); } },
                    ].map(a => (
                        <button
                            key={a.label}
                            onClick={a.action}
                            className="btn-tactical-secondary"
                            style={{
                                display: "flex", flexDirection: "column", alignItems: "center",
                                gap: "4px", padding: "8px 12px", minWidth: "64px",
                                fontSize: "0.72rem", fontWeight: 700
                            }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>{a.icon}</span>
                            {a.label}
                        </button>
                    ))}
                </div>
            )}

            {replyTo && (
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 16px", background: "rgba(232,33,58,0.1)",
                    borderTop: "1px solid var(--accent-crimson)", fontSize: "0.78rem", color: "#fff"
                }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "var(--accent-crimson-bright)", fontWeight: 800 }}>Respondiendo: </span>
                        {replyTo.content?.startsWith("data:") ? "📎 Archivo adjunto" : (replyTo.content || "Archivo adjunto")}
                    </div>
                    <button onClick={() => setReplyTo && setReplyTo(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", padding: "10px 14px", paddingBottom: "calc(10px + var(--safe-bottom, 0px))" }}>
                {!isRecording ? (
                    <>
                        <button
                            onClick={() => setIsAttachOpen(v => !v)}
                            className="btn-icon"
                            style={{ width: 38, height: 38, flexShrink: 0 }}
                            title="Adjuntar archivos o ubicación"
                        >
                            📎
                        </button>
                        <div style={{ flex: 1, position: "relative" }}>
                            <textarea
                                ref={textareaRef}
                                value={text}
                                rows={1}
                                onChange={e => { setText(e.target.value); sendTyping && sendTyping(); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Mensaje cifrado…"
                                style={{
                                    width: "100%", padding: "10px 14px",
                                    background: "rgba(20, 22, 38, 0.9)",
                                    border: "1px solid var(--glass-border)",
                                    borderRadius: multiline ? "16px" : "var(--radius-full)",
                                    color: "#fff", fontSize: "0.90rem", outline: "none",
                                    resize: "none", overflowY: "hidden",
                                    lineHeight: "20px", display: "block",
                                    boxSizing: "border-box",
                                    transition: "border-radius 0.15s ease",
                                    fontFamily: "inherit", minHeight: "40px",
                                }}
                            />
                        </div>
                        {text.trim().length > 0 ? (
                            <button
                                onClick={onSend}
                                className="btn-tactical-primary"
                                style={{ width: 40, height: 40, borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                                title="Enviar mensaje"
                            >
                                ➤
                            </button>
                        ) : (
                            <button
                                onClick={startRecording}
                                className="btn-icon"
                                style={{ width: 38, height: 38, flexShrink: 0, background: "rgba(255,255,255,0.06)", color: "var(--accent-cyan)" }}
                                title="Grabar nota de voz"
                            >
                                🎤
                            </button>
                        )}
                    </>
                ) : (
                    /* Live Tactical Audio Recording Bar */
                    <div style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "rgba(232,33,58,0.15)", border: "1px solid var(--accent-crimson)",
                        borderRadius: "var(--radius-full)", padding: "6px 14px", minHeight: "44px",
                        animation: "pulse 1.5s infinite"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{
                                width: "10px", height: "10px", borderRadius: "50%",
                                background: "var(--accent-crimson)", boxShadow: "0 0 8px #FF1744"
                            }} />
                            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.88rem", fontWeight: 800, color: "#fff" }}>
                                {formatTimer(recordSec)}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--accent-crimson-bright)", fontWeight: 600 }}>
                                Grabando nota OPUS...
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                                onClick={cancelRecording}
                                style={{
                                    background: "rgba(255,255,255,0.1)", border: "none",
                                    color: "var(--text-muted)", borderRadius: "var(--radius-full)",
                                    padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer"
                                }}
                            >
                                ✕ Cancelar
                            </button>
                            <button
                                onClick={stopRecording}
                                style={{
                                    background: "var(--accent-crimson)", border: "none",
                                    color: "#fff", borderRadius: "var(--radius-full)",
                                    padding: "5px 12px", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer",
                                    boxShadow: "0 0 10px rgba(255,23,68,0.4)"
                                }}
                            >
                                ✓ Enviar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </React.Fragment>
    );
};

export default ChatInput;

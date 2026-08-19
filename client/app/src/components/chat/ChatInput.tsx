"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { MessageItem } from "../../lib/api";

export interface ChatInputProps {
    inputText?: string;
    setInputText?: (text: string) => void;
    handleSend?: () => void;
    onSendMessage?: (text: string, replyToMsg?: MessageItem | null) => Promise<void> | void;
    onSendVoice?: (blob?: Blob) => void;
    sendTyping?: () => void;
    attachOpen?: boolean;
    setAttachOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    replyTo?: MessageItem | null;
    setReplyTo?: (msg: MessageItem | null) => void;
    editingMsg?: MessageItem | null;
    setEditingMsg?: (msg: MessageItem | null) => void;
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
    attachOpen, setAttachOpen, replyTo, setReplyTo, editingMsg, setEditingMsg, peerName, peerHash, burnTimer,
    isRecording = false, recordSec = 0,
    startRecording = () => {}, stopRecording = () => {}, cancelRecording = () => {},
    handleCamera = () => {}, handleGallery = () => {}, handleDocument = () => {},
    handleLocation = () => {}, setShowPollModal = () => {}
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localText, setLocalText] = useState("");
    const [localAttachOpen, setLocalAttachOpen] = useState(false);
    const [multiline, setMultiline] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const lastTypingSentRef = useRef<number>(0);

    const triggerTyping = useCallback(() => {
        const now = Date.now();
        if (now - lastTypingSentRef.current >= 3000) {
            lastTypingSentRef.current = now;
            sendTyping?.();
        }
    }, [sendTyping]);

    const text = inputText !== undefined ? inputText : localText;
    const setText = setInputText || setLocalText;
    const isAttachOpen = attachOpen !== undefined ? attachOpen : localAttachOpen;
    const setIsAttachOpen = setAttachOpen || setLocalAttachOpen;

    useEffect(() => {
        if (editingMsg) {
            setText(editingMsg.content || "");
            textareaRef.current?.focus();
        }
    }, [editingMsg, setText]);

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
        if (onSendMessage) onSendMessage(text.trim(), replyTo);
        else if (handleSend) handleSend();
        setText("");
        setMultiline(false);
        if (setReplyTo) setReplyTo(null);
        if (setEditingMsg) setEditingMsg(null);
        const ta = textareaRef.current;
        if (ta) { ta.style.height = "auto"; ta.style.overflowY = "hidden"; }
    }, [text, onSendMessage, handleSend, setText, replyTo, setReplyTo, setEditingMsg]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
    };

    const formatTimer = (s: number) => {
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${sec < 10 ? "0" : ""}${sec}`;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", background: "rgba(10,12,22,0.98)", borderTop: "1px solid var(--glass-border)", zIndex: 30 }}>
            {/* ── Reply Quote Banner Bar ── */}
            {replyTo && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 16px",
                    background: "rgba(0, 229, 255, 0.08)",
                    borderLeft: "4px solid var(--accent-cyan)",
                    borderBottom: "1px solid var(--glass-border)",
                    animation: "fadeIn 0.15s ease-out"
                }}>
                    <div style={{ overflow: "hidden", paddingRight: "10px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                            ↩️ Respondiendo a {replyTo.is_mine ? "ti mismo" : (peerName || "Operador")}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {replyTo.content || `[${replyTo.msg_type || "Medio"}]`}
                        </div>
                    </div>
                    <button
                        onClick={() => setReplyTo?.(null)}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.85rem", flexShrink: 0 }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Editing Message Banner Bar ── */}
            {editingMsg && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 16px",
                    background: "rgba(255, 179, 0, 0.10)",
                    borderLeft: "4px solid var(--accent-amber)",
                    borderBottom: "1px solid var(--glass-border)",
                    animation: "fadeIn 0.15s ease-out"
                }}>
                    <div style={{ overflow: "hidden", paddingRight: "10px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                            ✏️ Editando mensaje
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {editingMsg.content}
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditingMsg?.(null); setText(""); }}
                        className="btn-icon"
                        style={{ width: 28, height: 28, fontSize: "0.85rem", flexShrink: 0 }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Attachments Bar ── */}
            {isAttachOpen && (
                <div style={{
                    display: "flex", gap: "10px", padding: "12px 16px",
                    background: "rgba(14,16,28,0.98)", borderBottom: "1px solid var(--glass-border)",
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
                                padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px",
                                fontSize: "0.78rem", whiteSpace: "nowrap", flexShrink: 0
                            }}
                        >
                            <span>{a.icon}</span>
                            <span>{a.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Main Input & Voice Recording Area ── */}
            <div style={{
                display: "flex", alignItems: "flex-end", gap: "8px",
                padding: "8px 12px", minHeight: "56px"
            }}>
                {isRecording ? (
                    /* Tactical Recording Mode */
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        flex: 1, height: "42px", padding: "0 14px",
                        background: "rgba(232,33,58,0.12)", border: "1px solid rgba(232,33,58,0.4)",
                        borderRadius: "24px", animation: "pulse 1.5s infinite"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF3355", boxShadow: "0 0 10px #FF3355" }} />
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                {formatTimer(recordSec)}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Grabando audio P2P...
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                                onClick={cancelRecording}
                                className="btn-icon"
                                style={{ width: 34, height: 34, fontSize: "0.90rem", color: "#FF5252" }}
                                title="Descartar grabación"
                            >
                                🗑️
                            </button>
                            <button
                                onClick={stopRecording}
                                className="btn-icon"
                                style={{ width: 34, height: 34, fontSize: "1rem", background: "var(--primary)", color: "#fff" }}
                                title="Enviar audio"
                            >
                                📤
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Standard Chat Input Mode */
                    <>
                        <button
                            onClick={() => setIsAttachOpen(!isAttachOpen)}
                            className={`btn-icon ${isAttachOpen ? "active" : ""}`}
                            style={{ width: 40, height: 40, fontSize: "1.2rem", flexShrink: 0 }}
                            title="Adjuntar multimedia"
                        >
                            📎
                        </button>

                        <div style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid var(--glass-border)",
                            borderRadius: multiline ? "16px" : "24px",
                            padding: "6px 14px",
                            minHeight: "40px",
                        }}>
                            <textarea
                                ref={textareaRef}
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    if (e.target.value.trim().length > 0) {
                                        triggerTyping();
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                                placeholder={burnTimer ? `Mensaje autodestructible (${burnTimer}s)...` : "Escribe un mensaje cifrado..."}
                                rows={1}
                                style={{
                                    width: "100%",
                                    background: "transparent",
                                    border: "none",
                                    outline: "none",
                                    color: "#fff",
                                    fontSize: "0.90rem",
                                    resize: "none",
                                    maxHeight: "120px",
                                    fontFamily: "inherit",
                                    lineHeight: "1.4",
                                }}
                            />
                        </div>

                        {text.trim() ? (
                            <button
                                onClick={onSend}
                                className="btn-tactical-primary"
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "1.1rem",
                                    padding: 0,
                                    flexShrink: 0,
                                }}
                                title="Enviar mensaje"
                            >
                                ➔
                            </button>
                        ) : (
                            <button
                                onClick={startRecording}
                                className="btn-icon"
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: "50%",
                                    fontSize: "1.2rem",
                                    background: "rgba(255,255,255,0.08)",
                                    flexShrink: 0,
                                }}
                                title="Grabar nota de voz"
                            >
                                🎙️
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

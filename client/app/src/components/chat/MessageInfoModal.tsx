"use client";

import React from "react";
import { MessageItem } from "../../lib/api";

interface MessageInfoModalProps {
    message: MessageItem | null;
    isMine: boolean;
    onClose: () => void;
}

/**
 * MessageInfoModal — Cryptographic & Delivery Traceability Modal
 * 
 * Provides WhatsApp / Signal style message info:
 * - Message bubble preview
 * - Delivery status and DELIVERY_ACK timestamp
 * - Read status and read timestamp
 * - E2E encryption cipher specification (ML-KEM-768 / Noise Double Ratchet)
 */
export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
    message,
    isMine,
    onClose,
}) => {
    if (!message) return null;

    const isDelivered = message.status === "Delivered" || (message as any).delivered === true;
    const isRead = message.status === "Read" || (message as any).read === true;

    const formatFullDate = (ts: number) => {
        if (!ts) return "—";
        const norm = ts < 1e10 ? ts * 1000 : ts;
        const d = new Date(norm);
        return d.toLocaleDateString([], {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    };

    const sentDateStr = formatFullDate(message.timestamp);
    const deliveredDateStr = isDelivered 
        ? ((message as any).delivered_at ? formatFullDate((message as any).delivered_at) : sentDateStr)
        : "Esperando confirmación del receptor...";
    const readDateStr = isRead
        ? ((message as any).read_at ? formatFullDate((message as any).read_at) : "Leído recientemente")
        : "Aún no leído";

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.82)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                animation: "fadeIn 0.18s ease-out"
            }}
            onClick={onClose}
        >
            <div
                className="animate-enter"
                style={{
                    width: "100%",
                    maxWidth: "460px",
                    backgroundColor: "#111B21",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    borderRadius: "20px",
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 168, 132, 0.15)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    backgroundColor: "#1F2C34"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.2rem", color: "#00A884" }}>ℹ️</span>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#E9EDEF" }}>
                            Info. del mensaje
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#8696A0",
                            fontSize: "1.2rem",
                            cursor: "pointer",
                            padding: "4px 8px",
                            borderRadius: "6px"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Message Bubble Preview */}
                <div style={{
                    padding: "20px",
                    backgroundColor: "#0B141A",
                    display: "flex",
                    justifyContent: isMine ? "flex-end" : "flex-start",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
                }}>
                    <div style={{
                        maxWidth: "85%",
                        padding: "8px 14px",
                        backgroundColor: isMine ? "#005C4B" : "#202C33",
                        color: "#E9EDEF",
                        borderRadius: "12px",
                        fontSize: "0.92rem",
                        lineHeight: 1.4,
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
                        wordBreak: "break-word"
                    }}>
                        {message.content?.startsWith("data:image") ? (
                            <span>📷 [Imagen cifrada]</span>
                        ) : message.content?.startsWith("data:audio") ? (
                            <span>🎙️ [Nota de voz P2P]</span>
                        ) : (
                            message.content
                        )}
                        <div style={{
                            fontSize: "0.68rem",
                            color: isMine ? "#8696A0" : "#8696A0",
                            textAlign: "right",
                            marginTop: "4px"
                        }}>
                            {new Date(message.timestamp < 1e10 ? message.timestamp * 1000 : message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>
                </div>

                {/* Traceability List */}
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Read Item */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                        <div style={{
                            width: "36px", height: "36px", borderRadius: "50%",
                            backgroundColor: isRead ? "rgba(83, 189, 235, 0.15)" : "rgba(255, 255, 255, 0.05)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.1rem", flexShrink: 0
                        }}>
                            {/* Blue Double Check Vector */}
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M4 10.5L7.5 14L15 6" stroke={isRead ? "#53BDEB" : "#8696A0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M8 10.5L11.5 14L19 6" stroke={isRead ? "#53BDEB" : "#8696A0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>Leído</div>
                            <div style={{ fontSize: "0.78rem", color: isRead ? "#8696A0" : "#667781", marginTop: "2px" }}>
                                {readDateStr}
                            </div>
                        </div>
                    </div>

                    {/* Delivered Item */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                        <div style={{
                            width: "36px", height: "36px", borderRadius: "50%",
                            backgroundColor: isDelivered ? "rgba(0, 168, 132, 0.15)" : "rgba(255, 255, 255, 0.05)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.1rem", flexShrink: 0
                        }}>
                            {/* Grey Double Check Vector */}
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M4 10.5L7.5 14L15 6" stroke={isDelivered ? "#8696A0" : "#667781"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M8 10.5L11.5 14L19 6" stroke={isDelivered ? "#8696A0" : "#667781"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>Entregado</div>
                            <div style={{ fontSize: "0.78rem", color: "#8696A0", marginTop: "2px" }}>
                                {deliveredDateStr}
                            </div>
                        </div>
                    </div>

                    {/* Sent Item */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                        <div style={{
                            width: "36px", height: "36px", borderRadius: "50%",
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.1rem", flexShrink: 0
                        }}>
                            {/* Single Check Vector */}
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M5 10.5L8.5 14L16 6" stroke="#8696A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "#E9EDEF" }}>Enviado</div>
                            <div style={{ fontSize: "0.78rem", color: "#8696A0", marginTop: "2px" }}>
                                {sentDateStr}
                            </div>
                        </div>
                    </div>

                    {/* Cryptographic Security Details */}
                    <div style={{
                        marginTop: "4px",
                        padding: "12px 14px",
                        backgroundColor: "#1F2C34",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "0.9rem" }}>🔒</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#00A884", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                                Cifrado Post-Cuántico Soberano
                            </span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#8696A0", lineHeight: 1.4 }}>
                            Protocolo: <strong>Noise Protocol + ML-KEM-768</strong> con trinquete doble (Double Ratchet) de extremo a extremo. Cero servidores centrales.
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#667781", fontFamily: "monospace", wordBreak: "break-all" }}>
                            ID: {message.id}
                        </div>
                    </div>
                </div>

                {/* Footer Button */}
                <div style={{ padding: "12px 20px 16px 20px" }}>
                    <button
                        onClick={onClose}
                        style={{
                            width: "100%",
                            padding: "12px",
                            backgroundColor: "#00A884",
                            border: "none",
                            borderRadius: "10px",
                            color: "#FFFFFF",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            cursor: "pointer"
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageInfoModal;

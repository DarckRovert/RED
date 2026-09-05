"use client";

import React, { useState, useMemo } from "react";
import { MessageItem } from "../../lib/api";
import { useRedStore } from "../../store/useRedStore";

interface StarredMessagesModalProps {
    isOpen: boolean;
    onClose: () => void;
    starredMessages: string[];
    messages: MessageItem[];
    peerName: string;
    onUnstar: (msgId: string) => void;
    onJumpToMessage: (msgId: string) => void;
}

export const StarredMessagesModal: React.FC<StarredMessagesModalProps> = ({
    isOpen,
    onClose,
    starredMessages,
    messages,
    peerName,
    onUnstar,
    onJumpToMessage,
}) => {
    const { preferences } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';
    const [searchQuery, setSearchQuery] = useState("");

    const starredList = useMemo(() => {
        const starSet = new Set(starredMessages);
        const list = messages.filter(m => starSet.has(m.id));
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase().trim();
        return list.filter(m => (m.content || "").toLowerCase().includes(q));
    }, [messages, starredMessages, searchQuery]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                backgroundColor: "rgba(0, 0, 0, 0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                animation: "fadeIn 0.15s ease-out"
            }}
            onClick={onClose}
        >
            <div
                className="animate-enter modal-card-scrollable"
                style={{
                    width: "100%",
                    maxWidth: "500px",
                    maxHeight: "calc(100dvh - 48px)",
                    background: isFamiliar ? "#202C33" : "rgba(12, 16, 30, 0.98)",
                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.1)" : "1.5px solid rgba(0, 229, 255, 0.35)",
                    borderRadius: "18px",
                    boxShadow: "0 24px 64px rgba(0, 0, 0, 0.85)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid var(--glass-border)",
                    background: isFamiliar ? "#202C33" : "rgba(255, 255, 255, 0.02)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.3rem" }}>⭐</span>
                        <div>
                            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>
                                Mensajes Destacados
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isFamiliar ? "#00A884" : "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                {starredList.length} MENSAJE{starredList.length !== 1 ? "S" : ""} CON ESTRELLA
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#8696A0",
                            fontSize: "1.1rem",
                            cursor: "pointer",
                            padding: "4px 8px"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: "12px 16px", borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: isFamiliar ? "#111B21" : "rgba(255, 255, 255, 0.05)",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        border: isFamiliar ? "none" : "1px solid rgba(255, 255, 255, 0.08)"
                    }}>
                        <span style={{ fontSize: "0.9rem", color: "#8696A0" }}>🔍</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar en mensajes destacados..."
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "#FFFFFF",
                                fontSize: "0.85rem"
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                style={{ background: "none", border: "none", color: "#8696A0", cursor: "pointer", fontSize: "0.8rem" }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", minHeight: "240px", maxHeight: "420px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {starredList.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 16px", color: "#8696A0" }}>
                            <div style={{ fontSize: "2rem", marginBottom: "10px" }}>⭐</div>
                            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#E9EDEF", marginBottom: "4px" }}>
                                {searchQuery ? "Sin coincidencias" : "No tienes mensajes destacados"}
                            </div>
                            <div style={{ fontSize: "0.78rem" }}>
                                Mantén presionado cualquier mensaje en el chat y selecciona "Destacar" para guardarlo aquí.
                            </div>
                        </div>
                    ) : (
                        starredList.map((m) => {
                            const dateStr = new Date(m.timestamp > 1e11 ? m.timestamp : m.timestamp * 1000).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short"
                            });
                            const senderLabel = m.is_mine ? "Tú" : peerName;
                            return (
                                <div
                                    key={m.id}
                                    style={{
                                        background: isFamiliar ? "#182229" : "rgba(255, 255, 255, 0.04)",
                                        border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 229, 255, 0.2)",
                                        borderRadius: "12px",
                                        padding: "12px 14px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "6px"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: isFamiliar ? (m.is_mine ? "#00A884" : "#53BDEB") : "var(--accent-cyan)" }}>
                                            {senderLabel}
                                        </span>
                                        <span style={{ fontSize: "0.68rem", color: "#8696A0", fontFamily: "JetBrains Mono, monospace" }}>
                                            {dateStr}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: "0.85rem", color: "#FFFFFF", lineHeight: 1.4, wordBreak: "break-word" }}>
                                        {m.content || `[${m.msg_type || "Medio adjunto"}]`}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginTop: "4px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "6px" }}>
                                        <button
                                            onClick={() => {
                                                onUnstar(m.id);
                                            }}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "#FF5252",
                                                fontSize: "0.74rem",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            }}
                                        >
                                            ⭐ Quitar estrella
                                        </button>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                onJumpToMessage(m.id);
                                            }}
                                            style={{
                                                background: isFamiliar ? "rgba(0, 168, 132, 0.18)" : "rgba(0, 229, 255, 0.15)",
                                                border: "none",
                                                color: isFamiliar ? "#00A884" : "var(--accent-cyan)",
                                                borderRadius: "6px",
                                                padding: "4px 10px",
                                                fontSize: "0.74rem",
                                                fontWeight: 700,
                                                cursor: "pointer"
                                            }}
                                        >
                                            Ir al mensaje →
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { EmptyState } from "./ui/EmptyState";

interface GlobalSearchModalProps {
    onClose?: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const { messages, contacts, groups, navigate } = useRedStore();
    const [query, setQuery] = useState("");

    const resolvePeerName = (hash: string) => {
        const g = groups.find((g: any) => g.id === hash);
        if (g) return g.name || "Grupo";
        const c = contacts.find((c: any) => c.identity_hash === hash);
        return c?.display_name || hash.substring(0, 8);
    };

    const results: MessageItem[] = query.trim().length >= 2
        ? messages.filter(m => m.content && m.content.toLowerCase().includes(query.toLowerCase()))
        : [];

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(4, 6, 12, 0.85)", backdropFilter: "blur(16px)",
                display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px 20px"
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter modal-card-scrollable"
                style={{
                    width: "100%", maxWidth: "540px", padding: "20px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                    maxHeight: "calc(100dvh - 60px)",
                    display: "flex", flexDirection: "column"
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.05rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>🔍</span> {t.sidebar?.search_placeholder ? t.sidebar.search_placeholder.split("...")[0] : "Búsqueda Global"}
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ width: 34, height: 34 }} title={t.common?.close || "Cerrar"}>✕</button>
                </div>

                <input
                    autoFocus
                    type="text"
                    placeholder={t.sidebar?.search_placeholder || "Buscar mensajes y canales..."}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{
                        width: "100%", padding: "12px 16px", borderRadius: "var(--radius-md)",
                        background: "var(--bg-card)", color: "#fff",
                        border: "1px solid var(--glass-border)", outline: "none",
                        fontSize: "0.95rem", marginBottom: "14px", boxSizing: "border-box",
                        flexShrink: 0
                    }}
                />

                <div className="scroll-container" style={{ flex: 1, maxHeight: "min(420px, 50vh)", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {query.trim().length >= 2 && results.length === 0 && (
                        <EmptyState 
                            title={t.sidebar?.no_contacts || "Sin coincidencias"} 
                            description={`"${query}"`} 
                            icon="🔍" 
                        />
                    )}
                    {results.map(msg => {
                        const targetConvId = msg.conversation_id || ((msg as any).recipient || msg.sender);
                        const peerName = resolvePeerName(targetConvId);
                        return (
                            <div
                                key={msg.id}
                                onClick={() => {
                                    navigate("chat", targetConvId);
                                    onClose?.();
                                }}
                                className="card-tactical-interactive"
                                style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--accent-cyan)" }}>{peerName}</span>
                                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {new Date((msg.timestamp > 1e10 ? msg.timestamp : msg.timestamp * 1000)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
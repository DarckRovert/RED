"use client";

import React, { useState, useMemo } from "react";
import { MessageItem, ConversationItem } from "../../lib/api";
import { useRedStore } from "../../store/useRedStore";
import { toast } from "../Toast";
import { TacticalAudioEngine } from "../../lib/TacticalAudioEngine";

interface MessageForwardModalProps {
    msg: MessageItem;
    onClose: () => void;
}

export const MessageForwardModal: React.FC<MessageForwardModalProps> = ({ msg, onClose }) => {
    const { conversations, contacts, groups, sendMessage } = useRedStore();
    const [search, setSearch] = useState("");
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    // Filter available destinations (direct conversations, contacts, and groups)
    const targets = useMemo(() => {
        const list: { id: string; name: string; type: 'conv' | 'contact' | 'group'; isGroup?: boolean }[] = [];
        const seen = new Set<string>();

        // Groups
        (groups || []).forEach((g: any) => {
            if (g && g.id && !seen.has(g.id)) {
                seen.add(g.id);
                list.push({ id: g.id, name: g.name || `Grupo #${g.id.slice(0, 6)}`, type: 'group', isGroup: true });
            }
        });

        // Conversations
        (conversations || []).forEach((c: ConversationItem) => {
            const peerId = c.peer || c.id;
            if (peerId && !seen.has(peerId)) {
                seen.add(peerId);
                const contact = (contacts || []).find((ct: any) => ct.identity_hash === peerId);
                list.push({
                    id: peerId,
                    name: contact?.display_name || (c.is_group ? `Grupo ${peerId.slice(0, 6)}` : `Operador ${peerId.slice(0, 8)}`),
                    type: 'conv',
                    isGroup: c.is_group
                });
            }
        });

        // Other contacts not yet in conversations
        (contacts || []).forEach((ct: any) => {
            if (ct && ct.identity_hash && !seen.has(ct.identity_hash)) {
                seen.add(ct.identity_hash);
                list.push({ id: ct.identity_hash, name: ct.display_name || `Operador ${ct.identity_hash.slice(0, 8)}`, type: 'contact' });
            }
        });

        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
    }, [conversations, contacts, groups, search]);

    const handleForward = async () => {
        if (!selectedTarget || isSending) return;
        setIsSending(true);

        try {
            // Forward payload
            const payload: any = {
                msg_type: msg.msg_type || 'text',
                media_data: msg.media_data,
                mime_type: msg.mime_type,
                file_name: (msg as any).file_name,
                file_size: (msg as any).file_size,
                duration_ms: msg.duration_ms,
                latitude: msg.latitude,
                longitude: msg.longitude,
                forwarded: true
            };

            await sendMessage(msg.content || '', payload);
            TacticalAudioEngine.playMessageSent();
            toast.success("Mensaje reenviado");
            onClose();
        } catch {
            toast.error("Error al reenviar mensaje");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "rgba(0, 0, 0, 0.78)", backdropFilter: "blur(12px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px", animation: "fadeIn 0.15s ease"
        }}>
            <div style={{
                width: "100%", maxWidth: "420px", maxHeight: "85vh",
                background: "var(--card-bg, #121424)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "20px",
                display: "flex", flexDirection: "column",
                boxShadow: "0 16px 48px rgba(0, 0, 0, 0.8)",
                overflow: "hidden"
            }}>
                {/* Header */}
                <div style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.3rem" }}>↩️</span>
                        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#FFFFFF" }}>
                            Reenviar Mensaje
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "rgba(255, 255, 255, 0.08)", border: "none",
                            borderRadius: "50%", width: "32px", height: "32px",
                            color: "#FFFFFF", cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center", fontSize: "1rem"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Preview of forwarded content */}
                <div style={{
                    padding: "12px 20px",
                    background: "rgba(0, 0, 0, 0.35)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    display: "flex", alignItems: "center", gap: "10px"
                }}>
                    <div style={{
                        width: "3px", height: "28px",
                        background: "var(--accent-red, #E8213A)",
                        borderRadius: "2px"
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--accent-red, #E8213A)", fontWeight: 800 }}>
                            MENSAJE A REENVIAR
                        </div>
                        <div style={{
                            fontSize: "0.82rem", color: "#FFFFFF",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                        }}>
                            {msg.msg_type === 'image' ? '📷 Foto' :
                             msg.msg_type === 'voice' ? '🎤 Nota de voz' :
                             msg.msg_type === 'video' ? '📹 Video' :
                             msg.msg_type === 'location' ? '📍 Ubicación táctica' :
                             (msg.content || 'Mensaje')}
                        </div>
                    </div>
                </div>

                {/* Search input */}
                <div style={{ padding: "12px 20px 8px 20px" }}>
                    <input
                        type="text"
                        placeholder="Buscar destinatario..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: "100%", padding: "10px 14px",
                            background: "rgba(0, 0, 0, 0.4)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            borderRadius: "10px", color: "#FFFFFF",
                            fontSize: "0.88rem", outline: "none",
                            boxSizing: "border-box"
                        }}
                    />
                </div>

                {/* Destinations List */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                    {targets.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            No se encontraron contactos o grupos
                        </div>
                    ) : (
                        targets.map((t) => {
                            const isSelected = selectedTarget === t.id;
                            return (
                                <div
                                    key={t.id}
                                    onClick={() => setSelectedTarget(t.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px",
                                        padding: "10px 14px", borderRadius: "12px",
                                        marginBottom: "4px", cursor: "pointer",
                                        background: isSelected ? "rgba(232, 33, 58, 0.18)" : "transparent",
                                        border: `1px solid ${isSelected ? "rgba(232, 33, 58, 0.5)" : "transparent"}`,
                                        transition: "all 0.15s ease"
                                    }}
                                >
                                    <div style={{
                                        width: "38px", height: "38px", borderRadius: "50%",
                                        background: t.isGroup ? "linear-gradient(135deg, #FF7043, #E64A19)" : "linear-gradient(135deg, #26C6DA, #00ACC1)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.1rem", fontWeight: 800, color: "#FFFFFF"
                                    }}>
                                        {t.isGroup ? "👥" : t.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {t.name}
                                        </div>
                                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {t.isGroup ? "Grupo Mesh" : `DID: ${t.id.slice(0, 12)}…`}
                                        </div>
                                    </div>
                                    <div style={{
                                        width: "20px", height: "20px", borderRadius: "50%",
                                        border: `2px solid ${isSelected ? "var(--accent-red, #E8213A)" : "rgba(255,255,255,0.3)"}`,
                                        background: isSelected ? "var(--accent-red, #E8213A)" : "transparent",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "0.7rem", color: "#FFFFFF"
                                    }}>
                                        {isSelected && "✓"}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer action buttons */}
                <div style={{
                    padding: "16px 20px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex", gap: "12px"
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: "12px", borderRadius: "10px",
                            background: "rgba(255, 255, 255, 0.08)",
                            border: "none", color: "#FFFFFF",
                            fontSize: "0.88rem", fontWeight: 700, cursor: "pointer"
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleForward}
                        disabled={!selectedTarget || isSending}
                        style={{
                            flex: 1, padding: "12px", borderRadius: "10px",
                            background: selectedTarget ? "var(--accent-red, #E8213A)" : "rgba(255, 255, 255, 0.12)",
                            border: "none",
                            color: selectedTarget ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)",
                            fontSize: "0.88rem", fontWeight: 800, cursor: selectedTarget ? "pointer" : "not-allowed",
                            boxShadow: selectedTarget ? "0 4px 16px rgba(232, 33, 58, 0.4)" : "none",
                            transition: "all 0.2s"
                        }}
                    >
                        {isSending ? "Reenviando..." : "Reenviar ↩️"}
                    </button>
                </div>
            </div>
        </div>
    );
};

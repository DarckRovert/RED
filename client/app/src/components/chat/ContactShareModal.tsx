"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { useRedStore } from "../../store/useRedStore";
import { ContactItem } from "../../api/types";
import { avatarStyle } from "../sidebar/types";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../../lib/audio/TacticalAudioEngine";

interface ContactShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectContact: (contact: ContactItem) => void;
}

export const ContactShareModal: React.FC<ContactShareModalProps> = ({
    isOpen,
    onClose,
    onSelectContact,
}) => {
    const { t } = useTranslation();
    const { contacts, preferences, identity } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';
    const [searchQuery, setSearchQuery] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Intercepción LIFO (retroceso físico / Esc)
    useEffect(() => {
        if (!isOpen) return;
        const unregister = BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
        return unregister;
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    const filteredContacts = useMemo(() => {
        const list = Array.isArray(contacts) ? [...contacts] : [];
        if (identity?.identity_hash && !list.some(c => c.identity_hash === identity.identity_hash)) {
            list.unshift({
                identity_hash: identity.identity_hash,
                display_name: `${identity.display_name || (t('chat_modals.my_personal_card') || 'Mi Tarjeta Personal')} (${t('chat_modals.you') || 'Tú'})`,
                public_key: identity.public_key || null,
            } as any);
        }
        if (!searchQuery.trim()) {
            return list;
        }
        const q = searchQuery.toLowerCase().trim();
        return list.filter(c =>
            (c.display_name || "").toLowerCase().includes(q) ||
            (c.identity_hash || "").toLowerCase().includes(q)
        );
    }, [contacts, identity, searchQuery]);

    if (!isOpen || !mounted || typeof document === "undefined") return null;

    return createPortal(
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
            onClick={() => {
                TacticalAudioEngine.playTap();
                onClose();
            }}
        >
            <div
                className="animate-enter modal-card-scrollable"
                style={{
                    width: "100%",
                    maxWidth: "440px",
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
                        <span style={{ fontSize: "1.3rem" }}>👤</span>
                        <div>
                            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#FFFFFF" }}>
                                {t('contact_share.title')}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isFamiliar ? "#00A884" : "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                {t('chat_modals.new_chat_sub')}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            TacticalAudioEngine.playTap();
                            onClose();
                        }}
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

                {/* Search Bar */}
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
                            placeholder={t('contact_share.search_placeholder')}
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "#FFFFFF",
                                fontSize: "0.85rem"
                            }}
                            autoFocus
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

                {/* Contacts List */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 0", minHeight: "220px", maxHeight: "380px" }}>
                    {filteredContacts.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 16px", color: "#8696A0" }}>
                            <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>📭</div>
                            <div style={{ fontSize: "0.85rem" }}>
                                {searchQuery ? t('contact_share.no_matches') : t('contact_share.no_contacts')}
                            </div>
                        </div>
                    ) : (
                        filteredContacts.map((c: any) => {
                            const initial = (c.display_name || c.name || "🔴")[0]?.toUpperCase();
                            const didShort = c.identity_hash ? `${c.identity_hash.substring(0, 10)}...` : "";
                            return (
                                <div
                                    key={c.identity_hash}
                                    onClick={() => {
                                        TacticalAudioEngine.playTap();
                                        onSelectContact(c);
                                        onClose();
                                    }}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "10px 18px",
                                        cursor: "pointer",
                                        transition: "background 0.15s ease",
                                        borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.04)" : "1px solid rgba(255, 255, 255, 0.03)"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = isFamiliar ? "#182229" : "rgba(0, 229, 255, 0.08)"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: "50%",
                                            ...avatarStyle(c.identity_hash || "RED"),
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontWeight: 800,
                                            color: "#FFFFFF",
                                            fontSize: "1rem",
                                            flexShrink: 0
                                        }}>
                                            {initial}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {c.display_name || c.name || `${t('contact_share.operator_prefix')} ${didShort}`}
                                            </div>
                                            <div style={{ fontSize: "0.70rem", color: "#8696A0", fontFamily: "JetBrains Mono, monospace" }}>
                                                DID: {didShort}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        style={{
                                            background: isFamiliar ? "#00A884" : "var(--accent-cyan)",
                                            color: isFamiliar ? "#FFFFFF" : "#000000",
                                            border: "none",
                                            borderRadius: "20px",
                                            padding: "6px 14px",
                                            fontSize: "0.75rem",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            flexShrink: 0
                                        }}
                                    >
                                        {t('contact_share.send_btn')}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ContactShareModal;

import React, { useState } from "react";
import { useRedStore } from "../../store/useRedStore";
import { RED_VERSION } from "../../lib/version";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { avatarStyle } from "./types";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { ContactQrModal } from "../chat/ContactQrModal";
import { NewContactModal } from "../chat/NewContactModal";

export type ChatFilterType = "all" | "unread" | "groups" | "contacts" | "channels";

interface SidebarHeaderProps {
    activeTab: "chats" | "contacts";
    setActiveTab: (tab: "chats" | "contacts") => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    setStoryModal: (modal: "creator" | null) => void;
    setAddContactOpen: (open: boolean) => void;
    setGlobalSearchOpen: (open: boolean) => void;
    menuOpen: boolean;
    setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    totalModules: number;
    filteredConvsCount: number;
    filteredContactsCount: number;
    pendingCount: number;
    chatFilter?: ChatFilterType;
    setChatFilter?: (filter: ChatFilterType) => void;
    unreadTotal?: number;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    setStoryModal,
    setAddContactOpen,
    setGlobalSearchOpen,
    menuOpen,
    setMenuOpen,
    totalModules,
    filteredConvsCount,
    filteredContactsCount,
    pendingCount,
    chatFilter = "all",
    setChatFilter,
    unreadTotal = 0,
}) => {
    const { identity, nodeOnline, navigate, preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') === 'familiar';
    const [quickMenuOpen, setQuickMenuOpen] = useState(false);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [newContactOpen, setNewContactOpen] = useState(false);

    const filters: { id: ChatFilterType; label: string; icon?: string; badge?: number }[] = [
        { id: "all", label: t('common.all') || "Todos" },
        { id: "unread", label: t('common.unread') || "No leídos", badge: unreadTotal },
        { id: "groups", label: t('nav.squads') || "Grupos" },
        { id: "contacts", label: t('sidebar.contacts_header') || "Contactos", badge: pendingCount },
        { id: "channels", label: t('nav.channels') || "Canales" },
    ];

    const handleFilterSelect = (filterId: ChatFilterType) => {
        if (filterId === "contacts") {
            setActiveTab("contacts");
            setChatFilter?.("contacts");
        } else {
            setActiveTab("chats");
            setChatFilter?.(filterId);
        }
    };

    const currentActiveFilter = activeTab === "contacts" ? "contacts" : chatFilter;

    if (isFamiliar) {
        return (
            <>
            <div style={{ flexShrink: 0, zIndex: 10, background: "#111B21" }}>
                {/* ── Top Bar: WhatsApp Web Style ── */}
                <header style={{
                    padding: "0 16px",
                    height: "56px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#202C33",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                    position: "relative"
                }}>
                    {/* Left: User Identity */}
                    <div 
                        style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", minWidth: 0, flex: "1 1 auto" }} 
                        onClick={() => navigate("idVault")}
                        title="Mi Perfil P2P"
                    >
                        <div style={{
                            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 700, color: "#FFFFFF", fontSize: "1rem",
                            ...avatarStyle(identity?.identity_hash || "me")
                        }}>
                            {(identity?.short_id || "O").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#E9EDEF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {identity?.nickname || "Mi Perfil RED"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#8696A0", display: "flex", alignItems: "center", gap: "5px" }}>
                                <span style={{
                                    width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                    background: nodeOnline ? "#00A884" : "#FF3355",
                                    display: "inline-block"
                                }} />
                                <span>{nodeOnline ? `Malla activa (${meshRouter.peers.size})` : "Desconectado"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Authentic Action Icons */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, position: "relative" }}>
                        {/* QR Code Exchange Icon */}
                        <button
                            onClick={() => setQrModalOpen(true)}
                            style={{
                                width: 38, height: 38, borderRadius: "50%",
                                background: "transparent", border: "none",
                                color: "#AEBAC1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.15rem", transition: "background 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            title="Mi Código QR / Escanear"
                        >
                            🪪
                        </button>

                        {/* Status / Stories icon */}
                        <button
                            onClick={() => setStoryModal("creator")}
                            style={{
                                width: 38, height: 38, borderRadius: "50%",
                                background: "transparent", border: "none",
                                color: "#AEBAC1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.1rem", transition: "background 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            title="Estados / Historias"
                        >
                            ⭕
                        </button>

                        {/* New Chat FAB icon */}
                        <button
                            onClick={() => setAddContactOpen(true)}
                            style={{
                                width: 38, height: 38, borderRadius: "50%",
                                background: "transparent", border: "none",
                                color: "#AEBAC1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.1rem", transition: "background 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            title="Nuevo Chat"
                        >
                            💬
                        </button>

                        {/* 3-Dots Menu */}
                        <button
                            onClick={() => setQuickMenuOpen(m => !m)}
                            style={{
                                width: 38, height: 38, borderRadius: "50%",
                                background: quickMenuOpen ? "rgba(255,255,255,0.08)" : "transparent",
                                border: "none", color: "#AEBAC1",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.2rem", transition: "background 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                            onMouseLeave={e => {
                                if (!quickMenuOpen) e.currentTarget.style.background = "transparent";
                            }}
                            title="Más opciones"
                        >
                            ⋮
                        </button>

                        {/* Dropdown Menu (WhatsApp Web Style) */}
                        {quickMenuOpen && (
                            <div 
                                className="animate-fade-scale"
                                style={{
                                    position: "absolute", top: "46px", right: 0, width: "210px",
                                    background: "#233138", borderRadius: "8px",
                                    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
                                    padding: "6px 0", display: "flex", flexDirection: "column",
                                    zIndex: 100
                                }}
                                onClick={e => e.stopPropagation()}
                            >
                                <button
                                    onClick={() => { setQuickMenuOpen(false); navigate("groups"); }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px",
                                        background: "transparent", border: "none",
                                        color: "#D1D7DB", fontSize: "0.86rem", cursor: "pointer", textAlign: "left"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#182229"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <span>👥</span> Nuevo grupo
                                </button>
                                <button
                                    onClick={() => { setQuickMenuOpen(false); setNewContactOpen(true); }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px",
                                        background: "transparent", border: "none",
                                        color: "#D1D7DB", fontSize: "0.86rem", cursor: "pointer", textAlign: "left"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#182229"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <span>👤</span> Nuevo contacto
                                </button>
                                <button
                                    onClick={() => { setQuickMenuOpen(false); navigate("webCompanionLink"); }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px",
                                        background: "transparent", border: "none",
                                        color: "#D1D7DB", fontSize: "0.86rem", cursor: "pointer", textAlign: "left"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#182229"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <span>💻</span> Dispositivos vinculados
                                </button>
                                <button
                                    onClick={() => { setQuickMenuOpen(false); setGlobalSearchOpen(true); }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px",
                                        background: "transparent", border: "none",
                                        color: "#D1D7DB", fontSize: "0.86rem", cursor: "pointer", textAlign: "left"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#182229"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <span>🔍</span> Búsqueda global
                                </button>
                                <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />
                                <button
                                    onClick={() => {
                                        setQuickMenuOpen(false);
                                        updatePreferences({ uiMode: 'tactical' });
                                    }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px",
                                        background: "transparent", border: "none",
                                        color: "#00A884", fontSize: "0.86rem", fontWeight: 600, cursor: "pointer", textAlign: "left"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#182229"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <span>⚡</span> Cambiar a Modo Táctico
                                </button>
                                <button
                                    onClick={() => { setQuickMenuOpen(false); setMenuOpen(true); }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px",
                                        background: "transparent", border: "none",
                                        color: "#8696A0", fontSize: "0.86rem", cursor: "pointer", textAlign: "left"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#182229"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                    <span>🛡️</span> 8 Hubs Tácticos
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                {/* ── Search Bar: WhatsApp Capsule ── */}
                <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", background: "#111B21" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        background: "#202C33", borderRadius: "8px", padding: "7px 12px"
                    }}>
                        <span style={{ fontSize: "0.85rem", color: "#8696A0" }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar un chat o iniciar uno nuevo"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                flex: 1, background: "transparent", border: "none",
                                color: "#E9EDEF", fontSize: "0.84rem", outline: "none"
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                style={{ background: "transparent", border: "none", color: "#8696A0", cursor: "pointer", fontSize: "0.8rem" }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Filter Pills: WhatsApp Rounded ── */}
                <div style={{
                    display: "flex", gap: "8px", overflowX: "auto", padding: "8px 14px 8px 14px",
                    scrollbarWidth: "none", msOverflowStyle: "none",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
                }}>
                    {filters.map(f => {
                        const isSelected = currentActiveFilter === f.id;
                        return (
                            <button
                                key={f.id}
                                onClick={() => handleFilterSelect(f.id)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    padding: "6px 14px", borderRadius: "20px",
                                    background: isSelected ? "#0A332C" : "#202C33",
                                    border: isSelected ? "1px solid #00A884" : "none",
                                    color: isSelected ? "#00A884" : "#8696A0",
                                    fontSize: "0.78rem", fontWeight: isSelected ? 600 : 500,
                                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                                    transition: "all 0.15s ease"
                                }}
                            >
                                <span>{f.label}</span>
                                {typeof f.badge === "number" && f.badge > 0 && (
                                    <span style={{
                                        background: "#25D366", color: "#111B21",
                                        fontSize: "0.65rem", fontWeight: 700,
                                        padding: "1px 6px", borderRadius: "10px"
                                    }}>
                                        {f.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Contact QR Modal */}

            <ContactQrModal
                isOpen={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
            />

            {/* New Contact Modal — direct shortcut */}
            <NewContactModal
                isOpen={newContactOpen}
                onClose={() => setNewContactOpen(false)}
            />
            </>
        );
    }

    // Modo Táctico (Cyberpunk HUD)
    return (
        <div style={{ flexShrink: 0, zIndex: 10, background: "linear-gradient(180deg, rgba(14, 18, 36, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)" }}>
            {/* Top Primary Bar */}
            <header style={{
                padding: "0 14px",
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(0, 229, 255, 0.12)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                position: "relative"
            }}>
                {/* Left: User Identity & Node Connectivity */}
                <div 
                    style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", minWidth: 0, flex: "1 1 auto", overflow: "hidden" }} 
                    onClick={() => navigate("idVault")}
                    title="Bóveda de Identidad Soberana"
                >
                    <div style={{
                        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, color: "#FFFFFF", fontSize: "1rem",
                        border: "2px solid rgba(0, 229, 255, 0.5)",
                        ...avatarStyle(identity?.identity_hash || "me")
                    }}>
                        {(identity?.short_id || "O").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.2px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity?.nickname || "Operador RED"}</span>
                            <span style={{
                                fontSize: "0.56rem", padding: "1px 5px", borderRadius: "5px",
                                background: "rgba(0, 229, 255, 0.15)", color: "var(--accent-cyan, #00E5FF)",
                                border: "1px solid rgba(0, 229, 255, 0.35)", fontWeight: 900,
                                fontFamily: "JetBrains Mono, monospace", flexShrink: 0
                            }}>
                                v{RED_VERSION}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.66rem", color: nodeOnline ? "#00E676" : "#FF3355", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, display: "flex", alignItems: "center", gap: "5px" }}>
                            <span style={{
                                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                background: nodeOnline ? "#00E676" : "#FF3355",
                                display: "inline-block",
                                boxShadow: nodeOnline ? "0 0 8px #00E676" : "0 0 8px #FF3355",
                                animation: nodeOnline ? "beaconPulse 2s infinite" : "none"
                            }} />
                            {nodeOnline ? `MALLA P2P • ${meshRouter.peers.size} ${meshRouter.peers.size === 1 ? 'NODO' : 'NODOS'}` : "NODO LOCAL OFFLINE"}
                        </div>
                    </div>
                </div>

                {/* Right: Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, position: "relative" }}>
                    <button 
                        onClick={() => navigate("webCompanionLink")} 
                        style={{
                            width: 36, height: 36, borderRadius: "10px",
                            background: "rgba(0, 230, 118, 0.12)", border: "1px solid rgba(0, 230, 118, 0.35)",
                            color: "#00E676", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.95rem"
                        }} 
                        title="Vincular con RED Web Companion (PC)"
                    >
                        💻
                    </button>

                    <button 
                        onClick={() => setQuickMenuOpen(m => !m)} 
                        style={{ 
                            width: 36, height: 36, 
                            background: quickMenuOpen ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.06)", 
                            border: "1px solid rgba(255, 255, 255, 0.15)", 
                            color: "#FFFFFF", 
                            borderRadius: "10px", 
                            fontWeight: 900, 
                            fontSize: "1.1rem",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }} 
                        title="Opciones Rápidas"
                    >
                        ⋮
                    </button>

                    {quickMenuOpen && (
                        <div 
                            className="animate-fade-scale"
                            style={{
                                position: "absolute", top: "44px", right: 0, width: "220px",
                                background: "linear-gradient(180deg, #0F1428 0%, #080A18 100%)",
                                border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "14px",
                                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.9), 0 0 20px rgba(0, 229, 255, 0.2)",
                                padding: "6px", display: "flex", flexDirection: "column", gap: "4px",
                                zIndex: 100
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={() => { setQuickMenuOpen(false); navigate("groups"); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                                    background: "transparent", border: "none", borderRadius: "8px",
                                    color: "#FFFFFF", fontSize: "0.82rem", fontWeight: 700,
                                    cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <span>👥</span> Nuevo Escuadrón P2P
                            </button>
                            <button
                                onClick={() => { setQuickMenuOpen(false); setNewContactOpen(true); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                                    background: "transparent", border: "none", borderRadius: "8px",
                                    color: "#FFFFFF", fontSize: "0.82rem", fontWeight: 700,
                                    cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <span>➕</span> Agregar Contacto
                            </button>
                            <button
                                onClick={() => { setQuickMenuOpen(false); navigate("idVault"); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                                    background: "transparent", border: "none", borderRadius: "8px",
                                    color: "#FFFFFF", fontSize: "0.82rem", fontWeight: 700,
                                    cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <span>🪪</span> Bóveda de Identidad DID
                            </button>
                            <button
                                onClick={() => { setQuickMenuOpen(false); setGlobalSearchOpen(true); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                                    background: "transparent", border: "none", borderRadius: "8px",
                                    color: "#FFFFFF", fontSize: "0.82rem", fontWeight: 700,
                                    cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <span>🔍</span> Búsqueda Global
                            </button>
                            <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.1)", margin: "4px 0" }} />
                            <button
                                onClick={() => {
                                    setQuickMenuOpen(false);
                                    updatePreferences({ uiMode: 'familiar' });
                                }}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                                    background: "rgba(0, 168, 132, 0.15)", border: "1px solid rgba(0, 168, 132, 0.35)", borderRadius: "8px",
                                    color: "#00A884", fontSize: "0.82rem", fontWeight: 800,
                                    cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <span>💬</span> Cambiar a Modo Familiar (WhatsApp)
                            </button>
                            <button
                                onClick={() => { setQuickMenuOpen(false); setMenuOpen(true); }}
                                style={{
                                    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
                                    background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "8px",
                                    color: "var(--accent-cyan, #00E5FF)", fontSize: "0.82rem", fontWeight: 900,
                                    cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <span>🛡️</span> Centro de Comando (8 Hubs)
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Filter Chips Bar (Tactical) */}
            <div style={{
                display: "flex", gap: "8px", overflowX: "auto", padding: "8px 14px 10px 14px",
                scrollbarWidth: "none", msOverflowStyle: "none",
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
            }}>
                {filters.map(f => {
                    const isSelected = currentActiveFilter === f.id;
                    return (
                        <button
                            key={f.id}
                            onClick={() => handleFilterSelect(f.id)}
                            style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                padding: "6px 14px", borderRadius: "16px",
                                background: isSelected ? "linear-gradient(135deg, rgba(0, 229, 255, 0.25) 0%, rgba(10, 25, 45, 0.9) 100%)" : "rgba(255, 255, 255, 0.05)",
                                border: isSelected ? "1px solid rgba(0, 229, 255, 0.6)" : "1px solid rgba(255, 255, 255, 0.1)",
                                color: isSelected ? "#00E5FF" : "var(--text-secondary, #A0A5B5)",
                                fontSize: "0.75rem", fontWeight: isSelected ? 900 : 700,
                                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                                transition: "all 0.15s ease",
                                boxShadow: isSelected ? "0 0 12px rgba(0, 229, 255, 0.3)" : "none"
                            }}
                        >
                            <span>{f.label}</span>
                            {typeof f.badge === "number" && f.badge > 0 && (
                                <span style={{
                                    background: "#FF3355", color: "#FFFFFF",
                                    fontSize: "0.58rem", fontWeight: 900,
                                    padding: "1px 6px", borderRadius: "10px",
                                    boxShadow: "0 0 6px #FF3355"
                                }}>
                                    {f.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Contact QR Modal (WhatsApp Style View & Scan) */}
            <ContactQrModal
                isOpen={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
            />

            {/* New Contact Modal — direct shortcut (Tactical mode) */}
            <NewContactModal
                isOpen={newContactOpen}
                onClose={() => setNewContactOpen(false)}
            />
        </div>
    );
};

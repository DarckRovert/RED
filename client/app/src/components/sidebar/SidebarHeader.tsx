import React from "react";
import { useRedStore } from "../../store/useRedStore";
import { RED_VERSION } from "../../lib/version";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { avatarStyle } from "./types";
import { useTranslation } from "../../lib/i18n/i18nEngine";

export type ChatFilterType = "all" | "unread" | "groups" | "channels";

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
    const { identity, nodeOnline, navigate } = useRedStore();
    const { t } = useTranslation();

    const filters: { id: ChatFilterType; label: string; icon: string; badge?: number }[] = [
        { id: "all", label: t('common.all') || "Todos", icon: "💬" },
        { id: "unread", label: unreadTotal > 0 ? `${t('common.unread') || 'No Leídos'} (${unreadTotal})` : (t('common.unread') || "No Leídos"), icon: "🔔", badge: unreadTotal },
        { id: "groups", label: t('nav.squads') || "Escuadrones", icon: "👥" },
        { id: "channels", label: t('nav.channels') || "Canales", icon: "📻" },
    ];

    return (
        <>
            <header style={{
                padding: "0 14px",
                height: "var(--header-h, 56px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid rgba(0, 229, 255, 0.15)",
                background: "linear-gradient(180deg, rgba(14, 18, 36, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0, overflow: "hidden"
            }}>
                <div 
                    style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", minWidth: 0, flex: "1 1 auto", marginRight: "8px", overflow: "hidden" }} 
                    onClick={() => navigate("idVault")}
                    title="Ver Bóveda de Identidad Soberana"
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
                        <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.2px", display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity?.nickname || "Operador RED"}</span>
                            <span style={{
                                fontSize: "0.56rem", padding: "1px 5px", borderRadius: "5px",
                                background: "rgba(255, 51, 85, 0.18)", color: "#FF3355",
                                border: "1px solid rgba(255, 51, 85, 0.4)", fontWeight: 900,
                                fontFamily: "JetBrains Mono, monospace", flexShrink: 0
                            }}>
                                v{RED_VERSION}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.66rem", color: nodeOnline ? "#00E676" : "#FF3355", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <button 
                        onClick={() => setStoryModal("creator")} 
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(0, 229, 255, 0.1)", border: "1px solid rgba(0, 229, 255, 0.3)",
                            color: "var(--accent-cyan, #00E5FF)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.95rem"
                        }} 
                        title="Publicar Estado / Historia Táctica (24h)"
                    >
                        📷
                    </button>
                    <button 
                        onClick={() => setAddContactOpen(true)} 
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 51, 85, 0.12)", border: "1px solid rgba(255, 51, 85, 0.35)",
                            color: "#FF3355", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.95rem", fontWeight: 900
                        }} 
                        title="Agregar Nuevo Contacto P2P"
                    >
                        ➕
                    </button>
                    <button 
                        onClick={() => setGlobalSearchOpen(true)} 
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.12)",
                            color: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.95rem"
                        }} 
                        title="Búsqueda Global en Mensajes y Nodos"
                    >
                        🔍
                    </button>
                    <button 
                        onClick={() => navigate("webCompanionLink")} 
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(0, 230, 118, 0.12)", border: "1px solid rgba(0, 230, 118, 0.35)",
                            color: "#00E676", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.95rem"
                        }} 
                        title="Vincular con RED Web Companion (PC)"
                    >
                        💻
                    </button>
                    <button 
                        onClick={() => setMenuOpen(m => !m)} 
                        style={{ 
                            width: 36, height: 36, 
                            background: menuOpen ? "#00E5FF" : "linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(0, 150, 255, 0.1) 100%)", 
                            border: "1px solid rgba(0, 229, 255, 0.5)", 
                            color: menuOpen ? "#000000" : "#00E5FF", 
                            borderRadius: "10px", 
                            fontWeight: 900, 
                            fontSize: "1.1rem",
                            cursor: "pointer",
                            boxShadow: "0 0 12px rgba(0, 229, 255, 0.25)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            transition: "all 0.15s ease"
                        }} 
                        title={`Centro de Comando (${totalModules} Hubs Tácticos)`}
                    >
                        ☰
                    </button>
                </div>
            </header>

            {/* Barra de Segmented Control & Búsqueda Integrada */}
            <div style={{ padding: "10px 14px 6px 14px", background: "rgba(8, 10, 22, 0.98)", display: "flex", flexDirection: "column", gap: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                {/* Segmented Switcher */}
                <div style={{
                    display: "flex", background: "rgba(16, 20, 38, 0.9)", borderRadius: "14px",
                    padding: "3px", border: "1px solid rgba(255, 255, 255, 0.1)", gap: "4px"
                }}>
                    <button
                        onClick={() => setActiveTab("chats")}
                        style={{
                            flex: 1, padding: "8px 8px", background: activeTab === "chats" ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" : "transparent",
                            color: activeTab === "chats" ? "#FFFFFF" : "var(--text-secondary)",
                            border: "none", borderRadius: "11px",
                            fontWeight: 900, fontSize: "0.74rem", letterSpacing: "0.4px",
                            cursor: "pointer", transition: "all 0.2s ease",
                            boxShadow: activeTab === "chats" ? "0 2px 12px rgba(255, 51, 85, 0.4)" : "none",
                            whiteSpace: "nowrap"
                        }}
                    >
                        {t('dock.chats').toUpperCase()} ({filteredConvsCount})
                    </button>
                    <button
                        onClick={() => setActiveTab("contacts")}
                        style={{
                            flex: 1, padding: "8px 8px", background: activeTab === "contacts" ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" : "transparent",
                            color: activeTab === "contacts" ? "#FFFFFF" : "var(--text-secondary)",
                            border: "none", borderRadius: "11px",
                            fontWeight: 900, fontSize: "0.74rem", letterSpacing: "0.4px",
                            cursor: "pointer", transition: "all 0.2s ease",
                            boxShadow: activeTab === "contacts" ? "0 2px 12px rgba(255, 51, 85, 0.4)" : "none",
                            position: "relative",
                            whiteSpace: "nowrap"
                        }}
                    >
                        {t('sidebar.contacts_header').split(' ')[0] || 'CONTACTOS'} ({filteredContactsCount})
                        {pendingCount > 0 && (
                            <span style={{
                                position: "absolute", top: 2, right: 4,
                                minWidth: 14, height: 14, borderRadius: 7,
                                background: "#FF9100",
                                color: "#000000", fontSize: "0.55rem", fontWeight: 900,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "0 2px",
                                boxShadow: "0 0 8px #FF9100",
                                animation: "pulse 1.5s infinite",
                            }}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => navigate("commandCenter")}
                        style={{
                            flex: "0 0 auto", padding: "8px 12px", background: "rgba(0, 229, 255, 0.12)",
                            color: "var(--accent-cyan, #00E5FF)",
                            border: "1px solid rgba(0, 229, 255, 0.4)", borderRadius: "11px",
                            fontWeight: 900, fontSize: "0.74rem", letterSpacing: "0.4px",
                            cursor: "pointer", transition: "all 0.2s ease",
                            whiteSpace: "nowrap"
                        }}
                    >
                        ⚡ C4ISR
                    </button>
                </div>

                {/* Search Bar Input */}
                <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    background: "rgba(0, 0, 0, 0.5)", border: "1px solid rgba(0, 229, 255, 0.2)",
                    borderRadius: "12px", padding: "8px 12px"
                }}>
                    <span style={{ fontSize: "0.9rem", color: "#00E5FF" }}>🔍</span>
                    <input
                        type="text"
                        placeholder={t('sidebar.search_placeholder')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1, background: "transparent", border: "none",
                            color: "#FFFFFF", fontSize: "0.82rem", outline: "none",
                            fontFamily: "JetBrains Mono, monospace"
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Sub-Filter Pill Bar (Chats View) */}
                {activeTab === "chats" && (
                    <div style={{
                        display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px",
                        scrollbarWidth: "none", msOverflowStyle: "none"
                    }}>
                        {filters.map(f => {
                            const isSelected = chatFilter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setChatFilter?.(f.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "6px",
                                        padding: "5px 12px", borderRadius: "14px",
                                        background: isSelected ? "linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(10, 25, 45, 0.8) 100%)" : "rgba(255, 255, 255, 0.04)",
                                        border: isSelected ? "1px solid rgba(0, 229, 255, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                                        color: isSelected ? "#00E5FF" : "var(--text-secondary)",
                                        fontSize: "0.72rem", fontWeight: isSelected ? 900 : 700,
                                        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                                        transition: "all 0.15s ease",
                                        boxShadow: isSelected ? "0 0 12px rgba(0, 229, 255, 0.25)" : "none"
                                    }}
                                >
                                    <span style={{ fontSize: "0.75rem" }}>{f.icon}</span>
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
                )}
            </div>
        </>
    );
};

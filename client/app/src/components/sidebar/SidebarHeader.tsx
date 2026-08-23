import React from "react";
import { useRedStore } from "../../store/useRedStore";
import { RED_VERSION } from "../../lib/version";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { avatarStyle } from "./types";

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
}) => {
    const { identity, nodeOnline, navigate } = useRedStore();

    return (
        <>
            <header style={{
                padding: "0 12px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0, overflow: "hidden"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", minWidth: 0, flex: "1 1 auto", marginRight: "8px", overflow: "hidden" }} onClick={() => navigate("idVault")}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, color: "#fff", fontSize: "1rem",
                        border: "2px solid var(--glass-border)",
                        ...avatarStyle(identity?.identity_hash || "me")
                    }}>
                        {(identity?.short_id || "O").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#fff", letterSpacing: "0.2px", display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity?.nickname || "Operador RED"}</span>
                            <span className="badge-tactical" style={{ fontSize: "0.56rem", padding: "1px 4px", background: "rgba(232, 33, 58, 0.2)", color: "#FF3355", border: "1px solid rgba(232,33,58,0.4)", flexShrink: 0 }}>
                                v{RED_VERSION}
                            </span>
                        </div>
                        <div style={{ fontSize: "0.66rem", color: nodeOnline ? "var(--accent-emerald)" : "var(--accent-crimson)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <span style={{
                                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                background: nodeOnline ? "var(--accent-emerald)" : "var(--accent-crimson)",
                                display: "inline-block",
                                boxShadow: nodeOnline ? "0 0 8px var(--accent-emerald)" : "none",
                                animation: nodeOnline ? "beaconPulse 2s infinite" : "none"
                            }} />
                            {nodeOnline ? `MALLA • ${meshRouter.peers.size} ${meshRouter.peers.size === 1 ? 'NODO' : 'NODOS'}` : "OFFLINE"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                    <button onClick={() => setStoryModal("creator")} className="btn-icon" style={{ width: 34, height: 34, color: "var(--accent-cyan)", flexShrink: 0 }} title="Publicar Historia / Foto">
                        📷
                    </button>
                    <button onClick={() => setAddContactOpen(true)} className="btn-icon" style={{ width: 34, height: 34, color: "var(--accent-crimson)", flexShrink: 0 }} title="Agregar nuevo contacto">
                        ➕
                    </button>
                    <button onClick={() => setGlobalSearchOpen(true)} className="btn-icon" style={{ width: 34, height: 34, flexShrink: 0 }} title="Búsqueda global">
                        🔍
                    </button>
                    <button onClick={() => navigate("webCompanionLink")} className="btn-icon" style={{ width: 34, height: 34, color: "var(--accent-emerald)", flexShrink: 0 }} title="💻 Vincular con RED Web (PC)">
                        💻
                    </button>
                    <button 
                        onClick={() => setMenuOpen(m => !m)} 
                        className="btn-icon" 
                        style={{ 
                            width: 36, height: 36, 
                            background: menuOpen ? "var(--accent-cyan)" : "rgba(0, 229, 255, 0.15)", 
                            border: "1px solid rgba(0, 229, 255, 0.45)", 
                            color: menuOpen ? "#000" : "var(--accent-cyan)", 
                            borderRadius: "10px", 
                            fontWeight: 900, 
                            fontSize: "1.1rem",
                            boxShadow: "0 0 12px rgba(0, 229, 255, 0.25)",
                            flexShrink: 0
                        }} 
                        title={`Centro de Control (${totalModules} Módulos Tácticos)`}
                    >
                        ☰
                    </button>
                </div>
            </header>


            {/* Barra de Segmented Control & Búsqueda Integrada */}
            <div style={{ padding: "10px 14px 6px 14px", background: "rgba(8,10,20,0.95)", display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Segmented Switcher */}
                <div style={{
                    display: "flex", background: "rgba(20,22,38,0.85)", borderRadius: "var(--radius-full)",
                    padding: "3px", border: "1px solid var(--glass-border)"
                }}>
                    <button
                        onClick={() => setActiveTab("chats")}
                        style={{
                            flex: 1, padding: "8px 12px", background: activeTab === "chats" ? "var(--accent-crimson)" : "transparent",
                            color: activeTab === "chats" ? "#FFF" : "var(--text-secondary)",
                            border: "none", borderRadius: "var(--radius-full)",
                            fontWeight: 800, fontSize: "0.80rem", letterSpacing: "0.4px",
                            cursor: "pointer", transition: "all 0.2s ease",
                            boxShadow: activeTab === "chats" ? "0 2px 10px rgba(232,33,58,0.4)" : "none"
                        }}
                    >
                        CHATS ({filteredConvsCount})
                    </button>
                    <button
                        onClick={() => setActiveTab("contacts")}
                        style={{
                            flex: 1, padding: "8px 12px", background: activeTab === "contacts" ? "var(--accent-crimson)" : "transparent",
                            color: activeTab === "contacts" ? "#FFF" : "var(--text-secondary)",
                            border: "none", borderRadius: "var(--radius-full)",
                            fontWeight: 800, fontSize: "0.80rem", letterSpacing: "0.4px",
                            cursor: "pointer", transition: "all 0.2s ease",
                            boxShadow: activeTab === "contacts" ? "0 2px 10px rgba(232,33,58,0.4)" : "none",
                            position: "relative",
                        }}
                    >
                        CONTACTOS ({filteredContactsCount})
                        {pendingCount > 0 && (
                            <span style={{
                                position: "absolute", top: 2, right: 6,
                                minWidth: 16, height: 16, borderRadius: 8,
                                background: "#FF6B00",
                                color: "#fff", fontSize: "0.60rem", fontWeight: 900,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                padding: "0 3px",
                                boxShadow: "0 0 6px #FF6B00",
                                animation: "pulse 1.5s infinite",
                            }}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Search Bar Input */}
                <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    background: "rgba(18,20,36,0.8)", border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-full)", padding: "7px 12px"
                }}>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Filtrar por nombre o clave pública..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1, background: "transparent", border: "none",
                            color: "#fff", fontSize: "0.82rem", outline: "none"
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
            </div>

        </>
    );
};

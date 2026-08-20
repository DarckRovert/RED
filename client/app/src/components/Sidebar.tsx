"use client";

import React, { useState, useRef, useMemo } from "react";
import { useRedStore, ScreenView } from "../store/useRedStore";
import { toast } from "./Toast";
import { GlobalSearchModal } from "./GlobalSearchModal";
import StoriesBar from "./stories/StoriesBar";
import StoryCreator from "./stories/StoryCreator";
import StoryViewer from "./stories/StoryViewer";
import { LiveStreamViewer } from "./LiveStreamViewer";
import { RED_VERSION, RED_APK_NAME } from "../lib/version";
import { meshRouter } from "../lib/mesh/meshRouter";

const AVATAR_COLORS = [
    ["#FF3355","#C0152A"], ["#FF7043","#E64A19"], ["#FFA726","#F57C00"],
    ["#00E5FF","#00ACC1"], ["#29B6F6","#0288D1"], ["#7E57C2","#5E35B1"],
    ["#00E676","#00897B"], ["#EC407A","#C2185B"],
];

function getAvatarIdx(seed: string): number {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h % 8;
}

function avatarStyle(seed: string) {
    const [a, b] = AVATAR_COLORS[getAvatarIdx(seed)];
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 10px ${a}50` };
}

function formatTime(ts?: number): string {
    if (!ts) return "";
    const ms = ts < 10_000_000_000 ? ts * 1000 : ts;
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Sidebar() {
    const { 
        identity, conversations: rawConvs, contacts: rawConts, groups: rawGrps, nodeOnline, navigate, fetchData,
        pinnedChatIds: rawPinned, archivedChatIds: rawArchived, togglePinChat, toggleArchiveChat, peerStories,
        addContact
    } = useRedStore();

    const conversations = Array.isArray(rawConvs) ? rawConvs : [];
    const contacts = Array.isArray(rawConts) ? rawConts : [];
    const groups = Array.isArray(rawGrps) ? rawGrps : [];
    const pinnedChatIds = Array.isArray(rawPinned) ? rawPinned : [];
    const archivedChatIds = Array.isArray(rawArchived) ? rawArchived : [];

    function resolvePeerName(peerHash: string): string {
        if (!peerHash) return "Contacto P2P";
        const canonical = meshRouter.getCanonicalId(peerHash) || peerHash;
        const g = groups.find((g: any) => g && (g.id === peerHash || g.id === canonical));
        if (g) return g.name || `Grupo ${peerHash.substring(0, 6)}…`;
        const c = contacts.find((c: any) => c && (
            c.identity_hash === peerHash ||
            c.identity_hash === canonical ||
            (canonical.length >= 8 && c.identity_hash?.startsWith(canonical.substring(0, 8))) ||
            (c.identity_hash?.length >= 8 && canonical.startsWith(c.identity_hash.substring(0, 8)))
        ));
        return c?.display_name || `${peerHash.substring(0, 8)}…`;
    }

    const [activeTab, setActiveTab] = useState<"chats" | "contacts">("chats");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [addContactOpen, setAddContactOpen] = useState(false);
    const [newContactInput, setNewContactInput] = useState("");
    const [newContactAlias, setNewContactAlias] = useState("");
    const [isSubmittingContact, setIsSubmittingContact] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [storyModal, setStoryModal] = useState<"creator" | { type: "contact"; hash: string } | { type: "live"; id: string } | null>(null);

    const filteredConvs = useMemo(() => {
        return conversations
            .filter(c => c && c.peer && !c.peer.startsWith("00000000") && resolvePeerName(c.peer || "").toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
                const tsA = (typeof a.last_message === "object" && a.last_message?.timestamp) || (a as any).last_timestamp || 0;
                const tsB = (typeof b.last_message === "object" && b.last_message?.timestamp) || (b as any).last_timestamp || 0;
                const normA = tsA < 1e10 ? tsA : tsA / 1000;
                const normB = tsB < 1e10 ? tsB : tsB / 1000;
                return normB - normA;
            });
    }, [conversations, searchQuery, groups, contacts]);
    const filteredContacts = contacts.filter((c: any) =>
        c && ((c.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.identity_hash || "").toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const menuCategories = [
        {
            title: "💬 Mensajería P2P & Canales",
            items: [
                { icon: "📻", label: "Canales Mesh Locales", action: "channels" },
                { icon: "🌍", label: "RED Social Feed P2P", action: "socialFeed" },
                { icon: "📢", label: "Difusión Privada", action: "broadcast" },
                { icon: "🎙️", label: "Walkie-Talkie Mesh HQ", action: "walkie" },
                { icon: "🎨", label: "Canvas Táctico P2P", action: "canvas" },
                { icon: "📺", label: "Live Broadcast Stream", action: "liveStream" },
            ]
        },
        {
            title: "📡 Red Malla & Radar Off-Grid",
            items: [
                { icon: "📳", label: "Shake & Pair (Acelerómetro)", action: "shakePair" },
                { icon: "🧭", label: "Radar Topográfico GPS", action: "offGridCompass" },
                { icon: "🗺️", label: "Mapa de Nodos P2P", action: "nodemap" },
                { icon: "📡", label: "Radar Hardware BLE/WiFi", action: "nearby" },
                { icon: "🛡️", label: "Analizador Espectro RF / EW", action: "rfSpectrum" },
                { icon: "🌊", label: "Ondas de Proximidad", action: "proximity" },
                { icon: "🌤️", label: "Clima & Barómetro CAP", action: "weather" },
                { icon: "🔋", label: "Batería Eco-Mesh", action: "ecoMesh" },
                { icon: "🌐", label: "Topología de Red", action: "network" },
            ]
        },
        {
            title: "🪪 Identidad, Pagos & Soberanía",
            items: [
                { icon: "⚡", label: "Hub Comercial & Recompensas", action: "commercialHub" },
                { icon: "🦊", label: "Bóveda Web3 & MetaMask", action: "web3Vault" },
                { icon: "🪪", label: "Perfil & Bóveda DID", action: "idVault" },
                { icon: "💳", label: "Pagos & Vouchers P2P", action: "p2pPay" },
                { icon: "🔐", label: "Bóveda Criptográfica PQC", action: "crypto" },
                { icon: "⛓️", label: "Explorador Blockchain", action: "explorer" },
                { icon: "🖼️", label: "Bóveda Esteganográfica", action: "stegoVault" },
                { icon: "💾", label: "Respaldos & Restauración", action: "backup" },
            ]
        },
        {
            title: "🛡️ Ciberdefensa & Escudo Global",
            items: [
                { icon: "🛡️", label: "Escudo Global (DEFCON Matrix)", action: "globalShield" },
                { icon: "⚡", label: "Simulador Apagón Blackout", action: "blackout" },
                { icon: "💀", label: "Hombre Muerto DMS", action: "dms" },
                { icon: "🛡️", label: "Seguridad Zero-Trust", action: "security" },
            ]
        },
        {
            title: "🫀 Emergencias, Salud & Rescate",
            items: [
                { icon: "🫀", label: "Signos Vitales & Triaje START", action: "vitalScan" },
                { icon: "🚨", label: "Baliza Ultrasonido SOS", action: "survivalBeacon" },
                { icon: "🟠", label: "Sistema Alerta AMBER", action: "amber" },
                { icon: "💀", label: "Hombre Muerto DMS", action: "dms" },
                { icon: "⚡", label: "Simulador Apagón Blackout", action: "blackout" },
            ]
        },
        {
            title: "🤖 Inteligencia Artificial Neuronal",
            items: [
                { icon: "🤖", label: "Copiloto IA Offline", action: "aiCopilot" },
                { icon: "🛡️", label: "Guardian IA (Firewall)", action: "guardian" },
            ]
        },
        {
            title: "⚙️ Herramientas, Sistema & Camuflaje",
            items: [
                { icon: "⚙️", label: "Ajustes & Personalización", action: "settings" },
                { icon: "🚀", label: "Actualizador de Software (OTA)", action: "updater" },
                { icon: "📊", label: "Diagnóstico Salud Sistema", action: "health" },
                { icon: "📋", label: "Logs del Nodo Rust SSE", action: "nodeLogs" },
                { icon: "🧮", label: "Calculadora Señuelo", action: "calculator" },
                { icon: "📑", label: "Reporte Auditoría Seguridad", action: "secReport" },
                { icon: "🛡️", label: "Seguridad Zero-Trust", action: "security" },
            ]
        }
    ];

    const [drawerSearch, setDrawerSearch] = useState("");
    const filteredMenuCategories = useMemo(() => {
        if (!drawerSearch.trim()) return menuCategories;
        const q = drawerSearch.toLowerCase();
        return menuCategories.map(cat => ({
            ...cat,
            items: cat.items.filter(i => i.label.toLowerCase().includes(q))
        })).filter(cat => cat.items.length > 0);
    }, [drawerSearch]);

    const totalModules = menuCategories.reduce((acc, cat) => acc + cat.items.length, 0);

    return (
        <aside style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "var(--bg-void)", position: "relative", overflow: "hidden" }}>

            {/* Tactical Slide-Over Command Drawer */}
            {menuOpen && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", display: "flex", justifyContent: "flex-end" }}
                    onClick={() => setMenuOpen(false)}
                >
                    <div
                        className="animate-enter"
                        style={{
                            width: "100%", maxWidth: "360px", height: "100%",
                            background: "linear-gradient(180deg, rgba(14, 16, 28, 0.98) 0%, rgba(6, 8, 16, 0.99) 100%)",
                            borderLeft: "1px solid var(--glass-border)",
                            boxShadow: "-12px 0 40px rgba(0,0,0,0.85)",
                            display: "flex", flexDirection: "column",
                            paddingTop: "var(--safe-top, 0px)",
                            paddingBottom: "var(--safe-bottom, 0px)",
                            overflow: "hidden"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div style={{ padding: "16px 20px 12px 20px", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ fontSize: "1.4rem" }}>🛡️</span>
                                <div>
                                    <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#fff", letterSpacing: "0.5px" }}>Centro de Control RED</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                                        {totalModules} MÓDULOS ACTIVOS
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setMenuOpen(false)}
                                className="btn-icon"
                                style={{ width: 34, height: 34, fontSize: "0.9rem" }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Drawer Search Filter */}
                        <div style={{ padding: "12px 16px 8px 16px", flexShrink: 0 }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
                                borderRadius: "var(--radius-md)", padding: "8px 12px"
                            }}>
                                <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>🔍</span>
                                <input
                                    type="text"
                                    value={drawerSearch}
                                    onChange={e => setDrawerSearch(e.target.value)}
                                    placeholder="Buscar módulo o herramienta..."
                                    style={{
                                        flex: 1, background: "transparent", border: "none", outline: "none",
                                        color: "var(--text-primary)", fontSize: "0.82rem"
                                    }}
                                />
                                {drawerSearch && (
                                    <button onClick={() => setDrawerSearch("")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
                                )}
                            </div>
                        </div>

                        {/* Modules Scrollable Area */}
                        <div className="scroll-container" style={{ flex: 1, padding: "8px 16px 16px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            {filteredMenuCategories.map((cat: { title: string; items: Array<{ icon: string; label: string; action: string }> }) => (
                                <div key={cat.title} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{
                                        fontSize: "0.68rem", color: "var(--accent-emerald)", textTransform: "uppercase",
                                        fontWeight: 900, padding: "4px 8px", background: "rgba(0,230,118,0.06)",
                                        borderRadius: "6px", fontFamily: "JetBrains Mono, monospace",
                                        display: "flex", justifyContent: "space-between", alignItems: "center"
                                    }}>
                                        <span>{cat.title}</span>
                                        <span style={{ opacity: 0.7 }}>{cat.items.length}</span>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4px" }}>
                                        {cat.items.map((item: { icon: string; label: string; action: string }) => (
                                            <button
                                                key={item.action}
                                                onClick={e => { e.preventDefault(); navigate(item.action as ScreenView); setMenuOpen(false); }}
                                                className="card-tactical-interactive"
                                                style={{
                                                    display: "flex", alignItems: "center", gap: "12px",
                                                    padding: "10px 12px", background: "rgba(18, 20, 36, 0.6)",
                                                    border: "1px solid rgba(255,255,255,0.06)", borderRadius: "var(--radius-sm)",
                                                    fontSize: "0.84rem", fontWeight: 700, textAlign: "left"
                                                }}
                                            >
                                                <span style={{ fontSize: "1.1rem", width: 24, textAlign: "center" }}>{item.icon}</span>
                                                <span style={{ flex: 1, color: "var(--text-primary)" }}>{item.label}</span>
                                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", opacity: 0.5 }}>›</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Drawer Footer */}
                        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--glass-border)", background: "rgba(10,12,22,0.9)", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                <button
                                    onClick={() => { setMenuOpen(false); navigate("settings"); }}
                                    className="btn-tactical-secondary"
                                    style={{
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        padding: "10px 8px", fontSize: "0.76rem", fontWeight: 800
                                    }}
                                >
                                    <span>⚙️</span> Ajustes
                                </button>
                                <button
                                    onClick={() => { setMenuOpen(false); navigate("updater"); }}
                                    className="btn-tactical-primary"
                                    style={{
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        padding: "10px 8px", fontSize: "0.76rem", fontWeight: 900
                                    }}
                                >
                                    <span>🚀</span> Actualizador
                                </button>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>v{RED_VERSION}</span>
                                <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>● LIBP2P MESH</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Táctico Principal */}
            <header style={{
                padding: "0 16px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }} onClick={() => navigate("idVault")}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, color: "#fff", fontSize: "1rem",
                        border: "2px solid var(--glass-border)",
                        ...avatarStyle(identity?.identity_hash || "me")
                    }}>
                        {(identity?.short_id || "O").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", letterSpacing: "0.2px" }}>
                            {identity?.nickname || "Operador RED"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: nodeOnline ? "var(--accent-emerald)" : "var(--accent-crimson)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: nodeOnline ? "var(--accent-emerald)" : "var(--accent-crimson)", display: "inline-block", boxShadow: nodeOnline ? "0 0 6px var(--accent-emerald)" : "none" }} />
                            {nodeOnline ? "MALLA ACTIVA" : "OFFLINE"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button onClick={() => setAddContactOpen(true)} className="btn-icon" style={{ width: 38, height: 38, color: "var(--accent-crimson)" }} title="Agregar nuevo contacto">
                        ➕
                    </button>
                    <button onClick={() => setGlobalSearchOpen(true)} className="btn-icon" style={{ width: 38, height: 38 }} title="Búsqueda global">
                        🔍
                    </button>
                    <button onClick={() => navigate("radar")} className="btn-icon" style={{ width: 38, height: 38 }} title="Radar de pares">
                        📡
                    </button>
                    <button onClick={() => setMenuOpen(m => !m)} className="btn-icon" style={{ width: 38, height: 38 }} title="Centro de control">
                        ☰
                    </button>
                </div>
            </header>

            {/* Stories Bar (24h Ephemeral & Live Video Streams) */}
            <StoriesBar
                onMyStory={() => setStoryModal("creator")}
                onContactStory={hash => setStoryModal({ type: "contact", hash })}
                onLiveStream={id => setStoryModal({ type: "live", id })}
            />

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
                        CHATS ({filteredConvs.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("contacts")}
                        style={{
                            flex: 1, padding: "8px 12px", background: activeTab === "contacts" ? "var(--accent-crimson)" : "transparent",
                            color: activeTab === "contacts" ? "#FFF" : "var(--text-secondary)",
                            border: "none", borderRadius: "var(--radius-full)",
                            fontWeight: 800, fontSize: "0.80rem", letterSpacing: "0.4px",
                            cursor: "pointer", transition: "all 0.2s ease",
                            boxShadow: activeTab === "contacts" ? "0 2px 10px rgba(232,33,58,0.4)" : "none"
                        }}
                    >
                        CONTACTOS ({filteredContacts.length})
                    </button>
                </div>

                {/* Search Bar Input */}
                <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-md)", padding: "7px 12px"
                }}>
                    <span style={{ fontSize: "0.85rem", opacity: 0.5 }}>🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filtrar mensajes o identificadores..."
                        style={{
                            flex: 1, background: "transparent", border: "none", outline: "none",
                            color: "var(--text-primary)", fontSize: "0.84rem"
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                    )}
                </div>
            </div>

            {/* Main List */}
            <div className="scroll-container" style={{ flex: 1, padding: "8px 12px 80px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {activeTab === "chats" ? (
                    filteredConvs.length === 0 ? (
                        <div className="empty-state-tactical">
                            <div className="empty-state-icon">💬</div>
                            <div className="empty-state-title">{searchQuery ? "Sin resultados" : "Sin Conversaciones Activas"}</div>
                            <div className="empty-state-desc">{searchQuery ? `No hay coincidencias para "${searchQuery}".` : "Usa el radar o escanea un código QR para iniciar un chat Noise E2E cifrado."}</div>
                        </div>
                    ) : (
                        filteredConvs.map(c => {
                            const rawTs = (typeof c.last_message === "object" && c.last_message?.timestamp) || (c as any).last_timestamp;
                            const lm = c.last_message;
                            let snippet = "Mensaje cifrado";
                            if (lm) {
                                const msgType = typeof lm === "object" ? lm.msg_type : null;
                                const content = typeof lm === "object" ? lm.content : lm;
                                const isOwn = typeof lm === "object" && (lm as any).is_mine;
                                const prefix = isOwn ? "Tú: " : "";
                                if (msgType === "image" || content?.startsWith("data:image")) snippet = prefix + "📷 Foto";
                                else if (msgType === "voice" || msgType === "audio" || content?.startsWith("data:audio")) snippet = prefix + "🎤 Nota de voz";
                                else if (msgType === "video" || content?.startsWith("data:video")) snippet = prefix + "📹 Video";
                                else if (msgType === "location" || content?.includes("Ubicación Táctica")) snippet = prefix + "📍 Ubicación";
                                else if (msgType === "poll") snippet = prefix + "📊 Encuesta";
                                else if (content && !content.startsWith("data:") && !content.startsWith("[")) {
                                    const truncated = content.length > 38 ? content.substring(0, 38) + "…" : content;
                                    snippet = prefix + truncated;
                                }
                            }
                            return (

                            <div
                                key={c.peer}
                                onClick={() => navigate("chat", c.peer)}
                                className="card-tactical-interactive"
                                style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px" }}
                            >
                                <div style={{
                                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "1.1rem", fontWeight: 800, color: "#fff",
                                    ...avatarStyle(c.peer)
                                }}>
                                    {resolvePeerName(c.peer).charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, overflow: "hidden" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {resolvePeerName(c.peer)}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {rawTs ? formatTime(rawTs) : ""}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                                        {snippet}
                                    </div>
                                </div>
                                {(c.unread_count || 0) > 0 && (
                                    <span className="badge-tactical badge-tactical-cyan" style={{ borderRadius: "var(--radius-full)", padding: "2px 8px" }}>
                                        {c.unread_count}
                                    </span>
                                )}
                            </div>
                            );
                        })
                    )
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <button
                            onClick={() => setAddContactOpen(true)}
                            className="btn-tactical-primary"
                            style={{
                                width: "100%", padding: "10px 12px", fontSize: "0.82rem", fontWeight: 800,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                borderRadius: "var(--radius-md)"
                            }}
                        >
                            <span>➕</span> AGREGAR NUEVO CONTACTO P2P
                        </button>
                        {filteredContacts.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">👥</div>
                                <div className="empty-state-title">Sin Contactos Guardados</div>
                                <div className="empty-state-desc">Agrega el DID o hash de un nodo para iniciar un chat cifrado E2E.</div>
                            </div>
                        ) : (
                            filteredContacts.map(ct => (
                                <div
                                    key={ct.identity_hash}
                                    onClick={() => {
                                        setActiveTab("chats");
                                        navigate("chat", ct.identity_hash);
                                    }}
                                    className="card-tactical-interactive"
                                    style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px" }}
                                >
                                    <div style={{
                                        width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: "1.1rem", fontWeight: 800, color: "#fff",
                                        ...avatarStyle(ct.identity_hash)
                                    }}>
                                        {(ct.display_name || "O").charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, overflow: "hidden" }}>
                                        <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "#fff" }}>
                                            {ct.display_name || ct.identity_hash.substring(0, 8)}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {ct.identity_hash.substring(0, 16)}…
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Modal para Agregar Contacto */}
            {addContactOpen && (
                <div 
                    style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
                        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "16px"
                    }}
                    onClick={() => setAddContactOpen(false)}
                >
                    <div 
                        className="card-tactical animate-enter"
                        style={{
                            maxWidth: "460px", width: "100%", padding: "24px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            border: "1px solid var(--glass-border)", background: "rgba(12,14,24,0.98)"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#fff" }}>
                                ➕ Agregar Contacto / Nuevo Chat
                            </div>
                            <button onClick={() => setAddContactOpen(false)} className="btn-icon" style={{ width: 32, height: 32 }}>✕</button>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                            Pega el DID Soberano, Hash (64 hex) o Identificador de tu contacto (Web, Móvil o Nodo Malla).
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: "4px", display: "block", letterSpacing: "0.5px" }}>
                                    IDENTIFICADOR / DID / HASH
                                </label>
                                <input
                                    value={newContactInput}
                                    onChange={e => setNewContactInput(e.target.value)}
                                    placeholder="Ej: did:red:af10... o red_a1b2c3d4"
                                    style={{ width: "100%", fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem", padding: "10px 12px" }}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: "4px", display: "block", letterSpacing: "0.5px" }}>
                                    ALIAS / NOMBRE TÁCTICO
                                </label>
                                <input
                                    value={newContactAlias}
                                    onChange={e => setNewContactAlias(e.target.value)}
                                    placeholder="Ej: Alfa-1 Web, Operador Base..."
                                    style={{ width: "100%", fontSize: "0.85rem", padding: "10px 12px" }}
                                />
                            </div>
                            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                                <button
                                    onClick={() => setAddContactOpen(false)}
                                    className="btn-tactical-secondary"
                                    style={{ flex: 1, padding: "12px", fontSize: "0.85rem" }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={!newContactInput.trim() || isSubmittingContact}
                                    onClick={async () => {
                                        const input = newContactInput.trim();
                                        const alias = newContactAlias.trim();
                                        setIsSubmittingContact(true);
                                        try {
                                            const cleanHash = await addContact(input, alias);
                                            setAddContactOpen(false);
                                            setNewContactInput("");
                                            setNewContactAlias("");
                                            toast.success("✅ Contacto añadido. Iniciando chat P2P...");
                                            const targetChat = (typeof cleanHash === 'string' && cleanHash) ? cleanHash : input;
                                            setActiveTab("chats");
                                            navigate("chat", targetChat);
                                        } catch (err: any) {
                                            toast.error(`❌ Error: ${err?.message || err}`);
                                        } finally {
                                            setIsSubmittingContact(false);
                                        }
                                    }}
                                    className="btn-tactical-primary"
                                    style={{ flex: 2, padding: "12px", fontSize: "0.88rem", fontWeight: 900 }}
                                >
                                    {isSubmittingContact ? "Conectando..." : "⚡ CREAR CHAT"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Search Modal */}
            {globalSearchOpen && <GlobalSearchModal onClose={() => setGlobalSearchOpen(false)} />}

            {/* Story Modals */}
            {storyModal === "creator" && <StoryCreator onClose={() => setStoryModal(null)} />}
            {typeof storyModal === "object" && storyModal?.type === "contact" && (
                <StoryViewer
                    stories={peerStories?.[storyModal.hash] ?? []}
                    senderName={resolvePeerName(storyModal.hash)}
                    senderHash={storyModal.hash}
                    onClose={() => setStoryModal(null)}
                />
            )}
            {typeof storyModal === "object" && storyModal?.type === "live" && (
                <LiveStreamViewer
                    streamId={storyModal.id}
                    onClose={() => setStoryModal(null)}
                />
            )}
        </aside>
    );
}

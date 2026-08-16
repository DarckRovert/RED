"use client";

import React, { useState, useRef } from "react";
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
        pinnedChatIds: rawPinned, archivedChatIds: rawArchived, togglePinChat, toggleArchiveChat, peerStories
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
    const [menuOpen, setMenuOpen] = useState(false);
    const [storyModal, setStoryModal] = useState<"creator" | { type: "contact"; hash: string } | { type: "live"; id: string } | null>(null);

    const filteredConvs = conversations.filter(c =>
        c && c.peer && !c.peer.startsWith("00000000") && resolvePeerName(c.peer || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
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
                { icon: "🪪", label: "Perfil & Bóveda DID", action: "idVault" },
                { icon: "💳", label: "Pagos & Vouchers P2P", action: "p2pPay" },
                { icon: "🔐", label: "Bóveda Criptográfica PQC", action: "crypto" },
                { icon: "⛓️", label: "Explorador Blockchain", action: "explorer" },
                { icon: "🖼️", label: "Bóveda Esteganográfica", action: "stegoVault" },
                { icon: "💾", label: "Respaldos & Restauración", action: "backup" },
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
                { icon: "📊", label: "Diagnóstico Salud Sistema", action: "health" },
                { icon: "📋", label: "Logs del Nodo Rust SSE", action: "nodeLogs" },
                { icon: "🧮", label: "Calculadora Señuelo", action: "calculator" },
                { icon: "📑", label: "Reporte Auditoría Seguridad", action: "secReport" },
                { icon: "🛡️", label: "Seguridad Zero-Trust", action: "security" },
            ]
        }
    ];

    const totalModules = menuCategories.reduce((acc, cat) => acc + cat.items.length, 0);

    return (
        <aside style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "var(--bg-void)", position: "relative", overflow: "hidden" }}>

            {/* Context Drawer Menu */}
            {menuOpen && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
                    onClick={() => setMenuOpen(false)}
                >
                    <div
                        className="card-tactical animate-enter"
                        style={{
                            position: "absolute", top: "calc(64px + var(--safe-top, 0px))", right: 12, width: 300,
                            maxHeight: "calc(100vh - 100px)", overflowY: "auto",
                            borderRadius: "var(--radius-lg)", padding: "14px",
                            boxShadow: "0 16px 48px rgba(0,0,0,0.9)"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: "4px 8px 10px", borderBottom: "1px solid var(--glass-border)", marginBottom: "10px" }}>
                            <div style={{ fontSize: "0.72rem", color: "var(--accent-emerald)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 900, fontFamily: "JetBrains Mono, monospace" }}>
                                🛡️ Módulos Tácticos RED ({totalModules})
                            </div>
                        </div>
                        {menuCategories.map(cat => (
                            <div key={cat.title} style={{ marginBottom: "12px" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, padding: "4px 8px", marginBottom: "4px", background: "rgba(255,255,255,0.03)", borderRadius: "4px" }}>
                                    {cat.title}
                                </div>
                                {cat.items.map(item => (
                                    <button
                                        key={item.action}
                                        onClick={e => { e.preventDefault(); navigate(item.action as ScreenView); setMenuOpen(false); }}
                                        style={{
                                            width: "100%", display: "flex", alignItems: "center", gap: "10px",
                                            padding: "8px 10px", background: "transparent", color: "var(--text-primary)",
                                            border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
                                            fontSize: "0.85rem", fontWeight: 600, textAlign: "left"
                                        }}
                                    >
                                        <span style={{ fontSize: "1rem", width: 22, textAlign: "center" }}>{item.icon}</span>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        ))}
                        <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <a
                                href={`https://github.com/DarckRovert/RED/releases/download/v${RED_VERSION}/${RED_APK_NAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                    padding: "8px 12px", background: "linear-gradient(90deg, #E8213A 0%, #990014 100%)",
                                    color: "#FFF", borderRadius: "var(--radius-sm)", textDecoration: "none",
                                    fontSize: "0.78rem", fontWeight: 800, textAlign: "center",
                                    boxShadow: "0 4px 12px rgba(232,33,58,0.3)"
                                }}
                            >
                                <span>📥</span> Descargar APK Android (v{RED_VERSION})
                            </a>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>RED v{RED_VERSION}</span>
                                <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>SOVEREIGN MASTER</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Táctico */}
            <header style={{
                padding: "0 16px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }} onClick={() => navigate("idVault")}>
                    <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, color: "#fff", fontSize: "1rem", cursor: "pointer",
                        border: "2px solid var(--glass-border)",
                        ...avatarStyle(identity?.identity_hash || "me")
                    }}>
                        {(identity?.short_id || "O").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff" }}>
                            {identity?.nickname || "Operador RED"}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: nodeOnline ? "var(--accent-emerald)" : "var(--accent-crimson)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {nodeOnline ? "● MALLA ACTIVA (P2P)" : "○ DESCONECTADO"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => setGlobalSearchOpen(true)} className="btn-icon" style={{ width: 36, height: 36 }} title="Búsqueda global">
                        🔍
                    </button>
                    <button onClick={() => navigate("radar")} className="btn-icon" style={{ width: 36, height: 36 }} title="Radar de pares">
                        📡
                    </button>
                    <button onClick={() => setMenuOpen(m => !m)} className="btn-icon" style={{ width: 36, height: 36 }} title="Menú de herramientas">
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

            {/* Barra de Búsqueda Integrada Táctica */}
            <div style={{ padding: "8px 12px 4px 12px", background: "rgba(8,10,20,0.95)" }}>
                <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-md)", padding: "6px 12px"
                }}>
                    <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Filtrar chats y contactos..."
                        style={{
                            flex: 1, background: "transparent", border: "none", outline: "none",
                            color: "var(--text-primary)", fontSize: "0.82rem"
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                    )}
                </div>
            </div>

            {/* Tabs: Chats vs Contactos */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--glass-border)", background: "rgba(8,10,20,0.9)", flexShrink: 0 }}>
                <button
                    onClick={() => setActiveTab("chats")}
                    style={{
                        flex: 1, padding: "12px", background: "transparent", border: "none",
                        color: activeTab === "chats" ? "var(--accent-cyan)" : "var(--text-muted)",
                        fontWeight: 800, fontSize: "0.85rem",
                        borderBottom: activeTab === "chats" ? "2px solid var(--accent-cyan)" : "2px solid transparent"
                    }}
                >
                    CHATS CIFRADOS ({filteredConvs.length})
                </button>
                <button
                    onClick={() => setActiveTab("contacts")}
                    style={{
                        flex: 1, padding: "12px", background: "transparent", border: "none",
                        color: activeTab === "contacts" ? "var(--accent-cyan)" : "var(--text-muted)",
                        fontWeight: 800, fontSize: "0.85rem",
                        borderBottom: activeTab === "contacts" ? "2px solid var(--accent-cyan)" : "2px solid transparent"
                    }}
                >
                    CONTACTOS ({filteredContacts.length})
                </button>
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
                    filteredContacts.length === 0 ? (
                        <div className="empty-state-tactical">
                            <div className="empty-state-icon">👥</div>
                            <div className="empty-state-title">Sin Contactos Guardados</div>
                            <div className="empty-state-desc">Tus pares verificados aparecerán en esta libreta soberana.</div>
                        </div>
                    ) : (
                        filteredContacts.map(ct => (
                            <div
                                key={ct.identity_hash}
                                onClick={() => navigate("chat", ct.identity_hash)}
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
                    )
                )}
            </div>

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

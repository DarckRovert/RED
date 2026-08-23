'use client';

import React, { useState, useMemo } from "react";
import { useRedStore, ScreenView } from "../store/useRedStore";
import { toast } from "./Toast";
import { GlobalSearchModal } from "./GlobalSearchModal";
import StoriesBar from "./stories/StoriesBar";
import StoryCreator from "./stories/StoryCreator";
import StoryViewer from "./stories/StoryViewer";
import { LiveStreamViewer } from "./LiveStreamViewer";
import { RED_VERSION, RED_APK_NAME } from "../lib/version";
import { meshRouter } from "../lib/mesh/meshRouter";
import { WebCompanionPairConfirmationModal } from "./WebCompanionPairConfirmationModal";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { avatarStyle, formatTime } from "./sidebar/types";
import { SidebarHeader } from "./sidebar/SidebarHeader";
import { ConversationList } from "./sidebar/ConversationList";
import { ContactList } from "./sidebar/ContactList";

export default function Sidebar() {
    const { t } = useTranslation();
    const { 
        identity, conversations: rawConvs, contacts: rawConts, groups: rawGrps, nodeOnline, navigate, fetchData,
        pinnedChatIds: rawPinned, archivedChatIds: rawArchived, togglePinChat, toggleArchiveChat, peerStories,
        addContact, deleteContact, blockNode, pendingContactRequests: rawPending,
        acceptContactRequest, rejectContactRequest,
    } = useRedStore();

    const conversations = Array.isArray(rawConvs) ? rawConvs : [];
    const contacts = Array.isArray(rawConts) ? rawConts : [];
    const groups = Array.isArray(rawGrps) ? rawGrps : [];
    const pinnedChatIds = Array.isArray(rawPinned) ? rawPinned : [];
    const archivedChatIds = Array.isArray(rawArchived) ? rawArchived : [];
    const pendingContactRequests = Array.isArray(rawPending) ? rawPending : [];
    const pendingCount = pendingContactRequests.length;

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
        if (c?.display_name && !c.display_name.startsWith('Operador ') && !c.display_name.startsWith('Nodo ') && !c.display_name.startsWith('Par Escaneado')) {
            return c.display_name;
        }
        const meshPeer = meshRouter.getPeerByAnyId(peerHash) || (canonical ? meshRouter.getPeerByAnyId(canonical) : undefined);
        if (meshPeer?.name && !meshPeer.name.startsWith('RED-') && !meshPeer.name.startsWith('Operador ') && !meshPeer.name.startsWith('Dispositivo RED')) {
            return meshPeer.name;
        }
        return c?.display_name || meshPeer?.name || `${peerHash.substring(0, 8)}…`;
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
    const [webPairingCode, setWebPairingCode] = useState<string | null>(null);
    const [storyModal, setStoryModal] = useState<"creator" | { type: "contact"; hash: string } | { type: "live"; id: string } | null>(null);

    const filteredConvs = useMemo(() => {
        return conversations
            .filter(c => c && c.peer && !c.peer.startsWith("00000000") && resolvePeerName(c.peer || "").toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a: any, b: any) => {
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
            title: t('modules.cat_messaging'),
            items: [
                { icon: "📻", label: t('modules.channels'), action: "channels" },
                { icon: "🌍", label: t('modules.social_feed'), action: "socialFeed" },
                { icon: "📢", label: t('modules.broadcast'), action: "broadcast" },
                { icon: "🎙️", label: t('modules.walkie'), action: "walkie" },
                { icon: "🎨", label: t('modules.canvas'), action: "canvas" },
                { icon: "📺", label: t('modules.live_stream'), action: "liveStream" },
            ]
        },
        {
            title: t('modules.cat_mesh_radar'),
            items: [
                { icon: "📳", label: t('modules.shake_pair'), action: "shakePair" },
                { icon: "🧭", label: t('modules.off_grid_compass'), action: "offGridCompass" },
                { icon: "🗺️", label: t('modules.nodemap'), action: "nodemap" },
                { icon: "📡", label: t('modules.nearby'), action: "nearby" },
                { icon: "🛡️", label: t('modules.rf_spectrum'), action: "rfSpectrum" },
                { icon: "🌊", label: t('modules.proximity'), action: "proximity" },
                { icon: "🌤️", label: t('modules.weather'), action: "weather" },
                { icon: "🔋", label: t('modules.eco_mesh'), action: "ecoMesh" },
                { icon: "🌐", label: t('modules.network'), action: "network" },
            ]
        },
        {
            title: t('modules.cat_identity_web3'),
            items: [
                { icon: "⚡", label: t('modules.commercial_hub'), action: "commercialHub" },
                { icon: "🦊", label: t('modules.web3_vault'), action: "web3Vault" },
                { icon: "🪪", label: t('modules.id_vault'), action: "idVault" },
                { icon: "💳", label: t('modules.p2p_pay'), action: "p2pPay" },
                { icon: "🔐", label: t('modules.crypto'), action: "crypto" },
                { icon: "⛓️", label: t('modules.explorer'), action: "explorer" },
                { icon: "💻", label: t('modules.companion_link'), action: "webCompanionLink" },
                { icon: "🖼️", label: t('modules.stego_vault'), action: "stegoVault" },
                { icon: "💾", label: t('modules.backup'), action: "backup" },
            ]
        },
        {
            title: t('modules.cat_defense_shield'),
            items: [
                { icon: "🛡️", label: t('modules.global_shield'), action: "globalShield" },
                { icon: "⚡", label: t('modules.blackout'), action: "blackout" },
                { icon: "💀", label: t('modules.dms'), action: "dms" },
                { icon: "🛡️", label: t('modules.security'), action: "security" },
            ]
        },
        {
            title: t('modules.cat_emergency_health'),
            items: [
                { icon: "🫀", label: t('modules.vital_scan'), action: "vitalScan" },
                { icon: "🚨", label: t('modules.survival_beacon'), action: "survivalBeacon" },
                { icon: "🟠", label: t('modules.amber'), action: "amber" },
                { icon: "💀", label: t('modules.dms'), action: "dms" },
                { icon: "⚡", label: t('modules.blackout'), action: "blackout" },
            ]
        },
        {
            title: t('modules.cat_ai'),
            items: [
                { icon: "🤖", label: t('modules.ai_copilot'), action: "aiCopilot" },
                { icon: "🛡️", label: t('modules.guardian'), action: "guardian" },
            ]
        },
        {
            title: t('modules.cat_tools_system'),
            items: [
                { icon: "⚙️", label: t('modules.settings'), action: "settings" },
                { icon: "🚀", label: t('modules.updater'), action: "updater" },
                { icon: "📊", label: t('modules.health'), action: "health" },
                { icon: "📋", label: t('modules.node_logs'), action: "nodeLogs" },
                { icon: "🧮", label: t('modules.calculator'), action: "calculator" },
                { icon: "📑", label: t('modules.sec_report'), action: "secReport" },
                { icon: "🛡️", label: t('modules.security'), action: "security" },
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
                        <div className="scroll-container" style={{ flex: 1, padding: "8px 16px 36px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
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


            <SidebarHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setStoryModal={setStoryModal}
                setAddContactOpen={setAddContactOpen}
                setGlobalSearchOpen={setGlobalSearchOpen}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                totalModules={totalModules}
                filteredConvsCount={filteredConvs.length}
                filteredContactsCount={filteredContacts.length}
                pendingCount={pendingCount}
            />

            {/* Stories Bar (24h Ephemeral & Live Video Streams) */}
            <StoriesBar
                onMyStory={() => setStoryModal("creator")}
                onContactStory={hash => setStoryModal({ type: "contact", hash })}
                onLiveStream={id => setStoryModal({ type: "live", id })}
            />

            {/* Main Scrollable Content */}
            <div className="scroll-container" style={{ flex: 1, padding: "8px 12px 28px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {activeTab === "chats" ? (
                    <ConversationList
                        filteredConvs={filteredConvs}
                        resolvePeerName={resolvePeerName}
                    />
                ) : (
                    <ContactList
                        filteredContacts={filteredContacts}
                        pendingContactRequests={pendingContactRequests}
                        pendingCount={pendingCount}
                        setActiveTab={setActiveTab}
                        setAddContactOpen={setAddContactOpen}
                    />
                )}
            </div>

            {/* ── Fixed Bottom Tactical HUD Dock (6 Key Modules) ── */}
            <nav style={{
                position: "sticky", bottom: 0, left: 0, right: 0,
                minHeight: "58px",
                background: "linear-gradient(180deg, rgba(14, 16, 30, 0.95) 0%, rgba(6, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderTop: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "space-around",
                padding: "4px 4px max(6px, env(safe-area-inset-bottom, 6px)) 4px",
                zIndex: 40, flexShrink: 0
            }}>
                {[
                    { id: "chats", icon: "💬", label: "Chats", action: () => { setMenuOpen(false); setActiveTab("chats"); }, active: activeTab === "chats" && !menuOpen },
                    { id: "radar", icon: "📡", label: "Radar", action: () => { setMenuOpen(false); navigate("radar"); }, count: meshRouter.peers.size },
                    { id: "modules", icon: "⚡", label: "Módulos", action: () => setMenuOpen(m => !m), active: menuOpen, badgeText: String(totalModules), isModulesBtn: true },
                    { id: "ai", icon: "🤖", label: "Copiloto", action: () => { setMenuOpen(false); navigate("aiCopilot"); }, highlight: true },
                    { id: "compass", icon: "🧭", label: "Brújula", action: () => { setMenuOpen(false); navigate("offGridCompass"); } },
                    { id: "vault", icon: "🪪", label: "Bóveda", action: () => { setMenuOpen(false); navigate("idVault"); } },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={item.action}
                        style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: "2px", 
                            background: item.isModulesBtn && item.active ? "rgba(0, 229, 255, 0.15)" : "transparent",
                            border: item.isModulesBtn ? (item.active ? "1px solid rgba(0, 229, 255, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)") : "none",
                            color: item.active ? (item.isModulesBtn ? "var(--accent-cyan)" : "var(--accent-crimson)") : (item.highlight ? "var(--accent-cyan)" : (item.isModulesBtn ? "var(--accent-amber)" : "var(--text-secondary)")),
                            cursor: "pointer", padding: "4px 6px", borderRadius: "10px",
                            transition: "all 0.15s ease", position: "relative",
                            minWidth: "46px"
                        }}
                    >
                        <span style={{ fontSize: "1.15rem", filter: item.active ? "drop-shadow(0 0 8px rgba(0,229,255,0.6))" : "none" }}>
                            {item.icon}
                        </span>
                        <span style={{ fontSize: "0.60rem", fontWeight: item.active ? 900 : 700, letterSpacing: "0.2px", whiteSpace: "nowrap" }}>
                            {item.label}
                        </span>
                        {item.badgeText && (
                            <span style={{
                                position: "absolute", top: 1, right: 2,
                                fontSize: "0.50rem", fontWeight: 900,
                                background: "var(--accent-amber)", color: "#000",
                                padding: "0 3px", borderRadius: "4px",
                                boxShadow: "0 0 6px var(--accent-amber)"
                            }}>
                                {item.badgeText}
                            </span>
                        )}
                        {typeof item.count === "number" && item.count > 0 && (
                            <span style={{
                                position: "absolute", top: 2, right: 6,
                                width: 7, height: 7, borderRadius: "50%",
                                background: "var(--accent-emerald)", boxShadow: "0 0 6px var(--accent-emerald)"
                            }} />
                        )}
                    </button>
                ))}
            </nav>

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
                        className="card-tactical animate-enter modal-card-scrollable"
                        style={{
                            maxWidth: "460px", width: "100%", padding: "24px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            border: "1px solid var(--glass-border)", background: "rgba(12,14,24,0.98)",
                            maxHeight: "calc(100dvh - 32px)", overflowY: "auto"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>➕</span>
                                <span>Agregar Contacto / Nuevo Chat</span>
                            </div>
                            <button onClick={() => setAddContactOpen(false)} className="btn-icon" style={{ width: 32, height: 32 }}>✕</button>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                            Pega el DID Soberano, Hash (64 hex) o escanea el código QR del perfil de otro usuario para iniciar un canal cifrado.
                        </div>

                        {/* Botón Principal: Escáner QR de Contacto */}
                        <button
                            onClick={() => {
                                setAddContactOpen(false);
                                navigate("radar");
                            }}
                            className="btn-tactical-secondary"
                            style={{
                                width: "100%", padding: "12px 14px", fontSize: "0.85rem", fontWeight: 800,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                                borderColor: "rgba(0, 230, 118, 0.6)", color: "#00E676",
                                background: "rgba(0, 230, 118, 0.08)",
                                borderRadius: "var(--radius-md)"
                            }}
                        >
                            <span>📷</span>
                            <span>ESCANEAR QR DE CONTACTO (CÁMARA)</span>
                        </button>

                        {/* Enlace Directo a Vinculación con PC */}
                        <div
                            onClick={() => {
                                setAddContactOpen(false);
                                navigate("webCompanionLink");
                            }}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "8px 12px", borderRadius: "8px",
                                background: "rgba(0, 229, 255, 0.06)", border: "1px dashed rgba(0, 229, 255, 0.3)",
                                cursor: "pointer", fontSize: "0.76rem", color: "var(--accent-cyan)",
                                transition: "all 0.2s ease"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>💻</span>
                                <span>¿Quieres vincular tu cuenta con tu PC?</span>
                            </div>
                            <span style={{ fontWeight: 800 }}>Vincular Web →</span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-secondary)", marginBottom: "4px", display: "block", letterSpacing: "0.5px" }}>
                                    O INGRESA DID / CLAVE PÚBLICA MANUALMENTE
                                </label>
                                <input
                                    value={newContactInput}
                                    onChange={e => setNewContactInput(e.target.value)}
                                    placeholder="Ej: did:red:af10... o 3a7f8b9c..."
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

                                        // Detección Inteligente de Vinculación RED Web Companion
                                        if (input.startsWith("RED_PAIR:1:")) {
                                            setAddContactOpen(false);
                                            setNewContactInput("");
                                            setNewContactAlias("");
                                            setWebPairingCode(input);
                                            return;
                                        }

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
                                    {isSubmittingContact ? "Conectando..." : "⚡ CREAR CHAT O VINCULAR"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Search Modal */}
            {globalSearchOpen && <GlobalSearchModal onClose={() => setGlobalSearchOpen(false)} />}

            {/* Modal de Confirmación de Vinculación Web Companion */}
            {webPairingCode && (
                <WebCompanionPairConfirmationModal
                    qrData={webPairingCode}
                    onClose={() => setWebPairingCode(null)}
                />
            )}

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
        </aside>
    );
}


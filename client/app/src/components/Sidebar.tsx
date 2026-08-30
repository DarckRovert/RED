'use client';

import React, { useState, useMemo } from "react";
import { useRedStore, ScreenView } from "../store/useRedStore";
import { toast } from "./Toast";
import { GlobalSearchModal } from "./GlobalSearchModal";
import StoriesBar from "./stories/StoriesBar";
import StoryCreator from "./stories/StoryCreator";
import StoryViewer from "./stories/StoryViewer";
import { RED_VERSION } from "../lib/version";
import { meshRouter } from "../lib/mesh/meshRouter";
import { WebCompanionPairConfirmationModal } from "./WebCompanionPairConfirmationModal";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { SidebarHeader, ChatFilterType } from "./sidebar/SidebarHeader";
import { ConversationList } from "./sidebar/ConversationList";
import { ContactList } from "./sidebar/ContactList";

interface TacticalHubItem {
    id: string;
    title: string;
    desc: string;
    icon: string;
    primaryAction: ScreenView;
    badge: string;
    tools: Array<{ icon: string; label: string; action: ScreenView }>;
}

export default function Sidebar() {
    const { t } = useTranslation();
    const { 
        conversations: rawConvs, contacts: rawConts, groups: rawGrps, navigate,
        peerStories, addContact, pendingContactRequests: rawPending,
        preferences, updatePreferences,
    } = useRedStore();

    const conversations = Array.isArray(rawConvs) ? rawConvs : [];
    const contacts = Array.isArray(rawConts) ? rawConts : [];
    const groups = Array.isArray(rawGrps) ? rawGrps : [];
    const pendingContactRequests = Array.isArray(rawPending) ? rawPending : [];
    const pendingCount = pendingContactRequests.length;

    const peerNameIndex = useMemo(() => {
        const map = new Map<string, string>();
        for (const g of groups) {
            if (g?.id) map.set(g.id.toLowerCase(), g.name || `Grupo ${g.id.substring(0, 6)}…`);
        }
        for (const c of contacts) {
            if (c?.identity_hash && c.display_name) {
                map.set(c.identity_hash.toLowerCase(), c.display_name);
                if (c.identity_hash.length >= 8) {
                    map.set(c.identity_hash.toLowerCase().substring(0, 8), c.display_name);
                }
            }
        }
        return map;
    }, [groups, contacts]);

    function resolvePeerName(peerHash: string): string {
        if (!peerHash) return "Contacto P2P";
        const clean = peerHash.toLowerCase();
        const cached = peerNameIndex.get(clean);
        if (cached) return cached;

        const canonical = (meshRouter.getCanonicalId(peerHash) || peerHash).toLowerCase();
        const canonCached = peerNameIndex.get(canonical) || peerNameIndex.get(canonical.substring(0, 8));
        if (canonCached) return canonCached;

        const meshPeer = meshRouter.getPeerByAnyId(peerHash) || (canonical ? meshRouter.getPeerByAnyId(canonical) : undefined);
        if (meshPeer?.name && !meshPeer.name.startsWith('RED-') && !meshPeer.name.startsWith('Operador ') && !meshPeer.name.startsWith('Dispositivo RED')) {
            return meshPeer.name;
        }
        return meshPeer?.name || `${peerHash.substring(0, 8)}…`;
    }

    const [activeTab, setActiveTab] = useState<"chats" | "contacts">("chats");
    const [chatFilter, setChatFilter] = useState<ChatFilterType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
    const [addContactOpen, setAddContactOpen] = useState(false);
    const [newContactInput, setNewContactInput] = useState("");
    const [newContactAlias, setNewContactAlias] = useState("");
    const [isSubmittingContact, setIsSubmittingContact] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [webPairingCode, setWebPairingCode] = useState<string | null>(null);
    const [storyModal, setStoryModal] = useState<"creator" | { type: "contact"; hash: string } | { type: "live"; id: string } | null>(null);
    const [drawerSearch, setDrawerSearch] = useState("");

    const unreadTotal = useMemo(() => {
        return conversations.reduce((acc: number, c: any) => acc + (c.unread_count || 0), 0);
    }, [conversations]);

    const filteredConvs = useMemo(() => {
        const seenCanonical = new Set<string>();
        const deduped: any[] = [];
        for (const c of conversations) {
            if (!c || (!c.peer && !c.id) || c.peer?.startsWith("00000000") || c.id?.startsWith("00000000") || c.peer === 'me' || c.peer === 'local') continue;
            const rawP = c.peer || c.id || '';
            const canonical = (meshRouter.getCanonicalId(rawP) || rawP).toLowerCase();
            const shortP = canonical.slice(0, 16);
            if (seenCanonical.has(canonical) || seenCanonical.has(shortP)) continue;
            seenCanonical.add(canonical);
            seenCanonical.add(shortP);
            if (resolvePeerName(c.peer || c.id || "").toLowerCase().includes(searchQuery.toLowerCase())) {
                deduped.push({
                    ...c,
                    id: canonical,
                    peer: canonical
                });
            }
        }

        let sorted = deduped.sort((a: any, b: any) => {
            const tsA = (typeof a.last_message === "object" && a.last_message?.timestamp) || (a as any).last_timestamp || 0;
            const tsB = (typeof b.last_message === "object" && b.last_message?.timestamp) || (b as any).last_timestamp || 0;
            const normA = tsA < 1e10 ? tsA : tsA / 1000;
            const normB = tsB < 1e10 ? tsB : tsB / 1000;
            return normB - normA;
        });

        if (chatFilter === "unread") {
            sorted = sorted.filter((c: any) => (c.unread_count || 0) > 0);
        } else if (chatFilter === "groups") {
            sorted = sorted.filter((c: any) => Boolean(c.is_group) || groups.some((g: any) => g.id === c.id || g.id === c.peer));
        } else if (chatFilter === "channels") {
            sorted = sorted.filter((c: any) => c.is_channel || c.id?.startsWith("chan_") || c.peer?.startsWith("chan_"));
        }

        return sorted;
    }, [conversations, searchQuery, groups, contacts, chatFilter]);

    const filteredContacts = useMemo(() => {
        const seen = new Set<string>();
        const deduped: any[] = [];
        for (const c of contacts) {
            if (!c || !c.identity_hash) continue;
            const canonical = meshRouter.getCanonicalId(c.identity_hash) || c.identity_hash.toLowerCase();
            if (seen.has(canonical)) continue;
            seen.add(canonical);
            if (
                (c.display_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.identity_hash || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                canonical.toLowerCase().includes(searchQuery.toLowerCase())
            ) {
                deduped.push(c);
            }
        }
        return deduped;
    }, [contacts, searchQuery]);

    // 8 Hubs Tácticos Consolidados
    const tacticalHubs: TacticalHubItem[] = [
        {
            id: "comms",
            title: "1. Mensajería & Escuadrones",
            desc: "Chats P2P Double Ratchet, SenderKeys, Canales #, Feed Social y Pizarra",
            icon: "💬",
            primaryAction: "channels",
            badge: "P2P E2E",
            tools: [
                { icon: "📻", label: "Canales Malla (#)", action: "channels" },
                { icon: "👥", label: "Escuadrones P2P", action: "groups" },
                { icon: "🌍", label: "Feed Social Táctico", action: "socialFeed" },
                { icon: "🎨", label: "Pizarra Táctica", action: "canvas" },
                { icon: "📺", label: "Transmisión en Vivo", action: "liveStream" },
                { icon: "📢", label: "Difusión Privada", action: "broadcast" },
            ]
        },
        {
            id: "radar",
            title: "2. Radar, Mapa & Navegación",
            desc: "Radar Multicapa (BLE/LoRa/WiFi), Mapa Offline GPS y Brújula Táctica",
            icon: "🧭",
            primaryAction: "radar",
            badge: "OFF-GRID",
            tools: [
                { icon: "📡", label: "Radar Swarm BLE/WiFi", action: "radar" },
                { icon: "🗺️", label: "Mapa GPS Offline", action: "nodemap" },
                { icon: "🧭", label: "Brújula Topográfica", action: "offGridCompass" },
                { icon: "📳", label: "Shake & Pair (Acelerómetro)", action: "shakePair" },
                { icon: "📻", label: "Transceptor LoRa 25km", action: "loraTransceiver" },
            ]
        },
        {
            id: "voice",
            title: "3. Radio Vocal & SoundMesh",
            desc: "Walkie PTT códec LPC militar 1.2kbps, SoundMesh 18-20kHz y Espectro RF",
            icon: "🎙️",
            primaryAction: "walkie",
            badge: "1.2 KBPS",
            tools: [
                { icon: "🎙️", label: "Walkie-Talkie Push-To-Talk", action: "walkie" },
                { icon: "📞", label: "Llamadas Cifradas WebRTC", action: "call" },
                { icon: "🛡️", label: "Analizador Espectro RF", action: "rfSpectrum" },
            ]
        },
        {
            id: "ai",
            title: "4. Copiloto IA & RAG INT8",
            desc: "Inferencia Local WASM Qwen/SmolLM, RAG Vectorial <5ms y Firewall Guardian",
            icon: "🤖",
            primaryAction: "aiCopilot",
            badge: "100% OFFLINE",
            tools: [
                { icon: "🤖", label: "Copiloto Táctico", action: "aiCopilot" },
                { icon: "🛡️", label: "Guardián IA Firewall", action: "guardian" },
            ]
        },
        {
            id: "vault",
            title: "5. Bóveda PQC, Identidad & Vales",
            desc: "Firmas NIST ML-DSA-65, Kyber ML-KEM-768, Vales P2P y Respaldo Shamir SSS",
            icon: "🪪",
            primaryAction: "idVault",
            badge: "POST-QUANTUM",
            tools: [
                { icon: "🪪", label: "Perfil & Identidad DID", action: "idVault" },
                { icon: "💳", label: "Vales & Pagos P2P", action: "p2pPay" },
                { icon: "⚡", label: "Hub Comercial & Recompensas", action: "commercialHub" },
                { icon: "🔐", label: "Bóveda Criptográfica PQC", action: "crypto" },
                { icon: "🦊", label: "Bóveda Web3 & MetaMask", action: "web3Vault" },
                { icon: "⛓️", label: "Explorador Blockchain", action: "explorer" },
                { icon: "🖼️", label: "Bóveda Esteganográfica", action: "stegoVault" },
                { icon: "🔑", label: "Respaldo Shamir (SSS)", action: "shamirRecovery" },
                { icon: "💾", label: "Copias de Seguridad Cifradas", action: "backup" },
                { icon: "💻", label: "Vincular con PC (Web Companion)", action: "webCompanionLink" },
            ]
        },
        {
            id: "defense",
            title: "6. Ciberdefensa & Escudo DEFCON",
            desc: "Matriz DEFCON 1-5, Simulador Apagón, Dead-Man's Switch y Modo Calculadora",
            icon: "🛡️",
            primaryAction: "globalShield",
            badge: "DEFCON",
            tools: [
                { icon: "🛡️", label: "Escudo Global DEFCON", action: "globalShield" },
                { icon: "⚡", label: "Simulador de Apagón", action: "blackout" },
                { icon: "💀", label: "Hombre Muerto (DMS)", action: "dms" },
                { icon: "🛡️", label: "Centro de Seguridad Zero-Trust", action: "security" },
                { icon: "📑", label: "Reporte de Auditoría", action: "secReport" },
                { icon: "🧮", label: "Calculadora Señuelo (Camuflaje)", action: "calculator" },
            ]
        },
        {
            id: "emergency",
            title: "7. Defensa Civil, Triage & SOS",
            desc: "Triaje START/MARCH-PAWS, Baliza SOS multimodal, Alerta AMBER y Barómetro",
            icon: "🚨",
            primaryAction: "vitalScan",
            badge: "EMERGENCIA",
            tools: [
                { icon: "🫀", label: "Signos Vitales & Triage START", action: "vitalScan" },
                { icon: "🚨", label: "Baliza SOS Ultrasonido", action: "survivalBeacon" },
                { icon: "🟠", label: "Alerta AMBER P2P", action: "amber" },
                { icon: "🌤️", label: "Barómetro & Alertas CAP", action: "weather" },
            ]
        },
        {
            id: "system",
            title: "8. Mini-Apps Soberanas & Sistema",
            desc: "App Store P2P, Hyper-Browser Mesh, Diagnóstico de Salud y Ajustes Soberanos",
            icon: "🏪",
            primaryAction: "appStore",
            badge: "SANDBOX",
            tools: [
                { icon: "🛒", label: "App Store P2P (Mini-Apps)", action: "appStore" },
                { icon: "🌐", label: "RED Hyper-Browser Mesh", action: "hyperBrowser" },
                { icon: "📊", label: "Diagnóstico de Salud", action: "health" },
                { icon: "📋", label: "Logs del Nodo Rust SSE", action: "nodeLogs" },
                { icon: "⚙️", label: "Ajustes del Sistema", action: "settings" },
                { icon: "🚀", label: "Actualizador OTA", action: "updater" },
            ]
        },
    ];

    const filteredHubs = useMemo(() => {
        if (!drawerSearch.trim()) return tacticalHubs;
        const q = drawerSearch.toLowerCase();
        return tacticalHubs.map(hub => {
            const matchesHub = hub.title.toLowerCase().includes(q) || hub.desc.toLowerCase().includes(q);
            const matchingTools = hub.tools.filter(t => t.label.toLowerCase().includes(q));
            if (matchesHub) return hub;
            if (matchingTools.length > 0) {
                return { ...hub, tools: matchingTools };
            }
            return null;
        }).filter(Boolean) as TacticalHubItem[];
    }, [drawerSearch]);

    const totalToolsCount = tacticalHubs.reduce((acc, h) => acc + h.tools.length, 0);

    return (
        <aside style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "var(--bg-void)", position: "relative", overflow: "hidden" }}>

            {/* Tactical Slide-Over Command Drawer: 8 Hubs Tácticos */}
            {menuOpen && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)", display: "flex", justifyContent: "flex-end" }}
                    onClick={() => setMenuOpen(false)}
                >
                    <div
                        className="animate-enter"
                        style={{
                            width: "100%", maxWidth: "380px", height: "100%",
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
                                    <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#fff", letterSpacing: "0.5px" }}>Centro de Comando Táctico</div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                                        8 HUBS · {totalToolsCount} HERRAMIENTAS ACTIVAS
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
                                    placeholder="Buscar hub, protocolo o herramienta..."
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

                        {/* Quick Action Highlights */}
                        <div style={{ padding: "0 16px 8px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", flexShrink: 0 }}>
                            <button
                                onClick={() => { setMenuOpen(false); navigate("appStore"); }}
                                className="card-tactical-interactive"
                                style={{
                                    padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                                    background: "linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 229, 255, 0.08) 100%)",
                                    border: "1px solid rgba(0, 230, 118, 0.35)", borderRadius: "var(--radius-md)", textAlign: "center"
                                }}
                            >
                                <span style={{ fontSize: "1.3rem" }}>🛒</span>
                                <span style={{ fontSize: "0.76rem", fontWeight: 900, color: "var(--accent-emerald)" }}>App Store P2P</span>
                                <span style={{ fontSize: "0.60rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>MINI-APPS</span>
                            </button>
                            <button
                                onClick={() => { setMenuOpen(false); navigate("hyperBrowser"); }}
                                className="card-tactical-interactive"
                                style={{
                                    padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                                    background: "linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(138, 43, 226, 0.08) 100%)",
                                    border: "1px solid rgba(0, 229, 255, 0.35)", borderRadius: "var(--radius-md)", textAlign: "center"
                                }}
                            >
                                <span style={{ fontSize: "1.3rem" }}>🌐</span>
                                <span style={{ fontSize: "0.76rem", fontWeight: 900, color: "var(--accent-cyan)" }}>Hyper-Browser</span>
                                <span style={{ fontSize: "0.60rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>MESH HTTP</span>
                            </button>
                        </div>

                        {/* Operational Mode Quick Selector */}
                        <div style={{ padding: "0 16px 10px 16px", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontWeight: 800, textTransform: "uppercase" }}>
                                MODO OPERACIONAL
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
                                {[
                                    { id: 'stealth', icon: '🕶️', label: 'Sigilo' },
                                    { id: 'scotopic_red', icon: '🔴', label: 'Luz Roja' },
                                    { id: 'solar', icon: '☀️', label: 'Solar' },
                                    { id: 'survival', icon: '⚡', label: 'Apagón' },
                                    { id: 'offgrid', icon: '🛒', label: 'Off-Grid' }
                                ].map(m => {
                                    const isSel = (preferences.operationalMode || 'stealth') === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => updatePreferences({ operationalMode: m.id as any })}
                                            style={{
                                                padding: "6px 4px",
                                                borderRadius: "var(--radius-sm)",
                                                border: isSel ? "1px solid var(--accent-cyan)" : "1px solid var(--glass-border)",
                                                background: isSel ? "rgba(0, 229, 255, 0.18)" : "rgba(255,255,255,0.03)",
                                                color: isSel ? "#FFF" : "var(--text-secondary)",
                                                fontSize: "0.68rem",
                                                fontWeight: 800,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "4px",
                                                cursor: "pointer",
                                                fontFamily: "JetBrains Mono, monospace"
                                            }}
                                        >
                                            <span>{m.icon}</span>
                                            <span>{m.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 8 Tactical Hubs Scrollable List */}
                        <div className="scroll-container" style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 16px 36px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            {filteredHubs.map(hub => (
                                <div
                                    key={hub.id}
                                    style={{
                                        background: "rgba(18, 20, 36, 0.75)",
                                        border: "1px solid var(--glass-border)",
                                        borderRadius: "10px",
                                        padding: "12px",
                                        display: "flex", flexDirection: "column", gap: "8px"
                                    }}
                                >
                                    <div
                                        onClick={() => { setMenuOpen(false); navigate(hub.primaryAction); }}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }}
                                        className="hover-bright"
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontSize: "1.2rem" }}>{hub.icon}</span>
                                            <div>
                                                <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "#fff" }}>{hub.title}</div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>{hub.desc}</div>
                                            </div>
                                        </div>
                                        <span className="badge-live-cyan" style={{ fontSize: "0.58rem", padding: "2px 5px", flexShrink: 0 }}>
                                            {hub.badge}
                                        </span>
                                    </div>

                                    {/* Tool Chips */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", paddingTop: "4px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                        {hub.tools.map(tool => (
                                            <button
                                                key={tool.action}
                                                onClick={() => { setMenuOpen(false); navigate(tool.action); }}
                                                className="btn-ghost hover-bright"
                                                style={{
                                                    padding: "4px 8px", fontSize: "0.72rem",
                                                    background: "rgba(255,255,255,0.03)",
                                                    border: "1px solid rgba(255,255,255,0.08)",
                                                    borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px"
                                                }}
                                            >
                                                <span>{tool.icon}</span>
                                                <span>{tool.label}</span>
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

                            <button
                                onClick={() => {
                                    setMenuOpen(false);
                                    if (typeof window !== "undefined") {
                                        window.dispatchEvent(new CustomEvent("red:open_landing"));
                                    }
                                }}
                                style={{
                                    width: "100%", padding: "8px", borderRadius: "var(--radius-sm)",
                                    background: "rgba(0, 240, 255, 0.08)", border: "1px solid rgba(0, 240, 255, 0.25)",
                                    color: "var(--accent-cyan)", fontSize: "0.74rem", fontWeight: 800,
                                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                }}
                            >
                                <span>🌐</span> Portal Web Oficial & Descargas
                            </button>

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
                totalModules={8}
                filteredConvsCount={filteredConvs.length}
                filteredContactsCount={filteredContacts.length}
                pendingCount={pendingCount}
                chatFilter={chatFilter}
                setChatFilter={setChatFilter}
                unreadTotal={unreadTotal}
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

            {/* ── Fixed Bottom Tactical HUD Dock (5 Key Pillars) ── */}
            <nav style={{
                position: "sticky", bottom: 0, left: 0, right: 0,
                minHeight: "56px",
                background: "linear-gradient(180deg, rgba(14, 16, 30, 0.95) 0%, rgba(6, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderTop: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "space-around",
                padding: "4px 4px max(6px, env(safe-area-inset-bottom, 6px)) 4px",
                zIndex: 40, flexShrink: 0
            }}>
                {[
                    { id: "chats", icon: "💬", label: t.dock?.chats || "Chats", action: () => { setMenuOpen(false); setActiveTab("chats"); }, active: activeTab === "chats" && !menuOpen },
                    { id: "radar", icon: "📡", label: t.dock?.radar || "Radar", action: () => { setMenuOpen(false); navigate("radar"); }, count: meshRouter.peers.size },
                    { id: "modules", icon: "⚡", label: "Hubs", action: () => setMenuOpen(m => !m), active: menuOpen, badgeText: "8", isModulesBtn: true },
                    { id: "ai", icon: "🤖", label: t.dock?.ai || "Copiloto", action: () => { setMenuOpen(false); navigate("aiCopilot"); }, highlight: true },
                    { id: "vault", icon: "🪪", label: t.dock?.vault || "Bóveda", action: () => { setMenuOpen(false); navigate("idVault"); } },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={item.action}
                        style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: "3px", 
                            background: item.isModulesBtn && item.active ? "rgba(0, 229, 255, 0.18)" : "transparent",
                            border: item.isModulesBtn ? (item.active ? "1px solid rgba(0, 229, 255, 0.6)" : "1px solid rgba(255, 255, 255, 0.12)") : "none",
                            color: item.active ? (item.isModulesBtn ? "var(--accent-cyan)" : "var(--accent-crimson)") : (item.highlight ? "var(--accent-cyan)" : (item.isModulesBtn ? "var(--accent-amber)" : "var(--text-secondary)")),
                            cursor: "pointer", padding: "6px 8px", borderRadius: "12px",
                            transition: "all 0.15s ease", position: "relative",
                            minWidth: "48px", minHeight: "48px"
                        }}
                    >
                        <span style={{ fontSize: "1.25rem", filter: item.active ? "drop-shadow(0 0 10px rgba(0,229,255,0.7))" : "none" }}>
                            {item.icon}
                        </span>
                        <span style={{ fontSize: "0.72rem", fontWeight: item.active ? 900 : 700, letterSpacing: "0.3px", whiteSpace: "nowrap" }}>
                            {item.label}
                        </span>
                        {item.badgeText && (
                            <span style={{
                                position: "absolute", top: 1, right: 2,
                                fontSize: "0.58rem", fontWeight: 900,
                                background: "var(--accent-amber)", color: "#000",
                                padding: "1px 4px", borderRadius: "6px",
                                boxShadow: "0 0 8px var(--accent-amber)"
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
                                <span>{t.sidebar?.add_contact_btn || "Agregar Contacto / Nuevo Chat"}</span>
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
                            <span>{t.radar?.scan_scanner_btn || "ESCANEAR QR DE CONTACTO (CÁMARA)"}</span>
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

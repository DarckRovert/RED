"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { GroupAdminModal } from "./GroupAdminModal";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { Badge } from "./ui/Badge";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { copyToClipboard } from "../lib/clipboard";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";

export default function GroupsPanel() {
    const { contacts: rawContacts, groups: rawGroups, conversations: rawConvs, identity, goBack, navigate, fetchData } = useRedStore();
    const { t } = useTranslation();
    const contacts = Array.isArray(rawContacts) ? rawContacts : [];
    const groups = Array.isArray(rawGroups) ? rawGroups : [];
    const conversations = Array.isArray(rawConvs) ? rawConvs : [];

    // State
    const [groupName, setGroupName] = useState("");
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [creationStatus, setCreationStatus] = useState("");
    const [adminGroup, setAdminGroup] = useState<any | null>(null);
    const [searchGroupQuery, setSearchGroupQuery] = useState("");
    const [contactSearchQuery, setContactSearchQuery] = useState("");
    const [isCreatingSquad, setIsCreatingSquad] = useState(groups.length === 0);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinInput, setJoinInput] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [qrModalGroup, setQrModalGroup] = useState<any | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState("");

    const myHash = identity?.identity_hash || (typeof window !== "undefined" ? localStorage.getItem("red_identity_hash") : "") || "";

    // Hardware Back Handling (Android Back Gesture / Esc) LIFO stack
    useEffect(() => {
        if (adminGroup || showJoinModal || qrModalGroup) return;
        return BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
    }, [goBack, adminGroup, showJoinModal, qrModalGroup]);

    useEffect(() => {
        if (!showJoinModal) return;
        return BackHandlerRegistry.register(() => {
            setShowJoinModal(false);
            return true;
        });
    }, [showJoinModal]);

    useEffect(() => {
        if (!qrModalGroup) return;
        return BackHandlerRegistry.register(() => {
            setQrModalGroup(null);
            return true;
        });
    }, [qrModalGroup]);

    // Generate sovereign QR data URL when inspecting a squad QR
    useEffect(() => {
        if (!qrModalGroup) return;
        const link = `red://squad/join?id=${qrModalGroup.id}&name=${encodeURIComponent(qrModalGroup.name)}`;
        OfflineQrEngine.generateDataUrl(link, {
            width: 240,
            darkColor: "#00E5FF",
            lightColor: "#080C16"
        }).then(setQrDataUrl).catch(() => {});
    }, [qrModalGroup]);

    // Build unread + last message index from conversations for groups
    const groupConvIndex = useMemo(() => {
        const idx = new Map<string, { unread: number; snippet: string; ts: number }>();
        for (const conv of conversations) {
            const key = (conv.peer || conv.id || '').toLowerCase();
            if (!key) continue;
            let snippet = '';
            const lm = (conv as any).last_message;
            if (lm) {
                const content = typeof lm === 'object' ? lm.content : lm;
                const msgType = typeof lm === 'object' ? lm.msg_type : null;
                if (msgType === 'image' || content?.startsWith('data:image')) snippet = '📷 Foto';
                else if (msgType === 'voice' || msgType === 'audio') snippet = '🎤 Voz';
                else if (msgType === 'video') snippet = '📹 Video';
                else if (content && !content.startsWith('data:') && !content.startsWith('{'))
                    snippet = content.length > 40 ? content.slice(0, 40) + '…' : content;
                else snippet = 'Mensaje cifrado';
            }
            idx.set(key, {
                unread: (conv as any).unread_count || 0,
                snippet,
                ts: (conv as any).last_timestamp || 0,
            });
        }
        return idx;
    }, [conversations]);

    // Telemetry stats
    const telemetry = useMemo(() => {
        const uniqueMembers = new Set<string>();
        let broadcastCount = 0;
        for (const g of groups) {
            if (g.broadcast_only) broadcastCount++;
            const mems = Array.isArray(g.members) ? g.members : [];
            for (const m of mems) {
                const h = typeof m === 'string' ? m : m?.identity_hash;
                if (h) uniqueMembers.add(h);
            }
        }
        return {
            totalSquads: groups.length,
            uniquePeers: uniqueMembers.size,
            broadcastSquads: broadcastCount,
        };
    }, [groups]);

    // Filtered groups
    const filteredGroups = useMemo(() => {
        if (!searchGroupQuery.trim()) return groups;
        const q = searchGroupQuery.toLowerCase();
        return groups.filter((g: any) => {
            const name = (g.name || '').toLowerCase();
            const id = (g.id || '').toLowerCase();
            return name.includes(q) || id.includes(q);
        });
    }, [groups, searchGroupQuery]);

    // Filtered contacts for squad creation
    const filteredContacts = useMemo(() => {
        if (!contactSearchQuery.trim()) return contacts;
        const q = contactSearchQuery.toLowerCase();
        return contacts.filter((c: any) => {
            const name = (c.display_name || '').toLowerCase();
            const hash = (c.identity_hash || '').toLowerCase();
            return name.includes(q) || hash.includes(q);
        });
    }, [contacts, contactSearchQuery]);

    const toggleContact = (hash: string) => {
        if (selectedContacts.includes(hash)) {
            setSelectedContacts(selectedContacts.filter(c => c !== hash));
        } else {
            setSelectedContacts([...selectedContacts, hash]);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.warning("Ingresa el nombre del escuadrón o grupo");
            return;
        }
        if (selectedContacts.length === 0) {
            toast.warning("Selecciona al menos un miembro para el grupo");
            return;
        }

        setCreationStatus("Sincronizando llaves compartidas (SenderKey)...");
        try {
            const result = await RedAPI.createGroup(groupName.trim(), selectedContacts);
            setCreationStatus("");
            setGroupName("");
            setSelectedContacts([]);
            setIsCreatingSquad(false);
            toast.success(`Escuadrón ${groupName} creado con éxito`);
            await new Promise(r => setTimeout(r, 80));
            await fetchData();
            if (result?.id) {
                navigate("chat", result.id);
            }
        } catch (e) {
            console.error("Group creation failed", e);
            setCreationStatus("");
            toast.error("Error al federar contrato de grupo");
        }
    };

    const handleJoinSquad = async () => {
        if (!joinInput.trim()) {
            toast.warning("Pega el enlace o código de invitación");
            return;
        }
        setIsJoining(true);
        try {
            const res = await RedAPI.joinGroupFromInvite(joinInput.trim());
            toast.success(`Te has unido a ${res.name}`);
            setShowJoinModal(false);
            setJoinInput("");
            await fetchData();
            navigate("chat", res.id);
        } catch (e: any) {
            toast.error(e?.message || "Error al procesar la invitación");
        } finally {
            setIsJoining(false);
        }
    };

    const copySquadLink = (g: any) => {
        const link = `red://squad/join?id=${g.id}&name=${encodeURIComponent(g.name)}`;
        TacticalAudioEngine.playTap();
        copyToClipboard(link).then((ok) => {
            if (ok) {
                toast.success(`Enlace de ${g.name} copiado al portapapeles`);
            } else {
                toast.error("Error al copiar enlace");
            }
        });
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(124,77,255,0.4)"
                    }}>👥</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.squads_module?.title || "Escuadrones & Canales P2P"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-purple, #B388FF)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t.squads_module?.subtitle || "SIGNAL SENDERKEY · CIFRADO MULTI-PAR"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={() => setShowJoinModal(true)}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                        title="Unirse a un escuadrón mediante enlace o QR"
                    >
                        📥 Unirse
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar panel"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* HUD Métrico de Escuadrones */}
                    <div className="card-tactical animate-enter" style={{
                        padding: "14px 18px",
                        background: "linear-gradient(135deg, rgba(124, 77, 255, 0.08) 0%, rgba(20, 16, 38, 0.6) 100%)",
                        borderColor: "rgba(124, 77, 255, 0.3)",
                        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px"
                    }}>
                        <div>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800 }}>
                                Escuadrones
                            </div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.totalSquads}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800 }}>
                                Pares Enlazados
                            </div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent-purple, #B388FF)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.uniquePeers}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800 }}>
                                Modo Difusión
                            </div>
                            <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "var(--accent-cyan, #00E5FF)", fontFamily: "JetBrains Mono, monospace" }}>
                                {telemetry.broadcastSquads}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800 }}>
                                Seguridad Cripto
                            </div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--accent-green, #00E676)", marginTop: "4px" }}>
                                🔒 SENDERKEY
                            </div>
                        </div>
                    </div>

                    {/* Barra de Acciones y Búsqueda */}
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <div style={{ flex: 1, position: "relative" }}>
                            <input
                                type="text"
                                placeholder="🔍 Buscar escuadrón por nombre o ID..."
                                value={searchGroupQuery}
                                onChange={(e) => setSearchGroupQuery(e.target.value)}
                                style={{
                                    width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)",
                                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)",
                                    color: "#fff", fontSize: "0.85rem", outline: "none"
                                }}
                            />
                            {searchGroupQuery && (
                                <button
                                    onClick={() => setSearchGroupQuery("")}
                                    style={{
                                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                                        background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer"
                                    }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setIsCreatingSquad(!isCreatingSquad)}
                            className={isCreatingSquad ? "btn-tactical-secondary" : "btn-tactical-primary"}
                            style={{ padding: "10px 16px", fontSize: "0.82rem", whiteSpace: "nowrap" }}
                        >
                            {isCreatingSquad ? "✕ Cancelar" : "⚡ + Crear Escuadrón"}
                        </button>
                    </div>

                    {/* Creador de Nuevo Grupo (Acordeón Colapsable) */}
                    {isCreatingSquad && (
                        <div className="card-tactical animate-enter" style={{
                            padding: "20px", display: "flex", flexDirection: "column", gap: "14px",
                            borderColor: "rgba(124, 77, 255, 0.45)", background: "rgba(18, 14, 32, 0.95)"
                        }}>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                ⚡ {t.squads_module?.create_title?.toUpperCase() || "CREAR NUEVO ESCUADRÓN CIFRADO"}
                            </div>

                            <input
                                type="text"
                                placeholder={t.squads_module?.name_placeholder || "Nombre del Escuadrón (Ej: Brigada Alfa, Rescate Norte)..."}
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                                style={{ fontSize: "0.92rem" }}
                            />

                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>
                                        {t.squads_module?.members_label?.toUpperCase() || "AÑADIR MIEMBROS"} ({selectedContacts.length}/{contacts.length})
                                    </div>
                                </div>

                                {contacts.length > 4 && (
                                    <input
                                        type="text"
                                        placeholder="Filtrar contactos por indicativo o DID..."
                                        value={contactSearchQuery}
                                        onChange={(e) => setContactSearchQuery(e.target.value)}
                                        style={{
                                            width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)",
                                            background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)",
                                            color: "#fff", fontSize: "0.78rem", marginBottom: "8px", outline: "none"
                                        }}
                                    />
                                )}

                                {contacts.length === 0 ? (
                                    <div className="empty-state-tactical" style={{ padding: "16px" }}>
                                        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                            {t.sidebar?.no_contacts_desc || "No hay contactos disponibles. Añade pares desde Radar P2P."}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                                        {filteredContacts.map(c => {
                                            const selected = selectedContacts.includes(c.identity_hash);
                                            return (
                                                <div
                                                    key={c.identity_hash}
                                                    onClick={() => toggleContact(c.identity_hash)}
                                                    className="card-tactical-interactive"
                                                    style={{
                                                        padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                        background: selected ? "rgba(124,77,255,0.12)" : "rgba(255,255,255,0.02)",
                                                        borderColor: selected ? "rgba(124,77,255,0.5)" : "var(--glass-border)"
                                                    }}
                                                >
                                                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: selected ? "#fff" : "var(--text-primary)" }}>{c.display_name}</span>
                                                    <span style={{ color: selected ? "#B388FF" : "var(--text-muted)", fontWeight: 900, fontSize: "0.85rem" }}>
                                                        {selected ? "✓" : "+"}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || selectedContacts.length === 0 || !!creationStatus}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.95rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                            >
                                {creationStatus || t.squads_module?.create_btn || "FEDERAR CONTRATO DE GRUPO"}
                            </button>
                        </div>
                    )}

                    {/* Lista de Grupos Activos */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                {t.sidebar?.squads_title || "GRUPOS & ESCUADRONES ACTIVOS"} ({filteredGroups.length})
                            </div>
                        </div>

                        {groups.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">👥</div>
                                <div className="empty-state-title">{t.sidebar?.no_squads || "Sin Grupos Federados"}</div>
                                <div className="empty-state-desc">
                                    {t.sidebar?.no_squads_desc || "Crea un escuadrón con tus contactos o únete mediante enlace para chatear en canales multi-par cifrados."}
                                </div>
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="empty-state-tactical" style={{ padding: "24px" }}>
                                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                    No se encontraron escuadrones que coincidan con &ldquo;{searchGroupQuery}&rdquo;.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {filteredGroups.map((g: any) => {
                                    const convData = groupConvIndex.get((g.id || '').toLowerCase());
                                    const unread = convData?.unread ?? 0;
                                    const snippet = convData?.snippet || 'Canal cifrado SenderKey';
                                    const memberCount = Array.isArray(g.members) ? g.members.length : 0;
                                    const isBroadcast = g.broadcast_only;

                                    // Detect my role in this group
                                    const myMemberObj = Array.isArray(g.members)
                                        ? g.members.find((m: any) => (typeof m === 'string' ? m : m?.identity_hash)?.toLowerCase() === myHash?.toLowerCase())
                                        : null;
                                    const myRole = typeof myMemberObj === 'object' ? myMemberObj?.role : (g.creator === myHash ? 'Admin' : 'Member');

                                    // Deterministic color from group id
                                    const hue = (g.id || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360;

                                    return (
                                        <div
                                            key={g.id}
                                            onClick={() => navigate("chat", g.id)}
                                            className="card-tactical-interactive"
                                            style={{
                                                padding: "14px 16px",
                                                display: "flex", alignItems: "center", gap: "12px",
                                                border: unread > 0 ? '1px solid rgba(124,77,255,0.4)' : '1px solid var(--glass-border)',
                                                background: unread > 0 ? 'rgba(124,77,255,0.06)' : undefined,
                                            }}
                                        >
                                            {/* Group Avatar */}
                                            <div style={{
                                                width: 46, height: 46, borderRadius: "12px", flexShrink: 0,
                                                background: `linear-gradient(135deg, hsl(${hue},70%,35%), hsl(${hue},80%,55%))`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontWeight: 900, color: "white", fontSize: "1.2rem",
                                                boxShadow: `0 4px 12px hsla(${hue},70%,40%,0.4)`,
                                            }}>
                                                {(g.name || '#').charAt(0).toUpperCase()}
                                            </div>

                                            {/* Group Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "8px" }}>
                                                    <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {g.name}
                                                    </span>
                                                    <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                                        {isBroadcast && (
                                                            <Badge variant="danger" size="xs">
                                                                📢 DIFUSIÓN
                                                            </Badge>
                                                        )}
                                                        <Badge variant="neutral" size="xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                            {memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                                                    <span style={{
                                                        fontSize: "0.62rem", fontWeight: 700, fontFamily: "JetBrains Mono, monospace",
                                                        color: myRole === 'Admin' ? 'var(--accent-crimson)' : myRole === 'Moderator' ? 'var(--accent-cyan)' : 'var(--text-muted)'
                                                    }}>
                                                        {myRole === 'Admin' ? '👑 Admin' : myRole === 'Moderator' ? '🛡️ Mod' : '👤 Miembro'}
                                                    </span>
                                                    <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>•</span>
                                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {snippet}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Right actions */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end", flexShrink: 0 }}>
                                                {unread > 0 && (
                                                    <Badge variant="purple" count={unread} pulse size="xs" />
                                                )}
                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); copySquadLink(g); }}
                                                        className="btn-icon"
                                                        title="Copiar enlace táctico de escuadrón"
                                                        style={{ width: 32, height: 32 }}
                                                    >
                                                        📋
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setQrModalGroup(g); }}
                                                        className="btn-icon"
                                                        title="Ver código QR de invitación"
                                                        style={{ width: 32, height: 32 }}
                                                    >
                                                        📲
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAdminGroup(g); }}
                                                        className="btn-icon"
                                                        title="Gestionar Miembros & Ajustes del Grupo"
                                                        style={{ width: 32, height: 32 }}
                                                    >
                                                        ⚙️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Administración de Grupo */}
            {adminGroup && (
                <GroupAdminModal
                    groupId={adminGroup.id}
                    groupName={adminGroup.name}
                    members={adminGroup.members || []}
                    broadcastOnly={adminGroup.broadcast_only}
                    onClose={() => {
                        setAdminGroup(null);
                        fetchData();
                    }}
                />
            )}

            {/* Modal Unirse a Escuadrón */}
            {showJoinModal && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 10000,
                        background: "rgba(4, 6, 12, 0.88)", backdropFilter: "blur(18px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
                    }}
                    onClick={() => setShowJoinModal(false)}
                >
                    <div
                        className="card-tactical animate-enter"
                        style={{
                            width: "100%", maxWidth: "440px", padding: "20px",
                            boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
                            display: "flex", flexDirection: "column", gap: "16px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>📥 Unirse a Escuadrón</h2>
                                <div style={{ fontSize: "0.7rem", color: "var(--accent-purple, #B388FF)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                                    IMPORTACIÓN DIRECTA P2P / OFF-GRID
                                </div>
                            </div>
                            <button onClick={() => setShowJoinModal(false)} className="btn-icon" style={{ width: 32, height: 32 }}>✕</button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                Pega el enlace táctico (<code>red://squad/...</code>) o carga JSON:
                            </label>
                            <textarea
                                rows={4}
                                placeholder="Pega aquí el enlace de escuadrón o la cadena de invitación..."
                                value={joinInput}
                                onChange={(e) => setJoinInput(e.target.value)}
                                style={{
                                    width: "100%", padding: "10px", borderRadius: "var(--radius-sm)",
                                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)",
                                    color: "#fff", fontSize: "0.82rem", outline: "none", resize: "none",
                                    fontFamily: "JetBrains Mono, monospace"
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button
                                onClick={async () => {
                                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            if (text) setJoinInput(text.trim());
                                        } catch {}
                                    }
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px 14px", fontSize: "0.8rem" }}
                            >
                                📋 Pegar
                            </button>
                            <button
                                onClick={handleJoinSquad}
                                disabled={!joinInput.trim() || isJoining}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 20px", fontSize: "0.85rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                            >
                                {isJoining ? "Uniéndose..." : "Unirse al Escuadrón"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Código QR de Escuadrón */}
            {qrModalGroup && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 10000,
                        background: "rgba(4, 6, 12, 0.88)", backdropFilter: "blur(18px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
                    }}
                    onClick={() => setQrModalGroup(null)}
                >
                    <div
                        className="card-tactical animate-enter"
                        style={{
                            width: "100%", maxWidth: "380px", padding: "20px",
                            boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
                            display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>📲 Invitación de Escuadrón</h2>
                                <div style={{ fontSize: "0.7rem", color: "var(--accent-purple, #B388FF)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                                    {qrModalGroup.name}
                                </div>
                            </div>
                            <button onClick={() => setQrModalGroup(null)} className="btn-icon" style={{ width: 32, height: 32 }}>✕</button>
                        </div>

                        {qrDataUrl ? (
                            <img
                                src={qrDataUrl}
                                alt="QR Escuadrón"
                                style={{ width: 220, height: 220, borderRadius: "10px", border: "1px solid rgba(124,77,255,0.4)" }}
                            />
                        ) : (
                            <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                Generando código QR táctico...
                            </div>
                        )}

                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center" }}>
                            Escanea este código o comparte el enlace táctico para autorizar a otro operador en la malla.
                        </div>

                        <button
                            onClick={() => copySquadLink(qrModalGroup)}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "10px", fontSize: "0.85rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                        >
                            📋 Copiar Enlace Táctico
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
"use client";

import React, { useState, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { GroupAdminModal } from "./GroupAdminModal";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { Badge } from "./ui/Badge";

export default function GroupsPanel() {
    const { contacts: rawContacts, groups: rawGroups, conversations: rawConvs, goBack, navigate, fetchData } = useRedStore();
    const { t } = useTranslation();
    const contacts = Array.isArray(rawContacts) ? rawContacts : [];
    const groups = Array.isArray(rawGroups) ? rawGroups : [];
    const conversations = Array.isArray(rawConvs) ? rawConvs : [];
    const [groupName, setGroupName] = useState("");
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [creationStatus, setCreationStatus] = useState("");
    const [adminGroup, setAdminGroup] = useState<any | null>(null);

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
            setCreationStatus("Grupo federado con éxito.");
            toast.success(`Escuadrón ${groupName} creado con éxito`);
            // Bug #5 fix: fetchData may race against createGroup's async Zustand setState.
            await new Promise(r => setTimeout(r, 80));
            await fetchData();
            if (result?.id) {
                navigate("chat", result.id);
            } else {
                goBack();
            }

        } catch (e) {
            console.error("Group creation failed", e);
            setCreationStatus("Error al crear el grupo.");
            toast.error("Error al federar contrato de grupo");
        }
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

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar panel"}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Creador de Nuevo Grupo */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
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
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px" }}>
                                {t.squads_module?.members_label?.toUpperCase() || "AÑADIR MIEMBROS"} ({selectedContacts.length}/{contacts.length})
                            </div>

                            {contacts.length === 0 ? (
                                <div className="empty-state-tactical" style={{ padding: "16px" }}>
                                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                        {t.sidebar?.no_contacts_desc || "No hay contactos disponibles. Añade pares desde Radar P2P."}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                                    {contacts.map(c => {
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
                            disabled={!groupName.trim() || selectedContacts.length === 0}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px", fontSize: "0.95rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                        >
                            {creationStatus || t.squads_module?.create_btn || "FEDERAR CONTRATO DE GRUPO"}
                        </button>
                    </div>

                    {/* Lista de Grupos Activos */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            {t.sidebar?.squads_title || "GRUPOS & ESCUADRONES ACTIVOS"} ({groups.length})
                        </div>

                        {groups.length === 0 ? (
                            <div className="empty-state-tactical">
                                <div className="empty-state-icon">👥</div>
                                <div className="empty-state-title">{t.sidebar?.no_squads || "Sin Grupos Federados"}</div>
                                <div className="empty-state-desc">
                                    {t.sidebar?.no_squads_desc || "Crea un escuadrón con tus contactos para chatear en canales multi-par cifrados."}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {groups.map((g: any) => {
                                    const convData = groupConvIndex.get((g.id || '').toLowerCase());
                                    const unread = convData?.unread ?? 0;
                                    const snippet = convData?.snippet || 'Canal cifrado SenderKey';
                                    const memberCount = Array.isArray(g.members) ? g.members.length : 0;
                                    // Deterministic color from group id
                                    const hue = (g.id || '').split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0) % 360;
                                    return (
                                        <div
                                            key={g.id}
                                            onClick={() => navigate("chat", g.id)}
                                            className="card-tactical-interactive"
                                            style={{
                                                padding: "12px 14px",
                                                display: "flex", alignItems: "center", gap: "12px",
                                                border: unread > 0 ? '1px solid rgba(124,77,255,0.4)' : '1px solid var(--glass-border)',
                                                background: unread > 0 ? 'rgba(124,77,255,0.06)' : undefined,
                                            }}
                                        >
                                            {/* Group Avatar */}
                                            <div style={{
                                                width: 44, height: 44, borderRadius: "12px", flexShrink: 0,
                                                background: `linear-gradient(135deg, hsl(${hue},70%,35%), hsl(${hue},80%,55%))`,
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontWeight: 900, color: "white", fontSize: "1.15rem",
                                                boxShadow: `0 4px 12px hsla(${hue},70%,40%,0.4)`,
                                            }}>
                                                {(g.name || '#').charAt(0).toUpperCase()}
                                            </div>

                                            {/* Group Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                                                    <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {g.name}
                                                    </span>
                                                    <Badge variant="neutral" size="xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                        {memberCount} {memberCount === 1 ? 'miembro' : 'miembros'}
                                                    </Badge>
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {snippet}
                                                </div>
                                            </div>

                                            {/* Right actions */}
                                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end", flexShrink: 0 }}>
                                                {unread > 0 && (
                                                    <Badge variant="purple" count={unread} pulse size="xs" />
                                                )}
                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAdminGroup(g); }}
                                                        className="btn-icon"
                                                        title="Gestionar Miembros & Ajustes del Grupo"
                                                        style={{ width: 30, height: 30 }}
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
                    onClose={() => {
                        setAdminGroup(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}
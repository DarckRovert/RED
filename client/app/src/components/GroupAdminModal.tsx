"use client";

import React, { useState, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";

type GroupRole = "Admin" | "Moderator" | "Member" | "ReadOnly";

interface GroupMemberInfo {
    identity_hash: string;
    display_name?: string;
    role?: GroupRole;
    muted?: boolean;
}

interface GroupAdminModalProps {
    groupId: string;
    groupName: string;
    members: (string | GroupMemberInfo)[];
    broadcastOnly?: boolean;
    myRole?: GroupRole;
    onClose?: () => void;
}

const ROLE_LABELS: Record<GroupRole, string> = {
    Admin: "👑 Admin",
    Moderator: "🛡️ Moderador",
    Member: "👤 Miembro",
    ReadOnly: "👁️ Solo Lectura",
};

const ROLE_COLORS: Record<GroupRole, string> = {
    Admin: "var(--accent-crimson)",
    Moderator: "var(--accent-cyan)",
    Member: "rgba(255,255,255,0.65)",
    ReadOnly: "var(--text-muted)",
};

export const GroupAdminModal: React.FC<GroupAdminModalProps> = ({
    groupId,
    groupName,
    members: rawMembers,
    broadcastOnly: initialBroadcast = false,
    myRole = "Admin",
    onClose,
}) => {
    const { t } = useTranslation();
    const { contacts, fetchData, identity } = useRedStore();

    // Normalize incoming members (may be string[] or GroupMemberInfo[])
    const normalize = (raw: (string | GroupMemberInfo)[]): GroupMemberInfo[] =>
        raw.map((m) =>
            typeof m === "string"
                ? { identity_hash: m, role: "Member", muted: false }
                : { role: "Member", muted: false, ...m }
        );

    const [members, setMembers] = useState<GroupMemberInfo[]>(normalize(rawMembers || []));
    const [broadcastOnly, setBroadcastOnly] = useState(initialBroadcast);
    const [selectedNewContact, setSelectedNewContact] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [activeAction, setActiveAction] = useState<string | null>(null);

    const myHash = identity?.identity_hash || (typeof window !== "undefined" ? localStorage.getItem("red_identity_hash") : "") || "";
    const myMember = members.find((m) => m.identity_hash?.toLowerCase() === myHash?.toLowerCase());
    const effectiveRole: GroupRole = myMember?.role || myRole || (members.length > 0 && members[0].identity_hash?.toLowerCase() === myHash?.toLowerCase() ? "Admin" : "Member");

    const isAdmin = effectiveRole === "Admin";
    const isModerator = effectiveRole === "Admin" || effectiveRole === "Moderator";

    const getContactName = (hash: string) =>
        contacts.find((c) => c.identity_hash === hash)?.display_name || hash.substring(0, 10) + "…";

    const availableContacts = contacts.filter(
        (c) => !members.some((m) => m.identity_hash === c.identity_hash)
    );

    const handleLeaveGroup = async () => {
        if (!window.confirm("¿Seguro que deseas abandonar este escuadrón?")) return;
        setIsUpdating(true);
        try {
            await RedAPI.leaveGroup(groupId);
            toast.info("Has abandonado el escuadrón");
            onClose?.();
            await fetchData();
        } catch {
            toast.error("Error al abandonar el escuadrón");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleAddMember = async () => {
        if (!selectedNewContact) return;
        setIsUpdating(true);
        try {
            await RedAPI.addGroupMember(groupId, selectedNewContact);
            const name = getContactName(selectedNewContact);
            setMembers((prev) => [...prev, { identity_hash: selectedNewContact, role: "Member", muted: false }]);
            setSelectedNewContact("");
            toast.success(`✅ ${name} agregado al escuadrón`);
            await fetchData();
        } catch {
            toast.error("Error al agregar miembro");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemoveMember = async (hash: string) => {
        if (!isModerator) { toast.error("Sin permisos suficientes"); return; }
        setActiveAction(`remove_${hash}`);
        try {
            await RedAPI.removeGroupMember(groupId, hash);
            setMembers((prev) => prev.filter((m) => m.identity_hash !== hash));
            toast.info(`👤 Miembro removido del escuadrón`);
            await fetchData();
        } catch {
            toast.error("Error al remover miembro");
        } finally {
            setActiveAction(null);
        }
    };

    const handleSetRole = async (hash: string, role: GroupRole) => {
        if (!isAdmin) { toast.error("Solo los Admins pueden cambiar roles"); return; }
        setActiveAction(`role_${hash}`);
        try {
            await RedAPI.setGroupMemberRole(groupId, hash, role);
            setMembers((prev) =>
                prev.map((m) => m.identity_hash === hash ? { ...m, role } : m)
            );
            toast.success(`${ROLE_LABELS[role]} asignado a ${getContactName(hash)}`);
        } catch {
            toast.error("Error al cambiar rol");
        } finally {
            setActiveAction(null);
        }
    };

    const handleMute = async (hash: string, muted: boolean) => {
        if (!isModerator) { toast.error("Sin permisos suficientes"); return; }
        setActiveAction(`mute_${hash}`);
        try {
            await RedAPI.muteGroupMember(groupId, hash, muted);
            setMembers((prev) =>
                prev.map((m) => m.identity_hash === hash ? { ...m, muted } : m)
            );
            toast.info(muted ? "🔇 Miembro silenciado" : "🔊 Miembro des-silenciado");
        } catch {
            toast.error("Error al silenciar");
        } finally {
            setActiveAction(null);
        }
    };

    const handleToggleBroadcast = async () => {
        if (!isAdmin) { toast.error("Solo los Admins pueden cambiar el modo de canal"); return; }
        const next = !broadcastOnly;
        try {
            await RedAPI.setGroupBroadcastMode(groupId, next);
            setBroadcastOnly(next);
            toast.success(next ? "📢 Modo Canal de Difusión activado" : "💬 Modo conversación activado");
        } catch {
            toast.error("Error al cambiar modo de canal");
        }
    };

    const handleRequestHistory = useCallback(async () => {
        setActiveAction("dtn_sync");
        try {
            const since = Date.now() / 1000 - 86400 * 7; // Last 7 days
            await RedAPI.requestGroupHistory(groupId, since, 100);
            toast.success("📡 Solicitud DTN enviada — el historial llegará vía Mesh");
        } catch {
            toast.error("Error al solicitar historial DTN");
        } finally {
            setActiveAction(null);
        }
    }, [groupId]);

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(4, 6, 12, 0.88)", backdropFilter: "blur(18px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
                overflowY: "auto",
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter"
                style={{
                    width: "100%", maxWidth: "460px", padding: "20px",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
                    display: "flex", flexDirection: "column", gap: "16px",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>⚙️ Admin de Grupo</h2>
                        <div style={{ fontSize: "0.7rem", color: "var(--accent-cyan)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                            {groupName} · {ROLE_LABELS[myRole]}
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32, flexShrink: 0 }}>✕</button>
                </div>

                {/* Broadcast channel toggle */}
                {isAdmin && (
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: "var(--radius-sm)",
                        background: broadcastOnly ? "rgba(255,60,95,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${broadcastOnly ? "rgba(255,60,95,0.4)" : "var(--glass-border)"}`,
                        cursor: "pointer",
                    }}
                        onClick={handleToggleBroadcast}
                    >
                        <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                                📢 Canal de Difusión
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                {broadcastOnly
                                    ? "Activo — solo Admins y Moderadores pueden enviar"
                                    : "Inactivo — todos los miembros pueden enviar"}
                            </div>
                        </div>
                        <div style={{
                            width: 36, height: 20, borderRadius: 12,
                            background: broadcastOnly ? "var(--accent-crimson)" : "rgba(255,255,255,0.2)",
                            position: "relative", transition: "background 0.2s",
                        }}>
                            <div style={{
                                position: "absolute", top: 2,
                                left: broadcastOnly ? 16 : 2,
                                width: 16, height: 16, borderRadius: "50%",
                                background: "#fff", transition: "left 0.2s",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                            }} />
                        </div>
                    </div>
                )}

                {/* DTN History Sync */}
                {isModerator && (
                    <button
                        className="btn-tactical-primary"
                        onClick={handleRequestHistory}
                        disabled={activeAction === "dtn_sync"}
                        style={{ fontSize: "0.8rem", padding: "8px 14px", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}
                    >
                        {activeAction === "dtn_sync" ? "📡 Sincronizando…" : "📡 Sincronizar Historial DTN (7d)"}
                    </button>
                )}

                {/* Add member */}
                {isModerator && (
                    <div>
                        <label style={{
                            fontSize: "0.65rem", color: "var(--text-muted)",
                            textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.5px",
                            display: "block", marginBottom: "6px"
                        }}>
                            Agregar Miembro
                        </label>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <select
                                value={selectedNewContact}
                                onChange={(e) => setSelectedNewContact(e.target.value)}
                                style={{
                                    flex: 1, padding: "8px 10px", borderRadius: "var(--radius-sm)",
                                    background: "var(--bg-card)", color: "#fff",
                                    border: "1px solid var(--glass-border)", outline: "none", fontSize: "0.82rem"
                                }}
                            >
                                <option value="">Seleccionar contacto…</option>
                                {availableContacts.map((c) => (
                                    <option key={c.identity_hash} value={c.identity_hash}>
                                        {c.display_name || c.identity_hash.substring(0, 10)}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleAddMember}
                                disabled={!selectedNewContact || isUpdating}
                                className="btn-tactical-primary"
                                style={{ padding: "8px 12px", fontSize: "0.78rem" }}
                            >
                                Agregar
                            </button>
                        </div>
                    </div>
                )}

                {/* Members list */}
                <div>
                    <label style={{
                        fontSize: "0.65rem", color: "var(--text-muted)",
                        textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.5px",
                        display: "block", marginBottom: "8px"
                    }}>
                        Integrantes ({members.length})
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
                        {members.map((m) => {
                            const name = m.display_name || getContactName(m.identity_hash);
                            const role = m.role || "Member";
                            const isBusy = activeAction === `role_${m.identity_hash}` ||
                                activeAction === `mute_${m.identity_hash}` ||
                                activeAction === `remove_${m.identity_hash}`;

                            return (
                                <div
                                    key={m.identity_hash}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "8px",
                                        padding: "8px 10px", borderRadius: "var(--radius-sm)",
                                        background: "rgba(255,255,255,0.03)",
                                        border: `1px solid ${m.muted ? "rgba(255,100,0,0.3)" : "var(--glass-border)"}`,
                                        opacity: isBusy ? 0.7 : 1,
                                        transition: "opacity 0.15s",
                                    }}
                                >
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "0.84rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {m.muted && <span style={{ marginRight: 4, color: "rgba(255,140,0,0.9)" }}>🔇</span>}
                                            {name}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: ROLE_COLORS[role], fontFamily: "JetBrains Mono, monospace" }}>
                                                {ROLE_LABELS[role]}
                                            </span>
                                            <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                {m.identity_hash.substring(0, 8)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Role selector (Admin only) */}
                                    {isAdmin && (
                                        <select
                                            value={role}
                                            onChange={(e) => handleSetRole(m.identity_hash, e.target.value as GroupRole)}
                                            disabled={isBusy}
                                            title="Cambiar rol"
                                            style={{
                                                padding: "3px 6px", borderRadius: "6px",
                                                background: "var(--bg-card)", color: "#fff",
                                                border: "1px solid var(--glass-border)", fontSize: "0.68rem",
                                                fontWeight: 700, cursor: "pointer", outline: "none"
                                            }}
                                        >
                                            <option value="Admin">👑 Admin</option>
                                            <option value="Moderator">🛡️ Mod</option>
                                            <option value="Member">👤 Miembro</option>
                                            <option value="ReadOnly">👁️ Solo Lectura</option>
                                        </select>
                                    )}

                                    {/* Mute / Unmute */}
                                    {isModerator && (
                                        <button
                                            onClick={() => handleMute(m.identity_hash, !m.muted)}
                                            disabled={isBusy}
                                            className="btn-icon"
                                            style={{ width: 28, height: 28, fontSize: "0.75rem", color: m.muted ? "rgba(255,140,0,0.9)" : "var(--text-muted)" }}
                                            title={m.muted ? "Activar envío" : "Silenciar"}
                                        >
                                            {m.muted ? "🔊" : "🔇"}
                                        </button>
                                    )}

                                    {/* Remove */}
                                    {isModerator && (
                                        <button
                                            onClick={() => handleRemoveMember(m.identity_hash)}
                                            disabled={isBusy}
                                            className="btn-icon"
                                            style={{ width: 28, height: 28, color: "var(--accent-crimson)" }}
                                            title="Expulsar"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Leave Group Action Button */}
                <div style={{ paddingTop: "8px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end" }}>
                    <button
                        onClick={handleLeaveGroup}
                        disabled={isUpdating}
                        className="btn-tactical-secondary"
                        style={{
                            padding: "8px 16px",
                            fontSize: "0.78rem",
                            color: "var(--accent-crimson, #FF3C5F)",
                            borderColor: "rgba(255, 60, 95, 0.4)",
                            background: "rgba(255, 60, 95, 0.08)",
                            fontWeight: 700
                        }}
                    >
                        🚪 Abandonar Escuadrón
                    </button>
                </div>
            </div>
        </div>
    );
};
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

interface LocalMember {
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    isMuted: boolean;
}

export default function GroupAdminPage() {
    const { groups, contacts, identity, displayName } = useRedStore();

    const activeGroup = groups[0] ?? null;

    // Build the real member list from the store
    const initialMembers: LocalMember[] = useMemo(() => {
        if (!activeGroup) return [{ id: "me", name: displayName, role: "owner", isMuted: false }];
        return activeGroup.members.map((memberId) => {
            const contact = contacts.find(c => c.identity_hash === memberId || c.id === memberId);
            const isMe = memberId === identity?.identity_hash;
            return {
                id: memberId,
                name: isMe ? displayName : (contact?.displayName ?? memberId.substring(0, 12)),
                role: memberId === activeGroup.owner ? "owner" : "member",
                isMuted: false,
            };
        });
    }, [activeGroup, contacts, identity, displayName]);

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(activeGroup?.id ?? null);
    const currentGroup = groups.find(g => g.id === selectedGroupId) ?? activeGroup;

    const [members, setMembers] = useState<LocalMember[]>(initialMembers);
    const [groupName, setGroupName] = useState(currentGroup?.name ?? "Nuevo Grupo");
    const [editingName, setEditingName] = useState(false);
    const [action, setAction] = useState<{ memberId: string; type: "kick" | "mute" | "promote" | "demote" } | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const promote = (id: string) => {
        setMembers(ms => ms.map(m => m.id === id ? { ...m, role: m.role === "member" ? "admin" : m.role } : m));
        showToast("✅ Miembro promovido a admin");
        setAction(null);
    };

    const demote = (id: string) => {
        setMembers(ms => ms.map(m => m.id === id ? { ...m, role: "member" } : m));
        showToast("⬇️ Rol removido");
        setAction(null);
    };

    const muteToggle = (id: string) => {
        setMembers(ms => ms.map(m => m.id === id ? { ...m, isMuted: !m.isMuted } : m));
        const m = members.find(m => m.id === id);
        showToast(m?.isMuted ? "🔔 Miembro reactivado" : "🔇 Miembro silenciado");
        setAction(null);
    };

    const kick = (id: string) => {
        setMembers(ms => ms.filter(m => m.id !== id));
        showToast("🚫 Miembro expulsado");
        setAction(null);
    };

    const roleColor = (role: string) => role === "owner" ? "#ff1744" : role === "admin" ? "#ff9800" : "var(--text-muted)";
    const roleLabel = (role: string) => role === "owner" ? "👑 Propietario" : role === "admin" ? "🛡️ Admin" : "👤 Miembro";

    return (
        <main className="group-admin-page bg-dark">
            <header className="mobile-settings-header">
                <Link href="/settings" className="back-btn">←</Link>
                <h2>👥 Admin del Grupo</h2>
            </header>

            {/* Group selector (if multiple groups) */}
            {groups.length > 1 && (
                <div className="sync-method-tabs" style={{ margin: '0 1rem 0.5rem', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '0.25rem', display: 'flex' }}>
                    {groups.map(g => (
                        <button
                            key={g.id}
                            className={selectedGroupId === g.id ? "active" : ""}
                            onClick={() => { setSelectedGroupId(g.id); setGroupName(g.name); }}
                        >
                            {g.name}
                        </button>
                    ))}
                </div>
            )}

            {/* No groups empty state */}
            {groups.length === 0 && (
                <div className="empty-state-full animate-fade" style={{ margin: '2rem 1rem', background: 'var(--surface-2)', padding: '2rem', borderRadius: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>👥</span>
                    <h3 style={{ color: 'var(--text-primary)' }}>Sin grupos activos</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Crea un grupo desde la pantalla principal de chat para administrarlo aquí.
                    </p>
                </div>
            )}

            {/* Group info */}
            {currentGroup && (
                <>
                    <section className="group-admin-info" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.5rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--glass-border)' }}>
                        <div className="group-admin-avatar" style={{ width: '64px', height: '64px', background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>#</div>
                        {editingName ? (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", width: "100%" }}>
                                <input className="displayname-input" value={groupName} onChange={e => setGroupName(e.target.value)} autoFocus />
                                <button className="btn-primary-small" onClick={() => setEditingName(false)}>✓</button>
                            </div>
                        ) : (
                            <h3 onClick={() => setEditingName(true)} style={{ cursor: "pointer" }}>{groupName} ✏️</h3>
                        )}
                        <p className="group-admin-stats">{members.length} miembros · {members.filter(m => m.role !== "member").length} admins</p>
                    </section>

                    {/* Members list */}
                    <section className="group-members-list">
                        <p className="section-title" style={{ padding: "0.5rem 1rem" }}>Miembros</p>
                        {members.map(m => (
                            <div key={m.id} className="group-member-item" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--bg)', padding: '0.8rem 1rem' }}>
                                <div className="group-member-avatar">{m.name[0]?.toUpperCase() ?? '?'}</div>
                                <div className="group-member-info">
                                    <span className="group-member-name">{m.name} {m.id === "me" || m.id === identity?.identity_hash ? "(Tú)" : ""}</span>
                                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                        <span className="group-member-role" style={{ color: roleColor(m.role) }}>{roleLabel(m.role)}</span>
                                        {m.isMuted && <span className="group-muted-badge">🔇</span>}
                                    </div>
                                </div>
                                {(m.id !== "me" && m.id !== identity?.identity_hash) && m.role !== "owner" && (
                                    <button className="group-member-menu" onClick={() => setAction(action?.memberId === m.id ? null : { memberId: m.id, type: "kick" })}>⋮</button>
                                )}
                                {action?.memberId === m.id && (
                                    <div className="ctx-menu animate-fade" style={{ background: 'var(--surface-strong)', borderRadius: '8px', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-lg)', right: "0.5rem", top: "100%", zIndex: 200 }}>
                                        {m.role === "member" && <button onClick={() => promote(m.id)}>🛡️ Promover a admin</button>}
                                        {m.role === "admin" && <button onClick={() => demote(m.id)}>⬇️ Remover admin</button>}
                                        <button onClick={() => muteToggle(m.id)}>{m.isMuted ? "🔔 Reactivar" : "🔇 Silenciar"}</button>
                                        <button className="danger" onClick={() => kick(m.id)}>🚫 Expulsar</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </section>

                    {/* Danger zone */}
                    <section className="group-danger-zone" style={{ margin: '1rem', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(255, 23, 68, 0.2)', background: 'rgba(255, 23, 68, 0.03)' }}>
                        <h4>⚠️ Zona peligrosa</h4>
                        <button className="danger-btn" onClick={() => showToast("🚫 Grupo disuelto")}>Disolver grupo</button>
                    </section>
                </>
            )}

            {/* Toast */}
            {toast && <div className="group-toast animate-fade" style={{ background: 'var(--primary)', color: '#fff', padding: '0.8rem 1.5rem', borderRadius: '24px', position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, boxShadow: 'var(--shadow-lg)' }}>{toast}</div>}
        </main>
    );
}

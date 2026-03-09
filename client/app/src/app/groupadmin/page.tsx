"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRedStore } from "../../store/useRedStore";

interface GroupMember {
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    isMuted: boolean;
}

export default function GroupAdminPage() {
    const { groups, identity, displayName } = useRedStore();

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [members, setMembers] = useState<GroupMember[]>([
        { id: "me", name: displayName, role: "owner", isMuted: false },
        { id: "m1", name: "Satoshi Nakamoto", role: "admin", isMuted: false },
        { id: "m2", name: "Alice (RED Dev)", role: "member", isMuted: false },
        { id: "m3", name: "Bob (Gossip Node)", role: "member", isMuted: true },
        { id: "m4", name: "Charlie (Auditor)", role: "member", isMuted: false },
    ]);
    const [groupName, setGroupName] = useState("RED Developers");
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
            <header className="mobile-settings-header glass">
                <Link href="/chat" className="back-btn">←</Link>
                <h2>👥 Admin del Grupo</h2>
            </header>

            {/* Group info */}
            <section className="group-admin-info glass">
                <div className="group-admin-avatar">#</div>
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
                    <div key={m.id} className="group-member-item glass">
                        <div className="group-member-avatar">{m.name[0]}</div>
                        <div className="group-member-info">
                            <span className="group-member-name">{m.name} {m.id === "me" ? "(Tú)" : ""}</span>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                <span className="group-member-role" style={{ color: roleColor(m.role) }}>{roleLabel(m.role)}</span>
                                {m.isMuted && <span className="group-muted-badge">🔇</span>}
                            </div>
                        </div>
                        {m.id !== "me" && m.role !== "owner" && (
                            <button className="group-member-menu" onClick={() => setAction(action?.memberId === m.id ? null : { memberId: m.id, type: "kick" })}>⋮</button>
                        )}
                        {action?.memberId === m.id && (
                            <div className="ctx-menu glass animate-fade" style={{ right: "0.5rem", top: "100%", zIndex: 200 }}>
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
            <section className="group-danger-zone glass">
                <h4>⚠️ Zona peligrosa</h4>
                <button className="danger-btn" onClick={() => showToast("🚫 Grupo disuelto")}>Disolver grupo</button>
            </section>

            {/* Toast */}
            {toast && <div className="group-toast glass animate-fade">{toast}</div>}
        </main>
    );
}

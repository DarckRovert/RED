"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { toast } from "./Toast";

interface GroupAdminModalProps {
    groupId: string;
    groupName: string;
    members: string[];
    onClose?: () => void;
}

export const GroupAdminModal: React.FC<GroupAdminModalProps> = ({
    groupId,
    groupName,
    members: initialMembers,
    onClose
}) => {
    const { contacts, fetchData } = useRedStore();
    const [members, setMembers] = useState<string[]>(initialMembers || []);
    const [selectedNewContact, setSelectedNewContact] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);

    const availableContacts = contacts.filter(c => !members.includes(c.identity_hash));

    const handleAddMember = async () => {
        if (!selectedNewContact) return;
        setIsUpdating(true);
        try {
            const nextMembers = [...members, selectedNewContact];
            await RedAPI.req(`/groups/${groupId}`, {
                method: "PUT",
                body: JSON.stringify({ members: nextMembers })
            });

            setMembers(nextMembers);
            setSelectedNewContact("");
            toast.success("Miembro agregado al escuadrón P2P");
            await fetchData();
        } catch {
            toast.error("Error al actualizar integrantes");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemoveMember = async (hash: string) => {
        setIsUpdating(true);
        try {
            const nextMembers = members.filter(m => m !== hash);
            await RedAPI.req(`/groups/${groupId}`, {
                method: "PUT",
                body: JSON.stringify({ members: nextMembers })
            });

            setMembers(nextMembers);
            toast.info("Miembro removido del escuadrón");
            await fetchData();
        } catch {
            toast.error("Error al actualizar integrantes");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(4, 6, 12, 0.85)", backdropFilter: "blur(16px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter"
                style={{
                    width: "100%", maxWidth: "440px", padding: "20px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)"
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>⚙️ Administración de Grupo</h2>
                        <div style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
                            {groupName} · SENDER-KEY FEDERATION
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ width: 34, height: 34 }}>✕</button>
                </div>

                {/* Add member row */}
                <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                        Agregar Miembro al Escuadrón
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <select
                            value={selectedNewContact}
                            onChange={e => setSelectedNewContact(e.target.value)}
                            style={{
                                flex: 1, padding: "8px 12px", borderRadius: "var(--radius-sm)",
                                background: "var(--bg-card)", color: "#fff",
                                border: "1px solid var(--glass-border)", outline: "none",
                                fontSize: "0.85rem"
                            }}
                        >
                            <option value="">Seleccionar contacto verificado...</option>
                            {availableContacts.map(c => (
                                <option key={c.identity_hash} value={c.identity_hash}>
                                    {c.display_name || c.identity_hash.substring(0, 8)}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddMember}
                            disabled={!selectedNewContact || isUpdating}
                            className="btn-tactical-primary"
                            style={{ padding: "8px 14px", fontSize: "0.80rem" }}
                        >
                            Agregar
                        </button>
                    </div>
                </div>

                {/* Members list */}
                <div>
                    <label style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                        Integrantes ({members.length})
                    </label>
                    <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {members.map(m => {
                            const contact = contacts.find(c => c.identity_hash === m);
                            const name = contact?.display_name || m.substring(0, 8);
                            return (
                                <div
                                    key={m}
                                    style={{
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.03)",
                                        border: "1px solid var(--glass-border)"
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>{name}</div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {m.substring(0, 12)}…
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveMember(m)}
                                        disabled={isUpdating}
                                        className="btn-icon"
                                        style={{ width: 28, height: 28, color: "var(--accent-crimson)" }}
                                        title="Remover"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { toast } from "./Toast";

interface GroupAdminModalProps {
    groupId: string;
    groupName: string;
    members: string[];
    onClose: () => void;
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
                method: 'PUT',
                body: JSON.stringify({ members: nextMembers })
            }).catch(() => {});
            
            setMembers(nextMembers);
            setSelectedNewContact("");
            toast.success("✅ Miembro agregado al grupo P2P");
            await fetchData();
        } catch {
            toast.error("❌ Error al actualizar integrantes");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemoveMember = async (hash: string) => {
        setIsUpdating(true);
        try {
            const nextMembers = members.filter(m => m !== hash);
            await RedAPI.req(`/groups/${groupId}`, {
                method: 'PUT',
                body: JSON.stringify({ members: nextMembers })
            }).catch(() => {});

            setMembers(nextMembers);
            toast.info("🚫 Miembro removido del grupo P2P");
            await fetchData();
        } catch {
            toast.error("❌ Error al actualizar integrantes");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div 
            className="animate-fade"
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(5,5,12,0.85)', backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
            onClick={onClose}
        >
            <div 
                className="animate-pop glass-panel"
                style={{
                    width: '100%', maxWidth: '440px', padding: '24px',
                    borderRadius: '24px', background: 'linear-gradient(145deg, #0f0f1c, #0a0a14)',
                    border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 800 }}>⚙️ Administración de Grupo</h2>
                        <div style={{ fontSize: '0.78rem', color: 'var(--primary-bright)', fontWeight: 700, marginTop: '2px' }}>{groupName}</div>
                    </div>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                {/* Add member row */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                        Agregar Miembro al Escuadrón
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                            value={selectedNewContact}
                            onChange={e => setSelectedNewContact(e.target.value)}
                            style={{
                                flex: 1, padding: '10px 12px', borderRadius: '12px',
                                background: 'var(--bg-deep)', color: 'var(--text-primary)',
                                border: '1px solid var(--solid-border)', outline: 'none', fontSize: '0.88rem'
                            }}
                        >
                            <option value="">-- Seleccionar contacto --</option>
                            {availableContacts.map(c => (
                                <option key={c.identity_hash} value={c.identity_hash}>{c.display_name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleAddMember}
                            disabled={!selectedNewContact || isUpdating}
                            style={{
                                padding: '10px 16px', borderRadius: '12px',
                                background: 'var(--primary)', color: 'white', fontWeight: 700,
                                border: 'none', cursor: 'pointer', opacity: !selectedNewContact || isUpdating ? 0.4 : 1
                            }}
                        >
                            + Agregar
                        </button>
                    </div>
                </div>

                {/* Members list */}
                <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                        Integrantes Activos ({members.length})
                    </label>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }} className="scroll-container no-scrollbar">
                        {members.map(hash => {
                            const contact = contacts.find(c => c.identity_hash === hash);
                            const name = contact?.display_name || `${hash.substring(0, 10)}…`;
                            return (
                                <div key={hash} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-lifted)', borderRadius: '12px', border: '1px solid var(--solid-border)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{name}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{hash.substring(0, 16)}…</div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveMember(hash)}
                                        disabled={isUpdating}
                                        style={{
                                            padding: '4px 8px', borderRadius: '6px',
                                            background: 'rgba(232,33,58,0.15)', color: '#ff4444',
                                            border: '1px solid rgba(232,33,58,0.3)', cursor: 'pointer',
                                            fontSize: '0.72rem', fontWeight: 700
                                        }}
                                    >
                                        Expulsar
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

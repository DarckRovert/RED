"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

export default function GroupsPanel() {
    const { contacts, groups, goBack, fetchData } = useRedStore();
    const [groupName, setGroupName] = useState("");
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [creationStatus, setCreationStatus] = useState("");

    const toggleContact = (hash: string) => {
        if (selectedContacts.includes(hash)) setSelectedContacts(selectedContacts.filter(c => c !== hash));
        else setSelectedContacts([...selectedContacts, hash]);
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return;
        setCreationStatus("Sincronizando llaves compartidas (SenderKey)...");
        try {
            await RedAPI.req('/groups', {
                method: 'POST',
                body: JSON.stringify({ name: groupName, members: selectedContacts })
            });
            setCreationStatus("Grupo federado con éxito.");
            await fetchData();
            setTimeout(() => goBack(), 1500);
        } catch (e) {
            console.error("Group creation failed natively", e);
            setCreationStatus("Error al crear el grupo.");
        }
    };

    return (
        <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <button onClick={goBack} style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>←</button>
                <div>
                    <h1 style={{ fontSize: '1.8rem', margin: 0, color: 'var(--text-primary)' }}>👥 Grupos P2P</h1>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Chats federados mediante Signal Protocol</span>
                </div>
            </div>

            {/* Create Group Form */}
            <div style={{ background: 'var(--solid-bg)', padding: '20px', borderRadius: '16px', marginBottom: '24px', border: '1px solid var(--solid-border)' }}>
                <h3 style={{ marginTop: 0, color: 'white' }}>Nuevo Grupo Cifrado</h3>
                <input 
                    type="text" 
                    placeholder="Nombre del Escuadrón..." 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    style={{ 
                        width: '100%', background: 'var(--bg-lifted)', color: 'white', padding: '16px', 
                        borderRadius: '12px', border: 'none', outline: 'none', marginBottom: '16px', fontSize: '1.1rem'
                    }}
                />
                
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>Añadir Miembros ({selectedContacts.length})</h4>
                <div style={{ maxHeight: '150px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {contacts.map(c => (
                        <div 
                            key={c.identity_hash} 
                            onClick={() => toggleContact(c.identity_hash)}
                            style={{ 
                                display: 'flex', justifyContent: 'space-between', padding: '10px 16px', 
                                background: selectedContacts.includes(c.identity_hash) ? 'var(--primary-subtle)' : 'var(--bg-lifted)',
                                borderRadius: '8px', cursor: 'pointer'
                            }}
                        >
                            <span>{c.display_name}</span>
                            <span>{selectedContacts.includes(c.identity_hash) ? '✓' : '+'}</span>
                        </div>
                    ))}
                </div>

                <button 
                    className="btn-primary" 
                    onClick={handleCreateGroup} 
                    disabled={!groupName.trim() || selectedContacts.length === 0}
                    style={{ width: '100%', padding: '16px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', opacity: (!groupName.trim() || selectedContacts.length === 0) ? 0.5 : 1 }}
                >
                    Federar Contrato P2P
                </button>
                {creationStatus && <p style={{ color: 'var(--success)', textAlign: 'center', marginTop: '12px', fontWeight: 'bold' }}>{creationStatus}</p>}
            </div>

            {/* Existing Groups List */}
            <h3 style={{ color: 'var(--text-secondary)' }}>Tus Grupos Activos</h3>
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {groups.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No perteneces a ningún grupo.</p>
                ) : (
                    groups.map((g: any) => (
                        <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'var(--solid-bg)', marginBottom: '8px', borderRadius: '12px', border: '1px solid var(--solid-border)' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{g.name}</span>
                            <span style={{ color: 'var(--primary)' }}>{g.member_count} miembros</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

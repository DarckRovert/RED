"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

export default function GroupsPanel() {
    const { contacts, groups, goBack, navigate, fetchData } = useRedStore();
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
        <div style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', color: 'white', overflowY: 'auto' }} className="no-scrollbar">
            <header className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--solid-border)', borderRadius: '0 0 24px 24px', flexShrink: 0 }}>
                <button onClick={goBack} style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', padding: '8px' }}>←</button>
                <div>
                    <h1 style={{ fontSize: '1.6rem', margin: 0, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '1px' }}>GRUPOS P2P</h1>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '2px' }}>PROTOCOLO SIGNAL FEDERADO</span>
                </div>
            </header>

            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Create Group Form */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '20px', color: 'white', fontWeight: 700, fontSize: '1rem', letterSpacing: '1px' }}>NUEVO GRUPO CIFRADO</h3>
                    <input 
                        type="text" 
                        placeholder="Nombre del Escuadrón..." 
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        style={{ 
                            width: '100%', background: 'var(--bg-deep)', color: 'white', padding: '16px', 
                            borderRadius: '14px', border: '1px solid var(--solid-border)', outline: 'none', marginBottom: '20px', fontSize: '1.1rem', boxSizing: 'border-box'
                        }}
                    />
                    
                    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600, letterSpacing: '1px', fontSize: '0.85rem' }}>AÑADIR MIEMBROS ({selectedContacts.length})</h4>
                    <div className="no-scrollbar" style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {contacts.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '12px 0' }}>No hay contactos aún. Añade desde Radar P2P.</p>}
                        {contacts.map(c => (
                            <div 
                                key={c.identity_hash} 
                                onClick={() => toggleContact(c.identity_hash)}
                                style={{ 
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', 
                                    background: selectedContacts.includes(c.identity_hash) ? 'var(--primary-subtle)' : 'var(--bg-lifted)',
                                    border: `1px solid ${selectedContacts.includes(c.identity_hash) ? 'var(--solid-border-active)' : 'var(--solid-border)'}`,
                                    borderRadius: '12px', cursor: 'pointer',
                                    transition: 'all 0.25s var(--ease-spring)'
                                }}
                            >
                                <span style={{ fontWeight: 600 }}>{c.display_name}</span>
                                <span style={{ color: selectedContacts.includes(c.identity_hash) ? 'var(--primary)' : 'var(--text-muted)', fontSize: '1.2rem', fontWeight: 800 }}>{selectedContacts.includes(c.identity_hash) ? '✓' : '+'}</span>
                            </div>
                        ))}
                    </div>

                    <button 
                        className="btn-primary" 
                        onClick={handleCreateGroup} 
                        disabled={!groupName.trim() || selectedContacts.length === 0}
                        style={{ width: '100%', borderRadius: '14px', fontSize: '1rem', fontWeight: 700 }}
                    >
                        Federar Contrato P2P
                    </button>
                    {creationStatus && <p style={{ color: 'var(--success)', textAlign: 'center', marginTop: '12px', fontWeight: 700, letterSpacing: '1px', fontSize: '0.9rem' }}>{creationStatus}</p>}
                </div>

            <div>
                    <h3 style={{ color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.85rem', letterSpacing: '2px', fontWeight: 600 }}>GRUPOS ACTIVOS</h3>
                    {groups.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed var(--solid-border)', borderRadius: '16px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            No perteneces a ningún grupo todavía.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {groups.map((g: any) => (
                                <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-lifted)', borderRadius: '16px', border: '1px solid var(--solid-border)', gap: '12px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                                        <div style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, marginTop: 2 }}>{g.member_count || (g.members?.length ?? 0)} miembros</div>
                                    </div>
                                    <button
                                        onClick={() => { navigate('chat', g.id); }}
                                        style={{
                                            flexShrink: 0, padding: '8px 16px', borderRadius: '10px',
                                            background: 'linear-gradient(135deg, rgba(232,33,58,0.18), rgba(200,20,45,0.10))',
                                            border: '1px solid rgba(232,33,58,0.3)', color: 'var(--primary-bright)',
                                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(232,33,58,0.25)'; }}
                                        onMouseOut={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(232,33,58,0.18), rgba(200,20,45,0.10))'; }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                        </svg>
                                        Chat
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

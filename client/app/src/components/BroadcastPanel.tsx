"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";

export default function BroadcastPanel() {
    const { contacts, sendMessage, goBack } = useRedStore();
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    const toggleContact = (hash: string) => {
        if (selectedContacts.includes(hash)) {
            setSelectedContacts(selectedContacts.filter(c => c !== hash));
        } else {
            setSelectedContacts([...selectedContacts, hash]);
        }
    };

    const handleBroadcast = async () => {
        if (!message.trim() || selectedContacts.length === 0) return;
        setStatus("Cifrando payloads onion...");
        
        let successCount = 0;
        for (const hash of selectedContacts) {
            try {
                // To do this properly without breaking the active chat, we temporarily use the API
                const { RedAPI } = await import("../lib/api");
                await RedAPI.sendMessage(hash, message);
                successCount++;
            } catch (e) {
                console.error("Broadcast failed for", hash, e);
            }
        }
        
        setStatus(`Difusión completada: entregado a ${successCount} nodos.`);
        setTimeout(() => goBack(), 2000);
    };

    return (
        <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <button onClick={goBack} style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>←</button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h1 style={{ fontSize: '1.8rem', margin: 0, color: 'var(--text-primary)' }}>📢 Difusión Privada</h1>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Oculta remitentes con Onion Routing</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', borderRadius: '16px', background: 'var(--solid-bg)', padding: '16px' }}>
                <h3 style={{ marginTop: 0, color: 'var(--text-muted)' }}>1. Selecciona Destinatarios</h3>
                {contacts.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>No tienes contactos guardados en la libreta.</p>
                ) : (
                    contacts.map(c => (
                        <div 
                            key={c.identity_hash} 
                            onClick={() => toggleContact(c.identity_hash)}
                            style={{ 
                                display: 'flex', justifyContent: 'space-between', padding: '12px', 
                                borderBottom: '1px solid var(--solid-border)', cursor: 'pointer',
                                background: selectedContacts.includes(c.identity_hash) ? 'var(--primary-subtle)' : 'transparent',
                                borderRadius: '8px'
                            }}
                        >
                            <span>{c.display_name}</span>
                            <span style={{ color: selectedContacts.includes(c.identity_hash) ? 'var(--primary)' : 'var(--text-muted)' }}>
                                {selectedContacts.includes(c.identity_hash) ? '✓ Seleccionado' : '○'}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {selectedContacts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Escribe el mensaje de difusión..."
                        style={{ 
                            background: 'var(--bg-lifted)', color: 'white', padding: '16px', 
                            borderRadius: '16px', border: '1px solid var(--solid-border)',
                            minHeight: '120px', resize: 'none', outline: 'none', fontSize: '1.1rem'
                        }}
                    />
                    
                    {status && <p style={{ color: 'var(--success)', textAlign: 'center', fontWeight: 'bold' }}>{status}</p>}

                    <button 
                        onClick={handleBroadcast}
                        disabled={!message.trim()}
                        className="btn-primary"
                        style={{ padding: '16px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 'bold' }}
                    >
                        Enviar a {selectedContacts.length} contactos
                    </button>
                </div>
            )}
        </div>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
// FIX 1.7: RedAPI is a singleton — import at module level, not inside the loop.
// Dynamic import inside a for-loop causes repeated microtask scheduling.
import { RedAPI } from "../lib/api";

export default function BroadcastPanel() {
    const { contacts: rawContacts, sendMessage: _sendMessage, goBack } = useRedStore();
    const contacts = Array.isArray(rawContacts) ? rawContacts : [];
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
    const [successCount, setSuccessCount] = useState(0);
    const [inputFocused, setInputFocused] = useState(false);

    const toggleContact = (hash: string) => {
        setSelectedContacts(prev =>
            prev.includes(hash) ? prev.filter(c => c !== hash) : [...prev, hash]
        );
    };

    const handleBroadcast = async () => {
        if (!message.trim() || selectedContacts.length === 0) return;
        setStatus('sending');
        let count = 0;
        for (const hash of selectedContacts) {
            try {
                await RedAPI.sendMessage(hash, message);
                count++;
            } catch (e) {
                console.error("Broadcast failed for", hash, e);
            }
        }
        setSuccessCount(count);
        setStatus('done');
        setTimeout(() => goBack(), 2500);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>

            {/* Header */}
            <header className="glass-panel" style={{
                padding: '0 20px', height: 'var(--header-h)',
                display: 'flex', alignItems: 'center', gap: '16px',
                borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                borderTop: 'none', flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(15,15,24,0.98) 0%, rgba(8,8,16,0.98) 100%)',
            }}>
                <button onClick={goBack} className="btn-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, #1a0010, var(--primary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', boxShadow: '0 4px 16px rgba(232,33,58,0.4)',
                }}>📢</div>
                <div>
                    <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Difusión Privada</h2>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>Onion Routing · Remitente oculto · Multi-hop</p>
                </div>
                {selectedContacts.length > 0 && (
                    <div style={{
                        marginLeft: 'auto', padding: '4px 10px', borderRadius: '20px',
                        background: 'var(--primary-subtle)', border: '1px solid var(--glass-border-active)',
                        color: 'var(--primary-bright)', fontSize: '0.78rem', fontWeight: 700,
                    }}>
                        {selectedContacts.length} seleccionado{selectedContacts.length > 1 ? 's' : ''}
                    </div>
                )}
            </header>

            {/* Contact selector */}
            <div className="scroll-container no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

                {/* Step label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 900, color: 'white', flexShrink: 0,
                    }}>1</div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Selecciona Destinatarios
                    </span>
                </div>

                {contacts.length === 0 ? (
                    <div style={{
                        padding: '40px 20px', textAlign: 'center',
                        border: '1px dashed var(--solid-border)', borderRadius: 'var(--radius-md)',
                        color: 'var(--text-muted)', fontSize: '0.88rem',
                    }}>
                        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📇</div>
                        <div>Sin contactos guardados</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '6px', opacity: 0.7 }}>Agrega contactos primero en la libreta</div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {contacts.map((c: any, i: number) => {
                            const selected = selectedContacts.includes(c.identity_hash);
                            return (
                                <div
                                    key={c.identity_hash}
                                    onClick={() => toggleContact(c.identity_hash)}
                                    className="animate-enter"
                                    style={{
                                        display: 'flex', alignItems: 'center', padding: '12px 14px', gap: '14px',
                                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                        background: selected ? 'rgba(232,33,58,0.10)' : 'var(--bg-lifted)',
                                        border: `1px solid ${selected ? 'rgba(232,33,58,0.35)' : 'var(--solid-border)'}`,
                                        transition: 'all var(--dur-fast) var(--ease-smooth)',
                                        animationDelay: `${i * 40}ms`,
                                    }}
                                >
                                    {/* Selection circle */}
                                    <div style={{
                                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                        border: `2px solid ${selected ? 'var(--primary)' : 'var(--solid-border)'}`,
                                        background: selected ? 'var(--primary)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all var(--dur-fast) var(--ease-spring)',
                                        boxShadow: selected ? '0 0 8px var(--primary-glow)' : 'none',
                                    }}>
                                        {selected && (
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                                <path d="M1 3.5L3.5 6L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{c.display_name}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                                            {c.identity_hash?.slice(0, 20)}…
                                        </div>
                                    </div>

                                    {selected && (
                                        <span style={{
                                            fontSize: '10px', padding: '2px 8px', borderRadius: '6px',
                                            background: 'rgba(232,33,58,0.12)', color: 'var(--primary-bright)',
                                            border: '1px solid rgba(232,33,58,0.2)', fontWeight: 700,
                                        }}>DEST.</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Message composer — appears when contacts selected */}
                {selectedContacts.length > 0 && (
                    <div className="animate-slide" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <div style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.72rem', fontWeight: 900, color: 'white', flexShrink: 0,
                            }}>2</div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Redacta el Mensaje
                            </span>
                        </div>

                        <div style={{
                            borderRadius: 'var(--radius-md)', overflow: 'hidden',
                            border: `1px solid ${inputFocused ? 'rgba(232,33,58,0.45)' : 'var(--solid-border)'}`,
                            boxShadow: inputFocused ? '0 0 0 3px rgba(232,33,58,0.10)' : 'none',
                            transition: 'all var(--dur-fast) var(--ease-smooth)',
                        }}>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                onFocus={() => setInputFocused(true)}
                                onBlur={() => setInputFocused(false)}
                                placeholder="Escribe el mensaje de difusión…"
                                style={{
                                    width: '100%', background: 'var(--bg-lifted)', color: 'var(--text-primary)',
                                    padding: '14px', border: 'none', outline: 'none',
                                    minHeight: '110px', resize: 'none', fontSize: '0.97rem',
                                    fontFamily: 'inherit', lineHeight: 1.5, display: 'block',
                                    borderRadius: 'var(--radius-md)',
                                }}
                            />
                        </div>

                        {/* Status feedback */}
                        {status === 'sending' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--warning)', fontSize: '0.85rem', fontWeight: 600 }}>
                                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--warning)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                Cifrando payloads onion… {selectedContacts.length} nodos
                            </div>
                        )}
                        {status === 'done' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--success)', fontSize: '0.88rem', fontWeight: 600, background: 'rgba(0,217,126,0.08)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,217,126,0.2)' }}>
                                    ✓ Enviado al nodo local — {successCount}/{selectedContacts.length} en cola de entrega P2P
                                </div>
                                {successCount < selectedContacts.length && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--warning)', padding: '4px 0 0 2px' }}>
                                        ⚠ {selectedContacts.length - successCount} no pudieron encolarse. El nodo intentará reenviarlos cuando el par sea alcanzable.
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleBroadcast}
                            disabled={!message.trim() || status === 'sending'}
                            className="btn-primary"
                            style={{ padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '0.98rem', gap: '10px' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                            Difundir a {selectedContacts.length} contacto{selectedContacts.length > 1 ? 's' : ''}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

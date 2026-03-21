"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export default function Sidebar() {
    const { 
        identity, 
        conversations, 
        contacts,
        nodeOnline,
        navigate 
    } = useRedStore();

    const [activeTab, setActiveTab] = useState<'chats'|'groups'|'contacts'>('chats');
    const [searchQuery, setSearchQuery] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);

    // Bulletproof filters
    const filteredConvs = (conversations || []).filter(c => 
        (c?.peer || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-surface)' }}>
            
            {/* Context Menu Overlay */}
            {menuOpen && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)}>
                    <div className="glass-panel animate-enter" style={{ position: 'absolute', top: 60, right: 16, width: 220, borderRadius: 12, overflow: 'hidden', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
                        <button style={{ padding: '14px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }} onClick={() => navigate('contacts')}>👤 Nuevo contacto</button>
                        <button style={{ padding: '14px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }} onClick={() => navigate('status')}>✨ Estados</button>
                        <button style={{ padding: '14px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }} onClick={() => navigate('broadcast')}>📢 Difusión</button>
                        <button style={{ padding: '14px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }} onClick={() => navigate('crypto')}>🔐 Bóveda Criptográfica</button>
                        <button style={{ padding: '14px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }} onClick={() => navigate('explorer')}>🔗 Omega Protocol L1</button>
                        <button style={{ padding: '14px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)' }} onClick={() => navigate('network')}>🛰️ Red & Emisión</button>
                        <button style={{ padding: '14px', textAlign: 'left', background: 'transparent', color: 'var(--text-primary)' }} onClick={() => navigate('settings')}>⚙️ Ajustes Avanzados</button>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <img src="/red_icon.png" alt="RED Logo" style={{ width: 40, height: 40, filter: 'drop-shadow(0 0 8px var(--primary-glow))' }} />
                        <div style={{
                            position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7,
                            background: nodeOnline ? '#2ecc71' : 'var(--danger)',
                            border: '2px solid var(--bg-surface)', boxShadow: '0 0 4px rgba(0,0,0,0.5)'
                        }} />
                    </div>

                    <div>
                        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>RED</h2>
                        <p style={{ fontSize: '0.75rem', color: nodeOnline ? 'var(--primary)' : 'var(--danger)', textShadow: nodeOnline ? '0 0 8px var(--primary-glow)' : 'none' }}>
                            {nodeOnline ? (identity ? identity.short_id : 'Conectado') : 'Offline (Buscando pares...)'}
                        </p>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--glass-highlight)', color: 'white', display: 'flex', alignItems:'center', justifyContent:'center' }}>🔍</button>
                    <button onClick={() => setMenuOpen(true)} style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--glass-highlight)', color: 'white', display: 'flex', alignItems:'center', justifyContent:'center' }}>⋮</button>
                </div>
            </header>

            {/* Tabs */}
            <nav style={{ display: 'flex', padding: '12px 16px', gap: '8px' }}>
                {['chats', 'groups', 'contacts'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        style={{
                            padding: '8px 16px', borderRadius: 999, fontSize: '0.9rem', fontWeight: 600, textTransform: 'capitalize',
                            background: activeTab === tab ? 'var(--primary-subtle)' : 'transparent',
                            color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </nav>

            {/* Chat List */}
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                {activeTab === 'chats' && filteredConvs.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Sin Chats Activos</h3>
                        <p style={{ fontSize: '0.9rem', marginBottom: '24px' }}>Escanea el código QR de un par para iniciar una comunicación cifrada e2e.</p>
                        <button onClick={() => navigate('contacts')} className="btn-primary" style={{ padding: '10px 20px', borderRadius: 999, fontSize: '0.9rem' }}>
                            Agregar Contacto
                        </button>
                    </div>
                )}
                
                {activeTab === 'groups' && (
                    <div style={{ padding: '16px' }}>
                        <button onClick={() => navigate('groupAdmin')} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
                            + Administrar Grupos P2P
                        </button>
                    </div>
                )}
                
                {activeTab === 'chats' && filteredConvs.map(chat => (
                    <div key={chat.id} 
                         onClick={() => navigate('chat', chat.id)}
                         style={{ display: 'flex', alignItems: 'center', padding: '12px', gap: '16px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' }}
                         onMouseOver={e => e.currentTarget.style.background = 'var(--glass-highlight)'}
                         onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ width: 48, height: 48, borderRadius: 24, background: '#1c2833', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 600, flexShrink: 0 }}>
                            {chat.peer.substring(0, 1).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{chat.peer}</span>
                                <span style={{ fontSize: '0.75rem', color: chat.unread_count ? 'var(--primary)' : 'var(--text-muted)', fontWeight: chat.unread_count ? 'bold' : 'normal' }}>
                                    {chat.last_timestamp ? new Date(chat.last_timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '0.85rem', color: chat.unread_count ? 'white' : 'var(--text-secondary)', fontWeight: chat.unread_count ? 'bold' : 'normal', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                    {chat.last_message || 'Inicia una conversación p2p'}
                                </div>
                                {chat.unread_count ? (
                                    <div style={{ background: 'var(--primary)', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', minWidth: '20px', textAlign: 'center' }}>
                                        {chat.unread_count}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ))}

                {activeTab === 'contacts' && (
                    <div style={{ padding: '16px 8px' }}>
                        <button onClick={() => navigate('contacts')} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px' }}>
                            + Escanear QR / Agregar
                        </button>
                        
                        {contacts.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📇</div>
                                <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Directorio Vacío</h3>
                                <p style={{ fontSize: '0.85rem' }}>Añade tu primer contacto para empezar.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {contacts.map(c => (
                                    <div key={c.identity_hash} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--bg-lifted)', borderRadius: '12px', border: '1px solid var(--solid-border)' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--solid-highlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 600, marginRight: '16px' }}>
                                            {c.display_name.substring(0, 1).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{c.display_name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontFamily: 'monospace', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{c.identity_hash.substring(0,16)}...</div>
                                        </div>
                                        <button 
                                            // The activeConversationId in RED is exactly the identity_hash of the peer (or group id)
                                            onClick={() => navigate('chat', c.identity_hash)} 
                                            style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.2rem', padding: '8px' }}
                                        >
                                            ✉️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}

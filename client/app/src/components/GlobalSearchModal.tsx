import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { MessageItem } from "../lib/api";

interface GlobalSearchModalProps {
    onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ onClose }) => {
    const { messages, contacts, groups, navigate } = useRedStore();
    const [query, setQuery] = useState("");

    const resolvePeerName = (hash: string) => {
        const g = groups.find((g: any) => g.id === hash);
        if (g) return g.name || "Grupo";
        const c = contacts.find((c: any) => c.identity_hash === hash);
        return c?.display_name || hash.substring(0, 8);
    };

    const results: MessageItem[] = query.trim().length >= 2
        ? messages.filter(m => m.content && m.content.toLowerCase().includes(query.toLowerCase()))
        : [];

    return (
        <div 
            className="animate-fade"
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(5,5,12,0.85)', backdropFilter: 'blur(14px)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px 20px'
            }}
            onClick={onClose}
        >
            <div 
                className="animate-pop glass-panel"
                style={{
                    width: '100%', maxWidth: '540px', padding: '24px',
                    borderRadius: '24px', background: 'linear-gradient(145deg, #0f0f1c, #0a0a14)',
                    border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>🔍 Búsqueda Global de Mensajes</h2>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <input
                    autoFocus
                    type="text"
                    placeholder="Escribe para buscar en todos los chats..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{
                        width: '100%', padding: '14px 16px', borderRadius: '14px',
                        background: 'var(--bg-deep)', color: 'var(--text-primary)',
                        border: '1px solid var(--solid-border-active)', outline: 'none',
                        fontSize: '1rem', marginBottom: '16px', boxSizing: 'border-box'
                    }}
                />

                <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }} className="scroll-container no-scrollbar">
                    {query.trim().length >= 2 && results.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                            Sin coincidencias para "{query}"
                        </div>
                    )}
                    {results.map(msg => {
                        const targetConvId = msg.conversation_id || ((msg as any).recipient || msg.sender);
                        const peerName = resolvePeerName(targetConvId);
                        return (
                            <div
                                key={msg.id}
                                onClick={() => {
                                    navigate('chat', targetConvId);
                                    onClose();
                                }}
                                style={{
                                    padding: '12px 16px', borderRadius: '14px',
                                    background: 'var(--bg-lifted)', border: '1px solid var(--solid-border)',
                                    cursor: 'pointer', transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-bright)' }}>{peerName}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {new Date((msg.timestamp > 1e10 ? msg.timestamp : msg.timestamp * 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

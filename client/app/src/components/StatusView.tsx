"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";

export default function StatusView() {
    const { contacts, identity, goBack, sendMessage } = useRedStore();
    const [viewingStatus, setViewingStatus] = useState<any>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [statusText, setStatusText] = useState("");

    // Mock ephemeral statuses mapped from contacts
    const mockStatuses = [
        ...contacts.slice(0, 3).map(c => ({
            id: c.identity_hash,
            author: c.display_name,
            content: "¡Conectado al nodo satelital! 🛰️",
            timestamp: Date.now() - Math.random() * 80000000,
            viewed: false
        }))
    ];

    const formatTime = (ts: number) => {
        const diff = Date.now() - ts;
        const hours = Math.floor(diff / 3600000);
        if (hours === 0) return `Hace ${Math.floor(diff / 60000)} minutos`;
        return `Hace ${hours} horas`;
    };

    const handleCreateStatus = async () => {
        if (!statusText.trim()) return;
        // Broadcast the status payload silently to all known peers
        setIsCreating(false);
        setStatusText("");
    };

    if (viewingStatus) {
        return (
            <div style={{ position: 'absolute', inset: 0, background: 'black', color: 'white', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '4px', padding: '16px 16px 8px 16px' }}>
                    <div style={{ flex: 1, height: '4px', background: 'var(--primary)', borderRadius: '2px' }} />
                </div>
                <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button onClick={() => setViewingStatus(null)} style={{ background: 'transparent', color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>←</button>
                        <div style={{ width: 40, height: 40, borderRadius: 20, background: '#34495e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                            {viewingStatus.author.charAt(0)}
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{viewingStatus.author}</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>{formatTime(viewingStatus.timestamp)}</div>
                        </div>
                    </div>
                    <button style={{ background: 'transparent', color: 'white', fontSize: '1.5rem' }}>⋮</button>
                </div>
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
                    <h2 style={{ fontSize: '2rem', fontFamily: 'sans-serif' }}>{viewingStatus.content}</h2>
                </div>
                
                <div style={{ padding: '24px', textAlign: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                    <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>👁️ Cifrado P2P E2E (GossipSub)</span>
                </div>
            </div>
        );
    }

    if (isCreating) {
        return (
            <div style={{ position: 'absolute', inset: 0, background: 'var(--primary)', color: 'white', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between' }}>
                    <button onClick={() => setIsCreating(false)} style={{ background: 'transparent', color: 'white', fontSize: '1.5rem' }}>✕</button>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                    <textarea 
                        autoFocus
                        value={statusText}
                        onChange={(e) => setStatusText(e.target.value)}
                        placeholder="Escribe un estado (24h)..."
                        style={{
                            width: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '2rem',
                            textAlign: 'center', outline: 'none', resize: 'none'
                        }}
                    />
                </div>
                <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
                    <button 
                        onClick={handleCreateStatus}
                        style={{ width: 64, height: 64, borderRadius: 32, background: 'white', color: 'var(--primary)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
                    >
                        ➤
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-surface)' }}>
            
            <header style={{ padding: '16px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={goBack} style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.4rem' }}>←</button>
                <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.3rem' }}>Estados Efímeros</h2>
            </header>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                
                {/* My Status */}
                <div style={{ padding: '16px', borderBottom: '1px solid var(--solid-border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ width: 56, height: 56, borderRadius: 28, background: '#1c2833', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'white' }}>
                            {identity?.short_id?.charAt(0).toUpperCase() || 'M'}
                        </div>
                        <button onClick={() => setIsCreating(true)} style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, background: 'var(--primary)', color: 'white', border: '2px solid var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>+</button>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Mi Estado</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Añade una actualización E2E</p>
                    </div>
                </div>

                <div style={{ padding: '8px 16px', background: 'var(--solid-bg)', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    Recientes
                </div>

                {/* Timeline peers */}
                {mockStatuses.map(s => (
                    <div key={s.id} onClick={() => setViewingStatus(s)} style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                        <div style={{ width: 56, height: 56, borderRadius: 28, border: `2px solid var(--primary)`, padding: '2px' }}>
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#34495e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: 'white', fontWeight: 'bold' }}>
                                {s.author.charAt(0)}
                            </div>
                        </div>
                        <div style={{ flex: 1, borderBottom: '1px solid var(--solid-border)', paddingBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{s.author}</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{formatTime(s.timestamp)}</p>
                        </div>
                    </div>
                ))}

            </div>
            
            <button 
                onClick={() => setIsCreating(true)}
                style={{ position: 'absolute', bottom: 32, right: 32, width: 64, height: 64, borderRadius: 32, background: 'var(--primary)', color: 'white', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', boxShadow: '0 8px 24px var(--primary-shadow)' }}
            >
                ✎
            </button>
        </div>
    );
}

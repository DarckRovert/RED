"use client";

import React, { useState, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI, MessageItem } from "../lib/api";

// Colores de avatar — mismo palette que Sidebar
const AVATAR_COLORS = [
    ['#E8213A','#C0152A'], ['#FF7043','#E64A19'], ['#FFA726','#F57C00'],
    ['#26C6DA','#00ACC1'], ['#29B6F6','#0288D1'], ['#7E57C2','#5E35B1'],
    ['#26A69A','#00897B'], ['#EC407A','#C2185B'],
];
function getAvIdx(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 8;
}
function avStyle(s: string) {
    const [a, b] = AVATAR_COLORS[getAvIdx(s)];
    return { background: `linear-gradient(135deg, ${a}, ${b})`, boxShadow: `0 2px 12px ${a}55` };
}

function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return 'Ahora';
    if (hours === 0) return `Hace ${mins} min`;
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
}

export default function StatusView() {
    const { contacts, identity, goBack, messages } = useRedStore();
    const [viewingStatus, setViewingStatus] = useState<any>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sentCount, setSentCount] = useState(0);

    // FASE 5: Los estados reales son mensajes de tipo 'status' recibidos vía SSE.
    // Los filtramos de `messages` que viene del store en tiempo real.
    // Solo mostramos uno por contacto (el más reciente) dentro de las últimas 24h.
    const STATUS_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
    const now = Date.now();

    // Agrupar mensajes recibidos de tipo 'status' por sender
    const peerStatusMap: Record<string, MessageItem> = {};
    messages.forEach(m => {
        if (m.msg_type === 'status' && !m.is_mine) {
            // Solo dentro de las 24h
            const msgTime = m.timestamp > 1e10 ? m.timestamp : m.timestamp * 1000;
            if (now - msgTime <= STATUS_TTL_MS) {
                const existing = peerStatusMap[m.sender];
                const existingTime = existing ? (existing.timestamp > 1e10 ? existing.timestamp : existing.timestamp * 1000) : 0;
                if (!existing || msgTime > existingTime) {
                    peerStatusMap[m.sender] = m;
                }
            }
        }
    });

    const peerStatuses = Object.values(peerStatusMap);

    // FASE 5: handleCreateStatus — envía a TODOS los contactos (estilo WhatsApp)
    // Usamos RedAPI.sendMessage directamente porque sendMessage() del store
    // requiere activeConversationId, que es null cuando estás en StatusView.
    const handleCreateStatus = useCallback(async () => {
        const text = statusText.trim();
        if (!text || isSending) return;
        setIsSending(true);

        let sent = 0;
        // Enviar secuencialmente a todos los contactos para no saturar el nodo
        for (const contact of contacts) {
            try {
                await RedAPI.sendMessage(contact.identity_hash, text, {
                    msg_type: 'status',
                });
                sent++;
            } catch (e) {
                console.warn(`[RED] Status no enviado a ${contact.display_name}:`, e);
            }
        }

        setSentCount(sent);
        setIsSending(false);
        setIsCreating(false);
        setStatusText("");

        // Reset el contador de enviados después de 3s
        setTimeout(() => setSentCount(0), 3000);
    }, [statusText, contacts, isSending]);

    // Vista de estado en pantalla completa
    if (viewingStatus) {
        const msgTime = viewingStatus.timestamp > 1e10
            ? viewingStatus.timestamp
            : viewingStatus.timestamp * 1000;
        return (
            <div style={{
                position: 'absolute', inset: 0, background: '#060608',
                color: 'white', zIndex: 100, display: 'flex', flexDirection: 'column',
                userSelect: 'none',
            }}>
                {/* Progress bar */}
                <div style={{ display: 'flex', gap: '4px', padding: '16px 16px 8px' }}>
                    <div style={{
                        flex: 1, height: '3px',
                        background: 'linear-gradient(90deg, var(--primary), rgba(255,255,255,0.3))',
                        borderRadius: '2px',
                        animation: 'status-progress 6s linear forwards',
                    }} />
                </div>

                {/* Header */}
                <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => setViewingStatus(null)} style={{
                        background: 'transparent', color: 'white', border: 'none',
                        fontSize: '1.4rem', cursor: 'pointer', padding: '6px',
                    }}>←</button>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '1rem', color: 'white',
                        ...avStyle(viewingStatus.sender || viewingStatus.author || ''),
                    }}>
                        {(viewingStatus.author || viewingStatus.sender || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {viewingStatus.author || `${viewingStatus.sender?.substring(0, 10)}…`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                            {formatRelativeTime(msgTime)}
                        </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>
                        E2E P2P
                    </span>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '32px', textAlign: 'center',
                    background: 'radial-gradient(ellipse at center, rgba(232,33,58,0.08) 0%, transparent 70%)',
                }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.4 }}>
                        {viewingStatus.content}
                    </h2>
                </div>

                <div style={{ padding: '24px', textAlign: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                        👁️ Cifrado P2P E2E — GossipSub
                    </span>
                </div>
            </div>
        );
    }

    // Vista de creación de estado
    if (isCreating) {
        return (
            <div style={{
                position: 'absolute', inset: 0, background: 'var(--bg-deep)',
                color: 'white', zIndex: 100, display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => setIsCreating(false)} style={{
                        background: 'transparent', color: 'var(--text-secondary)', border: 'none',
                        fontSize: '1.4rem', cursor: 'pointer', padding: '6px',
                    }}>✕</button>
                    <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>Nuevo Estado</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {contacts.length} contacto{contacts.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '32px',
                    background: 'radial-gradient(ellipse at center, rgba(232,33,58,0.05) 0%, transparent 70%)',
                }}>
                    <textarea
                        autoFocus
                        value={statusText}
                        onChange={e => setStatusText(e.target.value)}
                        maxLength={200}
                        placeholder="Escribe tu estado (24h)..."
                        style={{
                            width: '100%', background: 'transparent', border: 'none',
                            color: 'var(--text-primary)', fontSize: '1.8rem',
                            textAlign: 'center', outline: 'none', resize: 'none',
                            lineHeight: 1.4, fontFamily: 'Inter, sans-serif',
                        }}
                    />
                </div>

                <div style={{ padding: '8px 24px 4px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {statusText.length}/200 · Se enviará silenciosamente a tus {contacts.length} contactos
                </div>

                <div style={{ padding: '16px 24px 32px', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={handleCreateStatus}
                        disabled={!statusText.trim() || isSending}
                        style={{
                            width: 72, height: 72, borderRadius: '50%',
                            background: statusText.trim() ? 'var(--primary)' : 'var(--solid-highlight)',
                            color: 'white', fontSize: '1.8rem', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', border: 'none',
                            boxShadow: statusText.trim() ? '0 8px 32px var(--primary-glow)' : 'none',
                            cursor: statusText.trim() ? 'pointer' : 'default',
                            transition: 'all 0.25s var(--ease-spring)',
                            transform: statusText.trim() ? 'scale(1)' : 'scale(0.9)',
                        }}
                    >
                        {isSending ? '⏳' : '➤'}
                    </button>
                </div>
            </div>
        );
    }

    // Vista principal
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>

            <header style={{
                height: 'var(--header-h)', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '0 16px',
                background: 'linear-gradient(180deg, rgba(12,12,22,0.99) 0%, rgba(8,8,16,0.98) 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
            }}>
                <button onClick={goBack} className="btn-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Estados Efímeros</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '1.5px' }}>
                        {peerStatuses.length > 0 ? `${peerStatuses.length} nuevo${peerStatuses.length !== 1 ? 's' : ''}` : 'CIFRADO E2E · 24H'}
                    </div>
                </div>
                {sentCount > 0 && (
                    <div style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                        background: 'rgba(0,217,126,0.12)', color: 'var(--success)', border: '1px solid rgba(0,217,126,0.25)',
                    }}>
                        ✓ Enviado a {sentCount}
                    </div>
                )}
            </header>

            <div className="scroll-container no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

                {/* Mi Estado */}
                <div style={{
                    marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', background: 'var(--bg-lifted)', borderRadius: '16px',
                    border: '1px solid var(--solid-border)', cursor: 'pointer',
                }} onClick={() => setIsCreating(true)}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                            width: 54, height: 54, borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(232,33,58,0.2), rgba(200,20,45,0.1))',
                            border: '2px solid var(--primary)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.3rem', color: 'white', fontWeight: 800,
                            boxShadow: '0 0 16px var(--primary-glow)',
                        }}>
                            {identity?.short_id?.charAt(0).toUpperCase() || 'M'}
                        </div>
                        <div style={{
                            position: 'absolute', bottom: -3, right: -3, width: 22, height: 22,
                            borderRadius: '50%', background: 'var(--primary)', color: 'white',
                            border: '2px solid var(--bg-deep)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold',
                        }}>+</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Mi Estado</div>
                        <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Toca para añadir una actualización E2E
                        </div>
                    </div>
                </div>

                {/* Estados de contactos */}
                {peerStatuses.length > 0 && (
                    <>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '12px', marginTop: '4px' }}>
                            RECIENTES
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {peerStatuses.map(s => {
                                const contact = contacts.find(c => c.identity_hash === s.sender);
                                const displayName = contact?.display_name || `${s.sender?.substring(0, 10)}…`;
                                const msgTime = s.timestamp > 1e10 ? s.timestamp : s.timestamp * 1000;
                                return (
                                    <div key={s.id}
                                        onClick={() => setViewingStatus({ ...s, author: displayName })}
                                        style={{
                                            padding: '14px 16px', display: 'flex', alignItems: 'center',
                                            gap: '14px', cursor: 'pointer', background: 'var(--bg-lifted)',
                                            borderRadius: '16px', border: '1px solid var(--solid-border)',
                                            transition: 'all 0.2s var(--ease-smooth)',
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.background = 'var(--primary-surface)';
                                            e.currentTarget.style.borderColor = 'var(--solid-border-active)';
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.background = 'var(--bg-lifted)';
                                            e.currentTarget.style.borderColor = 'var(--solid-border)';
                                        }}
                                    >
                                        <div style={{
                                            width: 54, height: 54, borderRadius: '50%', flexShrink: 0,
                                            border: '2.5px solid var(--primary)', padding: '2px',
                                            boxShadow: '0 0 14px var(--primary-glow)',
                                        }}>
                                            <div style={{
                                                width: '100%', height: '100%', borderRadius: '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontWeight: 800, fontSize: '1.2rem', color: 'white',
                                                ...avStyle(s.sender || ''),
                                            }}>
                                                {displayName.charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                                                {displayName}
                                            </div>
                                            <div style={{
                                                fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3,
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            }}>
                                                {s.content}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-disabled)', flexShrink: 0 }}>
                                            {formatRelativeTime(msgTime)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* Si no hay estados de peers todavía */}
                {peerStatuses.length === 0 && (
                    <div style={{
                        marginTop: '32px', textAlign: 'center', padding: '28px 20px',
                        background: 'var(--bg-lifted)', borderRadius: '20px',
                        border: '1px solid var(--solid-border)',
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📡</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: 8 }}>
                            Sin estados recientes
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Los estados de tus contactos aparecerán aquí en tiempo real vía la red P2P.
                            Duran 24 horas y se borran automáticamente.
                        </div>
                    </div>
                )}
            </div>

            {/* FAB */}
            <button
                onClick={() => setIsCreating(true)}
                style={{
                    position: 'absolute', bottom: 32, right: 24,
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--primary)', color: 'white', fontSize: '1.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', boxShadow: '0 8px 32px var(--primary-glow)',
                    cursor: 'pointer', zIndex: 20,
                    transition: 'transform 0.3s var(--ease-spring)',
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                ✎
            </button>
        </div>
    );
}

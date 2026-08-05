"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI, MessageItem } from "../lib/api";
import StoryViewer from "./stories/StoryViewer";
import StoryCreator from "./stories/StoryCreator";
import { LiveStreamBroadcaster } from "./LiveStreamBroadcaster";
import { LiveStreamViewer } from "./LiveStreamViewer";

/* ── Avatar helpers ─────────────────────────────────────────────────── */
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
    if (hours === 0) return `Hace ${mins}m`;
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
}

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

type Modal =
    | { type: 'viewer'; senderHash: string; stories: MessageItem[]; senderName: string }
    | { type: 'creator' }
    | { type: 'broadcaster' }
    | { type: 'liveViewer'; streamId: string };

export default function StatusView() {
    const {
        contacts, identity, goBack, peerStories,
        myStories, liveStreams, navigate,
    } = useRedStore();

    const [modal, setModal] = useState<Modal | null>(null);
    const now = Date.now();

    /* ── Build peer stories map: all stories per sender ──────────── */
    const peerStoriesMap = useMemo(() => {
        const map: Record<string, MessageItem[]> = {};
        const storedMap = peerStories || {};
        for (const sender of Object.keys(storedMap)) {
            const arr = storedMap[sender] || [];
            const valid = arr.filter(m => {
                const msgTime = m.timestamp > 1e10 ? m.timestamp : m.timestamp * 1000;
                return (now - msgTime) < STATUS_TTL_MS;
            });
            if (valid.length > 0) {
                map[sender] = [...valid].sort((a, b) => {
                    const ta = a.timestamp > 1e10 ? a.timestamp : a.timestamp * 1000;
                    const tb = b.timestamp > 1e10 ? b.timestamp : b.timestamp * 1000;
                    return ta - tb;
                });
            }
        }
        return map;
    }, [peerStories, now]);

    const peerSenders = Object.keys(peerStoriesMap);

    /* ── Active live streams ─────────────────────────────────────── */
    const activeLives = useMemo(() =>
        Object.values(liveStreams).filter(s => s.is_active),
    [liveStreams]);

    /* ── My own stories (from store, persisted 24h) ──────────────── */
    const myValidStories = useMemo(() => {
        const arr = Array.isArray(myStories) ? myStories : [];
        return arr.filter(s => (now - s.timestamp) < STATUS_TTL_MS);
    }, [myStories, now]);

    /* ── Reply to a story: navigate to that contact's chat ────────── */
    const handleReply = useCallback((storyId: string, senderHash: string) => {
        setModal(null);
        navigate('chat', senderHash);
    }, [navigate]);

    /* ────────────────────────────────────────────────────────────── */
    /* Modal overlays                                                  */
    /* ────────────────────────────────────────────────────────────── */

    if (modal?.type === 'viewer') {
        return (
            <StoryViewer
                stories={modal.stories}
                senderName={modal.senderName}
                senderHash={modal.senderHash}
                onClose={() => setModal(null)}
                onReply={handleReply}
            />
        );
    }

    if (modal?.type === 'creator') {
        return <StoryCreator onClose={() => setModal(null)} />;
    }

    if (modal?.type === 'broadcaster') {
        return <LiveStreamBroadcaster onClose={() => setModal(null)} />;
    }

    if (modal?.type === 'liveViewer') {
        return <LiveStreamViewer streamId={modal.streamId} onClose={() => setModal(null)} />;
    }

    /* ── Main view ───────────────────────────────────────────────── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>

            {/* Header */}
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
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Estados</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '1.5px' }}>
                        {peerSenders.length > 0
                            ? `${peerSenders.length} contacto${peerSenders.length !== 1 ? 's' : ''} con actualizaciones`
                            : 'CIFRADO E2E · 24H'}
                    </div>
                </div>
                {/* LIVE button */}
                <button
                    onClick={() => setModal({ type: 'broadcaster' })}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'linear-gradient(135deg, #FF3B30, #FF6B35)',
                        border: 'none', borderRadius: 20, padding: '6px 14px',
                        color: 'white', fontWeight: 800, fontSize: '0.78rem',
                        cursor: 'pointer', letterSpacing: '1px',
                        boxShadow: '0 4px 16px rgba(255,59,48,0.4)',
                    }}
                >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
                    LIVE
                </button>
            </header>

            <div className="scroll-container no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

                {/* ── Active Live Streams ─────────────────────────────── */}
                {activeLives.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{
                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
                            letterSpacing: '2px', marginBottom: 12,
                        }}>
                            🔴 EN VIVO AHORA
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {activeLives.map(s => (
                                <div
                                    key={s.stream_id}
                                    onClick={() => setModal({ type: 'liveViewer', streamId: s.stream_id })}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '14px 16px', borderRadius: 18,
                                        background: 'linear-gradient(135deg, rgba(255,59,48,0.12), rgba(255,107,53,0.06))',
                                        border: '1px solid rgba(255,59,48,0.3)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: 54, height: 54, borderRadius: '50%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 800, fontSize: '1.2rem', color: 'white',
                                            ...avStyle(s.broadcaster_hash),
                                            border: '2.5px solid #FF3B30',
                                            boxShadow: '0 0 18px rgba(255,59,48,0.5)',
                                        }}>
                                            {s.broadcaster_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{
                                            position: 'absolute', bottom: -3, right: -3,
                                            background: '#FF3B30', color: 'white',
                                            fontSize: '0.45rem', fontWeight: 900,
                                            padding: '2px 4px', borderRadius: 4,
                                            border: '1.5px solid var(--bg-deep)',
                                            letterSpacing: '0.5px',
                                        }}>LIVE</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'white' }}>
                                            {s.broadcaster_name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                                            Transmisión en vivo P2P
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '6px 14px', background: '#FF3B30', color: 'white',
                                        borderRadius: 20, fontWeight: 800, fontSize: '0.75rem',
                                        letterSpacing: '0.5px',
                                    }}>
                                        Ver →
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Mi Estado ──────────────────────────────────────── */}
                <div
                    style={{
                        marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 16px', background: 'var(--bg-lifted)', borderRadius: '16px',
                        border: '1px solid var(--solid-border)', cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onClick={() => setModal({ type: 'creator' })}
                >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                            width: 54, height: 54, borderRadius: '50%',
                            background: myValidStories.length > 0
                                ? 'linear-gradient(135deg, #E8213A, #FF6B35)'
                                : 'linear-gradient(135deg, rgba(232,33,58,0.2), rgba(200,20,45,0.1))',
                            border: myValidStories.length > 0 ? '2.5px solid #E8213A' : '2px solid var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem', color: 'white', fontWeight: 800,
                            boxShadow: myValidStories.length > 0
                                ? '0 0 20px rgba(232,33,58,0.5)'
                                : '0 0 16px var(--primary-glow)',
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
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            Mi Estado
                        </div>
                        <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {myValidStories.length > 0
                                ? `${myValidStories.length} actualización${myValidStories.length > 1 ? 'es' : ''} activa${myValidStories.length > 1 ? 's' : ''}`
                                : 'Toca para añadir una actualización E2E'}
                        </div>
                    </div>
                    {myValidStories.length > 0 && (
                        <div style={{
                            fontSize: '0.72rem', color: 'var(--text-muted)',
                            background: 'rgba(232,33,58,0.12)', padding: '4px 10px',
                            borderRadius: 12, border: '1px solid rgba(232,33,58,0.2)',
                        }}>
                            {formatRelativeTime(myValidStories[myValidStories.length - 1].timestamp)}
                        </div>
                    )}
                </div>

                {/* ── Peer Stories ────────────────────────────────────── */}
                {peerSenders.length > 0 && (
                    <>
                        <div style={{
                            fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
                            letterSpacing: '2px', marginBottom: '12px', marginTop: '4px',
                        }}>
                            RECIENTES
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {peerSenders.map(senderHash => {
                                const stories = peerStoriesMap[senderHash];
                                if (!stories || stories.length === 0) return null;
                                const latest = stories[stories.length - 1];
                                const contact = contacts.find((c: any) => c.identity_hash === senderHash);
                                const displayName = contact?.display_name || `${senderHash.substring(0, 10)}…`;
                                const msgTime = latest.timestamp > 1e10 ? latest.timestamp : latest.timestamp * 1000;
                                const hasPhoto = stories.some(s => !!s.media_data);

                                return (
                                    <div
                                        key={senderHash}
                                        onClick={() => setModal({
                                            type: 'viewer',
                                            senderHash,
                                            senderName: displayName,
                                            stories,
                                        })}
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
                                        {/* Avatar ring with story count badge */}
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <div style={{
                                                width: 54, height: 54, borderRadius: '50%',
                                                border: '2.5px solid var(--primary)', padding: '2px',
                                                boxShadow: '0 0 14px var(--primary-glow)',
                                            }}>
                                                <div style={{
                                                    width: '100%', height: '100%', borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 800, fontSize: '1.2rem', color: 'white',
                                                    ...avStyle(senderHash),
                                                }}>
                                                    {displayName.charAt(0).toUpperCase()}
                                                </div>
                                            </div>
                                            {stories.length > 1 && (
                                                <div style={{
                                                    position: 'absolute', bottom: -3, right: -3,
                                                    background: 'var(--primary)', color: 'white',
                                                    fontSize: '0.58rem', fontWeight: 900,
                                                    width: 18, height: 18, borderRadius: '50%',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    border: '1.5px solid var(--bg-deep)',
                                                }}>
                                                    {stories.length}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                                                {displayName}
                                            </div>
                                            <div style={{
                                                fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3,
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                display: 'flex', alignItems: 'center', gap: 5,
                                            }}>
                                                {hasPhoto && <span>📷</span>}
                                                {latest.content || 'Estado de foto'}
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

                {/* Empty state */}
                {peerSenders.length === 0 && activeLives.length === 0 && (
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

            {/* FAB — create story */}
            <button
                onClick={() => setModal({ type: 'creator' })}
                style={{
                    position: 'absolute', bottom: 32, right: 24,
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--primary)', color: 'white', fontSize: '1.6rem',
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

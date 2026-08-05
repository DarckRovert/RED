"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { RedAPI, MessageItem } from "../../lib/api";
import { STORY_THEMES } from "./StoryCreator";

const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/* ── Helpers ──────────────────────────────────────────────────────────── */
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

const STORY_DURATION_MS = 6000;

interface StoryViewerProps {
    stories: MessageItem[];        // All stories for this contact
    senderName: string;
    senderHash: string;
    onClose: () => void;
    onReply?: (storyId: string, senderHash: string) => void;
}

export default function StoryViewer({ stories, senderName, senderHash, onClose, onReply }: StoryViewerProps) {
    const [idx, setIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [showReply, setShowReply] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startRef = useRef<number>(Date.now());

    const currentStory = stories[idx];

    const goNext = useCallback(() => {
        if (idx < stories.length - 1) {
            setIdx(i => i + 1);
            setProgress(0);
            startRef.current = Date.now();
        } else {
            onClose();
        }
    }, [idx, stories.length, onClose]);

    const goPrev = useCallback(() => {
        if (idx > 0) {
            setIdx(i => i - 1);
            setProgress(0);
            startRef.current = Date.now();
        }
    }, [idx]);

    // Auto-progress timer
    useEffect(() => {
        if (paused || showReply) return;
        setProgress(0);
        startRef.current = Date.now();

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startRef.current;
            const p = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
            setProgress(p);
            if (p >= 100) {
                clearInterval(intervalRef.current!);
                goNext();
            }
        }, 50);

        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [idx, paused, showReply, goNext]);

    if (!currentStory) { onClose(); return null; }

    const msgTime = currentStory.timestamp > 1e10 ? currentStory.timestamp : currentStory.timestamp * 1000;
    const themeIdx = typeof currentStory.theme === 'string' ? parseInt(currentStory.theme) : undefined;
    const theme = (themeIdx !== undefined && !isNaN(themeIdx)) ? STORY_THEMES[themeIdx % 8] : null;
    const hasPhoto = !!currentStory.media_data;

    const handleSendReply = useCallback(async () => {
        const text = replyText.trim();
        if (!text || !currentStory) return;
        setReplyText('');
        setShowReply(false);
        try {
            await RedAPI.sendMessage(senderHash, `💬 ${text}`, {
                msg_type: 'text',
                reply_to: {
                    id: currentStory.id,
                    content: currentStory.content || '📷 Estado',
                    sender: senderHash,
                }
            });
        } catch (e) {
            console.warn('[RED Story] Failed to send story reply', e);
        }
        onReply?.(currentStory.id, senderHash);
    }, [replyText, currentStory, senderHash, onReply]);

    return (
        <div
            style={{
                position: 'absolute', inset: 0, zIndex: 200,
                background: '#000',
                color: 'white', display: 'flex', flexDirection: 'column',
                userSelect: 'none',
                touchAction: 'pan-y',
            }}
            onTouchStart={e => setPaused(true)}
            onTouchEnd={e => setPaused(false)}
        >
            {/* Progress bars */}
            <div style={{ display: 'flex', gap: '3px', padding: '16px 12px 8px', flexShrink: 0 }}>
                {stories.map((_, i) => (
                    <div
                        key={i}
                        style={{
                            flex: 1, height: '2.5px', borderRadius: 2,
                            background: 'rgba(255,255,255,0.25)',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{
                            height: '100%',
                            background: 'white',
                            width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%',
                            transition: i === idx ? 'none' : undefined,
                            borderRadius: 2,
                        }} />
                    </div>
                ))}
            </div>

            {/* Header */}
            <div style={{
                padding: '4px 12px 12px',
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
            }}>
                <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.8)',
                    flexShrink: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: 'white',
                    ...avStyle(senderHash),
                }}>
                    {senderName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.93rem' }}>{senderName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)' }}>
                        {formatRelativeTime(msgTime)} · E2E P2P
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white',
                        width: 32, height: 32, borderRadius: '50%', fontSize: '1rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >✕</button>
            </div>

            {/* Story content — full screen */}
            <div
                style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                    background: hasPhoto ? '#000' : theme
                        ? `linear-gradient(145deg, ${theme.from}, ${theme.to})`
                        : 'linear-gradient(145deg, rgba(232,33,58,0.18), rgba(8,8,16,1))',
                }}
            >
                {/* Left / right tap areas */}
                <div
                    onClick={goPrev}
                    style={{ position: 'absolute', left: 0, top: 0, width: '35%', height: '100%', zIndex: 10 }}
                />
                <div
                    onClick={goNext}
                    style={{ position: 'absolute', right: 0, top: 0, width: '35%', height: '100%', zIndex: 10 }}
                />

                {hasPhoto ? (
                    <img
                        src={`data:image/jpeg;base64,${currentStory.media_data}`}
                        alt="story"
                        style={{
                            width: '100%', height: '100%',
                            objectFit: 'contain',
                        }}
                    />
                ) : (
                    <div style={{ padding: '32px', textAlign: 'center', zIndex: 5 }}>
                        <p style={{
                            fontSize: currentStory.content.length > 80 ? '1.5rem' : '2.1rem',
                            fontWeight: 800, lineHeight: 1.35,
                            textShadow: '0 2px 20px rgba(0,0,0,0.6)',
                            letterSpacing: '-0.02em',
                        }}>
                            {currentStory.content}
                        </p>
                    </div>
                )}
            </div>

            {/* Reply bar */}
            {!showReply ? (
                <div style={{
                    padding: '12px 16px 28px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <button
                        onClick={() => setShowReply(true)}
                        style={{
                            flex: 1, background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 24, padding: '10px 16px',
                            color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem',
                            cursor: 'pointer', textAlign: 'left',
                        }}
                    >
                        Responder…
                    </button>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                        E2E · 24H
                    </div>
                </div>
            ) : (
                <div style={{
                    padding: '10px 12px 28px', background: 'rgba(0,0,0,0.9)',
                    display: 'flex', gap: 8, alignItems: 'center',
                }}>
                    <input
                        autoFocus
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSendReply();
                            if (e.key === 'Escape') setShowReply(false);
                        }}
                        placeholder="Escribe una respuesta…"
                        style={{
                            flex: 1, background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.25)', borderRadius: 24,
                            padding: '10px 16px', color: 'white', fontSize: '0.9rem',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleSendReply}
                        disabled={!replyText.trim()}
                        style={{
                            background: replyText.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.2)',
                            color: 'white', border: 'none',
                            borderRadius: '50%', width: 40, height: 40, fontSize: '1.1rem',
                            cursor: replyText.trim() ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >➤</button>
                    <button
                        onClick={() => setShowReply(false)}
                        style={{
                            background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none',
                            borderRadius: '50%', width: 36, height: 36, fontSize: '0.9rem',
                            cursor: 'pointer',
                        }}
                    >✕</button>
                </div>
            )}
        </div>
    );

}

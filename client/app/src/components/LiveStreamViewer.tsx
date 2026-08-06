"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

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
    return { background: `linear-gradient(135deg, ${a}, ${b})` };
}

interface LiveStreamViewerProps {
    streamId: string;
    onClose: () => void;
}

export function LiveStreamViewer({ streamId, onClose }: LiveStreamViewerProps) {
    const { liveStreams, identity, contacts, addLiveComment } = useRedStore();

    const stream = liveStreams[streamId];
    const [comment, setComment] = useState('');
    const [lastFrame, setLastFrame] = useState<string | null>(null);
    const [lastSeq, setLastSeq] = useState(-1);
    const [elapsed, setElapsed] = useState(0);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Track frames from the store
    useEffect(() => {
        const s = liveStreams[streamId];
        if (!s) return;
        if (s.frames && s.frames.length > 0) {
            const newestFrame = s.frames[s.frames.length - 1];
            const frameB64 = typeof newestFrame === 'string' ? newestFrame : (newestFrame?.media_data || null);
            if (frameB64) {
                setLastFrame(frameB64);
                setLastSeq(s.frame_seq);
            }
        }
        if (s.is_active === false) {
            // Stream ended — wait 2s then close
            const t = setTimeout(onClose, 2000);
            return () => clearTimeout(t);
        }
    }, [liveStreams, streamId, onClose]);

    // Elapsed time since stream started
    useEffect(() => {
        if (!stream) return;
        const startedAt = stream.started_at;
        elapsedRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
        return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
    }, [stream]);

    // Auto-scroll comments
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [stream?.comments]);

    const sendComment = useCallback(async () => {
        const text = comment.trim();
        if (!text || !stream || !identity) return;
        setComment('');

        // Show immediately in local stream
        addLiveComment(streamId, identity.short_id || identity.identity_hash.substring(0, 6), text);

        // Send to broadcaster as a direct message
        try {
            await RedAPI.sendMessage(stream.broadcaster_hash, text, {
                msg_type: 'live_comment',
                conversation_id: streamId,
                reaction: `live:${streamId}`,
            });
        } catch { /* best-effort */ }
    }, [comment, stream, identity, streamId, addLiveComment]);

    if (!stream) {
        return (
            <div style={{
                position: 'absolute', inset: 0, zIndex: 300,
                background: '#000', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 16,
            }}>
                <div style={{ fontSize: '2.5rem' }}>📡</div>
                <div style={{ fontWeight: 700 }}>Stream no encontrado</div>
                <button onClick={onClose} style={{
                    background: 'var(--primary)', color: 'white', border: 'none',
                    borderRadius: 12, padding: '10px 24px', cursor: 'pointer', fontWeight: 700,
                }}>Volver</button>
            </div>
        );
    }

    const formatElapsed = (s: number) =>
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 300,
            background: '#000', color: 'white', display: 'flex', flexDirection: 'column',
        }}>
            {/* Video area */}
            <div style={{
                flex: 1, position: 'relative', overflow: 'hidden', background: '#050508',
            }}>
                {lastFrame ? (
                    <img
                        src={`data:image/jpeg;base64,${lastFrame}`}
                        alt="live"
                        style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover',
                            transition: 'opacity 0.1s',
                        }}
                    />
                ) : (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14,
                    }}>
                        <span style={{ fontSize: '3rem' }}>📡</span>
                        <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                            Conectando al stream…
                        </div>
                        <div style={{
                            width: 40, height: 3, background: 'var(--primary)',
                            borderRadius: 2, animation: 'connecting-pulse 1.2s ease-in-out infinite',
                        }} />
                    </div>
                )}

                {/* LIVE banner */}
                <div style={{
                    position: 'absolute', top: 16, left: 16,
                    background: 'rgba(0,0,0,0.7)', borderRadius: 20,
                    padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
                    backdropFilter: 'blur(8px)',
                }}>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: '#FF3B30',
                        boxShadow: '0 0 8px #FF3B30',
                        animation: 'live-blink 1s ease-in-out infinite',
                    }} />
                    <span style={{ fontWeight: 900, fontSize: '0.78rem', letterSpacing: '1px', color: '#FF3B30' }}>LIVE</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>
                        {formatElapsed(elapsed)}
                    </span>
                </div>

                {/* Broadcaster name */}
                <div style={{
                    position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '6px 14px',
                    backdropFilter: 'blur(8px)',
                }}>
                    <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '0.7rem', color: 'white',
                        ...avStyle(stream.broadcaster_hash),
                    }}>
                        {stream.broadcaster_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                        {stream.broadcaster_name}
                    </span>
                </div>

                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: 16, right: 16,
                        background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white',
                        borderRadius: '50%', width: 38, height: 38, fontSize: '1rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >✕</button>

                {/* Stream ended overlay */}
                {!stream.is_active && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: 12,
                    }}>
                        <span style={{ fontSize: '2.5rem' }}>📴</span>
                        <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>Stream terminado</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>Cerrando…</div>
                    </div>
                )}

                {/* Comments overlay (last 5) */}
                {(stream.comments?.length ?? 0) > 0 && (
                    <div style={{
                        position: 'absolute', bottom: 80, left: 0, right: 0,
                        padding: '0 12px',
                        display: 'flex', flexDirection: 'column', gap: 5,
                        pointerEvents: 'none',
                    }}>
                        {(stream.comments || []).slice(-5).map((c, i) => (
                            <div key={i} style={{
                                background: 'rgba(0,0,0,0.65)', borderRadius: 18,
                                padding: '5px 12px', fontSize: '0.82rem',
                                alignSelf: 'flex-start', maxWidth: '85%',
                                backdropFilter: 'blur(8px)',
                            }}>
                                <strong style={{ color: '#FFA726', marginRight: 6 }}>
                                    {c.sender}
                                </strong>
                                {c.text}
                            </div>
                        ))}
                        <div ref={commentsEndRef} />
                    </div>
                )}
            </div>

            {/* Comment input */}
            <div style={{
                padding: '10px 12px 28px', background: 'rgba(0,0,0,0.95)',
                display: 'flex', gap: 8, alignItems: 'center',
                borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
                <input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendComment(); }}
                    placeholder="Escribe un comentario…"
                    style={{
                        flex: 1, background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 24,
                        padding: '10px 16px', color: 'white', fontSize: '0.88rem', outline: 'none',
                    }}
                />
                <button
                    onClick={sendComment}
                    disabled={!comment.trim()}
                    style={{
                        background: comment.trim() ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                        color: 'white', border: 'none', borderRadius: '50%',
                        width: 42, height: 42, fontSize: '1.1rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                    }}
                >➤</button>
            </div>

            <style>{`
                @keyframes live-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                @keyframes connecting-pulse {
                    0%, 100% { transform: scaleX(1); opacity: 1; }
                    50% { transform: scaleX(0.3); opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}

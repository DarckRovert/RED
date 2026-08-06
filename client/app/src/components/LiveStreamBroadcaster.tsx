"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

const FRAME_INTERVAL_MS = 500;  // 2 fps (optimized for BLE mesh radio bandwidth)
const FRAME_QUALITY   = 0.35;   // JPEG quality (35% = ~3-5KB per frame)
const FRAME_WIDTH     = 240;
const FRAME_HEIGHT    = 320;

export function LiveStreamBroadcaster({ onClose }: { onClose: () => void }) {
    const { contacts, identity, isStreaming, streamId: activeStreamId } = useRedStore();

    const videoRef  = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const frameSeqRef = useRef(0);

    const [streamId]     = useState(() => `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    const [isLive, setIsLive]       = useState(false);
    const [camReady, setCamReady]   = useState(false);
    const [camError, setCamError]   = useState<string | null>(null);
    const [elapsed, setElapsed]     = useState(0);
    const [framesSent, setFramesSent] = useState(0);
    const [comments, setComments]   = useState<{ sender: string; text: string }[]>([]);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync incoming comments from store
    const liveStreams = useRedStore(s => s.liveStreams);
    useEffect(() => {
        const stream = liveStreams[streamId];
        if (stream) setComments(stream.comments.slice(-20));
    }, [liveStreams, streamId]);

    /* ── Camera init ─────────────────────────────────────────────── */
    useEffect(() => {
        let cancelled = false;
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: FRAME_WIDTH }, height: { ideal: FRAME_HEIGHT } },
            audio: false,
        }).then(stream => {
            if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});
            }
            setCamReady(true);
        }).catch(err => {
            if (!cancelled) setCamError(err.message || 'Camera no disponible');
        });

        return () => {
            cancelled = true;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        };
    }, []);

    /* ── Start / Stop broadcasting ───────────────────────────────── */
    const startLive = useCallback(async () => {
        if (!camReady || isLive) return;
        setIsLive(true);
        frameSeqRef.current = 0;
        setFramesSent(0);
        setElapsed(0);

        // Announce to all contacts
        await RedAPI.sendLiveAnnounce(contacts, streamId).catch(console.error);

        // Register our own stream locally so we can receive comments
        useRedStore.setState(s => ({
            liveStreams: {
                ...s.liveStreams,
                [streamId]: {
                    stream_id: streamId,
                    broadcaster_hash: identity?.identity_hash || '',
                    broadcaster_name: identity?.nickname || identity?.short_id || 'Yo',
                    started_at: Date.now(),
                    is_active: true,
                    frames: [],
                    frame_seq: -1,
                    comments: [],
                },
            },
            isStreaming: true,
            streamId,
        }));

        // Elapsed counter
        elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

        // Frame capture loop
        frameIntervalRef.current = setInterval(async () => {
            const video  = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || video.readyState < 2) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width  = FRAME_WIDTH;
            canvas.height = FRAME_HEIGHT;
            ctx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);

            canvas.toBlob(async blob => {
                if (!blob) return;
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const b64 = (reader.result as string).split(',')[1];
                    if (!b64) return;
                    const seq = frameSeqRef.current++;
                    setFramesSent(seq + 1);
                    await RedAPI.sendLiveFrame(contacts, streamId, b64, seq).catch(() => {});
                };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', FRAME_QUALITY);
        }, FRAME_INTERVAL_MS);
    }, [camReady, isLive, contacts, streamId, identity]);

    const stopLive = useCallback(async () => {
        if (!isLive) return;
        setIsLive(false);

        if (frameIntervalRef.current) { clearInterval(frameIntervalRef.current); frameIntervalRef.current = null; }
        if (elapsedRef.current)       { clearInterval(elapsedRef.current);       elapsedRef.current = null; }

        await RedAPI.sendLiveEnd(contacts, streamId).catch(console.error);

        useRedStore.setState(s => ({
            isStreaming: false,
            streamId: null,
            liveStreams: {
                ...s.liveStreams,
                [streamId]: { ...s.liveStreams[streamId], is_active: false },
            },
        }));

        setTimeout(onClose, 800);
    }, [isLive, contacts, streamId, onClose]);

    /* ── Cleanup on unmount ──────────────────────────────────────── */
    useEffect(() => () => {
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        if (elapsedRef.current)       clearInterval(elapsedRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    const formatElapsed = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 300,
            background: '#000', color: 'white', display: 'flex', flexDirection: 'column',
        }}>
            {/* Camera preview */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0f' }}>
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{
                        width: '100%', height: '100%', objectFit: 'cover',
                        transform: 'scaleX(-1)', // mirror for selfie cam
                    }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* LIVE badge */}
                {isLive && (
                    <div style={{
                        position: 'absolute', top: 16, left: 16,
                        background: '#FF3B30', color: 'white',
                        padding: '4px 12px', borderRadius: 8,
                        fontWeight: 900, fontSize: '0.78rem', letterSpacing: '1px',
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 0 20px rgba(255,59,48,0.5)',
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: '50%', background: 'white',
                            animation: 'live-blink 1s ease-in-out infinite',
                            display: 'inline-block',
                        }} />
                        LIVE · {formatElapsed(elapsed)}
                    </div>
                )}

                {/* Close button */}
                <button
                    onClick={isLive ? stopLive : onClose}
                    style={{
                        position: 'absolute', top: 16, right: 16,
                        background: 'rgba(0,0,0,0.55)', border: 'none', color: 'white',
                        borderRadius: '50%', width: 40, height: 40,
                        fontSize: '1.1rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >✕</button>

                {/* Stats overlay */}
                {isLive && (
                    <div style={{
                        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.6)', padding: '4px 12px', borderRadius: 20,
                        fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)',
                    }}>
                        📡 {contacts.length} contacto{contacts.length !== 1 ? 's' : ''} · {framesSent} frames
                    </div>
                )}

                {/* Camera error */}
                {camError && (
                    <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexDirection: 'column', gap: 12,
                        background: 'rgba(0,0,0,0.85)', padding: 24, textAlign: 'center',
                    }}>
                        <span style={{ fontSize: '2.5rem' }}>📷</span>
                        <span style={{ color: '#FF6B6B', fontWeight: 700 }}>Cámara no disponible</span>
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{camError}</span>
                    </div>
                )}

                {/* Comments overlay */}
                {isLive && comments.length > 0 && (
                    <div style={{
                        position: 'absolute', bottom: 80, left: 0, right: 0,
                        padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                        {comments.slice(-5).map((c, i) => (
                            <div key={i} style={{
                                background: 'rgba(0,0,0,0.65)', borderRadius: 20,
                                padding: '5px 12px', fontSize: '0.82rem',
                                alignSelf: 'flex-start', maxWidth: '85%',
                                backdropFilter: 'blur(6px)',
                            }}>
                                <strong style={{ color: '#FFA726', marginRight: 6 }}>
                                    {c.sender.substring(0, 6)}
                                </strong>
                                {c.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Control bar */}
            <div style={{
                padding: '16px 24px 36px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
            }}>
                {!isLive ? (
                    <button
                        onClick={startLive}
                        disabled={!camReady}
                        style={{
                            width: 76, height: 76, borderRadius: '50%',
                            background: camReady ? '#FF3B30' : '#444',
                            border: '4px solid rgba(255,255,255,0.3)',
                            color: 'white', fontSize: '1.4rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: camReady ? 'pointer' : 'default',
                            boxShadow: camReady ? '0 0 30px rgba(255,59,48,0.5)' : 'none',
                            transition: 'all 0.25s',
                        }}
                    >
                        {camReady ? '📡' : '⏳'}
                    </button>
                ) : (
                    <button
                        onClick={stopLive}
                        style={{
                            width: 76, height: 76, borderRadius: '50%',
                            background: '#FF3B30',
                            border: '4px solid rgba(255,255,255,0.6)',
                            color: 'white', fontSize: '1.4rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 0 30px rgba(255,59,48,0.7)',
                            animation: 'live-blink 2s ease-in-out infinite',
                        }}
                    >
                        ⏹
                    </button>
                )}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {isLive ? 'EN VIVO' : 'Iniciar LIVE'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                        {isLive ? `${contacts.length} contactos` : 'Solo tus contactos lo verán'}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes live-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}

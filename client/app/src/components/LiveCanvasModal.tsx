'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useRedStore } from '../store/useRedStore';
import { postChannelMessage, getChannelMessages } from '../lib/api';

const CANVAS_SYNC_CHANNEL = 'canvas-sync';
const SYNC_INTERVAL_MS = 2000;

export const LiveCanvasModal: React.FC = () => {
    const { navigate } = useRedStore();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#e8213a');
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
    const [peerCanvases, setPeerCanvases] = useState<string[]>([]);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'synced' | 'error'>('idle');
    const hasDrawnSinceLastSync = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#04060A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, []);

    // Sync canvas snapshot to P2P network channel every SYNC_INTERVAL_MS if there was new drawing
    const syncCanvasToNetwork = useCallback(async () => {
        if (!hasDrawnSinceLastSync.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsSyncing(true);
        try {
            const dataUrl = canvas.toDataURL('image/png', 0.5); // 50% quality for bandwidth efficiency
            const base64 = dataUrl.split(',')[1];

            await postChannelMessage({
                channel_id: CANVAS_SYNC_CHANNEL,
                content: `CANVAS_FRAME:${base64}`,
                sender_name: 'Operador RED'
            });

            hasDrawnSinceLastSync.current = false;
            setLastSyncTime(Date.now());
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('error');
        } finally {
            setIsSyncing(false);
        }
    }, []);

    // Fetch peer canvas frames from network channel
    const fetchPeerFrames = useCallback(async () => {
        try {
            const response = await getChannelMessages(CANVAS_SYNC_CHANNEL);
            const messages = response.messages ?? [];
            const frames = messages
                .filter((m) => m.content?.startsWith('CANVAS_FRAME:'))
                .map((m) => m.content.replace('CANVAS_FRAME:', ''))
                .slice(-3); // Keep last 3 peer frames
            setPeerCanvases(frames);
        } catch {
            // Channel may not exist yet — silent fail
        }
    }, []);

    useEffect(() => {
        const syncInterval = setInterval(syncCanvasToNetwork, SYNC_INTERVAL_MS);
        const fetchInterval = setInterval(fetchPeerFrames, SYNC_INTERVAL_MS);
        return () => {
            clearInterval(syncInterval);
            clearInterval(fetchInterval);
        };
    }, [syncCanvasToNetwork, fetchPeerFrames]);

    const getEventCoords = (
        e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
        rect: DOMRect
    ) => {
        const canvas = canvasRef.current;
        const scaleX = canvas ? canvas.width / rect.width : 1;
        const scaleY = canvas ? canvas.height / rect.height : 1;
        if ('touches' in e && e.touches.length > 0) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        const mouseEv = e as React.MouseEvent<HTMLCanvasElement>;
        return {
            x: (mouseEv.clientX - rect.left) * scaleX,
            y: (mouseEv.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const { x, y } = getEventCoords(e, rect);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.lineTo(x, y);
        ctx.stroke();
        hasDrawnSinceLastSync.current = true;
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.beginPath();
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const { x, y } = getEventCoords(e, rect);

        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);

        hasDrawnSinceLastSync.current = true;
    };


    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#04060A';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasDrawnSinceLastSync.current = true; // Sync the clear action
    };

    const syncNow = async () => {
        hasDrawnSinceLastSync.current = true;
        await syncCanvasToNetwork();
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: '#04060A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* TOP BAR */}
            <div style={{
                height: '60px',
                padding: '0 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15,23,42,0.9)'
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{ background: 'transparent', border: 'none', color: '#e8213a', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🎨 PIZARRA TÁCTICA P2P EN VIVO
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: syncStatus === 'synced' ? '#4ade80' : syncStatus === 'error' ? '#ef4444' : '#94a3b8'
                    }}>
                        {syncStatus === 'synced' ? '✓ SYNC P2P' : syncStatus === 'error' ? '✗ ERROR' : isSyncing ? '⟳ SYNC...' : 'MESH LIVE'}
                    </div>
                    <button
                        onClick={clearCanvas}
                        style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                        Limpiar
                    </button>
                </div>
            </div>

            {/* COLOR SELECTOR + SYNC BUTTON */}
            <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {['#e8213a', '#38bdf8', '#4ade80', '#f59e0b', '#c084fc', '#ffffff'].map((c) => (
                        <div
                            key={c}
                            onClick={() => setColor(c)}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: c,
                                border: color === c ? '3px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        />
                    ))}
                </div>
                <button
                    onClick={syncNow}
                    disabled={isSyncing}
                    style={{
                        background: 'rgba(74,222,128,0.1)',
                        border: '1px solid #4ade80',
                        color: '#4ade80',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: isSyncing ? 'not-allowed' : 'pointer',
                        opacity: isSyncing ? 0.5 : 1
                    }}
                >
                    📡 Enviar a Red
                </button>
            </div>

            {/* CANVAS WORKSPACE */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', gap: '16px', flexWrap: 'wrap' }}>
                {/* MY CANVAS */}
                <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px', textAlign: 'center', fontWeight: 700 }}>TU PIZARRA</div>
                    <canvas
                        ref={canvasRef}
                        width={320}
                        height={420}
                        onMouseDown={startDrawing}
                        onMouseUp={stopDrawing}
                        onMouseMove={draw}
                        onTouchStart={startDrawing}
                        onTouchEnd={stopDrawing}
                        onTouchMove={draw}
                        style={{
                            background: '#04060A',
                            border: '2px solid rgba(255,255,255,0.15)',
                            borderRadius: '16px',
                            cursor: 'crosshair',
                            touchAction: 'none'
                        }}
                    />
                    {lastSyncTime && (
                        <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'center', marginTop: '4px', fontFamily: 'monospace' }}>
                            Última sync: {new Date(lastSyncTime).toLocaleTimeString()}
                        </div>
                    )}
                </div>

                {/* PEER CANVASES FROM NETWORK */}
                {peerCanvases.length > 0 && peerCanvases.map((frame, idx) => (
                    <div key={idx}>
                        <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginBottom: '4px', textAlign: 'center', fontWeight: 700 }}>NODO PEER {idx + 1}</div>
                        <img
                            src={`data:image/png;base64,${frame}`}
                            alt={`Pizarra del Nodo Peer ${idx + 1}`}
                            style={{
                                width: '160px',
                                height: '210px',
                                borderRadius: '12px',
                                border: '1px solid rgba(56,189,248,0.3)',
                                objectFit: 'cover',
                                display: 'block'
                            }}
                        />
                    </div>
                ))}

                {peerCanvases.length === 0 && (
                    <div style={{ color: '#374151', fontSize: '0.8rem', textAlign: 'center', padding: '20px', maxWidth: '160px' }}>
                        Las pizarras de otros nodos aparecerán aquí cuando se conecten.
                    </div>
                )}
            </div>
        </div>
    );
};

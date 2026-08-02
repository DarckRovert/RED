'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { sendVoiceBurst, getVoiceBursts, VoiceBurst } from '../lib/api';

export const P2PWalkieTalkieModal: React.FC = () => {
    const { navigate } = useRedStore();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [bursts, setBursts] = useState<VoiceBurst[]>([]);

    const loadBursts = async () => {
        try {
            const list = await getVoiceBursts();
            setBursts(list);
        } catch (e) {
            console.error('Voice bursts error:', e);
        }
    };

    useEffect(() => {
        loadBursts();
        const interval = setInterval(loadBursts, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let timer: any;
        if (isRecording) {
            timer = setInterval(() => setRecordingTime((t) => t + 1), 1000);
        } else {
            setRecordingTime(0);
        }
        return () => clearInterval(timer);
    }, [isRecording]);

    const handlePressDown = () => {
        setIsRecording(true);
    };

    const handlePressRelease = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        const duration = Math.max(1, recordingTime);

        try {
            // Ráfaga simulada de voz Opus comprimida base64
            const dummyOpusB64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRHzY4A";
            await sendVoiceBurst({
                sender_name: 'Operador Walkie',
                duration_seconds: duration,
                audio_opus_b64: dummyOpusB64
            });
            await loadBursts();
        } catch (e: any) {
            alert(`Error de transmisión: ${e.message}`);
        }
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
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🎙️ WALKIE-TALKIE P2P PUSH-TO-TALK
                </div>
                <div style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 800, fontFamily: 'monospace' }}>
                    OPUS 8 KBPS MESH
                </div>
            </div>

            {/* MAIN PTT INTERFACE */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                
                {/* PTT BIG BUTTON */}
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <button
                        onMouseDown={handlePressDown}
                        onMouseUp={handlePressRelease}
                        onTouchStart={handlePressDown}
                        onTouchEnd={handlePressRelease}
                        style={{
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            background: isRecording
                                ? 'radial-gradient(circle, #ef4444 0%, #991b1b 100%)'
                                : 'radial-gradient(circle, #0284c7 0%, #0369a1 100%)',
                            border: isRecording ? '4px solid #fca5a5' : '4px solid #7dd3fc',
                            boxShadow: isRecording ? '0 0 50px rgba(239,68,68,0.6)' : '0 0 30px rgba(56,189,248,0.3)',
                            color: '#fff',
                            fontSize: '3.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>🎙️</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 900, marginTop: '8px', letterSpacing: '1px' }}>
                            {isRecording ? `TRANSMITIENDO (${recordingTime}s)` : 'MANTÉN PARA HABLAR'}
                        </span>
                    </button>
                </div>

                {/* RECENT VOICE BURSTS LIST */}
                <div style={{ width: '100%', maxWidth: '500px', background: 'rgba(15,23,42,0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', letterSpacing: '0.5px' }}>
                        RÁFAGAS DE VOZ RECIENTES (RADIO MESH)
                    </div>

                    {bursts.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '20px' }}>
                            No hay ráfagas de voz captadas en la red.
                        </div>
                    ) : (
                        bursts.map((b) => (
                            <div key={b.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 14px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.85rem'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: '#fff' }}>{b.sender_name}</div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                                        Duración: {b.duration_seconds}s | {new Date(b.timestamp * 1000).toLocaleTimeString()}
                                    </div>
                                </div>
                                <button
                                    onClick={() => alert(`▶️ Reproduciendo ráfaga de voz de ${b.sender_name}...`)}
                                    style={{
                                        background: 'rgba(56,189,248,0.15)',
                                        border: '1px solid #38bdf8',
                                        color: '#38bdf8',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    ▶ Reproducción Opus
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

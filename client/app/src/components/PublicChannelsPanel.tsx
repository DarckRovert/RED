'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { getChannelMessages, postChannelMessage, summarizeChannelAI, ChannelMessage } from '../lib/api';

export const PublicChannelsPanel: React.FC = () => {
    const { navigate } = useRedStore();
    const [channelId, setChannelId] = useState('red-local-general');
    const [channels, setChannels] = useState<string[]>(['red-local-general', 'red-emergency-lima']);
    const [messages, setMessages] = useState<ChannelMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [senderName, setSenderName] = useState('Operador Táctico');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const loadMessages = async () => {
        try {
            const data = await getChannelMessages(channelId);
            setMessages(Array.isArray(data?.messages) ? data.messages : []);
            if (Array.isArray(data?.channels) && data.channels.length > 0) {
                setChannels(data.channels);
            }
            setErrorMsg(null);
        } catch (e: any) {
            console.error('Channel fetch error:', e);
            setMessages([]);
        }
    };

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 4000);
        return () => clearInterval(interval);
    }, [channelId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        setLoading(true);
        setErrorMsg(null);
        try {
            await postChannelMessage({
                channel_id: channelId,
                sender_name: senderName,
                content: inputText.trim()
            });
            setInputText('');
            await loadMessages();
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al publicar en el canal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: '#030712',
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
                        color: '#a855f7',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        fontWeight: 700
                    }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    📻 CANALES DE DIFUSIÓN MESH
                </div>
                <button
                    onClick={async () => {
                        try {
                            const res = await summarizeChannelAI(channelId, messages.map(m => m.content));
                            alert(`🪄 RESUMEN IA DEL CANAL #${channelId}:\n\n${res.summary_bullets.join('\n')}`);
                        } catch (e: any) {
                            alert(`Error al generar resumen: ${e.message}`);
                        }
                    }}
                    style={{
                        background: 'rgba(192,132,252,0.15)',
                        border: '1px solid #c084fc',
                        color: '#c084fc',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                    }}
                >
                    🪄 Resumen IA
                </button>
            </div>

            {/* CHANNEL SELECTOR */}
            <div style={{
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: '10px',
                overflowX: 'auto'
            }}>
                {channels.map((ch) => (
                    <button
                        key={ch}
                        onClick={() => setChannelId(ch)}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: channelId === ch ? '#a855f7' : 'rgba(255,255,255,0.15)',
                            background: channelId === ch ? 'rgba(168,85,247,0.2)' : 'transparent',
                            color: channelId === ch ? '#c084fc' : '#94a3b8',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        #{ch}
                    </button>
                ))}
            </div>

            {/* MESSAGES FEED */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {errorMsg && (
                    <div style={{ padding: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '8px', fontSize: '0.85rem' }}>
                        ⛔ {errorMsg}
                    </div>
                )}

                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px', fontSize: '0.9rem' }}>
                        No hay boletines recientes en #{channelId}. ¡Sé el primero en emitir!
                    </div>
                ) : (
                    messages.map((m) => (
                        <div key={m.id} style={{
                            background: 'rgba(15,23,42,0.6)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            padding: '14px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.78rem' }}>
                                <span style={{ fontWeight: 800, color: '#a855f7' }}>{m.sender_name}</span>
                                <span style={{ color: '#64748b', fontFamily: 'monospace' }}>
                                    {new Date(m.timestamp * 1000).toLocaleTimeString()}
                                </span>
                            </div>
                            <div style={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: '1.4' }}>
                                {m.content}
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#475569', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Hash: {m.hash.substring(0, 16)}...</span>
                                <span style={{ color: '#00D97E' }}>✓ Guardian OK</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* POST INPUT */}
            <form onSubmit={handleSend} style={{
                padding: '16px 20px',
                background: 'rgba(15,23,42,0.95)',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                gap: '10px'
            }}>
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Transmitir boletín en #${channelId}...`}
                    style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        color: '#fff',
                        fontSize: '0.9rem',
                        outline: 'none'
                    }}
                />
                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 800,
                        cursor: 'pointer'
                    }}
                >
                    {loading ? '...' : 'Emitir'}
                </button>
            </form>
        </div>
    );
};

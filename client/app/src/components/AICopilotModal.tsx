'use client';

import React, { useState } from 'react';
import { useRedStore } from '../store/useRedStore';
import { queryAICopilot, CopilotResponse } from '../lib/api';

export const AICopilotModal: React.FC = () => {
    const { navigate } = useRedStore();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; category?: string; source?: string }>>([
        {
            sender: 'ai',
            text: '🤖 Hola. Soy el Copiloto IA Táctico de RED. Opero 100% en local (<15 MB RAM) sin necesidad de internet.\n\n¿En qué puedo ayudarte? Puedes preguntarme sobre primeros auxilios, protocolos de desastres o ayuda de red.',
            category: 'Asistencia General',
            source: 'RED Local Nano-AI Engine'
        }
    ]);

    const handleSend = async (queryText?: string) => {
        const text = queryText || input;
        if (!text.trim()) return;

        setMessages((prev) => [...prev, { sender: 'user', text }]);
        if (!queryText) setInput('');
        setLoading(true);

        try {
            const res: CopilotResponse = await queryAICopilot(text);
            setMessages((prev) => [
                ...prev,
                { sender: 'ai', text: res.answer, category: res.topic_category, source: res.source }
            ]);
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                { sender: 'ai', text: `❌ Error de inferencia local: ${e.message}` }
            ]);
        } finally {
            setLoading(false);
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
                    🤖 COPILOTO IA TÁCTICO OFFLINE
                </div>
                <div style={{ fontSize: '0.72rem', color: '#00D97E', fontWeight: 800, fontFamily: 'monospace' }}>
                    DUAL-ENGINE (&lt;15MB RAM)
                </div>
            </div>

            {/* CHAT MESSAGES BODY */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {messages.map((m, idx) => (
                    <div
                        key={idx}
                        style={{
                            alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            background: m.sender === 'user' ? 'rgba(56,189,248,0.2)' : 'rgba(15,23,42,0.85)',
                            border: m.sender === 'user' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px',
                            padding: '14px 18px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                        }}
                    >
                        {m.category && (
                            <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800, marginBottom: '6px', fontFamily: 'monospace' }}>
                                [{m.category.toUpperCase()}] • {m.source}
                            </div>
                        )}
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* QUICK SUGGESTIONS PILS */}
            <div style={{ padding: '8px 20px', display: 'flex', gap: '8px', overflowX: 'auto', background: 'rgba(0,0,0,0.4)' }}>
                <button
                    onClick={() => handleSend('¿Qué hago en caso de primeros auxilios por herida?')}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                    🚑 Primeros Auxilios
                </button>
                <button
                    onClick={() => handleSend('¿Cuál es el protocolo de seguridad en sismos?')}
                    style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', color: '#fcd34d', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                    🚨 Protocolo Sismo
                </button>
                <button
                    onClick={() => handleSend('¿Cómo funciona el cifrado y la red mesh en RED?')}
                    style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#7dd3fc', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}
                >
                    🛰️ Diagnóstico RED
                </button>
            </div>

            {/* INPUT BAR */}
            <div style={{ padding: '16px 20px', background: 'rgba(15,23,42,0.95)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '12px' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Pregunta al Copiloto IA Off-Grid..."
                    style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        color: '#fff',
                        fontSize: '0.9rem'
                    }}
                />
                <button
                    onClick={() => handleSend()}
                    disabled={loading}
                    style={{
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        border: 'none',
                        color: '#fff',
                        padding: '0 20px',
                        borderRadius: '12px',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    {loading ? '...' : 'Enviar'}
                </button>
            </div>
        </div>
    );
};

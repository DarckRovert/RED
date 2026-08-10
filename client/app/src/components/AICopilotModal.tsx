'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';
import { queryAICopilot, translateTextAI, summarizeChannelAI, CopilotResponse } from '../lib/api';
import { LocalAIEngine } from '../lib/localAiEngine';
import { HiveMindEngine } from '../lib/hiveMindEngine';
import { ModelManager, LocalModelMetaData } from '../lib/modelManager';

type MainViewMode = 'chat' | 'models';

export const AICopilotModal: React.FC = () => {
    const { navigate, messages: chatMessages, activeConversationId } = useRedStore();
    const [viewMode, setViewMode] = useState<MainViewMode>('chat');
    const [input, setInput] = useState('');
    const [targetLang, setTargetLang] = useState('es');
    const [loading, setLoading] = useState(false);
    
    // Active Model State
    const [activeModel, setActiveModel] = useState<LocalModelMetaData | null>(null);
    const [availableModels, setAvailableModels] = useState<LocalModelMetaData[]>([]);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);

    const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; modelTag?: string }>>([
        {
            sender: 'ai',
            text: '🤖 Hola. Soy el Copiloto IA Neuronal de RED.\n\nPuedo asistirte en conversación libre, guías de supervivencia médica, protocolos de desastres y traducción táctica 100% offline.',
            modelTag: 'Gemma 2B Instruct (Google ARM64 Nativo)'
        }
    ]);

    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const models = ModelManager.getModels();
        setAvailableModels(models);
        setActiveModel(ModelManager.getActiveModel());
    }, []);

    const handleSelectModel = (modelId: string) => {
        ModelManager.setActiveModel(modelId);
        setActiveModel(ModelManager.getActiveModel());
        setAvailableModels([...ModelManager.getModels()]);
    };

    const handleDownloadModel = async (modelId: string) => {
        setDownloadingId(modelId);
        setDownloadProgress(0);
        await ModelManager.downloadModel(modelId, (pct) => {
            setDownloadProgress(pct);
        });
        ModelManager.setActiveModel(modelId);
        setActiveModel(ModelManager.getActiveModel());
        setAvailableModels([...ModelManager.getModels()]);
        setDownloadingId(null);
    };

    // Auto-scroll on new message
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async (customText?: string) => {
        const text = customText || input;
        if (!text.trim()) return;

        setMessages((prev) => [...prev, { sender: 'user', text }]);
        if (!customText) setInput('');
        setLoading(true);

        try {
            const res: CopilotResponse = await queryAICopilot(text);
            const currentModelName = activeModel?.name || res.topic_category || 'Gemma 2B Instruct';
            setMessages((prev) => [
                ...prev,
                { 
                    sender: 'ai', 
                    text: res.answer, 
                    modelTag: `${currentModelName} (Nativo ARM64)`
                }
            ]);
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                { sender: 'ai', text: `⚠️ Error de inferencia local: ${e.message}`, modelTag: 'Sistema RED' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleSummarizeChannel = async () => {
        const rawTexts = chatMessages.map(m => m.content);
        if (rawTexts.length === 0) {
            setMessages(prev => [...prev, { sender: 'ai', text: '📝 No hay mensajes en el canal activo para resumir.', modelTag: 'Resumidor Canal' }]);
            return;
        }
        setLoading(true);
        try {
            const res = await summarizeChannelAI(activeConversationId || 'general', rawTexts);
            const summaryStr = `📝 Resumen Neuronal de Canal (${res.total_messages_analyzed} mensajes):\n\n` + res.summary_bullets.map(b => `• ${b}`).join('\n') + `\n\nSentimiento: ${res.sentiment}`;
            setMessages(prev => [...prev, { sender: 'ai', text: summaryStr, modelTag: 'Resumidor Neuronal Off-Grid' }]);
        } catch (e: any) {
            setMessages(prev => [...prev, { sender: 'ai', text: `⚠️ Error al resumir canal: ${e.message}`, modelTag: 'Sistema RED' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleTranslatePrompt = async (text: string) => {
        setLoading(true);
        try {
            const res = await translateTextAI(text, targetLang);
            setMessages(prev => [...prev, { sender: 'ai', text: `🌐 Traducción Táctica [${targetLang.toUpperCase()}]:\n\n${res.translated_text}`, modelTag: `Traductor (${targetLang.toUpperCase()})` }]);
        } catch (e: any) {
            setMessages(prev => [...prev, { sender: 'ai', text: `⚠️ Error al traducir: ${e.message}`, modelTag: 'Sistema RED' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(3,3,6,0.96)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* TOP NAVIGATION BAR */}
            <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(15,23,42,0.9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => navigate('chat')}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 700
                        }}
                    >
                        ← Volver
                    </button>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: '1rem', color: '#FFF' }}>
                            🤖 Copiloto IA Soberano RED
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#00E676', fontWeight: 700, fontFamily: 'monospace' }}>
                            🟢 Motor Activo: {activeModel?.name || 'Gemma 2B Instruct (Google Nativo)'}
                        </div>
                    </div>
                </div>

                {/* VIEW MODE SELECTOR TABS */}
                <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                        onClick={() => setViewMode('chat')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            background: viewMode === 'chat' ? '#E8213A' : 'transparent',
                            color: viewMode === 'chat' ? '#FFF' : '#94A3B8',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        💬 Chat Copiloto
                    </button>
                    <button
                        onClick={() => setViewMode('models')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            background: viewMode === 'models' ? '#E8213A' : 'transparent',
                            color: viewMode === 'models' ? '#FFF' : '#94A3B8',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        ⚙️ Modelos & Mente Colmena
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            {viewMode === 'models' ? (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '16px', padding: '20px' }}>
                        <h3 style={{ margin: '0 0 8px 0', color: '#38bdf8', fontSize: '1.1rem', fontWeight: 800 }}>🐝 Red Mente Colmena P2P (Hive Mind)</h3>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                            Configura el motor de Inteligencia Artificial que ejecutará las respuestas en el procesador ARM64 de tu dispositivo o delega consultas a otros nodos de la red malla.
                        </p>
                    </div>

                    <div>
                        <h4 style={{ margin: '0 0 14px 0', color: '#fff', fontSize: '1rem', fontWeight: 800 }}>📦 Modelos Neuronal de Alta Capacidad</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                            {availableModels.map((m) => {
                                const isCurrentlyActive = activeModel?.id === m.id || (m.id === 'gemma-2b' && !activeModel);
                                return (
                                    <div key={m.id} style={{ background: 'rgba(15,23,42,0.9)', border: isCurrentlyActive ? '2px solid #00E676' : '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>{m.name}</span>
                                                <span style={{ fontSize: '0.75rem', background: '#1e293b', color: '#00E676', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>{m.parameterCount}</span>
                                            </div>
                                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 14px 0', lineHeight: 1.5 }}>{m.description}</p>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '10px' }}>
                                                Tamaño: {(m.fileSizeMb / 1024).toFixed(1)} GB | RAM Recomendada: {(m.recommendedMinRamMb / 1024).toFixed(1)} GB
                                            </div>
                                            {isCurrentlyActive ? (
                                                <div style={{ background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid #00E676', padding: '10px', borderRadius: '10px', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                                                    🌟 Modelo Principal Activo
                                                </div>
                                            ) : m.isDownloaded ? (
                                                <button
                                                    onClick={() => handleSelectModel(m.id)}
                                                    style={{
                                                        width: '100%',
                                                        background: 'rgba(56,189,248,0.2)',
                                                        color: '#38BDF8',
                                                        border: '1px solid #38BDF8',
                                                        borderRadius: '10px',
                                                        padding: '10px',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    ⚡ Establecer como Modelo Activo
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleDownloadModel(m.id)}
                                                    disabled={downloadingId === m.id}
                                                    style={{
                                                        width: '100%',
                                                        background: downloadingId === m.id ? '#334155' : '#E8213A',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        padding: '10px',
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem',
                                                        cursor: downloadingId === m.id ? 'default' : 'pointer'
                                                    }}
                                                >
                                                    {downloadingId === m.id ? `Descargando... (${downloadProgress}%)` : `⚡ Activar e Instalar (${m.fileSizeMb} MB)`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* CHAT MESSAGES BODY */}
                    <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                style={{
                                    alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    background: m.sender === 'user' ? 'rgba(232,33,58,0.25)' : 'rgba(15,23,42,0.85)',
                                    border: m.sender === 'user' ? '1px solid #E8213A' : '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: '18px',
                                    padding: '16px 20px',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                                }}
                            >
                                {m.modelTag && (
                                    <div style={{ fontSize: '0.72rem', color: '#00E676', fontWeight: 800, marginBottom: '6px', fontFamily: 'monospace' }}>
                                        🤖 {m.modelTag}
                                    </div>
                                )}
                                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.55 }}>
                                    {m.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* QUICK ACTION SUGGESTION CHIPS */}
                    <div style={{ padding: '8px 16px', background: 'rgba(15,23,42,0.7)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                        <button
                            onClick={() => handleSend('¿Cuál es el protocolo de primeros auxilios para torniquetes?')}
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(232,33,58,0.15)', color: '#FF4D66', border: '1px solid rgba(232,33,58,0.3)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            🚑 Primeros Auxilios
                        </button>
                        <button
                            onClick={() => handleSend('¿Qué hacer durante un sismo y cómo evacuar?')}
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(56,189,248,0.15)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            🚨 Protocolo Sismo
                        </button>
                        <button
                            onClick={() => handleSummarizeChannel()}
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid rgba(0,230,118,0.3)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            📝 Resumir Chat Canal
                        </button>
                        <button
                            onClick={() => handleTranslatePrompt(input || 'Atención a todos los equipos, mantener calma.')}
                            style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.3)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            🌐 Traducir Mensaje
                        </button>
                    </div>

                    {/* INPUT CONTROLS */}
                    <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.95)', display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                            placeholder="Escribe un mensaje o consulta táctica para la IA..."
                            style={{
                                flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: '12px', padding: '14px 16px', color: '#fff', outline: 'none', fontSize: '0.92rem'
                            }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={loading}
                            style={{
                                background: 'linear-gradient(90deg, #E8213A 0%, #990014 100%)', color: '#fff', border: 'none',
                                borderRadius: '12px', padding: '0 24px', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem'
                            }}
                        >
                            {loading ? 'Procesando...' : 'Enviar ⚡'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

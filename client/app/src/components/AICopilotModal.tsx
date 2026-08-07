'use client';

import React, { useState } from 'react';
import { useRedStore } from '../store/useRedStore';
import { queryAICopilot, translateTextAI, summarizeChannelAI, CopilotResponse } from '../lib/api';
import { LocalAIEngine } from '../lib/localAiEngine';

type AIMode = 'copilot' | 'guardian' | 'embeddings' | 'summarizer' | 'translator' | 'diagnose';

export const AICopilotModal: React.FC = () => {
    const { navigate, messages: chatMessages, activeConversationId } = useRedStore();
    const [mode, setMode] = useState<AIMode>('copilot');
    const [input, setInput] = useState('');
    const [targetLang, setTargetLang] = useState('es');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; category?: string; source?: string }>>([
        {
            sender: 'ai',
            text: '🤖 Hola. Soy el Copiloto IA Neuronal de RED (3 Redes Neuronales ONNX Locales en WASM).\n\nPuedes probar cada modelo directamente:\n• 🤖 Copiloto / Resumidor / Traductor: LaMini-Flan-T5-77M (ONNX 95MB)\n• 🛡️ Guardian: toxic-bert (Clasificador de Toxicidad 110MB)\n• 🧠 Embeddings: all-MiniLM-L6-v2 (Extractor Vectorial 384-D 23MB)',
            category: '3 Modelos ONNX WASM',
            source: 'RED Local Neural Engine'
        }
    ]);

    const handleSend = async (queryText?: string) => {
        const text = queryText || input;
        if (!text.trim() && mode !== 'summarizer' && mode !== 'diagnose') return;

        setMessages((prev) => [...prev, { sender: 'user', text: text || `[Ejecutar ${mode.toUpperCase()}]` }]);
        if (!queryText) setInput('');
        setLoading(true);

        try {
            if (mode === 'copilot') {
                const res: CopilotResponse = await queryAICopilot(text);
                setMessages((prev) => [
                    ...prev,
                    { sender: 'ai', text: res.answer, category: res.topic_category, source: res.source }
                ]);
            } else if (mode === 'guardian') {
                const safety = await LocalAIEngine.classifySafety(text);
                const categoryStr = (safety.category || 'general').toUpperCase();
                const textOut = `🛡️ INFERENCIA NEURONAL REAL (toxic-bert 110MB ONNX WASM)\n\nTexto analizado: "${text}"\n\n• ¿Es Contenido Tóxico/Amenaza?: ${safety.isToxic ? '⛔ SÍ (Bloqueado por RED Guardian)' : '✅ NO (Seguro)'}\n• Categoría Detectada: ${categoryStr}\n• Confianza ONNX: ${(safety.confidence * 100).toFixed(1)}%\n• Tiempo Inferencia: ${safety.executionTimeMs} ms\n${safety.reason ? `• Razón: ${safety.reason}` : ''}`;
                setMessages((prev) => [
                    ...prev,
                    { sender: 'ai', text: textOut, category: 'toxic-bert (Clasificador ONNX)', source: 'ONNX WASM Safety Classifier' }
                ]);
            } else if (mode === 'embeddings') {
                const emb = await LocalAIEngine.extractEmbeddings(text);
                const textOut = `🧠 EXTRACCIÓN VECTORIAL REAL (all-MiniLM-L6-v2 23MB ONNX WASM)\n\nTexto analizado: "${text}"\n\n• Dimensiones Vectoriales: ${emb.dimensions}-D\n• Magnitud Vectorial: ${emb.magnitude}\n• Muestra de Vector (Primeros 10 de 384 Float32):\n[${emb.vectorPreview.join(', ')}...]\n• Tiempo Inferencia: ${emb.executionTimeMs} ms`;
                setMessages((prev) => [
                    ...prev,
                    { sender: 'ai', text: textOut, category: 'all-MiniLM-L6-v2 (Vector 384-D ONNX)', source: 'ONNX WASM Vector Extractor' }
                ]);
            } else if (mode === 'translator') {
                const res = await translateTextAI(text, targetLang);
                setMessages((prev) => [
                    ...prev,
                    { sender: 'ai', text: `🌐 Traducción Neuronal [${targetLang.toUpperCase()}]:\n\n${res.translated_text}`, category: 'Traductor Off-Grid', source: 'ONNX WASM Neural Translator' }
                ]);
            } else if (mode === 'summarizer') {
                const rawTexts = chatMessages.map(m => m.content);
                const res = await summarizeChannelAI(activeConversationId || 'general', rawTexts);
                const summaryStr = `📝 Resumen Neuronal de Canal (${res.total_messages_analyzed} mensajes):\n\n` + res.summary_bullets.map(b => `• ${b}`).join('\n') + `\n\nSentimiento: ${res.sentiment}`;
                setMessages((prev) => [
                    ...prev,
                    { sender: 'ai', text: summaryStr, category: 'Resumen de Canal', source: 'ONNX WASM Summarizer' }
                ]);
            } else if (mode === 'diagnose') {
                const diag = await LocalAIEngine.diagnoseHealth();
                const diagStr = `🛰️ Diagnóstico de Salud Mesh Telemetría en Vivo:\n\n• Estado: ${diag.status}\n• Telemetría de Dispositivo & Red:\n• ${diag.recommendation}`;
                setMessages((prev) => [
                    ...prev,
                    { sender: 'ai', text: diagStr, category: 'Diagnóstico de Red', source: 'Live Telemetry Neural Predictor' }
                ]);
            }
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
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                    🤖 COPILOTO IA NEURONAL REAL (3 MODELOS ONNX)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#00D97E', fontWeight: 800, fontFamily: 'monospace' }}>
                    100% OFF-GRID
                </div>
            </div>

            {/* AI MODES TABS */}
            <div style={{
                display: 'flex',
                background: 'rgba(15,23,42,0.6)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                padding: '6px 12px',
                gap: '8px',
                overflowX: 'auto'
            }}>
                {[
                    { id: 'copilot', label: '🤖 Copiloto' },
                    { id: 'guardian', label: '🛡️ Guardian (Toxic-BERT)' },
                    { id: 'embeddings', label: '🧠 Embeddings (MiniLM)' },
                    { id: 'summarizer', label: '📝 Resumidor' },
                    { id: 'translator', label: '🌐 Traductor' },
                    { id: 'diagnose', label: '🛰️ Diagnóstico' },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setMode(t.id as AIMode)}
                        style={{
                            background: mode === t.id ? 'var(--primary, #E8213A)' : 'rgba(255,255,255,0.05)',
                            color: mode === t.id ? '#fff' : '#aaa',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {t.label}
                    </button>
                ))}
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
                            <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 800, marginBottom: '4px', textTransform: 'uppercase' }}>
                                {m.category} {m.source && `• ${m.source}`}
                            </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: '1.45' }}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* INPUT CONTROLS */}
            <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.9)', display: 'flex', gap: '10px' }}>
                {mode === 'translator' && (
                    <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        style={{ background: '#0F172A', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0 8px', fontSize: '0.8rem' }}
                    >
                        <option value="es">Español</option>
                        <option value="en">English</option>
                        <option value="pt">Português</option>
                    </select>
                )}
                {mode !== 'summarizer' && mode !== 'diagnose' ? (
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                        placeholder={mode === 'translator' ? "Escribe texto a traducir..." : "Pregunta a la IA Neuronal (ej. 'torniquete', 'sismo')..."}
                        style={{
                            flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '10px', padding: '12px 14px', color: '#fff', outline: 'none'
                        }}
                    />
                ) : (
                    <div style={{ flex: 1, color: '#aaa', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                        {mode === 'summarizer' ? 'Presiona "Ejecutar" para resumir la conversación activa.' : 'Presiona "Ejecutar" para diagnosticar la red Mesh.'}
                    </div>
                )}
                <button
                    onClick={() => handleSend()}
                    disabled={loading}
                    style={{
                        background: 'var(--primary, #E8213A)', color: '#fff', border: 'none',
                        borderRadius: '10px', padding: '0 20px', fontWeight: 800, cursor: 'pointer'
                    }}
                >
                    {loading ? 'Procesando...' : 'Ejecutar ⚡'}
                </button>
            </div>
        </div>
    );
};

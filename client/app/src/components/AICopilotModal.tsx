"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { queryAICopilot, CopilotResponse, summarizeChannelAI } from "../lib/api";
import { LocalAIEngine } from "../lib/localAiEngine";
import { ModelManager, LocalModelMetaData } from "../lib/modelManager";
import { EmergencyGlossaryEngine, GlossaryLanguage, GlossaryEntry, EMERGENCY_GLOSSARY } from "../lib/emergencyGlossary";
import { toast } from "./Toast";

type CopilotTab = "chat" | "translator" | "summarizer" | "models";

interface ChatMessage {
    id: string;
    sender: "user" | "ai";
    text: string;
    modelTag?: string;
    timestamp: number;
    latencyMs?: number;
}

const CHAT_HISTORY_KEY = "red_copilot_chat_history_v2";

const TACTICAL_PRESETS = [
    { icon: "🚨", label: "Triage START", query: "Explica el protocolo de Triage START en combate y desastres paso a paso con códigos de color." },
    { icon: "🩹", label: "Torniquete & Hemorragias", query: "Protocolo de aplicación de torniquete táctico y control de hemorragia exanguinante en zona caliente." },
    { icon: "💧", label: "Purificar Agua", query: "¿Cómo potabilizar agua de río o estancada en situación de supervivencia extrema (filtrado, ebullición, cloro)?" },
    { icon: "📻", label: "Morse SOS & Frecuencias", query: "Códigos Morse de auxilio SOS (... --- ...) y frecuencias de radio de emergencia internacional VHF/UHF." },
    { icon: "📡", label: "Diagnóstico Mesh P2P", query: "¿Cómo funciona el enrutamiento tolerante a retrasos DTN y los saltos Onion en la red RED?" },
    { icon: "⚡", label: "Apagón Eléctrico", query: "Protocolo de supervivencia inmediata ante un colapso de infraestructura eléctrica y comunicaciones." },
    { icon: "🛡️", label: "Cifrado Noise XK", query: "¿Cómo protegen las llaves efímeras Curve25519 y ChaCha20-Poly1305 los mensajes contra intercepción?" }
];

export const AICopilotModal: React.FC = () => {
    const {
        conversations,
        activeConversationId,
        messages: allMessages,
        contacts,
        status,
        sendMessage,
        goBack
    } = useRedStore();

    const effectiveChannels = conversations.length > 0
        ? conversations.map(c => ({
            id: c.id,
            name: c.peer || (c.is_group ? `Grupo ${c.id.slice(0, 6)}` : `Canal ${c.id.slice(0, 6)}`)
        }))
        : [{ id: "general", name: "General" }];

    const [activeTab, setActiveTab] = useState<CopilotTab>("chat");
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [includeTacticalContext, setIncludeTacticalContext] = useState(true);
    const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Chat History State
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem(CHAT_HISTORY_KEY);
                if (saved) return JSON.parse(saved);
            } catch (e) {
                console.error("[Copilot History Load Error]", e);
            }
        }
        return [
            {
                id: "initial_ai_msg",
                sender: "ai",
                text: "🤖 Saludos, Operador. Soy el Copiloto IA Neuronal Soberano de RED.\n\nPuedo asistirte en protocolos de supervivencia, triage médico de combate, purificación de recursos, frecuencias de radio y síntesis táctica 100% offline.\n\n💡 *Tip:* Para razonamiento conversacional ilimitado sobre cualquier tema, puedes descargar un micro-modelo (ej: SmolLM2 360M o Qwen 2.5 0.5B) en la pestaña [Modelos].",
                modelTag: "Motor Táctico RAG MiniLM (100% Offline)",
                timestamp: Date.now()
            }
        ];
    });

    // Active Model State
    const [activeModel, setActiveModel] = useState<LocalModelMetaData | null>(null);
    const [availableModels, setAvailableModels] = useState<LocalModelMetaData[]>([]);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [downloadBytes, setDownloadBytes] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 });

    // Translator State
    const [targetLang, setTargetLang] = useState<GlossaryLanguage>("en");
    const [selectedCategory, setSelectedCategory] = useState<GlossaryEntry["category"] | "all">("all");
    const [translatorInput, setTranslatorInput] = useState("");
    const [translatorOutput, setTranslatorOutput] = useState<string | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);

    // Summarizer State
    const [selectedChannelId, setSelectedChannelId] = useState<string>(activeConversationId || "general");
    const [summaryResult, setSummaryResult] = useState<{
        bullets: string[];
        totalMessages: number;
        sentiment: string;
    } | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    // Save Chat History
    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-50)));
            } catch (e) {
                console.error("[Copilot History Save Error]", e);
            }
        }
    }, [messages]);

    // Check for incoming quick queries from Chat context
    useEffect(() => {
        if (typeof window !== "undefined") {
            const quickQuery = localStorage.getItem("red_copilot_quick_query");
            if (quickQuery) {
                setInput(`Analiza y asísteme con este mensaje: "${quickQuery}"`);
                localStorage.removeItem("red_copilot_quick_query");
                setActiveTab("chat");
            }
        }
    }, []);

    // Load Models on Mount
    const refreshModels = useCallback(async () => {
        const models = await ModelManager.checkLocalModelsStatus();
        setAvailableModels([...models]);
        const currentActive = ModelManager.getActiveModel();
        setActiveModel(currentActive);
    }, []);

    useEffect(() => {
        refreshModels();
    }, [refreshModels]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, loading]);

    // TTS Voice Synthesizer
    const speakText = useCallback((textToSpeak: string) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            toast.error("Síntesis de voz no soportada en este dispositivo");
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak.slice(0, 400));
        utterance.lang = targetLang === "en" ? "en-US" : targetLang === "fr" ? "fr-FR" : "es-ES";
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
        toast.info("🔊 Reproduciendo respuesta táctica...");
    }, [targetLang]);

    // Copy Text to Clipboard
    const copyToClipboard = (text: string, msgId: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedMsgId(msgId);
            toast.success("📋 Directiva copiada al portapapeles");
            setTimeout(() => setCopiedMsgId(null), 2000);
        }
    };

    // Share AI Answer to Active Chat Channel
    const shareToChannel = (text: string) => {
        if (sendMessage) {
            const formatted = `🤖 [Directiva Copiloto IA]:\n${text}`;
            sendMessage(formatted);
            toast.success("🚀 Directiva enviada al canal de chat activo");
        } else {
            toast.error("Canal de chat no disponible");
        }
    };

    // Voice Dictation Toggle (Speech-to-Text)
    const toggleVoiceInput = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
        if (!SpeechRecognition) {
            toast.warning("Reconocimiento de voz no disponible en este dispositivo");
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = "es-ES";
            recognition.continuous = false;
            recognition.interimResults = true;

            recognition.onstart = () => {
                setIsListening(true);
                toast.info("🎙️ Escuchando comando...");
            };

            recognition.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((r: any) => r[0].transcript)
                    .join("");
                setInput(transcript);
            };

            recognition.onerror = (err: any) => {
                console.warn("[Voice Input Error]", err);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (e: any) {
            console.warn('[AICopilot] Speech recognition error:', e?.message || e);
            setIsListening(false);
        }
    };

    const handleSend = async (customText?: string) => {
        const text = (customText || input).trim();
        if (!text) return;

        const userMsg: ChatMessage = {
            id: `msg_${Date.now()}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
            sender: "user",
            text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        if (!customText) setInput("");
        setLoading(true);

        const startTime = performance.now();
        try {
            let contextStr: string | undefined = undefined;
            if (includeTacticalContext) {
                const nodeCount = status?.peer_count ?? contacts.length;
                const activeCh = effectiveChannels.find(c => c.id === activeConversationId)?.name || "General";
                contextStr = `Malla con ${nodeCount} nodos detectados. Canal activo: #${activeCh}. Modo: 100% Offline`;
            }

            const res: CopilotResponse = await queryAICopilot(text, contextStr);
            const latency = Math.round(performance.now() - startTime);
            const tag = res.source || (activeModel && activeModel.isDownloaded ? `${activeModel.name} (ARM64 Nativo)` : "Motor RAG MiniLM (100% Offline)");

            const aiMsg: ChatMessage = {
                id: `msg_${Date.now()}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)}`,
                sender: "ai",
                text: res.answer,
                modelTag: tag,
                timestamp: Date.now(),
                latencyMs: latency
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (e: any) {
            const errorMsg: ChatMessage = {
                id: "msg_err_" + Date.now().toString(36),
                sender: "ai",
                text: `⚠️ Error de inferencia local: ${e.message || "Fallo en motor de inferencia"}`,
                modelTag: "Motor RED Fallback",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectModel = (modelId: string) => {
        ModelManager.setActiveModel(modelId);
        const selected = ModelManager.getActiveModel();
        setActiveModel(selected);
        setAvailableModels([...ModelManager.getModels()]);
        if (selected) {
            toast.success(`Motor activo: ${selected.name}`);
            const switchMsg: ChatMessage = {
                id: "msg_switch_" + Date.now().toString(36),
                sender: "ai",
                text: `🔄 Motor neural cambiado a: ${selected.name}.\nLas consultas se ejecutarán con aceleración nativa local.`,
                modelTag: selected.name,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, switchMsg]);
        }
    };

    const handleDownloadModel = async (modelId: string) => {
        setDownloadingId(modelId);
        setDownloadProgress(0);
        setDownloadBytes({ loaded: 0, total: 0 });
        try {
            await ModelManager.downloadModel(modelId, (pct, loaded, total) => {
                setDownloadProgress(pct);
                setDownloadBytes({ loaded, total });
            });
            ModelManager.setActiveModel(modelId);
            await refreshModels();
            toast.success("Modelo descargado y activado");
        } catch {
            toast.error("Error al descargar modelo");
        } finally {
            setDownloadingId(null);
        }
    };

    const handleCancelDownload = (modelId: string) => {
        ModelManager.cancelDownload(modelId);
        setDownloadingId(null);
        toast.info("Descarga cancelada");
    };

    const handleDeleteModel = async (modelId: string) => {
        const ok = await ModelManager.deleteModel(modelId);
        if (ok) {
            await refreshModels();
            toast.success("Modelo eliminado para liberar espacio");
        } else {
            toast.error("No se pudo eliminar el archivo");
        }
    };

    const handleTranslate = async (overrideText?: string) => {
        const textToTranslate = (overrideText || translatorInput).trim();
        if (!textToTranslate) return;

        setIsTranslating(true);
        try {
            const res = await LocalAIEngine.translateText(textToTranslate, targetLang);
            setTranslatorOutput(res.translatedText);
            toast.success("Traducción completada");
        } catch {
            toast.error("Error al procesar traducción");
        } finally {
            setIsTranslating(false);
        }
    };

    const handleSelectGlossaryEntry = (entry: GlossaryEntry) => {
        setTranslatorInput(entry.termEs);
        handleTranslate(entry.termEs);
    };

    const handleSummarizeChannel = async () => {
        const channelMsgs = allMessages.filter(m => !selectedChannelId || m.channel_id === selectedChannelId || (m as any).conversation_id === selectedChannelId || (selectedChannelId === "general" && !m.channel_id));
        const rawTexts = channelMsgs.map(m => m.content);

        if (rawTexts.length === 0) {
            toast.warning("No hay mensajes en el canal seleccionado para resumir");
            return;
        }

        setIsSummarizing(true);
        try {
            const res = await summarizeChannelAI(selectedChannelId, rawTexts);
            setSummaryResult({
                bullets: res.summary_bullets,
                totalMessages: res.total_messages_analyzed,
                sentiment: res.sentiment
            });
            toast.success("Resumen táctico generado con éxito");
        } catch {
            toast.error("Error al generar resumen del canal");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleClearChat = () => {
        const initialMsg: ChatMessage = {
            id: "initial_ai_msg",
            sender: "ai",
            text: "🤖 Historial reiniciado. Copiloto IA listo para nuevas instrucciones.",
            modelTag: activeModel ? activeModel.name : "Motor RAG MiniLM (100% Offline)",
            timestamp: Date.now()
        };
        setMessages([initialMsg]);
        toast.info("Historial de chat vaciado");
    };

    const filteredGlossary = selectedCategory === "all"
        ? EMERGENCY_GLOSSARY
        : EMERGENCY_GLOSSARY.filter(e => e.category === selectedCategory);

    const totalStorageMb = ModelManager.getTotalStorageUsedMb();

    return (
        <div className="modal-screen-container">
            {/* Header Táctico */}
            <header className="safe-header" style={{
                padding: "10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.98) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={goBack} className="btn-icon" title="Regresar" style={{ width: 34, height: 34 }}>
                        ‹
                    </button>
                    <div style={{
                        width: 36, height: 36, borderRadius: "10px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.1rem", boxShadow: "0 2px 10px rgba(0,229,255,0.3)"
                    }}>🤖</div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "0.92rem", fontWeight: 800, letterSpacing: "0.5px" }}>COPILOTO IA SOBERANO</span>
                            <span className="badge-live-cyan" style={{ fontSize: "0.62rem", padding: "2px 6px" }}>100% OFFLINE</span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                            Motor: <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{activeModel?.name || "RAG Táctico MiniLM"}</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {activeTab === "chat" && (
                        <button
                            onClick={handleClearChat}
                            className="btn-ghost"
                            style={{ padding: "4px 8px", fontSize: "0.72rem", color: "var(--text-muted)" }}
                            title="Limpiar Conversación"
                        >
                            🗑️ Limpiar
                        </button>
                    )}
                </div>
            </header>

            {/* Selector de Pestañas Táctico */}
            <div style={{
                display: "flex",
                background: "rgba(0,0,0,0.4)",
                borderBottom: "1px solid var(--glass-border)",
                padding: "4px 8px", gap: "4px", overflowX: "auto"
            }}>
                {([
                    { id: "chat", icon: "💬", label: "Copiloto" },
                    { id: "translator", icon: "🌐", label: "Traductor & Glosario" },
                    { id: "summarizer", icon: "📋", label: "Resumidor" },
                    { id: "models", icon: "🧠", label: `Modelos ${totalStorageMb > 0 ? `(${totalStorageMb} MB)` : ""}` }
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as CopilotTab)}
                        className={activeTab === tab.id ? "glow-pill-active" : "btn-ghost"}
                        style={{
                            flex: 1, padding: "8px 10px", fontSize: "0.76rem",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                            whiteSpace: "nowrap"
                        }}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* PESTAÑA 1: CHAT CON IA NEURONAL */}
            {activeTab === "chat" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "calc(100% - 105px)", overflow: "hidden" }}>
                    {/* Barra de Presets Tácticos de 1 Toque */}
                    <div style={{
                        display: "flex", gap: "6px", padding: "8px 12px",
                        overflowX: "auto", background: "rgba(0,229,255,0.03)",
                        borderBottom: "1px solid var(--glass-border)",
                        scrollbarWidth: "none"
                    }}>
                        {TACTICAL_PRESETS.map((p, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSend(p.query)}
                                disabled={loading}
                                className="btn-tactical-secondary hover-bright"
                                style={{
                                    padding: "4px 10px", fontSize: "0.72rem",
                                    whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px",
                                    borderRadius: "14px", flexShrink: 0
                                }}
                            >
                                <span>{p.icon}</span>
                                <span>{p.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Mensajes de Chat */}
                    <div ref={chatContainerRef} className="scroll-container" style={{
                        flex: 1, padding: "14px 14px 10px 14px",
                        display: "flex", flexDirection: "column", gap: "12px",
                        overflowY: "auto"
                    }}>
                        {messages.map(msg => {
                            const isAI = msg.sender === "ai";
                            const isCopied = copiedMsgId === msg.id;

                            return (
                                <div
                                    key={msg.id}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: isAI ? "flex-start" : "flex-end",
                                        maxWidth: "85%",
                                        alignSelf: isAI ? "flex-start" : "flex-end"
                                    }}
                                >
                                    <div
                                        className={isAI ? "card-tactical" : "card-tactical-active"}
                                        style={{
                                            padding: "12px 14px",
                                            borderRadius: isAI ? "12px 12px 12px 2px" : "12px 12px 2px 12px",
                                            background: isAI ? "rgba(18, 18, 30, 0.95)" : "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                                            color: isAI ? "var(--text-primary)" : "#000",
                                            border: isAI ? "1px solid var(--glass-border)" : "none",
                                            boxShadow: isAI ? "0 4px 16px rgba(0,0,0,0.3)" : "0 4px 16px rgba(0,229,255,0.3)"
                                        }}
                                    >
                                        <div style={{
                                            fontSize: "0.86rem",
                                            lineHeight: 1.5,
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word",
                                            fontWeight: isAI ? 400 : 600
                                        }}>
                                            {msg.text}
                                        </div>

                                        {isAI && (
                                            <div style={{
                                                marginTop: "8px", paddingTop: "6px",
                                                borderTop: "1px solid rgba(255,255,255,0.06)",
                                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                                fontSize: "0.68rem", color: "var(--text-muted)"
                                            }}>
                                                <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                                                    {msg.modelTag} {msg.latencyMs ? `· ${msg.latencyMs}ms` : ""}
                                                </span>

                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    <button
                                                        onClick={() => copyToClipboard(msg.text, msg.id)}
                                                        className="btn-ghost"
                                                        style={{ padding: "2px 6px", fontSize: "0.68rem" }}
                                                        title="Copiar"
                                                    >
                                                        {isCopied ? "✓ Copiado" : "📋 Copiar"}
                                                    </button>
                                                    <button
                                                        onClick={() => shareToChannel(msg.text)}
                                                        className="btn-ghost"
                                                        style={{ padding: "2px 6px", fontSize: "0.68rem", color: "var(--accent-cyan)" }}
                                                        title="Enviar a canal de chat activo"
                                                    >
                                                        🚀 Enviar a Chat
                                                    </button>
                                                    <button
                                                        onClick={() => speakText(msg.text)}
                                                        className="btn-ghost"
                                                        style={{ padding: "2px 6px", fontSize: "0.68rem" }}
                                                        title="Escuchar audio"
                                                    >
                                                        🔊
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {loading && (
                            <div style={{
                                display: "flex", alignItems: "center", gap: "8px",
                                padding: "10px 14px", background: "rgba(0,229,255,0.05)",
                                border: "1px solid var(--accent-cyan)", borderRadius: "12px",
                                maxWidth: "260px", color: "var(--accent-cyan)", fontSize: "0.80rem"
                            }}>
                                <span style={{ animation: "pulse 1s infinite" }}>⚙️</span>
                                <span>Razonando directiva táctica offline...</span>
                            </div>
                        )}
                    </div>

                    {/* Input Bar con Dictado por Voz y Enviar */}
                    <div style={{
                        padding: "10px 14px",
                        background: "rgba(10, 10, 20, 0.98)",
                        borderTop: "1px solid var(--glass-border)",
                        display: "flex", alignItems: "center", gap: "8px"
                    }}>
                        <button
                            onClick={toggleVoiceInput}
                            className={isListening ? "btn-tactical-primary" : "btn-icon"}
                            style={{
                                width: 38, height: 38, borderRadius: "50%",
                                background: isListening ? "var(--accent-crimson)" : "rgba(255,255,255,0.05)",
                                color: isListening ? "#fff" : "var(--accent-cyan)",
                                flexShrink: 0
                            }}
                            title={isListening ? "Detener grabación" : "Dictar por voz"}
                        >
                            {isListening ? "⏹️" : "🎙️"}
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder={isListening ? "Escuchando dictado..." : "Formula una consulta de emergencia, medicina o táctica..."}
                            style={{ flex: 1, fontSize: "0.85rem", padding: "10px 14px" }}
                            disabled={loading}
                        />

                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || loading}
                            className="btn-tactical-primary"
                            style={{ padding: "10px 16px", fontSize: "0.85rem", opacity: (!input.trim() || loading) ? 0.5 : 1 }}
                        >
                            {loading ? "..." : "Enviar ➔"}
                        </button>
                    </div>
                </div>
            )}

            {/* PESTAÑA 2: TRADUCTOR TÁCTICO OFF-GRID */}
            {activeTab === "translator" && (
                <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Traductor Táctico & Glosario de Supervivencia</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Traducción determinista 100% offline para 6 idiomas con fonética Quechua y definiciones militares.
                                </div>
                            </div>

                            {/* Selector de Idioma */}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <label style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--accent-cyan)", textTransform: "uppercase" }}>
                                    Idioma Destino:
                                </label>
                                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                                    {([
                                        { id: "es", label: "🇪🇸 Español" },
                                        { id: "en", label: "🇺🇸 English" },
                                        { id: "pt", label: "🇧🇷 Português" },
                                        { id: "fr", label: "🇫🇷 Français" },
                                        { id: "de", label: "🇩🇪 Deutsch" },
                                        { id: "qu", label: "🇵🇪 Quechua" }
                                    ] as const).map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => setTargetLang(l.id as GlossaryLanguage)}
                                            className={targetLang === l.id ? "btn-tactical-primary" : "btn-tactical-secondary"}
                                            style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                                        >
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Input de Traducción */}
                            <div style={{ display: "flex", gap: "8px" }}>
                                <input
                                    type="text"
                                    value={translatorInput}
                                    onChange={e => setTranslatorInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleTranslate(); }}
                                    placeholder="Escribe un término (ej: 'Torniquete', 'Evacuación', 'Agua potable')..."
                                    style={{ flex: 1, fontSize: "0.85rem" }}
                                />
                                <button
                                    onClick={() => handleTranslate()}
                                    disabled={!translatorInput.trim() || isTranslating}
                                    className="btn-tactical-primary"
                                    style={{ padding: "8px 16px", fontSize: "0.78rem" }}
                                >
                                    {isTranslating ? "..." : "Traducir"}
                                </button>
                            </div>

                            {translatorOutput && (
                                <div className="card-tactical animate-pop" style={{ padding: "14px", background: "rgba(0,229,255,0.04)", borderColor: "var(--accent-cyan)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--accent-cyan)" }}>RESULTADO TÁCTICO:</span>
                                        <button
                                            onClick={() => speakText(translatorOutput)}
                                            className="btn-ghost"
                                            style={{ padding: "2px 6px", fontSize: "0.70rem" }}
                                            title="Pronunciar"
                                        >
                                            🔊 Pronunciar
                                        </button>
                                    </div>
                                    <div style={{ fontSize: "0.82rem", lineHeight: 1.5, marginTop: "6px", whiteSpace: "pre-wrap" }}>
                                        {translatorOutput}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Glosario de Supervivencia por Categorías */}
                        <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.88rem", fontWeight: 800 }}>Términos Críticos Indexados ({filteredGlossary.length})</div>
                                <div style={{ display: "flex", gap: "4px" }}>
                                    {(["all", "medical", "rescue", "hazard", "defense", "communication"] as const).map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setSelectedCategory(c)}
                                            className={selectedCategory === c ? "glow-pill-active" : "btn-ghost"}
                                            style={{ padding: "2px 6px", fontSize: "0.68rem" }}
                                        >
                                            {c === "all" ? "Todos" : c.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                                {filteredGlossary.map(entry => (
                                    <div
                                        key={entry.id}
                                        onClick={() => handleSelectGlossaryEntry(entry)}
                                        style={{
                                            padding: "8px 10px",
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid var(--glass-border)",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            display: "flex", flexDirection: "column", gap: "2px"
                                        }}
                                        className="hover-bright"
                                    >
                                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                                            {entry.termEs}
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                            EN: {entry.termEn} | QU: {entry.termQu}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 3: RESUMIDOR DE CANAL */}
            {activeTab === "summarizer" && (
                <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Resumidor Táctico de Canales y Malla</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Extrae inteligencia clave, puntos de situación, bajas y eventos críticos de los mensajes activos.
                                </div>
                            </div>

                            {/* Selector de Canal */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--accent-cyan)", textTransform: "uppercase" }}>
                                    Seleccionar Canal para Sintetizar:
                                </label>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {effectiveChannels.map((ch: any) => (
                                        <button
                                            key={ch.id}
                                            onClick={() => setSelectedChannelId(ch.id)}
                                            className={selectedChannelId === ch.id ? "btn-tactical-primary" : "btn-tactical-secondary"}
                                            style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                                        >
                                            #{ch.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleSummarizeChannel}
                                disabled={isSummarizing}
                                className="btn-tactical-primary"
                                style={{ padding: "12px", fontSize: "0.85rem" }}
                            >
                                {isSummarizing ? "⚙️ Sintetizando Inteligencia con IA..." : "📋 GENERAR RESUMEN TÁCTICO"}
                            </button>

                            {summaryResult && (
                                <div className="card-tactical animate-pop" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                            ✅ RESUMEN EJECUTIVO TÁCTICO
                                        </span>
                                        <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                            {summaryResult.totalMessages} mensajes analizados · Sentimiento: {summaryResult.sentiment}
                                        </span>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        {summaryResult.bullets.map((b, idx) => (
                                            <div key={idx} style={{ fontSize: "0.80rem", lineHeight: 1.4, display: "flex", gap: "6px" }}>
                                                <span style={{ color: "var(--accent-cyan)" }}>•</span>
                                                <span>{b}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 4: GESTOR DE MODELOS GGUF / ONNX */}
            {activeTab === "models" && (
                <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Modelos Neuronales GGUF (Inferencia ARM64)</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Ejecución 100% nativa fuera de red en el procesador de tu dispositivo.
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <span style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Almacenamiento ocupado:</span>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {totalStorageMb} MB
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {availableModels.map(model => {
                                    const isActive = activeModel?.id === model.id;
                                    const isDownloading = downloadingId === model.id;
                                    const isReady = model.isDownloaded || model.is_downloaded;

                                    return (
                                        <div
                                            key={model.id}
                                            style={{
                                                padding: "14px",
                                                background: isActive ? "rgba(0,229,255,0.06)" : "rgba(255,255,255,0.02)",
                                                border: `1px solid ${isActive ? "var(--accent-cyan)" : "var(--glass-border)"}`,
                                                borderRadius: "10px",
                                                display: "flex", flexDirection: "column", gap: "8px"
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div>
                                                    <div style={{ fontSize: "0.88rem", fontWeight: 800, color: isActive ? "var(--accent-cyan)" : "var(--text-primary)" }}>
                                                        {model.name} {isActive && "★ (ACTIVO)"}
                                                    </div>
                                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                        Parámetros: {model.parameterCount} · Tamaño: {model.fileSizeMb} MB · RAM Mín: {model.recommendedMinRamMb} MB
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", gap: "6px" }}>
                                                    {isReady ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleSelectModel(model.id)}
                                                                disabled={isActive}
                                                                className={isActive ? "glow-pill-active" : "btn-tactical-secondary"}
                                                                style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                                                            >
                                                                {isActive ? "Activo" : "Seleccionar"}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteModel(model.id)}
                                                                className="btn-ghost"
                                                                style={{ padding: "6px 8px", fontSize: "0.74rem", color: "var(--accent-crimson)" }}
                                                                title="Eliminar modelo para liberar espacio"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {isDownloading ? (
                                                                <button
                                                                    onClick={() => handleCancelDownload(model.id)}
                                                                    className="btn-tactical-secondary"
                                                                    style={{ padding: "6px 12px", fontSize: "0.74rem", color: "var(--accent-crimson)" }}
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleDownloadModel(model.id)}
                                                                    className="btn-tactical-primary"
                                                                    style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                                                                >
                                                                    Descargar ({model.fileSizeMb} MB)
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {isDownloading && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                    <div style={{
                                                        height: "6px", width: "100%", background: "rgba(255,255,255,0.1)",
                                                        borderRadius: "3px", overflow: "hidden"
                                                    }}>
                                                        <div style={{
                                                            height: "100%", width: `${downloadProgress}%`,
                                                            background: "linear-gradient(90deg, #00E5FF, #0284C7)",
                                                            transition: "width 0.2s"
                                                        }} />
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                        <span>Descargando: {downloadProgress}%</span>
                                                        <span>{downloadBytes.total > 0 ? `${(downloadBytes.loaded / (1024*1024)).toFixed(1)} / ${(downloadBytes.total / (1024*1024)).toFixed(1)} MB` : ""}</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                                {model.description}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AICopilotModal;
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

export const AICopilotModal: React.FC = () => {
    const {
        conversations,
        activeConversationId,
        messages: allMessages,
        contacts,
        status,
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
                text: "🤖 Saludos, Operador. Soy el Copiloto IA Neuronal Soberano de RED.\n\nPuedo asistirte en protocolos de supervivencia, triage médico de combate, purificación de recursos, frecuencias de radio y síntesis táctica 100% offline.\n\n💡 *Tip:* Para razonamiento conversacional ilimitado sobre cualquier tema, puedes descargar un micro-modelo (ej: SmolLM 360M o Qwen 0.5B) en la pestaña [Modelos].",
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

    // Load Models on Mount
    useEffect(() => {
        const models = ModelManager.getModels();
        setAvailableModels(models);
        const currentActive = ModelManager.getActiveModel();
        setActiveModel(currentActive);
    }, []);

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
        const utterance = new SpeechSynthesisUtterance(textToSpeak.slice(0, 300));
        utterance.lang = targetLang === "en" ? "en-US" : targetLang === "fr" ? "fr-FR" : "es-ES";
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
        toast.info("🔊 Reproduciendo respuesta táctica...");
    }, [targetLang]);

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
                text: `🔄 Motor neural cambiado a: ${selected.name}.\nTodas las consultas posteriores se ejecutarán con esta arquitectura.`,
                modelTag: selected.name,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, switchMsg]);
        }
    };

    const handleDownloadModel = async (modelId: string) => {
        setDownloadingId(modelId);
        setDownloadProgress(0);
        try {
            await ModelManager.downloadModel(modelId, (pct) => {
                setDownloadProgress(pct);
            });
            ModelManager.setActiveModel(modelId);
            const downloaded = ModelManager.getActiveModel();
            setActiveModel(downloaded);
            setAvailableModels([...ModelManager.getModels()]);
            toast.success("Modelo descargado y activado");
        } catch {
            toast.error("Error al descargar modelo");
        } finally {
            setDownloadingId(null);
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
            modelTag: activeModel ? activeModel.name : "Qwen 2.5 1.5B (ARM64 Nativo)",
            timestamp: Date.now()
        };
        setMessages([initialMsg]);
        toast.info("Historial de chat vaciado");
    };

    const filteredGlossary = selectedCategory === "all"
        ? EMERGENCY_GLOSSARY
        : EMERGENCY_GLOSSARY.filter(e => e.category === selectedCategory);

    return (
        <div className="modal-screen-container">
            {/* Header Táctico */}
            <header className="safe-header" style={{
                padding: "12px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.4)"
                    }}>🤖</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Copiloto IA Offline & Asistente Táctico
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {activeModel ? activeModel.name : "QWEN 2.5 1.5B (GGUF RUST / ONNX)"} · 100% AIR-GAPPED
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "var(--radius-full)", border: "1px solid var(--glass-border)" }}>
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={activeTab === "chat" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            💬 Chat RAG
                        </button>
                        <button
                            onClick={() => setActiveTab("translator")}
                            className={activeTab === "translator" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            🌐 Glosario / Traductor
                        </button>
                        <button
                            onClick={() => setActiveTab("summarizer")}
                            className={activeTab === "summarizer" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            📋 Resumidor
                        </button>
                        <button
                            onClick={() => setActiveTab("models")}
                            className={activeTab === "models" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            🧠 Modelos
                        </button>
                    </div>

                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title="Cerrar Copiloto"
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* PESTAÑA 1: CHAT TÁCTICO RAG */}
            {activeTab === "chat" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Barra Superior de Controles de Chat */}
                    <div style={{
                        padding: "8px 16px",
                        background: "rgba(0,0,0,0.3)",
                        borderBottom: "1px solid var(--glass-border)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontSize: "0.72rem"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "var(--accent-cyan)", fontWeight: 700 }}>
                                <input
                                    type="checkbox"
                                    checked={includeTacticalContext}
                                    onChange={e => setIncludeTacticalContext(e.target.checked)}
                                    style={{ width: 14, height: 14 }}
                                />
                                Inyectar Contexto de Malla RAG ({status?.peer_count ?? contacts.length} Nodos)
                            </label>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={handleClearChat}
                                className="btn-ghost"
                                style={{ padding: "3px 8px", fontSize: "0.68rem" }}
                            >
                                🗑️ Limpiar
                            </button>
                        </div>
                    </div>

                    {/* Chips de Consultas Tácticas Rápidas */}
                    <div style={{
                        padding: "8px 16px",
                        background: "rgba(0, 229, 255, 0.02)",
                        borderBottom: "1px solid var(--glass-border)",
                        display: "flex", gap: "6px", overflowX: "auto", whiteSpace: "nowrap"
                    }}>
                        <button
                            onClick={() => handleSend("Protocolo de Triage START para víctimas múltiples en combate")}
                            className="btn-tactical-secondary"
                            style={{ padding: "4px 10px", fontSize: "0.70rem" }}
                        >
                            🩺 Triage START
                        </button>
                        <button
                            onClick={() => handleSend("Método de purificación solar de agua SODIS y desinfección química")}
                            className="btn-tactical-secondary"
                            style={{ padding: "4px 10px", fontSize: "0.70rem" }}
                        >
                            💧 Agua Segura (SODIS)
                        </button>
                        <button
                            onClick={() => handleSend("Frecuencias de emergencia VHF/UHF y protocolo de llamada Mayday")}
                            className="btn-tactical-secondary"
                            style={{ padding: "4px 10px", fontSize: "0.70rem" }}
                        >
                            📡 Frecuencias Mayday
                        </button>
                        <button
                            onClick={() => handleSend("Procedimiento para detener una hemorragia arterial severa con torniquete")}
                            className="btn-tactical-secondary"
                            style={{ padding: "4px 10px", fontSize: "0.70rem" }}
                        >
                            🩸 Torniquete Arterial
                        </button>
                    </div>

                    {/* Mensajes del Chat */}
                    <div
                        ref={chatContainerRef}
                        className="scroll-container"
                        style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}
                    >
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                style={{
                                    alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                                    maxWidth: "85%",
                                    display: "flex", flexDirection: "column",
                                    alignItems: m.sender === "user" ? "flex-end" : "flex-start"
                                }}
                            >
                                <div style={{
                                    padding: "12px 16px",
                                    borderRadius: m.sender === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                                    background: m.sender === "user" ? "var(--accent-cyan-glow)" : "rgba(20, 20, 35, 0.85)",
                                    border: `1px solid ${m.sender === "user" ? "var(--accent-cyan)" : "var(--glass-border)"}`,
                                    color: "#fff",
                                    fontSize: "0.85rem",
                                    lineHeight: 1.5,
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    boxShadow: m.sender === "user" ? "0 4px 12px rgba(0,229,255,0.2)" : "0 4px 12px rgba(0,0,0,0.3)"
                                }}>
                                    {m.text}
                                </div>

                                {m.sender === "ai" && (
                                    <div style={{
                                        display: "flex", alignItems: "center", gap: "8px",
                                        marginTop: "4px", fontSize: "0.65rem",
                                        color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace"
                                    }}>
                                        <span>⚡ {m.modelTag || "RED Copilot"}</span>
                                        {m.latencyMs && <span>· {m.latencyMs}ms</span>}
                                        <button
                                            onClick={() => speakText(m.text)}
                                            style={{ background: "none", border: "none", color: "var(--accent-cyan)", cursor: "pointer", fontSize: "0.75rem", padding: "0 2px" }}
                                            title="Escuchar respuesta (Voz manos libres)"
                                        >
                                            🔊
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(m.text);
                                                toast.info("Respuesta copiada al portapapeles");
                                            }}
                                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.75rem", padding: "0 2px" }}
                                            title="Copiar texto"
                                        >
                                            📋
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "rgba(0,0,0,0.4)", borderRadius: "12px", border: "1px solid var(--glass-border)" }}>
                                <div className="pulse-indicator" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-cyan)" }} />
                                <span style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                    Generando razonamiento táctico offline...
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Input y Botón de Envío */}
                    <div style={{
                        padding: "12px 16px",
                        borderTop: "1px solid var(--glass-border)",
                        background: "rgba(10, 10, 20, 0.95)",
                        display: "flex", gap: "8px", alignItems: "center"
                    }}>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Formula una consulta de supervivencia o táctica..."
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
                <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
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
                                        { id: "qu", label: "🇵🇪 Quechua (Runasimi)" }
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
                <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
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
                <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Modelos Neuronales GGUF & ONNX WASM</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Catálogo de modelos compatibles con aceleración de hardware ARM64 y WebAssembly local.
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                {availableModels.map(model => {
                                    const isActive = activeModel?.id === model.id;
                                    const isDownloading = downloadingId === model.id;

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
                                                    {model.isDownloaded || model.is_downloaded ? (
                                                        <button
                                                            onClick={() => handleSelectModel(model.id)}
                                                            disabled={isActive}
                                                            className={isActive ? "glow-pill-active" : "btn-tactical-secondary"}
                                                            style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                                                        >
                                                            {isActive ? "Activo" : "Seleccionar"}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleDownloadModel(model.id)}
                                                            disabled={isDownloading}
                                                            className="btn-tactical-primary"
                                                            style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                                                        >
                                                            {isDownloading ? `Descargando ${downloadProgress}%` : "Descargar"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

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
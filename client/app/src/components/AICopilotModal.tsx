"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { queryAICopilot, translateTextAI, summarizeChannelAI, CopilotResponse } from "../lib/api";
import { ModelManager, LocalModelMetaData } from "../lib/modelManager";
import { toast } from "./Toast";

type MainViewMode = "chat" | "models";

export const AICopilotModal: React.FC = () => {
    const { navigate, messages: chatMessages, activeConversationId, goBack } = useRedStore();
    const [viewMode, setViewMode] = useState<MainViewMode>("chat");
    const [input, setInput] = useState("");
    const [targetLang, setTargetLang] = useState("es");
    const [loading, setLoading] = useState(false);
    
    // Active Model State
    const [activeModel, setActiveModel] = useState<LocalModelMetaData | null>(null);
    const [availableModels, setAvailableModels] = useState<LocalModelMetaData[]>([]);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);

    const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; modelTag?: string }>>([
        {
            sender: "ai",
            text: "🤖 Saludos, Operador. Soy el Copiloto IA Neuronal Soberano de RED.\n\nPuedo asistirte en protocolos de supervivencia, triage médico de combate, purificación de recursos y síntesis táctica 100% offline.",
            modelTag: "Qwen 2.5 1.5B (ARM64 Nativo)"
        }
    ]);

    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const models = ModelManager.getModels();
        setAvailableModels(models);
        const currentActive = ModelManager.getActiveModel();
        setActiveModel(currentActive);
        if (currentActive) {
            setMessages(prev => prev.map((m, idx) => idx === 0 ? { ...m, modelTag: `${currentActive.name} (ARM64 Nativo)` } : m));
        }
    }, []);

    const handleSelectModel = (modelId: string) => {
        ModelManager.setActiveModel(modelId);
        const selected = ModelManager.getActiveModel();
        setActiveModel(selected);
        setAvailableModels([...ModelManager.getModels()]);
        if (selected) {
            toast.success(`Motor activo: ${selected.name}`);
            setMessages(prev => [
                ...prev,
                { sender: "ai", text: `🔄 Motor neural cambiado a: ${selected.name}. Todas las consultas posteriores se ejecutarán con esta arquitectura.`, modelTag: selected.name }
            ]);
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

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async (customText?: string) => {
        const text = customText || input;
        if (!text.trim()) return;

        setMessages(prev => [...prev, { sender: "user", text }]);
        if (!customText) setInput("");
        setLoading(true);

        try {
            const res: CopilotResponse = await queryAICopilot(text);
            const tag = res.source || (activeModel ? `${activeModel.name} (ARM64 Nativo)` : "Qwen 2.5 1.5B (ARM64 Nativo)");
            setMessages(prev => [
                ...prev,
                { sender: "ai", text: res.answer, modelTag: tag }
            ]);
        } catch (e: any) {
            setMessages(prev => [
                ...prev,
                { sender: "ai", text: `⚠️ Error de inferencia local: ${e.message}`, modelTag: "Motor RED" }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleSummarizeChannel = async () => {
        const rawTexts = chatMessages.map(m => m.content);
        if (rawTexts.length === 0) {
            toast.warning("No hay mensajes en el canal activo para resumir");
            return;
        }
        setLoading(true);
        try {
            const res = await summarizeChannelAI(activeConversationId || "general", rawTexts);
            const summaryStr = `📝 Resumen Neuronal del Canal (${res.total_messages_analyzed} mensajes):\n\n` + res.summary_bullets.map(b => `• ${b}`).join("\n") + `\n\nSentimiento: ${res.sentiment}`;
            setMessages(prev => [...prev, { sender: "ai", text: summaryStr, modelTag: "Resumidor Off-Grid" }]);
        } catch (e: any) {
            toast.error("Error al resumir canal");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
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
                            Copiloto IA Neuronal Soberano
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {activeModel ? activeModel.name : "MOTOR LOCAL ARM64"} · 100% OFFLINE
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "var(--radius-full)", border: "1px solid var(--glass-border)" }}>
                        <button
                            onClick={() => setViewMode("chat")}
                            className={viewMode === "chat" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            💬 Chat
                        </button>
                        <button
                            onClick={() => setViewMode("models")}
                            className={viewMode === "models" ? "glow-pill-active" : "btn-ghost"}
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

            {/* VISTA 1: CHAT IA */}
            {viewMode === "chat" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Chips de Prompts Rápidos */}
                    <div style={{
                        padding: "10px 16px", display: "flex", gap: "8px",
                        background: "rgba(10, 10, 20, 0.85)", borderBottom: "1px solid var(--glass-border)",
                        overflowX: "auto", flexShrink: 0
                    }}>
                        <button
                            onClick={() => handleSend("¿Cuáles son los pasos para realizar un triage START a víctimas en masa?")}
                            className="btn-tactical-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.74rem", whiteSpace: "nowrap" }}
                        >
                            🏥 Triage START
                        </button>
                        <button
                            onClick={() => handleSend("¿Cómo purificar agua de fuentes dudosas usando métodos improvisados?")}
                            className="btn-tactical-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.74rem", whiteSpace: "nowrap" }}
                        >
                            💧 Purificar Agua
                        </button>
                        <button
                            onClick={() => handleSend("¿Qué técnicas tácticas existen para evadir detección de radiofrecuencia (RF)?")}
                            className="btn-tactical-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.74rem", whiteSpace: "nowrap" }}
                        >
                            📡 Evasión RF
                        </button>
                        <button
                            onClick={handleSummarizeChannel}
                            className="btn-tactical-secondary"
                            style={{ padding: "6px 12px", fontSize: "0.74rem", whiteSpace: "nowrap" }}
                        >
                            📝 Resumir Chat
                        </button>
                    </div>

                    {/* Timeline de Mensajes */}
                    <div ref={chatContainerRef} className="scroll-container" style={{ flex: 1, padding: "16px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className="animate-enter"
                                style={{
                                    alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                                    maxWidth: "85%",
                                    display: "flex", flexDirection: "column", gap: "4px"
                                }}
                            >
                                <div style={{
                                    padding: "12px 16px",
                                    borderRadius: m.sender === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                                    background: m.sender === "user"
                                        ? "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)"
                                        : "rgba(18, 18, 30, 0.95)",
                                    color: m.sender === "user" ? "#000" : "#fff",
                                    fontWeight: m.sender === "user" ? 700 : 400,
                                    border: m.sender === "user" ? "none" : "1px solid var(--glass-border)",
                                    fontSize: "0.90rem", lineHeight: 1.5,
                                    boxShadow: m.sender === "user" ? "0 4px 14px rgba(0,229,255,0.25)" : "none",
                                    whiteSpace: "pre-wrap"
                                }}>
                                    {m.text}
                                </div>

                                {m.modelTag && (
                                    <span style={{
                                        fontSize: "0.65rem", color: "var(--text-muted)",
                                        fontFamily: "JetBrains Mono, monospace",
                                        alignSelf: m.sender === "user" ? "flex-end" : "flex-start"
                                    }}>
                                        ⚡ {m.modelTag}
                                    </span>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="card-tactical animate-pop" style={{ alignSelf: "flex-start", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-cyan)", animation: "pulse 1s infinite" }} />
                                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>Inferencia neuronal en progreso...</span>
                            </div>
                        )}
                    </div>

                    {/* Input Bar */}
                    <form
                        onSubmit={e => { e.preventDefault(); handleSend(); }}
                        style={{ padding: "12px 16px", borderTop: "1px solid var(--glass-border)", background: "rgba(10, 10, 20, 0.95)", display: "flex", gap: "8px" }}
                    >
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Pregunta a la IA táctica soberana..."
                            style={{ flex: 1, fontSize: "0.90rem" }}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="btn-tactical-primary"
                            style={{ padding: "10px 18px", fontSize: "0.88rem" }}
                        >
                            Enviar ➔
                        </button>
                    </form>
                </div>
            )}

            {/* VISTA 2: GESTOR DE MODELOS */}
            {viewMode === "models" && (
                <div className="scroll-container" style={{ flex: 1, padding: "20px 16px" }}>
                    <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                            🧠 CATÁLOGO DE MODELOS NEURONALES ONNX / GGUF LOCALES
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {availableModels.map(model => {
                                const isActive = activeModel?.id === model.id;
                                const isDownloading = downloadingId === model.id;

                                return (
                                    <div key={model.id} className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", borderColor: isActive ? "var(--accent-cyan)" : "var(--glass-border)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: isActive ? "var(--accent-cyan)" : "#fff" }}>
                                                    {model.name}
                                                </div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    {model.quantization} · {model.size_mb} MB
                                                </div>
                                            </div>

                                            {isActive ? (
                                                <span className="badge-tactical badge-tactical-emerald">ACTIVO</span>
                                            ) : model.is_downloaded ? (
                                                <button
                                                    onClick={() => handleSelectModel(model.id)}
                                                    className="btn-tactical-secondary"
                                                    style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                                                >
                                                    Seleccionar
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleDownloadModel(model.id)}
                                                    disabled={isDownloading}
                                                    className="btn-tactical-primary"
                                                    style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                                                >
                                                    {isDownloading ? `${downloadProgress}%` : "Descargar"}
                                                </button>
                                            )}
                                        </div>

                                        <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                                            {model.description}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { getChannelMessages, postChannelMessage, summarizeChannelAI, ChannelMessage } from "../lib/api";
import { toast } from "./Toast";

export const PublicChannelsPanel: React.FC = () => {
    const { navigate, identity, goBack } = useRedStore();
    const { t } = useTranslation();
    const [channelId, setChannelId] = useState("red-local-general");
    const [channels, setChannels] = useState<string[]>(["red-local-general", "emergencias-tacticas", "anuncios-comunitarios"]);
    const [messages, setMessages] = useState<ChannelMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const feedRef = useRef<HTMLDivElement | null>(null);

    const senderName = identity?.nickname || "Operador Táctico";

    const loadMessages = async () => {
        try {
            const data = await getChannelMessages(channelId);
            const rawList = Array.isArray(data?.messages) ? data.messages : [];
            const sorted = [...rawList].sort((a, b) => {
                const tsA = a.timestamp ? (a.timestamp > 1e11 ? a.timestamp / 1000 : a.timestamp) : 0;
                const tsB = b.timestamp ? (b.timestamp > 1e11 ? b.timestamp / 1000 : b.timestamp) : 0;
                return tsA - tsB;
            });
            setMessages(sorted);
            if (Array.isArray(data?.channels) && data.channels.length > 0) {
                setChannels(data.channels);
            }
        } catch {
            setMessages([]);
        }
    };

    useEffect(() => {
        loadMessages();
        const interval = setInterval(loadMessages, 4000);
        return () => clearInterval(interval);
    }, [channelId]);

    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const inputEl = form.querySelector('input') as HTMLInputElement;
        const textToSend = (inputText || inputEl?.value || "").trim();
        if (!textToSend) return;

        setLoading(true);
        try {
            await postChannelMessage({
                channel_id: channelId,
                sender_name: senderName,
                content: textToSend
            });
            setInputText("");
            if (inputEl) inputEl.value = "";
            await loadMessages();
        } catch {
            toast.error("Error al publicar en el canal");
        } finally {
            setLoading(false);
        }
    };

    const handleSummarize = async () => {
        if (messages.length === 0) return;
        setIsSummarizing(true);
        try {
            const msgStrings = messages.map(m => `${m.sender_name}: ${m.content}`);
            const summary = await summarizeChannelAI(channelId, msgStrings);
            if (summary?.summary_bullets?.length > 0) {
                toast.info(`🤖 Resumen IA:\n${summary.summary_bullets.join('\n')}`);
            }
        } catch {
            toast.error("Error al resumir canal");
        } finally {
            setIsSummarizing(false);
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
                    }}>📻</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t('public_channels.title')}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t('public_channels.subtitle')}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={handleSummarize}
                        disabled={isSummarizing || messages.length === 0}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    >
                        {isSummarizing ? "..." : `🤖 ${t('public_channels.ai_summary')}`}
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t('common.close')}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Selector de Canales Segmentados */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                {channels.map(ch => (
                    <button
                        key={ch}
                        onClick={() => setChannelId(ch)}
                        className={channelId === ch ? "glow-pill-active" : "btn-ghost"}
                        style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                    >
                        #{ch.replace("red-", "")}
                    </button>
                ))}
            </div>

            {/* Timeline de Mensajes */}
            <div ref={feedRef} className="scroll-container" style={{ flex: 1, padding: "16px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {messages.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", gap: "10px" }}>
                        <span style={{ fontSize: "2rem" }}>📻</span>
                        <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>{t.chat?.no_messages || "Frecuencia Silenciosa"}</div>
                        <div style={{ fontSize: "0.75rem" }}>{t.public_channels?.composer_placeholder || "Transmitir mensaje a la frecuencia pública…"}</div>
                    </div>
                ) : (
                    messages.map((m, i) => (
                        <div key={i} className="card-tactical animate-enter" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <strong style={{ fontSize: "0.88rem", color: "var(--accent-cyan)" }}>{m.sender_name}</strong>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {new Date(m.timestamp ? (m.timestamp > 1e11 ? m.timestamp : m.timestamp * 1000) : Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.88rem", color: "var(--text-primary)", lineHeight: 1.4 }}>
                                {m.content}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} style={{ padding: "12px 16px", borderTop: "1px solid var(--glass-border)", background: "rgba(10, 10, 20, 0.95)", display: "flex", gap: "8px" }}>
                <input
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={`Transmitir en #${channelId}...`}
                    style={{ 
                        flex: 1, 
                        fontSize: "0.90rem",
                        background: "rgba(20, 20, 30, 0.8)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "10px 14px",
                        outline: "none"
                    }}
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-tactical-primary"
                    style={{ padding: "10px 20px", fontSize: "0.88rem" }}
                >
                    Enviar ➔
                </button>
            </form>
        </div>
    );
};

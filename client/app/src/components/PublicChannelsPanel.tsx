"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { getChannelMessages, postChannelMessage, summarizeChannelAI, ChannelMessage } from "../lib/api";
import { toast } from "./Toast";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { copyToClipboard } from "../lib/clipboard";

const DEFAULT_CHANNELS = [
    "red-local-general",
    "emergencias-tacticas",
    "anuncios-comunitarios",
    "red-emergency-lima",
];

export const PublicChannelsPanel: React.FC = () => {
    const { identity, goBack, activeChannelMessages, addChannelMessage } = useRedStore();
    const { t } = useTranslation();

    // ── Estado de Canales y Persistencia ──────────────────────────────────────
    const [channelId, setChannelId] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("red_last_active_channel") || "red-local-general";
        }
        return "red-local-general";
    });

    const [channels, setChannels] = useState<string[]>(() => {
        if (typeof window !== "undefined") {
            try {
                const saved = localStorage.getItem("red_tuned_channels");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    return Array.from(new Set([...DEFAULT_CHANNELS, ...parsed]));
                }
            } catch {}
        }
        return DEFAULT_CHANNELS;
    });

    // ── Estado de Mensajes & Reactividad ───────────────────────────────────────
    const [fetchedMessages, setFetchedMessages] = useState<ChannelMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryData, setSummaryData] = useState<{ bullets: string[]; timestamp: number } | null>(null);
    const [showTuneModal, setShowTuneModal] = useState(false);
    const [newChannelName, setNewChannelName] = useState("");
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    const feedRef = useRef<HTMLDivElement | null>(null);
    const senderName = identity?.nickname || "Operador Táctico";
    const myDid = identity?.identity_hash || "";

    // ── Fusión Reactiva: Mensajes de Backend + Eventos SSE en Memoria ──────────
    const realtimeChannelMsgs = activeChannelMessages?.[channelId] || [];

    const messages = useMemo(() => {
        const map = new Map<string, ChannelMessage>();
        for (const m of fetchedMessages) {
            if (m?.id) map.set(m.id, m);
            else if (m?.hash) map.set(m.hash, m);
        }
        for (const m of realtimeChannelMsgs) {
            if (m?.id) map.set(m.id, m);
            else if (m?.hash) map.set(m.hash, m);
        }

        const list = Array.from(map.values());
        list.sort((a, b) => {
            const tsA = a.timestamp ? (a.timestamp > 1e11 ? a.timestamp : a.timestamp * 1000) : 0;
            const tsB = b.timestamp ? (b.timestamp > 1e11 ? b.timestamp : b.timestamp * 1000) : 0;
            return tsA - tsB;
        });
        return list;
    }, [fetchedMessages, realtimeChannelMsgs]);

    // ── Carga de Mensajes desde Backend / Sled ─────────────────────────────────
    const loadMessages = async () => {
        try {
            const data = await getChannelMessages(channelId);
            const rawList = Array.isArray(data?.messages) ? data.messages : [];
            setFetchedMessages(rawList);

            if (Array.isArray(data?.channels) && data.channels.length > 0) {
                setChannels(prev => {
                    const merged = Array.from(new Set([...prev, ...data.channels]));
                    if (typeof window !== "undefined") {
                        localStorage.setItem("red_tuned_channels", JSON.stringify(merged));
                    }
                    return merged;
                });
            }
        } catch {
            // Sin conexión con el nodo, se mantiene la memoria reactiva local
        }
    };

    useEffect(() => {
        loadMessages();
        if (typeof window !== "undefined") {
            localStorage.setItem("red_last_active_channel", channelId);
        }
        const interval = setInterval(loadMessages, 5000);
        return () => clearInterval(interval);
    }, [channelId]);

    // ── Registro LIFO de Retroceso de Hardware (Android Back Button) ──────────
    useEffect(() => {
        if (!showTuneModal) return;
        return BackHandlerRegistry.register(() => {
            setShowTuneModal(false);
            return true;
        });
    }, [showTuneModal]);

    useEffect(() => {
        if (!summaryData) return;
        return BackHandlerRegistry.register(() => {
            setSummaryData(null);
            return true;
        });
    }, [summaryData]);

    useEffect(() => {
        return BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
    }, [goBack]);

    // ── Escucha de Mensajes Entrantes vía Malla Local (red_channel_message_received) ──
    useEffect(() => {
        const handleRemoteChannelMsg = (e: any) => {
            const rawMsg = e?.detail;
            if (rawMsg && rawMsg.channel_id) {
                addChannelMessage(rawMsg);
            }
        };
        window.addEventListener("red_channel_message_received", handleRemoteChannelMsg);
        return () => window.removeEventListener("red_channel_message_received", handleRemoteChannelMsg);
    }, [addChannelMessage]);

    // ── Control de Auto-Scroll ───────────────────────────────────────────────
    const scrollToBottom = (smooth = true) => {
        if (feedRef.current) {
            feedRef.current.scrollTo({
                top: feedRef.current.scrollHeight,
                behavior: smooth ? "smooth" : "auto",
            });
        }
    };

    useEffect(() => {
        if (!showScrollBottom) {
            scrollToBottom(false);
        }
    }, [messages.length]);

    const handleFeedScroll = () => {
        if (!feedRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        setShowScrollBottom(distanceToBottom > 140);
    };

    // ── Transmisión de Mensaje con Inserción Optimista Inmediata ──────────────
    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const textToSend = inputText.trim();
        if (!textToSend || loading) return;

        setLoading(true);
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const optimisticMsg: ChannelMessage = {
            id: tempId,
            channel_id: channelId,
            sender_did: myDid,
            sender_name: senderName,
            content: textToSend,
            timestamp: Date.now(),
            is_moderated: true,
        };

        // Inserción optimista en el store de Zustand para 0ms de lag en UI
        addChannelMessage(optimisticMsg);
        setInputText("");

        try {
            const res = await postChannelMessage({
                channel_id: channelId,
                sender_name: senderName,
                content: textToSend,
            });

            if (res?.message) {
                addChannelMessage(res.message);
            }
            await loadMessages();
        } catch (err: any) {
            toast.error(err?.message || "Fallo al transmitir en frecuencia");
        } finally {
            setLoading(false);
            scrollToBottom(true);
        }
    };

    // ── Resumen de Inteligencia Neuronal (SITREP Táctico) ─────────────────────
    const handleSummarize = async () => {
        if (messages.length === 0) {
            toast.info("No hay mensajes en este canal para analizar.");
            return;
        }
        setIsSummarizing(true);
        try {
            const msgStrings = messages.map(m => `${m.sender_name}: ${m.content}`);
            const summary = await summarizeChannelAI(channelId, msgStrings);
            if (summary?.summary_bullets?.length > 0) {
                setSummaryData({
                    bullets: summary.summary_bullets,
                    timestamp: Date.now(),
                });
                toast.success("⚡ SITREP de Canal generado");
            } else {
                toast.info("ℹ️ Sin volumen de inteligencia suficiente para sintetizar.");
            }
        } catch {
            toast.error("Error en el copiloto neuronal al resumir canal.");
        } finally {
            setIsSummarizing(false);
        }
    };

    // ── Inyección Táctica de Coordenadas GPS ──────────────────────────────────
    const handleInsertGps = () => {
        if (!navigator.geolocation) {
            toast.warning("Geolocalización no soportada en este entorno");
            return;
        }
        toast.info("Obteniendo coordenadas GPS fijas...");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(5);
                const lon = pos.coords.longitude.toFixed(5);
                const gpsTag = `[📍 GPS: ${lat}, ${lon}] `;
                setInputText(prev => `${gpsTag}${prev}`);
                toast.success("Coordenadas inyectadas");
            },
            () => {
                toast.error("No se pudo obtener posición GPS");
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    };

    // ── Inyección Táctica de Alerta ───────────────────────────────────────────
    const handleInsertAlert = () => {
        const prefix = "[⚠️ ALERTA TÁCTICA] ";
        if (!inputText.startsWith(prefix)) {
            setInputText(prev => `${prefix}${prev}`);
        }
    };

    // ── Sintonizar / Crear Nuevo Canal ────────────────────────────────────────
    const handleTuneChannel = (e: React.FormEvent) => {
        e.preventDefault();
        const raw = newChannelName.trim().toLowerCase();
        if (!raw) return;
        const formatted = raw.startsWith("red-") ? raw : `red-${raw.replace(/\s+/g, "-")}`;
        const updated = Array.from(new Set([...channels, formatted]));
        setChannels(updated);
        if (typeof window !== "undefined") {
            localStorage.setItem("red_tuned_channels", JSON.stringify(updated));
        }
        setChannelId(formatted);
        setNewChannelName("");
        setShowTuneModal(false);
        toast.success(`Frecuencia sintonizada: #${formatted.replace("red-", "")}`);
    };

    // ── Copiar Hash Criptográfico ────────────────────────────────────────────
    const copyHash = (hashStr?: string, idStr?: string) => {
        const full = hashStr || idStr || "";
        if (!full) return;
        TacticalAudioEngine.playTap();
        copyToClipboard(full).then((ok) => {
            if (ok) {
                toast.success(`Hash copiado: ${full.slice(0, 10)}…`);
            } else {
                toast.error("Error al copiar hash");
            }
        });
    };

    const isNearLoRaMtu = inputText.length > 200;

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative",
            fontFamily: "Inter, -apple-system, sans-serif"
        }}>
            {/* ── Header Táctico HUD ──────────────────────────────────────── */}
            <header style={{
                padding: "12px 18px",
                minHeight: "60px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.96) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", boxShadow: "0 4px 18px rgba(0,229,255,0.4)",
                        border: "1px solid rgba(255,255,255,0.2)"
                    }}>📻</div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "0.4px" }}>
                                #{channelId.replace("red-", "")}
                            </span>
                            <span style={{
                                fontSize: "0.62rem", padding: "2px 6px", borderRadius: "4px",
                                background: "rgba(0, 230, 118, 0.15)", color: "var(--accent-emerald)",
                                border: "1px solid rgba(0, 230, 118, 0.4)", fontFamily: "JetBrains Mono, monospace",
                                fontWeight: 800
                            }}>
                                📡 DIFUSIÓN MALLA
                            </span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                            FRECUENCIA ABIERTA • {messages.length} MENSAJES REGISTRADOS
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={handleSummarize}
                        disabled={isSummarizing || messages.length === 0}
                        className="btn-tactical-secondary"
                        title="Sintetizar puntos clave con Inteligencia Neuronal"
                        style={{
                            padding: "6px 12px", fontSize: "0.78rem", display: "flex",
                            alignItems: "center", gap: "6px", borderRadius: "8px"
                        }}
                    >
                        <span>🤖</span>
                        <span>{isSummarizing ? "Analizando…" : "SITREP IA"}</span>
                    </button>
                    <button
                        onClick={() => setShowTuneModal(true)}
                        className="btn-tactical-secondary"
                        title="Sintonizar nueva frecuencia o canal"
                        style={{ padding: "6px 10px", fontSize: "0.78rem", borderRadius: "8px" }}
                    >
                        + Canal
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t("common.close") || "Cerrar"}
                        style={{ width: 38, height: 38, borderRadius: "10px" }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* ── Selector de Frecuencias / Canales ───────────────────────── */}
            <div style={{
                padding: "8px 14px",
                display: "flex", alignItems: "center", gap: "8px",
                background: "rgba(10, 10, 20, 0.90)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase", paddingLeft: "4px" }}>
                    Frecuencias:
                </span>
                {channels.map(ch => {
                    const isActive = channelId === ch;
                    const chCount = activeChannelMessages?.[ch]?.length || 0;
                    return (
                        <button
                            key={ch}
                            onClick={() => setChannelId(ch)}
                            style={{
                                padding: "6px 14px",
                                fontSize: "0.80rem",
                                fontWeight: isActive ? 800 : 600,
                                borderRadius: "20px",
                                whiteSpace: "nowrap",
                                display: "flex", alignItems: "center", gap: "6px",
                                border: isActive ? "1px solid var(--accent-cyan)" : "1px solid rgba(255,255,255,0.08)",
                                background: isActive ? "rgba(0, 229, 255, 0.15)" : "rgba(255,255,255,0.03)",
                                color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                                cursor: "pointer", transition: "all 0.2s ease",
                                boxShadow: isActive ? "0 0 12px rgba(0,229,255,0.25)" : "none"
                            }}
                        >
                            <span>#{ch.replace("red-", "")}</span>
                            {chCount > 0 && (
                                <span style={{
                                    fontSize: "0.62rem", background: "var(--accent-cyan)", color: "#000",
                                    padding: "1px 5px", borderRadius: "10px", fontWeight: 900
                                }}>
                                    {chCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Panel Táctico SITREP IA (Persistente & Colapsable) ──────── */}
            {summaryData && (
                <div style={{
                    margin: "10px 14px 0", padding: "12px 16px", borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(179, 136, 255, 0.06) 100%)",
                    border: "1px solid rgba(0, 229, 255, 0.35)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                    flexShrink: 0, position: "relative"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.1rem" }}>🤖</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-cyan)", letterSpacing: "0.4px" }}>
                                SITREP NEURONAL • #{channelId.replace("red-", "").toUpperCase()}
                            </span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                            <button
                                onClick={() => {
                                    TacticalAudioEngine.playTap();
                                    copyToClipboard(summaryData.bullets.join("\n")).then((ok) => {
                                        if (ok) {
                                            toast.success("SITREP copiado al portapapeles");
                                        } else {
                                            toast.error("Error al copiar SITREP");
                                        }
                                    });
                                }}
                                className="btn-ghost"
                                style={{ padding: "3px 8px", fontSize: "0.70rem", borderRadius: "6px" }}
                                title="Copiar reporte"
                            >
                                📋 Copiar
                            </button>
                            <button
                                onClick={() => setSummaryData(null)}
                                className="btn-ghost"
                                style={{ padding: "3px 8px", fontSize: "0.70rem", borderRadius: "6px" }}
                                title="Cerrar reporte"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.80rem", lineHeight: 1.5, color: "var(--text-primary)" }}>
                        {summaryData.bullets.map((bullet, idx) => (
                            <li key={idx} style={{ marginBottom: "3px" }}>{bullet}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── Feed de Mensajes Tácticos ───────────────────────────────── */}
            <div
                ref={feedRef}
                onScroll={handleFeedScroll}
                className="scroll-container"
                style={{
                    flex: 1, padding: "16px 14px", display: "flex",
                    flexDirection: "column", gap: "12px", overflowY: "auto"
                }}
            >
                {messages.length === 0 ? (
                    <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", flex: 1, color: "var(--text-muted)",
                        gap: "12px", textAlign: "center"
                    }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: "20px",
                            background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem"
                        }}>
                            📻
                        </div>
                        <div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#FFFFFF" }}>
                                Frecuencia Pública Silenciosa
                            </div>
                            <div style={{ fontSize: "0.75rem", marginTop: "4px", maxWidth: "280px" }}>
                                No hay transmisiones en #{channelId.replace("red-", "")}. Inicia la comunicación en la malla táctica.
                            </div>
                        </div>
                    </div>
                ) : (
                    messages.map((m) => {
                        const isMine = (m.sender_did && myDid && m.sender_did.toLowerCase() === myDid.toLowerCase()) ||
                                       (m.sender_name && m.sender_name === senderName);
                        const msgTime = new Date(m.timestamp ? (m.timestamp > 1e11 ? m.timestamp : m.timestamp * 1000) : Date.now());
                        const shortHash = m.hash ? m.hash.slice(0, 8) : (m.id?.slice(0, 8) || "00000000");

                        return (
                            <div
                                key={m.id || shortHash}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: isMine ? "flex-end" : "flex-start",
                                    width: "100%"
                                }}
                            >
                                <div style={{
                                    maxWidth: "88%",
                                    padding: "12px 16px",
                                    borderRadius: isMine ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                                    background: isMine
                                        ? "linear-gradient(135deg, rgba(0, 229, 255, 0.14) 0%, rgba(2, 132, 199, 0.12) 100%)"
                                        : "linear-gradient(135deg, rgba(24, 24, 38, 0.95) 0%, rgba(16, 16, 26, 0.98) 100%)",
                                    border: isMine
                                        ? "1px solid rgba(0, 229, 255, 0.40)"
                                        : "1px solid rgba(255, 255, 255, 0.08)",
                                    boxShadow: isMine
                                        ? "0 4px 16px rgba(0, 229, 255, 0.12)"
                                        : "0 4px 16px rgba(0, 0, 0, 0.4)",
                                    display: "flex", flexDirection: "column", gap: "6px"
                                }}>
                                    {/* Header de la Burbuja */}
                                    <div style={{
                                        display: "flex", alignItems: "center",
                                        justifyContent: "space-between", gap: "16px",
                                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                                        paddingBottom: "4px"
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                            <span style={{
                                                fontSize: "0.82rem", fontWeight: 800,
                                                color: isMine ? "var(--accent-cyan)" : "#FFFFFF"
                                            }}>
                                                {m.sender_name}
                                            </span>
                                            {isMine ? (
                                                <span style={{
                                                    fontSize: "0.58rem", padding: "1px 5px", borderRadius: "4px",
                                                    background: "var(--accent-cyan)", color: "#000", fontWeight: 900
                                                }}>
                                                    TÚ
                                                </span>
                                            ) : (
                                                <span style={{
                                                    fontSize: "0.60rem", color: "var(--text-muted)",
                                                    fontFamily: "JetBrains Mono, monospace"
                                                }}>
                                                    {m.sender_did ? `${m.sender_did.slice(0, 10)}…` : "did:red:peer"}
                                                </span>
                                            )}
                                        </div>
                                        <span style={{
                                            fontSize: "0.65rem", color: "var(--text-muted)",
                                            fontFamily: "JetBrains Mono, monospace"
                                        }}>
                                            {msgTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                        </span>
                                    </div>

                                    {/* Contenido */}
                                    <div style={{
                                        fontSize: "0.88rem",
                                        color: "var(--text-primary)",
                                        lineHeight: 1.45,
                                        wordBreak: "break-word",
                                        whiteSpace: "pre-wrap"
                                    }}>
                                        {m.content}
                                    </div>

                                    {/* Footer Criptográfico */}
                                    <div style={{
                                        display: "flex", alignItems: "center",
                                        justifyContent: "space-between", marginTop: "2px",
                                        paddingTop: "4px"
                                    }}>
                                        <button
                                            onClick={() => copyHash(m.hash, m.id)}
                                            title="Copiar Hash BLAKE3 de verificación"
                                            style={{
                                                background: "none", border: "none", padding: 0,
                                                color: "var(--text-muted)", fontSize: "0.62rem",
                                                fontFamily: "JetBrains Mono, monospace",
                                                display: "flex", alignItems: "center", gap: "4px",
                                                cursor: "pointer"
                                            }}
                                        >
                                            <span>🔒 #{shortHash}</span>
                                            <span style={{ opacity: 0.6 }}>📋</span>
                                        </button>
                                        <span style={{
                                            fontSize: "0.60rem", color: "var(--accent-emerald)",
                                            fontFamily: "JetBrains Mono, monospace", fontWeight: 700
                                        }}>
                                            🛡️ GUARDIAN OK
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Botón Flotante Scroll To Bottom ─────────────────────────── */}
            {showScrollBottom && (
                <button
                    onClick={() => scrollToBottom(true)}
                    style={{
                        position: "absolute", bottom: "115px", right: "20px",
                        width: 36, height: 36, borderRadius: "50%",
                        background: "var(--accent-cyan)", color: "#000",
                        border: "none", fontWeight: 900, fontSize: "1rem",
                        boxShadow: "0 6px 20px rgba(0,229,255,0.4)",
                        cursor: "pointer", zIndex: 20, display: "flex",
                        alignItems: "center", justifyContent: "center"
                    }}
                    title="Ir al final"
                >
                    ↓
                </button>
            )}

            {/* ── Compositor Táctico Enriquecido ───────────────────────────── */}
            <div style={{
                borderTop: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(12, 12, 22, 0.98) 0%, rgba(6, 6, 14, 1) 100%)",
                padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: "8px"
            }}>
                {/* Herramientas Rápidas de Campo */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                        <button
                            type="button"
                            onClick={handleInsertGps}
                            className="btn-ghost"
                            style={{ padding: "4px 8px", fontSize: "0.70rem", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px" }}
                            title="Inyectar coordenadas GPS fijas"
                        >
                            <span>📍</span> GPS
                        </button>
                        <button
                            type="button"
                            onClick={handleInsertAlert}
                            className="btn-ghost"
                            style={{ padding: "4px 8px", fontSize: "0.70rem", borderRadius: "6px", color: "var(--accent-crimson)", display: "flex", alignItems: "center", gap: "4px" }}
                            title="Prefijar como Alerta Táctica"
                        >
                            <span>⚠️</span> ALERTA
                        </button>
                    </div>

                    <div style={{
                        fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace",
                        color: isNearLoRaMtu ? "var(--accent-amber)" : "var(--text-muted)"
                    }}>
                        {inputText.length}/237 B (MTU LoRa)
                    </div>
                </div>

                {/* Barra de Entrada y Botón de Transmisión */}
                <form onSubmit={handleSend} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder={`Transmitir en #${channelId.replace("red-", "")}…`}
                        disabled={loading}
                        style={{
                            flex: 1,
                            fontSize: "0.90rem",
                            background: "rgba(22, 22, 34, 0.9)",
                            color: "var(--text-primary)",
                            border: isNearLoRaMtu ? "1px solid var(--accent-amber)" : "1px solid var(--glass-border)",
                            borderRadius: "10px",
                            padding: "12px 14px",
                            outline: "none",
                            transition: "border 0.2s ease"
                        }}
                    />
                    <button
                        type="submit"
                        disabled={loading || !inputText.trim()}
                        className="btn-tactical-primary"
                        style={{
                            padding: "12px 18px", fontSize: "0.88rem",
                            borderRadius: "10px", display: "flex",
                            alignItems: "center", gap: "6px",
                            opacity: (!inputText.trim() || loading) ? 0.5 : 1
                        }}
                    >
                        {loading ? "Transmitiendo…" : "Transmitir ➔"}
                    </button>
                </form>
            </div>

            {/* ── Modal de Sintonización de Frecuencia ──────────────────────── */}
            {showTuneModal && (
                <div style={{
                    position: "absolute", inset: 0, background: "rgba(4, 6, 12, 0.85)",
                    backdropFilter: "blur(12px)", zIndex: 100, display: "flex",
                    alignItems: "center", justifyContent: "center", padding: "20px"
                }}>
                    <div className="card-tactical" style={{
                        width: "100%", maxWidth: "400px", padding: "22px",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.8)", border: "1px solid var(--accent-cyan)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                            <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>📻 Sintonizar Frecuencia Malla</div>
                            <button onClick={() => setShowTuneModal(false)} className="btn-icon" style={{ width: 30, height: 30 }}>✕</button>
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: "16px" }}>
                            Ingresa el identificador de la frecuencia pública (ej. <code>operaciones-alfa</code> o <code>patrulla-norte</code>). Se unirá a la difusión P2P de forma transparente.
                        </p>
                        <form onSubmit={handleTuneChannel} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <input
                                autoFocus
                                type="text"
                                placeholder="nombre-del-canal"
                                value={newChannelName}
                                onChange={e => setNewChannelName(e.target.value)}
                                style={{
                                    width: "100%", padding: "10px 14px", borderRadius: "8px",
                                    background: "rgba(20,20,30,0.9)", color: "#fff",
                                    border: "1px solid var(--glass-border)", outline: "none",
                                    fontSize: "0.90rem", fontFamily: "JetBrains Mono, monospace",
                                    boxSizing: "border-box"
                                }}
                            />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                                <button
                                    type="button"
                                    onClick={() => setShowTuneModal(false)}
                                    className="btn-ghost"
                                    style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newChannelName.trim()}
                                    className="btn-tactical-primary"
                                    style={{ padding: "8px 16px", fontSize: "0.82rem" }}
                                >
                                    Sintonizar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

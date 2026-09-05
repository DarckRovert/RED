"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRedStore } from "../../store/useRedStore";
import { callHistory, CallRecord } from "../../lib/audio/CallHistoryEngine";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { avatarStyle } from "../sidebar/types";
import { meshRouter } from "../../lib/mesh/meshRouter";
import { toast } from "../Toast";

export function CallsHistoryView() {
    const { t } = useTranslation();
    const { contacts, conversations, navigate, setActiveCallType, identity, preferences } = useRedStore();
    const isFamiliar = (preferences?.uiMode ?? 'familiar') !== 'tactical';
    const [history, setHistory] = useState<CallRecord[]>(() => callHistory.getHistory());
    const [filter, setFilter] = useState<"all" | "missed">("all");
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerSearch, setPickerSearch] = useState("");
    const [manualHash, setManualHash] = useState("");

    useEffect(() => {
        const unsub = callHistory.subscribe(setHistory);
        return unsub;
    }, []);

    const peerMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const c of contacts || []) {
            if (c?.identity_hash) {
                map.set(c.identity_hash.toLowerCase(), c.display_name || c.name || "Contacto P2P");
                if (c.identity_hash.length >= 8) {
                    map.set(c.identity_hash.toLowerCase().substring(0, 8), c.display_name || c.name || "Contacto P2P");
                }
            }
        }
        return map;
    }, [contacts]);

    const resolveName = (hash: string, fallbackName: string): string => {
        if (!hash) return fallbackName || "Contacto P2P";
        const clean = hash.toLowerCase();
        const found = peerMap.get(clean) || peerMap.get(clean.substring(0, 8));
        if (found) return found;
        const meshPeer = meshRouter.getPeerByAnyId(hash);
        if (meshPeer?.name && !meshPeer.name.startsWith("RED-")) return meshPeer.name;
        return fallbackName || `${hash.substring(0, 8)}…`;
    };

    const filteredHistory = useMemo(() => {
        if (filter === "missed") {
            return history.filter(r => r.direction === "MISSED");
        }
        return history;
    }, [history, filter]);

    const formatTimestamp = (ts: number): string => {
        const date = new Date(ts);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (isToday) return `Hoy, ${timeStr}`;
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return `Ayer, ${timeStr}`;
        return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
    };

    const formatDuration = (sec: number): string => {
        if (sec <= 0) return "";
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        if (m === 0) return `(${s}s)`;
        return `(${m}m ${s}s)`;
    };

    const startCallWithPeer = (peerHash: string, type: "audio" | "video") => {
        if (!peerHash) return;
        const rand = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
            : Date.now().toString(36);
        const callId = `call_${Date.now()}_${rand}`;
        
        setActiveCallType(type);
        useRedStore.setState({
            activeConversationId: peerHash,
            activeCallPeer: peerHash,
            activeCallOffer: null,
            activeCallId: callId,
            incomingCall: null,
            activeCallSignal: null,
            callSignalQueue: []
        });
        setIsPickerOpen(false);
        navigate("call", peerHash);
    };

    const filteredContacts = useMemo(() => {
        const list = Array.isArray(contacts) ? contacts : [];
        if (!pickerSearch.trim()) return list;
        const q = pickerSearch.toLowerCase();
        return list.filter(c => 
            (c.display_name || c.name || "").toLowerCase().includes(q) ||
            (c.identity_hash || "").toLowerCase().includes(q)
        );
    }, [contacts, pickerSearch]);

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%", width: "100%",
            background: isFamiliar ? "#111B21" : "var(--bg-void, #050812)", color: "#FFF", position: "relative",
            overflow: "hidden"
        }}>
            {/* Top Filter Bar */}
            <div style={{
                padding: "12px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: isFamiliar ? "#111B21" : "rgba(10, 14, 28, 0.95)",
                borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 229, 255, 0.15)",
                gap: "8px", flexShrink: 0
            }}>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setFilter("all")}
                        style={{
                            padding: "6px 16px", borderRadius: "20px",
                            fontSize: "0.80rem", fontWeight: 700, cursor: "pointer",
                            background: filter === "all" ? (isFamiliar ? "#00A884" : "rgba(0, 230, 118, 0.2)") : (isFamiliar ? "#202C33" : "rgba(255, 255, 255, 0.06)"),
                            color: filter === "all" ? "#FFFFFF" : (isFamiliar ? "#8696A0" : "var(--text-muted, #888)"),
                            border: filter === "all" ? (isFamiliar ? "none" : "1px solid rgba(0, 230, 118, 0.4)") : "none",
                            transition: "all 0.15s ease"
                        }}
                    >
                        Todas ({history.length})
                    </button>
                    <button
                        onClick={() => setFilter("missed")}
                        style={{
                            padding: "6px 16px", borderRadius: "20px",
                            fontSize: "0.80rem", fontWeight: 700, cursor: "pointer",
                            background: filter === "missed" ? (isFamiliar ? "rgba(241, 92, 109, 0.25)" : "rgba(255, 51, 85, 0.2)") : (isFamiliar ? "#202C33" : "rgba(255, 255, 255, 0.06)"),
                            color: filter === "missed" ? (isFamiliar ? "#F15C6D" : "#FF3355") : (isFamiliar ? "#8696A0" : "var(--text-muted, #888)"),
                            border: filter === "missed" ? (isFamiliar ? "1px solid rgba(241, 92, 109, 0.4)" : "1px solid rgba(255, 51, 85, 0.4)") : "none",
                            transition: "all 0.15s ease"
                        }}
                    >
                        Perdidas ({history.filter(r => r.direction === "MISSED").length})
                    </button>
                </div>

                {history.length > 0 && (
                    <button
                        onClick={() => {
                            if (window.confirm("¿Deseas vaciar el registro de llamadas?")) {
                                callHistory.clearHistory();
                                toast.info("Historial de llamadas limpiado");
                            }
                        }}
                        style={{
                            background: "transparent", border: "none",
                            color: isFamiliar ? "#8696A0" : "var(--text-muted, #777)", fontSize: "0.76rem",
                            cursor: "pointer", fontWeight: 600
                        }}
                    >
                        🗑️ Limpiar
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: "80px" }}>
                {/* Squad Voice Call Shortcut */}
                <div 
                    onClick={() => navigate("walkie")}
                    style={{
                        margin: "12px 16px", padding: "12px 16px",
                        background: isFamiliar ? "#182229" : "linear-gradient(135deg, rgba(0, 229, 255, 0.12) 0%, rgba(138, 43, 226, 0.08) 100%)",
                        border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 229, 255, 0.3)",
                        borderRadius: "14px",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        cursor: "pointer"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                            width: "42px", height: "42px", borderRadius: "50%",
                            background: isFamiliar ? "#00A884" : "linear-gradient(135deg, #00E5FF, #0097A7)",
                            color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.3rem", fontWeight: 900
                        }}>
                            📻
                        </div>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: isFamiliar ? "#E9EDEF" : "#FFFFFF" }}>
                                Sala de Voz de Escuadrón (PTT)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isFamiliar ? "#8696A0" : "var(--accent-cyan, #00E5FF)", fontFamily: isFamiliar ? "inherit" : "JetBrains Mono, monospace" }}>
                                Canal de audio táctico multi-nodo
                            </div>
                        </div>
                    </div>
                    <span style={{ fontSize: "1.1rem", color: isFamiliar ? "#00A884" : "var(--accent-cyan, #00E5FF)" }}>➔</span>
                </div>

                {/* Section Title */}
                <div style={{ padding: "8px 18px 4px 18px", fontSize: "0.74rem", fontWeight: 700, color: isFamiliar ? "#8696A0" : "var(--text-muted, #777)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                    Recientes
                </div>

                {/* Calls List */}
                {filteredHistory.length === 0 ? (
                    <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        padding: "60px 24px", textAlign: "center", gap: "14px", color: isFamiliar ? "#8696A0" : "var(--text-muted, #777)"
                    }}>
                        <div style={{
                            width: "68px", height: "68px", borderRadius: "50%",
                            background: isFamiliar ? "#202C33" : "rgba(255, 255, 255, 0.04)",
                            border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(255, 255, 255, 0.1)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem"
                        }}>
                            📞
                        </div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: isFamiliar ? "#E9EDEF" : "#EEE" }}>
                            {filter === "missed" ? "No hay llamadas perdidas" : "No hay llamadas recientes"}
                        </div>
                        <div style={{ fontSize: "0.78rem", maxWidth: "280px", lineHeight: 1.45 }}>
                            Las llamadas de voz y video P2P cifradas de extremo a extremo aparecerán aquí.
                        </div>
                        <button
                            onClick={() => setIsPickerOpen(true)}
                            style={{
                                marginTop: "10px", padding: "10px 22px", borderRadius: "24px",
                                background: isFamiliar ? "#00A884" : "linear-gradient(135deg, #00E676, #00B368)",
                                color: "#FFFFFF",
                                fontWeight: 700, fontSize: "0.84rem", cursor: "pointer", border: "none",
                                boxShadow: isFamiliar ? "0 4px 14px rgba(0, 168, 132, 0.4)" : "none"
                            }}
                        >
                            📞 Iniciar Nueva Llamada
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {filteredHistory.map((record) => {
                            const displayName = resolveName(record.peerHash, record.peerName);
                            const isMissed = record.direction === "MISSED";
                            const isOutgoing = record.direction === "OUTGOING";
                            const isVideo = record.callType === "video";

                            return (
                                <div
                                    key={record.id}
                                    onClick={() => navigate("chat", record.peerHash)}
                                    style={{
                                        display: "flex", alignItems: "center", justifyContent: "space-between",
                                        padding: "12px 18px",
                                        borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.04)" : "1px solid rgba(255, 255, 255, 0.05)",
                                        transition: "background 0.15s ease", cursor: "pointer"
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                                        <div style={{
                                            width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontWeight: 700, color: "#FFFFFF", fontSize: "1.1rem",
                                            ...avatarStyle(record.peerHash || "call")
                                        }}>
                                            {displayName.charAt(0).toUpperCase()}
                                        </div>

                                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                                            <div style={{
                                                fontSize: "0.95rem", fontWeight: 600,
                                                color: isMissed ? (isFamiliar ? "#F15C6D" : "#FF3355") : (isFamiliar ? "#E9EDEF" : "#FFFFFF"),
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                                            }}>
                                                {displayName}
                                            </div>

                                            <div style={{
                                                fontSize: "0.75rem", color: isFamiliar ? "#8696A0" : "var(--text-muted, #888)",
                                                display: "flex", alignItems: "center", gap: "6px", marginTop: "2px"
                                            }}>
                                                <span style={{
                                                    color: isMissed ? (isFamiliar ? "#F15C6D" : "#FF3355") : (isOutgoing ? (isFamiliar ? "#8696A0" : "var(--accent-emerald)") : (isFamiliar ? "#00A884" : "var(--accent-cyan)")),
                                                    fontSize: "0.90rem", fontWeight: 900
                                                }}>
                                                    {isMissed ? "↙" : (isOutgoing ? "↗" : "↙")}
                                                </span>
                                                <span>{isVideo ? "📹 " : ""}{formatTimestamp(record.timestamp)}</span>
                                                {record.durationSeconds > 0 && (
                                                    <span style={{ color: isFamiliar ? "#8696A0" : "var(--accent-cyan, #00E5FF)", fontFamily: isFamiliar ? "inherit" : "JetBrains Mono, monospace" }}>
                                                        {formatDuration(record.durationSeconds)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button to Call Back */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, marginLeft: "10px" }} onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => startCallWithPeer(record.peerHash, isVideo ? "video" : "audio")}
                                            style={{
                                                width: "40px", height: "40px", borderRadius: "50%",
                                                background: isFamiliar ? "transparent" : "rgba(0, 230, 118, 0.12)",
                                                border: isFamiliar ? "none" : "1px solid rgba(0, 230, 118, 0.3)",
                                                color: isFamiliar ? "#00A884" : "var(--accent-emerald, #00E676)",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                cursor: "pointer", fontSize: "1.15rem"
                                            }}
                                            title={isVideo ? "Videollamada" : "Llamada de voz"}
                                        >
                                            {isVideo ? "📹" : "📞"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                callHistory.removeRecord(record.id);
                                            }}
                                            style={{
                                                width: "30px", height: "30px", borderRadius: "50%",
                                                background: "transparent", border: "none",
                                                color: isFamiliar ? "#8696A0" : "var(--text-muted, #666)", display: "flex", alignItems: "center", justifyContent: "center",
                                                cursor: "pointer", fontSize: "0.80rem"
                                            }}
                                            title="Eliminar de historial"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Floating Action Button (New Call) */}
            <button
                onClick={() => setIsPickerOpen(true)}
                style={{
                    position: "absolute",
                    bottom: "20px",
                    right: "20px",
                    width: "56px",
                    height: "56px",
                    borderRadius: isFamiliar ? "50%" : "16px",
                    background: isFamiliar ? "#00A884" : "linear-gradient(135deg, #00E676, #00B368)",
                    color: "#FFFFFF",
                    border: "none",
                    boxShadow: isFamiliar ? "0 4px 16px rgba(0, 168, 132, 0.45)" : "0 8px 24px rgba(0, 230, 118, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.4rem",
                    cursor: "pointer",
                    zIndex: 100,
                    transition: "transform 0.15s ease"
                }}
                title="Nueva Llamada P2P"
            >
                📞
            </button>

            {/* Contact Picker Modal for New Call */}
            {isPickerOpen && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 10000,
                        background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(12px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "16px"
                    }}
                    onClick={() => setIsPickerOpen(false)}
                >
                    <div
                        style={{
                            width: "100%", maxWidth: "420px", maxHeight: "80vh",
                            background: isFamiliar ? "#202C33" : "linear-gradient(180deg, #0F1428 0%, #080B18 100%)",
                            borderRadius: "18px",
                            border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 229, 255, 0.3)",
                            boxShadow: isFamiliar ? "0 10px 40px rgba(0,0,0,0.6)" : "0 20px 60px rgba(0,0,0,0.8)",
                            display: "flex", flexDirection: "column",
                            overflow: "hidden"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Picker Header */}
                        <div style={{
                            padding: "16px",
                            borderBottom: isFamiliar ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(255, 255, 255, 0.1)",
                            display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: isFamiliar ? "#E9EDEF" : "#00E5FF" }}>
                                {isFamiliar ? "Seleccionar contacto" : "Iniciar Llamada Cifrada"}
                            </div>
                            <button
                                onClick={() => setIsPickerOpen(false)}
                                style={{ background: "none", border: "none", color: isFamiliar ? "#8696A0" : "#AAA", fontSize: "1.2rem", cursor: "pointer" }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search Input */}
                        <div style={{ padding: "12px 16px" }}>
                            <input
                                type="text"
                                value={pickerSearch}
                                onChange={e => setPickerSearch(e.target.value)}
                                placeholder={isFamiliar ? "Buscar contacto..." : "Buscar contacto o pegar hash DID..."}
                                style={{
                                    width: "100%", padding: "10px 14px", borderRadius: "10px",
                                    background: isFamiliar ? "#111B21" : "rgba(0, 0, 0, 0.4)",
                                    border: isFamiliar ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 229, 255, 0.2)",
                                    color: "#FFF", fontSize: "0.85rem", outline: "none",
                                    fontFamily: isFamiliar ? "inherit" : "JetBrains Mono, monospace"
                                }}
                            />
                        </div>

                        {/* Contacts List */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px 8px" }}>
                            {filteredContacts.length === 0 && !pickerSearch ? (
                                <div style={{ padding: "20px", textAlign: "center", color: "#888", fontSize: "0.8rem" }}>
                                    No tienes contactos guardados aún.
                                </div>
                            ) : (
                                filteredContacts.map((c: any) => (
                                    <div
                                        key={c.identity_hash || c.id}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "10px 12px", borderRadius: "10px",
                                            marginBottom: "4px",
                                            background: isFamiliar ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)"
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                                            <div style={{
                                                width: 40, height: 40, borderRadius: "50%",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontWeight: 900, color: "#FFF", ...avatarStyle(c.identity_hash || "peer")
                                            }}>
                                                {(c.display_name || c.name || "C").charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.92rem", fontWeight: 600, color: isFamiliar ? "#E9EDEF" : "#FFF" }}>
                                                    {c.display_name || c.name}
                                                </div>
                                                <div style={{ fontSize: "0.72rem", color: isFamiliar ? "#8696A0" : "#888", fontFamily: isFamiliar ? "inherit" : "JetBrains Mono, monospace" }}>
                                                    {(c.identity_hash || "").substring(0, 12)}…
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <button
                                                onClick={() => startCallWithPeer(c.identity_hash, "audio")}
                                                style={{
                                                    width: 36, height: 36, borderRadius: "50%",
                                                    background: isFamiliar ? "rgba(0, 168, 132, 0.18)" : "rgba(0, 230, 118, 0.15)",
                                                    border: isFamiliar ? "none" : "1px solid rgba(0, 230, 118, 0.3)",
                                                    color: isFamiliar ? "#00A884" : "var(--accent-emerald, #00E676)",
                                                    cursor: "pointer", fontSize: "1.05rem",
                                                    display: "flex", alignItems: "center", justifyContent: "center"
                                                }}
                                                title="Llamada de voz"
                                            >
                                                📞
                                            </button>
                                            <button
                                                onClick={() => startCallWithPeer(c.identity_hash, "video")}
                                                style={{
                                                    width: 36, height: 36, borderRadius: "50%",
                                                    background: isFamiliar ? "rgba(0, 168, 132, 0.18)" : "rgba(0, 229, 255, 0.15)",
                                                    border: isFamiliar ? "none" : "1px solid rgba(0, 229, 255, 0.3)",
                                                    color: isFamiliar ? "#00A884" : "var(--accent-cyan, #00E5FF)",
                                                    cursor: "pointer", fontSize: "1.05rem",
                                                    display: "flex", alignItems: "center", justifyContent: "center"
                                                }}
                                                title="Videollamada"
                                            >
                                                📹
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* Direct DID Call if inputting custom hash */}
                            {pickerSearch.trim().length >= 8 && !filteredContacts.some(c => c.identity_hash === pickerSearch.trim()) && (
                                <div style={{
                                    marginTop: "8px", padding: "12px", borderRadius: "10px",
                                    background: isFamiliar ? "#182229" : "rgba(0, 229, 255, 0.08)",
                                    border: isFamiliar ? "1px solid rgba(0, 168, 132, 0.3)" : "1px dashed rgba(0, 229, 255, 0.3)",
                                    display: "flex", alignItems: "center", justifyContent: "space-between"
                                }}>
                                    <div>
                                        <div style={{ fontSize: "0.86rem", fontWeight: 700, color: isFamiliar ? "#00A884" : "#00E5FF" }}>
                                            Llamar a DID Directo
                                        </div>
                                        <div style={{ fontSize: "0.70rem", color: isFamiliar ? "#8696A0" : "#AAA", fontFamily: "JetBrains Mono, monospace" }}>
                                            {pickerSearch.substring(0, 16)}…
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "6px" }}>
                                        <button
                                            onClick={() => startCallWithPeer(pickerSearch.trim(), "audio")}
                                            style={{
                                                padding: "6px 12px", borderRadius: "8px",
                                                background: "#00A884", color: "#FFF",
                                                fontWeight: 800, border: "none", cursor: "pointer"
                                            }}
                                        >
                                            📞
                                        </button>
                                        <button
                                            onClick={() => startCallWithPeer(pickerSearch.trim(), "video")}
                                            style={{
                                                padding: "6px 12px", borderRadius: "8px",
                                                background: "#00A884", color: "#FFF",
                                                fontWeight: 800, border: "none", cursor: "pointer"
                                            }}
                                        >
                                            📹
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

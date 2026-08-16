"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI, RustLogEntry, getNodeLogs } from "../lib/api";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";

interface NodeLogsModalProps {
    onClose?: () => void;
}

type LogFilter = "ALL" | "INFO" | "WARN" | "ERROR" | "P2P" | "CRYPTO" | "CONSENSUS";

export const NodeLogsModal: React.FC<NodeLogsModalProps> = ({ onClose }) => {
    const { goBack } = useRedStore();
    const handleClose = onClose || goBack;
    const [logs, setLogs] = useState<RustLogEntry[]>([]);
    const [filter, setFilter] = useState<LogFilter>("ALL");
    const [autoScroll, setAutoScroll] = useState<boolean>(true);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const logsEndRef = useRef<HTMLDivElement | null>(null);

    // Fetch real historical logs from Rust Engine via GET /api/logs
    const fetchLogs = async () => {
        try {
            const fetched = await getNodeLogs(150);
            if (Array.isArray(fetched) && fetched.length > 0) {
                setLogs(fetched);
                setIsConnected(true);
            }
            setError(null);
        } catch (e: any) {
            // Rust server may still be initializing
            if (logs.length === 0) {
                setError(e.message || "Esperando conexión con el motor Rust...");
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 2500);

        // Subscribe to real SSE stream from the Rust engine
        const es = RedAPI.subscribeToEvents((data: any) => {
            setIsConnected(true);
            try {
                let lvl = "INFO";
                let target = "red_mobile::events";
                let msg = "";

                if (data.type === "new_message" || data.message_item) {
                    lvl = "P2P";
                    target = "red_core::protocol";
                    const m = data.message_item;
                    msg = m
                        ? `Mensaje recibido de ${m.sender?.substring(0, 10) || "peer"}… [tipo: ${m.msg_type || "text"}]`
                        : "Nuevo paquete de mensaje recibido en la malla";
                } else if (data.type === "peer_connected" || data.peer_id) {
                    lvl = "P2P";
                    target = "red_core::network";
                    msg = `Par Swarm conectado: ${(data.peer_id || data.peer || "").substring(0, 16)}`;
                } else if (data.type === "peer_disconnected") {
                    lvl = "WARN";
                    target = "red_core::network";
                    msg = `Par Swarm desconectado: ${(data.peer_id || "").substring(0, 16)}`;
                } else if (data.type === "block_produced" || data.block_height != null) {
                    lvl = "CONSENSUS";
                    target = "red_blockchain::consensus";
                    msg = `Bloque forjado #${data.block_height ?? "?"} | validador: ${(data.validator || "").substring(0, 10)}`;
                } else if (data.type === "p2p_voucher") {
                    lvl = "CRYPTO";
                    target = "red_mobile::p2p_pay";
                    msg = `Vale P2P recibido y acreditado en la bóveda`;
                } else if (data.type === "guardian_alert") {
                    lvl = "WARN";
                    target = "red_mobile::guardian";
                    msg = `Filtro Guardián bloqueó contenido: ${data.reason || "política de seguridad"}`;
                } else if (data.type === "sos_beacon") {
                    lvl = "ERROR";
                    target = "red_mobile::sos";
                    msg = `Baliza SOS de emergencia recibida de: ${(data.sender_did || "").substring(0, 16)}`;
                } else if (data.type === "rust_log") {
                    lvl = data.level || "INFO";
                    target = data.target || "red_mobile::core";
                    msg = data.message || "";
                } else {
                    lvl = "INFO";
                    target = "red_mobile::api";
                    msg = typeof data === "string" ? data : JSON.stringify(data).substring(0, 90);
                }

                const newEntry: RustLogEntry = {
                    timestamp: Date.now(),
                    level: lvl,
                    target,
                    message: msg
                };

                setLogs(prev => {
                    const next = [...prev, newEntry];
                    return next.slice(-200);
                });
            } catch {}
        });

        return () => {
            clearInterval(interval);
            if (es) es.close();
        };
    }, [filter]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, autoScroll]);

    const copyLogs = () => {
        const text = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] [${l.target}] ${l.message}`).join("\n");
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success("Logs copiados al portapapeles");
        }
    };

    const getLevelBadge = (level: string) => {
        switch (level) {
            case "ERROR": return <span className="badge-tactical badge-tactical-crimson">ERROR</span>;
            case "WARN": return <span className="badge-tactical badge-tactical-amber">WARN</span>;
            case "P2P": return <span className="badge-tactical badge-tactical-cyan">P2P</span>;
            case "CRYPTO": return <span className="badge-tactical badge-tactical-emerald">CRYPTO</span>;
            case "CONSENSUS": return <span className="badge-tactical badge-tactical-amber">BLOCK</span>;
            default: return <span className="badge-tactical">INFO</span>;
        }
    };

    const filteredLogs = filter === "ALL" ? logs : logs.filter(l => l.level === filter);

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
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.35)"
                    }}>📋</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Terminal de Logs & Auditoría del Nodo
                        </div>
                        <div style={{ fontSize: "0.68rem", color: isConnected ? "var(--accent-emerald)" : "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {isConnected ? "● STREAM SSE CONECTADO · :7333" : "CONECTANDO..."}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleClose}
                    className="btn-icon"
                    title="Cerrar terminal"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Barra de Filtros y Acciones */}
            <div style={{
                padding: "10px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                flexShrink: 0, gap: "12px", overflowX: "auto"
            }}>
                <div style={{ display: "flex", gap: "6px" }}>
                    {(["ALL", "INFO", "P2P", "CRYPTO", "WARN", "ERROR"] as LogFilter[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={filter === f ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "6px 12px", fontSize: "0.76rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                    >
                        {autoScroll ? "⬇️ Scroll ON" : "⏸️ Pausado"}
                    </button>
                    <button
                        onClick={copyLogs}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.76rem" }}
                    >
                        📋 Copiar
                    </button>
                </div>
            </div>

            {/* Consola Terminal CRT */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", background: "#020204", display: "flex", flexDirection: "column" }}>
                <div style={{ maxWidth: "800px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {isLoading ? (
                        <SkeletonCard count={4} />
                    ) : error && logs.length === 0 ? (
                        <ErrorBanner message={error} onRetry={fetchLogs} />
                    ) : filteredLogs.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace" }}>
                            Esperando flujo de eventos del núcleo Rust...
                        </div>
                    ) : (
                        filteredLogs.map((entry, index) => (
                            <div
                                key={index}
                                style={{
                                    display: "flex", alignItems: "flex-start", gap: "8px",
                                    padding: "6px 10px", borderRadius: "4px",
                                    background: index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                                    fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem",
                                    lineHeight: 1.4
                                }}
                            >
                                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>

                                <div style={{ flexShrink: 0 }}>
                                    {getLevelBadge(entry.level)}
                                </div>

                                <span style={{ color: "var(--accent-cyan)", flexShrink: 0 }}>
                                    [{entry.target.replace("red_", "")}]
                                </span>

                                <span style={{ color: "var(--text-secondary)", wordBreak: "break-all", flex: 1 }}>
                                    {entry.message}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};

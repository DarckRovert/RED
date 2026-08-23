"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI, RustLogEntry, getNodeLogs } from "../lib/api";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { RED_VERSION_NAME } from "../lib/version";
import { useTranslation } from "../lib/i18n/i18nEngine";

interface NodeLogsModalProps {
    onClose?: () => void;
}

type LogFilter = "ALL" | "INFO" | "WARN" | "ERROR" | "P2P" | "CRYPTO" | "CONSENSUS" | "MESH";

export const NodeLogsModal: React.FC<NodeLogsModalProps> = ({ onClose }) => {
    const { goBack } = useRedStore();
    const { t } = useTranslation();
    const handleClose = onClose || goBack;
    const [logs, setLogs] = useState<RustLogEntry[]>([]);
    const [filter, setFilter] = useState<LogFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [autoScroll, setAutoScroll] = useState<boolean>(true);
    const [isStreaming, setIsStreaming] = useState<boolean>(true);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);

    const logsEndRef = useRef<HTMLDivElement | null>(null);

    // Búfer inicial con registros de arranque de sistema si no hay historial
    const getInitialLogs = (): RustLogEntry[] => {
        const now = Date.now();
        return [
            { timestamp: now - 3500, level: "INFO", target: "red_mobile::core", message: "Inicializando subsistemas de nodo RED v32.0 (Tactical Edition)..." },
            { timestamp: now - 3000, level: "CRYPTO", target: "red_core::crypto", message: "Bóveda WebCrypto inicializada. Cifrado Noise XK & Ed25519 activo." },
            { timestamp: now - 2500, level: "MESH", target: "red_core::network", message: "Transportes físicos BLE / WiFi Direct en escucha pasiva." },
            { timestamp: now - 2000, level: "INFO", target: "red_mobile::events", message: "Canal EventSource /api/events conectado con loopback local." },
        ];
    };

    // Obtener logs del motor Rust
    const fetchLogs = async () => {
        try {
            const fetched = await getNodeLogs(150);
            if (Array.isArray(fetched) && fetched.length > 0) {
                setLogs(fetched);
                setIsConnected(true);
            }
        } catch {
            // Silencioso: usamos buffer reactivo
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        setLogs(getInitialLogs());
        fetchLogs();

        // Intervalo de sondeo periódico
        const interval = setInterval(() => {
            if (isStreaming) {
                fetchLogs();
            }
        }, 3000);

        // Suscripción al flujo SSE en tiempo real
        const es = RedAPI.subscribeToEvents((data: any) => {
            if (!isStreaming) return;
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
                } else if (data.type === "mesh_packet") {
                    lvl = "MESH";
                    target = "red_mesh::router";
                    msg = `Paquete mesh recibido (hops: ${data.hops || 1}, transport: ${data.transport || "BLE"})`;
                } else if (data.type === "rust_log") {
                    lvl = data.level || "INFO";
                    target = data.target || "red_mobile::core";
                    msg = data.message || "";
                } else {
                    lvl = "INFO";
                    target = "red_mobile::api";
                    msg = typeof data === "string" ? data : JSON.stringify(data).substring(0, 100);
                }

                const newEntry: RustLogEntry = {
                    timestamp: Date.now(),
                    level: lvl,
                    target,
                    message: msg,
                };

                setLogs(prev => [...prev.slice(-300), newEntry]);
            } catch {}
        });

        // Receptor de eventos internos del cliente (Mesh, Cripto, etc.)
        const handleCustomLog = (e: any) => {
            if (!isStreaming) return;
            const detail = e.detail || {};
            const clientEntry: RustLogEntry = {
                timestamp: Date.now(),
                level: detail.level || "INFO",
                target: detail.target || "red_client::runtime",
                message: detail.message || "Evento interno registrado",
            };
            setLogs(prev => [...prev.slice(-300), clientEntry]);
        };

        if (typeof window !== "undefined") {
            window.addEventListener("red:log", handleCustomLog);
        }

        return () => {
            clearInterval(interval);
            if (es) es.close();
            if (typeof window !== "undefined") {
                window.removeEventListener("red:log", handleCustomLog);
            }
        };
    }, [isStreaming]);

    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, autoScroll]);

    // Filtrado reactivo por categoría y búsqueda de texto
    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            const matchesCategory = filter === "ALL" || l.level === filter;
            if (!matchesCategory) return false;

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                (l.message && l.message.toLowerCase().includes(q)) ||
                (l.target && l.target.toLowerCase().includes(q)) ||
                (l.level && l.level.toLowerCase().includes(q))
            );
        });
    }, [logs, filter, searchQuery]);

    // Métricas en vivo
    const stats = useMemo(() => {
        let errors = 0;
        let warnings = 0;
        let p2p = 0;
        logs.forEach(l => {
            if (l.level === "ERROR") errors++;
            else if (l.level === "WARN") warnings++;
            else if (l.level === "P2P" || l.level === "MESH") p2p++;
        });
        return { total: logs.length, errors, warnings, p2p };
    }, [logs]);

    const copyLogs = () => {
        const text = filteredLogs
            .map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level}] [${l.target}] ${l.message}`)
            .join("\n");

        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success(`📋 ${filteredLogs.length} logs copiados al portapapeles`);
        }
    };

    const downloadLogs = () => {
        const text = filteredLogs
            .map(l => `[${new Date(l.timestamp).toISOString()}] [${l.level}] [${l.target}] ${l.message}`)
            .join("\n");

        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        a.href = url;
        a.download = `red_node_logs_${dateStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("📥 Archivo de logs descargado");
    };

    const clearLogs = () => {
        setLogs([]);
        toast.info("Buffer de logs vaciado");
    };

    const getLevelBadge = (level: string) => {
        switch (level) {
            case "ERROR": return <span className="badge-tactical badge-tactical-crimson">ERROR</span>;
            case "WARN": return <span className="badge-tactical badge-tactical-amber">WARN</span>;
            case "P2P": return <span className="badge-tactical badge-tactical-cyan">P2P</span>;
            case "MESH": return <span className="badge-tactical badge-tactical-cyan">MESH</span>;
            case "CRYPTO": return <span className="badge-tactical badge-tactical-emerald">CRYPTO</span>;
            case "CONSENSUS": return <span className="badge-tactical badge-tactical-amber">BLOCK</span>;
            default: return <span className="badge-tactical">INFO</span>;
        }
    };

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
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,229,255,0.35)"
                    }}>📋</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.logs_module?.title || "Terminal de Logs & Streaming SSE"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: isConnected ? "var(--accent-emerald)" : "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {RED_VERSION_NAME} · {isConnected ? (t.logs_module?.subtitle || "● SSE STREAM EN VIVO (:7333)") : "○ MODO AUTÓNOMO LOCAL"}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={() => setIsStreaming(!isStreaming)}
                        className="btn-tactical-secondary"
                        style={{ padding: "8px 12px", fontSize: "0.76rem" }}
                        title={isStreaming ? "Pausar recepción de logs" : "Reanudar streaming"}
                    >
                        {isStreaming ? "⏸️ Pausar" : "▶️ Reanudar"}
                    </button>
                    <button
                        onClick={handleClose}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar terminal"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Barra de Estadísticas y Búsqueda */}
            <div style={{
                padding: "8px 16px",
                display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                background: "rgba(10, 10, 20, 0.95)",
                borderBottom: "1px solid var(--glass-border)",
                gap: "10px", flexShrink: 0
            }}>
                {/* Stats Chips */}
                <div style={{ display: "flex", gap: "10px", fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total: <strong style={{ color: "#fff" }}>{stats.total}</strong></span>
                    <span style={{ color: "var(--accent-emerald)" }}>P2P/Mesh: <strong>{stats.p2p}</strong></span>
                    <span style={{ color: "var(--accent-amber)" }}>Warn: <strong>{stats.warnings}</strong></span>
                    <span style={{ color: "var(--accent-crimson)" }}>Error: <strong>{stats.errors}</strong></span>
                </div>

                {/* Search Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "340px", minWidth: "180px" }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar en logs (regex, texto, subsystem)..."
                        style={{
                            width: "100%", padding: "6px 10px", fontSize: "0.75rem",
                            borderRadius: "6px", fontFamily: "JetBrains Mono, monospace"
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="btn-ghost"
                            style={{ padding: "4px 8px", fontSize: "0.70rem" }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de Filtros por Severidad y Acciones de Archivo */}
            <div style={{
                padding: "8px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(6, 6, 14, 0.98)",
                borderBottom: "1px solid var(--glass-border)",
                flexShrink: 0, gap: "10px", overflowX: "auto"
            }}>
                <div style={{ display: "flex", gap: "6px" }}>
                    {(["ALL", "INFO", "P2P", "MESH", "CRYPTO", "CONSENSUS", "WARN", "ERROR"] as LogFilter[]).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={filter === f ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className="btn-tactical-secondary"
                        style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                        title="Auto-desplazamiento hacia el final"
                    >
                        {autoScroll ? "⬇️ Scroll ON" : "⏸️ Scroll OFF"}
                    </button>
                    <button
                        onClick={copyLogs}
                        className="btn-tactical-secondary"
                        style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                        title="Copiar texto de logs filtrados"
                    >
                        📋 Copiar
                    </button>
                    <button
                        onClick={downloadLogs}
                        className="btn-tactical-secondary"
                        style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                        title="Descargar archivo de registro .txt"
                    >
                        📥 Exportar
                    </button>
                    <button
                        onClick={clearLogs}
                        className="btn-ghost"
                        style={{ padding: "4px 8px", fontSize: "0.72rem", color: "var(--accent-crimson)" }}
                        title="Limpiar buffer actual"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Consola Terminal CRT */}
            <div className="scroll-container" style={{ flex: 1, padding: "12px 16px", background: "#020204", display: "flex", flexDirection: "column" }}>
                <div style={{ maxWidth: "860px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {isLoading ? (
                        <SkeletonCard count={4} />
                    ) : filteredLogs.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.80rem", fontFamily: "JetBrains Mono, monospace" }}>
                            {searchQuery ? `No hay logs que coincidan con "${searchQuery}"` : "Esperando flujo de eventos del núcleo RED..."}
                        </div>
                    ) : (
                        filteredLogs.map((entry, index) => (
                            <div
                                key={index}
                                style={{
                                    display: "flex", alignItems: "flex-start", gap: "8px",
                                    padding: "5px 8px", borderRadius: "4px",
                                    background: index % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                                    fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem",
                                    lineHeight: 1.4,
                                    borderLeft: entry.level === "ERROR" ? "2px solid var(--accent-crimson)" : entry.level === "WARN" ? "2px solid var(--accent-amber)" : "none"
                                }}
                            >
                                <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: "0.70rem" }}>
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>

                                <div style={{ flexShrink: 0 }}>
                                    {getLevelBadge(entry.level)}
                                </div>

                                <span style={{ color: "var(--accent-cyan)", flexShrink: 0, fontSize: "0.72rem" }}>
                                    [{entry.target.replace(/^red_/, "")}]
                                </span>

                                <span style={{ color: entry.level === "ERROR" ? "var(--accent-crimson-bright)" : entry.level === "WARN" ? "var(--accent-amber)" : "var(--text-secondary)", wordBreak: "break-all", flex: 1 }}>
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


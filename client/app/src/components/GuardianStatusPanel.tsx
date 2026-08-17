"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { getGuardianStatus, GuardianStatus } from "../lib/api";
import { GuardianEngine, GuardianEvaluation, GuardianAuditLogEntry, GuardianConfig } from "../lib/guardianEngine";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";

interface GuardianStatusPanelProps {
    onClose?: () => void;
}

type TabMode = "testing" | "config" | "auditLog";

export default function GuardianStatusPanel({ onClose }: GuardianStatusPanelProps) {
    const { goBack } = useRedStore();
    const handleClose = onClose || goBack;

    const [activeTab, setActiveTab] = useState<TabMode>("testing");
    const [status, setStatus] = useState<GuardianStatus | null>(null);
    const [config, setConfig] = useState<GuardianConfig>(GuardianEngine.getConfig());
    const [auditLogs, setAuditLogs] = useState<GuardianAuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Testing State
    const [testText, setTestText] = useState("");
    const [testResult, setTestResult] = useState<GuardianEvaluation | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);

    const refreshData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getGuardianStatus();
            setStatus(data);
        } catch {
            const localStats = GuardianEngine.getStats();
            setStatus({
                enabled: true,
                mode: config.mode,
                total_evaluations: localStats.messages_analyzed + localStats.images_analyzed,
                blocked_count: localStats.messages_blocked + localStats.images_blocked
            } as unknown as GuardianStatus);
        } finally {
            setConfig(GuardianEngine.getConfig());
            setAuditLogs(GuardianEngine.getAuditLog());
            setIsLoading(false);
        }
    }, [config.mode]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const handleRunTest = async (overrideText?: string) => {
        const textToTest = overrideText || testText;
        if (!textToTest.trim()) return;

        setIsEvaluating(true);
        try {
            const res = await GuardianEngine.evaluateTextAsync(textToTest.trim());
            setTestResult(res);
            setAuditLogs(GuardianEngine.getAuditLog());
            const localStats = GuardianEngine.getStats();

            setStatus(prev => ({
                ...(prev || {}),
                enabled: true,
                mode: config.mode,
                total_evaluations: localStats.messages_analyzed + localStats.images_analyzed,
                blocked_count: localStats.messages_blocked + localStats.images_blocked
            } as unknown as GuardianStatus));

            if (res.allowed) {
                toast.info("✅ Contenido Aprobado por el Guardián");
            } else {
                toast.warning("⛔ Contenido Bloqueado por el Guardián");
            }
        } catch {
            toast.error("Error al evaluar texto con el Guardián");
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleApplyPreset = (presetText: string) => {
        setTestText(presetText);
        handleRunTest(presetText);
    };

    const handleUpdateConfig = (partial: Partial<GuardianConfig>) => {
        GuardianEngine.updateConfig(partial);
        const updated = GuardianEngine.getConfig();
        setConfig(updated);
        toast.success("Configuración de blindaje actualizada");
    };

    const handleExportAuditLog = () => {
        const report = GuardianEngine.exportAuditLogText();
        const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
        a.download = `red_guardian_audit_${dateStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Informe forense de auditoría exportado");
    };

    const handleClearLogs = () => {
        GuardianEngine.clearAuditLog();
        setAuditLogs([]);
        toast.info("Registro de auditoría vaciado");
    };

    const stats = GuardianEngine.getStats();
    const totalEvals = stats.messages_analyzed + stats.images_analyzed;
    const totalBlocked = stats.messages_blocked + stats.images_blocked;
    const blockRate = totalEvals > 0 ? ((totalBlocked / totalEvals) * 100).toFixed(1) : "0.0";

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
                    }}>🛡️</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Centinela Guardián & Firewall IA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            CONTENT MODERATION · ZERO-LEAKAGE FORENSICS
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "4px", background: "rgba(0,0,0,0.4)", padding: "3px", borderRadius: "var(--radius-full)", border: "1px solid var(--glass-border)" }}>
                        <button
                            onClick={() => setActiveTab("testing")}
                            className={activeTab === "testing" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            🧪 Pruebas
                        </button>
                        <button
                            onClick={() => setActiveTab("config")}
                            className={activeTab === "config" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            ⚙️ Blindaje
                        </button>
                        <button
                            onClick={() => setActiveTab("auditLog")}
                            className={activeTab === "auditLog" ? "glow-pill-active" : "btn-ghost"}
                            style={{ padding: "4px 12px", fontSize: "0.76rem", borderRadius: "var(--radius-full)" }}
                        >
                            📑 Auditoría ({auditLogs.length})
                        </button>
                    </div>

                    <button
                        onClick={handleClose}
                        className="btn-icon"
                        title="Cerrar panel"
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* HUD de Métricas de Telemetría Real */}
                    {isLoading ? (
                        <SkeletonCard count={1} />
                    ) : error ? (
                        <ErrorBanner message={error} onRetry={refreshData} />
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                            <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>EVALUACIONES</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                    {totalEvals}
                                </div>
                            </div>

                            <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>BLOQUEADOS</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-crimson)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {totalBlocked}
                                </div>
                            </div>

                            <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>TASA FILTRO</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                    {blockRate}%
                                </div>
                            </div>

                            <div className="card-tactical" style={{ padding: "12px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase" }}>MODO ACTIVO</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: config.mode === "strict" ? "var(--accent-cyan)" : "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", marginTop: "4px" }}>
                                    {config.mode.toUpperCase()}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 1: BANCO DE PRUEBAS */}
                    {activeTab === "testing" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Banco de Pruebas del Firewall Guardián S4</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Inferencia en tiempo real contra toxic-bert ONNX, patrones de coacción, doxxing y de-ofuscador leetspeak.
                                </div>
                            </div>

                            {/* Presets de Prueba Rápida */}
                            <div>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800, marginBottom: "6px" }}>
                                    Inyecciones de Prueba Táctica:
                                </div>
                                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    <button
                                        onClick={() => handleApplyPreset("Confirmado el punto de encuentro en la coordenada norte. Transmisión limpia.")}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "5px 10px", fontSize: "0.72rem" }}
                                    >
                                        🟢 Benigno Seguro
                                    </button>
                                    <button
                                        onClick={() => handleApplyPreset("Mi número de tarjeta es 4532 8912 3456 7890 y mi correo es user@tactical.org")}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "5px 10px", fontSize: "0.72rem" }}
                                    >
                                        💳 Filtración Tarjeta / PII
                                    </button>
                                    <button
                                        onClick={() => handleApplyPreset("t3 v0y 4 m4t4r y destruir tu nodo")}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "5px 10px", fontSize: "0.72rem" }}
                                    >
                                        ☣️ Amenaza Leetspeak
                                    </button>
                                    <button
                                        onClick={() => handleApplyPreset("Reclama bitcoins gratis ahora ingresando a http://free-crypto.xyz/claim-reward")}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "5px 10px", fontSize: "0.72rem" }}
                                    >
                                        🎣 Phishing / Enlace
                                    </button>
                                </div>
                            </div>

                            <textarea
                                value={testText}
                                onChange={e => setTestText(e.target.value)}
                                placeholder="Escribe o pega cualquier texto para auditar con el Firewall IA..."
                                rows={3}
                                style={{ fontSize: "0.90rem", resize: "vertical" }}
                            />

                            <button
                                onClick={() => handleRunTest()}
                                disabled={!testText.trim() || isEvaluating}
                                className="btn-tactical-primary"
                                style={{ padding: "12px", fontSize: "0.88rem", opacity: isEvaluating ? 0.7 : 1 }}
                            >
                                {isEvaluating ? '⚙️ Analizando con Red Neuronal toxic-bert...' : '🛡️ EVALUAR CON GUARDIÁN IA'}
                            </button>

                            {testResult && (
                                <div className="card-tactical animate-pop" style={{
                                    padding: "16px",
                                    background: testResult.allowed ? "rgba(0,230,118,0.06)" : "rgba(255,51,85,0.06)",
                                    borderColor: testResult.allowed ? "var(--accent-emerald)" : "var(--accent-crimson)"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <strong style={{ fontSize: "0.90rem", color: testResult.allowed ? "var(--accent-emerald)" : "var(--accent-crimson)" }}>
                                            {testResult.allowed ? "✅ CONTENIDO AUTORIZADO" : "⛔ CONTENIDO INTERCEPTADO / BLOQUEADO"}
                                        </strong>
                                        <span style={{ fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                                            Latencia: {testResult.executionTimeMs}ms | Score: {testResult.threat_score || 0}%
                                        </span>
                                    </div>
                                    <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", marginTop: "8px", lineHeight: 1.4 }}>
                                        {testResult.feedback || testResult.reason || (testResult.allowed ? "No se detectaron patrones hostiles." : "El texto contiene lenguaje bloqueado por el protocolo.")}
                                    </div>
                                    {testResult.category && (
                                        <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", fontFamily: "JetBrains Mono, monospace" }}>
                                            <span style={{ color: testResult.allowed ? "var(--accent-emerald)" : "var(--accent-crimson)", fontWeight: 700 }}>
                                                CATEGORÍA: {testResult.category.toUpperCase()}
                                            </span>
                                            <span style={{ color: "var(--text-muted)" }}>
                                                Confianza: {Math.round(testResult.confidence * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PESTAÑA 2: CONFIGURACIÓN DE BLINDAJE ZERO-TRUST */}
                    {activeTab === "config" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Configuración de Blindaje Zero-Trust</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Ajusta la rigurosidad del motor de detección y las capas heurísticas en el hardware local.
                                </div>
                            </div>

                            {/* Selector de Modo de Protección */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-cyan)", textTransform: "uppercase" }}>
                                    Modo de Operación del Guardián:
                                </label>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                                    {(["permissive", "standard", "strict"] as const).map(m => {
                                        const isSelected = config.mode === m;
                                        return (
                                            <button
                                                key={m}
                                                onClick={() => handleUpdateConfig({ mode: m })}
                                                className={isSelected ? "btn-tactical-primary" : "btn-tactical-secondary"}
                                                style={{ padding: "10px 8px", fontSize: "0.76rem", textAlign: "center" }}
                                            >
                                                {m === "permissive" && "🟡 PERMISIVO"}
                                                {m === "standard" && "🟢 ESTÁNDAR"}
                                                {m === "strict" && "🛡️ ESTRICTO (ZERO-LEAK)"}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Toggles Específicos de Filtro */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
                                <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Capas de Intercepción Activas:
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                                    <div>
                                        <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>🛡️ Filtro Anti-Doxxing & Tarjetas PII</div>
                                        <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Detecta y bloquea números de tarjeta, credenciales y emails</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={config.filterPii}
                                        onChange={e => handleUpdateConfig({ filterPii: e.target.checked })}
                                        style={{ width: 18, height: 18, cursor: "pointer" }}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                                    <div>
                                        <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>☣️ Filtro de Amenazas Hostiles & Violencia</div>
                                        <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Intercepta coacciones físicas, intimidación o terrorismo</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={config.filterThreats}
                                        onChange={e => handleUpdateConfig({ filterThreats: e.target.checked })}
                                        style={{ width: 18, height: 18, cursor: "pointer" }}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                                    <div>
                                        <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>🎣 Filtro Anti-Phishing & Enlaces Maliciosos</div>
                                        <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Bloquea dominios sospechosos de suplantación y estafas cripto</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={config.filterSpam}
                                        onChange={e => handleUpdateConfig({ filterSpam: e.target.checked })}
                                        style={{ width: 18, height: 18, cursor: "pointer" }}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                                    <div>
                                        <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>🔤 De-ofuscador Leetspeak (Anti-Evasión)</div>
                                        <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>Traduce sustituciones de números y símbolos para evitar bypass</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={config.deobfuscateLeet}
                                        onChange={e => handleUpdateConfig({ deobfuscateLeet: e.target.checked })}
                                        style={{ width: 18, height: 18, cursor: "pointer" }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 3: REGISTRO FORENSE (AUDIT LOG) */}
                    {activeTab === "auditLog" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Registro Forense de Auditoría</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Eventos evaluados e interceptados en el dispositivo emisor.
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                        onClick={handleExportAuditLog}
                                        className="btn-tactical-primary"
                                        style={{ padding: "6px 12px", fontSize: "0.74rem" }}
                                        title="Descargar informe .txt"
                                    >
                                        📥 Exportar .txt
                                    </button>
                                    <button
                                        onClick={handleClearLogs}
                                        className="btn-ghost"
                                        style={{ padding: "6px 10px", fontSize: "0.74rem" }}
                                        title="Vaciar búfer de auditoría"
                                    >
                                        🗑️ Limpiar
                                    </button>
                                </div>
                            </div>

                            {auditLogs.length === 0 ? (
                                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem", fontStyle: "italic" }}>
                                    No hay registros de auditoría en memoria. Realiza evaluaciones en el banco de pruebas o en los chats activos.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "380px", overflowY: "auto" }}>
                                    {auditLogs.map((log) => {
                                        const isBlocked = log.action === "BLOCKED";
                                        const isFlagged = log.action === "FLAGGED";
                                        const badgeColor = isBlocked ? "var(--accent-crimson)" : isFlagged ? "var(--accent-amber)" : "var(--accent-emerald)";
                                        const dateStr = new Date(log.timestamp).toLocaleTimeString();

                                        return (
                                            <div
                                                key={log.id}
                                                style={{
                                                    padding: "10px 12px",
                                                    background: "rgba(255,255,255,0.02)",
                                                    border: `1px solid ${isBlocked ? "rgba(255,51,85,0.3)" : "var(--glass-border)"}`,
                                                    borderRadius: "8px",
                                                    display: "flex", flexDirection: "column", gap: "4px"
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <span style={{ fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace", color: badgeColor, fontWeight: 800 }}>
                                                        ● {log.action} · {log.category.toUpperCase()} ({log.threatScore}%)
                                                    </span>
                                                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                                        {dateStr} · {log.executionTimeMs}ms
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace", background: "rgba(0,0,0,0.3)", padding: "4px 8px", borderRadius: "4px" }}>
                                                    {log.textSample}
                                                </div>
                                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>
                                                    {log.reason}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { getGuardianStatus, reportContent, GuardianStatus } from "../lib/api";
import { GuardianEngine, GuardianEvaluation } from "../lib/guardianEngine";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";

interface GuardianStatusPanelProps {
    onClose?: () => void;
}

export default function GuardianStatusPanel({ onClose }: GuardianStatusPanelProps) {
    const { goBack } = useRedStore();
    const handleClose = onClose || goBack;
    const [status, setStatus] = useState<GuardianStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testText, setTestText] = useState("");
    const [testResult, setTestResult] = useState<GuardianEvaluation | null>(null);

    const fetchStatus = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getGuardianStatus();
            setStatus(data);
        } catch (e: any) {
            const localStats = GuardianEngine.getStats();
            setStatus({
                enabled: true,
                mode: "strict",
                total_evaluations: localStats.messages_analyzed + localStats.images_analyzed,
                blocked_count: localStats.messages_blocked + localStats.images_blocked
            } as unknown as GuardianStatus);
            // We do not set a hard error here because local fallback is expected, but we can set a warning.
            toast.warning("Modo desconectado. Usando motor Guardián local.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const handleRunTest = async () => {
        if (!testText.trim()) return;
        try {
            const res = await GuardianEngine.evaluateText(testText.trim());
            setTestResult(res);
            toast.info(res.is_clean ? "✅ Contenido Aprobado por el Guardián" : "⚠️ Contenido detectado como no seguro");
        } catch {
            toast.error("Error al evaluar texto con el Guardián");
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

                <button
                    onClick={handleClose}
                    className="btn-icon"
                    title="Cerrar panel"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {isLoading ? (
                        <SkeletonCard count={1} />
                    ) : error ? (
                        <ErrorBanner message={error} onRetry={fetchStatus} />
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                            <div className="card-tactical" style={{ padding: "14px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>ESTADO MOTOR</div>
                                <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--accent-emerald)" }}>ACTIVO</div>
                            </div>

                            <div className="card-tactical" style={{ padding: "14px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>MODO OPERATIVO</div>
                                <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--accent-cyan)" }}>
                                    {status?.mode?.toUpperCase() || "ESTRICTO"}
                                </div>
                            </div>

                            <div className="card-tactical" style={{ padding: "14px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>EVALUACIONES</div>
                                <div style={{ fontSize: "1rem", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                    {status?.total_evaluations ?? 142}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Banco de Pruebas de Evaluación de Contenido */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Banco de Pruebas del Firewall Guardián</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Evalúa en tiempo real cadenas de texto contra el modelo forense local.
                            </div>
                        </div>

                        <textarea
                            value={testText}
                            onChange={e => setTestText(e.target.value)}
                            placeholder="Escribe un texto para poner a prueba el filtro..."
                            rows={3}
                            style={{ fontSize: "0.90rem" }}
                        />

                        <button
                            onClick={handleRunTest}
                            disabled={!testText.trim()}
                            className="btn-tactical-primary"
                            style={{ padding: "12px", fontSize: "0.88rem" }}
                        >
                            🛡️ EVALUAR CON GUARDIÁN IA
                        </button>

                        {testResult && (
                            <div className="card-tactical animate-pop" style={{ padding: "14px", background: testResult.is_clean ? "rgba(0,230,118,0.06)" : "rgba(255,51,85,0.06)", borderColor: testResult.is_clean ? "var(--accent-emerald)" : "var(--accent-crimson)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <strong style={{ fontSize: "0.88rem", color: testResult.is_clean ? "var(--accent-emerald)" : "var(--accent-crimson)" }}>
                                        {testResult.is_clean ? "✅ CONTENIDO SEGURO" : "⚠️ DETECCIÓN DE ANOMALÍA"}
                                    </strong>
                                    <span style={{ fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                                        Score: {testResult.toxicity_score || 0}
                                    </span>
                                </div>
                                <div style={{ fontSize: "0.80rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                    {testResult.feedback || (testResult.is_clean ? "No se detectaron patrones hostiles." : "El texto contiene lenguaje bloqueado por el protocolo.")}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
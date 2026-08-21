"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI, DmsStatusResponse, SaveDmsConfigRequest } from "../lib/api";
import { toast } from "./Toast";
import { SkeletonCard } from "./ui/SkeletonCard";
import { ErrorBanner } from "./ui/ErrorBanner";

export default function DMSSettings() {
    const { goBack } = useRedStore();
    const [config, setConfig] = useState<SaveDmsConfigRequest>({
        enabled: false,
        trigger_hours: 72,
        wipe_messages: true,
        wipe_identity: false,
        dead_message: ""
    });

    const [dmsStatus, setDmsStatus] = useState<DmsStatusResponse | null>(null);
    const [secondsLeft, setSecondsLeft] = useState<number>(72 * 3600);
    const [saving, setSaving] = useState(false);
    const [pinging, setPinging] = useState(false);
    const [showPanicModal, setShowPanicModal] = useState(false);
    const [isWiping, setIsWiping] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── 0. Carga de Configuración y Estado desde Rust Sled DB ───────────────────────
    const loadDmsStatus = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await RedAPI.getDmsConfig();
            if (data) {
                setDmsStatus(data);
                setConfig({
                    enabled: data.enabled,
                    trigger_hours: data.trigger_hours || 72,
                    wipe_messages: data.wipe_messages ?? true,
                    wipe_identity: !!data.wipe_identity,
                    dead_message: data.dead_message || ""
                });
                setSecondsLeft(data.seconds_remaining);
            }
        } catch (e: any) {
            setError(e.message || "Fallo al contactar el motor de base de datos.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDmsStatus();
        const interval = setInterval(() => {
            setSecondsLeft(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [loadDmsStatus]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await RedAPI.saveDmsConfig(config);
            await loadDmsStatus();
            toast.success("💾 Protocolo Dead Man's Switch guardado en Sled DB.");
        } catch {
            toast.error("Error al guardar la configuración en Rust.");
        } finally {
            setSaving(false);
        }
    };

    const handlePingPresence = async () => {
        setPinging(true);
        try {
            await RedAPI.pingDmsActivity();
            await loadDmsStatus();
            toast.success("🔄 Check-In confirmado: Temporizador de inactividad reiniciado.");
        } catch {
            toast.error("Error al registrar presencia en el nodo.");
        } finally {
            setPinging(false);
        }
    };

    const handleExecutePanicWipe = async () => {
        setIsWiping(true);
        try {
            await RedAPI.panicWipe();
            toast.error("🚨 PURGA EJECUTADA: Todos los datos y claves han sido destruidos.");
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch {
            toast.error("Error durante la purga de emergencia.");
            setIsWiping(false);
        }
    };

    // Format Countdown
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    const totalSec = (config.trigger_hours || 72) * 3600;
    const progressPercent = Math.min(100, Math.max(0, (secondsLeft / totalSec) * 100));

    const Toggle = ({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string }) => (
        <div
            onClick={() => onChange(!value)}
            className="card-tactical-interactive"
            style={{
                padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                borderColor: value ? "var(--accent-crimson)" : "var(--glass-border)",
                background: value ? "rgba(232,33,58,0.10)" : "var(--bg-card)"
            }}
        >
            <div>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: value ? "var(--accent-crimson-bright)" : "var(--text-primary)" }}>
                    {label}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    {desc}
                </div>
            </div>

            <div style={{
                width: 44, height: 24, borderRadius: 12,
                background: value ? "var(--accent-crimson)" : "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", padding: 2,
                transition: "background 0.2s ease"
            }}>
                <div style={{
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transform: value ? "translateX(20px)" : "translateX(0px)",
                    transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                }} />
            </div>
        </div>
    );

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
                        background: config.enabled ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" : "linear-gradient(135deg, #333 0%, #111 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: config.enabled ? "0 4px 16px rgba(232,33,58,0.4)" : "none"
                    }}>💀</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Interruptor de Hombre Muerto (DMS)
                        </div>
                        <div style={{ fontSize: "0.68rem", color: config.enabled ? "var(--accent-crimson-bright)" : "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {config.enabled ? "● PROTOCOLO ARMADO · PURGA AUTOMÁTICA" : "STANDBY · PROTOCOLO DESACTIVADO"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title="Volver"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {isLoading ? (
                        <SkeletonCard count={3} />
                    ) : error ? (
                        <ErrorBanner message={error} onRetry={loadDmsStatus} />
                    ) : (
                        <>
                            {/* Tarjeta del Cronómetro de Misión Crítica */}
                            <div className="card-tactical-glow-crimson animate-enter" style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>
                                    Tiempo Restante Antes de Purga Automática
                                </div>
                                <div style={{
                                    fontSize: "2.4rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace",
                                    color: !config.enabled ? "var(--text-muted)" : secondsLeft < 3600 ? "var(--accent-crimson-bright)" : "var(--text-primary)",
                                    marginTop: "2px"
                                }}>
                                    {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                                </div>
                            </div>

                            <span className={`badge-tactical ${config.enabled ? "badge-tactical-crimson" : "badge-tactical"}`}>
                                {config.enabled ? "ARMADO" : "DESACTIVADO"}
                            </span>
                        </div>

                        {/* Barra de Progreso Temporal */}
                        <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{
                                width: `${progressPercent}%`, height: "100%",
                                background: progressPercent < 20 ? "var(--accent-crimson-bright)" : progressPercent < 50 ? "var(--accent-amber)" : "var(--accent-emerald)",
                                transition: "width 1s linear"
                            }} />
                        </div>

                        {/* Botón de Check-In / Reiniciar Temporizador */}
                        <button
                            onClick={handlePingPresence}
                            disabled={pinging || !config.enabled}
                            className="btn-tactical-primary"
                            style={{
                                width: "100%", padding: "14px", fontSize: "0.95rem",
                                background: "linear-gradient(135deg, #00E676 0%, #00B359 100%)", color: "#000"
                            }}
                        >
                            {pinging ? "Registrando presencia..." : "🔄 REGISTRAR PRESENCIA (CHECK-IN AHORA)"}
                        </button>
                    </div>

                    {/* Tarjeta de Parámetros del Protocolo */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            ⚙️ Parámetros de Activación & Purga
                        </div>

                        <Toggle
                            value={config.enabled}
                            onChange={v => setConfig({ ...config, enabled: v })}
                            label="Habilitar Interruptor de Hombre Muerto"
                            desc="Inicia el temporizador regresivo. Si no hay actividad, se ejecuta la purga."
                        />

                        {/* Selector de Horas de Inactividad */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                TIEMPO MÁXIMO DE INACTIVIDAD PERMITIDO:
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                                {[24, 48, 72, 168].map((h) => (
                                    <button
                                        key={h}
                                        onClick={() => setConfig({ ...config, trigger_hours: h })}
                                        className="btn-tactical-secondary"
                                        style={{
                                            padding: "10px",
                                            borderColor: config.trigger_hours === h ? "var(--accent-crimson)" : "var(--glass-border)",
                                            background: config.trigger_hours === h ? "rgba(232,33,58,0.15)" : "var(--bg-lifted)",
                                            color: config.trigger_hours === h ? "var(--accent-crimson-bright)" : "var(--text-primary)",
                                            fontWeight: 800, fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    >
                                        {h === 168 ? "7 Días" : `${h}h`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Toggle
                            value={!!config.wipe_messages}
                            onChange={v => setConfig({ ...config, wipe_messages: v })}
                            label="Destruir Historial de Mensajes y Bóvedas Sled"
                            desc="Sobrescribe con ceros criptográficos todas las tablas de mensajes y notas."
                        />

                        <Toggle
                            value={!!config.wipe_identity}
                            onChange={v => setConfig({ ...config, wipe_identity: v })}
                            label="Revocar y Destruir Identidad Criptográfica Ed25519"
                            desc="Elimina las claves privadas del Keystore físico haciendo la cuenta irrecuperable."
                        />

                        {/* Mensaje Póstumo */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                MENSAJE PÓSTUMO (TRANSMISIÓN POR MALLA AL ACTIVARSE):
                            </label>
                            <textarea
                                value={config.dead_message}
                                onChange={e => setConfig({ ...config, dead_message: e.target.value })}
                                rows={3}
                                placeholder="Mensaje final cifrado que se transmitirá automáticamente a tus contactos de confianza..."
                            />
                        </div>

                        {/* Botón de Guardado de Configuración */}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
                        >
                            {saving ? "Guardando en Sled DB..." : "💾 GUARDAR PROTOCOLO EN RUST"}
                        </button>
                    </div>

                    {/* Zona de Peligro: Panic Wipe Manual */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid rgba(232,33,58,0.4)", background: "rgba(232,33,58,0.06)" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-crimson-bright)" }}>
                            🚨 Zona Crítica: Purga de Pánico Instantánea (Panic Wipe)
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                            Destruye de inmediato todas las bases de datos Sled, identidades y sesiones Noise activas. Usa esta opción solo si el dispositivo está en peligro inminente de confiscación.
                        </div>

                        <button
                            onClick={() => setShowPanicModal(true)}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #FF3355 0%, #990000 100%)", fontSize: "0.92rem", fontWeight: 900 }}
                        >
                            💥 EJECUTAR PURGA DE PÁNICO MANUAL
                        </button>
                    </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal de Confirmación de Purga de Pánico */}
            {showPanicModal && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 10000,
                    background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                }}>
                    <div className="card-tactical-glow-crimson animate-pop modal-card-scrollable" style={{ maxWidth: "420px", width: "100%", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", background: "#0a0608", maxHeight: "calc(100dvh - 32px)", overflowY: "auto" }}>
                        <div style={{ fontSize: "2rem", textAlign: "center" }}>⚠️</div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-crimson-bright)", textAlign: "center" }}>
                            ¿CONFIRMAR DESTRUCCIÓN TOTAL DE DATOS?
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.45 }}>
                            Esta acción sobrescribirá físicamente toda la base de datos Sled DB y destruirá tus claves privadas. La aplicación se cerrará de inmediato. Esta operación es <strong>irreversible</strong>.
                        </div>

                        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                            <button
                                onClick={() => setShowPanicModal(false)}
                                disabled={isWiping}
                                className="btn-tactical-secondary"
                                style={{ flex: 1, padding: "12px" }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExecutePanicWipe}
                                disabled={isWiping}
                                className="btn-tactical-primary"
                                style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg, #FF3355 0%, #990000 100%)" }}
                            >
                                {isWiping ? "Purgando..." : "💥 Sí, Destruir Todo"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
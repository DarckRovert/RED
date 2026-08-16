"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { getBlackoutStatus, setBlackoutMode, BlackoutStatusResponse } from "../lib/api";
import { toast } from "./Toast";

interface BlackoutSimulatorModalProps {
    onClose?: () => void;
}

export const BlackoutSimulatorModal: React.FC<BlackoutSimulatorModalProps> = ({ onClose }) => {
    const { goBack } = useRedStore();
    const handleClose = onClose || goBack;
    const [status, setStatus] = useState<BlackoutStatusResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [toggling, setToggling] = useState<boolean>(false);
    const [eventLogs, setEventLogs] = useState<string[]>([]);
    const [blackoutDuration, setBlackoutDuration] = useState<number>(0);

    const isBlackout = status?.is_blackout ?? false;

    // Load real blackout status from Rust engine
    const loadStatus = useCallback(async () => {
        try {
            const data = await getBlackoutStatus();
            setStatus(data);
        } catch {
            // fallback handled in api.ts
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 3000);
        return () => clearInterval(interval);
    }, [loadStatus]);

    // Timer for active blackout duration
    useEffect(() => {
        let timer: any = null;
        if (isBlackout) {
            timer = setInterval(() => {
                setBlackoutDuration(prev => prev + 1);
            }, 1000);
        } else {
            setBlackoutDuration(0);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isBlackout]);

    const handleToggle = async () => {
        setToggling(true);
        const nextMode = !isBlackout;
        const ts = () => new Date().toLocaleTimeString();

        try {
            const updated = await setBlackoutMode(nextMode);
            setStatus(updated);

            if (nextMode) {
                setEventLogs(prev => [
                    `[${ts()}] ⚠️ PROTOCOLO DE APAGÓN ACTIVADO EN MOTOR RUST`,
                    `[${ts()}] 🛑 Sockets WAN / Internet cortados físicamente.`,
                    `[${ts()}] ⚡ Enrutamiento forzado a Gossipsub Epidémico (TTL: 7 Saltos).`,
                    `[${ts()}] 📡 Interfaces de corto alcance activas: mDNS/UDP (7331), BLE Mesh, LoRa 915MHz.`,
                    `[${ts()}] 🛡️ Bóveda operando en modo soberano 100% off-grid.`,
                    ...prev.slice(0, 30)
                ]);
                toast.error("⚠️ MODO APAGÓN ACTIVADO: WAN AISLADO");
            } else {
                setEventLogs(prev => [
                    `[${ts()}] ✅ MODO APAGÓN DESACTIVADO EN MOTOR RUST`,
                    `[${ts()}] 🌐 Sockets WAN reconectados. Restaurando relés libp2p y DHT Kademlia.`,
                    `[${ts()}] 🔄 Topología híbrida normal reanudada (TTL: 3 Saltos).`,
                    ...prev.slice(0, 30)
                ]);
                toast.success("🌐 Modo Normal Restaurado: WAN Reconectado");
            }
        } catch {
            setEventLogs(prev => [
                `[${ts()}] ❌ Error al comunicar la instrucción de apagón al motor Rust.`,
                ...prev
            ]);
            toast.error("Error al actualizar modo apagón");
        } finally {
            setToggling(false);
        }
    };

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
                        background: isBlackout ? "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" : "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem",
                        boxShadow: isBlackout ? "0 0 20px rgba(232,33,58,0.6)" : "0 4px 16px rgba(0,230,118,0.35)"
                    }}>⚡</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Consola de Apagón Eléctrico & Aislamiento WAN
                        </div>
                        <div style={{ fontSize: "0.68rem", color: isBlackout ? "var(--accent-crimson-bright)" : "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {isBlackout ? `● CORTE FÍSICO ACTIVO (${formatDuration(blackoutDuration)})` : "RED EN LÍNEA · TOPOLOGÍA HÍBRIDA"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleClose}
                    className="btn-icon"
                    title="Cerrar consola"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Tarjeta de Control Principal */}
                    <div className={isBlackout ? "card-tactical-glow-crimson animate-enter" : "card-tactical animate-enter"} style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: isBlackout ? "var(--accent-crimson-bright)" : "var(--text-primary)" }}>
                                    {isBlackout ? "⚠️ Malla en Modo Aislamiento Total" : "🌐 Malla en Modo Híbrido Conectado"}
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    {isBlackout ? "Sockets WAN desconectados. Operando 100% sobre radiofrecuencia local y mDNS." : "Tráfico distribuido entre Internet y radioenlaces locales P2P."}
                                </div>
                            </div>

                            <span className={`badge-tactical ${isBlackout ? "badge-tactical-crimson" : "badge-tactical-emerald"}`}>
                                {isBlackout ? "OFF-GRID" : "ONLINE"}
                            </span>
                        </div>

                        {/* Botón de Conmutación de Apagón */}
                        <button
                            onClick={handleToggle}
                            disabled={toggling || loading}
                            className="btn-tactical-primary"
                            style={{
                                width: "100%", padding: "16px",
                                background: isBlackout
                                    ? "linear-gradient(135deg, #00E676 0%, #00B359 100%)"
                                    : "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                                color: isBlackout ? "#000" : "#FFF",
                                fontSize: "1rem", fontWeight: 900,
                                boxShadow: isBlackout ? "0 0 25px rgba(0,230,118,0.4)" : "0 0 25px rgba(232,33,58,0.4)"
                            }}
                        >
                            {toggling ? "Comunicando con Rust..." : isBlackout ? "🌐 RESTAURAR CONEXIÓN NORMAL" : "⚡ SIMULAR APAGÓN / CORTE TOTAL WAN"}
                        </button>
                    </div>

                    {/* Matriz de Interfaces */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            📡 Estado de Enrutamiento & Interfaces Físicas
                        </div>

                        <div className="hud-grid">
                            <div className="hud-metric">
                                <div className="hud-metric-label">Transporte WAN</div>
                                <div className="hud-metric-val" style={{ color: isBlackout ? "var(--accent-crimson-bright)" : "var(--accent-emerald)" }}>
                                    {isBlackout ? "CORTADO" : "CONECTADO"}
                                </div>
                            </div>
                            <div className="hud-metric">
                                <div className="hud-metric-label">Gossipsub TTL</div>
                                <div className="hud-metric-val" style={{ color: "var(--accent-cyan)" }}>
                                    {status?.epidemic_ttl ? `${status.epidemic_ttl} Saltos` : (isBlackout ? "7 Saltos" : "3 Saltos")}
                                </div>
                            </div>
                            <div className="hud-metric">
                                <div className="hud-metric-label">WAN Bloqueados</div>
                                <div className="hud-metric-val" style={{ color: (status?.blocked_wan_peers ?? 0) > 0 ? "var(--accent-crimson-bright)" : "var(--text-muted)" }}>
                                    {status?.blocked_wan_peers ?? 0} Drops
                                </div>
                            </div>
                            <div className="hud-metric">
                                <div className="hud-metric-label">Peers Locales</div>
                                <div className="hud-metric-val" style={{ color: "var(--accent-emerald)" }}>
                                    {status?.local_peers ?? 0} Malla
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terminal de Eventos en Tiempo Real */}
                    <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px", background: "#04060A" }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                            REGISTRO DE OPERACIONES DEL NÚCLEO RUST:
                        </div>

                        <div style={{
                            padding: "12px", background: "rgba(0,0,0,0.6)", borderRadius: "8px",
                            fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem", color: "var(--text-secondary)",
                            display: "flex", flexDirection: "column", gap: "4px", maxHeight: "200px", overflowY: "auto"
                        }}>
                            {eventLogs.length === 0 ? (
                                <div style={{ color: "var(--text-muted)" }}>[INIT] Motor de simulación en espera de comandos...</div>
                            ) : (
                                eventLogs.map((log, i) => (
                                    <div key={i} style={{ color: log.includes("⚠️") || log.includes("🛑") ? "var(--accent-crimson-bright)" : log.includes("✅") ? "var(--accent-emerald)" : "var(--text-primary)" }}>
                                        {log}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
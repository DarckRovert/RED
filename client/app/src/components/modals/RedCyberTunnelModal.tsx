"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../../store/useRedStore";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";
import { BackHandlerRegistry } from "../../lib/navigation/BackHandlerRegistry";
import { redCyberTunnel, CyberTunnelStats, CyberTunnelMode } from "../../lib/network/RedCyberTunnelEngine";
import { SniTarget } from "../../lib/network/sniSpoofEngine";

export function RedCyberTunnelModal() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();

    const [stats, setStats] = useState<CyberTunnelStats>(() => redCyberTunnel.getStats());
    const [targets, setTargets] = useState<SniTarget[]>(() => redCyberTunnel.getTargets());
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [isDetecting, setIsDetecting] = useState<boolean>(false);
    const [showApnGuide, setShowApnGuide] = useState<boolean>(false);

    // Manejo de retroceso Android y ESC
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
        return () => unregister();
    }, [goBack]);

    // Suscripción a estadísticas en tiempo real del túnel
    useEffect(() => {
        const unsub = redCyberTunnel.addListener((updatedStats) => {
            setStats(updatedStats);
        });
        return () => unsub();
    }, []);

    // Autodetección y verificación de proxy nativo al montar el modal
    useEffect(() => {
        redCyberTunnel.autoDetectCarrier().catch(() => {});
        redCyberTunnel.checkNativeProxyStatus().catch(() => {});
    }, []);

    // Conmutar estado del túnel
    const handleToggleTunnel = async () => {
        if (stats.isActive) {
            await redCyberTunnel.deactivateTunnel();
            toast.info("🔌 Túnel Zero-Rating y proxy local 8088 desactivados.");
        } else {
            const res = await redCyberTunnel.activateTunnel();
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.warning(res.message);
            }
        }
    };

    // Cambiar operador celular
    const handleSelectTarget = (index: number) => {
        redCyberTunnel.selectTarget(index);
        toast.info(`📡 Perfil de operador cambiado a: [${targets[index]?.provider}]`);
    };

    // Cambiar modo de transporte
    const handleSetMode = (mode: CyberTunnelMode) => {
        redCyberTunnel.setMode(mode);
        toast.info(`⚙️ Modo de túnel establecido en: [${mode}]`);
    };

    // Autodetectar operador SIM
    const handleAutoDetectCarrier = async () => {
        setIsDetecting(true);
        try {
            const detected = await redCyberTunnel.autoDetectCarrier();
            toast.success(`📡 Operador SIM detectado: [${detected}]`);
        } catch (err: any) {
            toast.error(`❌ Error al detectar operador: ${err.message}`);
        } finally {
            setIsDetecting(false);
        }
    };

    // Test empírico de permeabilidad
    const handleTestPermeability = async () => {
        setIsTesting(true);
        try {
            const res = await redCyberTunnel.testPermeability();
            if (res.hasInternetEgress) {
                toast.success(`✅ Egreso a Internet Verificado: ${res.provider} (RTT: ${res.latencyMs}ms)`);
            } else if (res.isCaptivePermeable) {
                toast.warning(`⚠️ Portal cautivo permeable pero interceptado. Enrutando tráfico vía Anycast Egress Relays.`);
            } else {
                toast.warning(`⚠️ Operador filtrando o sin respuesta: ${res.reason || "Sin respuesta"}`);
            }
        } catch (err: any) {
            toast.error(`❌ Error en sondeo: ${err.message}`);
        } finally {
            setIsTesting(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes <= 0) return "0 B";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(5, 10, 15, 0.96)",
            backdropFilter: "blur(14px)",
            display: "flex",
            flexDirection: "column",
            color: "#e2e8f0",
            fontFamily: "monospace",
            overflowY: "auto",
        }}>
            {/* Header */}
            <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(56, 189, 248, 0.3)",
                backgroundColor: "rgba(15, 23, 42, 0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: stats.isActive ? "0 0 24px rgba(56, 189, 248, 0.25)" : "none",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "8px",
                        backgroundColor: stats.isActive ? "rgba(56, 189, 248, 0.2)" : "rgba(148, 163, 184, 0.15)",
                        border: `1px solid ${stats.isActive ? "#38bdf8" : "#64748b"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                    }}>
                        {stats.isActive ? "⚡" : "🔌"}
                    </div>
                    <div>
                        <div style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px", color: stats.isActive ? "#38bdf8" : "#94a3b8" }}>
                            CYBERTUNNEL // TÚNEL ZERO-RATING & PROXY
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                            {stats.isActive
                                ? `ESTADO: ACTIVO // PROXY ${stats.localProxyHost}:${stats.localProxyPort} [${stats.isProxyRunning ? 'LISTEN' : 'INIT'}] // OPERADOR: [${stats.detectedCarrier || stats.activeProvider}]`
                                : "ESTADO: DESCONECTADO (TRÁFICO CONVENCIONAL)"}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => goBack()}
                    style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        color: "#94a3b8",
                        borderRadius: "8px",
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Banner de Estado Activo */}
            {stats.isActive && (
                <div style={{
                    padding: "12px 20px",
                    backgroundColor: "rgba(56, 189, 248, 0.15)",
                    borderBottom: "1px solid rgba(56, 189, 248, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "18px" }}>🌐</span>
                        <span style={{ fontSize: "12px", color: "#bae6fd" }}>
                            Túnel enrutando tráfico celular a través de <strong>{stats.activeSniHost}</strong>. Socket local en <strong>127.0.0.1:{stats.localProxyPort}</strong> ({stats.isProxyRunning ? 'Activo' : 'Iniciando'}).
                        </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={() => navigate("hyperBrowser")}
                            style={{
                                backgroundColor: "#0284c7",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                padding: "7px 14px",
                                fontWeight: "bold",
                                fontSize: "12px",
                                cursor: "pointer",
                            }}
                        >
                            🌐 ABRIR NAVEGADOR RED
                        </button>
                        <button
                            onClick={handleToggleTunnel}
                            style={{
                                backgroundColor: "rgba(239, 68, 68, 0.85)",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                padding: "7px 14px",
                                fontWeight: "bold",
                                fontSize: "12px",
                                cursor: "pointer",
                            }}
                        >
                            DETENER TÚNEL
                        </button>
                    </div>
                </div>
            )}

            {/* Cuerpo */}
            <div style={{ padding: "20px", maxWidth: "920px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* Switch de Activación Primario */}
                <div style={{
                    backgroundColor: "rgba(15, 23, 42, 0.65)",
                    border: `1px solid ${stats.isActive ? "#38bdf8" : "rgba(255, 255, 255, 0.12)"}`,
                    borderRadius: "14px",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "14px",
                }}>
                    <div>
                        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#f8fafc" }}>
                            INTERRUPTOR MAESTRO DEL TÚNEL SOBERANO
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                            Inicia un socket proxy local multihilo en 127.0.0.1:8088 y activa el camuflaje TLS SNI Zero-Rating.
                        </div>
                    </div>
                    <button
                        onClick={handleToggleTunnel}
                        style={{
                            backgroundColor: stats.isActive ? "#22c55e" : "#0284c7",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            padding: "12px 24px",
                            fontSize: "14px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            letterSpacing: "0.5px",
                            boxShadow: stats.isActive ? "0 0 16px rgba(34, 197, 94, 0.5)" : "none",
                        }}
                    >
                        {stats.isActive ? "🟢 TÚNEL ACTIVO (CLIC PARA APAGAR)" : "⚡ ACTIVAR TÚNEL ZERO-RATING"}
                    </button>
                </div>

                {/* Dashboard de Telemetría en Tiempo Real */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "12px",
                }}>
                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>VELOCIDAD INSTANTÁNEA</div>
                        <div style={{ fontSize: "19px", fontWeight: "bold", color: "#38bdf8", marginTop: "4px" }}>
                            {stats.currentSpeedKbps} Kbps
                        </div>
                    </div>

                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>DATOS TUNELIZADOS</div>
                        <div style={{ fontSize: "19px", fontWeight: "bold", color: "#4ade80", marginTop: "4px" }}>
                            {formatBytes(stats.totalBytes)}
                        </div>
                        <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>
                            ▲ {formatBytes(stats.bytesUploaded)} | ▼ {formatBytes(stats.bytesDownloaded)}
                        </div>
                    </div>

                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>SERVIDOR PROXY LOCAL</div>
                        <div style={{ fontSize: "17px", fontWeight: "bold", color: "#c084fc", marginTop: "4px" }}>
                            127.0.0.1:{stats.localProxyPort}
                        </div>
                        <div style={{ fontSize: "10px", color: stats.isProxyRunning ? "#4ade80" : "#94a3b8", marginTop: "2px" }}>
                            {stats.isProxyRunning ? "● LISTEN (ACTIVO)" : "○ DESCONECTADO"}
                        </div>
                    </div>

                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>OPERADOR DETECTADO</div>
                        <div style={{ fontSize: "17px", fontWeight: "bold", color: "#38bdf8", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {stats.detectedCarrier || "Auto"}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {stats.activeProvider}
                        </div>
                    </div>

                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>MODO DE ENRUTAMIENTO</div>
                        <div style={{ fontSize: "17px", fontWeight: "bold", color: stats.mode === 'ZERO_RATING_SNI' ? "#38bdf8" : stats.mode === 'DNS_STEALTH' ? "#c084fc" : "#4ade80", marginTop: "4px" }}>
                            {stats.mode === 'ZERO_RATING_SNI' ? 'SNI SPOOF' : stats.mode === 'DNS_STEALTH' ? 'DNS STEALTH' : 'MESH P2P'}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>
                            {stats.mode === 'ZERO_RATING_SNI' ? 'Evasión TLS Portales' : stats.mode === 'DNS_STEALTH' ? 'UDP 53 (Sin Saldo)' : 'Gateway ClearNet DTN'}
                        </div>
                    </div>

                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>EGRESO A INTERNET</div>
                        <div style={{ fontSize: "17px", fontWeight: "bold", color: stats.hasInternetEgress ? "#4ade80" : stats.isActive ? "#facc15" : "#94a3b8", marginTop: "4px" }}>
                            {stats.hasInternetEgress ? 'VERIFICADO' : stats.isActive ? 'RELAY ANYCAST' : 'DESCONECTADO'}
                        </div>
                        <div style={{ fontSize: "10px", color: stats.hasInternetEgress ? "#4ade80" : stats.isActive ? "#facc15" : "#64748b", marginTop: "2px" }}>
                            {stats.hasInternetEgress ? '● Salida limpia confirmada' : stats.isActive ? '▲ Tráfico vía Egress Relays' : '○ Sin conexión activa'}
                        </div>
                    </div>

                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>CONEXIONES / REQS</div>
                        <div style={{ fontSize: "19px", fontWeight: "bold", color: "#facc15", marginTop: "4px" }}>
                            {stats.activeConnections} / {stats.totalRequests}
                        </div>
                    </div>

                    <div style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", letterSpacing: "0.5px" }}>LATENCIA RTT</div>
                        <div style={{ fontSize: "19px", fontWeight: "bold", color: "#fb923c", marginTop: "4px" }}>
                            {stats.latencyMs > 0 ? `${stats.latencyMs} ms` : "---"}
                        </div>
                    </div>
                </div>

                {/* Selector de Modo de Transporte y Evasión */}
                <div style={{
                    backgroundColor: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "16px 20px",
                }}>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#38bdf8", marginBottom: "4px" }}>
                        MODO DE TRANSPORTE Y EVASIÓN DE FIREWALL:
                    </div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "14px" }}>
                        Selecciona la estrategia de penetración según el estado de tu red móvil o aislamiento.
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                        <button
                            onClick={() => handleSetMode('ZERO_RATING_SNI')}
                            style={{
                                padding: "12px 14px",
                                borderRadius: "8px",
                                border: stats.mode === 'ZERO_RATING_SNI' ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                                backgroundColor: stats.mode === 'ZERO_RATING_SNI' ? "rgba(56, 189, 248, 0.18)" : "rgba(0, 0, 0, 0.3)",
                                color: "#e2e8f0",
                                textAlign: "left",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", fontSize: "13px", color: stats.mode === 'ZERO_RATING_SNI' ? "#38bdf8" : "#f1f5f9" }}>
                                <span>⚡</span> CAMUFLAJE SNI (ZERO-RATING)
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", lineHeight: "1.4" }}>
                                Alta velocidad. Camufla paquetes TLS/HTTP usando portales exentos de cobro del operador.
                            </div>
                        </button>

                        <button
                            onClick={() => handleSetMode('DNS_STEALTH')}
                            style={{
                                padding: "12px 14px",
                                borderRadius: "8px",
                                border: stats.mode === 'DNS_STEALTH' ? "2px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.1)",
                                backgroundColor: stats.mode === 'DNS_STEALTH' ? "rgba(168, 85, 247, 0.18)" : "rgba(0, 0, 0, 0.3)",
                                color: "#e2e8f0",
                                textAlign: "left",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", fontSize: "13px", color: stats.mode === 'DNS_STEALTH' ? "#c084fc" : "#f1f5f9" }}>
                                <span>🛰️</span> DNS STEALTH (UDP 53 / SIN SALDO)
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", lineHeight: "1.4" }}>
                                Penetración de emergencia. Rutea sobre UDP 53 cuando TCP 80/443 está bloqueado por falta de saldo.
                            </div>
                        </button>

                        <button
                            onClick={() => handleSetMode('MESH_GATEWAY')}
                            style={{
                                padding: "12px 14px",
                                borderRadius: "8px",
                                border: stats.mode === 'MESH_GATEWAY' ? "2px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                                backgroundColor: stats.mode === 'MESH_GATEWAY' ? "rgba(34, 197, 94, 0.18)" : "rgba(0, 0, 0, 0.3)",
                                color: "#e2e8f0",
                                textAlign: "left",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", fontSize: "13px", color: stats.mode === 'MESH_GATEWAY' ? "#4ade80" : "#f1f5f9" }}>
                                <span>🌐</span> GATEWAY MALLA P2P (DTN)
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", lineHeight: "1.4" }}>
                                Egress distribuido. Salta vía LoRa/BLE hacia nodos vecinos con ClearNet satelital o fibra activa.
                            </div>
                        </button>
                    </div>
                </div>

                {/* Selector de Perfil del Operador Celular */}
                <div style={{
                    backgroundColor: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "20px",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#38bdf8" }}>
                                PERFIL DEL OPERADOR / PORTAL CAUTIVO (SNI SPOOF):
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                Selecciona el operador correspondiente a tu SIM para camuflar el tráfico HTTP/TLS.
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={handleAutoDetectCarrier}
                                disabled={isDetecting}
                                style={{
                                    backgroundColor: "rgba(34, 197, 94, 0.15)",
                                    border: "1px solid #22c55e",
                                    color: "#4ade80",
                                    borderRadius: "6px",
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    cursor: isDetecting ? "not-allowed" : "pointer",
                                }}
                            >
                                {isDetecting ? "DETECTANDO..." : "📡 AUTODETECTAR SIM"}
                            </button>
                            <button
                                onClick={handleTestPermeability}
                                disabled={isTesting}
                                style={{
                                    backgroundColor: "rgba(56, 189, 248, 0.15)",
                                    border: "1px solid #38bdf8",
                                    color: "#38bdf8",
                                    borderRadius: "6px",
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    fontWeight: "bold",
                                    cursor: isTesting ? "not-allowed" : "pointer",
                                }}
                            >
                                {isTesting ? "SONDEANDO..." : "🔍 PROBAR PERMEABILIDAD"}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "10px" }}>
                        {targets.map((tgt, idx) => (
                            <button
                                key={tgt.provider}
                                onClick={() => handleSelectTarget(idx)}
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: "8px",
                                    border: stats.selectedTargetIndex === idx ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                                    backgroundColor: stats.selectedTargetIndex === idx ? "rgba(56, 189, 248, 0.15)" : "rgba(0, 0, 0, 0.3)",
                                    color: "#e2e8f0",
                                    textAlign: "left",
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ fontWeight: "bold", fontSize: "13px", color: stats.selectedTargetIndex === idx ? "#38bdf8" : "#f1f5f9" }}>
                                    {tgt.provider}
                                </div>
                                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                                    SNI: {tgt.sniHost}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Guía Paso a Paso para Enrutar TikTok y Apps Externas */}
                <div style={{
                    backgroundColor: "rgba(15, 23, 42, 0.65)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "16px 20px",
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#f1f5f9" }}>
                                📱 CÓMO CONECTAR TIKTOK, YOUTUBE Y NAVEGADORES EXTERNOS:
                            </div>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                                Instrucciones para derivar el tráfico del teléfono a través del socket proxy nativo de RED en 127.0.0.1:8088.
                            </div>
                        </div>
                        <button
                            onClick={() => setShowApnGuide(!showApnGuide)}
                            style={{
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                color: "#38bdf8",
                                borderRadius: "6px",
                                padding: "6px 12px",
                                fontSize: "12px",
                                cursor: "pointer",
                            }}
                        >
                            {showApnGuide ? "OCULTAR GUÍA" : "VER GUÍA PASO A PASO"}
                        </button>
                    </div>

                    {showApnGuide && (
                        <div style={{
                            marginTop: "14px",
                            paddingTop: "14px",
                            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                            fontSize: "12px",
                            lineHeight: "1.6",
                            color: "#cbd5e1",
                        }}>
                            <div style={{ fontWeight: "bold", color: "#38bdf8", marginBottom: "6px" }}>
                                MÉTODO 1: CONFIGURACIÓN POR APN CELULAR (NAVEGADORES WEB Y APPS HTTP)
                            </div>
                            <p style={{ margin: "0 0 8px 0", color: "#94a3b8" }}>
                                Este método deriva el tráfico HTTP/HTTPS de tu sistema a través del socket proxy soberano en <strong>127.0.0.1:8088</strong>, aplicando resolución DNS anti-bloqueo y Domain Fronting:
                            </p>
                            <ol style={{ paddingLeft: "20px", margin: "0 0 14px 0" }}>
                                <li>Abre los <strong>Ajustes</strong> de tu teléfono Android ➔ <strong>Redes móviles</strong> ➔ <strong>Nombres de Puntos de Acceso (APN)</strong>.</li>
                                <li>Toca sobre tu APN actual o crea uno nuevo duplicando el de tu operador.</li>
                                <li>Edita el campo <strong>Proxy</strong> y escribe: <code style={{ color: "#4ade80", backgroundColor: "#000", padding: "2px 6px", borderRadius: "4px" }}>127.0.0.1</code></li>
                                <li>Edita el campo <strong>Puerto</strong> y escribe: <code style={{ color: "#4ade80", backgroundColor: "#000", padding: "2px 6px", borderRadius: "4px" }}>8088</code></li>
                                <li>Guarda el APN y actívalo. Desactiva y reactiva los datos móviles una vez.</li>
                                <li>Abre tu navegador (Chrome, Firefox, Brave, DuckDuckGo) y navega libremente.</li>
                            </ol>

                            <div style={{
                                backgroundColor: "rgba(56, 189, 248, 0.1)",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                borderRadius: "8px",
                                padding: "10px 14px",
                                marginBottom: "14px",
                                fontSize: "11px",
                                color: "#bae6fd",
                            }}>
                                💡 <strong>Nota Técnica de Enrutamiento Celular:</strong> El proxy APN intercepta todo el tráfico web HTTP/HTTPS. Aplicaciones nativas que usan sockets binarios directos (ej. llamadas de WhatsApp o streaming UDP QUIC de la app YouTube) ignoran los proxies APN del sistema. Para ver YouTube o buscar información en Google sin restricciones, abre la versión web desde Chrome o utiliza el <strong>Navegador RED Soberano</strong> integrado.
                            </div>

                            <div style={{ fontWeight: "bold", color: "#38bdf8", marginBottom: "6px" }}>
                                MÉTODO 2: NAVEGACIÓN DIRECTA IN-APP (RECOMENDADO, CERO CONFIGURACIÓN)
                            </div>
                            <p style={{ margin: "0 0 10px 0" }}>
                                Si no deseas modificar los ajustes APN de tu teléfono, simplemente pulsa en <strong>"Abrir Navegador RED"</strong> arriba. El navegador soberano integrado navega automáticamente a través del túnel con camuflaje de cabeceras y respaldo por malla P2P sin necesidad de cambiar ninguna opción del sistema.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

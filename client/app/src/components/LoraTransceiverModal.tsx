"use client";

import React, { useState, useEffect } from "react";
import { loraBridge, LoraConfig, LoraTelemetry } from "../lib/hardware/LoraSerialBridgeEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

interface LoraTransceiverModalProps {
    onClose?: () => void;
}

export function LoraTransceiverModal({ onClose }: LoraTransceiverModalProps) {
    const { t } = useTranslation();

    const [config, setConfig] = useState<LoraConfig>(() => loraBridge.getConfig());
    const [telemetry, setTelemetry] = useState<LoraTelemetry>(() => loraBridge.getTelemetry());
    const [isConnecting, setIsConnecting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [beaconMessage, setBeaconMessage] = useState("RED TACTICAL LORA BEACON — REACH 25KM");

    useEffect(() => {
        const interval = setInterval(() => {
            setTelemetry(loraBridge.getTelemetry());
        }, 1000);

        const unbindRx = loraBridge.onPacketReceived((packet, rssi, snr) => {
            const hex = Array.from(packet.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const logEntry = `[RX] ${new Date().toLocaleTimeString()} · ${packet.length}B · RSSI: ${rssi ?? -90}dBm SNR: ${snr ?? 8}dB · [${hex}...]`;
            setLogs(prev => [logEntry, ...prev.slice(0, 49)]);
        });

        return () => {
            clearInterval(interval);
            unbindRx();
        };
    }, []);

    const handleConnectUSB = async () => {
        setIsConnecting(true);
        try {
            const ok = await loraBridge.connectWebSerial(115200);
            if (ok) {
                toast.success("Transceptor LoRa USB Conectado @ 115200 bps");
            } else {
                toast.error("No se pudo conectar al puerto USB/Serie");
            }
        } catch (e: any) {
            toast.error(e.message || "Error al conectar LoRa");
        } finally {
            setIsConnecting(false);
            setTelemetry(loraBridge.getTelemetry());
        }
    };

    const handleDisconnect = async () => {
        await loraBridge.disconnect();
        toast.info("Transceptor LoRa Desconectado");
        setTelemetry(loraBridge.getTelemetry());
    };

    const handleSendBeacon = async () => {
        const payload = new TextEncoder().encode(beaconMessage);
        const ok = await loraBridge.sendPacket(payload);
        if (ok) {
            toast.success("Baliza LoRa emitida exitosamente");
            const logEntry = `[TX] ${new Date().toLocaleTimeString()} · ${payload.length}B · "${beaconMessage.slice(0, 30)}..."`;
            setLogs(prev => [logEntry, ...prev.slice(0, 49)]);
        } else {
            toast.error("Fallo al emitir baliza LoRa");
        }
        setTelemetry(loraBridge.getTelemetry());
    };

    const handleConfigChange = (key: keyof LoraConfig, val: any) => {
        const updated = { ...config, [key]: val };
        setConfig(updated);
        loraBridge.updateConfig(updated);
    };

    return (
        <div 
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(2, 4, 10, 0.90)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                userSelect: "none"
            }}
        >
            <div 
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: "680px",
                    background: "linear-gradient(180deg, rgba(14,18,34,0.98) 0%, rgba(6,8,16,0.99) 100%)",
                    border: "1.5px solid rgba(0, 230, 118, 0.35)",
                    borderRadius: "20px",
                    boxShadow: "0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 230, 118, 0.15)",
                    overflow: "hidden",
                    color: "#FFFFFF"
                }}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", background: "rgba(6, 8, 16, 0.95)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: telemetry.connected ? "var(--accent-emerald)" : "#666666", boxShadow: telemetry.connected ? "0 0 12px var(--accent-emerald)" : "none" }} />
                        <div>
                            <h2 style={{ fontSize: "0.95rem", fontWeight: 900, letterSpacing: "0.5px", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", margin: 0 }}>
                                📡 TRANSCEPTOR LORA TÁCTICO (SX1262)
                            </h2>
                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0 0" }}>
                                Enlace de Largo Alcance (15–25 km) · Frecuencia ISM 915/868 MHz
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                color: "#FFFFFF",
                                width: "30px",
                                height: "30px",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: 900
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "80vh", overflowY: "auto", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>
                    {/* Connection Panel */}
                    <div style={{ padding: "14px", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.12)", background: "rgba(0, 0, 0, 0.5)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div>
                            <div style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>ESTADO DEL HARDWARE:</div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#FFFFFF", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                {telemetry.connected ? (
                                    <span style={{ color: "var(--accent-emerald)" }}>CONECTADO ({telemetry.transportType})</span>
                                ) : (
                                    <span style={{ color: "var(--accent-amber)" }}>SIN DISPOSITIVO HARDWARE USB</span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            {!telemetry.connected ? (
                                <button
                                    onClick={handleConnectUSB}
                                    disabled={isConnecting}
                                    style={{
                                        padding: "8px 16px",
                                        background: "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
                                        color: "#000000",
                                        borderRadius: "10px",
                                        fontWeight: 900,
                                        fontSize: "0.75rem",
                                        border: "none",
                                        cursor: isConnecting ? "not-allowed" : "pointer",
                                        opacity: isConnecting ? 0.6 : 1,
                                        boxShadow: "0 0 12px rgba(0, 230, 118, 0.3)"
                                    }}
                                >
                                    {isConnecting ? "CONECTANDO..." : "CONECTAR USB-OTG"}
                                </button>
                            ) : (
                                <button
                                    onClick={handleDisconnect}
                                    style={{
                                        padding: "8px 16px",
                                        background: "rgba(232, 33, 58, 0.2)",
                                        border: "1px solid var(--accent-crimson)",
                                        color: "#FF8599",
                                        borderRadius: "10px",
                                        fontWeight: 800,
                                        fontSize: "0.75rem",
                                        cursor: "pointer"
                                    }}
                                >
                                    DESCONECTAR
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Radio RF Configuration Matrix */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                        {/* Frequency */}
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                            <label style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>FRECUENCIA (MHz)</label>
                            <select
                                value={config.frequencyMhz}
                                onChange={(e) => handleConfigChange("frequencyMhz", parseFloat(e.target.value))}
                                className="tactical-input"
                                style={{ width: "100%", color: "var(--accent-emerald)", padding: "4px 6px", fontSize: "0.72rem" }}
                            >
                                <option value={915.0}>915.0 MHz (América)</option>
                                <option value={868.0}>868.0 MHz (Europa)</option>
                                <option value={433.0}>433.0 MHz (Universal)</option>
                            </select>
                        </div>

                        {/* TX Power */}
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                            <label style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>POTENCIA TX ({config.txPowerDbm} dBm)</label>
                            <input
                                type="range"
                                min={2}
                                max={22}
                                value={config.txPowerDbm}
                                onChange={(e) => handleConfigChange("txPowerDbm", parseInt(e.target.value))}
                                style={{ width: "100%", accentColor: "var(--accent-emerald)", marginTop: "4px", cursor: "pointer" }}
                            />
                        </div>

                        {/* Spreading Factor */}
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                            <label style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>SPREADING FACTOR</label>
                            <select
                                value={config.spreadingFactor}
                                onChange={(e) => handleConfigChange("spreadingFactor", parseInt(e.target.value))}
                                className="tactical-input"
                                style={{ width: "100%", color: "var(--accent-emerald)", padding: "4px 6px", fontSize: "0.72rem" }}
                            >
                                <option value={7}>SF7 (Rápido / 5.4 kbps)</option>
                                <option value={8}>SF8 (Equilibrado)</option>
                                <option value={9}>SF9 (Táctico Estándar)</option>
                                <option value={10}>SF10 (Largo Alcance)</option>
                                <option value={11}>SF11 (Ultra Resiliente)</option>
                                <option value={12}>SF12 (Extremo / 25km+)</option>
                            </select>
                        </div>

                        {/* Bandwidth */}
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                            <label style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>ANCHO BANDA (kHz)</label>
                            <select
                                value={config.bandwidthKhz}
                                onChange={(e) => handleConfigChange("bandwidthKhz", parseInt(e.target.value))}
                                className="tactical-input"
                                style={{ width: "100%", color: "var(--accent-emerald)", padding: "4px 6px", fontSize: "0.72rem" }}
                            >
                                <option value={125}>125 kHz (Largo Alcance)</option>
                                <option value={250}>250 kHz (Recomendado)</option>
                                <option value={500}>500 kHz (Alta Velocidad)</option>
                            </select>
                        </div>
                    </div>

                    {/* Telemetry Metrics */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "10px" }}>
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.3)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>PAQUETES TX</div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--accent-emerald)", marginTop: "2px" }}>{telemetry.packetsSent}</div>
                        </div>
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.3)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>PAQUETES RX</div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--accent-cyan)", marginTop: "2px" }}>{telemetry.packetsReceived}</div>
                        </div>
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.3)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>ÚLTIMO RSSI</div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--accent-amber)", marginTop: "2px" }}>
                                {telemetry.lastRssiDbm ? `${telemetry.lastRssiDbm} dBm` : "N/D"}
                            </div>
                        </div>
                        <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.3)", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>ÚLTIMO SNR</div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: "#C084FC", marginTop: "2px" }}>
                                {telemetry.lastSnrDb ? `${telemetry.lastSnrDb} dB` : "N/D"}
                            </div>
                        </div>
                    </div>

                    {/* Mode & Interoperability Controls */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <button
                            onClick={async () => {
                                try {
                                    const { loraMeshtastic } = await import('../lib/mesh/LoRaMeshtasticBridge');
                                    const testAudio = new Uint8Array(45);
                                    for (let i = 0; i < 45; i++) testAudio[i] = (i * 11) % 256;
                                    await loraMeshtastic.broadcastVocoderAudio(testAudio);
                                    toast.success("🎙️ Ráfaga de Voz Vocoder transmitida por LoRa (1.2 kbps)");
                                    setLogs(prev => [`[TX-VOICE] ${new Date().toLocaleTimeString()} · 45B · Ráfaga Vocoder LoRa Port 64`, ...prev.slice(0, 49)]);
                                } catch (e: any) {
                                    toast.error("Error al transmitir voz LoRa: " + e.message);
                                }
                            }}
                            style={{
                                padding: "10px",
                                background: "rgba(0, 229, 255, 0.15)",
                                border: "1px solid rgba(0, 229, 255, 0.4)",
                                color: "#00E5FF",
                                borderRadius: "12px",
                                fontWeight: 800,
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                        >
                            🎙️ RÁFAGA DE VOZ VOCODER
                        </button>

                        <button
                            onClick={async () => {
                                try {
                                    const { cursorOnTarget } = await import('../lib/tactical/CursorOnTargetEngine');
                                    const { loraMeshtastic } = await import('../lib/mesh/LoRaMeshtasticBridge');
                                    const cotEvt = cursorOnTarget.createBftEvent('RED-NODE-ALPHA', 'TACTICAL-1', -12.046374, -77.042793, 'INFANTRY', 95);
                                    const cotXml = cursorOnTarget.serializeToXml(cotEvt);
                                    await loraMeshtastic.sendTextMessage(cotXml);
                                    toast.success("🎯 Baliza ATAK Cursor-on-Target emitida por LoRa");
                                    setLogs(prev => [`[TX-CoT] ${new Date().toLocaleTimeString()} · ${cotXml.length}B · ATAK CoT XML Broadcast`, ...prev.slice(0, 49)]);
                                } catch (e: any) {
                                    toast.error("Error al emitir CoT: " + e.message);
                                }
                            }}
                            style={{
                                padding: "10px",
                                background: "rgba(255, 179, 0, 0.15)",
                                border: "1px solid rgba(255, 179, 0, 0.4)",
                                color: "#FFB300",
                                borderRadius: "12px",
                                fontWeight: 800,
                                fontSize: "0.72rem",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                        >
                            🎯 BALIZA ATAK CoT XML
                        </button>
                    </div>

                    {/* Beacon Transmission */}
                    <div style={{ padding: "14px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <label style={{ color: "#FFFFFF", fontWeight: 800, fontSize: "0.75rem" }}>EMISIÓN DE BALIZA TÁCTICA LORA</label>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="text"
                                value={beaconMessage}
                                onChange={(e) => setBeaconMessage(e.target.value)}
                                className="tactical-input"
                                style={{ flex: 1 }}
                                placeholder="Mensaje de baliza de largo alcance..."
                            />
                            <button
                                onClick={handleSendBeacon}
                                style={{
                                    padding: "8px 16px",
                                    background: "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
                                    color: "#000000",
                                    borderRadius: "10px",
                                    fontWeight: 900,
                                    fontSize: "0.75rem",
                                    border: "none",
                                    cursor: "pointer",
                                    boxShadow: "0 0 12px rgba(0, 230, 118, 0.3)"
                                }}
                            >
                                TRANSMITIR
                            </button>
                        </div>
                    </div>

                    {/* Real-Time Frame Logs */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ color: "var(--text-secondary)", fontWeight: 800, fontSize: "0.72rem" }}>REGISTRO DE TRAMAS EN TIEMPO REAL:</div>
                        <div style={{ padding: "12px", background: "#020306", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)", height: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.7rem" }}>
                            {logs.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Esperando tráfico RF en frecuencia configurada...</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} style={{ color: log.startsWith("[TX]") ? "var(--accent-emerald)" : "var(--accent-cyan)" }}>
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
}

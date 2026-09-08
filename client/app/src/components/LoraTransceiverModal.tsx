"use client";

import React, { useState, useEffect } from "react";
import { loraBridge, LoraConfig, LoraTelemetry } from "../lib/hardware/LoraSerialBridgeEngine";
import { loraMeshtastic, LoRaNodeInfo } from "../lib/mesh/LoRaMeshtasticBridge";
import { meshRouter } from "../lib/mesh/meshRouter";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { fetchWithFallback } from "../api/core";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { useRedStore } from "../store/useRedStore";

interface LoraTransceiverModalProps {
    onClose?: () => void;
}

type MeshtasticPreset = 'CUSTOM' | 'LONG_FAST' | 'LONG_SLOW' | 'MEDIUM_FAST' | 'SHORT_FAST';
type LogFilter = 'ALL' | 'TX' | 'RX' | 'VOCODER' | 'COT';

export function LoraTransceiverModal({ onClose }: LoraTransceiverModalProps) {
    const { t } = useTranslation();

    const [config, setConfig] = useState<LoraConfig>(() => loraBridge.getConfig());
    const [telemetry, setTelemetry] = useState<LoraTelemetry>(() => loraBridge.getTelemetry());
    const [isConnecting, setIsConnecting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [beaconMessage, setBeaconMessage] = useState("RED TACTICAL LORA BEACON — REACH 25KM");
    const [preset, setPreset] = useState<MeshtasticPreset>('LONG_FAST');
    const [logFilter, setLogFilter] = useState<LogFilter>('ALL');
    const [knownNodes, setKnownNodes] = useState<LoRaNodeInfo[]>([]);
    const [showNodesModal, setShowNodesModal] = useState(false);

    // Vocoder Recording State & Lifecycle Guards
    const [isRecordingVocoder, setIsRecordingVocoder] = useState<boolean>(false);
    const activeStreamRef = React.useRef<MediaStream | null>(null);
    const activeRecorderRef = React.useRef<MediaRecorder | null>(null);
    const activeAudioCtxRef = React.useRef<AudioContext | null>(null);
    const recordTimeoutRef = React.useRef<any>(null);

    const cleanupVocoderRecorder = React.useCallback(() => {
        if (recordTimeoutRef.current) {
            clearTimeout(recordTimeoutRef.current);
            recordTimeoutRef.current = null;
        }
        if (activeRecorderRef.current && activeRecorderRef.current.state === "recording") {
            try { activeRecorderRef.current.stop(); } catch {}
        }
        if (activeStreamRef.current) {
            try { activeStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
            activeStreamRef.current = null;
        }
        if (activeAudioCtxRef.current && activeAudioCtxRef.current.state !== "closed") {
            try { activeAudioCtxRef.current.close(); } catch {}
            activeAudioCtxRef.current = null;
        }
        setIsRecordingVocoder(false);
    }, []);

    // ─── Interceptor de Hardware Atrás (LIFO) ──────────────────────────────────
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (isRecordingVocoder) {
                cleanupVocoderRecorder();
                return true;
            }
            if (showNodesModal) {
                setShowNodesModal(false);
                return true;
            }
            if (onClose) {
                onClose();
                return true;
            }
            return false;
        });
        return unregister;
    }, [onClose, showNodesModal, isRecordingVocoder, cleanupVocoderRecorder]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupVocoderRecorder();
        };
    }, [cleanupVocoderRecorder]);

    // ─── Telemetría & Escucha de Paquetes RF ────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            setTelemetry(loraBridge.getTelemetry());
            setKnownNodes(loraMeshtastic.getKnownNodes());
        }, 1000);

        const unbindRx = loraBridge.onPacketReceived((packet, rssi, snr) => {
            const hex = Array.from(packet.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            const isCot = packet.length === 28 || packet[0] === 0x3c; // CoT binary or XML
            const isVocoder = packet.length > 20 && (packet[0] === 0x56 || packet[0] === 0x58);
            const tag = isVocoder ? '[RX-VOCODER]' : isCot ? '[RX-CoT]' : '[RX]';
            const logEntry = `${tag} ${new Date().toLocaleTimeString()} · ${packet.length}B · RSSI: ${rssi ?? -90}dBm SNR: ${snr ?? 8}dB · [${hex}...]`;
            setLogs(prev => [logEntry, ...prev.slice(0, 99)]);
        });

        return () => {
            clearInterval(interval);
            unbindRx();
        };
    }, []);

    const syncConfigToBackend = async (conf: LoraConfig) => {
        try {
            await fetchWithFallback('/api/settings/lora', {
                method: 'POST',
                body: JSON.stringify({
                    port: loraBridge.getTelemetry().transportType === 'BLE_NUS' ? 'BLE_NUS' : 'USB_SERIAL',
                    baud: 115200,
                    enabled: true
                })
            }, () => ({ ok: true }));
        } catch {}
    };

    const handleConnectUSB = async () => {
        setIsConnecting(true);
        try {
            const ok = await loraBridge.connectWebSerial(115200);
            if (ok) {
                toast.success("Transceptor LoRa USB Conectado @ 115200 bps");
                syncConfigToBackend(config);
            } else {
                toast.error("No se pudo conectar al puerto USB/Serie");
            }
        } catch (e: any) {
            toast.error(e.message || "Error al conectar LoRa USB");
        } finally {
            setIsConnecting(false);
            setTelemetry(loraBridge.getTelemetry());
        }
    };

    const handleConnectBLE = async () => {
        setIsConnecting(true);
        try {
            const ok = await loraBridge.connectBluetoothLE();
            if (ok) {
                toast.success("Transceptor LoRa BLE (Nordic UART Service) Conectado");
                syncConfigToBackend(config);
            } else {
                toast.error("No se pudo conectar al transceptor BLE LoRa");
            }
        } catch (e: any) {
            toast.error(e.message || "Error al conectar BLE LoRa");
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
            setLogs(prev => [logEntry, ...prev.slice(0, 99)]);
            // Difusión redundante a la malla P2P (nodos sin hardware LoRa físico)
            const meshPayload = new TextEncoder().encode(JSON.stringify({
                id: `lora_beacon_${Date.now()}`,
                msg_type: 'LORA_BEACON_TX',
                message: beaconMessage,
                freq_mhz: config.frequencyMhz,
                sf: config.spreadingFactor,
                bw_khz: config.bandwidthKhz,
                timestamp: Date.now()
            }));
            meshRouter.send('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', meshPayload).catch(() => {});
        } else {
            toast.error("Fallo al emitir baliza LoRa");
        }
        setTelemetry(loraBridge.getTelemetry());
    };

    const handleConfigChange = (key: keyof LoraConfig, val: any) => {
        const updated = { ...config, [key]: val };
        setConfig(updated);
        setPreset('CUSTOM');
        loraBridge.updateConfig(updated);
        syncConfigToBackend(updated);
    };

    const handlePresetChange = (newPreset: MeshtasticPreset) => {
        setPreset(newPreset);
        let updated: Partial<LoraConfig> = {};
        switch (newPreset) {
            case 'LONG_FAST': // Meshtastic default
                updated = { spreadingFactor: 11, bandwidthKhz: 250, codingRate: '4/7' };
                break;
            case 'LONG_SLOW': // Max range 25km+
                updated = { spreadingFactor: 12, bandwidthKhz: 125, codingRate: '4/8' };
                break;
            case 'MEDIUM_FAST': // Urban balanced
                updated = { spreadingFactor: 9, bandwidthKhz: 250, codingRate: '4/6' };
                break;
            case 'SHORT_FAST': // High speed
                updated = { spreadingFactor: 7, bandwidthKhz: 250, codingRate: '4/5' };
                break;
            case 'CUSTOM':
                return;
        }
        const fullConf = { ...config, ...updated };
        setConfig(fullConf);
        loraBridge.updateConfig(fullConf);
        syncConfigToBackend(fullConf);
        toast.info(`Preset Meshtastic aplicado: ${newPreset}`);
    };

    const filteredLogs = logs.filter(log => {
        if (logFilter === 'ALL') return true;
        if (logFilter === 'TX') return log.includes('[TX');
        if (logFilter === 'RX') return log.includes('[RX');
        if (logFilter === 'VOCODER') return log.includes('VOCODER') || log.includes('TX-VOICE');
        if (logFilter === 'COT') return log.includes('CoT') || log.includes('TX-CoT');
        return true;
    });

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
                    maxWidth: "720px",
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
                                📡 TRANSCEPTOR LORA TÁCTICO (SX1262 / MESHTASTIC)
                            </h2>
                            <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0 0" }}>
                                Enlace de Largo Alcance (15–25 km) · Frecuencia ISM 915/868 MHz · PQC Encapsulation
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
                                    <span style={{ color: "var(--accent-emerald)" }}>
                                        CONECTADO ({telemetry.transportType === 'BLE_NUS' ? 'BLUETOOTH NUS' : 'USB-OTG SERIE'})
                                    </span>
                                ) : (
                                    <span style={{ color: "var(--accent-amber)" }}>SIN DISPOSITIVO ENLAZADO</span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {!telemetry.connected ? (
                                <>
                                    <button
                                        onClick={handleConnectUSB}
                                        disabled={isConnecting}
                                        style={{
                                            padding: "8px 14px",
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
                                        {isConnecting ? "ENLAZANDO..." : "CONECTAR USB-OTG"}
                                    </button>
                                    <button
                                        onClick={handleConnectBLE}
                                        disabled={isConnecting}
                                        style={{
                                            padding: "8px 14px",
                                            background: "rgba(0, 229, 255, 0.15)",
                                            border: "1px solid rgba(0, 229, 255, 0.5)",
                                            color: "#00E5FF",
                                            borderRadius: "10px",
                                            fontWeight: 900,
                                            fontSize: "0.75rem",
                                            cursor: isConnecting ? "not-allowed" : "pointer",
                                            opacity: isConnecting ? 0.6 : 1
                                        }}
                                    >
                                        BLUETOOTH BLE
                                    </button>
                                </>
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

                    {/* Meshtastic Profile Presets */}
                    <div style={{ padding: "12px", background: "rgba(0, 0, 0, 0.4)", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                            <label style={{ fontSize: "0.7rem", color: "var(--accent-emerald)", fontWeight: 800 }}>
                                PERFILES ESTÁNDAR MESHTASTIC
                            </label>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                                {preset === 'LONG_FAST' ? 'Estándar Oficial Meshtastic (SF11 / 250kHz)' :
                                 preset === 'LONG_SLOW' ? 'Alcance Extremo 25km+ (SF12 / 125kHz)' :
                                 preset === 'MEDIUM_FAST' ? 'Entorno Urbano / Balance (SF9 / 250kHz)' :
                                 preset === 'SHORT_FAST' ? 'Alta Velocidad / Voz (SF7 / 250kHz)' : 'Parámetros Manuales'}
                            </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "6px" }}>
                            {[
                                { id: 'LONG_FAST', label: 'LongFast', sub: 'Estándar' },
                                { id: 'LONG_SLOW', label: 'LongSlow', sub: '25km+' },
                                { id: 'MEDIUM_FAST', label: 'MediumFast', sub: 'Urbano' },
                                { id: 'SHORT_FAST', label: 'ShortFast', sub: 'Rápido' },
                                { id: 'CUSTOM', label: 'Manual', sub: 'Experto' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handlePresetChange(p.id as MeshtasticPreset)}
                                    style={{
                                        padding: "6px 8px",
                                        background: preset === p.id ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.04)",
                                        border: preset === p.id ? "1px solid var(--accent-emerald)" : "1px solid rgba(255, 255, 255, 0.1)",
                                        color: preset === p.id ? "var(--accent-emerald)" : "var(--text-secondary)",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: "2px"
                                    }}
                                >
                                    <span style={{ fontWeight: 800, fontSize: "0.72rem" }}>{p.label}</span>
                                    <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>{p.sub}</span>
                                </button>
                            ))}
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
                                <option value={11}>SF11 (Ultra Resiliente / Meshtastic)</option>
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: "10px" }}>
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
                        <div 
                            onClick={() => setShowNodesModal(!showNodesModal)}
                            style={{ 
                                padding: "10px", 
                                background: "rgba(0, 229, 255, 0.08)", 
                                borderRadius: "12px", 
                                border: "1px solid rgba(0, 229, 255, 0.3)", 
                                textAlign: "center",
                                cursor: "pointer"
                            }}
                        >
                            <div style={{ fontSize: "0.65rem", color: "#00E5FF" }}>NODOS RF</div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: "#FFFFFF", marginTop: "2px" }}>
                                {knownNodes.length}
                            </div>
                        </div>
                    </div>

                    {/* Discovered Nodes Dropdown */}
                    {showNodesModal && (
                        <div style={{ padding: "12px", background: "rgba(0, 10, 20, 0.95)", borderRadius: "14px", border: "1px solid rgba(0, 229, 255, 0.3)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <span style={{ color: "#00E5FF", fontWeight: 800 }}>NODOS MESHTASTIC EN ALCANCE</span>
                                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{knownNodes.length} descubiertos</span>
                            </div>
                            {knownNodes.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.7rem", padding: "8px 0" }}>
                                    No se han detectado balizas o repetidores en la frecuencia actual.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
                                    {knownNodes.map(node => (
                                        <div key={node.nodeNum} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(255, 255, 255, 0.04)", borderRadius: "8px" }}>
                                            <div>
                                                <span style={{ fontWeight: 800, color: "var(--accent-emerald)" }}>{node.user.longName || node.user.shortName}</span>
                                                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginLeft: "8px" }}>ID: 0x{node.nodeNum.toString(16)}</span>
                                            </div>
                                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                                <div style={{ display: "flex", gap: "8px", fontSize: "0.68rem" }}>
                                                    <span style={{ color: "var(--accent-amber)" }}>RSSI: {node.rssi} dBm</span>
                                                    <span style={{ color: "#C084FC" }}>SNR: {node.snr} dB</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        try {
                                                            localStorage.setItem('red_active_target', JSON.stringify({
                                                                name: `NODO LORA: ${node.user.longName || node.user.shortName}`,
                                                                lat: 0,
                                                                lon: 0,
                                                                type: 'LORA_NODE',
                                                                rssi: node.rssi
                                                            }));
                                                            toast.success(`Foxhunt apuntado a nodo 0x${node.nodeNum.toString(16)}`);
                                                            if (onClose) onClose();
                                                            useRedStore.getState().navigate('tacticalFoxhunt');
                                                        } catch {
                                                            toast.info("Objetivo configurado para Foxhunt");
                                                        }
                                                    }}
                                                    style={{
                                                        padding: "3px 8px", borderRadius: "6px",
                                                        background: "rgba(255, 179, 0, 0.15)", border: "1px solid rgba(255, 179, 0, 0.4)",
                                                        color: "#FFB300", fontSize: "0.62rem", fontWeight: 800, cursor: "pointer"
                                                    }}
                                                >
                                                    🦊 FOXHUNT
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mode & Interoperability Controls */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <button
                            disabled={isRecordingVocoder}
                            onClick={async () => {
                                if (isRecordingVocoder) return;
                                try {
                                    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
                                        toast.error("Micrófono no disponible en este entorno");
                                        return;
                                    }
                                    setIsRecordingVocoder(true);
                                    toast.info("🎙️ Grabando ráfaga de voz de 1 segundo...");
                                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                    activeStreamRef.current = stream;

                                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                                    const audioCtx = new AudioContextClass();
                                    activeAudioCtxRef.current = audioCtx;

                                    const sourceNode = audioCtx.createMediaStreamSource(stream);
                                    const dest = audioCtx.createMediaStreamDestination();
                                    sourceNode.connect(dest);
                                    
                                    const mediaRecorder = new MediaRecorder(dest.stream);
                                    activeRecorderRef.current = mediaRecorder;
                                    const chunks: Blob[] = [];
                                    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                                    
                                    mediaRecorder.onstop = async () => {
                                        try {
                                            const blob = new Blob(chunks, { type: 'audio/webm' });
                                            const arrayBuffer = await blob.arrayBuffer();
                                            const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
                                            const rawChannel = decodedAudio.getChannelData(0);
                                            const { LowBitrateVocoder } = await import('../lib/audio/LowBitrateVocoder');
                                            const pcm16 = LowBitrateVocoder.resampleTo8kHz(rawChannel, decodedAudio.sampleRate);
                                            const compressedBytes = LowBitrateVocoder.encode(pcm16);
                                            const { loraMeshtastic } = await import('../lib/mesh/LoRaMeshtasticBridge');
                                            await loraMeshtastic.broadcastVocoderAudio(compressedBytes);
                                            toast.success(`🎙️ Ráfaga de Voz Vocoder transmitida por LoRa (${compressedBytes.length}B, 1.2 kbps)`);
                                            setLogs(prev => [`[TX-VOICE] ${new Date().toLocaleTimeString()} · ${compressedBytes.length}B · Ráfaga Vocoder LoRa Port 64`, ...prev.slice(0, 99)]);
                                        } catch (err: any) {
                                            toast.error("Error al procesar audio Vocoder: " + err.message);
                                        } finally {
                                            try { audioCtx.close(); } catch {}
                                            cleanupVocoderRecorder();
                                        }
                                    };
                                    
                                    mediaRecorder.start();
                                    recordTimeoutRef.current = setTimeout(() => {
                                        if (mediaRecorder.state === 'recording') {
                                            mediaRecorder.stop();
                                        }
                                    }, 1000);
                                } catch (e: any) {
                                    cleanupVocoderRecorder();
                                    toast.error("Error al capturar/transmitir voz LoRa: " + e.message);
                                }
                            }}
                            style={{
                                padding: "10px",
                                background: isRecordingVocoder ? "rgba(255, 51, 85, 0.25)" : "rgba(0, 229, 255, 0.15)",
                                border: `1px solid ${isRecordingVocoder ? '#FF3355' : 'rgba(0, 229, 255, 0.4)'}`,
                                color: isRecordingVocoder ? "#FF3355" : "#00E5FF",
                                borderRadius: "12px",
                                fontWeight: 800,
                                fontSize: "0.72rem",
                                cursor: isRecordingVocoder ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                        >
                            {isRecordingVocoder ? "⏹️ GRABANDO VOCODER..." : "🎙️ RÁFAGA DE VOZ VOCODER"}
                        </button>

                        <button
                            onClick={async () => {
                                try {
                                    const { cursorOnTarget } = await import('../lib/tactical/CursorOnTargetEngine');
                                    const { loraMeshtastic } = await import('../lib/mesh/LoRaMeshtasticBridge');
                                    const { useRedStore } = await import('../store/useRedStore');
                                    const identity = useRedStore.getState().identity;
                                    
                                    let lat = 0;
                                    let lon = 0;
                                    try {
                                        const { TacticalLocationEngine } = await import('../lib/sensors/TacticalLocationEngine');
                                        const loc = await TacticalLocationEngine.getEmergencyLocation(5000);
                                        if (TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                                            lat = loc.lat!;
                                            lon = loc.lon!;
                                        }
                                    } catch {}
                                    
                                    let batt = 100;
                                    if (typeof window !== 'undefined' && typeof (window as any).__red_last_battery === 'number') {
                                        batt = (window as any).__red_last_battery;
                                    }
                                    
                                    const nodeId = identity?.identity_hash ? `RED-${identity.identity_hash.slice(0, 8)}` : 'RED-TACTICAL-NODE';
                                    const callsign = identity?.nickname || 'TACTICAL-OP';
                                    
                                    const cotEvt = cursorOnTarget.createBftEvent(nodeId, callsign, lat, lon, 'INFANTRY', batt);
                                    const cotBinary = cursorOnTarget.serializeToCompactBinary(cotEvt);
                                    await loraMeshtastic.broadcastCompactCot(cotBinary);
                                    toast.success("🎯 Baliza ATAK Compact-PLI emitida por LoRa (28 Bytes, -94.9%)");
                                    setLogs(prev => [`[TX-CoT] ${new Date().toLocaleTimeString()} · ${cotBinary.length}B (MTU Opt) · Ultra-Compact PLI Broadcast`, ...prev.slice(0, 99)]);
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

                    {/* Real-Time Frame Logs with Category Filter */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ color: "var(--text-secondary)", fontWeight: 800, fontSize: "0.72rem" }}>REGISTRO DE TRAMAS EN TIEMPO REAL:</div>
                            <div style={{ display: "flex", gap: "4px" }}>
                                {(['ALL', 'TX', 'RX', 'VOCODER', 'COT'] as LogFilter[]).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setLogFilter(f)}
                                        style={{
                                            padding: "2px 6px",
                                            borderRadius: "6px",
                                            border: "none",
                                            background: logFilter === f ? "var(--accent-emerald)" : "rgba(255, 255, 255, 0.08)",
                                            color: logFilter === f ? "#000000" : "var(--text-muted)",
                                            fontWeight: 800,
                                            fontSize: "0.62rem",
                                            cursor: "pointer"
                                        }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ padding: "12px", background: "#020306", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.1)", height: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.7rem" }}>
                            {filteredLogs.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No hay tramas en la categoría seleccionada...</div>
                            ) : (
                                filteredLogs.map((log, i) => (
                                    <div 
                                        key={i} 
                                        style={{ 
                                            color: log.includes('[TX') ? "var(--accent-emerald)" : 
                                                   log.includes('VOCODER') || log.includes('TX-VOICE') ? "#00E5FF" :
                                                   log.includes('CoT') ? "#FFB300" : "var(--accent-cyan)" 
                                        }}
                                    >
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

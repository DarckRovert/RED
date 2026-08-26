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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-2xl bg-neutral-950/95 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden text-neutral-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
                    <div className="flex items-center gap-3">
                        <div className={`w-3.5 h-3.5 rounded-full ${telemetry.connected ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" : "bg-neutral-600"}`} />
                        <div>
                            <h2 className="text-lg font-bold tracking-wider text-emerald-400 font-mono">
                                📡 TRANSCEPTOR LORA TÁCTICO (SX1262)
                            </h2>
                            <p className="text-xs text-neutral-400 font-mono">
                                Enlace de Largo Alcance (15–25 km) · Frecuencia ISM 915/868 MHz
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto font-mono text-xs">
                    {/* Connection Panel */}
                    <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="text-neutral-400">ESTADO DEL HARDWARE:</div>
                            <div className="text-sm font-bold text-neutral-100 flex items-center gap-2 mt-0.5">
                                {telemetry.connected ? (
                                    <span className="text-emerald-400">CONECTADO ({telemetry.transportType})</span>
                                ) : (
                                    <span className="text-amber-400">SIN DISPOSITIVO HARDWARE USB</span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {!telemetry.connected ? (
                                <button
                                    onClick={handleConnectUSB}
                                    disabled={isConnecting}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                                >
                                    {isConnecting ? "CONECTANDO..." : "CONECTAR USB-OTG"}
                                </button>
                            ) : (
                                <button
                                    onClick={handleDisconnect}
                                    className="px-4 py-2 bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700/50 rounded-lg font-bold transition-all active:scale-95"
                                >
                                    DESCONECTAR
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Radio RF Configuration Matrix */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Frequency */}
                        <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
                            <label className="text-[10px] text-neutral-400 block mb-1">FRECUENCIA (MHz)</label>
                            <select
                                value={config.frequencyMhz}
                                onChange={(e) => handleConfigChange("frequencyMhz", parseFloat(e.target.value))}
                                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
                            >
                                <option value={915.0}>915.0 MHz (América)</option>
                                <option value={868.0}>868.0 MHz (Europa)</option>
                                <option value={433.0}>433.0 MHz (Universal)</option>
                            </select>
                        </div>

                        {/* TX Power */}
                        <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
                            <label className="text-[10px] text-neutral-400 block mb-1">POTENCIA TX ({config.txPowerDbm} dBm)</label>
                            <input
                                type="range"
                                min={2}
                                max={22}
                                value={config.txPowerDbm}
                                onChange={(e) => handleConfigChange("txPowerDbm", parseInt(e.target.value))}
                                className="w-full accent-emerald-500 mt-1 cursor-pointer"
                            />
                        </div>

                        {/* Spreading Factor */}
                        <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
                            <label className="text-[10px] text-neutral-400 block mb-1">SPREADING FACTOR</label>
                            <select
                                value={config.spreadingFactor}
                                onChange={(e) => handleConfigChange("spreadingFactor", parseInt(e.target.value))}
                                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
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
                        <div className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
                            <label className="text-[10px] text-neutral-400 block mb-1">ANCHO BANDA (kHz)</label>
                            <select
                                value={config.bandwidthKhz}
                                onChange={(e) => handleConfigChange("bandwidthKhz", parseInt(e.target.value))}
                                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
                            >
                                <option value={125}>125 kHz (Largo Alcance)</option>
                                <option value={250}>250 kHz (Recomendado)</option>
                                <option value={500}>500 kHz (Alta Velocidad)</option>
                            </select>
                        </div>
                    </div>

                    {/* Telemetry Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-800 text-center">
                            <div className="text-[10px] text-neutral-400">PAQUETES TX</div>
                            <div className="text-base font-bold text-emerald-400 mt-0.5">{telemetry.packetsSent}</div>
                        </div>
                        <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-800 text-center">
                            <div className="text-[10px] text-neutral-400">PAQUETES RX</div>
                            <div className="text-base font-bold text-cyan-400 mt-0.5">{telemetry.packetsReceived}</div>
                        </div>
                        <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-800 text-center">
                            <div className="text-[10px] text-neutral-400">ÚLTIMO RSSI</div>
                            <div className="text-base font-bold text-amber-400 mt-0.5">
                                {telemetry.lastRssiDbm ? `${telemetry.lastRssiDbm} dBm` : "N/D"}
                            </div>
                        </div>
                        <div className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-800 text-center">
                            <div className="text-[10px] text-neutral-400">ÚLTIMO SNR</div>
                            <div className="text-base font-bold text-purple-400 mt-0.5">
                                {telemetry.lastSnrDb ? `${telemetry.lastSnrDb} dB` : "N/D"}
                            </div>
                        </div>
                    </div>

                    {/* Beacon Transmission */}
                    <div className="p-4 bg-neutral-900/40 rounded-xl border border-neutral-800 space-y-3">
                        <label className="text-neutral-300 font-bold block">EMISIÓN DE BALIZA TÁCTICA LORA</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={beaconMessage}
                                onChange={(e) => setBeaconMessage(e.target.value)}
                                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 text-xs focus:outline-none focus:border-emerald-500"
                                placeholder="Mensaje de baliza de largo alcance..."
                            />
                            <button
                                onClick={handleSendBeacon}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all shadow-md active:scale-95"
                            >
                                TRANSMITIR
                            </button>
                        </div>
                    </div>

                    {/* Real-Time Frame Logs */}
                    <div className="space-y-2">
                        <div className="text-neutral-400 font-bold">REGISTRO DE TRAMAS EN TIEMPO REAL:</div>
                        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 h-36 overflow-y-auto space-y-1 text-[11px]">
                            {logs.length === 0 ? (
                                <div className="text-neutral-600 italic">Esperando tráfico RF en frecuencia configurada...</div>
                            ) : (
                                logs.map((log, i) => (
                                    <div key={i} className={log.startsWith("[TX]") ? "text-emerald-400" : "text-cyan-400"}>
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

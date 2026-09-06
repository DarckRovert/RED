"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { BlackoutSimulatorModal } from "./BlackoutSimulatorModal";
import { LocalAIEngine } from "../lib/localAiEngine";
import { queryAICopilot } from "../api/ai";
import { DnsTunnelEngine } from "../lib/dnsTunnelEngine";
import { SniSpoofEngine } from "../lib/sniSpoofEngine";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";

export default function NetworkPanel() {
    const { t } = useTranslation();
    const { goBack, status, connectPeer } = useRedStore();
    const [localIp, setLocalIp] = useState("…");
    const [loraEnabled, setLoraEnabled] = useState(false);
    const [loraPort, setLoraPort] = useState("/dev/ttyUSB0");
    const [loraBaud, setLoraBaud] = useState("115200");
    const [peersByTransport, setPeersByTransport] = useState<Record<string, number>>({ wifi: 0, ble: 0, lorawan: 0, tcp: 0, quic: 0 });
    const [rfMetrics, setRfMetrics] = useState<any>(null);
    const [hoppingChannel, setHoppingChannel] = useState(false);
    
    // AI Coverage Diagnostic States
    const [aiNetworkDiag, setAiNetworkDiag] = useState<string | null>(null);
    const [diagLoading, setDiagLoading] = useState(false);

    // Manual connection states
    const [manualAddress, setManualAddress] = useState("");
    const [connectingManual, setConnectingManual] = useState(false);
    const [blackoutModalOpen, setBlackoutModalOpen] = useState(false);

    // Covert Channel Dynamic Tunnel States
    const [tunnelTesting, setTunnelTesting] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);

    const handleChannelHop = async () => {
        setHoppingChannel(true);
        try {
            const nextCh = ((rfMetrics?.current_channel || 1) % 8) + 1;
            await RedAPI.triggerChannelHop(nextCh);
            toast.success(`⚡ Salto ejecutado a Canal ${nextCh}`);
            const rf = await RedAPI.getRfMetrics();
            if (rf) setRfMetrics(rf);
        } catch {
            toast.error("Error al ejecutar salto de canal");
        } finally {
            setHoppingChannel(false);
        }
    };

    const handleTestTunnel = async () => {
        setTunnelTesting(true);
        setTestResult(null);
        try {
            const testPayload = "6d079229_NOISE_XK_TEST_PACKET_V30";
            const queries = DnsTunnelEngine.packPayloadIntoDnsQuery(testPayload);
            const res = await DnsTunnelEngine.transmitDnsQuery(queries[0]);
            const sniRes = await SniSpoofEngine.transmitSniBypass(testPayload);
            
            if (res.success || sniRes.success) {
                setTestResult(`✅ Trama Base32 enviada | DNS: ${res.latencyMs}ms | SNI Fronting: ${sniRes.latencyMs}ms`);
                toast.success("Prueba de canal encubierto exitosa");
            } else {
                setTestResult(`❌ Fallo de Túnel: DoH bloqueado | SNI: ${sniRes.reason || "Bloqueado"}`);
                toast.error("Canales encubiertos bloqueados");
            }
        } catch {
            setTestResult("⚠️ Error crítico al simular canal encubierto");
        } finally {
            setTunnelTesting(false);
        }
    };

    const handleConnectManual = async () => {
        if (!manualAddress.trim()) {
            toast.warning("Ingresa la dirección Multiaddr del par");
            return;
        }
        setConnectingManual(true);
        try {
            const ok = await connectPeer(manualAddress.trim());
            if (ok) {
                toast.success("✅ Conectado al par con éxito");
                setManualAddress("");
            } else {
                toast.error("No se pudo conectar al par");
            }
        } catch {
            toast.error("Error de conexión");
        } finally {
            setConnectingManual(false);
        }
    };

    useEffect(() => {
        setLoraEnabled(typeof window !== "undefined" && localStorage.getItem("red_lora_enabled") === "true");
        setLoraPort((typeof window !== "undefined" && localStorage.getItem("red_lora_port")) || "/dev/ttyUSB0");
        setLoraBaud((typeof window !== "undefined" && localStorage.getItem("red_lora_baud")) || "115200");

        const fetchIp = async () => {
            try {
                const d = await RedAPI.getNetworkIp();
                if (d && d.local_ip) { setLocalIp(d.local_ip); return; }
            } catch {}
            setLocalIp("No Disponible (Offline)");
        };
        fetchIp();

        const updateTransportMetrics = async () => {
            try {
                const peers = await RedAPI.getPeers();
                const counts: Record<string, number> = { wifi: 0, ble: 0, lorawan: 0, tcp: 0, quic: 0 };
                for (const p of peers) {
                    const t = (p.transport || "").toLowerCase();
                    if (t === "wifi_direct" || t === "websocket" || t === "wifi") counts.wifi++;
                    else if (t === "ble") counts.ble++;
                    else if (t === "lorawan" || t === "lora") counts.lorawan++;
                    else if (t === "tcp") counts.tcp++;
                    else if (t === "quic") counts.quic++;
                }
                setPeersByTransport(counts);
            } catch {}
            try {
                const rf = await RedAPI.getRfMetrics();
                if (rf) setRfMetrics(rf);
            } catch {}
        };
        updateTransportMetrics();
        const interval = setInterval(updateTransportMetrics, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleSaveLora = async () => {
        if (typeof window !== "undefined") {
            localStorage.setItem("red_lora_enabled", loraEnabled ? "true" : "false");
            localStorage.setItem("red_lora_port", loraPort);
            localStorage.setItem("red_lora_baud", loraBaud);
        }
        try {
            await RedAPI.configureHardwareLoRa({ enabled: loraEnabled, port: loraPort, baud: loraBaud });
            toast.success("⚙️ Configuración LoRa aplicada en el Hardware");
        } catch (e: any) {
            toast.error("⚠️ Configurado localmente, pero el nodo físico no respondió.");
        }
    };

    const handleRunAiDiag = async () => {
        setDiagLoading(true);
        setAiNetworkDiag(null);
        try {
            const prompt = `Evalúa la topología de red P2P. Nodos activos por transporte: ${peersByTransport.ble} BLE, ${peersByTransport.wifi} WiFi/WS, ${peersByTransport.lorawan} LoRaWAN, ${peersByTransport.tcp} TCP, ${peersByTransport.quic} QUIC.`;
            const res = await queryAICopilot(prompt);
            setAiNetworkDiag(res.answer || "El modelo no generó una respuesta válida.");
        } catch (e: any) {
            setAiNetworkDiag(`⚠️ Error del motor de IA: ${e.message || "Motor de IA inaccesible."}`);
            toast.error("No se pudo contactar a la IA");
        } finally {
            setDiagLoading(false);
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
                    }}>🌐</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Ingeniería de Redes & Transportes
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            SWARM TOPOLOGY · LORA SERIAL · COVERT CHANNELS
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => setBlackoutModalOpen(true)}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    >
                        ⚡ Apagón
                    </button>
                    <button
                        onClick={goBack}
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

                    {/* Tarjeta de Dirección IP Local */}
                    <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>{t.diagnostics_module?.mesh_network_panel || "DIRECCIÓN IP DE NODO (LAN/MESH)"}</div>
                            <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                {localIp}
                            </div>
                        </div>
                        <span className="badge-tactical badge-tactical-emerald">PUERTO 7333</span>
                    </div>

                    {/* Desglose de Nodos por Transporte (Swarm Topology) */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    📡 Topología Swarm — Nodos por Capa Física
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Total de enlaces concurrentes: {Object.values(peersByTransport).reduce((a, b) => a + b, 0)} pares
                                </div>
                            </div>
                            <span className="badge-tactical badge-tactical-cyan">MULTI-BEARER</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "8px" }}>
                            <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0, 229, 255, 0.06)", border: "1px solid rgba(0, 229, 255, 0.2)", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>WIFI DIRECT</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--accent-cyan)" }}>{peersByTransport.wifi}</div>
                            </div>
                            <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(0, 230, 118, 0.06)", border: "1px solid rgba(0, 230, 118, 0.2)", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>BLE MESH</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--accent-emerald)" }}>{peersByTransport.ble}</div>
                            </div>
                            <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(179, 136, 255, 0.06)", border: "1px solid rgba(179, 136, 255, 0.2)", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>LORAWAN</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--accent-purple, #B388FF)" }}>{peersByTransport.lorawan}</div>
                            </div>
                            <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255, 171, 0, 0.06)", border: "1px solid rgba(255, 171, 0, 0.2)", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>TCP MULTI</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--accent-amber)" }}>{peersByTransport.tcp}</div>
                            </div>
                            <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255, 64, 129, 0.06)", border: "1px solid rgba(255, 64, 129, 0.2)", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>QUIC TUNNEL</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--accent-crimson)" }}>{peersByTransport.quic}</div>
                            </div>
                        </div>
                    </div>

                    {/* Telemetría RF y Anti-Jamming */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                    📻 Telemetría Espectral RF & Anti-Jamming
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Canal activo: {rfMetrics?.channel_label || `Canal ${rfMetrics?.current_channel || 1}`} ({rfMetrics?.frequency_mhz || 915.0} MHz)
                                </div>
                            </div>
                            <button
                                onClick={handleChannelHop}
                                disabled={hoppingChannel}
                                className="btn-tactical-primary"
                                style={{ padding: "6px 12px", fontSize: "0.75rem", background: "linear-gradient(135deg, #00E676 0%, #00B0FF 100%)", color: "#000" }}
                            >
                                {hoppingChannel ? "Saltando..." : "⚡ Salto de Canal"}
                            </button>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontFamily: "JetBrains Mono, monospace" }}>
                            <div style={{ padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.03)" }}>
                                <div style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>SNR PROMEDIO</div>
                                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-emerald)" }}>+{rfMetrics?.average_snr_db ?? 18.4} dB</div>
                            </div>
                            <div style={{ padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.03)" }}>
                                <div style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>PISO DE RUIDO</div>
                                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-cyan)" }}>{rfMetrics?.noise_floor_db ?? -95} dBm</div>
                            </div>
                            <div style={{ padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.03)" }}>
                                <div style={{ fontSize: "0.64rem", color: "var(--text-muted)" }}>TASA ERROR (PER)</div>
                                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: (rfMetrics?.packet_error_rate ?? 0.002) < 0.01 ? "var(--accent-emerald)" : "var(--accent-amber)" }}>
                                    {((rfMetrics?.packet_error_rate ?? 0.002) * 100).toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "var(--text-muted)", paddingTop: "4px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <span>FEC: <strong style={{ color: "#fff" }}>{rfMetrics?.fec_rate || "Reed-Solomon 1/2"}</strong></span>
                            <span>Saltos registrados: <strong style={{ color: "var(--accent-cyan)" }}>{rfMetrics?.hops_count ?? 0}</strong></span>
                        </div>
                    </div>

                    {/* Conectar a Par Manualmente */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>{t.sidebar?.add_contact_btn || "Conectar Manualmente a Nodo P2P"}</div>
                        <input
                            value={manualAddress}
                            onChange={e => setManualAddress(e.target.value)}
                            placeholder="Multiaddr (ej: /ip4/192.168.1.50/tcp/7333/p2p/...)"
                            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}
                        />
                        <button
                            onClick={handleConnectManual}
                            disabled={connectingManual || !manualAddress.trim()}
                            className="btn-tactical-primary"
                            style={{ padding: "12px", fontSize: "0.88rem" }}
                        >
                            {connectingManual ? (t.common?.loading || "Estableciendo enlace...") : `⚡ ${t.common?.confirm || "CONECTAR AL PAR"}`}
                        </button>
                    </div>

                    {/* Banco de Pruebas de Canales Encubiertos */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                            <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                🕶️ Canales Encubiertos Anti-Censura (DNS & SNI)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                Permite enrutar paquetes Noise cifrados camuflados como consultas DNS estándar o SNI Fronting.
                            </div>
                        </div>

                        <button
                            onClick={handleTestTunnel}
                            disabled={tunnelTesting}
                            className="btn-tactical-secondary"
                            style={{ padding: "10px", fontSize: "0.82rem" }}
                        >
                            {tunnelTesting ? "Transmitiendo paquetes de prueba..." : "⚡ PROBAR TÚNEL DNS / SNI"}
                        </button>

                        {testResult && (
                            <div className="card-tactical animate-pop" style={{ padding: "12px", background: "rgba(0,229,255,0.06)", borderColor: "var(--accent-cyan)" }}>
                                <div style={{ fontSize: "0.78rem", color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>{testResult}</div>
                            </div>
                        )}
                    </div>

                    {/* Configuración de Hardware LoRa Serial */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>Módulo Hardware LoRaWAN Serial</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Conexión a transceptor SX1262/SX1276 por USB OTG</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={loraEnabled}
                                onChange={e => setLoraEnabled(e.target.checked)}
                                style={{ width: "20px", height: "20px", accentColor: "var(--accent-purple, #B388FF)" }}
                            />
                        </div>

                        {loraEnabled && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                        value={loraPort}
                                        onChange={e => setLoraPort(e.target.value)}
                                        placeholder="Puerto (ej: /dev/ttyUSB0)"
                                        style={{ flex: 2, fontSize: "0.82rem" }}
                                    />
                                    <input
                                        value={loraBaud}
                                        onChange={e => setLoraBaud(e.target.value)}
                                        placeholder="Baud (115200)"
                                        style={{ flex: 1, fontSize: "0.82rem" }}
                                    />
                                </div>
                                <button
                                    onClick={handleSaveLora}
                                    className="btn-tactical-primary"
                                    style={{ padding: "10px", fontSize: "0.82rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                                >
                                    💾 Guardar Parámetros LoRa
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Diagnóstico con IA Local */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <button
                            onClick={handleRunAiDiag}
                            disabled={diagLoading}
                            className="btn-tactical-secondary"
                            style={{ width: "100%", padding: "12px", fontSize: "0.85rem" }}
                        >
                            {diagLoading ? "Auditando topología de malla..." : "🤖 EVALUAR TOPOLOGÍA DE RED (IA LOCAL)"}
                        </button>

                        {aiNetworkDiag && (
                            <div className="card-tactical animate-pop" style={{ padding: "14px", background: "rgba(0,229,255,0.06)", borderColor: "var(--accent-cyan)" }}>
                                <div style={{ fontSize: "0.85rem", color: "#fff", lineHeight: 1.4 }}>
                                    {aiNetworkDiag}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Apagón */}
            {blackoutModalOpen && <BlackoutSimulatorModal onClose={() => setBlackoutModalOpen(false)} />}
        </div>
    );
}
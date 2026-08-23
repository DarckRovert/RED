"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { BlackoutSimulatorModal } from "./BlackoutSimulatorModal";
import { LocalAIEngine } from "../lib/localAiEngine";
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
                const res = await fetch("http://127.0.0.1:7333/api/network/ip", { signal: AbortSignal.timeout(2000) });
                if (res.ok) { const d = await res.json(); setLocalIp(d.local_ip || d.ip || "127.0.0.1"); return; }
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
                    if (t === "wifi_direct" || t === "websocket") counts.wifi++;
                    else if (t === "ble") counts.ble++;
                    else if (t === "lorawan" || t === "lora") counts.lorawan++;
                    else if (t === "tcp") counts.tcp++;
                    else if (t === "quic") counts.quic++;
                }
                setPeersByTransport(counts);
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
            const res = await LocalAIEngine.generateCopilotResponse(prompt);
            setAiNetworkDiag(res.answer || "El modelo no generó una respuesta válida.");
        } catch (e: any) {
            setAiNetworkDiag(`⚠️ Error del motor de IA Local: ${e.message || "LLM inaccesible. Verifique que el servicio llama.cpp esté corriendo en el puerto 8080."}`);
            toast.error("No se pudo contactar a la IA local");
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
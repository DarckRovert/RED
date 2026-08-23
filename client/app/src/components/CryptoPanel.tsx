"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { BackupRestoreModal } from "./BackupRestoreModal";
import { NodeLogsModal } from "./NodeLogsModal";
import { LocalAIEngine } from "../lib/localAiEngine";
import { web3Bridge, Web3WalletState } from "../lib/Web3BridgeEngine";
import { tokenomicsEngine, TokenomicsMetrics } from "../lib/TokenomicsEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export default function CryptoPanel() {
    const { identity, status, goBack, navigate } = useRedStore();
    const { t } = useTranslation();
    const [vault, setVault] = useState<any>(null);
    const [backupModalOpen, setBackupModalOpen] = useState(false);
    const [logsModalOpen, setLogsModalOpen] = useState(false);
    const [powerMode, setPowerMode] = useState<"high" | "stealth">(
        (typeof window !== "undefined" && localStorage.getItem("red_power_mode") as "high" | "stealth") || "high"
    );

    // Web3 & Tokenomics State
    const [web3State, setWeb3State] = useState<Web3WalletState>(web3Bridge.getState());
    const [tokenomics, setTokenomics] = useState<TokenomicsMetrics>(tokenomicsEngine.getMetrics());

    // Real transport telemetry from /api/peers
    const [peersByTransport, setPeersByTransport] = useState<Record<string, number>>({ wifi: 0, ble: 0, lorawan: 0, tcp: 0, quic: 0 });

    // AI Crypto Audit state
    const [aiCryptoAudit, setAiCryptoAudit] = useState<string | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);

    useEffect(() => {
        const unsubscribeWeb3 = web3Bridge.subscribe((w) => setWeb3State(w));
        const unsubscribeTokenomics = tokenomicsEngine.subscribe((t) => setTokenomics(t));

        const fetchVault = async () => {
            try {
                const data = await RedAPI.req<any>("/network/vault");
                setVault(data);
            } catch {
                try { setVault(await RedAPI.getStatus()); } catch {}
            }
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
        fetchVault();
        const interval = setInterval(fetchVault, 3000);
        return () => {
            clearInterval(interval);
            unsubscribeWeb3();
            unsubscribeTokenomics();
        };
    }, []);

    const handleRunAiCryptoAudit = async () => {
        setAuditLoading(true);
        setAiCryptoAudit(null);
        try {
            const prompt = `Evalúa en 2 oraciones la salud criptográfica y conectividad del nodo con balance ${tokenomics.localCredits} RED y ${status?.peer_count ?? 0} pares conectados.`;
            const res = await LocalAIEngine.generateCopilotResponse(prompt);
            setAiCryptoAudit(res.answer || "El modelo no generó un dictamen criptográfico válido.");
        } catch (e: any) {
            setAiCryptoAudit(`⚠️ Motor de IA Local no disponible: ${e.message || "Modelos ONNX no cargados"}.`);
            toast.error("IA Local no disponible");
        } finally {
            setAuditLoading(false);
        }
    };

    const togglePowerMode = () => {
        const next = powerMode === "high" ? "stealth" : "high";
        setPowerMode(next);
        if (typeof window !== "undefined") {
            localStorage.setItem("red_power_mode", next);
        }
        toast.info(next === "stealth" ? "Modo Sigilo: Escaneo RF minimizado" : "Modo Alto Rendimiento: Máxima potencia de radio");
    };

    const balance = tokenomics.localCredits;
    const blocksCount = vault?.blocks_mined !== undefined ? vault.blocks_mined : undefined;
    const hashrate = vault?.hashrate !== undefined ? `${vault.hashrate} H/s` : undefined;
    const peerCount = status?.peer_count !== undefined ? status.peer_count : 0;

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
                        background: "linear-gradient(135deg, #FFB300 0%, #F57C00 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(255,179,0,0.4)"
                    }}>⚡</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.modules?.crypto || "Telemetría de Nodo & Minería P2P"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            POW ENGINE · SOVEREIGN TOKEN VAULT · MULTI-TRANSPORT
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => navigate("web3Vault")}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem", color: "var(--accent-amber)" }}
                    >
                        🦊 Web3
                    </button>
                    <button
                        onClick={() => navigate("globalShield")}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem", color: "var(--accent-cyan)" }}
                    >
                        🛡️ Escudo
                    </button>
                    <button
                        onClick={() => navigate("explorer")}
                        className="btn-tactical-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                    >
                        ⛓️ Explorer
                    </button>
                    <button
                        onClick={goBack}
                        className="btn-icon"
                        title={t.common?.close || "Cerrar panel"}
                        style={{ width: 38, height: 38 }}
                    >
                        ✕
                    </button>
                </div>
            </header>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* HUD Grid de 4 Métricas Clave */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                        <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Balance Soberano</span>
                                <span>💰</span>
                            </div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                {balance.toFixed(2)} <span style={{ fontSize: "0.85rem" }}>RED</span>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                ≈ ${tokenomics.estimatedFiatValueUsd.toFixed(2)} USD
                            </div>
                        </div>

                        <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Recompensas Relay</span>
                                <span>📡</span>
                            </div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                +{tokenomics.relayEarnings.toFixed(2)} <span style={{ fontSize: "0.75rem" }}>RED</span>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                {tokenomics.totalRelayedPackets} paquetes ruteados
                            </div>
                        </div>

                        <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Tasa de Hash PoW</span>
                                <span>⚡</span>
                            </div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                {hashrate ?? <span style={{ color: "var(--text-muted)", fontSize: "1rem" }}>—</span>}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                Bloques: {blocksCount !== undefined ? `#${blocksCount}` : <span style={{ letterSpacing: 0 }}>—</span>}
                            </div>
                        </div>

                        <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.70rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Pares en Malla</span>
                                <span>🌐</span>
                            </div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                {peerCount} <span style={{ fontSize: "0.75rem", color: "var(--accent-emerald)" }}>ONLINE</span>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                PoS Staking APY: {tokenomics.validatorApy}%
                            </div>
                        </div>
                    </div>

                    {/* Post-Quantum Cryptographic Vault (Kyber-768 + Ed25519) */}
                    <div
                        className="card-tactical animate-enter"
                        style={{
                            padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "linear-gradient(135deg, rgba(0, 240, 255, 0.12) 0%, rgba(0, 230, 118, 0.06) 100%)",
                            border: "1px solid rgba(0, 240, 255, 0.35)"
                        }}
                    >
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "1.1rem" }}>🔐</span>
                                <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    Bóveda Post-Cuántica ML-KEM-768 (Kyber)
                                </div>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
                                Cifrado híbrido post-cuántico activo: <strong>Kyber-768 + Ed25519 Double Ratchet</strong> con almacenamiento endurecido AES-256-GCM.
                            </div>
                        </div>
                        <button
                            onClick={() => setBackupModalOpen(true)}
                            className="btn-tactical-primary"
                            style={{
                                padding: "8px 14px", fontSize: "0.78rem", whiteSpace: "nowrap",
                                background: "linear-gradient(135deg, #00F0FF 0%, #00B0FF 100%)", color: "#000", fontWeight: 800
                            }}
                        >
                            💾 Semilla BIP-39
                        </button>
                    </div>

                    {/* Web3 & MetaMask Quick Integration Banner */}
                    <div
                        className="card-tactical animate-enter"
                        style={{
                            padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "linear-gradient(135deg, rgba(245,132,31,0.12) 0%, rgba(226,118,27,0.06) 100%)",
                            border: "1px solid rgba(245,132,31,0.35)"
                        }}
                    >
                        <div>
                            <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                                🦊 Integración Web3 (MetaMask)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                {web3State.isConnected && web3State.account
                                    ? `Conectado: ${web3State.account.substring(0, 10)}… (${web3State.chainName})`
                                    : "Vincula tu billetera Ethereum/Polygon y sincroniza tus activos $RED"}
                            </div>
                        </div>
                        <button
                            onClick={() => navigate("web3Vault")}
                            className="btn-tactical-primary"
                            style={{
                                padding: "8px 16px", fontSize: "0.80rem",
                                background: "linear-gradient(135deg, #F5841F 0%, #E2761B 100%)",
                                color: "#fff"
                            }}
                        >
                            {web3State.isConnected ? "Administrar" : "Conectar"}
                        </button>
                    </div>

                    {/* Matriz de Transportes Activos */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
                            📡 MATRIZ DE INTERFACES FÍSICAS DE ENLACE
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                            <div className="card-tactical" style={{ padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>BLE MESH</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-emerald)" }}>{peersByTransport.ble}</div>
                            </div>
                            <div className="card-tactical" style={{ padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>WIFI DIRECT</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-cyan)" }}>{peersByTransport.wifi}</div>
                            </div>
                            <div className="card-tactical" style={{ padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>LORAWAN RF</div>
                                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--accent-amber)" }}>{peersByTransport.lorawan}</div>
                            </div>
                        </div>
                    </div>

                    {/* Control de Potencia y Modo Sigilo */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.90rem", fontWeight: 800 }}>Modo de Radio & Energía</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                {powerMode === "high" ? "Alta Potencia: Escaneo RF continuo y máxima propagación" : "Modo Sigilo: Reducción de huella RF y ahorro de batería"}
                            </div>
                        </div>
                        <button
                            onClick={togglePowerMode}
                            className="btn-tactical-secondary"
                            style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                        >
                            {powerMode === "high" ? "🔋 ALTA POTENCIA" : "🥷 MODO SIGILO"}
                        </button>
                    </div>

                    {/* Auditoría con IA Local */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <button
                            onClick={handleRunAiCryptoAudit}
                            disabled={auditLoading}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "12px", fontSize: "0.90rem", background: "linear-gradient(135deg, #FFB300 0%, #F57C00 100%)", color: "#000" }}
                        >
                            {auditLoading ? "Auditando Bóveda..." : "🤖 AUDITAR SALUD CRIPTOGRÁFICA (IA LOCAL)"}
                        </button>

                        {aiCryptoAudit && (
                            <div className="card-tactical animate-pop" style={{ padding: "14px", background: "rgba(255,179,0,0.06)", borderColor: "var(--accent-amber)" }}>
                                <div style={{ fontSize: "0.74rem", fontWeight: 800, color: "var(--accent-amber)", marginBottom: "4px" }}>
                                    DICTAMEN CRIPTOGRÁFICO IA:
                                </div>
                                <div style={{ fontSize: "0.85rem", color: "#fff", lineHeight: 1.4 }}>
                                    {aiCryptoAudit}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modales Embebidos */}
            {backupModalOpen && <BackupRestoreModal onClose={() => setBackupModalOpen(false)} />}
            {logsModalOpen && <NodeLogsModal onClose={() => setLogsModalOpen(false)} />}
        </div>
    );
}
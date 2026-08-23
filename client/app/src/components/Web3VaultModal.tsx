"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { web3Bridge, Web3WalletState, SUPPORTED_CHAINS } from "../lib/Web3BridgeEngine";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

export default function Web3VaultModal() {
    const { identity, goBack } = useRedStore();
    const { t } = useTranslation();
    const [web3State, setWeb3State] = useState<Web3WalletState>(web3Bridge.getState());
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [selectedChainId, setSelectedChainId] = useState<number>(web3State.chainId || 1);

    useEffect(() => {
        const unsubscribe = web3Bridge.subscribe((s) => {
            setWeb3State(s);
            if (s.chainId) setSelectedChainId(s.chainId);
        });
        return () => unsubscribe();
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        TacticalAudioEngine.playTap();
        try {
            const res = await web3Bridge.connectWallet();
            if (res.success) {
                toast.success(`🦊 Conectado a ${web3State.providerName}: ${res.account?.substring(0, 8)}…`);
                TacticalAudioEngine.playMessageReceived();
            } else {
                toast.error(res.error || "No se pudo conectar con la wallet.");
            }
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSwitchChain = async (chainId: number) => {
        TacticalAudioEngine.playTap();
        setSelectedChainId(chainId);
        const ok = await web3Bridge.switchNetwork(chainId);
        if (ok) {
            toast.info(`Cambiado a red: ${SUPPORTED_CHAINS[chainId]?.chainName}`);
        } else {
            toast.warning(`No se pudo cambiar automáticamente a la red ${chainId}`);
        }
    };

    const handleSignBinding = async () => {
        if (!identity?.identity_hash) {
            toast.error("Identidad soberana RED no inicializada.");
            return;
        }

        setIsSigning(true);
        TacticalAudioEngine.playTap();
        try {
            const res = await web3Bridge.linkSovereignIdentity(identity.identity_hash);
            if (res.success && res.binding) {
                toast.success("✅ Vinculación criptográfica EIP-712 generada con éxito");
                TacticalAudioEngine.playMessageSent();
            } else {
                toast.error(res.error || "Fallo en la firma digital.");
            }
        } finally {
            setIsSigning(false);
        }
    };

    const handleUnlink = () => {
        TacticalAudioEngine.playTap();
        web3Bridge.unlinkIdentity();
        toast.info("Vinculación Web3 eliminada");
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success("Copiado al portapapeles");
        }
    };

    const redDid = identity?.identity_hash 
        ? (identity.identity_hash.startsWith("did:red:") ? identity.identity_hash : `did:red:${identity.identity_hash}`)
        : "did:red:offline";

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header */}
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
                        background: "linear-gradient(135deg, #F5841F 0%, #E2761B 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", boxShadow: "0 4px 16px rgba(245,132,31,0.4)"
                    }}>
                        🦊
                    </div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t.modules?.web3_vault || "Bóveda Web3 & Integración MetaMask"}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            EIP-1193 · EIP-712 ATTESTATIONS · MULTI-CHAIN EVM
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title={t.common?.close || "Cerrar Bóveda Web3"}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Scrollable Body */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Web3 Status & Connect Card */}
                    <div
                        className="card-tactical-glow-amber"
                        style={{
                            padding: "20px",
                            background: "linear-gradient(145deg, rgba(28, 20, 10, 0.85), rgba(12, 10, 6, 0.95))",
                            borderRadius: "var(--radius-lg)",
                            display: "flex", flexDirection: "column", gap: "14px",
                            border: "1px solid rgba(245, 132, 31, 0.35)",
                            boxShadow: "0 10px 30px rgba(245, 132, 31, 0.15)"
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>
                                    Estado de Conexión Web3
                                </span>
                                <span className={`badge-tactical ${web3State.isConnected ? "badge-tactical-emerald" : "badge-tactical-amber"}`}>
                                    {web3State.isConnected ? "CONECTADO" : "DESCONECTADO"}
                                </span>
                            </div>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                {web3State.providerName}
                            </span>
                        </div>

                        {web3State.isConnected && web3State.account ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Dirección EVM:</span>
                                    <button
                                        onClick={() => copyToClipboard(web3State.account!)}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "4px 8px", fontSize: "0.72rem" }}
                                    >
                                        📋 Copiar
                                    </button>
                                </div>
                                <div style={{
                                    padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.5)",
                                    fontSize: "0.82rem", fontFamily: "JetBrains Mono, monospace",
                                    color: "var(--accent-amber)", wordBreak: "break-all"
                                }}>
                                    {web3State.account}
                                </div>

                                {/* Balances Grid */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
                                    <div className="card-tactical" style={{ padding: "10px" }}>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Saldo Nativo ({web3State.chainName.split(" ")[0]})</div>
                                        <div style={{ fontSize: "1.2rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "#fff" }}>
                                            {web3State.balanceEth} <span style={{ fontSize: "0.75rem", color: "var(--accent-amber)" }}>ETH/POL</span>
                                        </div>
                                    </div>

                                    <div className="card-tactical" style={{ padding: "10px" }}>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Token $RED On-Chain</div>
                                        <div style={{ fontSize: "1.2rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "var(--accent-emerald)" }}>
                                            {web3State.balanceRedToken} <span style={{ fontSize: "0.75rem" }}>$RED</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => web3Bridge.handleDisconnect()}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "8px", fontSize: "0.78rem", color: "var(--accent-crimson)", marginTop: "4px" }}
                                >
                                    Desconectar Wallet
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                                    Conecta tu billetera MetaMask para verificar tu identidad descentralizada on-chain, sincronizar activos y habilitar pagos Web3 interoperables.
                                </p>
                                <button
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="btn-tactical-primary"
                                    style={{
                                        width: "100%", padding: "12px",
                                        background: "linear-gradient(135deg, #F5841F 0%, #E2761B 100%)",
                                        color: "#fff", fontWeight: 800
                                    }}
                                >
                                    {isConnecting ? "Solicitando Autorización en MetaMask..." : "🦊 CONECTAR METAMASK / WEB3"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Network Switcher */}
                    {web3State.isConnected && (
                        <div className="card-tactical animate-enter" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>🌐 RED BLOCKCHAIN EVM</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                                {Object.values(SUPPORTED_CHAINS).map((chain) => (
                                    <button
                                        key={chain.chainId}
                                        onClick={() => handleSwitchChain(chain.chainId)}
                                        className={selectedChainId === chain.chainId ? "btn-tactical-primary" : "btn-tactical-secondary"}
                                        style={{ padding: "8px 6px", fontSize: "0.74rem", textAlign: "center" }}
                                    >
                                        {chain.chainName.split(" ")[0]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Cryptographic Identity Binding (EIP-712) */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                            <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                🪪 Vinculación Criptográfica DID ↔ Ethereum
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Genera una prueba matemática de que tu dirección Web3 y tu nodo RED pertenecen a la misma entidad soberana.
                            </div>
                        </div>

                        <div style={{ padding: "10px", background: "rgba(0,0,0,0.4)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>TU DID SOBERANO RED:</div>
                            <div style={{ fontSize: "0.78rem", fontFamily: "JetBrains Mono, monospace", color: "var(--accent-cyan)", wordBreak: "break-all" }}>
                                {redDid}
                            </div>
                        </div>

                        {web3State.binding ? (
                            <div className="card-tactical animate-pop" style={{ padding: "14px", background: "rgba(0,230,118,0.06)", borderColor: "var(--accent-emerald)", display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                        ✅ ATESTACIÓN EIP-712 FIRMADA & VERIFICADA
                                    </span>
                                    <button
                                        onClick={handleUnlink}
                                        className="btn-ghost"
                                        style={{ fontSize: "0.70rem", color: "var(--accent-crimson)" }}
                                    >
                                        Desvincular
                                    </button>
                                </div>
                                <div style={{ fontSize: "0.70rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", wordBreak: "break-all" }}>
                                    Firma: {web3State.binding.signatureEth.substring(0, 32)}… · Fecha: {new Date(web3State.binding.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handleSignBinding}
                                disabled={!web3State.isConnected || isSigning}
                                className="btn-tactical-primary"
                                style={{
                                    width: "100%", padding: "12px",
                                    background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)",
                                    color: "#000", fontWeight: 800
                                }}
                            >
                                {isSigning ? "Esperando Firma EIP-712 en MetaMask..." : "⚡ FIRMAR Y VINCULAR IDENTIDAD CRIPTOGRÁFICA"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

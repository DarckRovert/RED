"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { web3Bridge, Web3WalletState, SUPPORTED_CHAINS } from "../lib/Web3BridgeEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
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
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace",
            display: "flex", flexDirection: "column", overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(245, 132, 31, 0.35)",
                background: "linear-gradient(180deg, rgba(14, 18, 38, 0.98) 0%, rgba(6, 8, 20, 0.99) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                zIndex: 10, flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={goBack}
                        style={{
                            width: 34, height: 34, borderRadius: "9px",
                            background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                            color: "#FFFFFF", cursor: "pointer", fontSize: "1.1rem", fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                    >
                        ‹
                    </button>
                    <div style={{
                        width: 38, height: 38, borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(245, 132, 31, 0.25) 0%, rgba(226, 118, 27, 0.15) 100%)",
                        border: "1px solid rgba(245, 132, 31, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.3rem", boxShadow: "0 0 15px rgba(245, 132, 31, 0.3)"
                    }}>
                        🦊
                    </div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            BÓVEDA WEB3 & METAMASK
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-amber, #FFB300)", fontWeight: 800 }}>
                            EIP-1193 · EIP-712 ATTESTATIONS · MULTI-CHAIN EVM
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    style={{
                        width: 34, height: 34, borderRadius: "9px",
                        background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#FFFFFF", cursor: "pointer", fontSize: "0.9rem", fontWeight: 900
                    }}
                >
                    ✕
                </button>
            </header>

            {/* Scrollable Body */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Estado de Conexión */}
                    <div style={{
                        background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                        border: "1.5px solid rgba(245, 132, 31, 0.35)", borderRadius: "22px", padding: "20px",
                        display: "flex", flexDirection: "column", gap: "14px",
                        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#FFFFFF" }}>
                                    ESTADO DEL CONECTOR WEB3
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                    {web3State.isConnected ? `Conectado via ${web3State.providerName}` : "Desconectado. Detectando proveedores EVM..."}
                                </div>
                            </div>
                            <span style={{
                                fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                                background: web3State.isConnected ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 51, 85, 0.15)",
                                color: web3State.isConnected ? "#00E676" : "#FF3355",
                                border: `1px solid ${web3State.isConnected ? '#00E676' : '#FF3355'}50`
                            }}>
                                {web3State.isConnected ? "CONECTADO" : "DESCONECTADO"}
                            </span>
                        </div>

                        {web3State.isConnected ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div style={{
                                    padding: "12px", background: "rgba(0, 0, 0, 0.5)",
                                    border: "1px solid rgba(245, 132, 31, 0.3)", borderRadius: "12px",
                                    display: "flex", justifyContent: "space-between", alignItems: "center"
                                }}>
                                    <div>
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>DIRECCIÓN EVM</div>
                                        <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#F5841F", fontFamily: "JetBrains Mono, monospace" }}>
                                            {web3State.account?.substring(0, 10)}…{web3State.account?.slice(-8)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(web3State.account || "")}
                                        style={{
                                            padding: "6px 12px", background: "rgba(245, 132, 31, 0.15)",
                                            border: "1px solid rgba(245, 132, 31, 0.4)", borderRadius: "8px",
                                            color: "#F5841F", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer"
                                        }}
                                    >
                                        COPIAR
                                    </button>
                                </div>

                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                        onClick={handleSignBinding}
                                        disabled={isSigning}
                                        style={{
                                            flex: 2, padding: "12px",
                                            background: "linear-gradient(135deg, #F5841F 0%, #E2761B 100%)",
                                            border: "none", borderRadius: "12px", color: "#FFFFFF",
                                            fontWeight: 900, fontSize: "0.82rem", cursor: "pointer",
                                            boxShadow: "0 0 15px rgba(245, 132, 31, 0.35)"
                                        }}
                                    >
                                        {isSigning ? "Firmando EIP-712..." : "✍️ FIRMAR ATTESTATION EIP-712"}
                                    </button>
                                    <button
                                        onClick={handleUnlink}
                                        style={{
                                            flex: 1, padding: "12px",
                                            background: "rgba(255, 51, 85, 0.1)",
                                            border: "1px solid rgba(255, 51, 85, 0.35)", borderRadius: "12px",
                                            color: "#FF3355", fontWeight: 900, fontSize: "0.82rem", cursor: "pointer"
                                        }}
                                    >
                                        DESVINCULAR
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={isConnecting}
                                style={{
                                    width: "100%", padding: "14px",
                                    background: "linear-gradient(135deg, #F5841F 0%, #E2761B 100%)",
                                    border: "none", borderRadius: "12px", color: "#FFFFFF",
                                    fontWeight: 900, fontSize: "0.88rem", cursor: "pointer",
                                    boxShadow: "0 0 20px rgba(245, 132, 31, 0.35)"
                                }}
                            >
                                {isConnecting ? "Conectando..." : "🦊 CONECTAR METAMASK / WALLET"}
                            </button>
                        )}
                    </div>

                    {/* Selector de Redes EVM */}
                    <div style={{
                        background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                        border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "22px", padding: "20px",
                        display: "flex", flexDirection: "column", gap: "12px"
                    }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 900, color: "#FFFFFF" }}>
                            REDES EVM COMPATIBLES
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
                            {Object.entries(SUPPORTED_CHAINS).map(([cId, chain]) => {
                                const isCurrent = selectedChainId === Number(cId);
                                return (
                                    <button
                                        key={cId}
                                        onClick={() => handleSwitchChain(Number(cId))}
                                        style={{
                                            padding: "10px", borderRadius: "10px",
                                            background: isCurrent ? "rgba(245, 132, 31, 0.2)" : "rgba(255, 255, 255, 0.03)",
                                            border: isCurrent ? "1.5px solid #F5841F" : "1px solid rgba(255, 255, 255, 0.08)",
                                            color: isCurrent ? "#F5841F" : "#FFFFFF",
                                            fontWeight: isCurrent ? 900 : 700, fontSize: "0.74rem",
                                            cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px", textAlign: "left"
                                        }}
                                    >
                                        <span>{chain.chainName}</span>
                                        <span style={{ fontSize: "0.6rem", color: "var(--text-secondary)" }}>ID: {cId}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

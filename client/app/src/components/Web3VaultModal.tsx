"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { web3Bridge, Web3WalletState, SUPPORTED_CHAINS } from "../lib/Web3BridgeEngine";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { meshRouter } from "../lib/mesh/meshRouter";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";

interface Web3VaultModalProps {
    onClose?: () => void;
}

export default function Web3VaultModal({ onClose }: Web3VaultModalProps = {}) {
    const { identity, goBack } = useRedStore();
    const handleClose = onClose || goBack;
    const { t } = useTranslation();
    const [web3State, setWeb3State] = useState<Web3WalletState>(web3Bridge.getState());
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedChainId, setSelectedChainId] = useState<number>(web3State.chainId || 1);
    const [qrCredentialData, setQrCredentialData] = useState<{ url: string; payload: string } | null>(null);
    const [isGeneratingQr, setIsGeneratingQr] = useState(false);

    // ─── Intercepción Jerárquica LIFO de Hardware (Android Back / Esc) ───
    useEffect(() => {
        return BackHandlerRegistry.register(() => {
            if (qrCredentialData) {
                setQrCredentialData(null);
                return true;
            }
            handleClose();
            return true;
        });
    }, [qrCredentialData, handleClose]);

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

    const handleDisconnect = () => {
        TacticalAudioEngine.playTap();
        web3Bridge.handleDisconnect();
        toast.info("Sesión Web3 desconectada");
    };

    const handleRefreshBalances = async () => {
        setIsRefreshing(true);
        TacticalAudioEngine.playTap();
        try {
            await web3Bridge.refreshBalances();
            toast.success("Saldos actualizados desde el proveedor");
        } catch {
            toast.error("Error al consultar saldos");
        } finally {
            setIsRefreshing(false);
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

    const handleBroadcastBinding = async () => {
        if (!web3State.binding) {
            toast.warning("Primero vincula y firma tu cuenta Web3.");
            return;
        }
        TacticalAudioEngine.playTap();
        try {
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                type: 'WEB3_BINDING_ANNOUNCE',
                binding: web3State.binding,
                sender: identity?.nickname || 'OPERADOR_RED',
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);
            TacticalAudioEngine.playMessageSent();
            toast.success("📡 Vinculación Web3 EIP-712 difundida en la malla");
        } catch (e: any) {
            TacticalAudioEngine.playWarning();
            toast.error("Error al difundir vinculación en la malla");
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
                TacticalAudioEngine.playRogerBeep();
                handleBroadcastBinding().catch(() => {});
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

    const handleGenerateQrCredential = async () => {
        if (!web3State.binding) {
            toast.warning("No hay atestación de vinculación activa para codificar.");
            return;
        }
        setIsGeneratingQr(true);
        TacticalAudioEngine.playTap();
        try {
            const payload = JSON.stringify({
                type: "RED_WEB3_ATTESTATION_EIP712",
                redDid: web3State.binding.redDid,
                ethAddress: web3State.binding.ethAddress,
                signatureEth: web3State.binding.signatureEth,
                chainId: web3State.binding.chainId,
                timestamp: web3State.binding.timestamp,
                protocol: "RED-MESH-EVM-v94"
            });
            const url = await OfflineQrEngine.generateDataUrl(payload, {
                width: 260,
                margin: 1,
                darkColor: "#F5841F",
                lightColor: "#04060A"
            });
            setQrCredentialData({ url, payload });
        } catch (e: any) {
            toast.error("Error al generar código QR de credencial");
        } finally {
            setIsGeneratingQr(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                toast.success("Copiado al portapapeles");
                return;
            }
        } catch {}
        try {
            const el = document.createElement("textarea");
            el.value = text;
            el.setAttribute("readonly", "");
            el.style.position = "absolute";
            el.style.left = "-9999px";
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            toast.success("Copiado al portapapeles");
        } catch {
            toast.error("No se pudo copiar automáticamente");
        }
    };

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
                        onClick={() => {
                            if (!BackHandlerRegistry.executeTop()) {
                                TacticalAudioEngine.playTap();
                                handleClose();
                            }
                        }}
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
                    onClick={() => {
                        if (!BackHandlerRegistry.executeTop()) {
                            TacticalAudioEngine.playTap();
                            handleClose();
                        }
                    }}
                    style={{
                        width: 34, height: 34, borderRadius: "9px",
                        background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.15)",
                        color: "#FFFFFF", cursor: "pointer", fontSize: "0.9rem", fontWeight: 900
                    }}
                >
                    ✕
                </button>
            </header>

            {/* Telemetry Status Bar */}
            <div style={{
                padding: "10px 20px",
                background: "rgba(0, 0, 0, 0.4)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                fontSize: "11px"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>PROVEEDOR:</span>
                    <span style={{
                        padding: "2px 8px", borderRadius: "6px", fontWeight: 800,
                        background: web3State.isConnected ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 51, 85, 0.15)",
                        color: web3State.isConnected ? "#00E676" : "#FF3355",
                        border: `1px solid ${web3State.isConnected ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 51, 85, 0.4)'}`
                    }}>
                        {web3State.isConnected ? `🦊 ${web3State.providerName}` : "🔌 DESCONECTADO"}
                    </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>GAS:</span>
                        <span style={{ color: "#F5841F", fontWeight: 800 }}>
                            ⛽ {web3State.balanceEth} {SUPPORTED_CHAINS[selectedChainId]?.nativeCurrency.symbol || "ETH"}
                        </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--text-secondary)" }}>TOKEN:</span>
                        <span style={{ color: "var(--accent-cyan, #00E5FF)", fontWeight: 800 }}>
                            🪙 {web3State.balanceRedToken} $RED
                        </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                            padding: "2px 8px", borderRadius: "6px", fontWeight: 800,
                            background: web3State.binding ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 179, 0, 0.15)",
                            color: web3State.binding ? "#00E676" : "#FFB300",
                            border: `1px solid ${web3State.binding ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 179, 0, 0.4)'}`
                        }}>
                            {web3State.binding ? "🔒 VINCULADO EIP-712" : "🔓 SIN VINCULAR"}
                        </span>
                    </div>

                    <button
                        onClick={handleRefreshBalances}
                        disabled={isRefreshing || !web3State.isConnected}
                        style={{
                            padding: "4px 8px", background: "rgba(255, 255, 255, 0.08)",
                            border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "6px",
                            color: "#FFFFFF", fontSize: "10px", fontWeight: 800, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", gap: "4px"
                        }}
                        title="Refrescar saldos de la red EVM"
                    >
                        {isRefreshing ? "⏳" : "🔄"}
                    </button>
                </div>
            </div>

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
                                    {web3State.isConnected ? `Conectado via ${web3State.providerName} (${web3State.chainName})` : "Desconectado. Detectando proveedores EVM..."}
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
                                        <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>DIRECCIÓN EVM VINCULADA</div>
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

                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <button
                                        onClick={handleSignBinding}
                                        disabled={isSigning}
                                        style={{
                                            flex: 2, minWidth: "180px", padding: "12px",
                                            background: "linear-gradient(135deg, #F5841F 0%, #E2761B 100%)",
                                            border: "none", borderRadius: "12px", color: "#FFFFFF",
                                            fontWeight: 900, fontSize: "0.82rem", cursor: "pointer",
                                            boxShadow: "0 0 15px rgba(245, 132, 31, 0.35)"
                                        }}
                                    >
                                        {isSigning ? "Firmando EIP-712..." : (web3State.binding ? "✍️ RE-FIRMAR ATTESTATION" : "✍️ FIRMAR ATTESTATION EIP-712")}
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        style={{
                                            flex: 1, minWidth: "120px", padding: "12px",
                                            background: "rgba(255, 255, 255, 0.08)",
                                            border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "12px",
                                            color: "#FFFFFF", fontWeight: 900, fontSize: "0.82rem", cursor: "pointer"
                                        }}
                                    >
                                        DESCONECTAR
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
                                {!web3State.isAvailable && (
                                    <div style={{
                                        padding: "10px 14px", borderRadius: "10px",
                                        background: "rgba(255, 179, 0, 0.08)", border: "1px solid rgba(255, 179, 0, 0.25)",
                                        fontSize: "0.72rem", color: "var(--accent-amber, #FFB300)", lineHeight: 1.4
                                    }}>
                                        💡 En dispositivos móviles o navegadores sin extensión, abre RED dentro del navegador integrado de MetaMask o utiliza una billetera compatible con EIP-1193.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tarjeta de Atestación Criptográfica EIP-712 */}
                    {web3State.binding && (
                        <div style={{
                            background: "linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(6, 12, 28, 0.95) 100%)",
                            border: "1.5px solid rgba(0, 230, 118, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "12px",
                            boxShadow: "0 8px 30px rgba(0, 230, 118, 0.1)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "1.2rem" }}>🔏</span>
                                    <div>
                                        <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#00E676" }}>
                                            ATESTACIÓN CRIPTOGRÁFICA EIP-712 ACTIVA
                                        </div>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                                            Vinculación verificable entre identidad soberana y cuenta EVM
                                        </div>
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: "0.62rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                                    background: "rgba(0, 230, 118, 0.2)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.5)"
                                }}>
                                    VERIFICADO
                                </span>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.74rem" }}>
                                <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>DID SOBERANO RED:</span>
                                        <div style={{ color: "#00E5FF", fontWeight: 800, wordBreak: "break-all" }}>{web3State.binding.redDid}</div>
                                    </div>
                                    <button onClick={() => copyToClipboard(web3State.binding?.redDid || "")} style={{ padding: "4px 8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", color: "#FFF", fontSize: "0.65rem", cursor: "pointer", flexShrink: 0, marginLeft: "6px" }}>
                                        📋
                                    </button>
                                </div>

                                <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>DIRECCIÓN EVM:</span>
                                        <div style={{ color: "#F5841F", fontWeight: 800, wordBreak: "break-all" }}>{web3State.binding.ethAddress}</div>
                                    </div>
                                    <button onClick={() => copyToClipboard(web3State.binding?.ethAddress || "")} style={{ padding: "4px 8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", color: "#FFF", fontSize: "0.65rem", cursor: "pointer", flexShrink: 0, marginLeft: "6px" }}>
                                        📋
                                    </button>
                                </div>

                                <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.4)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ color: "var(--text-secondary)", fontSize: "0.65rem" }}>FIRMA DIGITAL ECDSA (SECP256K1):</span>
                                        <div style={{ color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace", fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {web3State.binding.signatureEth}
                                        </div>
                                    </div>
                                    <button onClick={() => copyToClipboard(web3State.binding?.signatureEth || "")} style={{ padding: "4px 8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", color: "#FFF", fontSize: "0.65rem", cursor: "pointer", flexShrink: 0, marginLeft: "6px" }}>
                                        📋
                                    </button>
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--text-secondary)", padding: "0 4px" }}>
                                    <span>Red: {SUPPORTED_CHAINS[web3State.binding.chainId]?.chainName || `Chain ${web3State.binding.chainId}`}</span>
                                    <span>Fecha: {new Date(web3State.binding.timestamp).toLocaleString()}</span>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                                <button
                                    onClick={handleGenerateQrCredential}
                                    disabled={isGeneratingQr}
                                    style={{
                                        flex: 2, padding: "10px 14px", background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        border: "none", borderRadius: "10px", color: "#000000", fontWeight: 900,
                                        fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                                        boxShadow: "0 0 15px rgba(0, 229, 255, 0.3)"
                                    }}
                                >
                                    {isGeneratingQr ? "⏳ Generando QR..." : "📱 VER CREDENCIAL QR OFF-GRID"}
                                </button>
                                <button
                                    onClick={handleBroadcastBinding}
                                    style={{
                                        flex: 1, padding: "10px 14px", background: "rgba(0, 229, 255, 0.15)",
                                        border: "1px solid rgba(0, 229, 255, 0.4)", borderRadius: "10px", color: "#00E5FF",
                                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px"
                                    }}
                                >
                                    📡 DIFUNDIR EN MALLA
                                </button>
                                <button
                                    onClick={handleUnlink}
                                    style={{
                                        padding: "10px 14px", background: "rgba(255, 51, 85, 0.1)",
                                        border: "1px solid rgba(255, 51, 85, 0.35)", borderRadius: "10px", color: "#FF3355",
                                        fontWeight: 900, fontSize: "0.78rem", cursor: "pointer"
                                    }}
                                >
                                    DESVINCULAR
                                </button>
                            </div>
                        </div>
                    )}

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

            {/* Modal QR Credencial Overlay */}
            {qrCredentialData && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 100000,
                        background: "rgba(4, 6, 14, 0.92)", backdropFilter: "blur(20px)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                    }}
                    onClick={() => setQrCredentialData(null)}
                >
                    <div
                        className="card-tactical animate-enter"
                        style={{
                            width: "100%", maxWidth: "440px", padding: "24px",
                            background: "linear-gradient(180deg, #0e1222 0%, #080a14 100%)",
                            border: "1.5px solid rgba(245, 132, 31, 0.5)",
                            textAlign: "center", display: "flex", flexDirection: "column", gap: "14px",
                            boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(245, 132, 31, 0.2)"
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: "2rem" }}>🦊</div>
                        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#FFF" }}>
                            Credencial Criptográfica Web3
                        </h3>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                            Atestación EIP-712 verificable off-grid entre RED DID y cuenta EVM.
                        </div>

                        <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                            <div style={{ padding: "12px", background: "#04060A", borderRadius: "16px", border: "2px solid rgba(245, 132, 31, 0.4)", boxShadow: "0 0 20px rgba(245, 132, 31, 0.25)" }}>
                                <img src={qrCredentialData.url} alt="QR Credencial Web3" style={{ width: "220px", height: "220px", display: "block", borderRadius: "8px" }} />
                            </div>
                        </div>

                        <div style={{
                            padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.5)",
                            border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.68rem",
                            fontFamily: "JetBrains Mono, monospace", color: "var(--accent-amber, #FFB300)",
                            wordBreak: "break-all", maxHeight: "70px", overflowY: "auto"
                        }}>
                            {qrCredentialData.payload}
                        </div>

                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                            <button
                                onClick={() => copyToClipboard(qrCredentialData.payload)}
                                style={{
                                    padding: "8px 12px", background: "rgba(245, 132, 31, 0.15)",
                                    border: "1px solid rgba(245, 132, 31, 0.4)", borderRadius: "8px",
                                    color: "#F5841F", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer",
                                    display: "inline-flex", alignItems: "center", gap: "6px"
                                }}
                            >
                                📋 COPIAR JSON
                            </button>
                            <a
                                href={qrCredentialData.url}
                                download="credencial_web3_red.png"
                                style={{
                                    textDecoration: "none",
                                    padding: "8px 12px", background: "rgba(0, 229, 255, 0.15)",
                                    border: "1px solid rgba(0, 229, 255, 0.4)", borderRadius: "8px",
                                    color: "#00E5FF", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer",
                                    display: "inline-flex", alignItems: "center", gap: "6px"
                                }}
                            >
                                💾 DESCARGAR PNG
                            </a>
                            {typeof navigator !== "undefined" && typeof (navigator as any).share === "function" && (
                                <button
                                    onClick={async () => {
                                        try {
                                            await navigator.share({
                                                title: "Credencial Web3 RED Sovereign",
                                                text: qrCredentialData.payload,
                                            });
                                        } catch {}
                                    }}
                                    style={{
                                        padding: "8px 12px", background: "rgba(255, 255, 255, 0.08)",
                                        border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "8px",
                                        color: "#FFFFFF", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer",
                                        display: "inline-flex", alignItems: "center", gap: "6px"
                                    }}
                                >
                                    📤 COMPARTIR
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setQrCredentialData(null)}
                            className="btn-tactical-primary"
                            style={{ padding: "12px", width: "100%", marginTop: "4px" }}
                        >
                            Cerrar Credencial
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

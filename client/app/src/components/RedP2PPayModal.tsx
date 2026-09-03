"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { getP2PWallet, createP2PVoucher, redeemP2PVoucher, P2PVoucher } from "../lib/api";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";
import { useTranslation } from "../lib/i18n/i18nEngine";

type WalletTab = "emit" | "redeem" | "ledger";

export const RedP2PPayModal: React.FC = () => {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const [balance, setBalance] = useState<number>(0);
    const [totalSpent, setTotalSpent] = useState<number>(0);
    const [vouchers, setVouchers] = useState<P2PVoucher[]>([]);
    const [amountInput, setAmountInput] = useState<string>("");
    const [recipientInput, setRecipientInput] = useState<string>("");
    const [redeemInput, setRedeemInput] = useState<string>("");
    const [activeQr, setActiveQr] = useState<string | null>(null);
    const [activeQrString, setActiveQrString] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<WalletTab>("emit");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const shouldScanRef = React.useRef<boolean>(false);

    const loadWallet = useCallback(async () => {
        try {
            const res = await getP2PWallet();
            if (res && res.ok) {
                setBalance(res.balance);
                if (res.wallet?.total_spent !== undefined) {
                    setTotalSpent(res.wallet.total_spent);
                }
                setVouchers(res.vouchers || []);
            }
        } catch {
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWallet();
        const interval = setInterval(loadWallet, 3000);
        return () => clearInterval(interval);
    }, [loadWallet]);

    const stopCamera = async () => {
        shouldScanRef.current = false;
        if (typeof document !== "undefined") {
            document.body.classList.remove("scanner-active");
        }
        setIsScanning(false);
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                await BarcodeScanner.showBackground().catch(() => {});
                await BarcodeScanner.stopScan().catch(() => {});
            }
        } catch {}
    };

    const handleStartQrScan = async () => {
        shouldScanRef.current = true;
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BarcodeScanner } = await import("@capacitor-community/barcode-scanner");
                const perm = await BarcodeScanner.checkPermission({ force: true });
                if (!shouldScanRef.current) {
                    await stopCamera();
                    return;
                }
                if (perm.denied || !perm.granted) {
                    toast.warning("Permiso de cámara denegado. Introduce el código manualmente.");
                    return;
                }

                await BarcodeScanner.hideBackground();
                if (!shouldScanRef.current) {
                    await stopCamera();
                    return;
                }
                document.body.classList.add("scanner-active");
                setIsScanning(true);

                const result = await BarcodeScanner.startScan();
                await stopCamera();
                if (result.hasContent) {
                    const scanned = result.content.trim();
                    setRedeemInput(scanned);
                    toast.success("Código QR escaneado con éxito");
                }
            } else {
                toast.info("Escaneo activo disponible en dispositivos Android nativos.");
            }
        } catch (err: any) {
            console.warn("[RedP2PPay] Error en escáner de cámara:", err);
            await stopCamera();
        }
    };

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const handleCreateVoucher = async () => {
        const val = parseFloat(amountInput);
        if (isNaN(val) || val <= 0) {
            toast.error("Ingresa un monto válido mayor a 0.");
            return;
        }
        if (val > balance) {
            toast.error("Saldo insuficiente en la bóveda off-grid.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createP2PVoucher({
                amount: val,
                recipient: recipientInput.trim() || undefined,
            });

            if (res && res.ok && res.voucher) {
                setBalance(res.new_balance);
                setVouchers(prev => [res.voucher, ...prev]);

                const qrString = `RED_PAY:${res.voucher.id}:${res.voucher.amount}:${res.voucher.signature}`;
                setActiveQrString(qrString);

                const dataUrl = await OfflineQrEngine.generateDataUrl(qrString, {
                    width: 260,
                    margin: 1,
                    darkColor: "#00E676",
                    lightColor: "#04060A"
                });
                setActiveQr(dataUrl);

                setAmountInput("");
                setRecipientInput("");
                toast.success(`💳 Vale P2P de ${val} créditos emitido y firmado por Rust.`);
            } else {
                toast.error(res.error || "Error al emitir vale.");
            }
        } catch (err: any) {
            toast.error(err.message || "Error de comunicación con el nodo Rust.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRedeemVoucher = async () => {
        const payload = redeemInput.trim();
        if (!payload) {
            toast.error("Pega o introduce la cadena QR del voucher.");
            return;
        }

        // Sanitización previa al dispatch hacia el nodo Rust
        if (payload.startsWith("RED_PAY:")) {
            const parts = payload.split(":");
            if (parts.length >= 4) {
                const amt = parseFloat(parts[2]);
                if (!isFinite(amt) || amt <= 0) {
                    toast.error("El voucher contiene un monto inválido o manipulado.");
                    return;
                }
            }
        }

        setIsSubmitting(true);
        try {
            const res = await redeemP2PVoucher({ qr_payload: payload });
            if (res && res.ok) {
                if (res.new_balance !== undefined && isFinite(res.new_balance)) {
                    setBalance(res.new_balance);
                }
                const v = res.voucher;
                if (v) {
                    setVouchers(prev => [v, ...prev]);
                }
                setRedeemInput("");
                toast.success(`🎉 ¡Vale de ${res.voucher?.amount || "fondos"} créditos canjeado con éxito en Rust!`);
                await loadWallet();
                setActiveTab("ledger");
            } else {
                toast.error(res.error || "Fallo en validación de firma o vale duplicado.");
            }
        } catch (err: any) {
            toast.error(err.message || "Error al procesar canje criptográfico.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success("Copiado al portapapeles");
        }
    };

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%", width: "100%",
            background: "linear-gradient(180deg, #050814 0%, #03050B 100%)",
            color: "#FFFFFF", fontFamily: "JetBrains Mono, monospace", overflow: "hidden"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "calc(8px + var(--safe-top, 0px)) 16px 8px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1.5px solid rgba(0, 230, 118, 0.35)",
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
                        background: "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 150, 80, 0.15) 100%)",
                        border: "1px solid rgba(0, 230, 118, 0.5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 0 15px rgba(0, 230, 118, 0.25)"
                    }}>💳</div>
                    <div>
                        <div style={{ fontSize: "0.98rem", fontWeight: 900, color: "#FFFFFF" }}>
                            RED P2P PAY · OFF-GRID CASH
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#00E676", fontWeight: 800 }}>
                            VALES DE TRUEQUE CIFRADOS CON ED25519
                        </div>
                    </div>
                </div>

                <div style={{
                    fontSize: "0.75rem", padding: "4px 10px", borderRadius: "8px",
                    background: "rgba(0, 230, 118, 0.15)", border: "1px solid rgba(0, 230, 118, 0.4)",
                    color: "#00E676", fontWeight: 900
                }}>
                    {balance.toLocaleString()} CRÉDITOS
                </div>
            </header>

            {/* Selector de Pestañas Segmentadas */}
            <div style={{
                display: "flex", padding: "8px 16px", gap: "6px",
                background: "rgba(8, 10, 20, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                flexShrink: 0
            }}>
                {[
                    { id: "emit", icon: "📤", label: "EMITIR VALE" },
                    { id: "redeem", icon: "📥", label: "CANJEAR VALE" },
                    { id: "ledger", icon: "📑", label: `LIBRO MAYOR (${vouchers.length})` }
                ].map(tab => {
                    const isSel = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as WalletTab)}
                            style={{
                                flex: 1, padding: "8px 12px", borderRadius: "10px",
                                background: isSel ? "linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(10, 35, 25, 0.85) 100%)" : "rgba(255, 255, 255, 0.03)",
                                border: isSel ? "1.5px solid #00E676" : "1px solid rgba(255, 255, 255, 0.08)",
                                color: isSel ? "#00E676" : "var(--text-secondary)",
                                fontWeight: isSel ? 900 : 700, fontSize: "0.76rem",
                                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                            }}
                        >
                            <span>{tab.icon}</span> <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* TAB 1: EMITIR VALE */}
                    {activeTab === "emit" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 230, 118, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px",
                            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E676" }}>
                                    EMISOR DE VALES DE TRUEQUE DIGITAL
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                    Crea un cheque portador firmado con la llave Ed25519 de tu nodo Rust, canjeable sin conexión.
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900 }}>CANTIDAD DE CRÉDITOS</label>
                                    <input
                                        type="number"
                                        value={amountInput}
                                        onChange={e => setAmountInput(e.target.value)}
                                        placeholder="Ej: 50, 100, 500..."
                                        style={{
                                            width: "100%", padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(0, 230, 118, 0.3)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.9rem", outline: "none", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontWeight: 900 }}>DESTINATARIO (OPCIONAL / AL PORTADOR)</label>
                                    <input
                                        value={recipientInput}
                                        onChange={e => setRecipientInput(e.target.value)}
                                        placeholder="DID o Hash del destinatario (dejar vacío para cheque al portador)..."
                                        style={{
                                            width: "100%", padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                            border: "1px solid rgba(255, 255, 255, 0.15)", borderRadius: "10px",
                                            color: "#FFFFFF", fontSize: "0.82rem", outline: "none"
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={handleCreateVoucher}
                                    disabled={isSubmitting || !amountInput}
                                    style={{
                                        padding: "12px", background: "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                                        border: "none", borderRadius: "12px", color: "#000000",
                                        fontWeight: 900, fontSize: "0.85rem", cursor: "pointer",
                                        boxShadow: "0 0 15px rgba(0, 230, 118, 0.35)"
                                    }}
                                >
                                    {isSubmitting ? "Emitiendo y firmando en Rust..." : "⚡ EMITIR VALE CIFRADO"}
                                </button>
                            </div>

                            {activeQr && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                                    <img src={activeQr} alt="QR Vale" style={{ width: 220, height: 220, borderRadius: "12px", border: "2px solid #00E676" }} />
                                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textAlign: "center" }}>
                                        Muestra este código QR para que el receptor lo escanee y canjee los fondos.
                                    </div>
                                    {activeQrString && (
                                        <button
                                            onClick={() => copyToClipboard(activeQrString)}
                                            style={{
                                                padding: "6px 14px", background: "rgba(0, 230, 118, 0.15)",
                                                border: "1px solid rgba(0, 230, 118, 0.4)", borderRadius: "8px",
                                                color: "#00E676", fontSize: "0.72rem", fontWeight: 900, cursor: "pointer"
                                            }}
                                        >
                                            COPIAR CADENA CRIPTOGRÁFICA
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: CANJEAR VALE */}
                    {activeTab === "redeem" && (
                        <div style={{
                            background: "linear-gradient(180deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 8, 20, 0.98) 100%)",
                            border: "1.5px solid rgba(0, 229, 255, 0.35)", borderRadius: "22px", padding: "20px",
                            display: "flex", flexDirection: "column", gap: "16px"
                        }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00E5FF" }}>
                                    CANJE DE VALE CIFRADO
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                                    Pega la cadena RED_PAY:... recibida de otro operador para acreditarla en tu saldo local.
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <button
                                    onClick={handleStartQrScan}
                                    style={{
                                        padding: "12px", background: "rgba(0, 229, 255, 0.15)",
                                        border: "1.5px dashed #00E5FF", borderRadius: "12px",
                                        color: "#00E5FF", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                                    }}
                                >
                                    📷 ESCANEAR CÓDIGO QR CON LA CÁMARA
                                </button>

                                <textarea
                                    value={redeemInput}
                                    onChange={e => setRedeemInput(e.target.value)}
                                    placeholder="Pega la cadena RED_PAY:id:monto:firma..."
                                    rows={3}
                                    style={{
                                        padding: "10px 14px", background: "rgba(0, 0, 0, 0.5)",
                                        border: "1px solid rgba(0, 229, 255, 0.3)", borderRadius: "10px",
                                        color: "#FFFFFF", fontSize: "0.82rem", outline: "none", fontFamily: "JetBrains Mono, monospace"
                                    }}
                                />

                                {redeemInput.startsWith("RED_PAY:") && (
                                    <div style={{
                                        padding: "10px 14px", background: "rgba(0, 230, 118, 0.12)",
                                        border: "1px solid rgba(0, 230, 118, 0.4)", borderRadius: "10px",
                                        display: "flex", flexDirection: "column", gap: "4px"
                                    }}>
                                        <div style={{ fontSize: "0.68rem", color: "#00E676", fontWeight: 800 }}>
                                            ✓ FORMATO DE VALE RED VÁLIDO DETECTADO:
                                        </div>
                                        <div style={{ fontSize: "0.82rem", color: "#FFFFFF", fontWeight: 900 }}>
                                            Monto a recibir: +{redeemInput.split(":")[2] || "0"} créditos
                                        </div>
                                        <div style={{ fontSize: "0.62rem", color: "#AAA", fontFamily: "monospace" }}>
                                            ID: {redeemInput.split(":")[1] || "N/A"}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleRedeemVoucher}
                                    disabled={isSubmitting || !redeemInput.trim()}
                                    style={{
                                        padding: "12px", background: "linear-gradient(135deg, #00E5FF 0%, #00897B 100%)",
                                        border: "none", borderRadius: "12px", color: "#000000",
                                        fontWeight: 900, fontSize: "0.85rem", cursor: "pointer",
                                        boxShadow: "0 0 15px rgba(0, 229, 255, 0.35)"
                                    }}
                                >
                                    {isSubmitting ? "Validando firma en Rust..." : "🎉 CANJEAR Y ACREDITAR FONDOS"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: LIBRO MAYOR DE VALES */}
                    {activeTab === "ledger" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {vouchers.length === 0 ? (
                                <div style={{
                                    textAlign: "center", padding: "30px 16px",
                                    background: "rgba(14, 18, 38, 0.9)", borderRadius: "18px",
                                    border: "1px dashed rgba(255, 255, 255, 0.12)"
                                }}>
                                    <div style={{ fontSize: "2rem", marginBottom: "6px" }}>📑</div>
                                    <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#FFFFFF" }}>
                                        Sin Transacciones en el Libro Mayor
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                                        Emite o canjea vales para ver el historial de transacciones locales.
                                    </div>
                                </div>
                            ) : (
                                vouchers.map(v => (
                                    <div
                                        key={v.id}
                                        style={{
                                            padding: "14px 16px", borderRadius: "14px",
                                            background: "linear-gradient(135deg, rgba(16, 22, 44, 0.9) 0%, rgba(8, 12, 28, 0.95) 100%)",
                                            border: `1px solid ${v.is_redeemed ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 230, 118, 0.3)'}`,
                                            display: "flex", justifyContent: "space-between", alignItems: "center"
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: "0.92rem", fontWeight: 900, color: "#FFFFFF" }}>
                                                {v.amount} CRÉDITOS · ID: {v.id.substring(0, 10)}…
                                            </div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>
                                                {new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: "0.65rem", fontWeight: 900, padding: "3px 8px", borderRadius: "6px",
                                            background: v.is_redeemed ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 230, 118, 0.15)",
                                            color: v.is_redeemed ? "var(--text-secondary)" : "#00E676",
                                            border: `1px solid ${v.is_redeemed ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 230, 118, 0.4)'}`
                                        }}>
                                            {v.is_redeemed ? "CANJEADO" : "VÁLIDO (DISPONIBLE)"}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
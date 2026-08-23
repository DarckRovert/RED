"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { getP2PWallet, createP2PVoucher, redeemP2PVoucher, P2PVoucher } from "../lib/api";
import { useTranslation } from "../lib/i18n/i18nEngine";

type WalletTab = "emit" | "redeem" | "ledger";

export const RedP2PPayModal: React.FC = () => {
    const { navigate } = useRedStore();
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

    // 1. Cargar saldo real e historial de vouchers desde el nodo Rust
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
            // Silencioso en reintentos periódicos
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWallet();
        const interval = setInterval(loadWallet, 3000);
        return () => clearInterval(interval);
    }, [loadWallet]);

    // 2. Emitir Voucher Criptográfico Real firmado por el nodo Rust
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

                // Generar QR interoperable con la firma criptográfica Ed25519 real
                const qrString = `RED_PAY:${res.voucher.id}:${res.voucher.amount}:${res.voucher.signature}`;
                setActiveQrString(qrString);

                try {
                    const QRCode = await import("qrcode");
                    const dataUrl = await QRCode.toDataURL(qrString, {
                        width: 260, margin: 1,
                        color: { dark: "#00E676", light: "#04060A" }
                    });
                    setActiveQr(dataUrl);
                } catch {
                    setActiveQr(`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrString)}&color=00e676&bgcolor=04060a`);
                }

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

    // 3. Canjear Voucher P2P recibido (escaneado o pegado)
    const handleRedeemVoucher = async () => {
        const payload = redeemInput.trim();
        if (!payload) {
            toast.error("Pega o introduce la cadena QR del voucher.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await redeemP2PVoucher({ qr_payload: payload });
            if (res && res.ok) {
                if (res.new_balance !== undefined) setBalance(res.new_balance);
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

    const pasteFromClipboard = async () => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    setRedeemInput(text);
                    toast.info("Cadena pegada del portapapeles");
                }
            } catch {
                toast.error("No se pudo leer el portapapeles");
            }
        }
    };

    const setQuickAmount = (val: number) => {
        setAmountInput(val.toString());
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
                        background: "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,230,118,0.35)"
                    }}>💳</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Pagos Soberanos P2P & Vouchers
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            ED25519 SIGNED · ZERO-KNOWLEDGE OFFLINE · SLED PERSISTED
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate("sidebar")}
                    className="btn-icon"
                    title="Cerrar pagos"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Tarjeta Metálica de Saldo Soberano */}
            <div style={{ padding: "16px 20px 6px 20px", flexShrink: 0 }}>
                <div
                    className="card-tactical-glow-emerald"
                    style={{
                        padding: "18px 20px",
                        background: "linear-gradient(145deg, rgba(14, 30, 24, 0.85), rgba(8, 16, 12, 0.95))",
                        borderRadius: "var(--radius-lg)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        border: "1px solid rgba(0, 230, 118, 0.4)",
                        boxShadow: "0 10px 30px rgba(0, 230, 118, 0.15)"
                    }}
                >
                    <div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 700 }}>
                            Saldo Soberano en Bóveda Off-Grid
                        </div>
                        <div style={{ fontSize: "1.8rem", fontWeight: 900, fontFamily: "JetBrains Mono, monospace", color: "#fff", display: "flex", alignItems: "baseline", gap: "6px", marginTop: "2px" }}>
                            <span>{isLoading ? "..." : balance.toFixed(2)}</span>
                            <span style={{ fontSize: "0.9rem", color: "var(--accent-emerald)", fontWeight: 800 }}>CRÉDITOS RED</span>
                        </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                        <span className="badge-tactical badge-tactical-emerald">SLED WALLET</span>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Emitido: {totalSpent.toFixed(2)} RED
                        </div>
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas Segmentadas Tácticas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("emit")}
                    className={activeTab === "emit" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    💳 {t.pay_module?.issue_voucher || "Emitir Vale"}
                </button>
                <button
                    onClick={() => setActiveTab("redeem")}
                    className={activeTab === "redeem" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📥 {t.pay_module?.redeem_voucher || "Canjear Vale"}
                </button>
                <button
                    onClick={() => setActiveTab("ledger")}
                    className={activeTab === "ledger" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)", whiteSpace: "nowrap" }}
                >
                    📜 {t.pay_module?.tx_history || "Libro Contable"} ({vouchers.length})
                </button>
            </div>

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: EMITIR VALE CRIPTOGRÁFICO ─────────────────────── */}
                    {activeTab === "emit" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                    💳 Emisión de Vale Criptográfico Offline
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Firma digitalmente el vale con tu clave privada Ed25519 para intercambio sin conexión
                                </div>
                            </div>

                            {/* Monto y Botones Rápidos */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    MONTO A TRANSFERIR:
                                </label>
                                <input
                                    type="number"
                                    value={amountInput}
                                    onChange={e => setAmountInput(e.target.value)}
                                    placeholder="0.00 Créditos"
                                    style={{ fontSize: "1.2rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace" }}
                                />

                                <div style={{ display: "flex", gap: "6px" }}>
                                    {[10, 25, 50, 100].map((num) => (
                                        <button
                                            key={num}
                                            onClick={() => setQuickAmount(num)}
                                            className="btn-tactical-secondary"
                                            style={{ flex: 1, padding: "6px", fontSize: "0.76rem", fontFamily: "JetBrains Mono, monospace" }}
                                        >
                                            +{num}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setQuickAmount(balance)}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "6px 12px", fontSize: "0.76rem", color: "var(--accent-emerald)" }}
                                    >
                                        MAX
                                    </button>
                                </div>
                            </div>

                            {/* Destinatario Opcional */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    DESTINATARIO (OPCIONAL / ANÓNIMO):
                                </label>
                                <input
                                    value={recipientInput}
                                    onChange={e => setRecipientInput(e.target.value)}
                                    placeholder="Nombre o Hash del destinatario"
                                />
                            </div>

                            {/* Botón de Emisión */}
                            <button
                                onClick={handleCreateVoucher}
                                disabled={isSubmitting || parseFloat(amountInput) <= 0 || parseFloat(amountInput) > balance}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.95rem", background: "linear-gradient(135deg, #00E676 0%, #00B359 100%)", color: "#000" }}
                            >
                                {isSubmitting ? "Firmando con Ed25519..." : "⚡ GENERAR VALE FIRMADO EN RUST"}
                            </button>

                            {/* Código QR Resultante */}
                            {activeQr && (
                                <div className="card-tactical animate-pop" style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", background: "rgba(0,0,0,0.65)" }}>
                                    <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                        ✅ Código QR de Pago Listo para Escaneo
                                    </div>
                                    <div style={{ padding: "12px", background: "#04060A", borderRadius: "12px", border: "2px solid rgba(0,230,118,0.4)" }}>
                                        <img src={activeQr} alt="QR de Pago" style={{ width: "240px", height: "240px", display: "block" }} />
                                    </div>

                                    {activeQrString && (
                                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                                            <input
                                                readOnly
                                                value={activeQrString}
                                                style={{ flex: 1, fontSize: "0.74rem", fontFamily: "JetBrains Mono, monospace", background: "rgba(0,0,0,0.5)" }}
                                            />
                                            <button
                                                onClick={() => copyToClipboard(activeQrString)}
                                                className="btn-tactical-secondary"
                                                style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                                            >
                                                📋 Copiar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TAB 2: CANJEAR VALE RECIBIDO ─────────────────────────── */}
                    {activeTab === "redeem" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    📥 Canje de Vales Criptográficos P2P
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Verifica la firma Ed25519 del emisor y añade los créditos a tu saldo local
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CADENA CRIPTOGRÁFICA DEL VOUCHER:
                                </label>
                                <textarea
                                    value={redeemInput}
                                    onChange={e => setRedeemInput(e.target.value)}
                                    rows={4}
                                    placeholder="RED_PAY:VOUCHER_ID:AMOUNT:SIGNATURE..."
                                    style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.82rem" }}
                                />

                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                        onClick={pasteFromClipboard}
                                        className="btn-tactical-secondary"
                                        style={{ flex: 1, padding: "8px" }}
                                    >
                                        📋 Pegar del Portapapeles
                                    </button>
                                    <button
                                        onClick={() => setRedeemInput("")}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "8px 16px" }}
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleRedeemVoucher}
                                disabled={isSubmitting || !redeemInput.trim()}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "14px", fontSize: "0.95rem", background: "linear-gradient(135deg, #00E5FF 0%, #0284C7 100%)", color: "#000" }}
                            >
                                {isSubmitting ? "Verificando en Rust..." : "🔓 VALIDAR FIRMA Y ACREDITAR SALDO"}
                            </button>
                        </div>
                    )}

                    {/* ─── TAB 3: LIBRO CONTABLE ───────────────────────────────── */}
                    {activeTab === "ledger" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                        📜 Libro Mayor de Transacciones
                                    </div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                        Historial de vales emitidos, canjeados y recibidos en Sled DB
                                    </div>
                                </div>
                                <span className="badge-tactical badge-tactical-emerald">AUDITED</span>
                            </div>

                            {vouchers.length === 0 ? (
                                <div className="empty-state-tactical">
                                    <div className="empty-state-icon">💳</div>
                                    <div className="empty-state-title">Sin Transacciones Aún</div>
                                    <div className="empty-state-desc">
                                        No has emitido ni canjeado vales criptográficos en esta sesión.
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {vouchers.map((v) => (
                                        <div
                                            key={v.id}
                                            className="card-tactical"
                                            style={{
                                                padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                                                borderLeft: v.is_outgoing ? "4px solid var(--accent-crimson)" : "4px solid var(--accent-emerald)"
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <strong style={{ fontSize: "0.92rem", fontFamily: "JetBrains Mono, monospace", color: v.is_outgoing ? "var(--accent-crimson-bright)" : "var(--accent-emerald)" }}>
                                                        {v.is_outgoing ? `- ${v.amount.toFixed(2)}` : `+ ${v.amount.toFixed(2)}`} RED
                                                    </strong>
                                                    <span className={`badge-tactical ${v.is_outgoing ? "badge-tactical-crimson" : "badge-tactical-emerald"}`}>
                                                        {v.is_outgoing ? "EMISIÓN" : "CANJEADO"}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", fontFamily: "JetBrains Mono, monospace" }}>
                                                    ID: {(v.id || v.voucher_id || "").substring(0, 18)}… · {new Date(v.timestamp || (v.created_at ? v.created_at * 1000 : Date.now())).toLocaleDateString()}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    const str = `RED_PAY:${v.id || v.voucher_id}:${v.amount}:${v.signature || ""}`;
                                                    copyToClipboard(str);
                                                }}
                                                className="btn-icon"
                                                title="Copiar cadena de firma"
                                                style={{ width: 32, height: 32 }}
                                            >
                                                📋
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
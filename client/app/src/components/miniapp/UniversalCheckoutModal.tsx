"use client";

import React, { useState } from 'react';
import { PaymentIntentRequest, PaymentReceipt, PaymentRail } from '../../lib/miniapp/RedSDKTypes';
import { redPaymentGateway } from '../../lib/miniapp/RedPaymentGatewayEngine';
import { Web3BridgeEngine } from '../../lib/network/Web3BridgeEngine';
import { MonetizationEngine } from '../../lib/network/MonetizationEngine';
import { toast } from '../Toast';

interface UniversalCheckoutModalProps {
    intent: PaymentIntentRequest;
    buyerDid: string;
    onClose: () => void;
    onSuccess: (receipt: PaymentReceipt) => void;
}

export const UniversalCheckoutModal: React.FC<UniversalCheckoutModalProps> = ({
    intent,
    buyerDid,
    onClose,
    onSuccess,
}) => {
    const supportedRails = intent.supportedRails && intent.supportedRails.length > 0
        ? intent.supportedRails
        : (['paypal', 'web3_usdt', 'lightning', 'offgrid_voucher'] as PaymentRail[]);

    const [selectedRail, setSelectedRail] = useState<PaymentRail>(supportedRails[0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [completedReceipt, setCompletedReceipt] = useState<PaymentReceipt | null>(null);

    const userCredits = MonetizationEngine.getProStatus().credits;
    const web3State = Web3BridgeEngine.getInstance().getState();

    const handleConfirmPayment = async () => {
        setIsProcessing(true);
        setErrorMsg(null);

        try {
            let receipt: PaymentReceipt;

            switch (selectedRail) {
                case 'paypal':
                    receipt = await redPaymentGateway.executePayPalPayment(intent, buyerDid);
                    break;
                case 'web3_usdt':
                    receipt = await redPaymentGateway.executeWeb3Payment(intent, buyerDid);
                    break;
                case 'lightning':
                    receipt = await redPaymentGateway.executeLightningPayment(intent, buyerDid);
                    break;
                case 'offgrid_voucher':
                    receipt = await redPaymentGateway.executeOffgridVoucherPayment(intent, buyerDid);
                    break;
                default:
                    throw new Error("Riel de pago no soportado.");
            }

            setIsProcessing(false);
            setCompletedReceipt(receipt);
            toast.success("✅ ¡Pago procesado y firmado criptográficamente!");
        } catch (err: any) {
            setIsProcessing(false);
            setErrorMsg(err.message || "Error al procesar el pago.");
        }
    };

    const handleCopyTxHash = () => {
        if (!completedReceipt) return;
        navigator.clipboard.writeText(completedReceipt.transactionId);
        toast.info("📋 Hash de transacción copiado al portapapeles.");
    };

    const handleDownloadReceipt = () => {
        if (!completedReceipt) return;
        const blob = new Blob([JSON.stringify(completedReceipt, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recibo_red_${completedReceipt.transactionId.slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

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
                padding: "12px",
                userSelect: "none"
            }}
        >
            <div 
                style={{
                    width: "100%",
                    maxWidth: "460px",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 16px 50px rgba(0,0,0,0.85), 0 0 30px rgba(0, 230, 118, 0.15)",
                    display: "flex",
                    flexDirection: "column",
                    border: "1.5px solid rgba(0, 230, 118, 0.35)",
                    background: "linear-gradient(180deg, rgba(14,16,30,0.98) 0%, rgba(8,10,18,0.99) 100%)"
                }}
            >
                {/* ── HEADER DE PASARELA MULTI-RAIL ── */}
                <div style={{ padding: "14px 16px", background: "rgba(6, 8, 16, 0.95)", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, rgba(0,230,118,0.2) 0%, rgba(0,229,255,0.2) 100%)", border: "1px solid rgba(0,230,118,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", boxShadow: "0 0 12px rgba(0,230,118,0.2)" }}>
                            💳
                        </div>
                        <div>
                            <h3 style={{ fontSize: "0.85rem", fontWeight: 900, color: "#FFFFFF", letterSpacing: "0.5px", textTransform: "uppercase", margin: 0 }}>
                                TERMINAL DE PAGOS MULTI-RAIL
                            </h3>
                            <p style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", margin: "2px 0 0 0" }}>
                                RED Sovereign Checkout v66
                            </p>
                        </div>
                    </div>
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
                </div>

                {/* ── ESTADO: RECIBO CRIPTOGRÁFICO FINAL ── */}
                {completedReceipt ? (
                    <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "14px" }}>
                        <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "rgba(0, 230, 118, 0.2)", border: "2px solid var(--accent-emerald)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", boxShadow: "0 0 25px rgba(0,230,118,0.4)" }}>
                            ✅
                        </div>

                        <div>
                            <h4 style={{ fontSize: "1rem", fontWeight: 900, color: "#FFFFFF", margin: 0 }}>¡PAGO VERIFICADO EN MALLA!</h4>
                            <p style={{ fontSize: "0.75rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", margin: "4px 0 0 0" }}>Firma Ed25519 Validada</p>
                        </div>

                        <div style={{ width: "100%", background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "14px", padding: "12px", textAlign: "left", fontFamily: "JetBrains Mono, monospace", fontSize: "0.72rem", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", paddingBottom: "4px" }}>
                                <span style={{ color: "var(--text-muted)" }}>Concepto:</span>
                                <span style={{ color: "#FFFFFF", fontWeight: 800 }}>{intent.title}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", paddingBottom: "4px" }}>
                                <span style={{ color: "var(--text-muted)" }}>Monto:</span>
                                <span style={{ color: "var(--accent-emerald)", fontWeight: 900 }}>${completedReceipt.amount.toFixed(2)} {completedReceipt.currency}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255, 255, 255, 0.06)", paddingBottom: "4px" }}>
                                <span style={{ color: "var(--text-muted)" }}>Riel:</span>
                                <span style={{ color: "var(--accent-cyan)", textTransform: "uppercase", fontWeight: 800 }}>{completedReceipt.rail}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ color: "var(--text-muted)" }}>Tx Hash:</span>
                                <span style={{ color: "var(--text-secondary)", fontSize: "0.65rem", wordBreak: "break-all", background: "rgba(255,255,255,0.04)", padding: "6px", borderRadius: "6px" }}>{completedReceipt.transactionId}</span>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <button
                                type="button"
                                onClick={handleCopyTxHash}
                                style={{ flex: 1, padding: "8px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#FFFFFF", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer" }}
                            >
                                📋 Copiar Hash
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadReceipt}
                                style={{ flex: 1, padding: "8px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.12)", color: "#FFFFFF", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer" }}
                            >
                                💾 Guardar JSON
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => onSuccess(completedReceipt)}
                            style={{
                                width: "100%",
                                padding: "10px",
                                background: "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
                                color: "#000000",
                                fontWeight: 900,
                                borderRadius: "12px",
                                fontSize: "0.82rem",
                                border: "none",
                                cursor: "pointer",
                                boxShadow: "0 0 16px rgba(0, 230, 118, 0.35)"
                            }}
                        >
                            ✓ CONTINUAR A LA MINI-APP
                        </button>
                    </div>
                ) : (
                    /* ── ESTADO: FORMULARIO DE SELECCIÓN DE RIEL ── */
                    <>
                        {/* Intent Summary Box */}
                        <div style={{ padding: "14px 16px", background: "rgba(0, 0, 0, 0.4)", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h4 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#FFFFFF", margin: 0 }}>{intent.title}</h4>
                                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>{intent.description || 'Comercio Descentralizado RED'}</p>
                                <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", margin: "4px 0 0 0" }}>Comercio: {intent.merchant.name}</p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-emerald)" }}>
                                    ${intent.amount.toFixed(2)}
                                </div>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase", fontFamily: "JetBrains Mono, monospace", fontWeight: 800 }}>{intent.currency}</span>
                            </div>
                        </div>

                        {/* Rail Selector Grid */}
                        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>SELECCIONA RIEL DE PAGO:</label>
                            
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                {supportedRails.includes('paypal') && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRail('paypal')}
                                        style={{
                                            padding: "10px",
                                            borderRadius: "12px",
                                            border: selectedRail === 'paypal' ? "1.5px solid #3B82F6" : "1px solid rgba(255, 255, 255, 0.1)",
                                            background: selectedRail === 'paypal' ? "rgba(59, 130, 246, 0.2)" : "rgba(0, 0, 0, 0.4)",
                                            color: "#FFFFFF",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-start",
                                            gap: "2px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        <span style={{ fontSize: "0.78rem", fontWeight: 800 }}>💳 PayPal / Tarjeta</span>
                                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>USD / Fiat Directo</span>
                                    </button>
                                )}

                                {supportedRails.includes('web3_usdt') && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRail('web3_usdt')}
                                        style={{
                                            padding: "10px",
                                            borderRadius: "12px",
                                            border: selectedRail === 'web3_usdt' ? "1.5px solid #A855F7" : "1px solid rgba(255, 255, 255, 0.1)",
                                            background: selectedRail === 'web3_usdt' ? "rgba(168, 85, 247, 0.2)" : "rgba(0, 0, 0, 0.4)",
                                            color: "#FFFFFF",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-start",
                                            gap: "2px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        <span style={{ fontSize: "0.78rem", fontWeight: 800 }}>🦊 Web3 USDT/POL</span>
                                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Polygon / EVM</span>
                                    </button>
                                )}

                                {supportedRails.includes('lightning') && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRail('lightning')}
                                        style={{
                                            padding: "10px",
                                            borderRadius: "12px",
                                            border: selectedRail === 'lightning' ? "1.5px solid #F59E0B" : "1px solid rgba(255, 255, 255, 0.1)",
                                            background: selectedRail === 'lightning' ? "rgba(245, 158, 11, 0.2)" : "rgba(0, 0, 0, 0.4)",
                                            color: "#FFFFFF",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-start",
                                            gap: "2px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        <span style={{ fontSize: "0.78rem", fontWeight: 800 }}>⚡ Lightning</span>
                                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Sats Instantáneos</span>
                                    </button>
                                )}

                                {supportedRails.includes('offgrid_voucher') && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRail('offgrid_voucher')}
                                        style={{
                                            padding: "10px",
                                            borderRadius: "12px",
                                            border: selectedRail === 'offgrid_voucher' ? "1.5px solid var(--accent-emerald)" : "1px solid rgba(255, 255, 255, 0.1)",
                                            background: selectedRail === 'offgrid_voucher' ? "rgba(0, 230, 118, 0.2)" : "rgba(0, 0, 0, 0.4)",
                                            color: "#FFFFFF",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-start",
                                            gap: "2px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        <span style={{ fontSize: "0.78rem", fontWeight: 800 }}>🎟️ Vale Off-Grid</span>
                                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>100% Sin Internet</span>
                                    </button>
                                )}
                            </div>

                            {/* Rail Context Details Box */}
                            <div style={{ padding: "12px", background: "rgba(0, 0, 0, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", fontSize: "0.75rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                                {selectedRail === 'paypal' && (
                                    <div>
                                        <p style={{ color: "#FFFFFF", fontWeight: 800, margin: 0 }}>Pasarela Fiat / PayPal</p>
                                        <p style={{ color: "var(--text-secondary)", fontSize: "0.72rem", margin: "2px 0 0 0" }}>
                                            Destino: <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#60A5FA" }}>@{intent.merchant.paypalUsername || 'redmesh'}</span>
                                        </p>
                                    </div>
                                )}

                                {selectedRail === 'web3_usdt' && (
                                    <div>
                                        <p style={{ color: "#FFFFFF", fontWeight: 800, margin: 0 }}>Transferencia Cripto EVM (USDT / POL)</p>
                                        <p style={{ color: "var(--text-secondary)", fontSize: "0.68rem", wordBreak: "break-all", margin: "2px 0 0 0" }}>
                                            Billetera: <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#C084FC" }}>{intent.merchant.evmAddress || '0x71C836eB3f4D4e05bE7728373b9846b41295b364'}</span>
                                        </p>
                                    </div>
                                )}

                                {selectedRail === 'lightning' && (
                                    <div>
                                        <p style={{ color: "#FFFFFF", fontWeight: 800, margin: 0 }}>Factura Bitcoin Lightning Network</p>
                                        <p style={{ color: "var(--text-secondary)", fontSize: "0.72rem", margin: "2px 0 0 0" }}>
                                            Monto Estimado: <span style={{ color: "var(--accent-amber)", fontWeight: 900 }}>~{Math.round(intent.amount * 1500)} SAT</span>
                                        </p>
                                    </div>
                                )}

                                {selectedRail === 'offgrid_voucher' && (
                                    <div>
                                        <p style={{ color: "#FFFFFF", fontWeight: 800, margin: 0 }}>Pagaré Criptográfico Off-Grid (Ed25519)</p>
                                        <p style={{ color: "var(--text-secondary)", fontSize: "0.72rem", margin: "2px 0 0 0" }}>
                                            Tu Saldo Local: <span style={{ color: "var(--accent-emerald)", fontWeight: 900 }}>{userCredits} Créditos</span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {errorMsg && (
                                <div style={{ padding: "8px 12px", background: "rgba(232, 33, 58, 0.2)", border: "1px solid var(--accent-crimson)", borderRadius: "10px", color: "#FF8599", fontSize: "0.75rem" }}>
                                    ⚠️ {errorMsg}
                                </div>
                            )}
                        </div>

                        {/* Footer Confirm Buttons */}
                        <div style={{ padding: "14px 16px", background: "rgba(6, 8, 16, 0.95)", borderTop: "1px solid rgba(255, 255, 255, 0.12)", display: "flex", gap: "8px" }}>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isProcessing}
                                style={{ flex: 1, padding: "10px", background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.14)", borderRadius: "12px", color: "var(--text-secondary)", fontSize: "0.78rem", fontWeight: 800, cursor: "pointer" }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                disabled={isProcessing}
                                style={{
                                    flex: 1,
                                    padding: "10px",
                                    background: "linear-gradient(135deg, #00E676 0%, #00E5FF 100%)",
                                    color: "#000000",
                                    fontWeight: 900,
                                    borderRadius: "12px",
                                    fontSize: "0.78rem",
                                    border: "none",
                                    cursor: "pointer",
                                    boxShadow: "0 0 16px rgba(0, 230, 118, 0.35)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "6px"
                                }}
                            >
                                {isProcessing ? (
                                    <>
                                        <span style={{ fontSize: "0.85rem" }}>🔄</span>
                                        <span>Procesando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>CONFIRMAR PAGO</span>
                                        <span>➔</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

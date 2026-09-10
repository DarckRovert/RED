"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { TacticalProduct } from '../lib/network/MonetizationEngine';
import { PaymentReceipt, PaymentRail, SovereignPaymentPassport } from '../lib/miniapp/RedSDKTypes';
import { redPaymentGateway, ERC20_STABLECOINS, isValidEvmAddress, buildDeepLink } from '../lib/miniapp/RedPaymentGatewayEngine';
import { Web3BridgeEngine } from '../lib/network/Web3BridgeEngine';
import { OfflineQrEngine } from '../lib/qr/OfflineQrEngine';
import { BackHandlerRegistry } from '../lib/navigation/BackHandlerRegistry';
import { TacticalAudioEngine } from '../lib/audio/TacticalAudioEngine';
import { toast } from './Toast';
import { useRedStore } from '../store/useRedStore';
import { TacIcon } from './ui/TacIcon';

interface MultiRailCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: TacticalProduct;
    onSuccess?: (receipt: PaymentReceipt) => void;
}

type CheckoutTab = 'web3' | 'fiat' | 'lightning' | 'voucher';

export const MultiRailCheckoutModal: React.FC<MultiRailCheckoutModalProps> = ({
    isOpen,
    onClose,
    product,
    onSuccess
}) => {
    const { identity } = useRedStore();
    const passport: SovereignPaymentPassport | undefined = product.sellerPaymentPassport;

    // Parse numeric price from priceEst (e.g. "~$38 USD" -> 38)
    const numericPrice = useMemo(() => {
        const match = product.priceEst.match(/\d+(\.\d+)?/);
        const val = match ? parseFloat(match[0]) : 10;
        return isFinite(val) && val > 0 ? val : 10;
    }, [product.priceEst]);

    // Initial default tab
    const [activeTab, setActiveTab] = useState<CheckoutTab>('fiat');
    const [selectedChainId, setSelectedChainId] = useState<number>(passport?.preferredChainId || 137);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // QR State
    const [evmQrUrl, setEvmQrUrl] = useState<string>('');
    const [lnQrUrl, setLnQrUrl] = useState<string>('');
    const [voucherQrUrl, setVoucherQrUrl] = useState<string>('');
    const [voucherCode, setVoucherCode] = useState<string>('');

    // Web3 State
    const [web3State, setWeb3State] = useState(Web3BridgeEngine.getInstance().getState());

    // ── LIFO Hardware Back Navigation ───────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        return BackHandlerRegistry.register(() => {
            TacticalAudioEngine.playTap();
            onClose();
            return true;
        });
    }, [isOpen, onClose]);

    // Subscribe to Web3 Bridge state changes
    useEffect(() => {
        if (!isOpen) return;
        const unsub = Web3BridgeEngine.getInstance().subscribe(state => setWeb3State(state));
        return () => unsub();
    }, [isOpen]);

    // Generate QRs on mount or tab change
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const generateQrs = async () => {
            // 1. EVM QR
            const evmTarget = passport?.evmAddress || '';
            if (isValidEvmAddress(evmTarget)) {
                try {
                    const qr = await OfflineQrEngine.generateDataUrl(`ethereum:${evmTarget}`, {
                        width: 240,
                        darkColor: "#00E5FF",
                        lightColor: "#060913"
                    });
                    if (isMounted) setEvmQrUrl(qr);
                } catch {}
            }

            // 2. Lightning QR
            const lnTarget = passport?.lightningAddress || 'merchant@getalby.com';
            try {
                const qr = await OfflineQrEngine.generateDataUrl(`lightning:${lnTarget}`, {
                    width: 240,
                    darkColor: "#FFB300",
                    lightColor: "#060913"
                });
                if (isMounted) setLnQrUrl(qr);
            } catch {}
        };

        generateQrs();
        return () => { isMounted = false; };
    }, [isOpen, passport]);

    if (!isOpen) return null;

    const copyText = async (text: string, label = "Copiado al portapapeles") => {
        TacticalAudioEngine.playMessageSent();
        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                toast.success(label);
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
            toast.success(label);
        } catch {
            toast.error("No se pudo copiar automáticamente");
        }
    };

    // ── Pay with Web3 Connected Wallet ──────────────────────────────────────
    const handlePayWithWeb3 = async () => {
        const evmTarget = passport?.evmAddress;
        if (!isValidEvmAddress(evmTarget)) {
            toast.error("El vendedor no tiene una dirección EVM 0x válida registrada.");
            return;
        }

        setIsProcessing(true);
        try {
            const receipt = await redPaymentGateway.executeWeb3Payment({
                title: product.title,
                description: product.description,
                amount: numericPrice,
                currency: selectedChainId === 8453 ? 'USD' : 'USD',
                merchant: {
                    name: product.authorName || 'Vendedor RED',
                    did: product.authorHash || 'did:red:merchant',
                    evmAddress: evmTarget,
                    paymentPassport: {
                        ...passport,
                        preferredChainId: selectedChainId,
                        acceptsVouchers: true,
                        isPublicOnMesh: false
                    }
                },
                supportedRails: ['web3_usdt']
            }, identity?.identity_hash || 'did:red:anonymous');

            TacticalAudioEngine.playRogerBeep();
            toast.success(`✅ Pago transmitido: ${receipt.transactionId.substring(0, 16)}...`);
            if (onSuccess) onSuccess(receipt);
            onClose();
        } catch (err: any) {
            TacticalAudioEngine.playWarning();
            toast.error(err?.message || "Error al procesar el pago Web3");
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Open Fiat Banking App / Link ────────────────────────────────────────
    const handleOpenFiatApp = () => {
        const fiatType = passport?.fiatType || 'yape';
        const identifier = passport?.fiatIdentifier || '';
        const deepLink = buildDeepLink(fiatType, identifier, numericPrice, 'USD');

        copyText(identifier, `Datos de ${fiatType.toUpperCase()} copiados al portapapeles`);

        if (typeof window !== 'undefined' && window.open) {
            try {
                window.open(deepLink.url, '_blank', 'noopener,noreferrer');
            } catch (e) {
                console.warn('[Checkout] Fallback deep link:', e);
            }
        }
    };

    // ── Issue P2P Off-Grid Voucher ──────────────────────────────────────────
    const handleGenerateOffgridVoucher = async () => {
        setIsProcessing(true);
        try {
            const { createP2PVoucher } = await import('../api/economy');
            const { localChainLedger } = await import('../lib/blockchain/LocalChainLedger');

            const res = await createP2PVoucher({
                amount: Math.round(numericPrice),
                recipient: product.authorHash
            });

            if (res && res.ok && res.voucher) {
                const qrString = `RED_PAY:${res.voucher.id}:${res.voucher.amount}:${res.voucher.signature}`;
                setVoucherCode(qrString);

                const url = await OfflineQrEngine.generateDataUrl(qrString, {
                    width: 240,
                    darkColor: "#00E676",
                    lightColor: "#04060A"
                });
                setVoucherQrUrl(url);

                await localChainLedger.submitTransaction({
                    type: 'VOUCHER_ISSUE',
                    sender: identity?.identity_hash || 'did:red:local_buyer',
                    recipient: product.authorHash || 'COMMERCIAL_ESCROW',
                    amount: Math.round(numericPrice),
                    fee: 0,
                    payload: { itemTitle: product.title, voucherId: res.voucher.id }
                });

                TacticalAudioEngine.playRogerBeep();
                toast.success("🛡️ Vale táctico generado y firmado con Ed25519");
            } else {
                toast.error("Error al generar vale táctico. Saldo insuficiente.");
            }
        } catch (err: any) {
            TacticalAudioEngine.playWarning();
            toast.error(err?.message || "Error al emitir el vale off-grid");
        } finally {
            setIsProcessing(false);
        }
    };

    const targetEvm = passport?.evmAddress || '';
    const fiatType = passport?.fiatType || 'yape';
    const fiatId = passport?.fiatIdentifier || '';
    const fiatBeneficiary = passport?.fiatBeneficiaryName || product.authorName || 'Operador Vendedor';

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    TacticalAudioEngine.playTap();
                    onClose();
                }
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1100,
                background: 'rgba(3, 5, 12, 0.88)',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                animation: 'fadeIn 0.2s ease'
            }}
        >
            <div style={{
                width: '100%',
                maxWidth: '540px',
                maxHeight: '92vh',
                background: 'var(--bg-card, #0B0E1A)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                borderRadius: '20px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(0, 229, 255, 0.1)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>{product.icon || '📦'}</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFF' }}>
                                {product.title}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                                <span style={{ fontSize: '0.78rem', color: '#00E5FF', fontWeight: 700 }}>
                                    {product.priceEst}
                                </span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #8A92A6)' }}>
                                    • Por: {product.authorName || 'Operador RED'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => { TacticalAudioEngine.playTap(); onClose(); }}
                        className="btn-icon"
                        style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.06)' }}
                        aria-label="Cerrar modal"
                    >
                        <TacIcon name="x" size={16} color="#FFF" />
                    </button>
                </div>

                {/* Subtitle / Non-Custodial Pill */}
                <div style={{
                    padding: '8px 20px',
                    background: 'rgba(0, 229, 255, 0.05)',
                    borderBottom: '1px solid rgba(0, 229, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.74rem'
                }}>
                    <span style={{ color: '#00E5FF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TacIcon name="lock" size={14} color="#00E5FF" />
                        <strong>Liquidación 100% No Custodial</strong>
                    </span>
                    <span style={{ color: 'var(--text-secondary, #8A92A6)' }}>
                        Transferencia directa entre operadores
                    </span>
                </div>

                {/* 4 Tabs Bar */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '4px',
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                    <button
                        onClick={() => { TacticalAudioEngine.playTap(); setActiveTab('fiat'); }}
                        style={{
                            padding: '8px 4px',
                            borderRadius: '10px',
                            background: activeTab === 'fiat' ? 'rgba(0, 230, 118, 0.18)' : 'transparent',
                            border: activeTab === 'fiat' ? '1px solid #00E676' : '1px solid transparent',
                            color: activeTab === 'fiat' ? '#00E676' : '#8A92A6',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <TacIcon name="card" size={18} color={activeTab === 'fiat' ? '#00E676' : '#8A92A6'} />
                        <span>Fiat Local</span>
                    </button>

                    <button
                        onClick={() => { TacticalAudioEngine.playTap(); setActiveTab('web3'); }}
                        style={{
                            padding: '8px 4px',
                            borderRadius: '10px',
                            background: activeTab === 'web3' ? 'rgba(0, 229, 255, 0.18)' : 'transparent',
                            border: activeTab === 'web3' ? '1px solid #00E5FF' : '1px solid transparent',
                            color: activeTab === 'web3' ? '#00E5FF' : '#8A92A6',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <TacIcon name="gem" size={18} color={activeTab === 'web3' ? '#00E5FF' : '#8A92A6'} />
                        <span>USDT / Base</span>
                    </button>

                    <button
                        onClick={() => { TacticalAudioEngine.playTap(); setActiveTab('lightning'); }}
                        style={{
                            padding: '8px 4px',
                            borderRadius: '10px',
                            background: activeTab === 'lightning' ? 'rgba(255, 179, 0, 0.18)' : 'transparent',
                            border: activeTab === 'lightning' ? '1px solid #FFB300' : '1px solid transparent',
                            color: activeTab === 'lightning' ? '#FFB300' : '#8A92A6',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <TacIcon name="zap" size={18} color={activeTab === 'lightning' ? '#FFB300' : '#8A92A6'} />
                        <span>Lightning</span>
                    </button>

                    <button
                        onClick={() => { TacticalAudioEngine.playTap(); setActiveTab('voucher'); }}
                        style={{
                            padding: '8px 4px',
                            borderRadius: '10px',
                            background: activeTab === 'voucher' ? 'rgba(232, 33, 58, 0.18)' : 'transparent',
                            border: activeTab === 'voucher' ? '1px solid #E8213A' : '1px solid transparent',
                            color: activeTab === 'voucher' ? '#E8213A' : '#8A92A6',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <TacIcon name="shield" size={18} color={activeTab === 'voucher' ? '#E8213A' : '#8A92A6'} />
                        <span>Off-Grid</span>
                    </button>
                </div>

                {/* Tab Content Body */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    {/* ── TAB 1: FIAT LOCAL (Yape, Plin, PayPal, Pix, Bizum) ── */}
                    {activeTab === 'fiat' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                            <div style={{
                                padding: '12px 14px',
                                background: 'rgba(0, 230, 118, 0.06)',
                                border: '1px solid rgba(0, 230, 118, 0.2)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#8A92A6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Método de Pago Seleccionado
                                    </div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#00E676', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <TacIcon name="card" size={16} color="#00E676" />
                                        <span>{fiatType.toUpperCase()}</span>
                                        {fiatBeneficiary && (
                                            <span style={{ fontSize: '0.8rem', color: '#FFF', fontWeight: 500 }}>
                                                ({fiatBeneficiary})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#8A92A6' }}>Monto a Transferir</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.1rem', fontWeight: 900, color: '#FFF' }}>
                                        ${numericPrice.toFixed(2)} USD
                                    </div>
                                </div>
                            </div>

                            {/* Custom QR display if uploaded by merchant */}
                            {passport?.fiatQrDataUrl ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: '#04060A',
                                    borderRadius: '16px',
                                    border: '1px dashed rgba(0, 230, 118, 0.4)'
                                }}>
                                    <img
                                        src={passport.fiatQrDataUrl}
                                        alt="Código QR de Cobro"
                                        style={{ width: '200px', height: '200px', objectFit: 'contain', borderRadius: '8px' }}
                                    />
                                    <span style={{ fontSize: '0.72rem', color: '#8A92A6', marginTop: '6px' }}>
                                        Escanea directamente desde tu app de {fiatType.toUpperCase()}
                                    </span>
                                </div>
                            ) : (
                                <div style={{
                                    padding: '16px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    borderRadius: '14px',
                                    border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                    <div style={{ fontSize: '0.76rem', color: '#8A92A6', marginBottom: '4px' }}>
                                        Identificador / Número de {fiatType.toUpperCase()}
                                    </div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', letterSpacing: '1px' }}>
                                        {fiatId || 'No configurado por el vendedor'}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button
                                    onClick={() => copyText(fiatId, `Identificador de ${fiatType.toUpperCase()} copiado`)}
                                    disabled={!fiatId}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#FFF',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <TacIcon name="copy" size={15} color="#FFF" />
                                    <span>Copiar Número</span>
                                </button>

                                <button
                                    onClick={handleOpenFiatApp}
                                    disabled={!fiatId}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: '#00E676',
                                        border: 'none',
                                        color: '#04060A',
                                        fontWeight: 900,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        boxShadow: '0 4px 14px rgba(0, 230, 118, 0.35)'
                                    }}
                                >
                                    <TacIcon name="forward" size={15} color="#04060A" />
                                    <span>Abrir {fiatType.toUpperCase()}</span>
                                </button>
                            </div>

                            {/* Notice */}
                            <div style={{
                                padding: '10px 14px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '10px',
                                fontSize: '0.72rem',
                                color: '#8A92A6',
                                textAlign: 'left',
                                lineHeight: '1.4',
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'flex-start'
                            }}>
                                <TacIcon name="info" size={15} color="#00E5FF" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <strong>Protocolo P2P:</strong> Realiza la transferencia en tu app bancaria y envía el comprobante al vendedor mediante el chat cifrado de RED para coordinar la entrega o activación.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB 2: WEB3 STABLECOIN (USDT en Polygon / USDC en Base) ── */}
                    {activeTab === 'web3' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                            {/* Chain Selector */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px',
                                background: 'rgba(0, 0, 0, 0.4)',
                                padding: '4px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.06)'
                            }}>
                                <button
                                    onClick={() => setSelectedChainId(137)}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '8px',
                                        background: selectedChainId === 137 ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
                                        border: selectedChainId === 137 ? '1px solid #00E5FF' : 'none',
                                        color: selectedChainId === 137 ? '#00E5FF' : '#8A92A6',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <TacIcon name="gem" size={14} color={selectedChainId === 137 ? '#00E5FF' : '#8A92A6'} />
                                    <span>Polygon PoS (USDT)</span>
                                </button>
                                <button
                                    onClick={() => setSelectedChainId(8453)}
                                    style={{
                                        padding: '8px',
                                        borderRadius: '8px',
                                        background: selectedChainId === 8453 ? 'rgba(0, 82, 255, 0.25)' : 'transparent',
                                        border: selectedChainId === 8453 ? '1px solid #0052FF' : 'none',
                                        color: selectedChainId === 8453 ? '#00E5FF' : '#8A92A6',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <TacIcon name="gem" size={14} color={selectedChainId === 8453 ? '#00E5FF' : '#8A92A6'} />
                                    <span>Base Network (USDC)</span>
                                </button>
                            </div>

                            {/* QR Code Container */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '12px',
                                background: '#060913',
                                borderRadius: '16px',
                                border: '1px solid rgba(0, 229, 255, 0.3)'
                            }}>
                                {evmQrUrl ? (
                                    <img
                                        src={evmQrUrl}
                                        alt="Código QR EVM"
                                        style={{ width: '180px', height: '180px', borderRadius: '8px' }}
                                    />
                                ) : (
                                    <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A92A6', fontSize: '0.8rem' }}>
                                        Generando QR...
                                    </div>
                                )}
                                <div className="tabular-telemetry" style={{
                                    marginTop: '8px',
                                    fontSize: '0.7rem',
                                    color: '#8A92A6',
                                    fontFamily: 'monospace',
                                    wordBreak: 'break-all',
                                    maxWidth: '280px'
                                }}>
                                    {targetEvm || '0x... (Sin dirección registrada)'}
                                </div>
                            </div>

                            {/* Details Pill */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                background: 'rgba(0, 229, 255, 0.06)',
                                borderRadius: '10px',
                                fontSize: '0.76rem',
                                color: '#FFF'
                            }}>
                                <span>Contrato Oficial:</span>
                                <strong style={{ color: '#00E5FF' }}>
                                    {ERC20_STABLECOINS[selectedChainId]?.symbol || 'USDT'} (Gas &lt; $0.005)
                                </strong>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button
                                    onClick={() => copyText(targetEvm, "Dirección EVM copiada")}
                                    disabled={!isValidEvmAddress(targetEvm)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#FFF',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <TacIcon name="copy" size={14} color="#FFF" />
                                    <span>Copiar Dirección 0x</span>
                                </button>

                                <button
                                    onClick={handlePayWithWeb3}
                                    disabled={!isValidEvmAddress(targetEvm) || isProcessing}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '12px',
                                        background: web3State.isConnected ? '#00E5FF' : 'rgba(0, 229, 255, 0.3)',
                                        border: 'none',
                                        color: '#04060A',
                                        fontWeight: 900,
                                        fontSize: '0.8rem',
                                        cursor: web3State.isConnected ? 'pointer' : 'default',
                                        boxShadow: web3State.isConnected ? '0 4px 16px rgba(0, 229, 255, 0.4)' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <TacIcon name={web3State.isConnected ? "zap" : "wallet"} size={14} color="#04060A" />
                                    <span>{isProcessing ? 'Procesando...' : (web3State.isConnected ? 'Pagar con Wallet' : 'Conectar MetaMask')}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── TAB 3: BITCOIN LIGHTNING NETWORK ── */}
                    {activeTab === 'lightning' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                            <div style={{
                                padding: '12px 14px',
                                background: 'rgba(255, 179, 0, 0.06)',
                                border: '1px solid rgba(255, 179, 0, 0.2)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#8A92A6' }}>Red Bitcoin Lightning</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFB300' }}>
                                        {passport?.lightningAddress || 'merchant@getalby.com'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#8A92A6' }}>Equivalente Satoshis</div>
                                    <div className="tabular-telemetry" style={{ fontSize: '1rem', fontWeight: 900, color: '#FFF' }}>
                                        ~{Math.round(numericPrice * 1500).toLocaleString()} SAT
                                    </div>
                                </div>
                            </div>

                            {/* Lightning QR */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '12px',
                                background: '#060913',
                                borderRadius: '16px',
                                border: '1px solid rgba(255, 179, 0, 0.3)'
                            }}>
                                {lnQrUrl ? (
                                    <img
                                        src={lnQrUrl}
                                        alt="Código QR Lightning"
                                        style={{ width: '180px', height: '180px', borderRadius: '8px' }}
                                    />
                                ) : (
                                    <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A92A6' }}>
                                        Generando QR...
                                    </div>
                                )}
                                <div style={{ fontSize: '0.72rem', color: '#8A92A6', marginTop: '6px' }}>
                                    Escanea con Phoenix, Wallet of Satoshi o Alby
                                </div>
                            </div>

                            <button
                                onClick={() => copyText(passport?.lightningAddress || 'merchant@getalby.com', "Dirección Lightning copiada")}
                                style={{
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: '#FFB300',
                                    border: 'none',
                                    color: '#04060A',
                                    fontWeight: 900,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(255, 179, 0, 0.35)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <TacIcon name="copy" size={15} color="#04060A" />
                                <span>Copiar Dirección Lightning</span>
                            </button>
                        </div>
                    )}

                    {/* ── TAB 4: VALE TÁCTICO OFF-GRID (100% SIN INTERNET) ── */}
                    {activeTab === 'voucher' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                            <div style={{
                                padding: '12px',
                                background: 'rgba(232, 33, 58, 0.06)',
                                border: '1px solid rgba(232, 33, 58, 0.25)',
                                borderRadius: '12px',
                                textAlign: 'left'
                            }}>
                                <div style={{ fontSize: '0.74rem', color: '#E8213A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TacIcon name="shield" size={14} color="#E8213A" />
                                    <span>MODO EMERGENCIA / APAGÓN ELECTROMAGNÉTICO</span>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#FFF', marginTop: '4px', lineHeight: '1.4' }}>
                                    Emite un pagaré criptográfico P2P firmado con tu par de claves Ed25519. No requiere internet, red celular ni servidores.
                                </div>
                            </div>

                            {voucherQrUrl ? (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: '14px',
                                    background: '#04060A',
                                    borderRadius: '16px',
                                    border: '1px solid #00E676'
                                }}>
                                    <img
                                        src={voucherQrUrl}
                                        alt="Vale Táctico P2P"
                                        style={{ width: '190px', height: '190px', borderRadius: '8px' }}
                                    />
                                    <span style={{ fontSize: '0.7rem', color: '#00E676', marginTop: '8px', fontWeight: 700 }}>
                                        Muestra este QR al vendedor para canje inmediato
                                    </span>
                                    <button
                                        onClick={() => copyText(voucherCode, "Código de vale copiado")}
                                        className="btn-tactical-pill"
                                        style={{ marginTop: '8px', fontSize: '0.72rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <TacIcon name="copy" size={13} />
                                        <span>Copiar Firma Criptográfica</span>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleGenerateOffgridVoucher}
                                    disabled={isProcessing}
                                    style={{
                                        padding: '14px',
                                        borderRadius: '14px',
                                        background: '#E8213A',
                                        border: 'none',
                                        color: '#FFF',
                                        fontWeight: 900,
                                        fontSize: '0.88rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: '0 4px 16px rgba(232, 33, 58, 0.4)'
                                    }}
                                >
                                    <TacIcon name="shield" size={18} color="#FFF" />
                                    <span className="tabular-telemetry">{isProcessing ? 'Firmando con Ed25519...' : `Generar Vale Táctico (${Math.round(numericPrice)} RED)`}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

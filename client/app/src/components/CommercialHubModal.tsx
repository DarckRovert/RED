"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../lib/i18n/i18nEngine';
import { MonetizationEngine, ProPerkStatus, TacticalProduct, TacticalTransaction } from '../lib/network/MonetizationEngine';
import { bazaarSync } from '../lib/storage/BazaarSyncEngine';
import { toast } from './Toast';

import { useRedStore } from '../store/useRedStore';

interface CommercialHubModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HubTab = 'catalog' | 'redeem' | 'transactions' | 'create';

export const CommercialHubModal: React.FC<CommercialHubModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { identity } = useRedStore();
    const [activeTab, setActiveTab] = useState<HubTab>('catalog');
    const [proStatus, setProStatus] = useState<ProPerkStatus>(MonetizationEngine.getProStatus());
    const [catalog, setCatalog] = useState<TacticalProduct[]>([]);
    const [transactions, setTransactions] = useState<TacticalTransaction[]>([]);
    const [isLoadingAd, setIsLoadingAd] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    // New product form
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState<'radio' | 'energy' | 'crypto' | 'survival'>('radio');
    const [newDesc, setNewDesc] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newTag, setNewTag] = useState('EQUIPO TÁCTICO');
    const [newIcon, setNewIcon] = useState('📡');
    const [newUrl, setNewUrl] = useState('');

    // P2P Voucher Modal
    const [p2pModalItem, setP2pModalItem] = useState<TacticalProduct | null>(null);
    const [p2pQrData, setP2pQrData] = useState<string | null>(null);
    const [p2pQrUrl, setP2pQrUrl] = useState<string | null>(null);
    const [isIssuingVoucher, setIsIssuingVoucher] = useState(false);

    const refreshData = () => {
        setProStatus(MonetizationEngine.getProStatus());
        const crdtCatalog = bazaarSync.getActiveListings();
        setCatalog(crdtCatalog.length > 0 ? crdtCatalog : MonetizationEngine.getCatalog());
        setTransactions(MonetizationEngine.getTransactions());
    };

    useEffect(() => {
        if (!isOpen) return;
        refreshData();

        const handleUpdate = () => refreshData();
        window.addEventListener('red_pro_status_updated', handleUpdate);
        const unsubBazaar = bazaarSync.subscribe(handleUpdate);
        return () => {
            window.removeEventListener('red_pro_status_updated', handleUpdate);
            unsubBazaar();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleWatchVideo = async () => {
        setIsLoadingAd(true);
        setStatusMessage("Sintonizando canal de transmisión patrocinada...");

        try {
            const res = await MonetizationEngine.showRewardedVideo(() => {
                setStatusMessage(`¡Recompensa acreditada! +24 Horas de Modo Pro y 100 Créditos.`);
                toast.success("🎬 Recompensa acreditada: +24h Pro & +100 RED");
                refreshData();
            });

            if (!res.success) {
                setStatusMessage(res.message);
                toast.error(res.message);
            } else {
                setStatusMessage(res.message);
                toast.success(res.message);
                refreshData();
            }
        } catch (err: any) {
            setStatusMessage("Error al cargar la transmisión. Intenta nuevamente.");
            toast.error("Error al cargar transmisión");
        } finally {
            setIsLoadingAd(false);
        }
    };

    const handleRedeemPro = (hours: number, cost: number) => {
        const res = MonetizationEngine.redeemCreditsForPro(hours, cost);
        if (res.success) {
            toast.success(res.message);
            refreshData();
        } else {
            toast.error(res.message);
        }
    };

    const handleCreateProduct = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) {
            toast.warning("Ingresa el título del equipo");
            return;
        }

        const product: TacticalProduct = {
            id: `prod-${Date.now()}`,
            title: newTitle.trim(),
            category: newCategory,
            description: newDesc.trim() || "Equipo homologado por el operador del nodo.",
            priceEst: newPrice.trim() || "~$0 USD",
            tag: newTag.trim() || "EQUIPO PERSONALIZADO",
            icon: newIcon.trim() || "📦",
            affiliateUrl: newUrl.trim() || "#",
            authorHash: identity?.identity_hash,
            authorName: identity?.nickname || "Operador RED"
        };

        MonetizationEngine.addProduct(product);
        bazaarSync.publishListing(product, identity?.identity_hash || 'ANON_OPERATOR');

        toast.success(`✅ Producto "${newTitle}" publicado en la malla Bazaar`);
        setNewTitle('');
        setNewDesc('');
        setNewPrice('');
        setNewUrl('');
        setActiveTab('catalog');
        refreshData();
    };

    const handleDeleteProduct = (id: string, name: string) => {
        MonetizationEngine.removeProduct(id);
        bazaarSync.retireListing(id, identity?.identity_hash || 'ANON_OPERATOR');
        toast.info(`Producto "${name}" retirado de la malla`);
        refreshData();
    };

    const handleResetCatalog = () => {
        MonetizationEngine.resetCatalog();
        toast.info("Catálogo restablecido a valores certificados");
        refreshData();
    };

    const handleBuyWithP2PVoucher = async (item: TacticalProduct) => {
        const match = item.priceEst.match(/\d+(\.\d+)?/);
        const parsed = match ? parseFloat(match[0]) : 25;
        const amount = (isFinite(parsed) && parsed > 0) ? Math.round(parsed) : 25;

        setIsIssuingVoucher(true);
        try {
            const { createP2PVoucher } = await import('../api/economy');
            const { localChainLedger } = await import('../lib/blockchain/LocalChainLedger');

            const res = await createP2PVoucher({
                amount,
                recipient: undefined
            });

            if (res && res.ok && res.voucher) {
                const qrString = `RED_PAY:${res.voucher.id}:${res.voucher.amount}:${res.voucher.signature}`;
                setP2pQrData(qrString);

                const { OfflineQrEngine } = await import('../lib/qr/OfflineQrEngine');
                const url = await OfflineQrEngine.generateDataUrl(qrString, {
                    width: 260,
                    margin: 1,
                    darkColor: "#00E676",
                    lightColor: "#04060A"
                });
                setP2pQrUrl(url);

                setP2pModalItem(item);

                // Record in local blockchain ledger
                await localChainLedger.submitTransaction({
                    type: 'VOUCHER_ISSUE',
                    sender: identity?.identity_hash || 'did:red:local_buyer',
                    recipient: 'COMMERCIAL_ESCROW',
                    amount,
                    fee: 0,
                    payload: { itemTitle: item.title, voucherId: res.voucher.id }
                });

                toast.success(`💳 Vale P2P de ${amount} RED generado para "${item.title}"`);
                refreshData();
            } else {
                toast.error(res?.error || "Saldo insuficiente para emitir vale P2P.");
            }
        } catch (e: any) {
            toast.error("Error al emitir orden P2P: " + (e?.message || ""));
        } finally {
            setIsIssuingVoucher(false);
        }
    };

    const filteredCatalog = useMemo(() => {
        if (activeCategory === 'all') return catalog;
        return catalog.filter(item => item.category === activeCategory);
    }, [catalog, activeCategory]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(3, 4, 8, 0.88)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                backgroundColor: 'rgba(12, 16, 28, 0.95)',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: '20px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 229, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(255, 42, 81, 0.2) 0%, rgba(0, 229, 255, 0.2) 100%)',
                            border: '1px solid rgba(0, 229, 255, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px'
                        }}>
                            🪙
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
                                Hub Comercial & Financiación Mesh
                            </h2>
                            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                Micro-recompensas, Billetera Táctica y Catálogo Homologado
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn-icon"
                        style={{ width: '36px', height: '36px' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Status Bar */}
                <div style={{
                    padding: '12px 24px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Modo Táctico:
                        </span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: proStatus.isPro ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                            color: proStatus.isPro ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                            border: proStatus.isPro ? '1px solid rgba(0, 230, 118, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            {proStatus.isPro ? `⚡ PRO ACTIVO (${proStatus.remainingHours}h)` : '🛡️ MODO ESTÁNDAR'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Billetera Local:
                        </span>
                        <span style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            color: 'var(--accent-amber)',
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            🪙 {proStatus.credits} RED
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    padding: '0 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.2)',
                    gap: '4px',
                    overflowX: 'auto'
                }}>
                    <button
                        onClick={() => setActiveTab('catalog')}
                        className={activeTab === 'catalog' ? 'glow-pill-active' : 'btn-ghost'}
                        style={{ padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px 8px 0 0' }}
                    >
                        📦 Catálogo Homologado ({catalog.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('redeem')}
                        className={activeTab === 'redeem' ? 'glow-pill-active' : 'btn-ghost'}
                        style={{ padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px 8px 0 0' }}
                    >
                        ⚡ Canjear Modo Pro
                    </button>
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={activeTab === 'transactions' ? 'glow-pill-active' : 'btn-ghost'}
                        style={{ padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px 8px 0 0' }}
                    >
                        📑 Transacciones ({transactions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={activeTab === 'create' ? 'glow-pill-active' : 'btn-ghost'}
                        style={{ padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px 8px 0 0' }}
                    >
                        ➕ Añadir Equipo
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    padding: '24px',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                }}>
                    {/* TAB: CATALOG */}
                    {activeTab === 'catalog' && (
                        <>
                            {/* Sovereign Relay Validation Box */}
                            <div style={{
                                padding: '18px',
                                borderRadius: '14px',
                                background: 'linear-gradient(135deg, rgba(255, 42, 81, 0.15) 0%, rgba(18, 12, 28, 0.6) 100%)',
                                border: '1px solid rgba(255, 42, 81, 0.35)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                    <div>
                                        <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1px', color: 'var(--accent-crimson)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
                                            ● MODO SOBERANO & CRÉDITOS P2P
                                        </span>
                                        <h3 style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 800 }}>
                                            Validación Proof-of-Relay (+24h Modo Pro & +100 RED)
                                        </h3>
                                    </div>
                                    <span style={{ fontSize: '24px' }}>⚡</span>
                                </div>

                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.45 }}>
                                    Valida la integridad de retransmisión de paquetes en la malla distribuida P2P para respaldar la infraestructura soberana. Se te acreditarán inmediatamente <strong>+24 Horas de Acceso Pro</strong> y <strong>+100 Créditos</strong>.
                                </p>

                                {statusMessage && (
                                    <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.25)', fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {statusMessage}
                                    </div>
                                )}

                                <button
                                    onClick={handleWatchVideo}
                                    disabled={isLoadingAd}
                                    className="btn-tactical-primary"
                                    style={{ padding: '12px 18px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {isLoadingAd ? '⏳ Validando retransmisión...' : '⚡ VALIDAR RETRANSMISIÓN & RECLAMAR +100 RED'}
                                </button>
                            </div>

                            {/* Categorías & Filtro */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {['all', 'radio', 'energy', 'crypto', 'survival'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setActiveCategory(cat)}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: '8px',
                                                background: activeCategory === cat ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                                border: activeCategory === cat ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                                                color: activeCategory === cat ? '#FFF' : 'var(--text-muted)',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                textTransform: 'uppercase'
                                            }}
                                        >
                                            {cat === 'all' ? 'Todos' : cat}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={handleResetCatalog}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.70rem', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Restablecer oficiales
                                </button>
                            </div>

                            {/* Lista de Productos Tácticos */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {filteredCatalog.map((item) => (
                                    <div key={item.id} style={{
                                        padding: '14px 16px',
                                        borderRadius: '14px',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '14px',
                                        transition: 'transform 0.15s ease'
                                    }}>
                                        <div style={{ fontSize: '28px', flexShrink: 0 }}>
                                            {item.icon}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    fontSize: '9px',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(0, 229, 255, 0.15)',
                                                    color: 'var(--accent-cyan)',
                                                    fontWeight: 800,
                                                    fontFamily: 'JetBrains Mono, monospace'
                                                }}>
                                                    {item.tag}
                                                </span>
                                                <span style={{ fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                                                    {item.priceEst}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {item.title}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px', lineHeight: 1.35 }}>
                                                {item.description}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleBuyWithP2PVoucher(item)}
                                                disabled={isIssuingVoucher}
                                                className="btn-tactical-secondary"
                                                style={{
                                                    padding: '8px 12px',
                                                    fontSize: '0.74rem',
                                                    borderColor: 'rgba(0, 230, 118, 0.4)',
                                                    color: 'var(--accent-emerald)',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                💳 Pagar P2P
                                            </button>
                                            <a
                                                href={item.affiliateUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-tactical-secondary"
                                                style={{
                                                    padding: '8px 12px',
                                                    fontSize: '0.74rem',
                                                    textDecoration: 'none',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                Ver Equipo ↗
                                            </a>
                                            <button
                                                onClick={() => handleDeleteProduct(item.id, item.title)}
                                                className="btn-icon"
                                                style={{ width: '32px', height: '32px', color: 'var(--accent-crimson)', opacity: 0.6 }}
                                                title="Eliminar de catálogo local"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* TAB: REDEEM PRO */}
                    {activeTab === 'redeem' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(0, 230, 118, 0.08)', border: '1px solid rgba(0, 230, 118, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>Balance Disponible</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace' }}>🪙 {proStatus.credits} RED</div>
                                </div>
                                <button
                                    onClick={() => MonetizationEngine.addCredits(50)}
                                    className="btn-tactical-secondary"
                                    style={{ padding: '6px 12px', fontSize: '0.72rem' }}
                                >
                                    +50 Bono Rápido
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ fontSize: '1.4rem' }}>⏳</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Pase Pro (24 Horas)</div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Desbloquea prioridad de enrutamiento y cifrado post-cuántico continuo.</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'JetBrains Mono, monospace' }}>Costo: 100 Créditos</div>
                                    <button
                                        onClick={() => handleRedeemPro(24, 100)}
                                        disabled={proStatus.credits < 100}
                                        className="btn-tactical-primary"
                                        style={{ padding: '10px', fontSize: '0.78rem' }}
                                    >
                                        Canjear 24h Pro
                                    </button>
                                </div>

                                <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ fontSize: '1.4rem' }}>🌟</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>Pase Pro Semanal (7 Días)</div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>168 horas completas con temas militares y ancho de banda preferencial.</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent-amber)', fontFamily: 'JetBrains Mono, monospace' }}>Costo: 500 Créditos</div>
                                    <button
                                        onClick={() => handleRedeemPro(168, 500)}
                                        disabled={proStatus.credits < 500}
                                        className="btn-tactical-primary"
                                        style={{ padding: '10px', fontSize: '0.78rem' }}
                                    >
                                        Canjear 7 Días Pro
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: TRANSACTIONS */}
                    {activeTab === 'transactions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                REGISTRO DE MOVIMIENTOS EN BÓVEDA LOCAL ({transactions.length})
                            </div>
                            {transactions.length === 0 ? (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                    No hay transacciones registradas aún. Mira una transmisión o canjea beneficios para iniciar el libro de cuentas.
                                </div>
                            ) : (
                                transactions.map((tx) => (
                                    <div key={tx.id} style={{
                                        padding: '12px 14px', borderRadius: '10px',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{tx.description}</div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                                {new Date(tx.timestamp).toLocaleString()} · ID: {tx.id.slice(0, 10)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{
                                                fontSize: '0.88rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
                                                color: tx.amount >= 0 ? 'var(--accent-emerald)' : 'var(--accent-crimson)'
                                            }}>
                                                {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} RED
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                                Saldo: {tx.balanceAfter} RED
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* TAB: CREATE PRODUCT */}
                    {activeTab === 'create' && (
                        <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                                Registrar Nuevo Producto o Equipo en Catálogo Local
                            </div>

                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Título del Producto *</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="Ej: Batería LiFePO4 12V 20Ah Portátil"
                                    className="input-tactical"
                                    style={{ width: '100%', marginTop: '4px' }}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Categoría</label>
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value as any)}
                                        className="input-tactical"
                                        style={{ width: '100%', marginTop: '4px' }}
                                    >
                                        <option value="radio">Radio & LoRa</option>
                                        <option value="energy">Energía & Solar</option>
                                        <option value="crypto">Cripto & Bóvedas</option>
                                        <option value="survival">Supervivencia</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Precio Estimado</label>
                                    <input
                                        type="text"
                                        value={newPrice}
                                        onChange={e => setNewPrice(e.target.value)}
                                        placeholder="Ej: ~$65 USD"
                                        className="input-tactical"
                                        style={{ width: '100%', marginTop: '4px' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Descripción Técnica</label>
                                <textarea
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    placeholder="Especificaciones de compatibilidad y alcance..."
                                    className="input-tactical"
                                    style={{ width: '100%', marginTop: '4px', minHeight: '60px' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Etiqueta de Homologación</label>
                                    <input
                                        type="text"
                                        value={newTag}
                                        onChange={e => setNewTag(e.target.value)}
                                        placeholder="Ej: ALTA RESISTENCIA"
                                        className="input-tactical"
                                        style={{ width: '100%', marginTop: '4px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Icono Emoji</label>
                                    <input
                                        type="text"
                                        value={newIcon}
                                        onChange={e => setNewIcon(e.target.value)}
                                        placeholder="🔋"
                                        className="input-tactical"
                                        style={{ width: '100%', marginTop: '4px' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Enlace Web / Afiliado</label>
                                <input
                                    type="url"
                                    value={newUrl}
                                    onChange={e => setNewUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="input-tactical"
                                    style={{ width: '100%', marginTop: '4px' }}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn-tactical-primary"
                                style={{ padding: '12px', marginTop: '6px' }}
                            >
                                💾 Guardar en Catálogo Descentralizado
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.5)'
                }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>🛡️ RED COMMERCIAL MATRIX · ZERO-TRACKING</span>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 700
                        }}
                    >
                        Cerrar Panel
                    </button>
                </div>

                {/* Modal P2P QR Overlay */}
                {p2pModalItem && (
                    <div
                        style={{
                            position: 'fixed', inset: 0, zIndex: 100000,
                            background: 'rgba(4, 6, 14, 0.92)', backdropFilter: 'blur(20px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                        }}
                        onClick={() => setP2pModalItem(null)}
                    >
                        <div
                            className="card-tactical animate-enter"
                            style={{
                                width: '100%', maxWidth: '420px', padding: '24px',
                                background: 'linear-gradient(180deg, #0e1222 0%, #080a14 100%)',
                                border: '1px solid rgba(0, 230, 118, 0.4)',
                                textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ fontSize: '2rem' }}>💳</div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFF' }}>
                                Vale P2P de Pago Generado
                            </h3>
                            <div style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                                {p2pModalItem.title}
                            </div>

                            {p2pQrUrl && (
                                <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                                    <div style={{ padding: '12px', background: '#04060A', borderRadius: '14px', border: '1px solid rgba(0,230,118,0.3)' }}>
                                        <img src={p2pQrUrl} alt="QR de Pago P2P" style={{ width: '200px', height: '200px', display: 'block' }} />
                                    </div>
                                </div>
                            )}

                            <div style={{
                                padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)',
                                border: '1px solid var(--glass-border)', fontSize: '0.72rem',
                                fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-emerald)', wordBreak: 'break-all'
                            }}>
                                {p2pQrData}
                            </div>

                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Muestra este código QR al vendedor o nodo receptor para transferir los créditos de forma 100% off-grid.
                            </div>

                            <button
                                onClick={() => setP2pModalItem(null)}
                                className="btn-tactical-primary"
                                style={{ padding: '12px', width: '100%', marginTop: '4px' }}
                            >
                                Entendido / Cerrar Vale
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

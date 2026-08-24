"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../lib/i18n/i18nEngine';
import { MonetizationEngine, ProPerkStatus, TacticalProduct, TacticalTransaction } from '../lib/network/MonetizationEngine';
import { toast } from './Toast';

interface CommercialHubModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type HubTab = 'catalog' | 'redeem' | 'transactions' | 'create';

export const CommercialHubModal: React.FC<CommercialHubModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
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

    const refreshData = () => {
        setProStatus(MonetizationEngine.getProStatus());
        setCatalog(MonetizationEngine.getCatalog());
        setTransactions(MonetizationEngine.getTransactions());
    };

    useEffect(() => {
        if (!isOpen) return;
        refreshData();

        const handleUpdate = () => refreshData();
        window.addEventListener('red_pro_status_updated', handleUpdate);
        return () => window.removeEventListener('red_pro_status_updated', handleUpdate);
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

        MonetizationEngine.addProduct({
            title: newTitle.trim(),
            category: newCategory,
            description: newDesc.trim() || "Equipo homologado por el operador del nodo.",
            priceEst: newPrice.trim() || "~$0 USD",
            tag: newTag.trim() || "EQUIPO PERSONALIZADO",
            icon: newIcon.trim() || "📦",
            affiliateUrl: newUrl.trim() || "#"
        });

        toast.success(`✅ Producto "${newTitle}" añadido al catálogo`);
        setNewTitle('');
        setNewDesc('');
        setNewPrice('');
        setNewUrl('');
        setActiveTab('catalog');
        refreshData();
    };

    const handleDeleteProduct = (id: string, name: string) => {
        MonetizationEngine.removeProduct(id);
        toast.info(`Producto "${name}" eliminado`);
        refreshData();
    };

    const handleResetCatalog = () => {
        MonetizationEngine.resetCatalog();
        toast.info("Catálogo restablecido a valores certificados");
        refreshData();
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
                maxWidth: '720px',
                maxHeight: '92vh',
                backgroundColor: 'rgba(12, 16, 26, 0.96)',
                border: '1px solid rgba(255, 42, 81, 0.3)',
                borderRadius: '20px',
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(232, 33, 58, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: '#FFFFFF'
            }}>
                {/* Header Táctico */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(90deg, rgba(232, 33, 58, 0.15) 0%, transparent 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #FF2A51 0%, #B30021 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            boxShadow: '0 0 20px rgba(255, 42, 81, 0.5)'
                        }}>
                            ⚡
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.3px' }}>
                                    {t('hub.title') || "Hub Comercial & Beneficios Pro"}
                                </h2>
                                <span style={{
                                    fontSize: '10px', padding: '2px 8px', borderRadius: '12px',
                                    background: proStatus.isPro ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                    color: proStatus.isPro ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                    fontWeight: 800, fontFamily: 'JetBrains Mono, monospace'
                                }}>
                                    {proStatus.isPro ? 'PRO ACTIVO' : 'ESTÁNDAR'}
                                </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'JetBrains Mono, monospace' }}>
                                {proStatus.isPro 
                                    ? `● ${proStatus.remainingHours}h de autonomía Pro restante · ${proStatus.credits} RED Créditos`
                                    : `● Balance: ${proStatus.credits} RED Créditos · 100% Descentralizado`}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="btn-icon"
                        style={{ width: '36px', height: '36px', borderRadius: '10px' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs de Navegación */}
                <div style={{
                    display: 'flex', gap: '8px', padding: '10px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(0, 0, 0, 0.25)', overflowX: 'auto'
                }}>
                    <button
                        onClick={() => setActiveTab('catalog')}
                        className={`btn-tactical-pill ${activeTab === 'catalog' ? 'active' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        🛒 Catálogo Hardware ({filteredCatalog.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('redeem')}
                        className={`btn-tactical-pill ${activeTab === 'redeem' ? 'active' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        🪙 Canje & Bonos
                    </button>
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={`btn-tactical-pill ${activeTab === 'transactions' ? 'active' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        📜 Transacciones ({transactions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`btn-tactical-pill ${activeTab === 'create' ? 'active' : ''}`}
                        style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                    >
                        ➕ Añadir Equipo
                    </button>
                </div>

                {/* Contenido Dinámico */}
                <div className="scroll-container" style={{
                    padding: '20px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                    flex: 1
                }}>
                    {/* TAB: CATALOG */}
                    {activeTab === 'catalog' && (
                        <>
                            {/* Rewarded Video Card */}
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
                                            ● CANAL DE PATROCINIO & CRÉDITOS
                                        </span>
                                        <h3 style={{ margin: '4px 0 0 0', fontSize: '15px', fontWeight: 800 }}>
                                            Sintonizar Transmisión (+24h Modo Pro & +100 RED)
                                        </h3>
                                    </div>
                                    <span style={{ fontSize: '24px' }}>🎬</span>
                                </div>

                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.45 }}>
                                    Visualiza una transmisión de 15 a 30 segundos para financiar la infraestructura mesh. Se te acreditarán inmediatamente <strong>+24 Horas de Acceso Pro</strong> y <strong>+100 Créditos</strong>.
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
                                    {isLoadingAd ? '⏳ Conectando canal...' : '📺 VER TRANSMISIÓN & RECLAMAR +100 RED'}
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
            </div>
        </div>
    );
};


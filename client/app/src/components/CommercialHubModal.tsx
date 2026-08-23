"use client";

import React, { useState, useEffect } from 'react';
import { useTranslation } from '../lib/i18n/i18nEngine';
import { MonetizationEngine, ProPerkStatus, TACTICAL_CATALOG, TacticalProduct } from '../lib/MonetizationEngine';

interface CommercialHubModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CommercialHubModal: React.FC<CommercialHubModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [proStatus, setProStatus] = useState<ProPerkStatus>({
        isPro: false,
        expiresAt: 0,
        remainingHours: 0,
        credits: 0,
    });
    const [isLoadingAd, setIsLoadingAd] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const updateStatus = () => {
        setProStatus(MonetizationEngine.getProStatus());
    };

    useEffect(() => {
        if (!isOpen) return;
        updateStatus();

        const handleUpdate = () => updateStatus();
        window.addEventListener('red_pro_status_updated', handleUpdate);
        return () => window.removeEventListener('red_pro_status_updated', handleUpdate);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleWatchVideo = async () => {
        setIsLoadingAd(true);
        setStatusMessage("Sintonizando canal de transmisión patrocinada...");

        try {
            const res = await MonetizationEngine.showRewardedVideo((reward) => {
                setStatusMessage(`¡Recompensa acreditada con éxito! (+24 Horas de Modo Pro y 100 Créditos)`);
                updateStatus();
            });

            if (!res.success) {
                setStatusMessage(res.message);
            } else {
                setStatusMessage(res.message);
                updateStatus();
            }
        } catch (err: any) {
            setStatusMessage("Error al cargar la transmisión. Intenta nuevamente.");
        } finally {
            setIsLoadingAd(false);
        }
    };

    const filteredCatalog = activeCategory === 'all' 
        ? TACTICAL_CATALOG 
        : TACTICAL_CATALOG.filter(item => item.category === activeCategory);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(5, 7, 14, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.25s ease-out'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                backgroundColor: 'rgba(15, 20, 32, 0.95)',
                border: '1px solid rgba(255, 60, 95, 0.35)',
                borderRadius: '16px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(232, 33, 58, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: '#FFFFFF'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(90deg, rgba(232, 33, 58, 0.15) 0%, transparent 100%)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #E8213A 0%, #750010 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            boxShadow: '0 0 15px rgba(232, 33, 58, 0.4)'
                        }}>
                            ⚡
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                {t('hub.title')}
                            </h2>
                            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)' }}>
                                {t('hub.subtitle')}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#FFFFFF',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content Container */}
                <div style={{
                    padding: '20px 24px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    {/* Status Badge */}
                    <div style={{
                        padding: '14px 18px',
                        borderRadius: '12px',
                        background: proStatus.isPro 
                            ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 100, 50, 0.25) 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.2) 100%)',
                        border: proStatus.isPro 
                            ? '1px solid rgba(0, 230, 118, 0.4)' 
                            : '1px solid rgba(255, 255, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>{proStatus.isPro ? '🛡️' : '⚪'}</span>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: proStatus.isPro ? '#00E676' : '#E2E8F0' }}>
                                    {proStatus.isPro ? 'ESTADO: MODO PRO SOBERANO ACTIVO' : 'ESTADO: NODO ESTÁNDAR'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    {proStatus.isPro 
                                        ? `Tiempo restante: ${proStatus.remainingHours} horas de beneficios activos` 
                                        : 'Sintoniza transmisiones patrocinadas para desbloquear beneficios Pro'}
                                </div>
                            </div>
                        </div>
                        <div style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: 'rgba(232, 33, 58, 0.2)',
                            border: '1px solid rgba(232, 33, 58, 0.4)',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#FF8599'
                        }}>
                            🪙 {proStatus.credits} CRÉDITOS
                        </div>
                    </div>

                    {/* Rewarded Video Card */}
                    <div style={{
                        padding: '20px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(232, 33, 58, 0.18) 0%, rgba(20, 10, 25, 0.6) 100%)',
                        border: '1px solid rgba(255, 60, 95, 0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                            <div>
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    letterSpacing: '1px',
                                    color: '#FF3355',
                                    textTransform: 'uppercase'
                                }}>
                                    ● ESTACIÓN DE RECOMPENSAS ADMOB
                                </span>
                                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 700 }}>
                                    Sintonizar Transmisión Patrocinada (+24h Pro)
                                </h3>
                            </div>
                            <span style={{ fontSize: '24px' }}>🎬</span>
                        </div>

                        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.5' }}>
                            Apoya directamente la red soberana viendo un video corto de 15 a 30 segundos. Al completar la transmisión recibirás <strong>+24 Horas de Acceso Pro</strong> y <strong>+100 Créditos Tácticos</strong>.
                        </p>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: '8px',
                            fontSize: '11px',
                            color: 'rgba(255, 255, 255, 0.75)'
                        }}>
                            <div>✓ Temas Visuales Militares</div>
                            <div>✓ Máxima Prioridad Mesh</div>
                            <div>✓ Cero Telemetría Invasiva</div>
                        </div>

                        {statusMessage && (
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                fontSize: '12px',
                                color: '#38BDF8'
                            }}>
                                {statusMessage}
                            </div>
                        )}

                        <button
                            onClick={handleWatchVideo}
                            disabled={isLoadingAd}
                            style={{
                                padding: '14px 20px',
                                borderRadius: '10px',
                                background: isLoadingAd 
                                    ? 'rgba(100, 100, 100, 0.5)'
                                    : 'linear-gradient(135deg, #E8213A 0%, #FF3355 100%)',
                                border: 'none',
                                color: '#FFFFFF',
                                fontSize: '14px',
                                fontWeight: 700,
                                letterSpacing: '0.5px',
                                cursor: isLoadingAd ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                boxShadow: '0 4px 15px rgba(232, 33, 58, 0.4)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {isLoadingAd ? '⏳ Conectando Transmisión...' : '📺 VER VIDEO & RECLAMAR +24H PRO'}
                        </button>
                    </div>

                    {/* Hardware Catalog Section */}
                    <div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                                    🛒 HARDWARE HOMOLOGADO & RADIOS
                                </h3>
                                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    Equipos compatibles para extender el alcance de la malla
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {filteredCatalog.map((item) => (
                                <div key={item.id} style={{
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '14px'
                                }}>
                                    <div style={{ fontSize: '28px', flexShrink: 0 }}>
                                        {item.icon}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{
                                                fontSize: '9px',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: 'rgba(56, 189, 248, 0.15)',
                                                color: '#38BDF8',
                                                fontWeight: 700
                                            }}>
                                                {item.tag}
                                            </span>
                                            <span style={{ fontSize: '11px', color: '#00E676', fontWeight: 700 }}>
                                                {item.priceEst}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                                            {item.title}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                            {item.description}
                                        </div>
                                    </div>
                                    <a
                                        href={item.affiliateUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            color: '#FFFFFF',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            textDecoration: 'none',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Ver Oferta ↗
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
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
                    <span>🛡️ Transmisiones Cifradas & Privacidad Blindada</span>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.7)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600
                        }}
                    >
                        Cerrar Panel
                    </button>
                </div>
            </div>
        </div>
    );
};

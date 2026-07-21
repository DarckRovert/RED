"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { BackupRestoreModal } from "./BackupRestoreModal";
import { NodeLogsModal } from "./NodeLogsModal";

// Animated counter hook
function useAnimatedCount(target: number) {
    const [count, setCount] = useState(target);
    useEffect(() => {
        setCount(target);
    }, [target]);
    return count;
}

interface StatCardProps {
    label: string;
    value: string | number;
    icon: string;
    color: string;
    glow?: boolean;
}

function StatCard({ label, value, icon, color, glow }: StatCardProps) {
    return (
        <div style={{
            padding: '16px', borderRadius: 'var(--radius-md)',
            background: `${color}0a`,
            border: `1px solid ${color}25`,
            display: 'flex', flexDirection: 'column', gap: '6px',
            boxShadow: glow ? `0 4px 20px ${color}15` : 'none',
            transition: 'all 0.3s ease',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                {value}
            </div>
        </div>
    );
}

export default function CryptoPanel() {
    const { identity, status, goBack } = useRedStore();
    const [vault, setVault] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [exportVisible, setExportVisible] = useState(false);
    const [exportCopied, setExportCopied] = useState(false);
    const [burnConfirm, setBurnConfirm] = useState(false);
    const [burnDone, setBurnDone] = useState(false);
    const [backupModalOpen, setBackupModalOpen] = useState(false);
    const [logsModalOpen, setLogsModalOpen] = useState(false);
    const [powerMode, setPowerMode] = useState<'high' | 'stealth'>(
        (localStorage.getItem('red_power_mode') as 'high' | 'stealth') || 'high'
    );

    // Fetch vault telemetry from /network/vault every 5s
    useEffect(() => {
        const fetchVault = async () => {
            try {
                const data = await RedAPI.req<any>('/network/vault');
                setVault(data);
            } catch {
                // Fallback to status endpoint data
                try { setVault(await RedAPI.getStatus()); } catch {}
            }
        };
        fetchVault();
        const interval = setInterval(fetchVault, 5000);
        return () => clearInterval(interval);
    }, []);

    const copyHash = () => {
        if (identity?.identity_hash) {
            navigator.clipboard.writeText(identity.identity_hash);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleExportKey = async () => {
        if (!identity?.identity_hash) return;
        const exportText = `RED Identity Backup
====================
Identity Hash (DID): ${identity.identity_hash}
Short ID: ${identity.short_id}
Algorithm: ${vault?.key_algorithm || 'Curve25519 + ChaCha20-Poly1305'}
Date: ${new Date().toISOString()}

IMPORTANT: Keep this backup secure. Never share it.
This is your sovereign cryptographic identity.`;

        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { Share } = await import('@capacitor/share');
                await Share.share({ title: 'RED Identity Backup', text: exportText, dialogTitle: 'Exportar Identidad RED' });
            } else {
                await navigator.clipboard.writeText(exportText);
                setExportCopied(true);
                setTimeout(() => setExportCopied(false), 3000);
            }
        } catch (e) {
            try {
                await navigator.clipboard.writeText(exportText);
                setExportCopied(true);
                setTimeout(() => setExportCopied(false), 3000);
            } catch {}
        }
    };

    const handleBurn = async () => {
        if (!burnConfirm) {
            setBurnConfirm(true);
            setTimeout(() => setBurnConfirm(false), 5000);
            return;
        }
        try {
            await RedAPI.setBurnerMode(true);
            setBurnDone(true);
        } catch {}
    };

    const hashDisplay = identity?.identity_hash || 'Generando bóveda Curve25519…';
    const noisePackets = vault?.noise_packets_sent ?? '--';
    const sybilBlocked = vault?.sybil_blocked ?? '--';
    const activeSessions = vault?.active_sessions ?? status?.peer_count ?? '--';
    const keyAlgo = vault?.key_algorithm || 'Curve25519 · Poly1305';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>

            {/* Header */}
            <header className="glass-panel" style={{
                padding: '0 20px', height: 'var(--header-h)',
                display: 'flex', alignItems: 'center', gap: '16px',
                borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                borderTop: 'none', flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(15,15,24,0.98) 0%, rgba(8,8,16,0.98) 100%)',
            }}>
                <button onClick={goBack} className="btn-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, #1a0a2e, #4a1080)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(155,89,182,0.4)', fontSize: '1.2rem',
                }}>🔐</div>
                <div>
                    <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Bóveda Criptográfica</h2>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>{keyAlgo} · Zero-Knowledge</p>
                </div>
            </header>

            <div className="scroll-container no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px calc(80px + var(--safe-bottom, 0px)) 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* DID Identity Card */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    border: '1px solid rgba(155,89,182,0.25)',
                    boxShadow: '0 8px 32px rgba(155,89,182,0.10)',
                }}>
                    <div style={{
                        padding: '14px 18px',
                        background: 'linear-gradient(135deg, rgba(50,15,80,0.9), rgba(20,5,40,0.95))',
                        borderBottom: '1px solid rgba(155,89,182,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#9b59b6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DID — Identidad Soberana</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Short ID: <span style={{ color: '#ba68c8', fontFamily: 'JetBrains Mono, monospace' }}>{identity?.short_id || '…'}</span>
                            </div>
                        </div>
                        <button
                            onClick={copyHash}
                            style={{
                                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                background: copied ? 'rgba(0,217,126,0.15)' : 'rgba(155,89,182,0.15)',
                                border: `1px solid ${copied ? 'var(--success)' : 'rgba(155,89,182,0.4)'}`,
                                color: copied ? 'var(--success)' : '#9b59b6',
                                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {copied ? '✓ Copiado' : 'Copiar'}
                        </button>
                    </div>
                    <div style={{
                        padding: '16px 18px', background: 'rgba(0,0,0,0.6)',
                        fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem',
                        color: '#00D97E', wordBreak: 'break-all', lineHeight: 1.8, letterSpacing: '0.5px',
                    }}>
                        {hashDisplay}
                    </div>
                </div>

                {/* Live Vault & Multi-Transport Telemetry */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--solid-border)',
                    overflow: 'hidden', background: 'linear-gradient(135deg, rgba(13,13,22,0.98), rgba(8,8,16,0.98))',
                }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--solid-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3498db', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Telemetría Multired · Vault Omega</div>
                        <div style={{ fontSize: '0.65rem', color: '#00D97E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>v16.0 Zenith PQC</div>
                    </div>
                    <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <StatCard label="Sesiones DR" value={activeSessions} icon="🔒" color="#9b59b6" glow />
                        <StatCard label="Peers WAN" value={status?.peer_count ?? 0} icon="🌐" color="#3498db" />
                        <StatCard label="Peers BLE" value={(window as any)?.meshPeerCounts?.ble ?? 0} icon="📡" color="#ba68c8" />
                        <StatCard label="Peers WiFi" value={(window as any)?.meshPeerCounts?.wifi ?? 0} icon="📶" color="#29b6f6" />
                        <StatCard label="Radio LoRa" value={(window as any)?.meshPeerCounts?.lora ?? 0} icon="📻" color="#e67e22" />
                        <StatCard label="Ruido Blanco" value={noisePackets} icon="🌊" color="#FFA726" glow={noisePackets !== '--' && noisePackets > 0} />
                        <StatCard label="Sybil Bloq." value={sybilBlocked} icon="🛡️" color="var(--danger)" glow={sybilBlocked !== '--' && (sybilBlocked as number) > 0} />
                        <StatCard label="Cadena" value={vault?.chain_height ?? status?.chain_height ?? 0} icon="⛓️" color="#26A69A" />
                    </div>
                </div>

                {/* Export Key */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--solid-border)',
                    overflow: 'hidden', background: 'linear-gradient(135deg, rgba(13,13,22,0.98), rgba(8,8,16,0.98))',
                }}>
                    <button
                        onClick={() => setExportVisible(!exportVisible)}
                        style={{
                            width: '100%', padding: '16px 20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'transparent', color: 'var(--text-primary)', border: 'none', cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Exportar Clave Privada E2E</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>HexDump · {keyAlgo}</div>
                            </div>
                        </div>
                        <span style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: exportVisible ? 'rotate(90deg)' : 'none' }}>›</span>
                    </button>
                    {exportVisible && (
                        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{
                                padding: '12px', borderRadius: 'var(--radius-sm)', background: 'rgba(232,33,58,0.08)',
                                border: '1px solid rgba(232,33,58,0.2)', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.6,
                            }}>
                                ⚠️ Guarda esta clave en un lugar seguro. Cualquier persona con acceso puede suplantar tu identidad.
                            </div>
                            <button
                                className="btn-primary"
                                onClick={handleExportKey}
                                style={{ borderRadius: 'var(--radius-md)', padding: '12px', fontSize: '0.9rem' }}
                            >
                                {exportCopied ? '✓ Copiado al portapapeles' : 'Descargar HexDump Cifrado'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Encrypted Backup & Migration Card */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--solid-border)',
                    overflow: 'hidden', background: 'linear-gradient(135deg, rgba(13,13,22,0.98), rgba(8,8,16,0.98))',
                }}>
                    <button
                        onClick={() => setBackupModalOpen(true)}
                        style={{
                            width: '100%', padding: '16px 20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'transparent', color: 'var(--text-primary)', border: 'none', cursor: 'pointer',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '1.2rem' }}>📦</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Respaldo & Migración Cifrada (.redbak)</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Copia de seguridad protegida con clave</div>
                            </div>
                        </div>
                        <span style={{ color: 'var(--primary-bright)', fontWeight: 700, fontSize: '0.82rem' }}>Gestionar →</span>
                    </button>
                </div>

                {/* Backup & Restore Modal */}
                {backupModalOpen && (
                    <BackupRestoreModal onClose={() => setBackupModalOpen(false)} />
                )}

                {/* Tactical Power Profile Card */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--solid-border)',
                    overflow: 'hidden', background: 'linear-gradient(135deg, rgba(13,13,22,0.98), rgba(8,8,16,0.98))',
                    padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚡</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Perfil Energético Táctico</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {powerMode === 'high' ? 'Modo Rendimiento Máximo (Polling 2s)' : 'Modo Sigilo Ahorro (Polling 10s)'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const next = powerMode === 'high' ? 'stealth' : 'high';
                            setPowerMode(next);
                            localStorage.setItem('red_power_mode', next);
                        }}
                        style={{
                            padding: '8px 14px', borderRadius: '10px',
                            background: powerMode === 'high' ? 'rgba(0,217,126,0.15)' : 'rgba(41,182,246,0.15)',
                            border: `1px solid ${powerMode === 'high' ? 'rgba(0,217,126,0.35)' : 'rgba(41,182,246,0.35)'}`,
                            color: powerMode === 'high' ? '#00D97E' : '#29B6F6',
                            fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer'
                        }}
                    >
                        {powerMode === 'high' ? '⚡ Máximo' : '🔋 Sigilo'}
                    </button>
                </div>
                <div style={{
                    borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,217,126,0.25)',
                    overflow: 'hidden', background: 'linear-gradient(135deg, rgba(5,15,10,0.95), rgba(2,8,5,0.98))',
                    padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📟</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#00D97E' }}>Consola de Logs Rust</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Trazabilidad en tiempo real de eventos P2P</div>
                        </div>
                    </div>
                    <button
                        onClick={() => setLogsModalOpen(true)}
                        style={{
                            padding: '8px 14px', borderRadius: '10px',
                            background: 'rgba(0,217,126,0.15)', border: '1px solid rgba(0,217,126,0.35)',
                            color: '#00D97E', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer'
                        }}
                    >
                        Abrir 📟
                    </button>
                </div>

                {/* Node Logs Modal */}
                {logsModalOpen && (
                    <NodeLogsModal onClose={() => setLogsModalOpen(false)} />
                )}

                {/* ── PÁNICO / BURN BUTTON ─────────────────────────────── */}
                <div style={{
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    border: `1px solid ${burnConfirm ? 'rgba(232,33,58,0.5)' : 'rgba(232,33,58,0.2)'}`,
                    background: burnConfirm
                        ? 'linear-gradient(135deg, rgba(80,5,5,0.9), rgba(40,0,0,0.95))'
                        : 'linear-gradient(135deg, rgba(20,5,5,0.9), rgba(13,0,0,0.95))',
                    transition: 'all 0.3s ease',
                    boxShadow: burnConfirm ? '0 0 24px rgba(232,33,58,0.2)' : 'none',
                }}>
                    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${burnConfirm ? 'rgba(232,33,58,0.3)' : 'rgba(232,33,58,0.1)'}` }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🔥 MODO QUEMAR / PÁNICO
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Purga todas las claves y datos · Acción irreversible
                        </div>
                    </div>
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {burnDone ? (
                            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--danger)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}>
                                🔥 Identidad quemada. Reinicia la app.
                            </div>
                        ) : (
                            <>
                                {burnConfirm && (
                                    <div style={{
                                        padding: '10px 14px', background: 'rgba(232,33,58,0.12)',
                                        border: '1px solid rgba(232,33,58,0.3)',
                                        borderRadius: 'var(--radius-sm)', color: '#ff6b6b', fontSize: '0.78rem', lineHeight: 1.6,
                                    }}>
                                        ⚠️ CONFIRMA: Se purgarán TODAS las conversaciones, contactos y claves criptográficas. Pulsa de nuevo para ejecutar.
                                    </div>
                                )}
                                <button
                                    onClick={handleBurn}
                                    style={{
                                        width: '100%', padding: '13px', borderRadius: 'var(--radius-md)',
                                        background: burnConfirm ? 'rgba(232,33,58,0.25)' : 'rgba(232,33,58,0.08)',
                                        border: `1px solid ${burnConfirm ? 'rgba(232,33,58,0.6)' : 'rgba(232,33,58,0.25)'}`,
                                        color: burnConfirm ? '#ff4444' : 'var(--danger)',
                                        fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer',
                                        letterSpacing: '0.5px', transition: 'all 0.2s ease',
                                        animation: burnConfirm ? 'pulse 0.8s infinite' : 'none',
                                    }}
                                >
                                    {burnConfirm ? '🔥 CONFIRMAR PURGA TOTAL' : '🔥 Iniciar Modo Pánico'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

            </div>

            <style>{`
                @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,33,58,0.3); } 50% { box-shadow: 0 0 0 6px rgba(232,33,58,0); } }
            `}</style>
        </div>
    );
}

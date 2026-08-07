"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";
import { BlockDetailsModal } from "./BlockDetailsModal";
import { LocalAIEngine } from "../lib/localAiEngine";

interface BlockItem {
    height: number;
    hash: string;
    prev_hash: string;
    timestamp: number;
    tx_count: number;
    validator: string;
}

interface ValidatorItem {
    public_key: string;
    stake: number;
    active: boolean;
    blocks_produced: number;
    missed_slots: number;
    weight: number;
}

interface ConsensusStatus {
    epoch: number;
    current_slot: number;
    total_stake: number;
    active_validators: number;
    chain_height: number;
}

type TabType = 'blocks' | 'validators' | 'consensus' | 'stake';

function timeAgo(ts: number, isGenesis = false): string {
    if (isGenesis || ts <= 1704067200) {
        return 'Génesis (Red Omega)';
    }
    const secs = Math.floor(Date.now() / 1000 - ts);
    if (secs < 0) return 'Ahora mismo';
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
    return `${Math.floor(secs / 86400)}d`;
}

export default function BlockchainExplorer() {
    const { identity, status, goBack } = useRedStore();
    const [blocks, setBlocks] = useState<BlockItem[]>([]);
    const [validators, setValidators] = useState<ValidatorItem[]>([]);
    const [consensus, setConsensus] = useState<ConsensusStatus | null>(null);
    const [tab, setTab] = useState<TabType>('blocks');
    const [loading, setLoading] = useState(true);
    const [newBlock, setNewBlock] = useState(false);
    const [selectedBlock, setSelectedBlock] = useState<BlockItem | null>(null);

    // AI Audit state
    const [aiAudit, setAiAudit] = useState<string | null>(null);
    const [auditLoading, setAuditLoading] = useState(false);

    const handleRunAiAudit = async () => {
        setAuditLoading(true);
        setAiAudit(null);
        try {
            const activeVal = consensus?.active_validators ?? 1;
            const totalStk = (consensus?.total_stake ?? 1000000000000) / 1000;
            const prompt = `Pregunta: ¿Cuál es el estado de salud de esta red blockchain local con altura ${chainHeight}, ${activeVal} validador activo y ${totalStk}K RED en stake?
Respuesta en español: El estado de la red blockchain local es`;
            const res = await LocalAIEngine.generateCopilotResponse(prompt);
            // Clean up model header tags and normalize text
            let cleanText = res.answer
                .replace(/🤖 COPILOTO IA NEURONAL REAL \(LaMini-Flan-T5 ONNX WASM\)\n\n/g, '')
                .replace(/📚 \[Fundamento RAG Táctico:.*\]/g, '')
                .trim();

            if (!cleanText.startsWith('El estado de la red')) {
                cleanText = `El estado de la red blockchain local es: ${cleanText}`;
            }

            setAiAudit(cleanText);
        } catch (e: any) {
            setAiAudit(`⚠️ Error en auditoría ONNX: ${e.message}`);
        } finally {
            setAuditLoading(false);
        }
    };

    // Staking states
    const [stakeAmount, setStakeAmount] = useState("");
    const [stakingStatus, setStakingStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [stakingError, setStakingError] = useState("");

    const handleStake = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseInt(stakeAmount);
        if (isNaN(amt) || amt <= 0) {
            setStakingError("Ingresa un monto válido mayor a 0");
            return;
        }
        if (amt < 1000) {
            setStakingError("El monto mínimo para registrarse como validador es de 1,000 tokens.");
            return;
        }
        setStakingStatus("loading");
        setStakingError("");
        try {
            await RedAPI.stakeTokens(amt);
            setStakingStatus("success");
            setStakeAmount("");
            // Refresh telemetry after staking
            const updatedValidators = await RedAPI.req<ValidatorItem[]>('/blockchain/validators').catch(() => []);
            setValidators(updatedValidators);
            const updatedConsensus = await RedAPI.req<ConsensusStatus>('/blockchain/consensus').catch(() => null);
            setConsensus(updatedConsensus);
            setTimeout(() => setStakingStatus("idle"), 3000);
        } catch (err: any) {
            setStakingStatus("error");
            setStakingError(err?.message || "Error al realizar la operación de staking.");
            setTimeout(() => setStakingStatus("idle"), 5000);
        }
    };

    useEffect(() => {
        let isActive = true;
        let prevHeight = -1;

        const fetchData = async () => {
            try {
                const liveState = useRedStore.getState();
                const currentStatus = liveState.status;
                const currentIdentity = liveState.identity;

                const [blockData, validatorData, consensusData] = await Promise.all([
                    RedAPI.req<BlockItem[]>('/blockchain/blocks').catch(() => []),
                    RedAPI.req<ValidatorItem[]>('/blockchain/validators').catch(() => []),
                    RedAPI.req<ConsensusStatus>('/blockchain/consensus').catch(() => null),
                ]);
                if (isActive) {
                    const finalBlocks = Array.isArray(blockData) ? blockData : [];
                    if (finalBlocks.length > 0 && finalBlocks[0].height !== prevHeight && prevHeight !== -1) {
                        setNewBlock(true);
                        setTimeout(() => setNewBlock(false), 1200);
                    }
                    prevHeight = finalBlocks[0]?.height ?? -1;
                    setBlocks(finalBlocks);
                    setValidators(Array.isArray(validatorData) ? validatorData : []);
                    setConsensus(consensusData || null);
                    setLoading(false);
                }
            } catch (e) {
                if (isActive) setLoading(false);
            }
        };

        fetchData();
        const intv = setInterval(fetchData, 4000);
        return () => { isActive = false; clearInterval(intv); };
    }, []);

    const TABS: { key: TabType; label: string; icon: string }[] = [
        { key: 'blocks',     label: 'Bloques',      icon: '🔗' },
        { key: 'validators', label: 'Validadores',   icon: '🛡️' },
        { key: 'consensus',  label: 'Consenso',      icon: '⚡' },
        { key: 'stake',      label: 'Staking',      icon: '💎' },
    ];

    const chainHeight = consensus?.chain_height ?? status?.chain_height ?? blocks[0]?.height ?? 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-deep)' }}>

            {/* Premium Header */}
            <header style={{
                padding: '0 20px', height: 'var(--header-h)',
                display: 'flex', alignItems: 'center', gap: '14px',
                borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                borderTop: 'none', flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(8,18,30,0.85) 0%, rgba(5,10,20,0.95) 100%)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(52,152,219,0.15)',
            }}>
                <button onClick={goBack} className="btn-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                    </svg>
                </button>
                <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                    background: 'linear-gradient(135deg, #0d2137, #1a4a7a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', boxShadow: '0 4px 16px rgba(52,152,219,0.35)',
                }}>🔗</div>
                <div>
                    <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>RED Explorer</h2>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
                        Omega Consensus · Ed25519 · Kademlia DHT
                    </p>
                </div>
                {/* Live chain height pill */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                    background: newBlock ? 'rgba(0,217,126,0.15)' : 'rgba(52,152,219,0.1)',
                    border: `1px solid ${newBlock ? 'rgba(0,217,126,0.4)' : 'rgba(52,152,219,0.25)'}`,
                    borderRadius: 20, padding: '4px 12px', transition: 'all 0.4s ease',
                    flexShrink: 0
                }}>
                    <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: newBlock ? 'var(--success)' : '#3498db',
                        boxShadow: `0 0 6px ${newBlock ? 'var(--success)' : '#3498db'}`,
                        animation: 'pulse 2s infinite',
                    }} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem',
                        color: newBlock ? 'var(--success)' : '#3498db', fontWeight: 700 }}>
                        #{chainHeight}
                    </span>
                </div>
            </header>

            {/* Stats Row */}
            <div style={{ padding: '16px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, flexShrink: 0 }}>
                {[
                    { label: 'Altura', value: chainHeight, color: '#3498db', icon: '📏' },
                    { label: 'Validadores', value: consensus?.active_validators ?? validators.filter(v => v.active).length, color: '#9b59b6', icon: '🛡️' },
                    { label: 'Stake Total', value: consensus ? `${(consensus.total_stake / 1000).toFixed(1)}K` : '--', color: '#00D97E', icon: '💎' },
                ].map(s => (
                    <div key={s.label} style={{
                        padding: '12px', borderRadius: 'var(--radius-md)',
                        background: `linear-gradient(135deg, ${s.color}15, ${s.color}05)`,
                        border: `1px solid ${s.color}30`,
                        backdropFilter: 'blur(10px)',
                        display: 'flex', flexDirection: 'column', gap: 3,
                    }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            {s.icon} {s.label}
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8, flexShrink: 0 }}>
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        style={{
                            flex: 1, padding: '9px 4px', borderRadius: 'var(--radius-md)',
                            background: tab === t.key ? 'linear-gradient(135deg, rgba(52,152,219,0.2), rgba(52,152,219,0.05))' : 'rgba(0,0,0,0.3)',
                            border: `1px solid ${tab === t.key ? 'rgba(52,152,219,0.5)' : 'rgba(255,255,255,0.05)'}`,
                            backdropFilter: 'blur(10px)',
                            color: tab === t.key ? '#3498db' : 'var(--text-muted)',
                            boxShadow: tab === t.key ? '0 4px 16px rgba(52,152,219,0.2)' : 'none',
                            fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="scroll-container" style={{ flex: 1, padding: '14px 16px calc(80px + var(--safe-bottom, 0px)) 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                
                {/* AI Audit Action Bar */}
                <button
                    onClick={handleRunAiAudit}
                    disabled={auditLoading}
                    style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(232,33,58,0.2), rgba(155,89,182,0.2))',
                        border: '1px solid rgba(232,33,58,0.4)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(232,33,58,0.2)'
                    }}
                >
                    {auditLoading ? '⏳ Ejecutando Inferencia ONNX WASM...' : '🤖 Auditar Salud de Cadena con IA Neuronal'}
                </button>

                {/* AI Audit Output Card */}
                {aiAudit && (
                    <div style={{
                        padding: '14px 16px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(232,33,58,0.15), rgba(15,23,42,0.9))',
                        border: '1px solid rgba(232,33,58,0.4)', backdropFilter: 'blur(12px)',
                        marginBottom: '4px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#E8213A', textTransform: 'uppercase' }}>
                                🤖 AUDITORÍA IA DE SALUD DE CADENA (LaMini-Flan-T5 ONNX)
                            </span>
                            <button onClick={() => setAiAudit(null)} style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: '0.9rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.5, color: '#e2e8f0' }}>
                            {aiAudit}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid #3498db', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontFamily: 'JetBrains Mono, monospace' }}>
                            Sincronizando cadena Omega...
                        </span>
                    </div>
                ) : tab === 'blocks' ? (
                    blocks.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)',
                            background: 'linear-gradient(135deg, rgba(20,30,45,0.6), rgba(10,15,25,0.8))',
                            borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚡</div>
                            <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem', marginBottom: 6 }}>Cadena Local Inicializada</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '340px', margin: '0 auto 16px' }}>
                                Tu nodo Rust está sincronizado y listo para forjar bloques en la siguiente época de consenso.
                            </div>
                            <span style={{
                                padding: '4px 12px', borderRadius: '8px',
                                background: 'rgba(0,217,126,0.12)', border: '1px solid rgba(0,217,126,0.3)',
                                color: '#00D97E', fontSize: '0.72rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace'
                            }}>
                                ENGINE STATUS: LIVE & SYNCED
                            </span>
                        </div>
                    ) : blocks.map((b, i) => (
                        <div key={b.hash} onClick={() => setSelectedBlock(b)} className="explorer-card" style={{
                            padding: '14px 16px',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            background: i === 0 && newBlock
                                ? 'linear-gradient(135deg, rgba(0,217,126,0.15), rgba(0,0,0,0.6))'
                                : 'linear-gradient(135deg, rgba(20,30,40,0.6), rgba(10,15,20,0.8))',
                            border: `1px solid ${i === 0 ? 'rgba(52,152,219,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            backdropFilter: 'blur(12px)',
                            transition: 'all 0.4s ease',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        fontWeight: 900, fontSize: '0.9rem',
                                        color: i === 0 ? '#3498db' : 'var(--text-primary)',
                                        fontFamily: 'JetBrains Mono, monospace',
                                    }}>
                                        #{b.height}
                                    </span>
                                    {i === 0 && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700,
                                            background: 'rgba(52,152,219,0.15)',
                                            border: '1px solid rgba(52,152,219,0.3)',
                                            color: '#3498db', borderRadius: 10, padding: '1px 8px',
                                            letterSpacing: '0.4px',
                                        }}>ÚLTIMO</span>
                                    )}
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {timeAgo(b.timestamp, b.height === 0)}
                                </span>
                            </div>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', lineHeight: 1.8 }}>
                                <div style={{ color: 'var(--success)', marginBottom: 2 }}>
                                    HASH: {b.hash.substring(0, 32)}…
                                </div>
                                <div style={{ color: 'var(--text-muted)' }}>
                                    PREV: {b.prev_hash.substring(0, 20)}… · TX: {b.tx_count} · VAL: {b.validator.substring(0, 12)}…
                                </div>
                            </div>
                        </div>
                    ))
                ) : tab === 'validators' ? (
                    validators.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 10 }}>🛡️</div>
                            Sin validadores registrados aún.
                        </div>
                    ) : validators.map((v, i) => (
                        <div key={v.public_key} className="explorer-card" style={{
                            padding: '14px 16px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, rgba(25,15,35,0.6), rgba(15,10,20,0.8))',
                            border: `1px solid ${v.active ? 'rgba(155,89,182,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            backdropFilter: 'blur(12px)',
                            display: 'flex', alignItems: 'center', gap: 14,
                        }}>
                            <div style={{
                                width: 38, height: 38, borderRadius: '50%',
                                background: v.active ? 'linear-gradient(135deg, #6c3483, #9b59b6)' : 'var(--bg-lifted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 900, fontSize: '0.9rem', color: 'white', flexShrink: 0,
                                boxShadow: v.active ? '0 4px 12px rgba(155,89,182,0.35)' : 'none',
                            }}>
                                {i + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: v.active ? '#ba68c8' : 'var(--text-muted)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {v.public_key.substring(0, 28)}…
                                </div>
                                <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    <span>Stake: <strong style={{ color: '#9b59b6' }}>{v.stake.toLocaleString()}</strong></span>
                                    <span>Bloq: <strong style={{ color: 'var(--success)' }}>{v.blocks_produced}</strong></span>
                                    <span>Miss: <strong style={{ color: v.missed_slots > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{v.missed_slots}</strong></span>
                                </div>
                            </div>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                background: v.active ? 'var(--success)' : 'var(--text-muted)',
                                boxShadow: v.active ? '0 0 8px var(--success)' : 'none',
                            }} />
                        </div>
                    ))
                ) : tab === 'consensus' ? (
                    // Consensus tab
                    consensus ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { label: 'Época (Epoch)', value: consensus.epoch, icon: '🕐', color: '#3498db' },
                                { label: 'Slot Actual', value: consensus.current_slot, icon: '📍', color: '#9b59b6' },
                                { label: 'Stake Total', value: consensus.total_stake.toLocaleString(), icon: '💎', color: '#00D97E' },
                                { label: 'Validadores Activos', value: consensus.active_validators, icon: '🛡️', color: '#FFA726' },
                                { label: 'Altura de Cadena', value: consensus.chain_height, icon: '🔗', color: '#3498db' },
                            ].map(row => (
                                <div key={row.label} style={{
                                    padding: '16px 20px',
                                    borderRadius: '16px',
                                    background: `linear-gradient(135deg, ${row.color}15, rgba(0,0,0,0.4))`,
                                    border: `1px solid ${row.color}30`,
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: '1.1rem' }}>{row.icon}</span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</span>
                                    </div>
                                    <span style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: '1rem', fontWeight: 900, color: row.color,
                                    }}>{row.value}</span>
                                </div>
                            ))}

                                {/* Visual P2P Mesh Topology HUD */}
                                <div style={{
                                    padding: '16px', borderRadius: '16px',
                                    background: 'linear-gradient(135deg, rgba(10,20,35,0.9), rgba(5,10,18,0.95))',
                                    border: '1px solid rgba(41,182,246,0.3)', backdropFilter: 'blur(12px)',
                                    display: 'flex', flexDirection: 'column', gap: '10px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#29B6F6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topología de Malla P2P</div>
                                        <span style={{ fontSize: '0.68rem', color: '#00D97E', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>● SALUDABLE</span>
                                    </div>
                                    <div style={{ height: '90px', borderRadius: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {/* Center Node */}
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 16px var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900, color: 'white', zIndex: 2 }}>TÚ</div>
                                        {/* Orbital Nodes */}
                                        {[0, 60, 120, 180, 240, 300].map((deg, idx) => {
                                            const rad = (deg * Math.PI) / 180;
                                            const x = Math.cos(rad) * 65;
                                            const y = Math.sin(rad) * 32;
                                            return (
                                                <React.Fragment key={deg}>
                                                    <div style={{
                                                        position: 'absolute', width: 2, height: Math.hypot(x, y),
                                                        background: 'linear-gradient(180deg, rgba(41,182,246,0.4), transparent)',
                                                        transformOrigin: 'top center',
                                                        transform: `translate(${x}px, ${y}px) rotate(${deg}deg)`,
                                                        opacity: 0.6
                                                    }} />
                                                    <div style={{
                                                        position: 'absolute', width: 14, height: 14, borderRadius: '50%',
                                                        background: idx % 2 === 0 ? '#00D97E' : '#29B6F6',
                                                        boxShadow: `0 0 8px ${idx % 2 === 0 ? '#00D97E' : '#29B6F6'}`,
                                                        transform: `translate(${x}px, ${y}px)`,
                                                        zIndex: 2
                                                    }} />
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 10 }}>⚡</div>
                                Esperando datos de consenso…
                            </div>
                        )
                ) : (
                    // Staking tab
                    (() => {
                        const myPubKeyHex = identity?.public_key;
                        const myValidator = validators.find(v => v.public_key === myPubKeyHex);

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="animate-fade">
                                {/* Status HUD Card */}
                                <div style={{
                                    padding: '16px 20px',
                                    borderRadius: '16px',
                                    background: 'linear-gradient(135deg, rgba(52,152,219,0.1), rgba(10,15,20,0.8))',
                                    border: `1px solid ${myValidator ? 'rgba(0,217,126,0.3)' : 'rgba(52,152,219,0.2)'}`,
                                    backdropFilter: 'blur(12px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '1.2rem' }}>💎</span>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                                Estado de tu Nodo Validador
                                            </span>
                                        </div>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            borderRadius: 10,
                                            padding: '2px 8px',
                                            background: myValidator ? 'rgba(0,217,126,0.15)' : 'rgba(255,255,255,0.05)',
                                            color: myValidator ? 'var(--success)' : 'var(--text-muted)',
                                            border: `1px solid ${myValidator ? 'rgba(0,217,126,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                        }}>
                                            {myValidator ? "REGISTRADO" : "NO REGISTRADO"}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Clave Pública:</span>
                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                                                {myPubKeyHex ? `${myPubKeyHex.substring(0, 16)}...${myPubKeyHex.substring(myPubKeyHex.length - 8)}` : "Desconocida"}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Stake Delegado:</span>
                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#9b59b6', fontWeight: 700 }}>
                                                {myValidator ? `${myValidator.stake.toLocaleString()} RED` : "0 RED"}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Bloques Producidos:</span>
                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--success)', fontWeight: 700 }}>
                                                {myValidator ? myValidator.blocks_produced : "0"}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Slots Perdidos:</span>
                                            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: myValidator && myValidator.missed_slots > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                {myValidator ? myValidator.missed_slots : "0"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Real-time Voting Power Bar */}
                                    {(() => {
                                        const totalStakeVal = consensus?.total_stake || 0;
                                        const myStakeVal = myValidator?.stake || 0;
                                        const votingPowerPct = totalStakeVal > 0 ? (myStakeVal as number / totalStakeVal as number) * 100 : 0;
                                        
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    <span>Influencia en el Consenso:</span>
                                                    <span style={{ color: '#00D97E', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                                                        {votingPowerPct.toFixed(3)}%
                                                    </span>
                                                </div>
                                                <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                    <div style={{ width: `${votingPowerPct}%`, height: '100%', background: 'linear-gradient(90deg, #9b59b6, #00D97E)', borderRadius: 'inherit', boxShadow: '0 0 8px rgba(0,217,126,0.5)' }} />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Staking Action Card */}
                                <div style={{
                                    padding: '20px',
                                    borderRadius: '16px',
                                    background: 'rgba(20,30,40,0.5)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    backdropFilter: 'blur(12px)',
                                }}>
                                    <h3 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                                        Participar en el Consenso PoS-BFT
                                    </h3>
                                    <form onSubmit={handleStake} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                                CANTIDAD A DELEGAR (Mínimo 1,000 RED)
                                            </label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="number"
                                                    value={stakeAmount}
                                                    onChange={e => setStakeAmount(e.target.value)}
                                                    placeholder="1000"
                                                    disabled={stakingStatus === "loading"}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 40px 12px 14px',
                                                        background: 'rgba(0,0,0,0.4)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '12px',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '1rem',
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        outline: 'none',
                                                        boxSizing: 'border-box',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    className="stake-input"
                                                />
                                                <span style={{ position: 'absolute', right: 14, top: 12, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                    RED
                                                </span>
                                            </div>
                                        </div>

                                        {stakingError && (
                                            <p style={{ color: 'var(--danger)', fontSize: '0.75rem', margin: 0 }}>
                                                ⚠️ {stakingError}
                                            </p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={stakingStatus === "loading" || !stakeAmount}
                                            style={{
                                                padding: '12px',
                                                background: stakingStatus === "success"
                                                    ? 'var(--success)'
                                                    : stakingStatus === "error"
                                                    ? 'var(--danger)'
                                                    : 'linear-gradient(135deg, #0d2137, #1a4a7a)',
                                                border: `1px solid ${stakingStatus === "success" ? 'var(--success)' : 'rgba(52,152,219,0.3)'}`,
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 4px 14px rgba(52,152,219,0.2)',
                                            }}
                                            className="stake-btn"
                                        >
                                            {stakingStatus === "loading"
                                                ? "PROCESANDO TRANSACCIÓN..."
                                                : stakingStatus === "success"
                                                ? "✓ STAKE REGISTRADO"
                                                : stakingStatus === "error"
                                                ? "ERROR EN TRANSACCIÓN"
                                                : "DELEGAR STAKE"}
                                        </button>
                                    </form>
                                </div>

                                {/* Security Disclaimer Card */}
                                <div style={{
                                    padding: '14px 16px',
                                    borderRadius: '16px',
                                    background: 'rgba(232,33,58,0.04)',
                                    border: '1px solid rgba(232,33,58,0.15)',
                                    display: 'flex',
                                    gap: 12,
                                    alignItems: 'flex-start',
                                }}>
                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🛡️</span>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                        <strong style={{ color: 'var(--danger)', display: 'block', marginBottom: 2 }}>
                                            REGLAS DE PENALIZACIÓN (SLASHING)
                                        </strong>
                                        El protocolo Omega Consensus de RED penaliza el comportamiento malicioso. Si tu nodo firma dos bloques diferentes en el mismo slot (Double Signing) perderá el 20% de su stake y se desactivará de inmediato. Perder slots por inactividad prolongada descuenta el 5% de tu stake.
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
                
                .explorer-card {
                    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s ease, border-color 0.22s ease !important;
                    cursor: pointer;
                }
                .explorer-card:hover {
                    transform: translateY(-2px) translateY(0);
                    transform: translateY(-3px) scale(1.008);
                    box-shadow: 0 8px 30px rgba(52, 152, 219, 0.15) !important;
                    border-color: rgba(52, 152, 219, 0.45) !important;
                }
                .stake-input:focus {
                    border-color: rgba(52, 152, 219, 0.6) !important;
                    box-shadow: 0 0 12px rgba(52, 152, 219, 0.2) !important;
                }
                .stake-btn:hover:not(:disabled) {
                    transform: scale(1.015);
                    box-shadow: 0 6px 20px rgba(52, 152, 219, 0.35) !important;
                    filter: brightness(1.1);
                }
                .stake-btn:active:not(:disabled) {
                    transform: scale(0.985);
                }
            `}</style>
            {/* Block Details Modal */}
            {selectedBlock && (
                <BlockDetailsModal block={selectedBlock} onClose={() => setSelectedBlock(null)} />
            )}
        </div>
    );
}

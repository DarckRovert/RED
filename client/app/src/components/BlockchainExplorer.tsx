"use client";

import React, { useEffect, useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { RedAPI } from "../lib/api";

interface BlockItem {
    height: number;
    hash: string;
    prev_hash: string;
    timestamp: number;
    tx_count: number;
    validator: string;
}

interface IdentityItem {
    identity_hash: string;
    public_key: string;
    verifying_key: string;
    registered_at: number;
    revoked: boolean;
}

export default function BlockchainExplorer() {
    const { status, goBack } = useRedStore();
    const [blocks, setBlocks] = useState<BlockItem[]>([]);
    const [identities, setIdentities] = useState<IdentityItem[]>([]);
    const [tab, setTab] = useState<'blocks' | 'identities'>('blocks');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isActive = true;
        const fetchData = async () => {
            try {
                const [blockData, identityData] = await Promise.all([
                    RedAPI.req<BlockItem[]>('/blocks'),
                    RedAPI.req<IdentityItem[]>('/blockchain/identities')
                ]);
                if (isActive) {
                    setBlocks(blockData);
                    setIdentities(identityData);
                    setLoading(false);
                }
            } catch (e) {
                console.error("Failed to fetch Omega Protocol data", e);
                if (isActive) setLoading(false);
            }
        };

        fetchData();
        const intv = setInterval(fetchData, 3000);
        return () => {
            isActive = false;
            clearInterval(intv);
        };
    }, []);

    return (
        <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
                <button onClick={goBack} style={{ background: 'transparent', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>←</button>
                <div>
                    <h1 style={{ fontSize: '1.8rem', margin: 0, color: 'var(--text-primary)' }}>🔗 RED Explorer</h1>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Protocolo de Consenso: Omega (Ed25519)</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--primary)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Altura de Cadena (Height)</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>{status?.chain_height || blocks[0]?.height || 0}</div>
                </div>
                <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Milisegundos de Propagación</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>{status?.gossip_latency_ms || '< 15'} ms</div>
                </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--solid-border)', marginBottom: '16px' }}>
                <button 
                    onClick={() => setTab('blocks')}
                    style={{ padding: '12px 24px', background: 'transparent', color: tab === 'blocks' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: tab === 'blocks' ? '2px solid var(--primary)' : 'none', fontWeight: 'bold' }}>
                    Bloques
                </button>
                <button 
                    onClick={() => setTab('identities')}
                    style={{ padding: '12px 24px', background: 'transparent', color: tab === 'identities' ? 'var(--primary)' : 'var(--text-muted)', borderBottom: tab === 'identities' ? '2px solid var(--primary)' : 'none', fontWeight: 'bold' }}>
                    Identidades
                </button>
            </div>

            <h3 style={{ color: 'var(--text-secondary)' }}>{tab === 'blocks' ? 'Últimos Bloques (L1 Sovereign)' : 'Registro de Identidades (On-Chain)'}</h3>
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Sincronizando Omega MPT...</div>
                ) : tab === 'blocks' ? (
                    blocks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay bloques generados.</div>
                    ) : (
                        blocks.map((b) => (
                            <div key={b.hash} className="glass-panel" style={{ padding: '16px', borderRadius: '12px' }}>
                                {/* ... existing block UI ... */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>Bloque #{b.height}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {new Date(b.timestamp * 1000).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                    <div>Hash: {b.hash.substring(0, 24)}...</div>
                                    <div style={{ color: 'var(--text-muted)' }}>TX: {b.tx_count} | Val: {b.validator.substring(0, 8)}</div>
                                </div>
                            </div>
                        ))
                    )
                ) : (
                    identities.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No hay identidades registradas.</div>
                    ) : (
                        identities.map((id) => (
                            <div key={id.identity_hash} className="glass-panel" style={{ padding: '16px', borderRadius: '12px', borderLeft: id.revoked ? '4px solid var(--danger)' : '4px solid var(--success)' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Identity: {id.identity_hash.substring(0, 16)}...</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Registered: {new Date(id.registered_at * 10).toLocaleString()} {/* height-based mock time */}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    VerifyingKey: {id.verifying_key}
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
}

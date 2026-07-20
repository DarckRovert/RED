import React from "react";
import { toast } from "./Toast";

interface BlockDetailsModalProps {
    block: {
        height: number;
        hash: string;
        prev_hash: string;
        timestamp: number;
        tx_count: number;
        validator: string;
    };
    onClose: () => void;
}

export const BlockDetailsModal: React.FC<BlockDetailsModalProps> = ({ block, onClose }) => {
    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`✅ ${label} copiado`);
        } catch {
            toast.error("Error al copiar");
        }
    };

    return (
        <div 
            className="animate-fade"
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(5,5,12,0.85)', backdropFilter: 'blur(14px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
            }}
            onClick={onClose}
        >
            <div 
                className="animate-pop glass-panel"
                style={{
                    width: '100%', maxWidth: '520px', padding: '24px',
                    borderRadius: '24px', background: 'linear-gradient(145deg, #0f1522, #0a0e17)',
                    border: '1px solid rgba(52,152,219,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📦</span>
                        <div>
                            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                                Bloque #{block.height}
                            </h2>
                            <div style={{ fontSize: '0.72rem', color: '#3498db', fontFamily: 'JetBrains Mono, monospace' }}>
                                PROOF-OF-STAKE CONSENSUS
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Hash HUD */}
                    <div style={{
                        padding: '12px 14px', borderRadius: '14px',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>BLOCK HASH (SHA-256)</div>
                        <div 
                            onClick={() => copyToClipboard(block.hash, "Block Hash")}
                            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#00D97E', wordBreak: 'break-all', cursor: 'pointer' }}
                        >
                            {block.hash}
                        </div>
                    </div>

                    {/* Parent Hash */}
                    <div style={{
                        padding: '12px 14px', borderRadius: '14px',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>PREVIOUS BLOCK HASH</div>
                        <div 
                            onClick={() => copyToClipboard(block.prev_hash, "Parent Hash")}
                            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--text-secondary)', wordBreak: 'break-all', cursor: 'pointer' }}
                        >
                            {block.prev_hash || "0000000000000000000000000000000000000000000000000000000000000000"}
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TRANSACCIONES</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', marginTop: 2 }}>{block.tx_count} TXs</div>
                        </div>
                        <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>TIMESTAMP UNIX</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#29B6F6', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                                {block.timestamp}
                            </div>
                        </div>
                    </div>

                    {/* Validator info */}
                    <div style={{
                        padding: '12px 14px', borderRadius: '14px',
                        background: 'rgba(41,182,246,0.06)', border: '1px solid rgba(41,182,246,0.2)'
                    }}>
                        <div style={{ fontSize: '0.7rem', color: '#29B6F6', fontWeight: 700, marginBottom: 4 }}>VALIDADOR PROPOSER</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'white', wordBreak: 'break-all' }}>
                            {block.validator || "Local Validator Node"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

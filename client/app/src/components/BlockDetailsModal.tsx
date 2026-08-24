"use client";

import React, { useState } from "react";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";
import { ChainBlock, ChainTransaction } from "../lib/blockchain/LocalChainLedger";

interface BlockDetailsModalProps {
    block: any;
    onClose?: () => void;
}

export const BlockDetailsModal: React.FC<BlockDetailsModalProps> = ({ block, onClose }) => {
    const { t } = useTranslation();
    const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(t.common?.copied || `${label} copiado`);
        } catch {
            toast.error(t.common?.error || "Error al copiar");
        }
    };

    const transactions: ChainTransaction[] = block?.transactions || [];

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(4, 6, 12, 0.88)", backdropFilter: "blur(18px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter modal-card-scrollable"
                style={{
                    width: "100%", maxWidth: "600px", padding: "22px",
                    boxShadow: "0 24px 70px rgba(0,0,0,0.85)",
                    border: "1px solid rgba(0, 229, 255, 0.25)",
                    maxHeight: "calc(100dvh - 32px)", overflowY: "auto",
                    background: "linear-gradient(180deg, rgba(14, 18, 32, 0.98) 0%, rgba(8, 10, 20, 0.98) 100%)"
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{
                            width: 42, height: 42, borderRadius: "12px",
                            background: "linear-gradient(135deg, rgba(0,229,255,0.2) 0%, rgba(2,132,199,0.4) 100%)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.4rem", border: "1px solid var(--glass-border)"
                        }}>
                            📦
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                                Bloque #{block.height}
                            </h2>
                            <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                PROOF-OF-STAKE CONSENSUS · MERKLE AUDIT
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ width: 34, height: 34 }}>✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Hash HUD */}
                    <div style={{
                        padding: "10px 12px", borderRadius: "var(--radius-sm)",
                        background: "rgba(0,0,0,0.5)", border: "1px solid var(--glass-border)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 800 }}>BLOCK HASH (SHA-256)</span>
                            <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)", cursor: "pointer" }} onClick={() => copyToClipboard(block.hash, "Block Hash")}>Copiar</span>
                        </div>
                        <div
                            onClick={() => copyToClipboard(block.hash, "Block Hash")}
                            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem", color: "var(--accent-emerald)", wordBreak: "break-all", cursor: "pointer" }}
                        >
                            {block.hash}
                        </div>
                    </div>

                    {/* Merkle Root */}
                    {block.merkle_root && (
                        <div style={{
                            padding: "10px 12px", borderRadius: "var(--radius-sm)",
                            background: "rgba(0,0,0,0.5)", border: "1px solid var(--glass-border)"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 800 }}>MERKLE ROOT TREE</span>
                                <span style={{ fontSize: "0.65rem", color: "var(--accent-cyan)", cursor: "pointer" }} onClick={() => copyToClipboard(block.merkle_root, "Merkle Root")}>Copiar</span>
                            </div>
                            <div
                                onClick={() => copyToClipboard(block.merkle_root, "Merkle Root")}
                                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem", color: "var(--accent-cyan)", wordBreak: "break-all", cursor: "pointer" }}
                            >
                                {block.merkle_root}
                            </div>
                        </div>
                    )}

                    {/* Parent Hash */}
                    <div style={{
                        padding: "10px 12px", borderRadius: "var(--radius-sm)",
                        background: "rgba(0,0,0,0.5)", border: "1px solid var(--glass-border)"
                    }}>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 800, marginBottom: 2 }}>PREVIOUS BLOCK HASH</div>
                        <div
                            onClick={() => copyToClipboard(block.prev_hash, "Parent Hash")}
                            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem", color: "var(--text-secondary)", wordBreak: "break-all", cursor: "pointer" }}
                        >
                            {block.prev_hash || "0000000000000000000000000000000000000000000000000000000000000000"}
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>TRANSACCIONES</div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "white", marginTop: 2 }}>{block.tx_count || transactions.length || 1} TXs</div>
                        </div>
                        <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>VALIDADOR</div>
                            <div style={{ fontSize: "0.80rem", fontWeight: 700, color: "var(--accent-cyan)", marginTop: 2, fontFamily: "JetBrains Mono, monospace" }}>
                                {block.validator ? block.validator.slice(0, 16) + "…" : "RED_VALIDATOR"}
                            </div>
                        </div>
                    </div>

                    {/* Transactions Section */}
                    {transactions.length > 0 && (
                        <div style={{ marginTop: "6px" }}>
                            <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase" }}>
                                Transacciones en este bloque ({transactions.length})
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                {transactions.map((tx, idx) => {
                                    const isExpanded = expandedTxId === tx.id;
                                    return (
                                        <div
                                            key={tx.id || idx}
                                            style={{
                                                padding: "10px 12px", borderRadius: "var(--radius-sm)",
                                                background: "rgba(0,0,0,0.35)", border: "1px solid var(--glass-border)",
                                                cursor: "pointer"
                                            }}
                                            onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                    <span className="badge-tactical badge-tactical-cyan" style={{ fontSize: "0.62rem" }}>
                                                        {tx.type}
                                                    </span>
                                                    <span style={{ fontSize: "0.75rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>
                                                        {tx.id.slice(0, 14)}…
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                                    +{tx.amount} RED
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed var(--glass-border)", fontSize: "0.70rem", color: "var(--text-muted)" }}>
                                                    <div><strong>Emisor:</strong> {tx.sender}</div>
                                                    <div><strong>Receptor:</strong> {tx.recipient}</div>
                                                    <div><strong>Firma:</strong> <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{tx.signature}</span></div>
                                                    {tx.payload && (
                                                        <div style={{ marginTop: "4px" }}>
                                                            <strong>Payload:</strong> {JSON.stringify(tx.payload)}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
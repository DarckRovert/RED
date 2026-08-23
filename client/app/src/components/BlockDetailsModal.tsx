"use client";

import React from "react";
import { useTranslation } from "../lib/i18n/i18nEngine";
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
    onClose?: () => void;
}

export const BlockDetailsModal: React.FC<BlockDetailsModalProps> = ({ block, onClose }) => {
    const { t } = useTranslation();
    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(t.common?.copied || `${label} copiado`);
        } catch {
            toast.error(t.common?.error || "Error");
        }
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(4, 6, 12, 0.85)", backdropFilter: "blur(16px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter modal-card-scrollable"
                style={{
                    width: "100%", maxWidth: "520px", padding: "20px",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                    maxHeight: "calc(100dvh - 32px)", overflowY: "auto"
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.4rem" }}>📦</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
                                Bloque #{block.height}
                            </h2>
                            <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                PROOF-OF-STAKE CONSENSUS · MERKLE AUDIT
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ width: 34, height: 34 }}>✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Hash HUD */}
                    <div style={{
                        padding: "10px 12px", borderRadius: "var(--radius-sm)",
                        background: "rgba(0,0,0,0.5)", border: "1px solid var(--glass-border)"
                    }}>
                        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 800, marginBottom: 2 }}>BLOCK HASH (SHA-256)</div>
                        <div
                            onClick={() => copyToClipboard(block.hash, "Block Hash")}
                            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem", color: "var(--accent-emerald)", wordBreak: "break-all", cursor: "pointer" }}
                        >
                            {block.hash}
                        </div>
                    </div>

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
                            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "white", marginTop: 2 }}>{block.tx_count} TXs</div>
                        </div>
                        <div style={{ padding: "10px", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)" }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>TIMESTAMP UNIX</div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)", marginTop: 2, fontFamily: "JetBrains Mono, monospace" }}>
                                {block.timestamp}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
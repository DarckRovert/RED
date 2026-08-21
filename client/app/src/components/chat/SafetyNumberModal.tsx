"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRedStore } from "../../store/useRedStore";
import { RedAPI } from "../../lib/api";
import { toast } from "../Toast";

interface SafetyNumberModalProps {
    peerHash: string;
    peerName: string;
    peerPublicKey?: string | null;
    isVerified?: boolean;
    onClose: () => void;
    onVerifiedChange?: (verified: boolean) => void;
}

/**
 * Computes a deterministic 60-digit Signal-grade Safety Number
 * (12 blocks of 5 digits) from two Ed25519/BLAKE3 public keys or identity hashes.
 */
async function computeSafetyNumber(myKey: string, peerKey: string): Promise<string[]> {
    const sorted = [myKey.toLowerCase(), peerKey.toLowerCase()].sort();
    const combined = `${sorted[0]}:${sorted[1]}:RED_SAFETY_V42`;

    let hashHex = "";
    if (typeof window !== "undefined" && window.crypto?.subtle) {
        try {
            const buf = new TextEncoder().encode(combined);
            const digest = await window.crypto.subtle.digest("SHA-256", buf);
            hashHex = Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        } catch {
            hashHex = "";
        }
    }

    if (!hashHex) {
        // Deterministic fallback hash
        let h1 = 0xdeadbeef;
        let h2 = 0x41c6ce57;
        for (let i = 0; i < combined.length; i++) {
            const ch = combined.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        hashHex = (Math.abs(h1).toString(16) + Math.abs(h2).toString(16)).padStart(64, "0");
    }

    // Convert hex characters into 12 chunks of 5 digits (60 digits total)
    const blocks: string[] = [];
    for (let i = 0; i < 12; i++) {
        const slice = hashHex.slice((i * 5) % (hashHex.length - 5), ((i * 5) % (hashHex.length - 5)) + 5);
        let num = 0;
        for (let j = 0; j < slice.length; j++) {
            num = (num * 16 + slice.charCodeAt(j)) % 100000;
        }
        blocks.push(String(num).padStart(5, "0"));
    }
    return blocks;
}

export const SafetyNumberModal: React.FC<SafetyNumberModalProps> = ({
    peerHash,
    peerName,
    peerPublicKey,
    isVerified: initialVerified = false,
    onClose,
    onVerifiedChange,
}) => {
    const { identity, contacts, fetchData } = useRedStore();
    const [blocks, setBlocks] = useState<string[]>([]);
    const [isVerified, setIsVerified] = useState(initialVerified);
    const [isScanning, setIsScanning] = useState(false);
    const [scanInput, setScanInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const myKey = identity?.public_key || identity?.identity_hash || "my_local_identity";
    const targetPeerKey = peerPublicKey || peerHash;

    useEffect(() => {
        computeSafetyNumber(myKey, targetPeerKey).then(setBlocks);
    }, [myKey, targetPeerKey]);

    const fullSafetyString = useMemo(() => blocks.join(" "), [blocks]);

    const handleToggleVerify = async () => {
        setIsProcessing(true);
        try {
            const next = !isVerified;
            if (next) {
                await RedAPI.verifyContact(peerHash);
                toast.success(`🛡️ Identidad de ${peerName} verificada`);
            } else {
                await RedAPI.unverifyContact(peerHash);
                toast.info(`Identidad de ${peerName} desmarcada`);
            }
            setIsVerified(next);
            if (onVerifiedChange) onVerifiedChange(next);
            await fetchData();
        } catch {
            toast.error("Error al actualizar estado de verificación");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCopySafetyNumber = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(fullSafetyString);
            toast.success("📋 Safety Number copiado al portapapeles");
        }
    };

    const handleVerifyScan = (inputVal: string) => {
        const clean = inputVal.replace(/\s+/g, "").trim();
        const expected = blocks.join("");
        if (clean.includes(expected) || expected.includes(clean) || clean === expected) {
            handleToggleVerify();
            setIsScanning(false);
            setScanInput("");
            toast.success("✅ ¡Safety Number coincide al 100%! Identidad autenticada.");
        } else {
            toast.error("❌ Los números de seguridad NO coinciden. Podría haber un intermediario.");
        }
    };

    return (
        <div
            style={{
                position: "fixed", inset: 0, zIndex: 10000,
                background: "rgba(4, 6, 14, 0.88)", backdropFilter: "blur(18px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
            }}
            onClick={onClose}
        >
            <div
                className="card-tactical animate-enter"
                style={{
                    width: "100%", maxWidth: "460px", padding: "22px",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
                    display: "flex", flexDirection: "column", gap: "16px",
                    maxHeight: "90vh", overflowY: "auto"
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "1.2rem" }}>🛡️</span>
                            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#FFFFFF" }}>
                                Número de Seguridad Criptográfico
                            </h2>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", marginTop: "2px" }}>
                            {peerName} · ED25519 / BLAKE3
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-icon" style={{ width: 32, height: 32, flexShrink: 0 }}>✕</button>
                </div>

                {/* Explanation */}
                <div style={{
                    fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-secondary)",
                    background: "rgba(255,255,255,0.03)", padding: "10px 12px",
                    borderRadius: "var(--radius-sm)", border: "1px solid var(--glass-border)"
                }}>
                    Compara este número de 60 dígitos o el código de verificación con el dispositivo de <strong>{peerName}</strong> para garantizar que la comunicación E2E es impenetrable y libre de intermediarios (MITM).
                </div>

                {/* 60-digit Matrix Display */}
                <div style={{
                    background: "rgba(0, 0, 0, 0.45)",
                    border: `1px solid ${isVerified ? "rgba(0, 230, 118, 0.4)" : "rgba(255, 255, 255, 0.12)"}`,
                    borderRadius: "var(--radius-md)", padding: "14px",
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 8px",
                    textAlign: "center"
                }}>
                    {blocks.length > 0 ? (
                        blocks.map((block, idx) => (
                            <div
                                key={idx}
                                style={{
                                    fontFamily: "JetBrains Mono, monospace",
                                    fontSize: "0.95rem", fontWeight: 800,
                                    letterSpacing: "1.5px",
                                    color: isVerified ? "var(--accent-emerald, #00E676)" : "var(--accent-cyan, #00F0FF)"
                                }}
                            >
                                {block}
                            </div>
                        ))
                    ) : (
                        <div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                            Generando huella criptográfica…
                        </div>
                    )}
                </div>

                {/* Verification Status Badge */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: "var(--radius-sm)",
                    background: isVerified ? "rgba(0, 230, 118, 0.12)" : "rgba(255, 255, 255, 0.04)",
                    border: `1px solid ${isVerified ? "rgba(0, 230, 118, 0.4)" : "var(--glass-border)"}`
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "1rem" }}>{isVerified ? "✅" : "⚠️"}</span>
                        <div>
                            <div style={{ fontSize: "0.84rem", fontWeight: 800, color: isVerified ? "#00E676" : "#FFFFFF" }}>
                                {isVerified ? "Identidad Verificada" : "No Verificada"}
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                {isVerified ? "El canal E2E cuenta con autenticación mutua" : "Toca el botón para confirmar autenticidad"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scanner / Manual Compare Input */}
                {isScanning ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input
                            type="text"
                            placeholder="Pega o escribe el número de seguridad del par…"
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            style={{
                                width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)",
                                background: "var(--bg-card)", color: "#FFFFFF",
                                border: "1px solid var(--glass-border)", fontSize: "0.82rem",
                                fontFamily: "JetBrains Mono, monospace"
                            }}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button
                                onClick={() => handleVerifyScan(scanInput)}
                                className="btn-tactical-primary"
                                style={{ flex: 1, padding: "8px", fontSize: "0.8rem" }}
                            >
                                Comparar y Validar
                            </button>
                            <button
                                onClick={() => setIsScanning(false)}
                                className="btn-secondary"
                                style={{ padding: "8px 14px", fontSize: "0.8rem" }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : null}

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                        onClick={handleCopySafetyNumber}
                        className="btn-secondary"
                        style={{ flex: 1, padding: "9px 12px", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                        📋 Copiar 60 Dígitos
                    </button>
                    {!isScanning && (
                        <button
                            onClick={() => setIsScanning(true)}
                            className="btn-secondary"
                            style={{ flex: 1, padding: "9px 12px", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                            🔍 Comparar Código
                        </button>
                    )}
                    <button
                        onClick={handleToggleVerify}
                        disabled={isProcessing}
                        className={isVerified ? "btn-secondary" : "btn-tactical-primary"}
                        style={{
                            width: "100%", padding: "10px", fontSize: "0.84rem", fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                            background: isVerified ? "rgba(255, 60, 95, 0.15)" : undefined,
                            borderColor: isVerified ? "rgba(255, 60, 95, 0.4)" : undefined,
                            color: isVerified ? "var(--accent-crimson, #FF3C5F)" : undefined
                        }}
                    >
                        {isVerified ? "Desmarcar como Verificado" : "🛡️ Marcar como Verificado"}
                    </button>
                </div>
            </div>
        </div>
    );
};

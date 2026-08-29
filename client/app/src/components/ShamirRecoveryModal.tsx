"use client";

import React, { useState, useEffect } from "react";
import { shamirRecoveryVault, SocialRecoveryVaultState, GuardianRecord } from "../lib/crypto/ShamirSocialRecoveryVault";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

export function ShamirRecoveryModal() {
    const { navigate, identity } = useRedStore();
    const [vaultState, setVaultState] = useState<SocialRecoveryVaultState>(() => shamirRecoveryVault.getState());
    const [activeTab, setActiveTab] = useState<"guardians" | "reconstruct">("guardians");

    // Inputs for Guardian setup
    const [guardianNames, setGuardianNames] = useState<string[]>([
        "Guardián Alfa", "Guardián Bravo", "Guardián Charlie", "Guardián Delta", "Guardián Eco"
    ]);

    // Input for manually adding a collected share
    const [inputShareHex, setInputShareHex] = useState<string>("");
    const [inputShareIndex, setInputShareIndex] = useState<number>(1);
    const [reconstructedKey, setReconstructedKey] = useState<string | null>(null);

    useEffect(() => {
        const unsub = shamirRecoveryVault.subscribe(setVaultState);
        return unsub;
    }, []);

    const handleGenerateShares = () => {
        const masterSecret = identity?.identity_hash ? `${identity.identity_hash.padEnd(64, '0').slice(0, 64)}` : "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        shamirRecoveryVault.initializeGuardians(masterSecret, guardianNames);
        toast.success("Bóveda Shamir 3-de-5 generada exitosamente");
    };

    const handleAddShare = () => {
        if (!inputShareHex.trim()) {
            toast.error("Ingresa el valor hexadecimal del fragmento");
            return;
        }
        const canRecon = shamirRecoveryVault.addCollectedShare({
            shareIndex: inputShareIndex,
            shareHex: inputShareHex.trim(),
        });
        setInputShareHex("");
        toast.info(canRecon ? "¡Umbral de 3 fragmentos alcanzado! Listo para reconstruir" : "Fragmento registrado");
    };

    const handleReconstruct = () => {
        const recovered = shamirRecoveryVault.reconstructSecret();
        if (recovered) {
            setReconstructedKey(recovered);
            toast.success("🔑 ¡Identidad y clave soberana reconstruidas exitosamente!");
        } else {
            toast.error("No se pudo reconstruir. Verifica los fragmentos");
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "#050812", color: "#FFF",
            display: "flex", flexDirection: "column",
            fontFamily: "JetBrains Mono, monospace"
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px", background: "rgba(10, 15, 30, 0.95)",
                borderBottom: "1px solid rgba(0, 229, 255, 0.3)",
                display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>🧩</span>
                    <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 900, color: "#00E5FF" }}>
                            RECUPERACIÓN SOCIAL SHAMIR (SSS 3-DE-5)
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#AAA" }}>
                            Distribución de Claves y Restauración Umbral Descentralizada
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => navigate("commandCenter")}
                    style={{
                        background: "rgba(232, 33, 58, 0.2)", border: "1px solid #E8213A",
                        color: "#FFF", padding: "6px 12px", borderRadius: "8px",
                        cursor: "pointer", fontWeight: 800, fontSize: "0.75rem"
                    }}
                >
                    ✕ CERRAR
                </button>
            </div>

            {/* Tab Selector */}
            <div style={{ display: "flex", background: "rgba(15, 23, 42, 0.8)", padding: "6px 16px", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                    onClick={() => setActiveTab("guardians")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "guardians" ? "#00E5FF" : "transparent",
                        color: activeTab === "guardians" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🛡️ Guardianes Configurados ({vaultState.guardians.length}/5)
                </button>
                <button
                    onClick={() => setActiveTab("reconstruct")}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "reconstruct" ? "#00E676" : "transparent",
                        color: activeTab === "reconstruct" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🔑 Reconstitución ({vaultState.collectedShares.length}/3)
                </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                
                {/* ── TAB 1: GUARDIANES ── */}
                {activeTab === "guardians" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(0, 229, 255, 0.05)", border: "1px solid rgba(0, 229, 255, 0.2)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Tu clave maestra se divide matemáticamente en <strong>5 fragmentos</strong>. Cualquier <strong>3 fragmentos</strong> pueden recomponer la clave completa. Ningún guardián individual puede descifrar tu información.
                        </div>

                        {vaultState.guardians.length === 0 ? (
                            <button
                                onClick={handleGenerateShares}
                                style={{
                                    padding: "14px", borderRadius: "10px",
                                    background: "linear-gradient(135deg, #00E5FF, #00B0FF)",
                                    color: "#000", fontWeight: 900, fontSize: "0.85rem", border: "none", cursor: "pointer"
                                }}
                            >
                                ⚡ FRAGMENTAR CLAVE MAESTRA (3-DE-5)
                            </button>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {vaultState.guardians.map(g => (
                                    <div
                                        key={g.id}
                                        style={{
                                            padding: "12px", borderRadius: "10px",
                                            background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)",
                                            display: "flex", flexDirection: "column", gap: "6px"
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#00E5FF" }}>
                                                {g.guardianName} (Fragmento #{g.shareIndex})
                                            </div>
                                            <span style={{
                                                fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px",
                                                background: "rgba(0,230,118,0.15)", color: "#00E676"
                                            }}>
                                                LISTO
                                            </span>
                                        </div>
                                        {g.shareHex && (
                                            <div style={{
                                                background: "rgba(0,0,0,0.5)", padding: "6px 8px", borderRadius: "6px",
                                                fontSize: "0.65rem", color: "#AAA", wordBreak: "break-all"
                                            }}>
                                                {g.shareHex.substring(0, 32)}...
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB 2: RECONSTITUCIÓN ── */}
                {activeTab === "reconstruct" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ background: "rgba(0, 230, 118, 0.05)", border: "1px solid rgba(0, 230, 118, 0.2)", borderRadius: "12px", padding: "12px", fontSize: "0.74rem", color: "#DDD" }}>
                            Ingresa o escanea los fragmentos proporcionados por tus guardianes. Se requieren al menos <strong>3 de 5</strong> para la reconstrucción por interpolación polinómica.
                        </div>

                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <select
                                value={inputShareIndex}
                                onChange={(e) => setInputShareIndex(Number(e.target.value))}
                                style={{
                                    padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.6)",
                                    border: "1px solid rgba(255,255,255,0.15)", color: "#FFF", fontSize: "0.78rem"
                                }}
                            >
                                {[1, 2, 3, 4, 5].map(idx => (
                                    <option key={idx} value={idx}>Share #{idx}</option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={inputShareHex}
                                onChange={(e) => setInputShareHex(e.target.value)}
                                placeholder="Pega el valor hexadecimal del fragmento..."
                                style={{
                                    flex: 1, padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.6)",
                                    border: "1px solid rgba(255,255,255,0.15)", color: "#FFF", fontSize: "0.78rem"
                                }}
                            />
                            <button
                                onClick={handleAddShare}
                                style={{
                                    padding: "10px 14px", borderRadius: "8px", background: "#00E5FF",
                                    color: "#000", fontWeight: 800, fontSize: "0.78rem", border: "none", cursor: "pointer"
                                }}
                            >
                                ＋ AÑADIR
                            </button>
                        </div>

                        {vaultState.canReconstruct && (
                            <button
                                onClick={handleReconstruct}
                                style={{
                                    padding: "14px", borderRadius: "10px",
                                    background: "linear-gradient(135deg, #00E676, #00C853)",
                                    color: "#000", fontWeight: 900, fontSize: "0.85rem", border: "none", cursor: "pointer"
                                }}
                            >
                                🔓 RECONSTRUIR CLAVE MAESTRA SOVERANA
                            </button>
                        )}

                        {reconstructedKey && (
                            <div style={{
                                padding: "14px", borderRadius: "10px", background: "rgba(0,230,118,0.15)",
                                border: "1.5px solid #00E676", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 900, color: "#00E676" }}>
                                    ✓ CLAVE RECUPERADA POR POLINOMIO DE LAGRANGE:
                                </div>
                                <div style={{ background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", fontSize: "0.72rem", color: "#FFF", wordBreak: "break-all" }}>
                                    {reconstructedKey}
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}

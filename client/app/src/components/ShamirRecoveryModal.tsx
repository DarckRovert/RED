"use client";

import React, { useState, useEffect } from "react";
import { shamirRecoveryVault, SocialRecoveryVaultState, GuardianRecord } from "../lib/crypto/ShamirSocialRecoveryVault";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";
import { OfflineQrEngine } from "../lib/qr/OfflineQrEngine";
import { meshRouter } from "../lib/mesh/meshRouter";

export function ShamirRecoveryModal() {
    const { navigate, identity, contacts, goBack } = useRedStore();

    const [vaultState, setVaultState] = useState<SocialRecoveryVaultState>(() => shamirRecoveryVault.getState());
    const [activeTab, setActiveTab] = useState<"guardians" | "reconstruct">("guardians");

    // Inputs for Guardian setup derived dynamically from trusted contacts
    const [guardianNames, setGuardianNames] = useState<string[]>(() => {
        const contactAliases = (contacts || []).map(c => c.name || (c as any).alias).filter(Boolean);
        const defaults = ["Guardián 1", "Guardián 2", "Guardián 3", "Guardián 4", "Guardián 5"];
        return defaults.map((d, i) => contactAliases[i] || d);
    });

    // Input for manually adding a collected share
    const [inputShareHex, setInputShareHex] = useState<string>("");
    const [inputShareIndex, setInputShareIndex] = useState<number>(1);
    const [reconstructedKey, setReconstructedKey] = useState<string | null>(null);
    const [selectedQrShare, setSelectedQrShare] = useState<{ index: number; name: string; hex: string; dataUrl: string } | null>(null);

    // Registro LIFO de retroceso físico / Esc
    useEffect(() => {
        const unregister = BackHandlerRegistry.register(() => {
            if (selectedQrShare) {
                TacticalAudioEngine.playTap();
                setSelectedQrShare(null);
                return true;
            }
            if (reconstructedKey) {
                TacticalAudioEngine.playTap();
                setReconstructedKey(null);
                return true;
            }
            if (activeTab === "reconstruct") {
                TacticalAudioEngine.playTap();
                setActiveTab("guardians");
                return true;
            }
            TacticalAudioEngine.playTap();
            goBack();
            return true;
        });
        return unregister;
    }, [selectedQrShare, reconstructedKey, activeTab, goBack]);

    // Copia resiliente con degradación a textarea
    const copyToClipboard = async (text: string, label: string) => {
        TacticalAudioEngine.playMessageSent();
        let copied = false;
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch {}
        }
        if (!copied && typeof document !== "undefined") {
            try {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                copied = document.execCommand("copy");
                document.body.removeChild(ta);
            } catch {}
        }
        if (copied) {
            toast.success(`📋 ${label} copiado al portapapeles`);
        } else {
            toast.error(`Error al copiar ${label}`);
        }
    };

    useEffect(() => {
        const unsub = shamirRecoveryVault.subscribe(setVaultState);
        return unsub;
    }, []);

    const handleGenerateShares = () => {
        let masterSecret = '';
        if (typeof window !== 'undefined') {
            masterSecret = localStorage.getItem('red_mnemonic_seed') || localStorage.getItem('red_private_key') || '';
        }
        if (!masterSecret) {
            masterSecret = identity?.private_key || (identity as any)?.signing_key || identity?.identity_hash || '';
        }
        if (!masterSecret) {
            const buf = new Uint8Array(32);
            if (typeof crypto !== 'undefined') crypto.getRandomValues(buf);
            masterSecret = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        // Pad to at least 64 chars if hex
        const secretHex = masterSecret.length < 64 ? masterSecret.padEnd(64, '0') : masterSecret;
        shamirRecoveryVault.initializeGuardians(secretHex, guardianNames);
        TacticalAudioEngine.playRogerBeep();
        toast.success("Bóveda Shamir 3-de-5 generada exitosamente");
    };

    const handleAddShare = () => {
        TacticalAudioEngine.playTap();
        if (!inputShareHex.trim()) {
            TacticalAudioEngine.playWarning();
            toast.error("Ingresa el valor hexadecimal del fragmento");
            return;
        }
        const canRecon = shamirRecoveryVault.addCollectedShare({
            shareIndex: inputShareIndex,
            shareHex: inputShareHex.trim(),
        });
        setInputShareHex("");
        if (canRecon) {
            TacticalAudioEngine.playRogerBeep();
        }
        toast.info(canRecon ? "¡Umbral de 3 fragmentos alcanzado! Listo para reconstruir" : "Fragmento registrado");
    };

    const handleReconstruct = () => {
        const recovered = shamirRecoveryVault.reconstructSecret();
        if (recovered) {
            TacticalAudioEngine.playRogerBeep();
            setReconstructedKey(recovered);
            toast.success("🔑 ¡Identidad y clave soberana reconstruidas exitosamente!");
        } else {
            TacticalAudioEngine.playWarning();
            toast.error("No se pudo reconstruir. Verifica los fragmentos");
        }
    };

    const handleShowShareQr = async (guardianName: string, shareIndex: number, shareHex: string) => {
        TacticalAudioEngine.playTap();
        try {
            const qrPayload = `RED_SHAMIR_SHARE_V1:${shareIndex}:${shareHex}`;
            const dataUrl = await OfflineQrEngine.generateDataUrl(qrPayload, {
                width: 280,
                margin: 1,
                darkColor: "#00E5FF",
                lightColor: "#050812"
            });
            setSelectedQrShare({ index: shareIndex, name: guardianName, hex: shareHex, dataUrl });
        } catch (e: any) {
            toast.error("Error al generar QR del fragmento: " + e.message);
        }
    };

    const handleDispatchShare = async (guardianName: string, shareIndex: number, shareHex: string) => {
        TacticalAudioEngine.playTap();
        const contact = (contacts || []).find(c =>
            (c.name || (c as any).alias)?.toLowerCase() === guardianName.toLowerCase() ||
            c.identity_hash?.toLowerCase() === guardianName.toLowerCase()
        );
        if (!contact?.identity_hash) {
            toast.warning(`Guardián '${guardianName}' no vinculado a un contacto con DID en la malla`);
            return;
        }
        try {
            const payload = new TextEncoder().encode(JSON.stringify({
                type: "SHAMIR_RECOVERY_SHARE",
                guardianName,
                shareIndex,
                shareHex,
                timestamp: Date.now()
            }));
            await meshRouter.send(contact.identity_hash, payload);
            TacticalAudioEngine.playRogerBeep();
            toast.success(`📡 Fragmento #${shareIndex} enviado cifrado a ${contact.name || guardianName}`);
        } catch (e: any) {
            toast.error("Error al despachar fragmento: " + e.message);
        }
    };

    const handleRestoreIdentityKey = () => {
        if (!reconstructedKey) return;
        TacticalAudioEngine.playRogerBeep();
        if (typeof window !== "undefined") {
            localStorage.setItem("red_private_key", reconstructedKey);
            localStorage.setItem("red_mnemonic_seed", reconstructedKey);
        }
        toast.success("🛡️ Clave soberana restablecida en almacenamiento local");
    };

    return (
        <div className="modal-viewport-adaptive" style={{
            background: "#050812", color: "#FFF",
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
                    onClick={() => { TacticalAudioEngine.playTap(); goBack(); }}
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
                    onClick={() => { TacticalAudioEngine.playTap(); setActiveTab("guardians"); }}
                    style={{
                        flex: 1, padding: "8px", borderRadius: "8px", fontSize: "0.76rem", fontWeight: 800,
                        background: activeTab === "guardians" ? "#00E5FF" : "transparent",
                        color: activeTab === "guardians" ? "#000" : "#AAA", border: "none", cursor: "pointer"
                    }}
                >
                    🛡️ Guardianes Configurados ({vaultState.guardians.length}/5)
                </button>
                <button
                    onClick={() => { TacticalAudioEngine.playTap(); setActiveTab("reconstruct"); }}
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
                                            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                                                <div style={{
                                                    background: "rgba(0,0,0,0.5)", padding: "6px 8px", borderRadius: "6px",
                                                    fontSize: "0.65rem", color: "#AAA", wordBreak: "break-all", flex: "1 1 100%"
                                                }}>
                                                    {g.shareHex.substring(0, 32)}...
                                                </div>
                                                <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                                                    <button
                                                        onClick={() => copyToClipboard(g.shareHex!, `Fragmento #${g.shareIndex}`)}
                                                        style={{
                                                            flex: 1, background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.4)",
                                                            color: "#00E5FF", borderRadius: "6px", padding: "6px 8px", fontSize: "0.68rem",
                                                            cursor: "pointer", fontWeight: 800, whiteSpace: "nowrap"
                                                        }}
                                                    >
                                                        📋 Copiar
                                                    </button>
                                                    <button
                                                        onClick={() => handleShowShareQr(g.guardianName, g.shareIndex, g.shareHex!)}
                                                        style={{
                                                            flex: 1, background: "rgba(0, 230, 118, 0.15)", border: "1px solid rgba(0, 230, 118, 0.4)",
                                                            color: "#00E676", borderRadius: "6px", padding: "6px 8px", fontSize: "0.68rem",
                                                            cursor: "pointer", fontWeight: 800, whiteSpace: "nowrap"
                                                        }}
                                                    >
                                                        📱 Ver QR
                                                    </button>
                                                    <button
                                                        onClick={() => handleDispatchShare(g.guardianName, g.shareIndex, g.shareHex!)}
                                                        style={{
                                                            flex: 1, background: "rgba(255, 171, 0, 0.15)", border: "1px solid rgba(255, 171, 0, 0.4)",
                                                            color: "#FFAB00", borderRadius: "6px", padding: "6px 8px", fontSize: "0.68rem",
                                                            cursor: "pointer", fontWeight: 800, whiteSpace: "nowrap"
                                                        }}
                                                    >
                                                        📡 Despachar
                                                    </button>
                                                </div>
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
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <div style={{ background: "rgba(0,0,0,0.6)", padding: "10px", borderRadius: "8px", fontSize: "0.72rem", color: "#FFF", wordBreak: "break-all", flex: 1 }}>
                                        {reconstructedKey}
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(reconstructedKey, "Clave Maestra")}
                                        style={{
                                            background: "#00E676", color: "#000", border: "none", borderRadius: "8px",
                                            padding: "10px 14px", fontWeight: 900, fontSize: "0.75rem", cursor: "pointer",
                                            whiteSpace: "nowrap"
                                        }}
                                    >
                                        📋 COPIAR
                                    </button>
                                </div>
                                <button
                                    onClick={handleRestoreIdentityKey}
                                    style={{
                                        marginTop: "4px", padding: "10px", borderRadius: "8px",
                                        background: "linear-gradient(135deg, #00E5FF, #00B0FF)",
                                        color: "#000", fontWeight: 900, fontSize: "0.76rem", border: "none",
                                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                                    }}
                                >
                                    🪪 RESTAURAR EN IDENTIDAD LOCAL
                                </button>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* Modal QR Guardián Overlay */}
            {selectedQrShare && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                }}>
                    <div style={{
                        background: "#0a0f1d", border: "1px solid #00E5FF", borderRadius: "16px",
                        padding: "20px", maxWidth: "340px", width: "100%", display: "flex",
                        flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center"
                    }}>
                        <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#00E5FF" }}>
                            📱 QR FRAGMENTO #{selectedQrShare.index}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#AAA" }}>
                            Guardián: <strong style={{ color: "#FFF" }}>{selectedQrShare.name}</strong>
                        </div>
                        <div style={{
                            background: "#050812", padding: "12px", borderRadius: "12px",
                            border: "1px solid rgba(0, 229, 255, 0.3)"
                        }}>
                            <img src={selectedQrShare.dataUrl} alt={`QR Share #${selectedQrShare.index}`} style={{ width: "240px", height: "240px", display: "block" }} />
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "#888", wordBreak: "break-all", maxHeight: "45px", overflowY: "auto", background: "rgba(0,0,0,0.5)", padding: "6px", borderRadius: "6px", width: "100%", boxSizing: "border-box" }}>
                            {selectedQrShare.hex}
                        </div>
                        <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                            <button
                                onClick={() => copyToClipboard(selectedQrShare.hex, `Fragmento #${selectedQrShare.index}`)}
                                style={{
                                    flex: 1, padding: "10px", borderRadius: "8px", background: "rgba(0,229,255,0.15)",
                                    border: "1px solid #00E5FF", color: "#00E5FF", fontWeight: 800, fontSize: "0.75rem", cursor: "pointer"
                                }}
                            >
                                📋 COPIAR
                            </button>
                            <button
                                onClick={() => setSelectedQrShare(null)}
                                style={{
                                    flex: 1, padding: "10px", borderRadius: "8px", background: "#E8213A",
                                    border: "none", color: "#FFF", fontWeight: 800, fontSize: "0.75rem", cursor: "pointer"
                                }}
                            >
                                ✕ CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

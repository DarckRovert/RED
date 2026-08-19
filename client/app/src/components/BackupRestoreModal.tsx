"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { SovereignBackupEngine, CloudUploadResult } from "../lib/SovereignBackupEngine";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { toast } from "./Toast";

interface BackupRestoreModalProps {
    onClose?: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ onClose }) => {
    const { identity, fetchData, goBack } = useRedStore();
    const handleClose = onClose || goBack;

    const [activeTab, setActiveTab] = useState<"cloud_export" | "restore" | "seed_phrase">("cloud_export");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [mnemonicPhrase, setMnemonicPhrase] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [lastUploadResult, setLastUploadResult] = useState<CloudUploadResult | null>(null);

    // Restore inputs
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restorePassword, setRestorePassword] = useState("");
    const [ipfsCidInput, setIpfsCidInput] = useState("");
    const [mnemonicInput, setMnemonicInput] = useState("");
    const [customNickname, setCustomNickname] = useState("");

    useEffect(() => {
        const savedSeed = localStorage.getItem("red_mnemonic_seed");
        if (savedSeed) {
            setMnemonicPhrase(savedSeed);
        } else {
            const seed = SovereignBackupEngine.generateMnemonicSeed(identity?.identity_hash);
            setMnemonicPhrase(seed);
            localStorage.setItem("red_mnemonic_seed", seed);
        }
    }, [identity]);

    // ── Export & Cloud Upload ────────────────────────────────────────────────
    const handleCreateEncryptedVault = async (destination: "google_drive" | "ipfs_web3" | "file_download") => {
        if (!password || password.length < 6) {
            toast.error("La contraseña de cifrado debe tener al menos 6 caracteres.");
            return;
        }
        if (password !== confirmPassword) {
            toast.error("Las contraseñas de confirmación no coinciden.");
            return;
        }

        setIsGenerating(true);
        TacticalAudioEngine.playTap();

        try {
            const { blob, fileName, capsuleSize } = await SovereignBackupEngine.createEncryptedCapsule(password, mnemonicPhrase);

            if (destination === "google_drive") {
                const res = await SovereignBackupEngine.uploadToGoogleDrive(blob, fileName);
                setLastUploadResult(res);
                if (res.success) {
                    toast.success("✅ Respaldo enviado a Google Drive / Almacenamiento");
                    TacticalAudioEngine.playMessageSent();
                } else {
                    toast.error(res.error || "Error al subir a Google Drive");
                }
            } else if (destination === "ipfs_web3") {
                const res = await SovereignBackupEngine.uploadToIpfs(blob, fileName);
                setLastUploadResult(res);
                if (res.success) {
                    toast.success(`🌐 Cápsula anclada en IPFS: ${res.cid?.substring(0, 16)}…`);
                    TacticalAudioEngine.playMessageSent();
                } else {
                    toast.error(res.error || "Error al anclar en IPFS");
                }
            } else {
                // Direct file download
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success(`📁 Archivo ${fileName} (${Math.round(capsuleSize / 1024)} KB) descargado.`);
                TacticalAudioEngine.playMessageSent();
            }
        } catch (err: any) {
            toast.error(err?.message || "Error al empaquetar la bóveda.");
        } finally {
            setIsGenerating(false);
        }
    };

    // ── Restore from File / Cloud / IPFS ─────────────────────────────────────
    const handleRestoreVault = async () => {
        if (!restorePassword) {
            toast.error("Ingresa la contraseña de descifrado de la cápsula.");
            return;
        }

        setIsRestoring(true);
        TacticalAudioEngine.playTap();

        try {
            let buffer: ArrayBuffer | null = null;

            if (ipfsCidInput.trim()) {
                toast.info("Descargando cápsula cifrada desde la red IPFS…");
                buffer = await SovereignBackupEngine.fetchFromIpfs(ipfsCidInput.trim());
            } else if (restoreFile) {
                buffer = await restoreFile.arrayBuffer();
            } else {
                toast.error("Selecciona un archivo .redvault o ingresa un CID de IPFS.");
                setIsRestoring(false);
                return;
            }

            if (!buffer) {
                throw new Error("No se pudo leer el archivo de respaldo.");
            }

            const capsule = await SovereignBackupEngine.decryptAndImportCapsule(buffer, restorePassword);
            toast.success(`✅ Bóveda restaurada con éxito: ${capsule.identity?.nickname || "Operador"}`);
            TacticalAudioEngine.playMessageReceived();

            await fetchData();
            setTimeout(() => handleClose(), 1500);
        } catch (err: any) {
            toast.error(err?.message || "Error: Contraseña incorrecta o archivo corrupto.");
            TacticalAudioEngine.playWarning();
        } finally {
            setIsRestoring(false);
        }
    };

    // ── Restore from 12-word BIP-39 Mnemonic ──────────────────────────────────
    const handleRestoreFromMnemonic = async () => {
        if (!mnemonicInput.trim()) {
            toast.error("Ingresa las 12 palabras de tu frase semilla.");
            return;
        }

        setIsRestoring(true);
        TacticalAudioEngine.playTap();

        try {
            const restoredId = SovereignBackupEngine.restoreIdentityFromMnemonic(mnemonicInput, customNickname);
            localStorage.setItem("red_identity", JSON.stringify(restoredId));
            localStorage.setItem("red_identity_hash", restoredId.identity_hash);
            localStorage.setItem("red_short_id", restoredId.short_id);
            localStorage.setItem("red_displayName", restoredId.nickname);
            localStorage.setItem("user_nickname", restoredId.nickname);
            localStorage.setItem("red_mnemonic_seed", mnemonicInput.trim().toLowerCase());

            toast.success(`✅ Identidad Soberana recuperada: ${restoredId.short_id}`);
            TacticalAudioEngine.playMessageReceived();

            await fetchData();
            setTimeout(() => handleClose(), 1500);
        } catch (err: any) {
            toast.error(err?.message || "Frase semilla inválida.");
            TacticalAudioEngine.playWarning();
        } finally {
            setIsRestoring(false);
        }
    };

    const copyToClipboard = (text: string, msg: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success(msg);
            TacticalAudioEngine.playTap();
        }
    };

    const mnemonicWordList = mnemonicPhrase.split(" ");

    return (
        <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(3, 7, 18, 0.95)",
            backdropFilter: "blur(16px)",
            zIndex: 9999,
            display: "flex", flexDirection: "column",
            animation: "fadeIn 0.2s ease-out"
        }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)",
                background: "rgba(10, 15, 29, 0.8)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: "36px", height: "36px", borderRadius: "10px",
                        background: "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem"
                    }}>
                        ☁️
                    </div>
                    <div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#fff", letterSpacing: "0.5px" }}>
                            BÓVEDA SOBERANA: RESPALDO & NUBE
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                            AES-256-GCM · GOOGLE DRIVE · IPFS WEB3 · BIP-39 SEED
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleClose}
                    style={{
                        background: "rgba(255, 255, 255, 0.06)", border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)", borderRadius: "8px", width: "32px", height: "32px",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Tactical Tab Switcher */}
            <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px",
                padding: "12px 20px", background: "rgba(6, 11, 25, 0.6)",
                borderBottom: "1px solid var(--border-subtle)"
            }}>
                <button
                    onClick={() => { setActiveTab("cloud_export"); TacticalAudioEngine.playTap(); }}
                    style={{
                        padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                        background: activeTab === "cloud_export" ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "cloud_export" ? "1px solid var(--accent-cyan)" : "1px solid transparent",
                        color: activeTab === "cloud_export" ? "#fff" : "var(--text-muted)",
                        cursor: "pointer"
                    }}
                >
                    📤 Exportar / Nube
                </button>
                <button
                    onClick={() => { setActiveTab("restore"); TacticalAudioEngine.playTap(); }}
                    style={{
                        padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                        background: activeTab === "restore" ? "rgba(0, 230, 118, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "restore" ? "1px solid var(--accent-emerald)" : "1px solid transparent",
                        color: activeTab === "restore" ? "#fff" : "var(--text-muted)",
                        cursor: "pointer"
                    }}
                >
                    📥 Restaurar Bóveda
                </button>
                <button
                    onClick={() => { setActiveTab("seed_phrase"); TacticalAudioEngine.playTap(); }}
                    style={{
                        padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                        background: activeTab === "seed_phrase" ? "rgba(255, 179, 0, 0.2)" : "rgba(255, 255, 255, 0.03)",
                        border: activeTab === "seed_phrase" ? "1px solid var(--accent-amber)" : "1px solid transparent",
                        color: activeTab === "seed_phrase" ? "#fff" : "var(--text-muted)",
                        cursor: "pointer"
                    }}
                >
                    🔑 Frase Semilla
                </button>
            </div>

            {/* Tab Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {/* ── TAB 1: CLOUD & EXPORT ── */}
                {activeTab === "cloud_export" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "600px", margin: "0 auto" }}>
                        <div style={{
                            padding: "14px", borderRadius: "12px", background: "rgba(56, 189, 248, 0.08)",
                            border: "1px solid rgba(56, 189, 248, 0.25)", fontSize: "12px", color: "var(--text-secondary)",
                            lineHeight: "1.5"
                        }}>
                            🛡️ <strong>Copia Criptográfica Militar Zero-Knowledge:</strong> Todo tu perfil, par de claves post-cuánticas, chats, contactos y atestaciones Web3 se empaquetan y cifran con <strong>AES-256-GCM (PBKDF2 100,000 rondas)</strong>. Ni Google Drive ni los nodos IPFS pueden leer tu información sin tu contraseña.
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Contraseña Maestra de Cifrado
                                </label>
                                <input
                                    type="password"
                                    placeholder="Contraseña robusta (mínimo 6 caracteres)…"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{
                                        width: "100%", padding: "12px", marginTop: "6px",
                                        background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                        borderRadius: "10px", color: "#fff", fontSize: "13px"
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                    Confirmar Contraseña
                                </label>
                                <input
                                    type="password"
                                    placeholder="Repite la contraseña para verificar…"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    style={{
                                        width: "100%", padding: "12px", marginTop: "6px",
                                        background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                        borderRadius: "10px", color: "#fff", fontSize: "13px"
                                    }}
                                />
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                            <button
                                disabled={isGenerating}
                                onClick={() => handleCreateEncryptedVault("google_drive")}
                                style={{
                                    padding: "14px", borderRadius: "12px",
                                    background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "#fff", fontWeight: 800, fontSize: "12px", cursor: isGenerating ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                    boxShadow: "0 4px 14px rgba(30, 136, 229, 0.4)"
                                }}
                            >
                                <span>📁</span> {isGenerating ? "Cifrando…" : "Guardar en Google Drive / App"}
                            </button>

                            <button
                                disabled={isGenerating}
                                onClick={() => handleCreateEncryptedVault("ipfs_web3")}
                                style={{
                                    padding: "14px", borderRadius: "12px",
                                    background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
                                    border: "1px solid rgba(255, 255, 255, 0.2)",
                                    color: "#fff", fontWeight: 800, fontSize: "12px", cursor: isGenerating ? "not-allowed" : "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)"
                                }}
                            >
                                <span>🌐</span> {isGenerating ? "Anclando…" : "Publicar en IPFS Web3"}
                            </button>
                        </div>

                        <button
                            disabled={isGenerating}
                            onClick={() => handleCreateEncryptedVault("file_download")}
                            style={{
                                padding: "12px", borderRadius: "10px",
                                background: "rgba(255, 255, 255, 0.05)", border: "1px solid var(--border-subtle)",
                                color: "var(--text-secondary)", fontWeight: 700, fontSize: "12px", cursor: isGenerating ? "not-allowed" : "pointer"
                            }}
                        >
                            💾 Descargar Archivo Local (.redvault)
                        </button>

                        {lastUploadResult && lastUploadResult.success && (
                            <div style={{
                                padding: "14px", borderRadius: "12px", background: "rgba(0, 230, 118, 0.1)",
                                border: "1px solid var(--accent-emerald)", display: "flex", flexDirection: "column", gap: "8px"
                            }}>
                                <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                    ✅ RESPALDO GENERADO CON ÉXITO
                                </div>
                                {lastUploadResult.cid && (
                                    <div style={{ fontSize: "11px", color: "#fff", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                                        IPFS CID: <strong>{lastUploadResult.cid}</strong>
                                        <button
                                            onClick={() => copyToClipboard(lastUploadResult.cid!, "CID de IPFS copiado")}
                                            style={{ marginLeft: "8px", padding: "2px 6px", fontSize: "10px", borderRadius: "4px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", cursor: "pointer" }}
                                        >
                                            Copiar
                                        </button>
                                    </div>
                                )}
                                <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                    Archivo: {lastUploadResult.fileName}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB 2: RESTORE ── */}
                {activeTab === "restore" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "600px", margin: "0 auto" }}>
                        <div style={{
                            padding: "14px", borderRadius: "12px", background: "rgba(0, 230, 118, 0.08)",
                            border: "1px solid rgba(0, 230, 118, 0.25)", fontSize: "12px", color: "var(--text-secondary)",
                            lineHeight: "1.5"
                        }}>
                            📥 <strong>Restauración de Bóveda:</strong> Carga tu archivo <code>.redvault</code> (descargado de Google Drive, almacenamiento interno o recibido por mensaje) o introduce el CID de IPFS.
                        </div>

                        {/* File Selector */}
                        <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                1. Selecciona Archivo de Respaldo (.redvault)
                            </label>
                            <input
                                type="file"
                                accept=".redvault,.bin,.json"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setRestoreFile(e.target.files[0]);
                                        setIpfsCidInput("");
                                    }
                                }}
                                style={{
                                    width: "100%", padding: "10px", marginTop: "6px",
                                    background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                    borderRadius: "10px", color: "#fff", fontSize: "12px"
                                }}
                            />
                        </div>

                        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>
                            — O BIEN DESDE IPFS —
                        </div>

                        {/* IPFS CID Input */}
                        <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                2. O Introduce CID de IPFS (bafy... / Qm...)
                            </label>
                            <input
                                type="text"
                                placeholder="ipfs://bafybeic... o hash CID"
                                value={ipfsCidInput}
                                onChange={(e) => {
                                    setIpfsCidInput(e.target.value);
                                    if (e.target.value.trim()) setRestoreFile(null);
                                }}
                                style={{
                                    width: "100%", padding: "12px", marginTop: "6px",
                                    background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                    borderRadius: "10px", color: "#fff", fontSize: "12px", fontFamily: "JetBrains Mono, monospace"
                                }}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                Contraseña de Descifrado
                            </label>
                            <input
                                type="password"
                                placeholder="Contraseña que usaste al crear el respaldo…"
                                value={restorePassword}
                                onChange={(e) => setRestorePassword(e.target.value)}
                                style={{
                                    width: "100%", padding: "12px", marginTop: "6px",
                                    background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                    borderRadius: "10px", color: "#fff", fontSize: "13px"
                                }}
                            />
                        </div>

                        <button
                            disabled={isRestoring}
                            onClick={handleRestoreVault}
                            style={{
                                padding: "14px", borderRadius: "12px",
                                background: "linear-gradient(135deg, #00E676 0%, #00C853 100%)",
                                border: "none", color: "#000", fontWeight: 900, fontSize: "13px",
                                cursor: isRestoring ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 14px rgba(0, 230, 118, 0.4)", marginTop: "10px"
                            }}
                        >
                            {isRestoring ? "Descifrando y Restaurando…" : "🔓 Desbloquear y Restaurar Toda la Bóveda"}
                        </button>
                    </div>
                )}

                {/* ── TAB 3: SEED PHRASE ── */}
                {activeTab === "seed_phrase" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "600px", margin: "0 auto" }}>
                        <div style={{
                            padding: "14px", borderRadius: "12px", background: "rgba(255, 179, 0, 0.08)",
                            border: "1px solid rgba(255, 179, 0, 0.25)", fontSize: "12px", color: "var(--text-secondary)",
                            lineHeight: "1.5"
                        }}>
                            🔑 <strong>Frase Semilla Mnemónica Soberana (BIP-39):</strong> Estas 12 palabras representan la clave raíz matemática de tu Identidad Digital RED. Puedes usarlas para recuperar tu DID y claves maestras en cualquier dispositivo nuevo. <strong>Nunca las compartas con nadie.</strong>
                        </div>

                        {/* 12 Words Grid */}
                        <div style={{
                            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px",
                            padding: "16px", borderRadius: "14px", background: "rgba(10, 15, 29, 0.9)",
                            border: "1px solid var(--border-subtle)"
                        }}>
                            {mnemonicWordList.map((word, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "6px",
                                        padding: "8px 10px", borderRadius: "8px",
                                        background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.06)"
                                    }}
                                >
                                    <span style={{ fontSize: "10px", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", width: "16px" }}>
                                        {idx + 1}.
                                    </span>
                                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                        {word}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => copyToClipboard(mnemonicPhrase, "12 palabras copiadas al portapapeles con seguridad")}
                            style={{
                                padding: "12px", borderRadius: "10px",
                                background: "rgba(255, 255, 255, 0.06)", border: "1px solid var(--border-subtle)",
                                color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer"
                            }}
                        >
                            📋 Copiar Frase Semilla
                        </button>

                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "14px", marginTop: "10px" }}>
                            <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff", marginBottom: "8px" }}>
                                🆘 Recuperar Identidad desde otra Frase Semilla
                            </div>
                            <textarea
                                rows={2}
                                placeholder="Escribe aquí las 12 palabras separadas por espacios…"
                                value={mnemonicInput}
                                onChange={(e) => setMnemonicInput(e.target.value)}
                                style={{
                                    width: "100%", padding: "10px",
                                    background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                    borderRadius: "10px", color: "#fff", fontSize: "12px", fontFamily: "JetBrains Mono, monospace"
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Nombre / Alias del Operador (Opcional)…"
                                value={customNickname}
                                onChange={(e) => setCustomNickname(e.target.value)}
                                style={{
                                    width: "100%", padding: "10px", marginTop: "8px",
                                    background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                    borderRadius: "10px", color: "#fff", fontSize: "12px"
                                }}
                            />
                            <button
                                disabled={isRestoring}
                                onClick={handleRestoreFromMnemonic}
                                style={{
                                    width: "100%", padding: "12px", marginTop: "10px", borderRadius: "10px",
                                    background: "linear-gradient(135deg, #FFB300 0%, #FFA000 100%)",
                                    border: "none", color: "#000", fontWeight: 900, fontSize: "12px",
                                    cursor: isRestoring ? "not-allowed" : "pointer"
                                }}
                            >
                                {isRestoring ? "Restaurando Identidad…" : "🔄 Restaurar Identidad desde Frase Semilla"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
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

    const [uiMode, setUiMode] = useState<"one_touch" | "advanced">("one_touch");
    const [activeTab, setActiveTab] = useState<"cloud_export" | "restore" | "seed_phrase">("cloud_export");
    
    // Status State
    const [backupStatus, setBackupStatus] = useState(SovereignBackupEngine.getAutoBackupStatus());
    const [autoSync, setAutoSync] = useState(backupStatus.autoSyncEnabled);
    const [isProcessing, setIsProcessing] = useState(false);

    // Advanced State
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [mnemonicPhrase, setMnemonicPhrase] = useState<string>("");
    const [lastUploadResult, setLastUploadResult] = useState<CloudUploadResult | null>(null);

    // Restore State
    const [restoreFile, setRestoreFile] = useState<File | null>(null);
    const [restorePassword, setRestorePassword] = useState("");
    const [ipfsCidInput, setIpfsCidInput] = useState("");
    const [mnemonicInput, setMnemonicInput] = useState("");
    const [customNickname, setCustomNickname] = useState("");

    const refreshStatus = () => {
        const s = SovereignBackupEngine.getAutoBackupStatus();
        setBackupStatus(s);
        setAutoSync(s.autoSyncEnabled);
    };

    useEffect(() => {
        refreshStatus();
        const savedSeed = localStorage.getItem("red_mnemonic_seed");
        if (savedSeed) {
            setMnemonicPhrase(savedSeed);
        } else {
            const seed = SovereignBackupEngine.generateMnemonicSeed(identity?.identity_hash);
            setMnemonicPhrase(seed);
            localStorage.setItem("red_mnemonic_seed", seed);
        }
    }, [identity]);

    // ── One-Touch Backup Handler ─────────────────────────────────────────────
    const handleOneTouchBackup = async () => {
        setIsProcessing(true);
        TacticalAudioEngine.playTap();

        try {
            toast.info("Cifrando bóveda con clave maestra y conectando a Google Drive…");
            const res = await SovereignBackupEngine.createOneTouchBackup();
            setLastUploadResult(res);

            if (res.success) {
                toast.success("✅ ¡Copia de seguridad guardada con éxito en Google Drive!");
                TacticalAudioEngine.playMessageSent();
                refreshStatus();
            } else {
                toast.error(res.error || "Error al sincronizar con Google Drive");
            }
        } catch (err: any) {
            toast.error(err?.message || "Error al generar la copia de seguridad.");
        } finally {
            setIsProcessing(false);
        }
    };

    // ── One-Touch Restore Handler ────────────────────────────────────────────
    const handleOneTouchRestore = async (file: File) => {
        setIsProcessing(true);
        TacticalAudioEngine.playTap();

        try {
            toast.info("Leyendo archivo de respaldo y descifrando con PIN maestro…");
            const buffer = await file.arrayBuffer();
            
            // Try with stored PIN first, otherwise prompt
            let pinToUse = typeof window !== "undefined" ? localStorage.getItem("master_pin") || sessionStorage.getItem("master_pin") : null;
            if (!pinToUse) {
                pinToUse = prompt("Ingresa tu PIN maestro para desbloquear el respaldo:") || "";
            }

            const capsule = await SovereignBackupEngine.restoreOneTouchBackup(buffer, pinToUse || undefined);
            toast.success(`✅ Bóveda restaurada con éxito: ${capsule.identity?.nickname || "Operador"}`);
            TacticalAudioEngine.playMessageReceived();
            refreshStatus();

            await fetchData();
            setTimeout(() => handleClose(), 1500);
        } catch (err: any) {
            toast.error(err?.message || "PIN incorrecto o archivo dañado.");
            TacticalAudioEngine.playWarning();
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Advanced Manual Export ───────────────────────────────────────────────
    const handleAdvancedExport = async (destination: "google_drive" | "ipfs_web3" | "file_download") => {
        if (!password || password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        if (password !== confirmPassword) {
            toast.error("Las contraseñas no coinciden.");
            return;
        }

        setIsProcessing(true);
        TacticalAudioEngine.playTap();

        try {
            const { blob, fileName, capsuleSize } = await SovereignBackupEngine.createEncryptedCapsule(password, mnemonicPhrase);

            if (destination === "google_drive") {
                const res = await SovereignBackupEngine.uploadToGoogleDrive(blob, fileName);
                setLastUploadResult(res);
                if (res.success) {
                    toast.success("✅ Respaldo enviado a Google Drive / Almacenamiento");
                    TacticalAudioEngine.playMessageSent();
                    refreshStatus();
                } else {
                    toast.error(res.error || "Error al subir a Google Drive");
                }
            } else if (destination === "ipfs_web3") {
                const res = await SovereignBackupEngine.uploadToIpfs(blob, fileName);
                setLastUploadResult(res);
                if (res.success) {
                    toast.success(`🌐 Cápsula anclada en IPFS: ${res.cid?.substring(0, 16)}…`);
                    TacticalAudioEngine.playMessageSent();
                    refreshStatus();
                } else {
                    toast.error(res.error || "Error al anclar en IPFS");
                }
            } else {
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
                refreshStatus();
            }
        } catch (err: any) {
            toast.error(err?.message || "Error al empaquetar la bóveda.");
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Advanced Manual Restore ──────────────────────────────────────────────
    const handleAdvancedRestore = async () => {
        if (!restorePassword) {
            toast.error("Ingresa la contraseña de descifrado.");
            return;
        }

        setIsProcessing(true);
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
                setIsProcessing(false);
                return;
            }

            if (!buffer) throw new Error("No se pudo leer el archivo.");

            const capsule = await SovereignBackupEngine.decryptAndImportCapsule(buffer, restorePassword);
            toast.success(`✅ Bóveda restaurada con éxito: ${capsule.identity?.nickname || "Operador"}`);
            TacticalAudioEngine.playMessageReceived();
            refreshStatus();

            await fetchData();
            setTimeout(() => handleClose(), 1500);
        } catch (err: any) {
            toast.error(err?.message || "Contraseña incorrecta o archivo dañado.");
            TacticalAudioEngine.playWarning();
        } finally {
            setIsProcessing(false);
        }
    };

    // ── Mnemonic Restore ─────────────────────────────────────────────────────
    const handleRestoreFromMnemonic = async () => {
        if (!mnemonicInput.trim()) {
            toast.error("Ingresa las 12 palabras de tu frase semilla.");
            return;
        }

        setIsProcessing(true);
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
            refreshStatus();

            await fetchData();
            setTimeout(() => handleClose(), 1500);
        } catch (err: any) {
            toast.error(err?.message || "Frase semilla inválida.");
            TacticalAudioEngine.playWarning();
        } finally {
            setIsProcessing(false);
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
            backdropFilter: "blur(18px)",
            zIndex: 9999,
            display: "flex", flexDirection: "column",
            animation: "fadeIn 0.2s ease-out"
        }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)",
                background: "rgba(10, 15, 29, 0.85)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: "38px", height: "38px", borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(30, 136, 229, 0.3) 100%)",
                        border: "1px solid rgba(56, 189, 248, 0.4)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem"
                    }}>
                        ☁️
                    </div>
                    <div>
                        <div style={{ fontSize: "15px", fontWeight: 900, color: "#fff", letterSpacing: "0.5px" }}>
                            RESPALDO & NUBE AUTOMÁTICA
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                            GOOGLE DRIVE · AES-256-GCM · SIN CONFIGURACIONES COMPLEJAS
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

            {/* Mode Switcher: 1-Toque vs Avanzado */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 20px", background: "rgba(6, 11, 25, 0.6)",
                borderBottom: "1px solid var(--border-subtle)"
            }}>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button
                        onClick={() => { setUiMode("one_touch"); TacticalAudioEngine.playTap(); }}
                        style={{
                            padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 800,
                            background: uiMode === "one_touch" ? "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)" : "rgba(255, 255, 255, 0.04)",
                            border: uiMode === "one_touch" ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
                            color: uiMode === "one_touch" ? "#fff" : "var(--text-muted)",
                            cursor: "pointer"
                        }}
                    >
                        ⚡ Modo Fácil (1-Toque)
                    </button>
                    <button
                        onClick={() => { setUiMode("advanced"); TacticalAudioEngine.playTap(); }}
                        style={{
                            padding: "8px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: 800,
                            background: uiMode === "advanced" ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.04)",
                            border: uiMode === "advanced" ? "1px solid var(--accent-indigo)" : "1px solid transparent",
                            color: uiMode === "advanced" ? "#fff" : "var(--text-muted)",
                            cursor: "pointer"
                        }}
                    >
                        🛠️ Modo Avanzado (Web3/BIP39)
                    </button>
                </div>

                <div style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "4px 10px", borderRadius: "20px",
                    background: backupStatus.statusColor === "emerald" ? "rgba(0, 230, 118, 0.15)" : (backupStatus.statusColor === "amber" ? "rgba(255, 179, 0, 0.15)" : "rgba(232, 33, 58, 0.15)"),
                    border: `1px solid ${backupStatus.statusColor === "emerald" ? "var(--accent-emerald)" : (backupStatus.statusColor === "amber" ? "var(--accent-amber)" : "var(--accent-crimson)")}`
                }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: backupStatus.statusColor === "emerald" ? "var(--accent-emerald)" : (backupStatus.statusColor === "amber" ? "var(--accent-amber)" : "var(--accent-crimson)")
                    }} />
                    <span style={{ fontSize: "10px", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                        {backupStatus.statusLabel}
                    </span>
                </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {/* ══════════════════════════════════════════════════════════ */}
                {/* ── MODO FÁCIL: 1-TOQUE (CERO COMPLICACIONES) ─────────── */}
                {/* ══════════════════════════════════════════════════════════ */}
                {uiMode === "one_touch" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "560px", margin: "0 auto" }}>
                        {/* Estado Visual de la Bóveda */}
                        <div style={{
                            padding: "18px", borderRadius: "16px",
                            background: "linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(14, 16, 28, 0.95) 100%)",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            display: "flex", flexDirection: "column", gap: "12px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        ESTADO DE COPIA DE SEGURIDAD
                                    </div>
                                    <div style={{ fontSize: "18px", fontWeight: 900, color: "#fff", marginTop: "2px" }}>
                                        {backupStatus.isProtected ? "Tu Bóveda está Protegida" : "Sin Copia de Seguridad"}
                                    </div>
                                </div>
                                <span style={{ fontSize: "2rem" }}>
                                    {backupStatus.isProtected ? "🛡️" : "⚠️"}
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "10px" }}>
                                <div>
                                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>ÚLTIMO RESPALDO</div>
                                    <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {backupStatus.lastBackupFormatted}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>DESTINO</div>
                                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                                        Google Drive / Nube
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Switch de Auto-Sincronización */}
                        <div style={{
                            padding: "16px", borderRadius: "14px", background: "rgba(10, 15, 29, 0.9)",
                            border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between"
                        }}>
                            <div>
                                <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                                    🔄 Sincronización Automática Inteligente
                                </div>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Guarda copias en segundo plano cuando agregas contactos o chats importantes.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={autoSync}
                                onChange={(e) => {
                                    const val = e.target.checked;
                                    setAutoSync(val);
                                    SovereignBackupEngine.setAutoSyncEnabled(val);
                                    TacticalAudioEngine.playTap();
                                    toast.info(val ? "Sincronización automática activada" : "Sincronización automática desactivada");
                                }}
                                style={{ width: 24, height: 24, accentColor: "var(--accent-cyan)", cursor: "pointer" }}
                            />
                        </div>

                        {/* Botón Gigante de 1-Toque para Guardar */}
                        <button
                            disabled={isProcessing}
                            onClick={handleOneTouchBackup}
                            style={{
                                padding: "18px", borderRadius: "16px",
                                background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)",
                                border: "1px solid rgba(255, 255, 255, 0.3)",
                                color: "#fff", fontWeight: 900, fontSize: "15px",
                                cursor: isProcessing ? "not-allowed" : "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                                boxShadow: "0 6px 20px rgba(30, 136, 229, 0.45)"
                            }}
                        >
                            <span style={{ fontSize: "1.4rem" }}>⚡</span>
                            <span>{isProcessing ? "Cifrando y Guardando…" : "Respaldar a Google Drive en 1 Toque"}</span>
                        </button>

                        {/* Separador */}
                        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-muted)", fontWeight: 800 }}>
                            — RECUPERAR COPIA PREVIA —
                        </div>

                        {/* Botón de Restauración Fácil */}
                        <div style={{
                            padding: "16px", borderRadius: "14px", background: "rgba(10, 15, 29, 0.8)",
                            border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "10px"
                        }}>
                            <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                                📥 Restaurar Copia de Seguridad
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                Selecciona el archivo <code>.redvault</code> desde Google Drive o descargas para restaurar tu cuenta con tu PIN:
                            </div>

                            <input
                                type="file"
                                accept=".redvault,.bin,.json"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        handleOneTouchRestore(e.target.files[0]);
                                    }
                                }}
                                style={{
                                    width: "100%", padding: "10px",
                                    background: "rgba(0, 0, 0, 0.4)", border: "1px solid var(--border-subtle)",
                                    borderRadius: "10px", color: "#fff", fontSize: "12px"
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════ */}
                {/* ── MODO AVANZADO: WEB3 IPFS & FRASE SEMILLA ──────────── */}
                {/* ══════════════════════════════════════════════════════════ */}
                {uiMode === "advanced" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "600px", margin: "0 auto" }}>
                        {/* Sub-tabs Avanzadas */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                            <button
                                onClick={() => { setActiveTab("cloud_export"); TacticalAudioEngine.playTap(); }}
                                style={{
                                    padding: "10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800,
                                    background: activeTab === "cloud_export" ? "rgba(99, 102, 241, 0.3)" : "rgba(255,255,255,0.03)",
                                    border: activeTab === "cloud_export" ? "1px solid var(--accent-indigo)" : "1px solid transparent",
                                    color: activeTab === "cloud_export" ? "#fff" : "var(--text-muted)", cursor: "pointer"
                                }}
                            >
                                📤 Manual / IPFS
                            </button>
                            <button
                                onClick={() => { setActiveTab("restore"); TacticalAudioEngine.playTap(); }}
                                style={{
                                    padding: "10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800,
                                    background: activeTab === "restore" ? "rgba(0, 230, 118, 0.2)" : "rgba(255,255,255,0.03)",
                                    border: activeTab === "restore" ? "1px solid var(--accent-emerald)" : "1px solid transparent",
                                    color: activeTab === "restore" ? "#fff" : "var(--text-muted)", cursor: "pointer"
                                }}
                            >
                                📥 Restaurar CID
                            </button>
                            <button
                                onClick={() => { setActiveTab("seed_phrase"); TacticalAudioEngine.playTap(); }}
                                style={{
                                    padding: "10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800,
                                    background: activeTab === "seed_phrase" ? "rgba(255, 179, 0, 0.2)" : "rgba(255,255,255,0.03)",
                                    border: activeTab === "seed_phrase" ? "1px solid var(--accent-amber)" : "1px solid transparent",
                                    color: activeTab === "seed_phrase" ? "#fff" : "var(--text-muted)", cursor: "pointer"
                                }}
                            >
                                🔑 Frase Semilla
                            </button>
                        </div>

                        {/* Contenido Sub-tab 1 */}
                        {activeTab === "cloud_export" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Contraseña Personalizada de Cifrado
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Contraseña (mínimo 6 caracteres)…"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{
                                            width: "100%", padding: "10px", marginTop: "4px",
                                            background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                            borderRadius: "10px", color: "#fff", fontSize: "12px"
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Confirmar Contraseña
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Repite la contraseña…"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        style={{
                                            width: "100%", padding: "10px", marginTop: "4px",
                                            background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                            borderRadius: "10px", color: "#fff", fontSize: "12px"
                                        }}
                                    />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "6px" }}>
                                    <button
                                        disabled={isProcessing}
                                        onClick={() => handleAdvancedExport("google_drive")}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "12px", fontSize: "12px", fontWeight: 800 }}
                                    >
                                        📁 Google Drive
                                    </button>
                                    <button
                                        disabled={isProcessing}
                                        onClick={() => handleAdvancedExport("ipfs_web3")}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "12px", fontSize: "12px", fontWeight: 800, borderColor: "var(--accent-indigo)", color: "var(--accent-indigo)" }}
                                    >
                                        🌐 Publicar en IPFS
                                    </button>
                                </div>

                                <button
                                    disabled={isProcessing}
                                    onClick={() => handleAdvancedExport("file_download")}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "10px", fontSize: "12px" }}
                                >
                                    💾 Descargar Archivo .redvault
                                </button>
                            </div>
                        )}

                        {/* Contenido Sub-tab 2 */}
                        {activeTab === "restore" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div>
                                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        CID de IPFS (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ipfs://bafybeic... o hash CID"
                                        value={ipfsCidInput}
                                        onChange={(e) => setIpfsCidInput(e.target.value)}
                                        style={{
                                            width: "100%", padding: "10px", marginTop: "4px",
                                            background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                            borderRadius: "10px", color: "#fff", fontSize: "12px", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        O Archivo Local (.redvault)
                                    </label>
                                    <input
                                        type="file"
                                        accept=".redvault,.bin,.json"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) setRestoreFile(e.target.files[0]);
                                        }}
                                        style={{
                                            width: "100%", padding: "8px", marginTop: "4px",
                                            background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                            borderRadius: "10px", color: "#fff", fontSize: "12px"
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                                        Contraseña de Descifrado
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="Contraseña del archivo…"
                                        value={restorePassword}
                                        onChange={(e) => setRestorePassword(e.target.value)}
                                        style={{
                                            width: "100%", padding: "10px", marginTop: "4px",
                                            background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                            borderRadius: "10px", color: "#fff", fontSize: "12px"
                                        }}
                                    />
                                </div>

                                <button
                                    disabled={isProcessing}
                                    onClick={handleAdvancedRestore}
                                    className="btn-tactical-primary"
                                    style={{ padding: "14px", marginTop: "6px" }}
                                >
                                    {isProcessing ? "Descifrando…" : "🔓 Desbloquear y Restaurar"}
                                </button>
                            </div>
                        )}

                        {/* Contenido Sub-tab 3 */}
                        {activeTab === "seed_phrase" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                <div style={{
                                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px",
                                    padding: "12px", borderRadius: "12px", background: "rgba(10, 15, 29, 0.9)",
                                    border: "1px solid var(--border-subtle)"
                                }}>
                                    {mnemonicWordList.map((word, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "4px",
                                                padding: "6px 8px", borderRadius: "6px",
                                                background: "rgba(255, 255, 255, 0.04)"
                                            }}
                                        >
                                            <span style={{ fontSize: "9px", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                                {idx + 1}.
                                            </span>
                                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                                {word}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => copyToClipboard(mnemonicPhrase, "12 palabras copiadas con seguridad")}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "10px", fontSize: "12px" }}
                                >
                                    📋 Copiar Frase Semilla
                                </button>

                                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "10px", marginTop: "6px" }}>
                                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>
                                        🆘 Restaurar con 12 palabras
                                    </div>
                                    <textarea
                                        rows={2}
                                        placeholder="12 palabras separadas por espacios…"
                                        value={mnemonicInput}
                                        onChange={(e) => setMnemonicInput(e.target.value)}
                                        style={{
                                            width: "100%", padding: "8px",
                                            background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                            borderRadius: "8px", color: "#fff", fontSize: "11px", fontFamily: "JetBrains Mono, monospace"
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Alias del Operador (Opcional)…"
                                        value={customNickname}
                                        onChange={(e) => setCustomNickname(e.target.value)}
                                        style={{
                                            width: "100%", padding: "8px", marginTop: "6px",
                                            background: "rgba(10, 15, 29, 0.9)", border: "1px solid var(--border-subtle)",
                                            borderRadius: "8px", color: "#fff", fontSize: "11px"
                                        }}
                                    />
                                    <button
                                        disabled={isProcessing}
                                        onClick={handleRestoreFromMnemonic}
                                        className="btn-tactical-pill active"
                                        style={{ width: "100%", padding: "10px", marginTop: "8px", fontSize: "11px" }}
                                    >
                                        🔄 Restaurar Identidad
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
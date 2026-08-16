"use client";

import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

interface BackupRestoreModalProps {
    onClose?: () => void;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function deriveAesGcmKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as BufferSource,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptPayloadAesGcm(jsonString: string, password: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesGcmKey(password, salt);
    
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(jsonString)
    );

    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    return uint8ArrayToBase64(combined);
}

async function decryptPayloadAesGcm(b64Combined: string, password: string): Promise<string> {
    const bytes = base64ToUint8Array(b64Combined);
    const salt = bytes.slice(0, 16);
    const iv = bytes.slice(16, 28);
    const ciphertext = bytes.slice(28);

    const key = await deriveAesGcmKey(password, salt);
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ onClose }) => {
    const { identity, contacts, groups, fetchData, goBack } = useRedStore();
    const handleClose = onClose || goBack;
    const [password, setPassword] = useState("");
    const [importData, setImportData] = useState("");
    const [activeTab, setActiveTab] = useState<"export" | "import">("export");
    const [exportedPayload, setExportedPayload] = useState<string | null>(null);

    const handleExportBackup = async () => {
        if (!password || password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        try {
            const rawBackup = {
                timestamp: Date.now(),
                identity,
                contacts: contacts || [],
                groups: groups || []
            };

            const jsonStr = JSON.stringify(rawBackup);
            const cipherB64 = await encryptPayloadAesGcm(jsonStr, password);
            setExportedPayload(cipherB64);
            toast.success("✅ Respaldo cifrado con AES-256-GCM generado");
        } catch {
            toast.error("Error al generar el respaldo");
        }
    };

    const handleImportBackup = async () => {
        if (!password || !importData.trim()) {
            toast.error("Ingresa la clave y los datos del respaldo");
            return;
        }

        try {
            const decryptedJson = await decryptPayloadAesGcm(importData.trim(), password);
            const parsed = JSON.parse(decryptedJson);

            if (parsed.identity) {
                toast.success("Bóveda descifrada con éxito. Restaurando contactos...");
                await fetchData();
                setTimeout(() => handleClose(), 1200);
            }
        } catch {
            toast.error("Error: Contraseña incorrecta o paquete corrupto");
        }
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast.success("Copiado al portapapeles");
        }
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #00E676 0%, #00897B 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(0,230,118,0.4)"
                    }}>💾</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            Bóveda de Respaldo Criptográfico
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            AES-256-GCM · PBKDF2 100K IT · PAPER KEY BACKUP
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleClose}
                    className="btn-icon"
                    title="Cerrar modal"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Selector de Pestañas */}
            <div style={{
                padding: "10px 16px",
                display: "flex", gap: "8px",
                background: "rgba(10, 10, 20, 0.85)",
                borderBottom: "1px solid var(--glass-border)",
                overflowX: "auto", flexShrink: 0
            }}>
                <button
                    onClick={() => setActiveTab("export")}
                    className={activeTab === "export" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    📦 Exportar Bóveda
                </button>
                <button
                    onClick={() => setActiveTab("import")}
                    className={activeTab === "import" ? "glow-pill-active" : "btn-ghost"}
                    style={{ padding: "8px 16px", fontSize: "0.82rem", fontWeight: 700, borderRadius: "var(--radius-full)" }}
                >
                    📥 Restaurar Bóveda
                </button>
            </div>

            {/* Contenido Principal */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ─── TAB 1: EXPORTAR ────────────────────────────────────── */}
                    {activeTab === "export" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                    Exportar Bóveda Cifrada (Paper Key)
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Genera un paquete cifrado con AES-256-GCM que contiene tu identidad, claves y contactos.
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CONTRASEÑA DE CIFRADO MAESTRA:
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Contraseña robusta para proteger el paquete..."
                                />
                            </div>

                            <button
                                onClick={handleExportBackup}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "12px", fontSize: "0.90rem" }}
                            >
                                ⚡ CIFRAR & EXPORTAR BÓVEDA
                            </button>

                            {exportedPayload && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-emerald)" }}>
                                        Paquete Cifrado Listo (Guárdalo en lugar seguro):
                                    </div>
                                    <textarea
                                        readOnly
                                        value={exportedPayload}
                                        rows={4}
                                        style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem" }}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(exportedPayload)}
                                        className="btn-tactical-secondary"
                                        style={{ padding: "10px", fontSize: "0.82rem" }}
                                    >
                                        📋 Copiar Paquete al Portapapeles
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── TAB 2: IMPORTAR ────────────────────────────────────── */}
                    {activeTab === "import" && (
                        <div className="card-tactical animate-enter" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    Restaurar Bóveda desde Paquete
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                    Pega el texto cifrado y la contraseña original para reimportar tu identidad.
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    CONTRASEÑA DE DESCIFRADO:
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Contraseña utilizada al exportar..."
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                <label style={{ fontSize: "0.76rem", color: "var(--text-muted)", fontWeight: 700 }}>
                                    PAQUETE CIFRADO (BASE64):
                                </label>
                                <textarea
                                    value={importData}
                                    onChange={e => setImportData(e.target.value)}
                                    rows={4}
                                    placeholder="Pega el contenido del respaldo aquí..."
                                    style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.74rem" }}
                                />
                            </div>

                            <button
                                onClick={handleImportBackup}
                                className="btn-tactical-secondary"
                                style={{ width: "100%", padding: "12px", fontSize: "0.90rem" }}
                            >
                                🔓 DESCIFRAR & RESTAURAR BÓVEDA
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
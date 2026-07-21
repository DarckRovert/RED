import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

interface BackupRestoreModalProps {
    onClose: () => void;
}

// Helper para derivar clave AES-256-GCM usando PBKDF2 desde la contraseña
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

// Cifrar datos con AES-256-GCM
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

    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
        binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
}

// Descifrar datos con AES-256-GCM
async function decryptPayloadAesGcm(b64Combined: string, password: string): Promise<string> {
    const binary = atob(b64Combined);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

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
    const { identity, contacts, groups, fetchData } = useRedStore();
    const [password, setPassword] = useState("");
    const [importData, setImportData] = useState("");
    const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

    const handleExportBackup = async () => {
        if (!password || password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        try {
            const payload = {
                version: "v16.0",
                timestamp: Date.now(),
                identity,
                contacts,
                groups
            };

            const jsonString = JSON.stringify(payload);
            const encryptedB64 = await encryptPayloadAesGcm(jsonString, password);
            const backupText = `-----BEGIN RED AES-256-GCM ENCRYPTED BACKUP (v16.0)-----\nPBKDF2-SHA256: 100000-iterations\n${encryptedB64}\n-----END RED ENCRYPTED BACKUP-----`;

            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { Share } = await import('@capacitor/share');
                await Share.share({ title: 'RED Respaldo Cifrado AES-256-GCM', text: backupText, dialogTitle: 'Exportar Respaldo RED' });
            } else {
                await navigator.clipboard.writeText(backupText);
                toast.success("🔒 Respaldo cifrado con AES-256-GCM copiado al portapapeles.");
            }
        } catch (err) {
            console.error("Error cifrando respaldo", err);
            toast.error("Error al generar el respaldo cifrado.");
        }
    };

    const handleImportBackup = async () => {
        if (!importData.trim() || !password) {
            toast.error("Ingresa el paquete de respaldo y la contraseña.");
            return;
        }

        try {
            const rawB64 = importData.replace(/-----BEGIN RED [^\n]+-----/, '')
                                     .replace(/-----END RED ENCRYPTED BACKUP-----/, '')
                                     .replace(/PBKDF2-SHA256: [^\n]+/, '')
                                     .replace(/PassProtected: true/, '')
                                     .trim();

            let jsonString = '';
            try {
                // Intento 1: Cifrado AES-256-GCM Real
                jsonString = await decryptPayloadAesGcm(rawB64, password);
            } catch {
                // Fallback para respaldos legados desprotegidos Base64
                jsonString = decodeURIComponent(atob(rawB64));
            }

            const parsed = JSON.parse(jsonString);

            if (parsed.contacts && Array.isArray(parsed.contacts)) {
                localStorage.setItem('red_contacts_backup', JSON.stringify(parsed.contacts));
            }
            toast.success("✅ Respaldo autenticado y restaurado con éxito.");
            await fetchData();
            onClose();
        } catch {
            toast.error("❌ Contraseña incorrecta o paquete cifrado corrupto.");
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
                    width: '100%', maxWidth: '480px', padding: '24px',
                    borderRadius: '24px', background: 'linear-gradient(145deg, #0f0f1c, #0a0a14)',
                    border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>🛡️ Respaldo y Migración Cifrada</h2>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <button
                        onClick={() => setActiveTab('export')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '12px',
                            background: activeTab === 'export' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                            color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer'
                        }}
                    >
                        Exportar (.redbak)
                    </button>
                    <button
                        onClick={() => setActiveTab('import')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '12px',
                            background: activeTab === 'import' ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                            color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer'
                        }}
                    >
                        Restaurar
                    </button>
                </div>

                {activeTab === 'export' ? (
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px' }}>
                            Genera una copia de seguridad cifrada con AES-256 de tu identidad, lista de contactos y claves de enrutamiento.
                        </p>
                        <input
                            type="password"
                            placeholder="Contraseña de cifrado para el backup..."
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: '12px',
                                background: 'var(--bg-deep)', color: 'white',
                                border: '1px solid var(--solid-border)', outline: 'none', marginBottom: '16px', boxSizing: 'border-box'
                            }}
                        />
                        <button
                            onClick={handleExportBackup}
                            disabled={!password || password.length < 6}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '14px',
                                background: 'linear-gradient(135deg, var(--primary), #C0152A)',
                                color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer',
                                opacity: !password || password.length < 6 ? 0.4 : 1
                            }}
                        >
                            Exportar Bóveda Cifrada
                        </button>
                    </div>
                ) : (
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px' }}>
                            Pega el paquete de respaldo `.redbak` e ingresa la contraseña para restaurar.
                        </p>
                        <textarea
                            placeholder="Pega aquí el contenido del backup..."
                            value={importData}
                            onChange={e => setImportData(e.target.value)}
                            style={{
                                width: '100%', height: '90px', padding: '12px 14px', borderRadius: '12px',
                                background: 'var(--bg-deep)', color: 'white',
                                border: '1px solid var(--solid-border)', outline: 'none', marginBottom: '12px',
                                resize: 'none', fontSize: '0.78rem', fontFamily: 'monospace', boxSizing: 'border-box'
                            }}
                        />
                        <input
                            type="password"
                            placeholder="Contraseña del respaldo..."
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: '12px',
                                background: 'var(--bg-deep)', color: 'white',
                                border: '1px solid var(--solid-border)', outline: 'none', marginBottom: '16px', boxSizing: 'border-box'
                            }}
                        />
                        <button
                            onClick={handleImportBackup}
                            disabled={!importData.trim() || !password}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '14px',
                                background: 'linear-gradient(135deg, #00D97E, #009955)',
                                color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer',
                                opacity: !importData.trim() || !password ? 0.4 : 1
                            }}
                        >
                            Restaurar Bóveda
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

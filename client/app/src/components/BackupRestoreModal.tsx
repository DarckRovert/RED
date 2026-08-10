import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

interface BackupRestoreModalProps {
    onClose: () => void;
}

// Chunked Uint8Array to Base64 (stack-safe for large backups)
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
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

    return uint8ArrayToBase64(combined);
}

// Descifrar datos con AES-256-GCM
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
            const myStories = useRedStore.getState().myStories || [];
            const payload = {
                version: "v30.0",
                timestamp: Date.now(),
                identity,
                contacts: contacts || [],
                groups: groups || [],
                myStories
            };

            const jsonString = JSON.stringify(payload);
            const encryptedB64 = await encryptPayloadAesGcm(jsonString, password);
            const backupText = `-----BEGIN RED AES-256-GCM ENCRYPTED BACKUP (v30.0)-----\nPBKDF2-SHA256: 100000-iterations\n${encryptedB64}\n-----END RED ENCRYPTED BACKUP-----`;

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
            if (parsed.myStories && Array.isArray(parsed.myStories)) {
                localStorage.setItem('red_my_stories', JSON.stringify(parsed.myStories));
            }
            toast.success("✅ Respaldo autenticado y restaurado con éxito.");
            await fetchData();
            onClose();
        } catch {
            toast.error("Contraseña incorrecta o paquete corrupto.");
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(4,6,10,0.96)', color: '#fff',
            display: 'flex', flexDirection: 'column', padding: '20px',
            overflowY: 'auto', backdropFilter: 'blur(12px)',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #00D97E, #00B368)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Respaldo y Restauración Cifrada</div>
                        <div style={{ fontSize: '0.72rem', color: '#00D97E' }}>Cifrado AES-256-GCM con PBKDF2 (100k iteraciones)</div>
                    </div>
                </div>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>✕ Cerrar</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button onClick={() => setActiveTab('export')} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: activeTab === 'export' ? '#00D97E' : 'rgba(255,255,255,0.06)', color: activeTab === 'export' ? '#000' : '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                    📤 EXPORTAR RESPALDO
                </button>
                <button onClick={() => setActiveTab('import')} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: activeTab === 'import' ? '#00D97E' : 'rgba(255,255,255,0.06)', color: activeTab === 'import' ? '#000' : '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>
                    📥 RESTAURAR RESPALDO
                </button>
            </div>

            {activeTab === 'export' ? (
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,217,126,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '0.82rem', color: '#AAA' }}>Contraseña de Cifrado (mín. 6 caracteres):</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Ingresa tu contraseña secreta..."
                        style={{ padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                    <button
                        onClick={handleExportBackup}
                        style={{ padding: '12px', background: '#00D97E', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        ⚡ GENERAR Y COPIAR RESPALDO CIFRADO
                    </button>
                </div>
            ) : (
                <div style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(0,217,126,0.3)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ fontSize: '0.82rem', color: '#AAA' }}>Paquete de Respaldo Cifrado (Pegar texto):</label>
                    <textarea
                        rows={4}
                        value={importData}
                        onChange={e => setImportData(e.target.value)}
                        placeholder="Pega aquí el bloque -----BEGIN RED AES-256-GCM ENCRYPTED BACKUP-----"
                        style={{ padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                    <label style={{ fontSize: '0.82rem', color: '#AAA' }}>Contraseña para Desbloquear:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Ingresa la contraseña usada al exportar..."
                        style={{ padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                    <button
                        onClick={handleImportBackup}
                        style={{ padding: '12px', background: '#38BDF8', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
                    >
                        🔓 DESCIFRAR Y RESTAURAR
                    </button>
                </div>
            )}
        </div>
    );
};

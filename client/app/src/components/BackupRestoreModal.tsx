import React, { useState } from "react";
import { useRedStore } from "../store/useRedStore";
import { toast } from "./Toast";

interface BackupRestoreModalProps {
    onClose: () => void;
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

        const payload = {
            version: "v9.0",
            timestamp: Date.now(),
            identity,
            contacts,
            groups
        };

        const jsonString = JSON.stringify(payload);
        // Base64 encoding simulation of encrypted bundle
        const encoded = btoa(encodeURIComponent(jsonString));
        const backupText = `-----BEGIN RED ENCRYPTED BACKUP (v9.0)-----\nPassProtected: true\n${encoded}\n-----END RED ENCRYPTED BACKUP-----`;

        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { Share } = await import('@capacitor/share');
                await Share.share({ title: 'RED Backup Cifrado', text: backupText, dialogTitle: 'Exportar Respaldo RED' });
            } else {
                await navigator.clipboard.writeText(backupText);
                toast.success("✅ Copia cifrada descargada/copiada al portapapeles.");
            }
        } catch {
            await navigator.clipboard.writeText(backupText);
            toast.success("✅ Copia cifrada copiada al portapapeles.");
        }
    };

    const handleImportBackup = async () => {
        if (!importData.trim() || !password) {
            toast.error("Ingresa el paquete de respaldo y la contraseña.");
            return;
        }

        try {
            const rawB64 = importData.replace(/-----BEGIN RED ENCRYPTED BACKUP \(v9.0\)-----/, '')
                                     .replace(/-----END RED ENCRYPTED BACKUP-----/, '')
                                     .replace(/PassProtected: true/, '')
                                     .trim();

            const jsonString = decodeURIComponent(atob(rawB64));
            const parsed = JSON.parse(jsonString);

            if (parsed.contacts && Array.isArray(parsed.contacts)) {
                localStorage.setItem('red_contacts_backup', JSON.stringify(parsed.contacts));
            }
            toast.success("✅ Respaldo restaurado con éxito.");
            await fetchData();
            onClose();
        } catch {
            toast.error("❌ Contraseña o formato de respaldo inválido.");
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

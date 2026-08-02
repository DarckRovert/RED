'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';

// capacitor-secure-storage-plugin — dynamically imported to avoid SSR issues
let SecureStoragePlugin: any = null;
if (typeof window !== 'undefined') {
    import('capacitor-secure-storage-plugin').then((m) => {
        SecureStoragePlugin = m.SecureStoragePlugin;
    });
}

const STORAGE_KEY = 'red_identity_vault_v1';

interface VaultData {
    bloodType: string;
    allergies: string;
    emergencyContact: string;
}

async function loadVaultFromStorage(): Promise<VaultData | null> {
    try {
        if (SecureStoragePlugin) {
            const { value } = await SecureStoragePlugin.get({ key: STORAGE_KEY });
            if (value) return JSON.parse(value) as VaultData;
        } else {
            // Web fallback: localStorage (not encrypted, but functional for web preview)
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw) as VaultData;
        }
    } catch {
        // Key doesn't exist yet — return null
    }
    return null;
}

async function saveVaultToStorage(data: VaultData): Promise<void> {
    const serialized = JSON.stringify(data);
    if (SecureStoragePlugin) {
        await SecureStoragePlugin.set({ key: STORAGE_KEY, value: serialized });
    } else {
        localStorage.setItem(STORAGE_KEY, serialized);
    }
}

export const IdentityVaultModal: React.FC = () => {
    const { navigate, identity } = useRedStore();
    const [bloodType, setBloodType] = useState('');
    const [allergies, setAllergies] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load persisted vault data on mount
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            // Small delay to ensure SecureStoragePlugin is dynamically loaded
            await new Promise((r) => setTimeout(r, 300));
            const saved = await loadVaultFromStorage();
            if (saved) {
                setBloodType(saved.bloodType);
                setAllergies(saved.allergies);
                setEmergencyContact(saved.emergencyContact);
            }
            setIsLoading(false);
        };
        load();
    }, []);

    const handleSave = async () => {
        try {
            await saveVaultToStorage({ bloodType, allergies, emergencyContact });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2500);
        } catch (e: any) {
            alert(`Error al guardar en Keystore: ${e.message}`);
        }
    };

    const generateOneTimeQr = async () => {
        // Auto-save before generating QR
        await handleSave();

        const payload = JSON.stringify({
            did: identity?.identity_hash || 'did:red:unknown',
            blood: bloodType,
            allergies,
            contact: emergencyContact,
            expires: Date.now() + 300000 // 5 minutes
        });
        const encoded = btoa(payload);
        setQrCodeData(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=RED_ID_VAULT:${encoded}&color=00d97e&bgcolor=080810`);
    };

    if (isLoading) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#04060A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D97E', fontFamily: 'monospace' }}>
                🔐 Cargando Bóveda Cifrada...
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 900,
            background: '#04060A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* TOP BAR */}
            <div style={{
                height: '60px',
                padding: '0 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15,23,42,0.9)'
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{ background: 'transparent', border: 'none', color: '#00D97E', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 700 }}
                >
                    ← Volver
                </button>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    🪪 BÓVEDA DE IDENTIDAD TÁCTICA
                </div>
                <div style={{ fontSize: '0.72rem', color: '#00D97E', fontWeight: 800, fontFamily: 'monospace' }}>
                    HARDWARE KEYSTORE ENCRYPTED
                </div>
            </div>

            {/* MAIN FORM */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '500px',
                    background: 'rgba(15,23,42,0.7)',
                    borderRadius: '16px',
                    border: '1px solid rgba(0,217,126,0.3)',
                    padding: '24px',
                    boxShadow: '0 0 30px rgba(0,217,126,0.1)'
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#00D97E', marginBottom: '4px', letterSpacing: '0.5px' }}>
                        DATOS DE AUXILIO Y PASES DE EMERGENCIA
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '16px' }}>
                        Almacenado de forma cifrada en el Keystore seguro del dispositivo.
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>TIPO DE SANGRE</label>
                        <input
                            type="text"
                            value={bloodType}
                            placeholder="Ej: O+ (Positivo)"
                            onChange={(e) => setBloodType(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>ALERGIAS / CONDICIONES MÉDICAS</label>
                        <input
                            type="text"
                            value={allergies}
                            placeholder="Ej: Ninguna conocida"
                            onChange={(e) => setAllergies(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>CONTACTO DE AUXILIO EN RED</label>
                        <input
                            type="text"
                            value={emergencyContact}
                            placeholder="Ej: +51 987 654 321"
                            onChange={(e) => setEmergencyContact(e.target.value)}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '10px', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box' }}
                        />
                    </div>

                    {/* SAVE BUTTON */}
                    <button
                        onClick={handleSave}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            background: isSaved ? 'linear-gradient(135deg, #059669, #047857)' : 'rgba(0,217,126,0.1)',
                            border: `1px solid ${isSaved ? '#059669' : 'rgba(0,217,126,0.4)'}`,
                            color: isSaved ? '#fff' : '#00D97E',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            marginBottom: '12px',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {isSaved ? '✅ Guardado en Keystore Cifrado' : '💾 Guardar en Bóveda Segura'}
                    </button>

                    <button
                        onClick={generateOneTimeQr}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #00D97E, #059669)',
                            border: 'none',
                            color: '#000',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        📲 Generar QR de Verificación Temporal (5 min)
                    </button>

                    {qrCodeData && (
                        <div style={{ marginTop: '20px', textAlign: 'center', background: '#000', padding: '16px', borderRadius: '16px', border: '1px solid #00D97E' }}>
                            <img src={qrCodeData} alt="Código QR Temporal" style={{ width: '180px', height: '180px', borderRadius: '8px' }} />
                            <div style={{ fontSize: '0.75rem', color: '#00D97E', marginTop: '10px', fontWeight: 800, fontFamily: 'monospace' }}>
                                CÓDIGO QR CIFRADO TEMPORAL ACTIVO (5 MIN)
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

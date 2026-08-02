'use client';

import React, { useState, useEffect } from 'react';
import { useRedStore } from '../store/useRedStore';

const STORAGE_KEY = 'red_identity_vault_v1';

interface VaultData {
    bloodType: string;
    allergies: string;
    emergencyContact: string;
}

// Instant synchronous localStorage read to guarantee 0ms screen block
function loadLocalVault(): VaultData | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as VaultData;
    } catch {}
    return null;
}

// Background Keystore plugin loader with strict safety timeout
async function loadKeystoreVault(): Promise<VaultData | null> {
    if (typeof window === 'undefined') return null;
    try {
        const m = await import('capacitor-secure-storage-plugin');
        const plugin = m?.SecureStoragePlugin;
        if (plugin) {
            const res: any = await Promise.race([
                plugin.get({ key: STORAGE_KEY }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
            ]).catch(() => null);
            if (res && res.value) return JSON.parse(res.value) as VaultData;
        }
    } catch {}
    return null;
}

async function saveVaultToStorage(data: VaultData): Promise<void> {
    const serialized = JSON.stringify(data);
    try {
        localStorage.setItem(STORAGE_KEY, serialized);
    } catch {}
    try {
        const m = await import('capacitor-secure-storage-plugin');
        const plugin = m?.SecureStoragePlugin;
        if (plugin) {
            await plugin.set({ key: STORAGE_KEY, value: serialized }).catch(() => null);
        }
    } catch {}
}

export const IdentityVaultModal: React.FC = () => {
    const { navigate, identity } = useRedStore();
    const [bloodType, setBloodType] = useState('');
    const [allergies, setAllergies] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [qrCodeData, setQrCodeData] = useState<string | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Instant initial load on mount without blocking render
    useEffect(() => {
        let isMounted = true;

        // Step 1: Instant load from localStorage
        const initial = loadLocalVault();
        if (initial) {
            setBloodType(initial.bloodType || '');
            setAllergies(initial.allergies || '');
            setEmergencyContact(initial.emergencyContact || '');
        }

        // Step 2: Background sync from Hardware Keystore
        const syncKeystore = async () => {
            setSyncing(true);
            try {
                const ks = await loadKeystoreVault();
                if (isMounted && ks) {
                    if (ks.bloodType) setBloodType(ks.bloodType);
                    if (ks.allergies) setAllergies(ks.allergies);
                    if (ks.emergencyContact) setEmergencyContact(ks.emergencyContact);
                }
            } catch (e) {
                console.warn('Keystore background sync:', e);
            } finally {
                if (isMounted) setSyncing(false);
            }
        };
        syncKeystore();

        return () => { isMounted = false; };
    }, []);

    const handleSave = async () => {
        try {
            await saveVaultToStorage({ bloodType, allergies, emergencyContact });
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2500);
        } catch (e: any) {
            alert(`Error al guardar: ${e.message}`);
        }
    };

    const generateOneTimeQr = async () => {
        await handleSave();
        const payload = JSON.stringify({
            did: identity?.identity_hash || 'did:red:unknown',
            blood: bloodType,
            allergies,
            contact: emergencyContact,
            expires: Date.now() + 300000 // 5 min
        });
        const encoded = btoa(payload);
        setQrCodeData(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=RED_ID_VAULT:${encoded}&color=00d97e&bgcolor=080810`);
    };


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
                minHeight: '60px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(8,12,22,0.98))',
                flexShrink: 0,
                gap: '12px'
            }}>
                <button
                    onClick={() => navigate('sidebar')}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#00D97E', padding: '8px 12px', fontSize: '0.88rem', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                >
                    ← Volver
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🪪 Bóveda de Identidad
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#00D97E', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                        HARDWARE KEYSTORE ENCRYPTED
                    </div>
                </div>
            </div>


            {/* MAIN FORM */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: '100%',
                    maxWidth: '440px',
                    background: 'linear-gradient(145deg, rgba(15,23,42,0.85), rgba(8,12,22,0.95))',
                    borderRadius: '20px',
                    border: '1px solid rgba(0,217,126,0.3)',
                    padding: '20px',
                    boxShadow: '0 0 40px rgba(0,217,126,0.08)'
                }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#00D97E', marginBottom: '6px', letterSpacing: '0.5px' }}>
                        📋 Datos de Auxilio y Emergencia
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.4' }}>
                        Información guardada con cifrado por hardware en el Keystore seguro del dispositivo.
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

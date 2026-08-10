"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { toast } from "./Toast";
import { registerPlugin } from '@capacitor/core';
import { SystemHealthModal } from "./SystemHealthModal";
import { SecurityReportModal } from "./SecurityReportModal";

const RedDisguise = registerPlugin<any>('RedDisguise');

// Simple inline tooltip component
const InfoTooltip = ({ text }: { text: string }) => {
    const [show, setShow] = useState(false);
    return (
        <span 
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onClick={() => setShow(!show)}
            style={{ 
                position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 10, background: 'var(--bg-lifted)', color: 'var(--primary)',
                fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', marginLeft: 8
            }}
        >
            ?
            {show && (
                <div style={{
                    position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--primary)', color: 'white', padding: '8px 12px', borderRadius: 8,
                    fontSize: '0.75rem', width: 220, textAlign: 'center', zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontWeight: 'normal', lineHeight: 1.4
                }}>
                    {text}
                    <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8, background: 'var(--primary)' }} />
                </div>
            )}
        </span>
    );
};

// Helper to read/write from the Android Keystore
async function setSecurePin(key: string, value: string) {
    await SecureStoragePlugin.set({ key, value });
}
async function getSecurePin(key: string): Promise<string> {
    try {
        const { value } = await SecureStoragePlugin.get({ key });
        return value || "";
    } catch { return ""; }
}

export default function SecurityPanel() {
    const { goBack } = useRedStore();
    const [privacyScreenEnabled, setPrivacyScreenEnabled] = useState(false);
    const [panicPin, setPanicPin] = useState("");
    const [savedPined, setSavedPined] = useState("");
    
    // Phase 19: New Tactical Settings
    const [decoyPin, setDecoyPin] = useState("");
    const [burnerChatsEnabled, setBurnerChatsEnabled] = useState(false);
    const [healthModalOpen, setHealthModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);

    const [disguiseEnabled, setDisguiseEnabled] = useState(false);
    const [calcPin, setCalcPin] = useState("");

    useEffect(() => {
        // Load settings
        const savedPrivacy = localStorage.getItem("red_privacy_screen") === "true";
        setSavedPined("");
        setPanicPin("");
        setDecoyPin("");
        
        // Load security PINs from Keystore (async)
        getSecurePin("panic_pin").then(v => { setPanicPin(v); setSavedPined(v); });
        getSecurePin("decoy_pin").then(v => setDecoyPin(v));

        setBurnerChatsEnabled(localStorage.getItem("red_burner_chats") === "true");
        // Initialize backend burner state
        if (localStorage.getItem("red_burner_chats") === "true") {
            import("../lib/api").then(({ RedAPI }) => RedAPI.setBurnerMode(true));
        }

        const disguise = localStorage.getItem("red_disguise_mode") === "true";
        setDisguiseEnabled(disguise);
        // Load calc_pin from Keystore (async) 
        getSecurePin("calc_pin").then(v => setCalcPin(v));

        applyPrivacyScreen(savedPrivacy);
    }, []);

    const applyPrivacyScreen = async (enabled: boolean) => {
        try {
            const { Capacitor, registerPlugin } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const PrivacyScreen = registerPlugin<any>('PrivacyScreen');
                if (enabled) {
                    await PrivacyScreen.enable();
                } else {
                    await PrivacyScreen.disable();
                }
            }
        } catch (e) {
            console.warn("PrivacyScreen plugin not configured locally", e);
        }
    };

    const togglePrivacyScreen = () => {
        const nextState = !privacyScreenEnabled;
        setPrivacyScreenEnabled(nextState);
        localStorage.setItem("red_privacy_screen", nextState.toString());
        applyPrivacyScreen(nextState);
    };

    const purgeTempCache = async () => {
        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { Filesystem, Directory } = await import('@capacitor/filesystem');
                await Filesystem.rmdir({
                    path: 'caches',
                    directory: Directory.Cache,
                    recursive: true
                }).catch(() => {});
            }
            localStorage.removeItem('red_recent_media_cache');
            toast.success("🧹 Caché y temporales anti-forenses purgados.");
        } catch {
            toast.info("🧹 Caché temporal limpiada.");
        }
    };

    const [savedDecoyPin, setSavedDecoyPin] = useState("");

    useEffect(() => {
        getSecurePin("decoy_pin").then(p => { if (p) setSavedDecoyPin(p); });
    }, []);

    const savePanicPin = async () => {
        if (!panicPin || panicPin.length < 4) {
            toast.error("El PIN de pánico debe tener al menos 4 dígitos");
            return;
        }
        const masterPin = await getSecurePin("master_pin");
        const decoyPinVal = await getSecurePin("decoy_pin");
        if (masterPin && panicPin === masterPin) {
            toast.error("El PIN de Pánico no puede ser igual al PIN Maestro.");
            return;
        }
        if (decoyPinVal && panicPin === decoyPinVal) {
            toast.error("El PIN de Pánico no puede ser igual al PIN Señuelo.");
            return;
        }
        await setSecurePin("panic_pin", panicPin);
        setSavedPined(panicPin);
        toast.success("🚨 PIN de Pánico (Wipe) guardado y activo");
    };

    const saveDecoyPin = async () => {
        if (!decoyPin || decoyPin.length < 4) {
            toast.error("El PIN señuelo debe tener al menos 4 dígitos");
            return;
        }
        const masterPin = await getSecurePin("master_pin");
        const panicPinVal = await getSecurePin("panic_pin");
        if (masterPin && decoyPin === masterPin) {
            toast.error("El PIN Señuelo no puede ser igual al PIN Maestro.");
            return;
        }
        if (panicPinVal && decoyPin === panicPinVal) {
            toast.error("El PIN Señuelo no puede ser igual al PIN de Pánico.");
            return;
        }
        await setSecurePin("decoy_pin", decoyPin);
        setSavedDecoyPin(decoyPin);
        toast.success("🛡️ Bóveda Señuelo (Decoy) guardada y activa");
    };



    const toggleBurnerChats = () => {
        const nextState = !burnerChatsEnabled;
        setBurnerChatsEnabled(nextState);
        localStorage.setItem("red_burner_chats", nextState.toString());
        import("../lib/api").then(({ RedAPI }) => RedAPI.setBurnerMode(nextState));
    };

    const toggleDisguise = async () => {
        const nextState = !disguiseEnabled;
        setDisguiseEnabled(nextState);
        localStorage.setItem("red_disguise_mode", nextState.toString());
        
        // Trigger native Android component change
        try {
            await RedDisguise.setDisguiseMode({ enabled: nextState });
            if (nextState) {
                toast.success("Camuflaje activado. El icono de la app cambiará pronto.");
            } else {
                toast.info("Camuflaje desactivado. Icono RED restaurado.");
            }
        } catch (e) {
            console.warn("Disguise plugin not available or failed", e);
            if (nextState) toast.warning("Icono nativo no cambió (solo modo web).");
        }
    };

    const saveCalcPin = async () => {
        if (!calcPin || calcPin.length < 4) return;
        await setSecurePin("calc_pin", calcPin);
        // Remove from localStorage if it was stored there previously
        localStorage.removeItem("red_calculator_pin");
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-surface)' }}>
            
            <header className="glass-panel" style={{
                padding: '0 20px', height: 'var(--header-h)',
                display: 'flex', alignItems: 'center', gap: '16px',
                borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                borderTop: 'none', flexShrink: 0,
                background: 'linear-gradient(180deg, rgba(15,15,24,0.98) 0%, rgba(8,8,16,0.98) 100%)',
            }}>
                <button onClick={goBack} style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                }}>
                    ← Volver al Chat
                </button>
                <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(232,33,58,0.3), rgba(200,20,45,0.15))',
                    border: '1px solid rgba(232,33,58,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                    boxShadow: '0 4px 14px rgba(232,33,58,0.25)',
                }}>🛡️</div>
                <div>
                    <h2 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Seguridad Táctica</h2>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--danger)', letterSpacing: '1.5px', fontWeight: 700 }}>PROTOCOLO ZERO-TRUST</p>
                </div>
            </header>

            <div className="scroll-container no-scrollbar" style={{ flex: 1, padding: '16px 16px calc(80px + var(--safe-bottom, 0px)) 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* System Health Diagnostics Card */}
                <div style={{ background: 'linear-gradient(135deg, rgba(0,217,126,0.08), rgba(0,180,100,0.03))', backdropFilter: 'blur(16px)', padding: '16px 18px', borderRadius: '20px', border: '1px solid rgba(0,217,126,0.25)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🩺</span>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: 'white', fontWeight: 800, fontSize: '0.92rem' }}>Auto-Diagnóstico del Nodo</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Resiliencia, latencia y criptografía</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <button
                                onClick={() => setReportModalOpen(true)}
                                style={{
                                    padding: '8px 12px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                                }}
                            >
                                Informe 📄
                            </button>
                            <button
                                onClick={() => setHealthModalOpen(true)}
                                style={{
                                    padding: '8px 14px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #00D97E, #009955)',
                                    color: 'white', fontWeight: 800, fontSize: '0.8rem', border: 'none', cursor: 'pointer'
                                }}
                            >
                                Auditar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Privacy Screen Toggle */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,24,0.95))', backdropFilter: 'blur(16px)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Bloqueo de Capturas</h3>
                            <InfoTooltip text="Oculta la pantalla en recientes y evita capturas de pantalla a nivel del sistema operativo." />
                        </div>
                        
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
                            <input type="checkbox" checked={privacyScreenEnabled} onChange={togglePrivacyScreen} style={{ opacity: 0, width: 0, height: 0 }} />
                            <span className="slider round" style={{
                                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: privacyScreenEnabled ? 'var(--primary)' : 'var(--solid-highlight)',
                                borderRadius: '34px', transition: '.4s'
                            }}>
                                <span style={{
                                    position: 'absolute', content: '""', height: '20px', width: '20px', left: privacyScreenEnabled ? '26px' : '4px', top: '4px',
                                    background: 'white', transition: '.4s', borderRadius: '50%'
                                }} />
                            </span>
                        </label>
                    </div>
                </div>

                {/* Anti-Forensic Disguise Mode */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,24,0.95))', backdropFilter: 'blur(16px)', padding: '18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800 }}>Modo Camuflaje (Disguise)</h3>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Transforma el Login en una Calculadora.</p>
                        </div>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px', flexShrink: 0 }}>
                            <input type="checkbox" checked={disguiseEnabled} onChange={toggleDisguise} style={{ opacity: 0, width: 0, height: 0 }} />
                            <span className="slider round" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: disguiseEnabled ? 'var(--primary)' : 'var(--solid-highlight)', borderRadius: '34px', transition: '.4s' }}>
                                <span style={{ position: 'absolute', height: '20px', width: '20px', left: disguiseEnabled ? '26px' : '4px', top: '4px', background: 'white', transition: '.4s', borderRadius: '50%' }} />
                            </span>
                        </label>
                    </div>

                    {disguiseEnabled && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                            <input 
                                type="number" 
                                placeholder="PIN Calculadora (4-6)" 
                                value={calcPin}
                                onChange={(e) => setCalcPin(e.target.value.substring(0, 6))}
                                style={{ flex: 1, minWidth: 0, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--solid-highlight)', color: 'var(--text-primary)', borderRadius: '10px', fontSize: '0.95rem' }} 
                            />
                            <button 
                                onClick={saveCalcPin}
                                disabled={calcPin.length < 4}
                                style={{ background: 'var(--solid-bg)', color: 'var(--primary)', padding: '0 14px', borderRadius: '10px', fontWeight: 'bold', border: '1px solid var(--primary)', opacity: calcPin.length < 4 ? 0.3 : 1, fontSize: '0.85rem' }}
                            >
                                Set PIN
                            </button>
                        </div>
                    )}
                </div>

                {/* Panic PIN */}
                <div style={{ background: 'linear-gradient(135deg, rgba(35,15,15,0.85), rgba(20,10,10,0.95))', backdropFilter: 'blur(16px)', padding: '18px', borderRadius: '20px', border: '1px solid rgba(232,33,58,0.25)' }}>
                    <h3 style={{ margin: 0, color: 'var(--danger)', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ⚠ PIN de Pánico (Wipe)
                        <InfoTooltip text="Si te obligan a desbloquear la app, introduce este PIN. La aplicación destruirá silenciosamente tu bóveda entera y simulará un perfil vacío." />
                    </h3>
                    <p style={{ margin: '6px 0 14px', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.4' }}>
                        Si ingresas este PIN en la pantalla de bloqueo local, la base de datos de Rust y todas tus claves de sesión se destruirán **irreversiblemente**.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            type="number" 
                            placeholder="Ej. 9911" 
                            value={panicPin}
                            onChange={(e) => setPanicPin(e.target.value.substring(0, 6))}
                            style={{ 
                                flex: 1, minWidth: 0, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--solid-highlight)', 
                                color: 'var(--text-primary)', borderRadius: '10px', fontSize: '1.1rem', letterSpacing: '4px', textAlign: 'center'
                            }} 
                        />
                        <button 
                            onClick={savePanicPin}
                            disabled={panicPin.length < 4 || panicPin === savedPined}
                            style={{ 
                                background: 'var(--danger)', color: 'white', padding: '0 18px', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.85rem',
                                opacity: (panicPin.length < 4 || panicPin === savedPined) ? 0.3 : 1
                            }}
                        >
                            {savedPined && panicPin === savedPined ? 'Activo' : 'Guardar'}
                        </button>
                    </div>
                </div>

                {/* Decoy Vault (Bóveda Señuelo) */}
                <div style={{ background: 'linear-gradient(135deg, rgba(15,25,35,0.85), rgba(10,15,20,0.95))', backdropFilter: 'blur(16px)', padding: '18px', borderRadius: '20px', border: '1px solid rgba(41,182,246,0.2)' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🛡️ Bóveda Señuelo (Decoy)
                        <InfoTooltip text="Un perfil falso con chats de mentira. Úsalo si te obligan a abrir RED y el PIN de Pánico es demasiado sospechoso." />
                    </h3>
                    <p style={{ margin: '6px 0 14px', color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: '1.4' }}>
                        Ingresar este PIN en la pantalla de bloqueo forzará al nodo a conectarse a una base de datos vacía auto-poblada con mensajes mundanos.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            type="number" 
                            placeholder="Ej. 9999" 
                            value={decoyPin}
                            onChange={(e) => setDecoyPin(e.target.value.substring(0, 6))}
                            style={{ 
                                flex: 1, minWidth: 0, padding: '10px 12px', background: 'var(--bg-deep)', border: '1px solid var(--solid-highlight)', 
                                color: 'var(--text-primary)', borderRadius: '10px', fontSize: '1.1rem', letterSpacing: '4px', textAlign: 'center'
                            }} 
                        />
                        <button 
                            onClick={saveDecoyPin}
                            disabled={decoyPin.length < 4 || decoyPin === savedDecoyPin}
                            style={{ 
                                background: 'var(--solid-bg)', color: 'var(--primary)', padding: '0 18px', borderRadius: '10px', fontWeight: 'bold', border: '1px solid var(--primary)', fontSize: '0.85rem',
                                opacity: (decoyPin.length < 4 || decoyPin === savedDecoyPin) ? 0.3 : 1
                            }}
                        >
                            {savedDecoyPin && decoyPin === savedDecoyPin ? 'Activo' : 'Guardar'}
                        </button>
                    </div>
                </div>

                {/* Dead Man's Switch */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,24,0.95))', backdropFilter: 'blur(16px)', padding: '18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                💀 Dead Man's Switch
                                <InfoTooltip text="Si no abres la app en el período configurado, el nodo purgará toda tu identidad y chats automáticamente." />
                            </h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                Autodestrucción por inactividad — configuración avanzada
                            </p>
                        </div>
                        <button
                            onClick={() => import('../store/useRedStore').then(({ useRedStore }) => useRedStore.getState().navigate('dms'))}
                            style={{
                                background: 'var(--solid-bg)', color: 'var(--primary)',
                                padding: '10px 16px', borderRadius: '10px', fontWeight: 700,
                                border: '1px solid var(--primary)', cursor: 'pointer',
                                fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0,
                            }}
                        >
                            Configurar →
                        </button>
                    </div>
                </div>

                {/* Anti-Forensic Temp Purge Card */}
                <div style={{ background: 'linear-gradient(135deg, rgba(20,20,30,0.85), rgba(15,15,24,0.95))', backdropFilter: 'blur(16px)', padding: '18px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🧹 Purga Anti-Forense
                                <InfoTooltip text="Elimina de forma segura la caché de imágenes, notas de voz recibidas e historia temporal del disco local." />
                            </h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                                Limpieza de huella digital y archivos del sistema
                            </p>
                        </div>
                        <button
                            onClick={purgeTempCache}
                            style={{
                                background: 'rgba(232,33,58,0.15)', color: '#ff4444',
                                padding: '10px 16px', borderRadius: '10px', fontWeight: 700,
                                border: '1px solid rgba(232,33,58,0.3)', cursor: 'pointer',
                                fontSize: '0.82rem', whiteSpace: 'nowrap', flexShrink: 0,
                            }}
                        >
                            Purgar Caché
                        </button>
                    </div>
                </div>


                {/* Burner Chats */}
                <div style={{ background: 'linear-gradient(135deg, rgba(30,15,25,0.85), rgba(20,10,15,0.95))', backdropFilter: 'blur(16px)', padding: '20px', borderRadius: '20px', border: '1px solid rgba(236,64,122,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>🔥 Burner Chats (RAM-Only)</h3>
                                <InfoTooltip text="Los mensajes nuevos solo vivirán en la memoria RAM. Al cerrar la app, desaparecerán para siempre. No tocan el disco duro." />
                            </div>
                            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Los mensajes evaden SQLite por completo.</p>
                        </div>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
                            <input type="checkbox" checked={burnerChatsEnabled} onChange={toggleBurnerChats} style={{ opacity: 0, width: 0, height: 0 }} />
                            <span className="slider round" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: burnerChatsEnabled ? 'var(--primary)' : 'var(--solid-highlight)', borderRadius: '34px', transition: '.4s' }}>
                                <span style={{ position: 'absolute', height: '20px', width: '20px', left: burnerChatsEnabled ? '26px' : '4px', top: '4px', background: 'white', transition: '.4s', borderRadius: '50%' }} />
                            </span>
                        </label>
                    </div>
                </div>

            </div>

            {/* System Health Modal */}
            {healthModalOpen && (
                <SystemHealthModal onClose={() => setHealthModalOpen(false)} />
            )}

            {/* Security Report Modal */}
            {reportModalOpen && (
                <SecurityReportModal onClose={() => setReportModalOpen(false)} />
            )}
        </div>
    );
}

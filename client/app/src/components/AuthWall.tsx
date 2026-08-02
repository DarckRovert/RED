"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { CalculatorScreen } from "./CalculatorScreen";
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

/**
 * Authentication Wall — RED Unified Lockscreen
 * 
 * Modes:
 *  - "checking"   : Reading Keystore, showing nothing
 *  - "onboarding" : First time — user creates their master PIN
 *  - "unlock"     : Returning user — enter PIN or use biometrics
 *  - "profile"    : Post-first-login — user sets display name (once only)
 */

type AuthMode = "checking" | "onboarding" | "unlock";

async function getSecurePin(key: string): Promise<string | null> {
    try {
        if (typeof window !== 'undefined') {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
                const res = await SecureStoragePlugin.get({ key }).catch(() => null);
                if (res && res.value) return res.value;
            }
        }
    } catch {}
    try {
        return typeof window !== 'undefined' ? localStorage.getItem(key) || null : null;
    } catch {
        return null;
    }
}

async function setSecurePin(key: string, value: string): Promise<void> {
    try {
        if (typeof window !== 'undefined') {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
                await SecureStoragePlugin.set({ key, value }).catch(() => null);
            }
        }
    } catch {}
    try {
        if (typeof window !== 'undefined') localStorage.setItem(key, value);
    } catch {}
}

export default function AuthWall({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, login } = useRedStore();

    const [mode, setMode] = useState<AuthMode>("checking");
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [step, setStep] = useState<"enter" | "confirm">("enter");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [biometryAvailable, setBiometryAvailable] = useState(false);
    const [disguiseEnabled, setDisguiseEnabled] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const init = async () => {
            // Check calculator disguise mode (ok in localStorage — cosmetic only)
            setDisguiseEnabled(localStorage.getItem("red_disguise_mode") === "true");

            // Check if user has already set a master PIN
            const masterPin = await getSecurePin("master_pin");
            if (masterPin) {
                setMode("unlock");
            } else {
                setMode("onboarding");
            }

            try {
                const info = await BiometricAuth.checkBiometry();
                setBiometryAvailable(info.isAvailable);
                
                // Auto-trigger biometrics if returning user
                if (masterPin && info.isAvailable && !disguiseEnabled) {
                    try {
                        await BiometricAuth.authenticate({ reason: "RED Neural Sync: Identidad Requerida" });
                        // If success, just login right away!
                        setMode("unlock");
                        setIsLoaded(true);
                        // Using internal function but since it's an effect, we rely on the state to update
                        // Actually better to do the login directly here to avoid flashes
                        const panicPin = await getSecurePin("panic_pin");
                        const decoyPin = await getSecurePin("decoy_pin");
                        if (masterPin === decoyPin) {
                            // GAP-12 FIX: pass the real decoyPin so Rust derives the correct storage key
                            login(decoyPin);
                        } else {
                            login(masterPin);
                        }
                        return; // do not even render the form
                    } catch (e) {
                        // User cancelled or failed biometric -> Show PIN fallback
                        console.log("Biometric bypassed or failed, falling back to PIN");
                    }
                }
            } catch {
                setBiometryAvailable(false);
            }

            // Important for Next.js SSR / hydration
            setIsLoaded(true);
        };
        init();
    }, []);

    const doLogin = useCallback(async (pwd: string) => {
        setLoading(true);
        setError("");

        // Read security PINs from Keystore
        const panicPin = await getSecurePin("panic_pin");
        const decoyPin = await getSecurePin("decoy_pin");

        // 1. PANIC WIPE
        if (panicPin && pwd === panicPin) {
            try {
                const { Capacitor, registerPlugin } = await import('@capacitor/core');
                if (Capacitor.isNativePlatform()) {
                    const RedNode = registerPlugin<any>('RedNode');
                    await RedNode.destroy();
                }
            } catch (e) { console.error("Wipe failed", e); }
            window.location.reload();
            return;
        }

        // 2. DECOY VAULT
        if (decoyPin && pwd === decoyPin) {
            // GAP-12 FIX: pass decoyPin so Rust derives the correct storage key for the decoy vault
            await login(decoyPin);
            setLoading(false);
            return;
        }

        // 3. REAL LOGIN — password is passed directly to Rust as the encryption key
        const success = await login(pwd);
        if (!success) {
            setError("Error al iniciar la bóveda. Intenta de nuevo.");
            setLoading(false);
        }
    }, [login]);

    const handleBiometricUnlock = async () => {
        try {
            await BiometricAuth.authenticate({ reason: "Desbloquear bóveda RED" });
            const masterPin = await getSecurePin("master_pin");
            if (masterPin) {
                await doLogin(masterPin);
            }
        } catch (e) {
            setError("Biometría fallida. Usa tu PIN.");
        }
    };

    // ── ONBOARDING FLOW ───────────────────────────────────────────────────────
    const handleOnboardingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (step === "enter") {
            if (pin.length < 6) {
                setError("El PIN debe tener al menos 6 dígitos.");
                return;
            }
            setError("");
            setStep("confirm");
            return;
        }

        // step === "confirm"
        if (pin !== confirmPin) {
            setError("Los PINs no coinciden. Inténtalo de nuevo.");
            setConfirmPin("");
            setStep("enter");
            setPin("");
            return;
        }

        // Save master PIN to Android Keystore
        setLoading(true);
        await setSecurePin("master_pin", pin);
        await doLogin(pin);
    };

    // ── UNLOCK FLOW ───────────────────────────────────────────────────────────
    const handleUnlockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const masterPin = await getSecurePin("master_pin");

        // No PIN in Keystore — reset to onboarding (e.g. user cleared app data)
        if (!masterPin) {
            setMode("onboarding");
            setStep("enter");
            setPin("");
            return;
        }

        // Pass the raw PIN to doLogin to handle panic/decoy/master checks
        await doLogin(pin);
    };

    // ── RENDER ────────────────────────────────────────────────────────────────
    if (!isLoaded || mode === "checking") {
        return (
            <div style={{
                background: 'var(--bg-deep)', height: '100dvh', width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{
                    width: 44, height: 44, borderRadius: '14px', background: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', fontWeight: 900, color: 'white',
                    animation: 'pulse-glow 1.5s ease-in-out infinite',
                }}>R</div>
            </div>
        );
    }

    if (isAuthenticated) return <>{children}</>;

    // If the calculator disguise is active and we're in unlock mode
    if (disguiseEnabled && mode === "unlock") {
        return (
            <CalculatorScreen
                onUnlock={async (typedPin: string) => {
                    // Try the dedicated calculator PIN from Keystore first
                    const calcPin = await getSecurePin("calc_pin");
                    if (calcPin && typedPin === calcPin) {
                        // Calc PIN matched — use master_pin to actually unlock the vault
                        const masterPin = await getSecurePin("master_pin");
                        if (masterPin) await doLogin(masterPin);
                        return;
                    }
                    // Fallback: allow master_pin, panic_pin, or decoy_pin directly for power users
                    await doLogin(typedPin);
                }}
            />
        );
    }

    const isOnboarding = mode === "onboarding";

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100dvh', width: '100%',
            background: 'var(--bg-deep)', padding: '32px', boxSizing: 'border-box',
            backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -5%, rgba(232,33,58,0.12) 0%, transparent 65%)',
        }}>

            {/* Logo Section */}
            <div style={{ marginBottom: '40px', textAlign: 'center' }} className="animate-enter">
                <div style={{
                    width: '84px', height: '84px',
                    borderRadius: '26px',
                    background: 'linear-gradient(145deg, var(--primary-bright), var(--primary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 22px auto',
                    boxShadow: '0 0 0 1px rgba(232,33,58,0.3), 0 8px 40px var(--primary-glow)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: 'inherit',
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.2) 0%, transparent 60%)',
                    }} />
                    <span style={{ fontSize: '2.6rem', fontWeight: 900, color: 'white', letterSpacing: '-3px', lineHeight: 1, position: 'relative', zIndex: 2 }}>R</span>
                </div>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '2.4rem', fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '10px', textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>RED</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, letterSpacing: '4px', textTransform: 'uppercase' }}>
                    {isOnboarding
                        ? (step === "enter" ? "Crear Identidad" : "Confirmar acceso")
                        : "Sistema táctico P2P"
                    }
                </p>
            </div>

            {/* Warning for onboarding */}
            {isOnboarding && step === "enter" && (
                <div style={{
                    background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.25)',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '24px',
                    maxWidth: '320px', textAlign: 'center',
                }} className="animate-fade">
                    <p style={{ color: 'var(--warning)', fontSize: '0.8rem', margin: 0, lineHeight: 1.6 }}>
                        ⚠️ Este PIN es la <strong>única llave</strong> de tu bóveda cifrada. No tiene recuperación.
                    </p>
                </div>
            )}

            {/* PIN Form */}
            <form
                onSubmit={isOnboarding ? handleOnboardingSubmit : handleUnlockSubmit}
                className="glass-panel-elevated animate-enter"
                style={{
                    width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column',
                    gap: '16px', padding: '28px', borderRadius: 'var(--radius-xl)',
                    animationDelay: '120ms',
                }}
            >
                <input
                    type="password"
                    inputMode="numeric"
                    value={isOnboarding && step === "confirm" ? confirmPin : pin}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (isOnboarding && step === "confirm") setConfirmPin(val);
                        else setPin(val);
                        setError("");
                    }}
                    autoFocus
                    placeholder={isOnboarding ? "Crear PIN" : "PIN"}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '18px 20px',
                        background: 'rgba(0,0,0,0.4)',
                        border: `1px solid ${error ? 'var(--danger)' : 'var(--glass-border)'}`,
                        color: 'var(--text-primary)', borderRadius: 'var(--radius-md)',
                        fontSize: '1.6rem', letterSpacing: '10px', textAlign: 'center',
                        outline: 'none', transition: 'all var(--dur-fast)', boxSizing: 'border-box',
                        boxShadow: error ? '0 0 0 3px rgba(232,33,58,0.2)' : 'none',
                    }}
                />

                {error && (
                    <p style={{ color: 'var(--danger)', textAlign: 'center', fontSize: '0.85rem', margin: 0 }}>
                        {error}
                    </p>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Biometric button — only on unlock, not onboarding */}
                    {!isOnboarding && biometryAvailable && (
                        <button
                            type="button"
                            onClick={handleBiometricUnlock}
                            disabled={loading}
                            style={{
                                padding: '16px', background: 'var(--bg-lifted)',
                                border: '1px solid var(--solid-border)', borderRadius: '14px',
                                color: 'var(--text-secondary)', fontSize: '1.4rem',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            ☝️
                        </button>
                    )}

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading || (isOnboarding && step === "enter" && pin.length < 6) || (isOnboarding && step === "confirm" && confirmPin.length < 6) || (!isOnboarding && !pin)}
                        style={{ flex: 1 }}
                    >
                        {loading ? "INICIANDO..." : isOnboarding ? (step === "enter" ? "CONTINUAR →" : "CREAR BÓVEDA") : "DESCIFRAR NODO"}
                    </button>
                </div>
            </form>

            <p style={{
                position: 'absolute', bottom: '20px',
                color: 'var(--text-disabled)', fontSize: '0.68rem',
                fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1.5,
            }}>
                AES-256-GCM · Ed25519 · P2P
            </p>
        </div>
    );
}

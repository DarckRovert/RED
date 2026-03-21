"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { CalculatorScreen } from "./CalculatorScreen";
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

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
        const { value } = await SecureStoragePlugin.get({ key });
        return value || null;
    } catch {
        return null; // Key doesn't exist = null
    }
}

async function setSecurePin(key: string, value: string): Promise<void> {
    await SecureStoragePlugin.set({ key, value });
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
            await login("9999");
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
        return <div style={{ background: 'var(--bg-deep)', height: '100dvh' }} />;
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
            background: 'var(--bg-deep)', padding: '32px', boxSizing: 'border-box'
        }}>

            {/* Logo */}
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={{
                    width: '80px', height: '80px', background: 'var(--primary)',
                    borderRadius: '24px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 20px auto',
                    boxShadow: '0 0 48px rgba(255,60,60,0.5)'
                }}>
                    <span style={{ fontSize: '2.5rem' }}>🔴</span>
                </div>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>RED</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                    {isOnboarding
                        ? (step === "enter" ? "Crea tu PIN de acceso" : "Confirma tu PIN")
                        : "Ingresa tu PIN de acceso"
                    }
                </p>
            </div>

            {/* Warning for onboarding */}
            {isOnboarding && step === "enter" && (
                <div style={{
                    background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.4)',
                    borderRadius: '12px', padding: '12px 16px', marginBottom: '24px',
                    maxWidth: '320px', textAlign: 'center'
                }}>
                    <p style={{ color: '#ffb400', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
                        ⚠️ Este PIN es la única llave de tu bóveda cifrada. <strong>No tiene recuperación.</strong> Si lo olvidas, perderás tu identidad.
                    </p>
                </div>
            )}

            {/* PIN Form */}
            <form
                onSubmit={isOnboarding ? handleOnboardingSubmit : handleUnlockSubmit}
                style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}
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
                    placeholder={isOnboarding ? "Mínimo 6 dígitos" : "• • • • • •"}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '18px', background: 'var(--bg-lifted)',
                        border: `2px solid ${error ? 'var(--danger)' : 'var(--solid-border)'}`,
                        color: 'var(--text-primary)', borderRadius: '14px', fontSize: '1.8rem',
                        letterSpacing: '12px', textAlign: 'center', outline: 'none',
                        transition: 'border 0.2s ease', boxSizing: 'border-box'
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
                        disabled={loading || (isOnboarding && step === "enter" && pin.length < 6) || (isOnboarding && step === "confirm" && confirmPin.length < 6) || (!isOnboarding && !pin)}
                        style={{
                            flex: 1, padding: '16px', background: 'var(--primary)',
                            color: 'white', border: 'none', borderRadius: '14px',
                            fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
                            opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s'
                        }}
                    >
                        {loading ? "INICIANDO..." : isOnboarding ? (step === "enter" ? "CONTINUAR →" : "CREAR BÓVEDA") : "DESCIFRAR NODO"}
                    </button>
                </div>
            </form>

            <p style={{
                position: 'absolute', bottom: '24px',
                color: 'var(--text-muted)', fontSize: '0.7rem',
                fontFamily: 'monospace', letterSpacing: 1
            }}>
                AES-256-GCM · Ed25519 · P2P
            </p>
        </div>
    );
}

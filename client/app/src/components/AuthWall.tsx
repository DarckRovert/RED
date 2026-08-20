"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { CalculatorScreen } from "./CalculatorScreen";
import { BackupRestoreModal } from "./BackupRestoreModal";
import { toast } from "./Toast";

/**
 * Authentication Wall — RED Unified Tactical Lockscreen
 * 
 * Modes:
 *  - "checking"   : Reading Keystore, showing tactical loading state
 *  - "onboarding" : First time — user creates their master PIN (at least 6 digits)
 *  - "unlock"     : Returning user — enter PIN or use hardware biometrics
 */

type AuthMode = "checking" | "onboarding" | "unlock";

async function getSecurePin(key: string): Promise<string | null> {
    // 1. Instant synchronous check in localStorage / sessionStorage
    if (typeof window !== "undefined") {
        try {
            const localVal = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (localVal && localVal.trim().length >= 4) {
                return localVal.trim();
            }
        } catch {}
    }

    // 2. Hardware Keystore check via SecureStoragePlugin
    try {
        if (typeof window !== "undefined") {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                const res = await SecureStoragePlugin.get({ key }).catch(() => null);
                if (res && res.value && res.value.trim().length >= 4) {
                    const val = res.value.trim();
                    try { localStorage.setItem(key, val); } catch {}
                    return val;
                }
            }
        }
    } catch {}

    return null;
}

async function setSecurePin(key: string, value: string): Promise<void> {
    const cleanVal = value.trim();
    if (!cleanVal) return;

    // 1. Instant synchronous persistence
    if (typeof window !== "undefined") {
        try {
            localStorage.setItem(key, cleanVal);
            sessionStorage.setItem(key, cleanVal);
        } catch {}
    }

    // 2. Hardware-backed Keystore persistence
    try {
        if (typeof window !== "undefined") {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                await SecureStoragePlugin.set({ key, value: cleanVal }).catch(() => null);
            }
        }
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
    const [showRestoreModal, setShowRestoreModal] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            try {
                if (typeof window !== "undefined") {
                    setDisguiseEnabled(localStorage.getItem("red_disguise_mode") === "true");
                }

                // 1. Query master PIN with solid fallback
                const masterPin = await getSecurePin("master_pin");

                if (!isMounted) return;

                if (masterPin) {
                    setMode("unlock");
                } else {
                    setMode("onboarding");
                }
                setIsLoaded(true);

                // 2. Biometrics check and auto-prompt if available
                try {
                    const { Capacitor } = await import("@capacitor/core");
                    if (Capacitor.isNativePlatform()) {
                        const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
                        const bioPromise = BiometricAuth.checkBiometry();
                        const bioTimeout = new Promise<{ isAvailable: boolean }>(r => setTimeout(() => r({ isAvailable: false }), 2000));
                        const info = await Promise.race([bioPromise, bioTimeout]);
                        if (isMounted) setBiometryAvailable(info.isAvailable);

                        if (masterPin && info.isAvailable && localStorage.getItem("red_disguise_mode") !== "true") {
                            try {
                                const authPromise = BiometricAuth.authenticate({ reason: "RED Neural Sync: Identidad Requerida" });
                                const authTimeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Biometric timeout")), 5000));
                                await Promise.race([authPromise, authTimeout]);
                                if (!isMounted) return;
                                setMode("unlock");
                                setIsLoaded(true);
                                const decoyPin = await getSecurePin("decoy_pin");
                                if (masterPin === decoyPin) {
                                    login(decoyPin);
                                } else {
                                    login(masterPin);
                                }
                                return;
                            } catch {
                                // Biometric cancelled or failed — user can enter PIN manually
                            }
                        }
                    } else {
                        if (isMounted) setBiometryAvailable(false);
                    }
                } catch {
                    if (isMounted) setBiometryAvailable(false);
                }
            } catch (e) {
                console.error("[AuthWall] Init error:", e);
                if (isMounted) {
                    // Fallback check
                    const fallbackPin = typeof window !== "undefined" ? localStorage.getItem("master_pin") : null;
                    setMode(fallbackPin ? "unlock" : "onboarding");
                    setIsLoaded(true);
                }
            }
        };

        init();
        return () => {
            isMounted = false;
        };
    }, [login]);

    const doLogin = useCallback(async (pwd: string) => {
        setLoading(true);
        setError("");

        const panicPin = await getSecurePin("panic_pin");
        const decoyPin = await getSecurePin("decoy_pin");

        // 1. PANIC WIPE
        if (panicPin && pwd === panicPin) {
            try {
                const { Capacitor, registerPlugin } = await import("@capacitor/core");
                if (Capacitor.isNativePlatform()) {
                    const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
                    await SecureStoragePlugin.clear().catch(() => {});
                    const RedNode = registerPlugin<any>("RedNode");
                    await RedNode.destroy().catch(() => {});
                }
            } catch (e) { console.error("Wipe failed", e); }
            if (typeof window !== "undefined") {
                localStorage.clear();
                sessionStorage.clear();
            }
            toast.error("🔥 BÓVEDA DESTRUIDA POR PROTOCOLO DE PÁNICO");
            window.location.reload();
            return;
        }

        // 2. DECOY VAULT
        if (decoyPin && pwd === decoyPin) {
            useRedStore.getState().enableDecoyVault();
            setLoading(false);
            return;
        }

        // 3. REAL LOGIN
        const success = await login(pwd);
        if (!success) {
            setError("PIN incorrecto. Intenta de nuevo.");
            setLoading(false);
            setPin("");
        }
    }, [login]);

    const handleBiometricUnlock = async () => {
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
                await BiometricAuth.authenticate({ reason: "Desbloquear Bóveda RED" });
                const masterPin = await getSecurePin("master_pin");
                if (masterPin) {
                    await doLogin(masterPin);
                }
            }
        } catch {
            setError("Biometría no reconocida. Usa tu PIN maestro.");
        }
    };

    // Digit press handler for the tactical keypad
    const handleDigitPress = (digit: string) => {
        if (loading) return;
        setError("");

        if (mode === "onboarding") {
            if (step === "enter") {
                if (pin.length < 8) setPin(prev => prev + digit);
            } else {
                if (confirmPin.length < 8) setConfirmPin(prev => prev + digit);
            }
        } else {
            if (pin.length < 8) {
                const nextPin = pin + digit;
                setPin(nextPin);
                if (nextPin.length >= 6) {
                    // Auto-attempt login on reaching 6 digits
                    doLogin(nextPin);
                }
            }
        }
    };

    const handleBackspace = () => {
        if (loading) return;
        setError("");
        if (mode === "onboarding") {
            if (step === "enter") setPin(prev => prev.slice(0, -1));
            else setConfirmPin(prev => prev.slice(0, -1));
        } else {
            setPin(prev => prev.slice(0, -1));
        }
    };

    const handleOnboardingNext = async () => {
        if (step === "enter") {
            if (pin.length < 6) {
                setError("El PIN maestro debe tener al menos 6 dígitos.");
                return;
            }
            setError("");
            setStep("confirm");
        } else {
            if (pin !== confirmPin) {
                setError("Los PINs no coinciden. Inténtalo de nuevo.");
                setConfirmPin("");
                setStep("enter");
                setPin("");
                return;
            }
            setLoading(true);
            await setSecurePin("master_pin", pin);
            await doLogin(pin);
        }
    };

    if (isAuthenticated) {
        return <>{children}</>;
    }

    if (disguiseEnabled) {
        return <CalculatorScreen onUnlock={async (typedPin: string) => {
            const masterPin = await getSecurePin("master_pin");
            const panicPin = await getSecurePin("panic_pin");
            const decoyPin = await getSecurePin("decoy_pin");

            if (panicPin && typedPin === panicPin) {
                await doLogin(typedPin);
                return;
            }
            if (decoyPin && typedPin === decoyPin) {
                await doLogin(typedPin);
                return;
            }
            if (masterPin && (typedPin === masterPin || typedPin.endsWith(masterPin))) {
                await doLogin(masterPin);
            }
        }} />;
    }

    if (!isLoaded || mode === "checking") {
        return (
            <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: "100%", height: "100dvh", background: "var(--bg-void)", color: "#fff", gap: "16px"
            }}>
                <div style={{
                    width: 60, height: 60, borderRadius: "20px",
                    background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.7rem", fontWeight: 900, color: "white",
                    boxShadow: "0 0 35px rgba(232,33,58,0.5)"
                }}>R</div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                    INICIALIZANDO BÓVEDA SEGURA…
                </div>
            </div>
        );
    }

    const currentDigits = mode === "onboarding" ? (step === "enter" ? pin : confirmPin) : pin;

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "24px 20px", overflowY: "auto"
        }}>
            <div style={{ maxWidth: "340px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>

                {/* Insignia y Título */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 54, height: 54, borderRadius: "18px",
                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.5rem", fontWeight: 900, color: "white",
                        boxShadow: "0 0 30px rgba(232,33,58,0.4)"
                    }}>
                        🛡️
                    </div>

                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.5px" }}>
                            {mode === "onboarding" ? "Crear PIN Maestro" : "Bóveda Criptográfica RED"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "3px" }}>
                            {mode === "onboarding"
                                ? (step === "enter" ? "Define tu clave de acceso (mínimo 6 dígitos)" : "Confirma tu PIN maestro")
                                : "Ingresa tu PIN de seguridad"}
                        </div>
                    </div>
                </div>

                {/* Indicador de Dígitos (Puntos Neón) */}
                <div style={{ display: "flex", gap: "12px", alignItems: "center", height: "24px" }}>
                    {[0, 1, 2, 3, 4, 5].map((idx) => {
                        const filled = currentDigits.length > idx;
                        return (
                            <div
                                key={idx}
                                style={{
                                    width: filled ? "14px" : "10px",
                                    height: filled ? "14px" : "10px",
                                    borderRadius: "50%",
                                    background: filled ? "var(--accent-crimson-bright)" : "rgba(255,255,255,0.15)",
                                    boxShadow: filled ? "0 0 12px var(--accent-crimson)" : "none",
                                    transition: "all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                                }}
                            />
                        );
                    })}
                </div>

                {/* Mensaje de Error */}
                {error && (
                    <div className="animate-pop" style={{ fontSize: "0.78rem", color: "var(--accent-crimson-bright)", textAlign: "center", fontWeight: 700 }}>
                        {error}
                    </div>
                )}

                {/* Teclado Numérico Táctico 3x4 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", width: "100%" }}>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleDigitPress(num)}
                            disabled={loading}
                            className="card-tactical-interactive"
                            style={{
                                height: "64px", borderRadius: "18px",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.4rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace",
                                color: "#fff", background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)"
                            }}
                        >
                            {num}
                        </button>
                    ))}

                    {/* Botón Biométrica / Vacío */}
                    {biometryAvailable && mode === "unlock" ? (
                        <button
                            onClick={handleBiometricUnlock}
                            disabled={loading}
                            className="card-tactical-interactive"
                            style={{
                                height: "64px", borderRadius: "18px",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.4rem", color: "var(--accent-cyan)",
                                background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)"
                            }}
                            title="Desbloqueo Biométrico"
                        >
                            🖐️
                        </button>
                    ) : (
                        <div />
                    )}

                    {/* Botón 0 */}
                    <button
                        onClick={() => handleDigitPress("0")}
                        disabled={loading}
                        className="card-tactical-interactive"
                        style={{
                            height: "64px", borderRadius: "18px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.4rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace",
                            color: "#fff", background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)"
                        }}
                    >
                        0
                    </button>

                    {/* Botón Backspace */}
                    <button
                        onClick={handleBackspace}
                        disabled={loading}
                        className="card-tactical-interactive"
                        style={{
                            height: "64px", borderRadius: "18px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.2rem", color: "var(--text-muted)",
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)"
                        }}
                        title="Borrar dígito"
                    >
                        ⌫
                    </button>
                </div>

                {/* Botón de Siguiente en Onboarding */}
                {mode === "onboarding" && (
                    <>
                        <button
                            onClick={handleOnboardingNext}
                            disabled={loading || currentDigits.length < 6}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px", marginTop: "8px" }}
                        >
                            {loading ? "Derivando claves..." : (step === "enter" ? "Continuar ➔" : "Confirmar y Entrar")}
                        </button>

                        <button
                            onClick={() => setShowRestoreModal(true)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--accent-cyan)",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                marginTop: "6px",
                                textDecoration: "underline",
                                padding: "6px"
                            }}
                        >
                            ☁️ ¿Tienes una copia o cuenta previa? Restaurar aquí
                        </button>
                    </>
                )}
            </div>

            {/* Modal de Restauración en Onboarding */}
            {showRestoreModal && (
                <BackupRestoreModal onClose={() => setShowRestoreModal(false)} />
            )}
        </div>
    );
}
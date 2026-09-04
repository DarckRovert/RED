"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { CalculatorScreen } from "./CalculatorScreen";
import { BackupRestoreModal } from "./BackupRestoreModal";
import { WebCompanionQRModal } from "./WebCompanionQRModal";
import { toast } from "./Toast";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { 
    BiometricLockEngine, 
    getSecurePin, 
    setSecurePin, 
    hasSecurePin, 
    verifySecurePin 
} from "../lib/crypto/BiometricLockEngine";

/**
 * Authentication Wall — RED Unified Tactical Lockscreen & Biometric Sentinel
 * 
 * Modes:
 *  - "checking"   : Reading Keystore, checking hardware biometrics
 *  - "onboarding" : First time — user creates master PIN (6 digits) & optional biometric enrollment
 *  - "unlock"     : Returning user — enter PIN or authenticate with Biometrics / Windows Hello / Passkeys
 */

type AuthMode = "checking" | "onboarding" | "unlock";

export default function AuthWall({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    const { isAuthenticated, login } = useRedStore();

    const [mode, setMode] = useState<AuthMode>("checking");
    const [pin, setPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [step, setStep] = useState<"enter" | "confirm">("enter");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [biometryAvailable, setBiometryAvailable] = useState(false);
    const [biometryType, setBiometryType] = useState("Biometría");
    const [disguiseEnabled, setDisguiseEnabled] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [showCompanionQR, setShowCompanionQR] = useState(false);
    const [showOnboardingBioPrompt, setShowOnboardingBioPrompt] = useState(false);
    const [createdPinTemp, setCreatedPinTemp] = useState("");
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutRemaining, setLockoutRemaining] = useState(0);

    // Rate-limiting lockout timer
    useEffect(() => {
        if (lockoutRemaining <= 0) return;
        const timer = setInterval(() => {
            setLockoutRemaining(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [lockoutRemaining]);

    const doLogin = useCallback(async (pwd: string) => {
        if (lockoutRemaining > 0) {
            setError(`⛔ Bloqueado temporalmente. Espera ${lockoutRemaining}s.`);
            return;
        }

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
            const nextAttempts = failedAttempts + 1;
            setFailedAttempts(nextAttempts);
            if (nextAttempts >= 5) {
                setLockoutRemaining(30);
                setError("⛔ Demasiados intentos fallidos. Bóveda bloqueada por 30s.");
            } else {
                setError(`PIN incorrecto (${nextAttempts}/5). Intenta de nuevo.`);
            }
            setLoading(false);
            setPin("");
        } else {
            setFailedAttempts(0);
            BiometricLockEngine.unlock();
        }
    }, [login, failedAttempts, lockoutRemaining]);

    const handleBiometricUnlock = useCallback(async () => {
        if (lockoutRemaining > 0 || loading) return;
        setError("");

        try {
            const res = await BiometricLockEngine.authenticate("Desbloquear Bóveda Criptográfica RED");
            if (res.success && res.masterPin) {
                await doLogin(res.masterPin);
            } else {
                // If cancelled or failed, keep keypad accessible without intrusive error
                console.log("[AuthWall] Biometric check completed without match / dismissed.");
            }
        } catch (e) {
            console.warn("[AuthWall] Biometric error:", e);
        }
    }, [doLogin, lockoutRemaining, loading]);

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            try {
                if (typeof window !== "undefined") {
                    setDisguiseEnabled(localStorage.getItem("red_disguise_mode") === "true");
                }

                // 1. Query master PIN existence
                const hasMaster = await hasSecurePin("master_pin");
                const masterPin = hasMaster ? await getSecurePin("master_pin") : null;

                if (!isMounted) return;

                if (hasMaster) {
                    setMode("unlock");
                } else {
                    setMode("onboarding");
                }
                setIsLoaded(true);

                // 2. Query Biometric Hardware Status
                const bioStatus = await BiometricLockEngine.checkAvailability();
                if (isMounted) {
                    setBiometryAvailable(bioStatus.isAvailable);
                    setBiometryType(bioStatus.biometryType);
                }

                // 3. Auto-Prompt on start if configured and not in disguise mode
                const status = BiometricLockEngine.getStatus();
                if (hasMaster && bioStatus.isAvailable && status.isEnabled && status.autoPrompt && localStorage.getItem("red_disguise_mode") !== "true") {
                    setTimeout(() => {
                        if (isMounted && !isAuthenticated) {
                            handleBiometricUnlock();
                        }
                    }, 350);
                }
            } catch (e) {
                console.error("[AuthWall] Init error:", e);
                if (isMounted) {
                    const hasMaster = await hasSecurePin("master_pin").catch(() => false);
                    setMode(hasMaster ? "unlock" : "onboarding");
                    setIsLoaded(true);
                }
            }
        };

        init();
        return () => {
            isMounted = false;
        };
    }, [handleBiometricUnlock, isAuthenticated]);

    // Digit press handler for the tactical keypad
    const handleDigitPress = (digit: string) => {
        if (loading || lockoutRemaining > 0) return;
        setError("");

        if (mode === "onboarding") {
            if (step === "enter") {
                if (pin.length < 6) setPin(prev => prev + digit);
            } else {
                if (confirmPin.length < 6) setConfirmPin(prev => prev + digit);
            }
        } else {
            if (pin.length < 6) {
                const nextPin = pin + digit;
                setPin(nextPin);
                if (nextPin.length === 6) {
                    // Auto-attempt login on reaching exactly 6 digits
                    doLogin(nextPin);
                }
            }
        }
    };

    const handleBackspace = () => {
        if (loading || lockoutRemaining > 0) return;
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
                setError("El PIN maestro debe tener exactamente 6 dígitos.");
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

            // If device supports biometrics, offer 1-click biometric setup
            if (biometryAvailable) {
                setCreatedPinTemp(pin);
                setShowOnboardingBioPrompt(true);
                setLoading(false);
            } else {
                await doLogin(pin);
            }
        }
    };

    const handleEnrollBiometricsOnboarding = async (enable: boolean) => {
        setShowOnboardingBioPrompt(false);
        if (enable && createdPinTemp) {
            BiometricLockEngine.setEnabled(true);
            try {
                const { Capacitor } = await import("@capacitor/core");
                if (!Capacitor.isNativePlatform()) {
                    await BiometricLockEngine.registerWebAuthnPasskey(createdPinTemp);
                }
                toast.success(`🛡️ ${biometryType} vinculada con éxito`);
            } catch {}
        }
        if (createdPinTemp) {
            await doLogin(createdPinTemp);
        }
    };

    if (isAuthenticated) {
        return <>{children}</>;
    }

    if (disguiseEnabled) {
        return <CalculatorScreen onUnlock={async (typedPin: string) => {
            const isPanic = await verifySecurePin("panic_pin", typedPin);
            if (isPanic) {
                await doLogin(typedPin);
                return;
            }
            const isDecoy = await verifySecurePin("decoy_pin", typedPin);
            if (isDecoy) {
                await doLogin(typedPin);
                return;
            }
            const isMaster = await verifySecurePin("master_pin", typedPin);
            if (isMaster) {
                await doLogin(typedPin);
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
                            {mode === "onboarding" ? "Crear PIN Maestro" : t('auth.title')}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "3px" }}>
                            {mode === "onboarding"
                                ? (step === "enter" ? "Define tu clave de acceso (6 dígitos)" : "Confirma tu PIN maestro de 6 dígitos")
                                : (lockoutRemaining > 0 ? `Bóveda bloqueada (${lockoutRemaining}s)` : t('auth.enter_pin'))}
                        </div>
                    </div>
                </div>

                {/* Indicador de Dígitos (6 Puntos Neón) */}
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
                            disabled={loading || lockoutRemaining > 0}
                            className="card-tactical-interactive"
                            style={{
                                height: "64px", borderRadius: "18px",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.4rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace",
                                color: "#fff", background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                opacity: lockoutRemaining > 0 ? 0.4 : 1
                            }}
                        >
                            {num}
                        </button>
                    ))}

                    {/* Botón Biométrica Universal */}
                    {biometryAvailable && mode === "unlock" ? (
                        <button
                            onClick={handleBiometricUnlock}
                            disabled={loading || lockoutRemaining > 0}
                            className="card-tactical-interactive"
                            style={{
                                height: "64px", borderRadius: "18px",
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                fontSize: "1.3rem", color: "var(--accent-cyan)",
                                background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)",
                                cursor: "pointer", gap: "2px"
                            }}
                            title={`Desbloqueo con ${biometryType}`}
                        >
                            <span>🖐️</span>
                            <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.5px" }}>BIOMETRÍA</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    {/* Botón 0 */}
                    <button
                        onClick={() => handleDigitPress("0")}
                        disabled={loading || lockoutRemaining > 0}
                        className="card-tactical-interactive"
                        style={{
                            height: "64px", borderRadius: "18px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "1.4rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace",
                            color: "#fff", background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            opacity: lockoutRemaining > 0 ? 0.4 : 1
                        }}
                    >
                        0
                    </button>

                    {/* Botón Backspace */}
                    <button
                        onClick={handleBackspace}
                        disabled={loading || lockoutRemaining > 0}
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

                {/* Acciones en Onboarding */}
                {mode === "onboarding" && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                        <button
                            onClick={handleOnboardingNext}
                            disabled={loading || currentDigits.length < 6 || lockoutRemaining > 0}
                            className="btn-tactical-primary"
                            style={{ width: "100%", padding: "14px" }}
                        >
                            {loading ? "Derivando claves..." : (step === "enter" ? "Continuar ➔" : "Confirmar y Entrar")}
                        </button>

                        <button
                            onClick={() => setShowCompanionQR(true)}
                            className="card-tactical-interactive"
                            style={{
                                width: "100%", padding: "12px", borderRadius: "14px",
                                background: "rgba(0, 229, 255, 0.08)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                color: "var(--accent-cyan)", fontSize: "12px", fontWeight: 800,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                                cursor: "pointer"
                            }}
                        >
                            🔗 Vincular con App Móvil (Escanear QR)
                        </button>

                        <button
                            onClick={() => setShowRestoreModal(true)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                textDecoration: "underline",
                                padding: "4px"
                            }}
                        >
                            ☁️ Restaurar copia de seguridad previa
                        </button>
                    </div>
                )}

                {/* Acciones en Unlock */}
                {mode === "unlock" && (
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                        <button
                            onClick={() => setShowCompanionQR(true)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--accent-cyan)",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                textDecoration: "underline",
                                padding: "4px"
                            }}
                        >
                            💻 ¿Cambiar cuenta? Vincular con App Móvil
                        </button>
                    </div>
                )}
            </div>

            {/* Modal de Enrolamiento Biométrico Post-Onboarding */}
            {showOnboardingBioPrompt && (
                <div style={{
                    position: "fixed", inset: 0, zIndex: 100000,
                    background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(12px)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                }}>
                    <div className="card-tactical animate-pop" style={{
                        maxWidth: "380px", width: "100%", padding: "24px",
                        background: "#0F172A", border: "1px solid rgba(0, 229, 255, 0.4)",
                        borderRadius: "20px", display: "flex", flexDirection: "column", gap: "16px",
                        boxShadow: "0 20px 50px rgba(0,0,0,0.8)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: "44px", height: "44px", borderRadius: "14px",
                                background: "rgba(0, 229, 255, 0.15)", border: "1px solid rgba(0, 229, 255, 0.3)",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem"
                            }}>🖐️</div>
                            <div>
                                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", margin: 0 }}>
                                    Activar Llave Biométrica
                                </h3>
                                <p style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", margin: "2px 0 0 0" }}>
                                    {biometryType} detectada
                                </p>
                            </div>
                        </div>

                        <p style={{ fontSize: "0.82rem", color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>
                            ¿Deseas activar el desbloqueo instantáneo con tu sensor biométrico? Podrás acceder a tu bóveda sin tener que ingresar manualmente el PIN de 6 dígitos cada vez.
                        </p>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                            <button
                                onClick={() => handleEnrollBiometricsOnboarding(true)}
                                className="btn-tactical-primary"
                                style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #00E5FF 0%, #0077B6 100%)", color: "#000", fontWeight: 900 }}
                            >
                                ⚡ Activar {biometryType}
                            </button>
                            <button
                                onClick={() => handleEnrollBiometricsOnboarding(false)}
                                style={{
                                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                                    color: "var(--text-muted)", padding: "10px", borderRadius: "12px",
                                    fontSize: "0.8rem", fontWeight: 700, cursor: "pointer"
                                }}
                            >
                                Ahora no, usar solo PIN
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Vinculación Companion QR */}
            {showCompanionQR && (
                <WebCompanionQRModal onClose={() => setShowCompanionQR(false)} />
            )}

            {/* Modal de Restauración en Onboarding */}
            {showRestoreModal && (
                <BackupRestoreModal onClose={() => setShowRestoreModal(false)} />
            )}
        </div>
    );
}
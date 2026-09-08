"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRedStore } from "../store/useRedStore";
import { useTranslation } from "../lib/i18n/i18nEngine";
import { toast } from "./Toast";
import { registerPlugin } from "@capacitor/core";
import { SystemHealthModal } from "./SystemHealthModal";
import { SecurityReportModal } from "./SecurityReportModal";
import { BackupRestoreModal } from "./BackupRestoreModal";
import { WebCompanionLinkModal } from "./WebCompanionLinkModal";
import { RED_VERSION_NAME } from "../lib/version";
import { getGuardianStatus } from "../api/ai";
import { GuardianStatus } from "../api/types";
import { BackHandlerRegistry } from "../lib/navigation/BackHandlerRegistry";
import { RedAPI } from "../api/client";
import { getSecurePin, setSecurePin, clearSecurePin, hasSecurePin } from "../lib/crypto/BiometricLockEngine";
import { TacticalAudioEngine } from "../lib/audio/TacticalAudioEngine";

/** Clipboard with textarea fallback for SecurityPanel */
function copyToClipboard(text: string, label = 'Dato'): void {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => legacyCopy(text, label));
    } else { legacyCopy(text, label); }
}
function legacyCopy(text: string, label: string): void {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); toast.success(`${label} copiado`); }
    finally { document.body.removeChild(ta); }
}

const RedDisguise = registerPlugin<any>("RedDisguise");

export default function SecurityPanel() {
    const { navigate, goBack } = useRedStore();
    const { t } = useTranslation();
    const [privacyScreenEnabled, setPrivacyScreenEnabled] = useState(false);
    const [disguiseEnabled, setDisguiseEnabled] = useState(false);
    const [burnerChatsEnabled, setBurnerChatsEnabled] = useState(false);

    // PINs & Estado Zero-Trust de Keystore
    const [masterPin, setMasterPin] = useState("");
    const [savedMasterPin, setSavedMasterPin] = useState("");
    const [isMasterConfigured, setIsMasterConfigured] = useState(false);

    const [panicPin, setPanicPin] = useState("");
    const [savedPanicPin, setSavedPanicPin] = useState("");
    const [isPanicConfigured, setIsPanicConfigured] = useState(false);

    const [decoyPin, setDecoyPin] = useState("");
    const [savedDecoyPin, setSavedDecoyPin] = useState("");
    const [isDecoyConfigured, setIsDecoyConfigured] = useState(false);

    // Biometrics & Auto-lock
    const [hasBiometrics, setHasBiometrics] = useState(false);
    const [autoLockTimeout, setAutoLockTimeout] = useState<string>("300");

    // Modales Embebidos
    const [healthModalOpen, setHealthModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [backupModalOpen, setBackupModalOpen] = useState(false);
    const [companionModalOpen, setCompanionModalOpen] = useState(false);

    // Register Back Interceptors for Sub-Modals (LIFO)
    useEffect(() => {
        if (!healthModalOpen) return;
        return BackHandlerRegistry.register(() => {
            setHealthModalOpen(false);
            return true;
        });
    }, [healthModalOpen]);

    useEffect(() => {
        if (!reportModalOpen) return;
        return BackHandlerRegistry.register(() => {
            setReportModalOpen(false);
            return true;
        });
    }, [reportModalOpen]);

    useEffect(() => {
        if (!backupModalOpen) return;
        return BackHandlerRegistry.register(() => {
            setBackupModalOpen(false);
            return true;
        });
    }, [backupModalOpen]);

    useEffect(() => {
        if (!companionModalOpen) return;
        return BackHandlerRegistry.register(() => {
            setCompanionModalOpen(false);
            return true;
        });
    }, [companionModalOpen]);

    // Interceptor Base de Hardware (Android Back / Esc) cuando no hay sub-modales abiertos
    useEffect(() => {
        if (healthModalOpen || reportModalOpen || backupModalOpen || companionModalOpen) return;
        return BackHandlerRegistry.register(() => {
            goBack();
            return true;
        });
    }, [healthModalOpen, reportModalOpen, backupModalOpen, companionModalOpen, goBack]);

    // ── Guardian AI Status (Live Polling) ──────────────────────────────────────
    const [guardianStatus, setGuardianStatus] = useState<GuardianStatus | null>(null);
    const [guardianLoading, setGuardianLoading] = useState(true);
    const [guardianPulse, setGuardianPulse] = useState(false);

    const refreshGuardian = useCallback(async () => {
        try {
            const status = await getGuardianStatus();
            setGuardianStatus(prev => {
                if (prev && prev.stats?.messages_blocked !== status.stats?.messages_blocked) {
                    setGuardianPulse(true);
                    setTimeout(() => setGuardianPulse(false), 1200);
                }
                return status;
            });
        } catch {
            // Guardian offline — non-fatal
        } finally {
            setGuardianLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshGuardian();
        const interval = setInterval(refreshGuardian, 4000);
        return () => clearInterval(interval);
    }, [refreshGuardian]);

    useEffect(() => {
        const savedPrivacy = localStorage.getItem("red_privacy_screen") === "true";
        const savedDisguise = localStorage.getItem("red_disguise_mode") === "true";
        const savedBurner = localStorage.getItem("red_burner_chats") === "true";
        const savedTimeout = localStorage.getItem("red_autolock_timeout") || "300";

        setPrivacyScreenEnabled(savedPrivacy);
        setDisguiseEnabled(savedDisguise);
        setBurnerChatsEnabled(savedBurner);
        setAutoLockTimeout(savedTimeout);

        if (savedBurner) {
            RedAPI.setBurnerMode(true);
        }

        // Cargar y verificar presencia Zero-Trust de PINs en Keystore
        hasSecurePin("master_pin").then(configured => {
            setIsMasterConfigured(configured);
            if (configured) {
                getSecurePin("master_pin").then(v => { if (v) { setSavedMasterPin(v); } });
            }
        });

        hasSecurePin("panic_pin").then(configured => {
            setIsPanicConfigured(configured);
            if (configured) {
                getSecurePin("panic_pin").then(v => { if (v) { setSavedPanicPin(v); } });
            }
        });

        hasSecurePin("decoy_pin").then(configured => {
            setIsDecoyConfigured(configured);
            if (configured) {
                getSecurePin("decoy_pin").then(v => { if (v) { setSavedDecoyPin(v); } });
            }
        });

        // Verificar biometría de hardware
        if (typeof window !== "undefined" && window.PublicKeyCredential) {
            window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                .then(avail => setHasBiometrics(avail))
                .catch(() => setHasBiometrics(false));
        }

        applyPrivacyScreen(savedPrivacy);
    }, []);

    const applyPrivacyScreen = async (enabled: boolean) => {
        try {
            const { Capacitor, registerPlugin: reg } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const PrivacyScreen = reg<any>("PrivacyScreen");
                if (enabled) {
                    await PrivacyScreen.enable();
                } else {
                    await PrivacyScreen.disable();
                }
            }
            setPrivacyScreenEnabled(enabled);
            localStorage.setItem("red_privacy_screen", enabled ? "true" : "false");
        } catch {
            setPrivacyScreenEnabled(enabled);
            localStorage.setItem("red_privacy_screen", enabled ? "true" : "false");
        }
    };

    const toggleDisguise = async (enabled: boolean) => {
        setDisguiseEnabled(enabled);
        localStorage.setItem("red_disguise_mode", enabled ? "true" : "false");
        try {
            const { Capacitor } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                await RedDisguise.setDisguiseEnabled({ enabled });
            }
        } catch {}
        if (enabled) {
            toast.warning("Camuflaje activado: La app iniciará como calculadora de alta fidelidad");
        } else {
            toast.info("Camuflaje desactivado");
        }
    };

    const toggleBurnerChats = (enabled: boolean) => {
        setBurnerChatsEnabled(enabled);
        localStorage.setItem("red_burner_chats", enabled ? "true" : "false");
        RedAPI.setBurnerMode(enabled);
        if (enabled) {
            toast.warning("Modo Burner: Los nuevos mensajes solo residirán en memoria RAM");
        } else {
            toast.info("Persistencia estándar en Sled DB restaurada");
        }
    };

    const handleAutoLockChange = (val: string) => {
        setAutoLockTimeout(val);
        localStorage.setItem("red_autolock_timeout", val);
        toast.success(`Tiempo de auto-bloqueo configurado: ${val === "0" ? "Instantáneo" : `${Number(val) / 60} min`}`);
        TacticalAudioEngine.playTap();
    };

    const evaluatePinStrength = (pin: string) => {
        if (!pin) return { label: "Vacío", color: "var(--text-muted)", width: "0%" };
        if (pin.length < 4) return { label: "Demasiado corto (mín. 4)", color: "var(--accent-crimson)", width: "25%" };
        if (/^(.)\1+$/.test(pin)) return { label: "Débil (dígitos repetidos)", color: "var(--accent-amber)", width: "40%" };
        if ("01234567890123".includes(pin) || "9876543210987".includes(pin)) return { label: "Secuencia predecible", color: "var(--accent-amber)", width: "50%" };
        if (pin.length >= 6) return { label: "Fuerte", color: "var(--accent-emerald)", width: "100%" };
        return { label: "Aceptable", color: "var(--accent-cyan)", width: "75%" };
    };

    const handleSaveMasterPin = async () => {
        if (!masterPin || masterPin.length < 4) {
            toast.error("El PIN Maestro debe tener al menos 4 dígitos");
            return;
        }
        await setSecurePin("master_pin", masterPin);
        setSavedMasterPin(masterPin);
        setIsMasterConfigured(true);
        setMasterPin("");
        toast.success("🔐 PIN Maestro actualizado en Hardware Keystore");
        TacticalAudioEngine.playRogerBeep();
    };

    const handleSavePanicPin = async () => {
        if (!panicPin || panicPin.length < 4) {
            toast.error("El PIN de pánico debe tener al menos 4 dígitos");
            return;
        }
        if (panicPin === savedMasterPin) {
            toast.error("El PIN de pánico no puede ser idéntico al PIN Maestro");
            return;
        }
        await setSecurePin("panic_pin", panicPin);
        setSavedPanicPin(panicPin);
        setIsPanicConfigured(true);
        setPanicPin("");
        toast.success("🔓 PIN de pánico guardado en Hardware Keystore");
        TacticalAudioEngine.playRogerBeep();
    };

    const handleClearPanicPin = async () => {
        await clearSecurePin("panic_pin");
        setPanicPin("");
        setSavedPanicPin("");
        setIsPanicConfigured(false);
        toast.info("PIN de pánico desactivado");
    };

    const handleSaveDecoyPin = async () => {
        if (!decoyPin || decoyPin.length < 4) {
            toast.error("El PIN señuelo debe tener al menos 4 dígitos");
            return;
        }
        if (decoyPin === savedMasterPin || decoyPin === savedPanicPin) {
            toast.error("El PIN señuelo debe ser diferente al PIN Maestro y al PIN de Pánico");
            return;
        }
        await setSecurePin("decoy_pin", decoyPin);
        setSavedDecoyPin(decoyPin);
        setIsDecoyConfigured(true);
        setDecoyPin("");
        toast.success("🪄 Bóveda señuelo configurada en Hardware Keystore");
        TacticalAudioEngine.playRogerBeep();
    };

    const handleClearDecoyPin = async () => {
        await clearSecurePin("decoy_pin");
        setDecoyPin("");
        setSavedDecoyPin("");
        setIsDecoyConfigured(false);
        toast.info("Bóveda señuelo desactivada");
    };

    return (
        <div style={{
            width: "100%", height: "100%",
            background: "var(--bg-void)", color: "var(--text-primary)",
            display: "flex", flexDirection: "column",
            overflow: "hidden", position: "relative"
        }}>
            {/* Header Táctico */}
            <header style={{
                padding: "16px 20px",
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: "1px solid var(--glass-border)",
                background: "linear-gradient(180deg, rgba(14, 14, 26, 0.95) 0%, rgba(8, 8, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                zIndex: 10, flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: "12px",
                        background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.25rem", boxShadow: "0 4px 16px rgba(232,33,58,0.4)"
                    }}>🛡️</div>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, letterSpacing: "0.2px" }}>
                            {t('security_panel.title')}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-crimson-bright)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {t('security_panel.subtitle')}
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title={t('common.close')}
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "720px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* ── Guardian AI Live Status Card ──────────────────────── */}
                    <div style={{
                        padding: "14px 16px",
                        borderRadius: "14px",
                        background: guardianStatus?.active
                            ? "linear-gradient(135deg, rgba(0,230,118,0.08) 0%, rgba(0,229,255,0.05) 100%)"
                            : "rgba(232,33,58,0.08)",
                        border: `1px solid ${guardianStatus?.active ? "rgba(0,230,118,0.35)" : "rgba(232,33,58,0.35)"}`,
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                        animation: guardianPulse ? "red-glow-pulse 0.8s ease" : undefined,
                        transition: "border-color 0.4s ease, background 0.4s ease",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: "12px", flexShrink: 0,
                                background: guardianStatus?.active
                                    ? "linear-gradient(135deg,#009624,#00E676)"
                                    : "linear-gradient(135deg,#c01830,#FF3355)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.2rem",
                                boxShadow: guardianStatus?.active
                                    ? "0 0 18px rgba(0,230,118,0.4)"
                                    : "0 0 18px rgba(232,33,58,0.4)",
                            }}>
                                {guardianLoading ? "⏳" : guardianStatus?.active ? "🛡️" : "⛔"}
                            </div>
                            <div>
                                <div style={{ fontSize: "0.90rem", fontWeight: 900, color: "#fff" }}>
                                    Guardian AI Firewall
                                    {" "}
                                    <span style={{
                                        fontSize: "0.60rem", padding: "1px 6px", borderRadius: "4px",
                                        background: guardianStatus?.active ? "rgba(0,230,118,0.2)" : "rgba(232,33,58,0.2)",
                                        color: guardianStatus?.active ? "#00E676" : "#FF3355",
                                        fontFamily: "JetBrains Mono, monospace", fontWeight: 800,
                                        border: `1px solid ${guardianStatus?.active ? "rgba(0,230,118,0.4)" : "rgba(232,33,58,0.4)"}`,
                                    }}>
                                        {guardianStatus?.mode?.toUpperCase() || "OFFLINE"}
                                    </span>
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                                    {guardianLoading
                                        ? "Sincronizando motor local…"
                                        : `${guardianStatus?.stats?.messages_analyzed ?? 0} analizados · ${guardianStatus?.stats?.messages_blocked ?? 0} bloqueados`
                                    }
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                            <button
                                onClick={refreshGuardian}
                                title="Forzar sincronización del Guardian"
                                style={{
                                    width: 30, height: 30, borderRadius: "8px",
                                    background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-border)",
                                    color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                            >↻</button>
                            <span style={{ fontSize: "0.60rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono" }}>
                                {guardianStatus?.model?.split("(")[0].trim().slice(0, 18) || "LOCAL"}
                            </span>
                        </div>
                    </div>

                    {/* ── Tarjeta HUD Criptográfica Soberana & Post-Cuántica (PQC) ── */}
                    <div className="card-tactical animate-enter" style={{
                        padding: "16px 18px",
                        background: "linear-gradient(135deg, rgba(14, 18, 38, 0.95) 0%, rgba(6, 10, 22, 0.98) 100%)",
                        border: "1px solid rgba(0, 229, 255, 0.3)",
                        borderRadius: "16px", display: "flex", flexDirection: "column", gap: "10px",
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "1.15rem" }}>🔒</span>
                                <span style={{ fontSize: "0.88rem", fontWeight: 900, color: "var(--accent-cyan)" }}>
                                    ESTADO CRIPTOGRÁFICO SOBERANO & POST-CUÁNTICO
                                </span>
                            </div>
                            <span style={{
                                fontSize: "0.60rem", fontWeight: 800, padding: "2px 8px", borderRadius: "6px",
                                background: "rgba(0, 230, 118, 0.15)", color: "#00E676", border: "1px solid rgba(0, 230, 118, 0.35)"
                            }}>
                                ZERO-TRUST AIR-GAP
                            </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                <div style={{ color: "var(--text-muted)", fontSize: "0.60rem", fontWeight: 700 }}>FIRMA & IDENTIDAD SOBERANA</div>
                                <div style={{ fontWeight: 800, color: "#FFFFFF", fontSize: "0.74rem", marginTop: "2px" }}>Ed25519 (256-bit ECC)</div>
                            </div>
                            <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                <div style={{ color: "var(--text-muted)", fontSize: "0.60rem", fontWeight: 700 }}>RESISTENCIA POST-CUÁNTICA</div>
                                <div style={{ fontWeight: 800, color: "var(--accent-cyan)", fontSize: "0.74rem", marginTop: "2px" }}>ML-KEM-768 (Kyber PQC)</div>
                            </div>
                            <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                <div style={{ color: "var(--text-muted)", fontSize: "0.60rem", fontWeight: 700 }}>CIFRADO DE TRAMAS MALLA</div>
                                <div style={{ fontWeight: 800, color: "#FFFFFF", fontSize: "0.74rem", marginTop: "2px" }}>AES-256-GCM + ChaCha20</div>
                            </div>
                            <div style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                <div style={{ color: "var(--text-muted)", fontSize: "0.60rem", fontWeight: 700 }}>AISLAMIENTO DE DATOS</div>
                                <div style={{ fontWeight: 800, color: burnerChatsEnabled ? "var(--accent-amber)" : "var(--accent-emerald)", fontSize: "0.74rem", marginTop: "2px" }}>
                                    {burnerChatsEnabled ? "RAM Volátil (Zero-Disk)" : "Sled DB (Local Cifrado)"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Bóvedas Tácticas Especializadas (Hub 4) ──────────── */}
                    <div style={{ fontSize: "0.80rem", fontWeight: 800, letterSpacing: "1px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Bóvedas Tácticas & Custodia Soberana (Hub 4)
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                        <button
                            onClick={() => navigate("idVault")}
                            className="card-tactical-interactive"
                            style={{
                                padding: "12px", display: "flex", flexDirection: "column", gap: "4px",
                                border: "1px solid rgba(0, 229, 255, 0.4)", background: "linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(10, 30, 50, 0.2) 100%)",
                                textAlign: "left"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "1.2rem" }}>🪪</span>
                                <span style={{ fontSize: "0.80rem", fontWeight: 900, color: "var(--accent-cyan)" }}>Identidad & PQC</span>
                            </div>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>Ed25519 · Kyber · Shamir SSS</span>
                        </button>

                        <button
                            onClick={() => navigate("stegoVault")}
                            className="card-tactical-interactive"
                            style={{
                                padding: "12px", display: "flex", flexDirection: "column", gap: "4px",
                                border: "1px solid rgba(179, 136, 255, 0.4)", background: "linear-gradient(135deg, rgba(179, 136, 255, 0.08) 0%, rgba(30, 15, 50, 0.2) 100%)",
                                textAlign: "left"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "1.2rem" }}>🖼️</span>
                                <span style={{ fontSize: "0.80rem", fontWeight: 900, color: "#B388FF" }}>Esteganografía</span>
                            </div>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>Inyección LSB Oculta en Fotos</span>
                        </button>

                        <button
                            onClick={() => navigate("web3Vault")}
                            className="card-tactical-interactive"
                            style={{
                                padding: "12px", display: "flex", flexDirection: "column", gap: "4px",
                                border: "1px solid rgba(0, 230, 118, 0.4)", background: "linear-gradient(135deg, rgba(0, 230, 118, 0.08) 0%, rgba(10, 40, 25, 0.2) 100%)",
                                textAlign: "left"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "1.2rem" }}>🪙</span>
                                <span style={{ fontSize: "0.80rem", fontWeight: 900, color: "var(--accent-emerald)" }}>Bóveda Web3</span>
                            </div>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>Custodia Soberana & Wallets P2P</span>
                        </button>
                    </div>

                    {/* Acciones Rápidas de Auditoría */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                        <button
                            onClick={() => setHealthModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "3px" }}
                        >
                            <span style={{ fontSize: "1.1rem" }}>💚</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-emerald)" }}>Health</span>
                            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>I/O</span>
                        </button>

                        <button
                            onClick={() => setReportModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "3px" }}
                        >
                            <span style={{ fontSize: "1.1rem" }}>📋</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-cyan)" }}>Auditoría</span>
                            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Forense</span>
                        </button>

                        <button
                            onClick={() => setBackupModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "3px" }}
                        >
                            <span style={{ fontSize: "1.1rem" }}>💾</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-amber)" }}>Bóveda</span>
                            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Respaldo</span>
                        </button>

                        <button
                            onClick={() => setCompanionModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "3px", border: "1px solid rgba(0, 229, 255, 0.4)", background: "rgba(0, 229, 255, 0.06)" }}
                        >
                            <span style={{ fontSize: "1.1rem" }}>💻</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--accent-cyan)" }}>Vincular</span>
                            <span style={{ fontSize: "0.62rem", color: "var(--accent-cyan)" }}>Web PC</span>
                        </button>
                    </div>

                    {/* Sección 1: Contramedidas Defensivas */}
                    <div style={{ fontSize: "0.80rem", fontWeight: 800, letterSpacing: "1px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Contramedidas & Camuflaje Operativo
                    </div>

                    {/* Bloqueo de Capturas FLAG_SECURE */}
                    <div className="card-tactical animate-enter" style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                Bloqueo de Capturas (FLAG_SECURE)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Impide capturas de pantalla y visualización en la lista de apps recientes
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={privacyScreenEnabled}
                            onChange={e => applyPrivacyScreen(e.target.checked)}
                            style={{ width: "22px", height: "22px", accentColor: "var(--accent-crimson)" }}
                        />
                    </div>

                    {/* Camuflaje Calculadora */}
                    <div className="card-tactical animate-enter" style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-primary-hover)" }}>
                                Camuflaje Anti-Inspección (Calculadora)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Inicia una calculadora señuelo. Teclea tu PIN + "=" para entrar a la bóveda
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={disguiseEnabled}
                            onChange={e => toggleDisguise(e.target.checked)}
                            style={{ width: "22px", height: "22px", accentColor: "var(--accent-amber)" }}
                        />
                    </div>

                    {/* Modo Burner (RAM-Only) */}
                    <div className="card-tactical animate-enter" style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                                Modo Burner (Solo Memoria RAM)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                No escribe mensajes en disco flash. Se destruyen al cerrar la sesión
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={burnerChatsEnabled}
                            onChange={e => toggleBurnerChats(e.target.checked)}
                            style={{ width: "22px", height: "22px", accentColor: "var(--accent-amber)" }}
                        />
                    </div>

                    {/* Auto-Bloqueo Timeout */}
                    <div className="card-tactical animate-enter" style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text-primary)" }}>
                                Tiempo de Auto-Bloqueo de Bóveda
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Bloquea la sesión tras un período de inactividad
                            </div>
                        </div>
                        <select
                            value={autoLockTimeout}
                            onChange={e => handleAutoLockChange(e.target.value)}
                            style={{
                                padding: "6px 10px", fontSize: "0.80rem",
                                background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-border)",
                                borderRadius: "6px", color: "var(--text-primary)"
                            }}
                        >
                            <option value="0">Instantáneo (al salir)</option>
                            <option value="30">30 segundos</option>
                            <option value="60">1 minuto</option>
                            <option value="300">5 minutos</option>
                            <option value="900">15 minutos</option>
                        </select>
                    </div>

                    {/* Sección 2: Bóveda de Claves y PINs Tácticos */}
                    <div style={{ fontSize: "0.80rem", fontWeight: 800, letterSpacing: "1px", color: "var(--text-muted)", textTransform: "uppercase", marginTop: "8px" }}>
                        Jerarquía de Autenticación & Anti-Coacción
                    </div>

                    {/* PIN Maestro */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "10px", borderLeft: "4px solid var(--accent-cyan)" }}>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                        🔐 PIN Maestro de la Bóveda
                                    </span>
                                    <span style={{
                                        fontSize: "0.62rem", padding: "2px 6px", borderRadius: "4px",
                                        background: isMasterConfigured ? "rgba(0, 230, 118, 0.15)" : "rgba(255, 170, 0, 0.15)",
                                        color: isMasterConfigured ? "#00E676" : "#FFAA00",
                                        border: `1px solid ${isMasterConfigured ? '#00E676' : '#FFAA00'}40`,
                                        fontWeight: 800
                                    }}>
                                        {isMasterConfigured ? "✓ CONFIGURADO" : "⚠️ NO CONFIGURADO"}
                                    </span>
                                </div>
                                <span style={{ fontSize: "0.70rem", color: evaluatePinStrength(masterPin).color, fontWeight: 700 }}>
                                    {evaluatePinStrength(masterPin).label}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Clave principal para desbloquear el nodo y gestionar identidades soberanas
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                value={masterPin}
                                onChange={e => setMasterPin(e.target.value)}
                                placeholder={isMasterConfigured ? "•••• (Introduce nuevo para cambiar)" : "Configurar PIN Maestro..."}
                                style={{ flex: 1, fontSize: "0.88rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSaveMasterPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.80rem" }}
                            >
                                {isMasterConfigured ? "Actualizar" : "Guardar"}
                            </button>
                        </div>
                    </div>

                    {/* PIN de Pánico */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "10px", borderLeft: "4px solid var(--accent-crimson)" }}>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-crimson-bright)" }}>
                                        🔥 PIN de Pánico (Auto-Wipe Inmediato)
                                    </span>
                                    <span style={{
                                        fontSize: "0.62rem", padding: "2px 6px", borderRadius: "4px",
                                        background: isPanicConfigured ? "rgba(255, 51, 85, 0.15)" : "rgba(255, 255, 255, 0.06)",
                                        color: isPanicConfigured ? "#FF3355" : "var(--text-muted)",
                                        border: `1px solid ${isPanicConfigured ? '#FF3355' : 'rgba(255, 255, 255, 0.1)'}`,
                                        fontWeight: 800
                                    }}>
                                        {isPanicConfigured ? "🔥 ACTIVO (WIPE)" : "INACTIVO"}
                                    </span>
                                </div>
                                <span style={{ fontSize: "0.70rem", color: evaluatePinStrength(panicPin).color, fontWeight: 700 }}>
                                    {evaluatePinStrength(panicPin).label}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Si ingresas este PIN en la pantalla de bloqueo, la bóveda se destruye al instante sin dejar rastro forense
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                value={panicPin}
                                onChange={e => setPanicPin(e.target.value)}
                                placeholder={isPanicConfigured ? "•••• (Introduce nuevo para cambiar)" : "Configurar PIN de pánico..."}
                                style={{ flex: 1, fontSize: "0.88rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSavePanicPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.80rem", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" }}
                            >
                                {isPanicConfigured ? "Actualizar" : "Guardar"}
                            </button>
                            {isPanicConfigured && (
                                <button
                                    onClick={handleClearPanicPin}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "10px 14px", fontSize: "0.80rem" }}
                                >
                                    Desactivar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* PIN Señuelo (Decoy Vault) */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "10px", borderLeft: "4px solid var(--accent-purple, #B388FF)" }}>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-purple, #B388FF)" }}>
                                        🎭 PIN de Bóveda Señuelo (Decoy Vault)
                                    </span>
                                    <span style={{
                                        fontSize: "0.62rem", padding: "2px 6px", borderRadius: "4px",
                                        background: isDecoyConfigured ? "rgba(179, 136, 255, 0.15)" : "rgba(255, 255, 255, 0.06)",
                                        color: isDecoyConfigured ? "#B388FF" : "var(--text-muted)",
                                        border: `1px solid ${isDecoyConfigured ? '#B388FF' : 'rgba(255, 255, 255, 0.1)'}`,
                                        fontWeight: 800
                                    }}>
                                        {isDecoyConfigured ? "🎭 ACTIVO (SEÑUELO)" : "INACTIVO"}
                                    </span>
                                </div>
                                <span style={{ fontSize: "0.70rem", color: evaluatePinStrength(decoyPin).color, fontWeight: 700 }}>
                                    {evaluatePinStrength(decoyPin).label}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Bajo coacción, ingresa este PIN para abrir una sesión señuelo con datos simulados e inofensivos
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                value={decoyPin}
                                onChange={e => setDecoyPin(e.target.value)}
                                placeholder={isDecoyConfigured ? "•••• (Introduce nuevo para cambiar)" : "Configurar PIN señuelo..."}
                                style={{ flex: 1, fontSize: "0.88rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSaveDecoyPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.80rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                            >
                                {isDecoyConfigured ? "Actualizar" : "Guardar"}
                            </button>
                            {isDecoyConfigured && (
                                <button
                                    onClick={handleClearDecoyPin}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "10px 14px", fontSize: "0.80rem" }}
                                >
                                    Desactivar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modales Embebidos */}
            {reportModalOpen && <SecurityReportModal onClose={() => setReportModalOpen(false)} />}
            {backupModalOpen && <BackupRestoreModal onClose={() => setBackupModalOpen(false)} />}
            {healthModalOpen && <SystemHealthModal onClose={() => setHealthModalOpen(false)} />}
            {companionModalOpen && <WebCompanionLinkModal onClose={() => setCompanionModalOpen(false)} />}
        </div>
    );
}
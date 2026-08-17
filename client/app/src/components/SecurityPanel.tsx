"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { toast } from "./Toast";
import { registerPlugin } from "@capacitor/core";
import { SystemHealthModal } from "./SystemHealthModal";
import { SecurityReportModal } from "./SecurityReportModal";
import { BackupRestoreModal } from "./BackupRestoreModal";
import { RED_VERSION_NAME } from "../lib/version";

const RedDisguise = registerPlugin<any>("RedDisguise");

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
    const [disguiseEnabled, setDisguiseEnabled] = useState(false);
    const [burnerChatsEnabled, setBurnerChatsEnabled] = useState(false);

    // PINs
    const [masterPin, setMasterPin] = useState("");
    const [savedMasterPin, setSavedMasterPin] = useState("");

    const [panicPin, setPanicPin] = useState("");
    const [savedPanicPin, setSavedPanicPin] = useState("");

    const [decoyPin, setDecoyPin] = useState("");
    const [savedDecoyPin, setSavedDecoyPin] = useState("");

    // Biometrics & Auto-lock
    const [hasBiometrics, setHasBiometrics] = useState(false);
    const [autoLockTimeout, setAutoLockTimeout] = useState<string>("300");

    // Modales
    const [healthModalOpen, setHealthModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [backupModalOpen, setBackupModalOpen] = useState(false);

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
            import("../lib/api").then(({ RedAPI }) => RedAPI.setBurnerMode(true));
        }

        // Cargar PINs de Keystore
        getSecurePin("master_pin").then(v => { setMasterPin(v); setSavedMasterPin(v); });
        getSecurePin("panic_pin").then(v => { setPanicPin(v); setSavedPanicPin(v); });
        getSecurePin("decoy_pin").then(v => { setDecoyPin(v); setSavedDecoyPin(v); });

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
        import("../lib/api").then(({ RedAPI }) => RedAPI.setBurnerMode(enabled));
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
        toast.success("🔐 PIN Maestro actualizado en Hardware Keystore");
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
        toast.success("🔥 PIN de pánico guardado en Hardware Keystore");
    };

    const handleClearPanicPin = async () => {
        await SecureStoragePlugin.remove({ key: "panic_pin" }).catch(() => {});
        setPanicPin("");
        setSavedPanicPin("");
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
        toast.success("🎭 Bóveda señuelo configurada en Hardware Keystore");
    };

    const handleClearDecoyPin = async () => {
        await SecureStoragePlugin.remove({ key: "decoy_pin" }).catch(() => {});
        setDecoyPin("");
        setSavedDecoyPin("");
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
                            Consola de Seguridad & Zero-Trust
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-crimson-bright)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            {RED_VERSION_NAME} · HARDWARE KEYSTORE & ZERO-KNOWLEDGE
                        </div>
                    </div>
                </div>

                <button
                    onClick={goBack}
                    className="btn-icon"
                    title="Cerrar panel"
                    style={{ width: 38, height: 38 }}
                >
                    ✕
                </button>
            </header>

            {/* Contenido Principal con Scroll */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "720px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Acciones Rápidas Superiores */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                        <button
                            onClick={() => setHealthModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>💚</span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--accent-emerald)" }}>Diagnóstico</span>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Health & I/O</span>
                        </button>

                        <button
                            onClick={() => setReportModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>📋</span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--accent-cyan)" }}>Auditoría</span>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Forense & SHA-256</span>
                        </button>

                        <button
                            onClick={() => setBackupModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "4px" }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>💾</span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--accent-amber)" }}>Bóveda</span>
                            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>Respaldo AES-256</span>
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
                                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                                    🔐 PIN Maestro de la Bóveda
                                </div>
                                <span style={{ fontSize: "0.70rem", color: evaluatePinStrength(masterPin).color, fontWeight: 700 }}>
                                    {evaluatePinStrength(masterPin).label}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Clave principal para desbloquear el nodo y gestionar identidades
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                value={masterPin}
                                onChange={e => setMasterPin(e.target.value)}
                                placeholder="Configurar PIN Maestro..."
                                style={{ flex: 1, fontSize: "0.88rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSaveMasterPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.80rem" }}
                            >
                                {savedMasterPin ? "Actualizar" : "Guardar"}
                            </button>
                        </div>
                    </div>

                    {/* PIN de Pánico */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: "10px", borderLeft: "4px solid var(--accent-crimson)" }}>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-crimson-bright)" }}>
                                    🔥 PIN de Pánico (Auto-Wipe Inmediato)
                                </div>
                                <span style={{ fontSize: "0.70rem", color: evaluatePinStrength(panicPin).color, fontWeight: 700 }}>
                                    {evaluatePinStrength(panicPin).label}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Si ingresas este PIN en la pantalla de bloqueo, la bóveda se destruye al instante sin dejar rastro
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                value={panicPin}
                                onChange={e => setPanicPin(e.target.value)}
                                placeholder="Configurar PIN de pánico..."
                                style={{ flex: 1, fontSize: "0.88rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSavePanicPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.80rem", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" }}
                            >
                                Guardar
                            </button>
                            {savedPanicPin && (
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
                                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-purple, #B388FF)" }}>
                                    🎭 PIN de Bóveda Señuelo (Decoy Vault)
                                </div>
                                <span style={{ fontSize: "0.70rem", color: evaluatePinStrength(decoyPin).color, fontWeight: 700 }}>
                                    {evaluatePinStrength(decoyPin).label}
                                </span>
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Bajo coacción, ingresa este PIN para abrir una sesión señuelo con datos inofensivos
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                value={decoyPin}
                                onChange={e => setDecoyPin(e.target.value)}
                                placeholder="Configurar PIN señuelo..."
                                style={{ flex: 1, fontSize: "0.88rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSaveDecoyPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.80rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                            >
                                Guardar
                            </button>
                            {savedDecoyPin && (
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
        </div>
    );
}
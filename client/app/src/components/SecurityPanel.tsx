"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { toast } from "./Toast";
import { registerPlugin } from "@capacitor/core";
import { SystemHealthModal } from "./SystemHealthModal";
import { SecurityReportModal } from "./SecurityReportModal";
import { BackupRestoreModal } from "./BackupRestoreModal";

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
    const [panicPin, setPanicPin] = useState("");
    const [savedPined, setSavedPined] = useState("");
    
    const [decoyPin, setDecoyPin] = useState("");
    const [burnerChatsEnabled, setBurnerChatsEnabled] = useState(false);
    const [healthModalOpen, setHealthModalOpen] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [backupModalOpen, setBackupModalOpen] = useState(false);

    const [disguiseEnabled, setDisguiseEnabled] = useState(false);
    const [calcPin, setCalcPin] = useState("");

    useEffect(() => {
        const savedPrivacy = localStorage.getItem("red_privacy_screen") === "true";
        setSavedPined("");
        setPanicPin("");
        setDecoyPin("");
        
        getSecurePin("panic_pin").then(v => { setPanicPin(v); setSavedPined(v); });
        getSecurePin("decoy_pin").then(v => setDecoyPin(v));

        setBurnerChatsEnabled(localStorage.getItem("red_burner_chats") === "true");
        if (localStorage.getItem("red_burner_chats") === "true") {
            import("../lib/api").then(({ RedAPI }) => RedAPI.setBurnerMode(true));
        }

        const disguise = localStorage.getItem("red_disguise_mode") === "true";
        setDisguiseEnabled(disguise);
        getSecurePin("calc_pin").then(v => setCalcPin(v));

        applyPrivacyScreen(savedPrivacy);
    }, []);

    const applyPrivacyScreen = async (enabled: boolean) => {
        try {
            const { Capacitor, registerPlugin } = await import("@capacitor/core");
            if (Capacitor.isNativePlatform()) {
                const PrivacyScreen = registerPlugin<any>("PrivacyScreen");
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

    const handleSavePanicPin = async () => {
        if (!panicPin || panicPin.length < 4) {
            toast.error("El PIN de pánico debe tener al menos 4 dígitos");
            return;
        }
        await setSecurePin("panic_pin", panicPin);
        setSavedPined(panicPin);
        toast.success("🔥 PIN de pánico guardado en Android Keystore");
    };

    const handleClearPanicPin = async () => {
        await SecureStoragePlugin.remove({ key: "panic_pin" }).catch(() => {});
        setPanicPin("");
        setSavedPined("");
        toast.info("PIN de pánico desactivado");
    };

    const handleSaveDecoyPin = async () => {
        if (!decoyPin || decoyPin.length < 4) {
            toast.error("El PIN señuelo debe tener al menos 4 dígitos");
            return;
        }
        await setSecurePin("decoy_pin", decoyPin);
        toast.success("🎭 Bóveda señuelo configurada en Keystore");
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
            toast.warning("Camuflaje activado: La app iniciará como calculadora estándar");
        } else {
            toast.info("Camuflaje desactivado");
        }
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
                            ANDROID KEYSTORE · HARDWARE ENCLAVE · ANTI-FORENSIC
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

            {/* Contenido Principal con Scroll Seguro */}
            <div className="scroll-container" style={{ flex: 1, padding: "16px 16px 80px 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>

                    {/* Acciones Rápidas Superiores */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <button
                            onClick={() => setReportModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>📋</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-cyan)" }}>Auditoría Forense</span>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Informe de seguridad & IA</span>
                        </button>

                        <button
                            onClick={() => setBackupModalOpen(true)}
                            className="card-tactical-interactive"
                            style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "4px" }}
                        >
                            <span style={{ fontSize: "1.2rem" }}>💾</span>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-emerald)" }}>Bóveda de Respaldo</span>
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Cifrado AES-256-GCM</span>
                        </button>
                    </div>

                    {/* 1. Protección contra Capturas de Pantalla */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

                    {/* 2. Camuflaje de Calculadora Fotorrealista */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-primary-hover)" }}>
                                Camuflaje Anti-Inspección (Calculadora)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Inicia una calculadora señuelo. Teclea tu PIN + "=" para entrar
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={disguiseEnabled}
                            onChange={e => toggleDisguise(e.target.checked)}
                            style={{ width: "22px", height: "22px", accentColor: "var(--accent-amber)" }}
                        />
                    </div>

                    {/* 3. Burner Chats (RAM-Only) */}
                    <div className="card-tactical animate-enter" style={{ padding: "18px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-amber)" }}>
                                Modo Burner (Solo Memoria RAM)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                No escribe mensajes en disco flash. Se destruyen al cerrar la app
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={burnerChatsEnabled}
                            onChange={e => toggleBurnerChats(e.target.checked)}
                            style={{ width: "22px", height: "22px", accentColor: "var(--accent-amber)" }}
                        />
                    </div>

                    {/* 4. PIN de Pánico / Destrucción Total */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "12px", borderLeft: "4px solid var(--accent-crimson)" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-crimson-bright)" }}>
                                🔥 PIN de Pánico (Wipe Inmediato)
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
                                style={{ flex: 1, fontSize: "0.90rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSavePanicPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.82rem", background: "linear-gradient(135deg, #FF3355 0%, #E8213A 100%)" }}
                            >
                                Guardar
                            </button>
                            {savedPined && (
                                <button
                                    onClick={handleClearPanicPin}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "10px 14px", fontSize: "0.82rem" }}
                                >
                                    Desactivar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 5. Bóveda Señuelo (Decoy Vault) */}
                    <div className="card-tactical animate-enter" style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "12px", borderLeft: "4px solid var(--accent-purple, #B388FF)" }}>
                        <div>
                            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--accent-purple, #B388FF)" }}>
                                🎭 PIN de Bóveda Señuelo (Decoy Vault)
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                Si te obligan a desbloquear bajo coacción, ingresa este PIN para abrir una sesión con chats falsos inofensivos
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px" }}>
                            <input
                                type="password"
                                value={decoyPin}
                                onChange={e => setDecoyPin(e.target.value)}
                                placeholder="Configurar PIN señuelo..."
                                style={{ flex: 1, fontSize: "0.90rem", fontFamily: "JetBrains Mono, monospace" }}
                            />
                            <button
                                onClick={handleSaveDecoyPin}
                                className="btn-tactical-primary"
                                style={{ padding: "10px 18px", fontSize: "0.82rem", background: "linear-gradient(135deg, #7C4DFF 0%, #5E35B1 100%)" }}
                            >
                                Guardar
                            </button>
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
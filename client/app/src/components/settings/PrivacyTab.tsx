import React, { useState, useEffect } from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    AutoDestructTimer,
    SettingsManager,
} from "../../lib/settingsManager";
import { BiometricLockEngine, BiometricTimeout } from "../../lib/crypto/BiometricLockEngine";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

export const PrivacyTab: React.FC = () => {
    const { preferences, updatePreferences, navigate } = useRedStore();
    const { t } = useTranslation();
    const [, forceUpdate] = useState({});
    const [bioHardware, setBioHardware] = useState<{ isAvailable: boolean; biometryType: string }>({
        isAvailable: false,
        biometryType: "Verificando...",
    });

    useEffect(() => {
        BiometricLockEngine.checkAvailability().then((res) => {
            setBioHardware(res);
        });
    }, []);

    const bioStatus = BiometricLockEngine.getStatus();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                    {t.settings?.tab_privacy || "Protocolos de Privacidad & Autoprotección"}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {t.security_panel?.subtitle || "Control de fugas visuales, efimeridad de datos y llaves biométricas de hardware."}
                </p>
            </div>

            {/* Bloqueo Biométrico & Bóveda */}
            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>🛡️</span> {t.settings?.autolock_title || "Bloqueo Biométrico / Passkeys"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", marginTop: "2px", fontWeight: 700 }}>
                            Hardware: {bioHardware.biometryType}
                        </div>
                        <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", marginTop: "1px" }}>
                            Desbloqueo rápido mediante huella dactilar, Face ID, iris o Windows Hello.
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={bioStatus.isEnabled}
                        disabled={!bioHardware.isAvailable}
                        onChange={(e) => {
                            SettingsManager.triggerHaptic("medium");
                            BiometricLockEngine.setEnabled(e.target.checked);
                            forceUpdate({});
                            toast.info(e.target.checked ? "🔒 Bloqueo biométrico activado" : "Bloqueo biométrico desactivado");
                        }}
                        style={{ width: 22, height: 22, accentColor: "var(--accent-cyan)" }}
                    />
                </div>

                {bioStatus.isEnabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--glass-border)", paddingTop: "10px" }}>
                        {/* Auto-Prompt Toggle */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>
                                    Auto-disparar sensor al abrir la app
                                </div>
                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                    Desactívalo si estás en una zona de riesgo para requerir PIN manual (Anti-Coacción).
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={bioStatus.autoPrompt}
                                onChange={(e) => {
                                    BiometricLockEngine.setAutoPrompt(e.target.checked);
                                    forceUpdate({});
                                    toast.info(e.target.checked ? "Auto-prompt activado" : "Auto-prompt desactivado (Solo PIN táctico)");
                                }}
                                style={{ width: 18, height: 18, accentColor: "var(--accent-cyan)" }}
                            />
                        </div>

                        {/* Inactivity Timeout Selector */}
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>TIEMPO DE INACTIVIDAD PARA BLOQUEO:</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                            {[
                                { id: "immediate", label: "Inmediato" },
                                { id: "1m", label: "1 Min" },
                                { id: "5m", label: "5 Min" },
                                { id: "15m", label: "15 Min" },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        BiometricLockEngine.setTimeout(t.id as BiometricTimeout);
                                        SettingsManager.triggerHaptic("light");
                                        forceUpdate({});
                                    }}
                                    className={`btn-tactical-pill ${bioStatus.timeout === t.id ? "active" : ""}`}
                                    style={{ padding: "6px 2px", fontSize: "0.68rem" }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Privacy Screen */}
            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Pantalla Anti-Espía (Privacy Screen)</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Bloquea capturas de pantalla y oculta la vista previa en el menú de aplicaciones recientes.
                    </div>
                </div>
                <input
                    type="checkbox"
                    checked={preferences.privacyScreen}
                    onChange={(e) => {
                        SettingsManager.triggerHaptic("medium");
                        updatePreferences({ privacyScreen: e.target.checked });
                        toast.info(e.target.checked ? "🛡️ Privacy Screen activado" : "Privacy Screen desactivado");
                    }}
                    style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                />
            </div>

            {/* Autodestrucción Predeterminada */}
            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Temporizador de Autodestrucción Predeterminado</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Tiempo de vida asignado automáticamente a los nuevos mensajes directos.
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                    {(["off", "5m", "1h", "24h", "7d"] as AutoDestructTimer[]).map((timer) => {
                        const isSelected = preferences.autoDestructDefault === timer;
                        return (
                            <button
                                key={timer}
                                onClick={() => {
                                    SettingsManager.triggerHaptic("light");
                                    updatePreferences({ autoDestructDefault: timer });
                                }}
                                className={`btn-tactical-pill ${isSelected ? "active" : ""}`}
                                style={{ padding: "8px 4px", fontSize: "0.72rem", textTransform: "uppercase" }}
                            >
                                {timer === "off" ? "Off" : timer}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Enlaces de Seguridad Avanzada */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                    onClick={() => navigate("calculator")}
                    className="btn-tactical-secondary"
                    style={{ padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.78rem" }}
                >
                    <span>🧮</span> Calculadora Señuelo
                </button>
                <button
                    onClick={() => navigate("secReport")}
                    className="btn-tactical-secondary"
                    style={{ padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.78rem" }}
                >
                    <span>📑</span> Reporte de Seguridad
                </button>
            </div>
        </div>
    );
};

import React, { useState } from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    AutoDestructTimer,
    SettingsManager,
} from "../../lib/settingsManager";
import { BiometricLockEngine, BiometricTimeout } from "../../lib/BiometricLockEngine";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

export const PrivacyTab: React.FC = () => {
    const { preferences, updatePreferences, navigate } = useRedStore();
    const { t } = useTranslation();
    const [, forceUpdate] = useState({});

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Protocolos de Privacidad & Autoprotección
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Control de fugas visuales, efimeridad de datos y herramientas de coacción.
                            </p>
                        </div>

                        {/* Bloqueo Biométrico & Bóveda */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Bloqueo Biométrico / PIN de Bóveda</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Requiere huella dactilar, Face ID o PIN para acceder a la aplicación tras inactividad.
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={BiometricLockEngine.getStatus().isEnabled}
                                    onChange={(e) => {
                                        SettingsManager.triggerHaptic("medium");
                                        BiometricLockEngine.setEnabled(e.target.checked);
                                        toast.info(e.target.checked ? "🔒 Bloqueo biométrico activado" : "Bloqueo desactivado");
                                    }}
                                    style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                                />
                            </div>

                            {BiometricLockEngine.getStatus().isEnabled && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid var(--glass-border)", paddingTop: "10px" }}>
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
                                                }}
                                                className={`btn-tactical-pill ${BiometricLockEngine.getStatus().timeout === t.id ? "active" : ""}`}
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

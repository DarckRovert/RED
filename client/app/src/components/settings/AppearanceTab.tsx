import React from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    TACTICAL_THEMES,
    TacticalThemeId,
    FontSizeScale,
    SettingsManager,
} from "../../lib/settingsManager";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

export const AppearanceTab: React.FC = () => {
    const { preferences, updatePreferences } = useRedStore();
    const { lang, langMode, setLanguage, t, langInfo, allLanguages } = useTranslation();

    const handleThemeChange = (id: TacticalThemeId) => {
        SettingsManager.triggerHaptic("medium");
        updatePreferences({ themeId: id });
        toast.info(`Tema cambiado: ${TACTICAL_THEMES[id].name}`);
    };

    const handleFontSizeChange = (size: FontSizeScale) => {
        SettingsManager.triggerHaptic("light");
        updatePreferences({ fontSize: size });
    };

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Paleta Táctica de Color (Theme Accent)
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Modifica el acento cromático, resplandores y burbujas de cifrado en tiempo real.
                            </p>
                        </div>

                        {/* Grid de Temas */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
                            {Object.values(TACTICAL_THEMES).map((theme) => {
                                const isSelected = preferences.themeId === theme.id;
                                return (
                                    <div
                                        key={theme.id}
                                        onClick={() => handleThemeChange(theme.id)}
                                        className="card-tactical-interactive"
                                        style={{
                                            padding: "12px",
                                            display: "flex", flexDirection: "column", gap: "8px",
                                            border: isSelected ? `2px solid ${theme.primary}` : "1px solid var(--glass-border)",
                                            background: isSelected ? "rgba(255,255,255,0.06)" : "var(--glass-bg)",
                                            boxShadow: isSelected ? `0 0 16px ${theme.primaryGlow}` : "none"
                                        }}
                                    >
                                        <div style={{
                                            height: "36px", borderRadius: "8px",
                                            background: theme.previewGradient,
                                            display: "flex", alignItems: "center", justifyContent: "flex-end",
                                            padding: "6px"
                                        }}>
                                            {isSelected && (
                                                <span style={{
                                                    width: 18, height: 18, borderRadius: "50%",
                                                    background: "#fff", color: "#000",
                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                    fontSize: "0.70rem", fontWeight: 900
                                                }}>
                                                    ✓
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff" }}>
                                                {theme.name}
                                            </div>
                                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.2 }}>
                                                {theme.description}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <hr style={{ borderColor: "var(--glass-border)", margin: "4px 0" }} />

                        {/* Escala de Tipografía */}
                        <div>
                            <h4 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Escala Tipográfica & Densidad
                            </h4>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "8px" }}>
                                {(["compact", "normal", "large"] as FontSizeScale[]).map((scale) => {
                                    const labels = { compact: "Compacta (14px)", normal: "Estándar (16px)", large: "Amplia (18px)" };
                                    const isSelected = preferences.fontSize === scale;
                                    return (
                                        <button
                                            key={scale}
                                            onClick={() => handleFontSizeChange(scale)}
                                            className={`btn-tactical-pill ${isSelected ? "active" : ""}`}
                                            style={{ padding: "10px 8px", fontSize: "0.76rem" }}
                                        >
                                            {labels[scale]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Toggles de Apariencia */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Modo OLED Negro Absoluto (#000000)</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Apaga los píxeles en pantallas AMOLED para mínimo consumo.
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={preferences.pureOled}
                                    onChange={(e) => {
                                        SettingsManager.triggerHaptic("light");
                                        updatePreferences({ pureOled: e.target.checked });
                                    }}
                                    style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                                />
                            </div>

                            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Reducir Animaciones / Ahorro GPU</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Desactiva transiciones complejas para acelerar la interfaz en hardware limitado.
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={preferences.reducedMotion}
                                    onChange={(e) => {
                                        SettingsManager.triggerHaptic("light");
                                        updatePreferences({ reducedMotion: e.target.checked });
                                    }}
                                    style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                                />
                            </div>
                        </div>
                    </div>

    );
};

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

    const handleLanguageChange = (selectedMode: 'auto' | typeof allLanguages[number]['id']) => {
        SettingsManager.triggerHaptic("medium");
        setLanguage(selectedMode);
        const name = selectedMode === 'auto' ? t('settings.auto_detect') : (allLanguages.find(l => l.id === selectedMode)?.nativeName || selectedMode);
        toast.success(`🌐 ${name}`);
    };

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        {/* ── SECCIÓN 1: IDIOMA DEL SISTEMA & LOCALIZACIÓN ── */}
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>🌐</span> {t('settings.language_title')}
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {t('settings.language_desc')}
                            </p>
                        </div>

                        {/* Botón Modo Automático */}
                        <div
                            onClick={() => handleLanguageChange('auto')}
                            className="card-tactical-interactive"
                            style={{
                                padding: "14px 16px",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                border: langMode === 'auto' ? "2px solid var(--accent-cyan, #00E5FF)" : "1px solid var(--glass-border)",
                                background: langMode === 'auto' ? "rgba(0, 229, 255, 0.08)" : "var(--glass-bg)",
                                boxShadow: langMode === 'auto' ? "0 0 16px rgba(0, 229, 255, 0.2)" : "none",
                                cursor: "pointer", borderRadius: "14px"
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <span style={{ fontSize: "1.4rem" }}>🤖</span>
                                <div>
                                    <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span>{t('settings.auto_detect')}</span>
                                        {langMode === 'auto' && (
                                            <span style={{ fontSize: "0.62rem", padding: "2px 6px", borderRadius: "6px", background: "rgba(0, 229, 255, 0.2)", color: "var(--accent-cyan)", fontWeight: 900, fontFamily: "JetBrains Mono, monospace" }}>
                                                {langInfo.flag} {langInfo.nativeName}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        {t('settings.auto_detect_sub')}
                                    </div>
                                </div>
                            </div>
                            {langMode === 'auto' && (
                                <span style={{
                                    width: 22, height: 22, borderRadius: "50%",
                                    background: "var(--accent-cyan)", color: "#000",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "0.75rem", fontWeight: 900
                                }}>
                                    ✓
                                </span>
                            )}
                        </div>

                        {/* Grid de 12 Idiomas Nativos */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                            {allLanguages.map((l) => {
                                const isSelected = langMode === l.id;
                                return (
                                    <div
                                        key={l.id}
                                        onClick={() => handleLanguageChange(l.id)}
                                        className="card-tactical-interactive"
                                        style={{
                                            padding: "10px 12px",
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            border: isSelected ? "2px solid var(--accent-emerald, #00E676)" : "1px solid var(--glass-border)",
                                            background: isSelected ? "rgba(0, 230, 118, 0.08)" : "var(--glass-bg)",
                                            boxShadow: isSelected ? "0 0 14px rgba(0, 230, 118, 0.25)" : "none",
                                            cursor: "pointer", borderRadius: "12px",
                                            transition: "all 0.15s ease"
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
                                            <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{l.flag}</span>
                                            <div style={{ minWidth: 0, overflow: "hidden" }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {l.nativeName}
                                                </div>
                                                <div style={{ fontSize: "0.64rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {l.name}
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <span style={{
                                                width: 18, height: 18, borderRadius: "50%",
                                                background: "#00E676", color: "#000",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                fontSize: "0.70rem", fontWeight: 900, flexShrink: 0
                                            }}>
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <hr style={{ borderColor: "var(--glass-border)", margin: "4px 0" }} />

                        {/* ── SECCIÓN 2: PALETA TÁCTICA DE COLOR ── */}
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>🎨</span> {t('settings.theme_title')}
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {t('settings.theme_desc')}
                            </p>
                        </div>

                        {/* Grid de Temas Tácticos Militares */}
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
                                            boxShadow: isSelected ? `0 0 16px ${theme.primaryGlow}` : "none",
                                            borderRadius: "14px"
                                        }}
                                    >
                                        <div style={{
                                            height: "36px", borderRadius: "8px",
                                            background: theme.id === 'custom'
                                                ? `linear-gradient(135deg, ${preferences.customPrimaryColor || '#E8213A'} 0%, ${preferences.customAccentColor || '#00E5FF'} 100%)`
                                                : theme.previewGradient,
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

                        {/* ── SECCIÓN 2.1: PERSONALIZADOR TÁCTICO DE COLOR (CUSTOM BUILDER) ── */}
                        {preferences.themeId === 'custom' && (
                            <div className="card-tactical" style={{
                                padding: "16px",
                                borderRadius: "14px",
                                border: "1.5px solid var(--accent-primary, #E8213A)",
                                background: "linear-gradient(135deg, rgba(232,33,58,0.08) 0%, rgba(0,229,255,0.05) 100%)",
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                                animation: "fadeIn 0.2s ease"
                            }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#FFF", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span>🎛️</span>
                                        <span>{t('settings.custom_theme_title')}</span>
                                    </div>
                                    <span className="badge-tactical" style={{ fontSize: "0.65rem", fontWeight: 900, background: "var(--primary)", color: "#FFF" }}>
                                        {t('settings.custom_live_badge')}
                                    </span>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    {/* Color Primario */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <label style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                                            {t('settings.custom_primary_color')}
                                        </label>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <input
                                                type="color"
                                                value={preferences.customPrimaryColor || "#E8213A"}
                                                onChange={(e) => {
                                                    updatePreferences({ customPrimaryColor: e.target.value });
                                                }}
                                                style={{ width: 38, height: 38, border: "none", borderRadius: "8px", cursor: "pointer", background: "none" }}
                                            />
                                            <span style={{ fontSize: "0.78rem", fontFamily: "JetBrains Mono, monospace", color: "#FFF", fontWeight: 700 }}>
                                                {preferences.customPrimaryColor || "#E8213A"}
                                            </span>
                                        </div>
                                        {/* Quick Color Dots */}
                                        <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                                            {["#E8213A", "#FF6B00", "#D4A373", "#00E676", "#00D2FF", "#E040FB"].map(c => (
                                                <div
                                                    key={c}
                                                    onClick={() => updatePreferences({ customPrimaryColor: c })}
                                                    style={{ width: 16, height: 16, borderRadius: "50%", background: c, cursor: "pointer", border: "1px solid rgba(255,255,255,0.4)" }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Color Secundario / Acento */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                        <label style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: 700 }}>
                                            {t('settings.custom_accent_color')}
                                        </label>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <input
                                                type="color"
                                                value={preferences.customAccentColor || "#00E5FF"}
                                                onChange={(e) => {
                                                    updatePreferences({ customAccentColor: e.target.value });
                                                }}
                                                style={{ width: 38, height: 38, border: "none", borderRadius: "8px", cursor: "pointer", background: "none" }}
                                            />
                                            <span style={{ fontSize: "0.78rem", fontFamily: "JetBrains Mono, monospace", color: "#FFF", fontWeight: 700 }}>
                                                {preferences.customAccentColor || "#00E5FF"}
                                            </span>
                                        </div>
                                        {/* Quick Color Dots */}
                                        <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                                            {["#00E5FF", "#00FF66", "#FFD600", "#FF4081", "#7C4DFF", "#FFFFFF"].map(c => (
                                                <div
                                                    key={c}
                                                    onClick={() => updatePreferences({ customAccentColor: c })}
                                                    style={{ width: 16, height: 16, borderRadius: "50%", background: c, cursor: "pointer", border: "1px solid rgba(255,255,255,0.4)" }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <hr style={{ borderColor: "var(--glass-border)", margin: "4px 0" }} />

                        {/* Escala de Tipografía */}
                        <div>
                            <h4 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                {t('settings.font_scale_title')}
                            </h4>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "8px" }}>
                                {(["compact", "normal", "large"] as FontSizeScale[]).map((scale) => {
                                    const labels = { 
                                        compact: t('settings.font_compact'), 
                                        normal: t('settings.font_normal'), 
                                        large: t('settings.font_large') 
                                    };
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
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>{t('settings.oled_mode_title')}</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        {t('settings.oled_mode_desc')}
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
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>{t('settings.reduced_motion_title')}</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        {t('settings.reduced_motion_desc')}
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

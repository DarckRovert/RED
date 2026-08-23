import React from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    SettingsManager,
} from "../../lib/settingsManager";
import { CallRingtoneEngine, RINGTONE_OPTIONS, RingtoneType } from "../../lib/CallRingtoneEngine";
import { TacticalAudioEngine } from "../../lib/TacticalAudioEngine";
import { useTranslation } from "../../lib/i18n/i18nEngine";

export const AudioTab: React.FC = () => {
    const { preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                {t.settings?.tab_audio || "Retroalimentación Acústica & Tonos de Alerta"}
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {t.settings?.ringtone_desc || "Personaliza los timbres de llamada sintetizados en tiempo real mediante Web Audio API."}
                            </p>
                        </div>

                        {/* Selector de Tonos de Llamada */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>
                                {t.settings?.ringtone_title || "Tono de Llamada Entrante"}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {RINGTONE_OPTIONS.map((tone) => {
                                    const isSelected = (preferences.ringtoneType || "tactical-alpha") === tone.id;
                                    return (
                                        <div
                                            key={tone.id}
                                            onClick={() => {
                                                SettingsManager.triggerHaptic("light");
                                                updatePreferences({ ringtoneType: tone.id });
                                                CallRingtoneEngine.playPreview(tone.id);
                                            }}
                                            className="card-tactical-interactive"
                                            style={{
                                                padding: "10px 14px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                border: isSelected ? "1px solid var(--accent-cyan)" : "1px solid var(--glass-border)",
                                                background: isSelected ? "rgba(0,229,255,0.06)" : "transparent"
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: isSelected ? "var(--accent-cyan)" : "#fff" }}>
                                                    {tone.name}
                                                </div>
                                                <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                                    {tone.description}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    CallRingtoneEngine.playPreview(tone.id);
                                                }}
                                                className="btn-tactical-secondary"
                                                style={{ padding: "4px 10px", fontSize: "0.70rem" }}
                                            >
                                                ▶ Probar
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Toggles de Audio */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Vibración Háptica Táctica</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Micro-pulsos de vibración en botones y mensajes.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.hapticsEnabled}
                                onChange={(e) => {
                                    updatePreferences({ hapticsEnabled: e.target.checked });
                                    if (e.target.checked) SettingsManager.triggerHaptic("heavy");
                                }}
                                style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                            />
                        </div>

                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Efectos de Sonido en Mensajes</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Tonos al enviar y recibir paquetes en la malla.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.soundsEnabled}
                                onChange={(e) => {
                                    SettingsManager.triggerHaptic("light");
                                    updatePreferences({ soundsEnabled: e.target.checked });
                                }}
                                style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                            />
                        </div>

                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--accent-crimson)" }}>Sirena Acústica SOS</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Alarma de alta intensidad ante balizas de socorro.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.sosSirenEnabled}
                                onChange={(e) => {
                                    SettingsManager.triggerHaptic("warning");
                                    updatePreferences({ sosSirenEnabled: e.target.checked });
                                }}
                                style={{ width: 22, height: 22, accentColor: "var(--accent-crimson)" }}
                            />
                        </div>
                    </div>

    );
};

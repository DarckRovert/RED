import React from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    VideoCallQuality,
    SettingsManager,
} from "../../lib/settingsManager";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

export const CallsTab: React.FC = () => {
    const { preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Parámetros de Voz & Videollamadas WebRTC P2P
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Calidad de video adaptativa, códecs de audio y servidores de enlace STUN.
                            </p>
                        </div>

                        {/* Calidad de Video */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Resolución de Cámara en Videollamadas</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Ajusta la resolución de captura en caliente para equilibrar nitidez y ancho de banda.
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                {[
                                    { id: "hd720p", label: "720p HD", desc: "1280x720 30fps" },
                                    { id: "sd480p", label: "480p Estándar", desc: "640x480 24fps (Recomendado)" },
                                    { id: "eco360p", label: "360p Eco", desc: "480x360 20fps (Baja señal)" }
                                ].map((q) => {
                                    const isSelected = (preferences.videoQuality || "sd480p") === q.id;
                                    return (
                                        <button
                                            key={q.id}
                                            onClick={() => {
                                                SettingsManager.triggerHaptic("light");
                                                updatePreferences({ videoQuality: q.id as VideoCallQuality });
                                                toast.info(`Calidad de video: ${q.label}`);
                                            }}
                                            className={`btn-tactical-pill ${isSelected ? "active" : ""}`}
                                            style={{ padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}
                                        >
                                            <span style={{ fontSize: "0.76rem", fontWeight: 800 }}>{q.label}</span>
                                            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{q.desc}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Cancelación de Ruido */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Supresión de Eco & Reducción de Ruido</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Filtra ruido ambiental y acoplamiento acústico en llamadas de voz.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.noiseSuppression ?? true}
                                onChange={(e) => {
                                    SettingsManager.triggerHaptic("light");
                                    updatePreferences({ noiseSuppression: e.target.checked });
                                }}
                                style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                            />
                        </div>

                        {/* Altavoz Automático */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Altavoz Automático en Videollamadas</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Enruta el audio directamente al altavoz principal al iniciar o contestar videollamadas.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.autoSpeakerVideo ?? true}
                                onChange={(e) => {
                                    SettingsManager.triggerHaptic("light");
                                    updatePreferences({ autoSpeakerVideo: e.target.checked });
                                }}
                                style={{ width: 22, height: 22, accentColor: "var(--primary)" }}
                            />
                        </div>

                        {/* Servidor STUN Personalizado */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Servidor STUN Personalizado</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Servidor para descubrimiento NAT en videollamadas P2P a través de Internet.
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <input
                                    type="text"
                                    placeholder="stun:stun.l.google.com:19302"
                                    value={preferences.customStunServer || ""}
                                    onChange={(e) => updatePreferences({ customStunServer: e.target.value })}
                                    style={{
                                        flex: 1,
                                        padding: "8px 12px",
                                        background: "rgba(0,0,0,0.4)",
                                        border: "1px solid var(--glass-border)",
                                        borderRadius: "6px",
                                        color: "#fff",
                                        fontSize: "0.78rem",
                                        fontFamily: "monospace"
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        SettingsManager.triggerHaptic("light");
                                        toast.success("✅ Servidor STUN guardado");
                                    }}
                                    className="btn-tactical-pill active"
                                    style={{ padding: "8px 14px", fontSize: "0.75rem" }}
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>

    );
};

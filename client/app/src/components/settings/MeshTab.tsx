import React from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    MeshPowerProfile,
    SettingsManager,
} from "../../lib/settingsManager";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

export const MeshTab: React.FC = () => {
    const { preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                {t.settings?.tab_mesh || "Parámetros de Red Mesh & Eficiencia Energética"}
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                {t.settings?.mesh_profile_desc || "Optimización del tráfico mDNS, BLE y perfiles de escaneo en operaciones de campo."}
                            </p>
                        </div>

                        {/* Perfil Energético */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>
                                    {t.settings?.mesh_profile || "Perfil de Descubrimiento de Pares"}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Frecuencia de escaneo BLE y descubrimiento de nodos cercanos.
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                {(["high", "balanced", "eco"] as MeshPowerProfile[]).map((prof) => {
                                    const labels = { high: "⚡ Alto Rendimiento", balanced: "⚖️ Equilibrado", eco: "🍃 Eco-Ahorro" };
                                    const isSelected = preferences.meshPowerProfile === prof;
                                    return (
                                        <button
                                            key={prof}
                                            onClick={() => {
                                                SettingsManager.triggerHaptic("light");
                                                updatePreferences({ meshPowerProfile: prof });
                                            }}
                                            className={`btn-tactical-pill ${isSelected ? "active" : ""}`}
                                            style={{ padding: "10px 6px", fontSize: "0.74rem" }}
                                        >
                                            {labels[prof]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Servidor de Señalización */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Servidor de Señalización & Relé Global (WebRTC)</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    URL del servidor de relé ciego para comunicación Web a Móvil por Internet.
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px" }}>
                                <input
                                    type="text"
                                    placeholder="wss://darckrovert.github.io:3001 ó ws://localhost:3001"
                                    value={preferences.signalingServerUrl || ""}
                                    onChange={(e) => updatePreferences({ signalingServerUrl: e.target.value })}
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
                                        toast.success("🌐 Servidor de señalización actualizado.");
                                    }}
                                    className="btn-tactical-pill active"
                                    style={{ padding: "8px 14px", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>

    );
};

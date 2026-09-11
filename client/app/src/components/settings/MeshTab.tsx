import React, { useState, useEffect } from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    MeshPowerProfile,
    SettingsManager,
} from "../../lib/settingsManager";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";
import { loraTdmaScheduler, TdmaSlotInfo, TdmaSchedulerMetrics } from "../../lib/mesh/LoRaTdmaSchedulerEngine";
import { GeohashSpatialRouting } from "../../lib/mesh/GeohashSpatialRouting";
import { TacticalLocationEngine } from "../../lib/sensors/TacticalLocationEngine";

export const MeshTab: React.FC = () => {
    const { preferences, updatePreferences } = useRedStore();
    const { t } = useTranslation();

    const [slotInfo, setSlotInfo] = useState<TdmaSlotInfo>(() => loraTdmaScheduler.getCurrentSlotInfo());
    const [tdmaMetrics, setTdmaMetrics] = useState<TdmaSchedulerMetrics>(() => loraTdmaScheduler.getMetrics());
    const [currentGeohash, setCurrentGeohash] = useState<string>("---");

    useEffect(() => {
        const interval = setInterval(() => {
            setSlotInfo(loraTdmaScheduler.getCurrentSlotInfo());
            setTdmaMetrics(loraTdmaScheduler.getMetrics());

            const loc = TacticalLocationEngine.getLastKnownLocation();
            if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number' && TacticalLocationEngine.isValidCoordinates(loc.lat, loc.lon)) {
                setCurrentGeohash(GeohashSpatialRouting.encode(loc.lat, loc.lon, 5));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, []);

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

            {/* Planificador TDMA LoRa & Poda Espacial Geohash */}
            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid rgba(16,185,129,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                        <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>📡 Planificador LoRa TDMA Ranurado & Poda Espacial</span>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                            Sincronización determinista de ranuras (200ms) para erradicar colisiones ALOHA y poda Geohash.
                        </div>
                    </div>
                    <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "4px", background: "rgba(16,185,129,0.15)", color: "#10b981", fontWeight: 700, fontFamily: "monospace" }}>
                        TDMA ACTIVO
                    </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", textAlign: "center" }}>
                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Ranura Activa</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: slotInfo.isMySlotActive ? "#10b981" : "#fff", fontFamily: "monospace" }}>
                            Slot {slotInfo.currentSlotIndex} / 10
                        </div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Ranura Asignada</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#38bdf8", fontFamily: "monospace" }}>
                            Slot {slotInfo.assignedSlotIndex}
                        </div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Cuadrante Geohash</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fbbf24", fontFamily: "monospace" }}>
                            {currentGeohash}
                        </div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Colisiones Evitadas</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#a855f7", fontFamily: "monospace" }}>
                            {tdmaMetrics.collisionsMitigated}
                        </div>
                    </div>
                </div>

                <div style={{ fontSize: "0.72rem", color: "#94a3b8", display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                    <span>Repetidores Autónomos Solares: <strong style={{ color: "#fff" }}>ESP32-S3 + SX1262</strong></span>
                    <span>Consumo en Reposo: <strong style={{ color: "#10b981" }}>&lt; 12 mA</strong></span>
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

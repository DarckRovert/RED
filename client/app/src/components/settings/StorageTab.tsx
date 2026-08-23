import React, { useState, useEffect } from "react";
import { useRedStore } from "../../store/useRedStore";
import {
    ImageCompressionQuality,
    SettingsManager,
} from "../../lib/settingsManager";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { toast } from "../Toast";

export const StorageTab: React.FC = () => {
    const { preferences, updatePreferences, contacts } = useRedStore();
    const { t } = useTranslation();

    const [storageMetrics, setStorageMetrics] = useState({
        totalKb: 0,
        messagesKb: 0,
        conversationsKb: 0,
        mediaKb: 0,
        contactsCount: 0,
        messagesCount: 0,
    });

    const calculateStorage = () => {
        if (typeof window === "undefined") return;
        try {
            let total = 0;
            let msgSize = 0;
            let convSize = 0;
            let mediaSize = 0;
            let totalMsgs = 0;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                const val = localStorage.getItem(key) || "";
                const byteLength = key.length + val.length;
                total += byteLength;

                if (key.startsWith("red_web_messages_") || key === "red_messages") {
                    msgSize += byteLength;
                    try {
                        const parsed = JSON.parse(val);
                        if (Array.isArray(parsed)) totalMsgs += parsed.length;
                    } catch {}
                } else if (key.startsWith("red_web_conversations") || key === "red_conversations") {
                    convSize += byteLength;
                } else if (key.includes("media") || key.includes("stories") || key.includes("bursts")) {
                    mediaSize += byteLength;
                }
            }

            setStorageMetrics({
                totalKb: Math.round(total / 1024),
                messagesKb: Math.round(msgSize / 1024),
                conversationsKb: Math.round(convSize / 1024),
                mediaKb: Math.round(mediaSize / 1024),
                contactsCount: (contacts || []).length,
                messagesCount: totalMsgs,
            });
        } catch {}
    };

    useEffect(() => {
        calculateStorage();
    }, []);

    const handlePurgeMediaCache = () => {
        SettingsManager.triggerHaptic("warning");
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith("red_peer_stories") || key.startsWith("red_voice_bursts") || key.startsWith("red_channel_messages"))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            calculateStorage();
            toast.success("🧹 Caché temporal de medios y canales liberada.");
        } catch {
            toast.error("Error al purgar la caché de medios.");
        }
    };

    const formatBytes = (bytes: number): string => {
        if (!bytes || bytes <= 0) return "0 MB";
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Uso de Almacenamiento & Gestión de Caché
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Diagnóstico en tiempo real de la base de datos cifrada local en el dispositivo.
                            </p>
                        </div>

                        {/* Métricas de Almacenamiento */}
                        <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>ESPACIO TOTAL EN BÓVEDA LOCAL</div>
                                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                        {storageMetrics.totalKb} KB
                                    </div>
                                </div>
                                <button
                                    onClick={calculateStorage}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "6px 12px", fontSize: "0.72rem" }}
                                >
                                    🔄 Recalcular
                                </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "8px" }}>
                                <div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Mensajes & Conversaciones</div>
                                    <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {storageMetrics.messagesKb + storageMetrics.conversationsKb} KB ({storageMetrics.messagesCount} msgs)
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Medios & Canales Temporales</div>
                                    <div style={{ fontSize: "0.90rem", fontWeight: 800, color: "var(--accent-amber)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {storageMetrics.mediaKb} KB
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Compresión de Imágenes */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Calidad de Compresión de Imágenes</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Reduce las fotos antes de emitirlas por canales de radio de baja velocidad.
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                {[
                                    { id: "low", label: "Ligera (800px)", desc: "Ideal para BLE/LoRa" },
                                    { id: "medium", label: "Media (1024px)", desc: "Estándar P2P" },
                                    { id: "high", label: "Alta (1600px)", desc: "Máxima resolución" },
                                ].map((opt) => {
                                    const isSelected = preferences.imageCompression === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                SettingsManager.triggerHaptic("light");
                                                updatePreferences({ imageCompression: opt.id as ImageCompressionQuality });
                                            }}
                                            className={`btn-tactical-pill ${isSelected ? "active" : ""}`}
                                            style={{ padding: "8px 4px", fontSize: "0.74rem" }}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Botón de Purga */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--accent-crimson)" }}>Limpiar Caché de Medios</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Elimina historias temporales y audios antiguos sin borrar tus contactos ni chats.
                                </div>
                            </div>
                            <button
                                onClick={handlePurgeMediaCache}
                                className="btn-tactical-secondary"
                                style={{ padding: "8px 14px", fontSize: "0.75rem", color: "var(--accent-crimson)", borderColor: "rgba(232,33,58,0.4)" }}
                            >
                                🧹 Purgar Caché
                            </button>
                        </div>
                    </div>

    );
};

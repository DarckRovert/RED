"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import {
    TACTICAL_THEMES,
    TacticalThemeId,
    FontSizeScale,
    AutoDestructTimer,
    MeshPowerProfile,
    ImageCompressionQuality,
    VideoCallQuality,
    SettingsManager,
} from "../lib/settingsManager";
import { CallRingtoneEngine, RINGTONE_OPTIONS, RingtoneType } from "../lib/CallRingtoneEngine";
import { BiometricLockEngine, BiometricTimeout } from "../lib/BiometricLockEngine";
import { UpdateManager, UpdateInfo, DownloadProgress } from "../lib/updateManager";
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME } from "../lib/version";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { SovereignBackupEngine } from "../lib/SovereignBackupEngine";
import { toast } from "./Toast";

type SettingsTab = "appearance" | "calls" | "audio" | "storage" | "privacy" | "mesh" | "identity" | "backup" | "updates";

interface SettingsModalProps {
    onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const { preferences, updatePreferences, goBack, navigate, identity, conversations, contacts } = useRedStore();
    const handleClose = onClose || goBack;

    const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

    // Estado del actualizador integrado
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [permissionNeeded, setPermissionNeeded] = useState(false);

    // Estado de medición de almacenamiento
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
        UpdateManager.checkInstallPermission().then(granted => {
            setPermissionNeeded(!granted);
        });
        calculateStorage();
    }, [activeTab]);

    const handleThemeChange = (id: TacticalThemeId) => {
        SettingsManager.triggerHaptic("medium");
        updatePreferences({ themeId: id });
        toast.info(`Tema cambiado: ${TACTICAL_THEMES[id].name}`);
    };

    const handleFontSizeChange = (size: FontSizeScale) => {
        SettingsManager.triggerHaptic("light");
        updatePreferences({ fontSize: size });
    };

    const handleCheckUpdates = async () => {
        SettingsManager.triggerHaptic("light");
        setCheckingUpdates(true);
        try {
            const info = await UpdateManager.checkForUpdates(true);
            setUpdateInfo(info);
            if (info.hasUpdate) {
                toast.success(`🚀 ¡Nueva versión disponible: v${info.latestVersion}!`);
            } else if (!info.error) {
                toast.info("✅ Tu nodo RED está al día.");
            }
        } catch (e: any) {
            toast.error(`Error al verificar actualizaciones: ${e.message}`);
        } finally {
            setCheckingUpdates(false);
        }
    };

    const handleDownloadAndInstall = async () => {
        if (!updateInfo?.apkUrl) return;
        SettingsManager.triggerHaptic("heavy");
        setDownloading(true);
        setDownloadProgress({
            progress: 0,
            receivedBytes: 0,
            totalBytes: updateInfo.apkSize || 0,
            speedKbps: 0,
            done: false,
        });

        try {
            await UpdateManager.downloadAndInstall(updateInfo.apkUrl, (prog) => {
                setDownloadProgress(prog);
                if (prog.error) {
                    toast.error(`Error: ${prog.error}`);
                    setDownloading(false);
                } else if (prog.done) {
                    toast.success("📦 Descarga completada. Abriendo instalador nativo...");
                    setDownloading(false);
                }
            });
        } catch (e: any) {
            toast.error(`Error de instalación: ${e.message || e}`);
            setDownloading(false);
        }
    };

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
        <div className="modal-screen-container" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--bg-void)", display: "flex", flexDirection: "column" }}>
            {/* Header Táctico Seguro */}
            <header className="safe-header" style={{
                height: "var(--header-h)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0 16px", borderBottom: "1px solid var(--glass-border)",
                background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                        onClick={handleClose}
                        className="btn-icon"
                        style={{ width: 38, height: 38, fontSize: "1.1rem" }}
                        title="Volver"
                    >
                        ←
                    </button>
                    <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#fff", letterSpacing: "0.4px" }}>
                            Ajustes & Configuración Soberana
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            MASTER CONFIGURATION HUB
                        </div>
                    </div>
                </div>

                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                    v{RED_VERSION}
                </div>
            </header>

            {/* Pestañas de Navegación de Ajustes */}
            <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "10px 16px", borderBottom: "1px solid var(--glass-border)",
                background: "rgba(10, 12, 22, 0.95)", overflowX: "auto", flexShrink: 0
            }}>
                {[
                    { id: "appearance", icon: "🎨", label: "Apariencia" },
                    { id: "calls", icon: "📞", label: "Llamadas & Video" },
                    { id: "audio", icon: "🔔", label: "Sonido & Tonos" },
                    { id: "storage", icon: "💾", label: "Almacenamiento" },
                    { id: "privacy", icon: "🛡️", label: "Privacidad" },
                    { id: "mesh", icon: "📡", label: "Malla & Batería" },
                    { id: "identity", icon: "🔑", label: "Identidad & Claves" },
                    { id: "backup", icon: "☁️", label: "Respaldo & Nube" },
                    { id: "updates", icon: "🚀", label: "Actualizador" },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { SettingsManager.triggerHaptic("light"); setActiveTab(tab.id as SettingsTab); }}
                        className={`btn-tactical-pill ${activeTab === tab.id ? "active" : ""}`}
                        style={{ whiteSpace: "nowrap", padding: "8px 12px", fontSize: "0.75rem" }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Contenido de la Pestaña Activa */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: "680px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* ── TAB 1: APARIENCIA & TEMAS TÁCTICOS ── */}
                {activeTab === "appearance" && (
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
                )}

                {/* ── TAB 2: LLAMADAS & WEBRTC ── */}
                {activeTab === "calls" && (
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
                )}

                {/* ── TAB 3: AUDIO & TONOS DE LLAMADA ── */}
                {activeTab === "audio" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Retroalimentación Acústica & Tonos de Alerta
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Personaliza los timbres de llamada sintetizados en tiempo real mediante Web Audio API.
                            </p>
                        </div>

                        {/* Selector de Tonos de Llamada */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>
                                Tono de Llamada Entrante
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
                )}

                {/* ── TAB 4: ALMACENAMIENTO & DATOS ── */}
                {activeTab === "storage" && (
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
                )}

                {/* ── TAB 5: PRIVACIDAD & SEGURIDAD ── */}
                {activeTab === "privacy" && (
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
                )}

                {/* ── TAB 6: MALLA & BATERÍA ── */}
                {activeTab === "mesh" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Parámetros de Red Mesh & Eficiencia Energética
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Optimización del tráfico mDNS, BLE y perfiles de escaneo en operaciones de campo.
                            </p>
                        </div>

                        {/* Perfil Energético */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Perfil de Descubrimiento de Pares</div>
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
                )}

                {/* ── TAB 7: IDENTIDAD & CLAVES ── */}
                {activeTab === "identity" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Identidad Criptográfica & Credenciales Soberanas
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Par de claves asimétricas de curva elíptica Curve25519 / Dilithium y DID Soberano.
                            </p>
                        </div>

                        <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>DID IDENTIFIER</div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>
                                    did:red:{identity?.identity_hash || "local"}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-muted)" }}>ALIAS DE OPERADOR</div>
                                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff" }}>
                                    {identity?.nickname || "Operador RED"}
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                <button
                                    onClick={() => {
                                        if (identity?.identity_hash) {
                                            navigator.clipboard.writeText(`did:red:${identity.identity_hash}`);
                                            SettingsManager.triggerHaptic("light");
                                            toast.success("📋 DID copiado al portapapeles");
                                        }
                                    }}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "8px 12px", fontSize: "0.75rem" }}
                                >
                                    Copiar DID Completo
                                </button>
                                <button
                                    onClick={() => navigate("idVault")}
                                    className="btn-tactical-pill active"
                                    style={{ padding: "8px 14px", fontSize: "0.75rem" }}
                                >
                                    Ver Bóveda de Claves ➔
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: RESPALDO SOBERANO & MULTI-NUBE ── */}
                {activeTab === "backup" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Respaldo & Nube Automática (Google Drive)
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Copias de seguridad automáticas en 1 toque, cifradas con AES-256-GCM y derivación de clave maestra.
                            </p>
                        </div>

                        {/* Card Principal con Estado en Vivo */}
                        {(() => {
                            const status = SovereignBackupEngine.getAutoBackupStatus();
                            return (
                                <div className="card-tactical" style={{
                                    padding: "18px",
                                    background: "linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(14,16,28,0.95) 100%)",
                                    border: "1px solid rgba(56, 189, 248, 0.35)",
                                    display: "flex", flexDirection: "column", gap: "14px"
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ fontSize: "1.6rem" }}>☁️</span>
                                            <div>
                                                <div style={{ fontSize: "1rem", fontWeight: 900, color: "#fff" }}>
                                                    {status.isProtected ? "Bóveda Protegida" : "Sin Respaldo Reciente"}
                                                </div>
                                                <div style={{ fontSize: "0.72rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                                    ÚLTIMA COPIA: {status.lastBackupFormatted}
                                                </div>
                                            </div>
                                        </div>

                                        <span className={`badge-tactical ${status.statusColor === "emerald" ? "badge-tactical-emerald" : (status.statusColor === "amber" ? "badge-tactical-amber" : "badge-tactical-crimson")}`} style={{ padding: "4px 10px", fontSize: "0.70rem" }}>
                                            {status.statusLabel}
                                        </span>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "rgba(0,0,0,0.35)", padding: "10px", borderRadius: "10px" }}>
                                        <div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>DESTINO AUTOMÁTICO</div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", marginTop: "2px" }}>Google Drive / Almacenamiento</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>CIFRADO SEGURO</div>
                                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--accent-emerald)", marginTop: "2px" }}>AES-256-GCM (Zero-Knowledge)</div>
                                        </div>
                                    </div>

                                    {/* Botón de 1-Toque Directo */}
                                    <button
                                        onClick={async () => {
                                            SettingsManager.triggerHaptic("medium");
                                            toast.info("Cifrando y enviando a Google Drive…");
                                            const res = await SovereignBackupEngine.createOneTouchBackup();
                                            if (res.success) {
                                                toast.success("✅ Respaldo guardado en Google Drive");
                                                TacticalAudioEngine.playMessageSent();
                                            } else {
                                                toast.error(res.error || "Error al respaldar");
                                            }
                                        }}
                                        className="btn-tactical-primary"
                                        style={{
                                            padding: "14px",
                                            fontSize: "0.88rem",
                                            fontWeight: 900,
                                            background: "linear-gradient(135deg, #1E88E5 0%, #1565C0 100%)",
                                            boxShadow: "0 4px 16px rgba(30, 136, 229, 0.45)",
                                            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                                        }}
                                    >
                                        <span>⚡</span> Respaldar a Google Drive en 1 Toque
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Switch de Auto-Sync */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>
                                    Sincronización Automática Inteligente
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Guarda copias en segundo plano cuando añades contactos o chats.
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={SovereignBackupEngine.getAutoBackupStatus().autoSyncEnabled}
                                onChange={(e) => {
                                    SettingsManager.triggerHaptic("light");
                                    SovereignBackupEngine.setAutoSyncEnabled(e.target.checked);
                                    toast.info(e.target.checked ? "Sincronización automática activada" : "Sincronización automática desactivada");
                                }}
                                style={{ width: 22, height: 22, accentColor: "var(--accent-cyan)", cursor: "pointer" }}
                            />
                        </div>

                        {/* Accesos Rápidos: Restaurar & Avanzado */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                            <button
                                onClick={() => {
                                    handleClose();
                                    navigate("backup");
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "12px", fontSize: "0.78rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            >
                                <span>📥</span> Restaurar Copia
                            </button>
                            <button
                                onClick={() => {
                                    handleClose();
                                    navigate("backup");
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "12px", fontSize: "0.78rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "var(--accent-indigo)" }}
                            >
                                <span>🌐</span> Web3 IPFS / Frase Semilla
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB 8: ACTUALIZADOR OTA INTEGRADO ── */}
                {activeTab === "updates" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Motor Autónomo de Actualizaciones OTA
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Detección semántica de versiones, descarga directa en streaming e instalación sin salir de la app.
                            </p>
                        </div>

                        <div className="card-tactical" style={{
                            padding: "18px",
                            background: updateInfo?.hasUpdate
                                ? "linear-gradient(135deg, rgba(232,33,58,0.15) 0%, rgba(14,16,28,0.85) 100%)"
                                : "linear-gradient(135deg, rgba(0,230,118,0.10) 0%, rgba(14,16,28,0.85) 100%)",
                            border: updateInfo?.hasUpdate ? "1px solid var(--primary-bright)" : "1px solid rgba(0,230,118,0.3)",
                            display: "flex", flexDirection: "column", gap: "12px"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "1.4rem" }}>{updateInfo?.hasUpdate ? "🚀" : "🛡️"}</span>
                                    <div>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#fff" }}>
                                            {updateInfo?.hasUpdate ? "Nueva Versión Disponible" : "Nodo RED Actualizado"}
                                        </div>
                                        <div style={{ fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                            Build Code: {RED_BUILD_CODE}
                                        </div>
                                    </div>
                                </div>
                                <span className={`badge-tactical ${updateInfo?.hasUpdate ? "badge-tactical-crimson" : "badge-tactical-emerald"}`} style={{ padding: "4px 10px" }}>
                                    {updateInfo?.hasUpdate ? "UPDATE DISPONIBLE" : "AL DÍA"}
                                </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "var(--radius-md)" }}>
                                <div>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>INSTALADA</div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>v{RED_VERSION}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>EN REPOSITORIO</div>
                                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: updateInfo?.hasUpdate ? "var(--primary-bright)" : "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                        v{updateInfo?.latestVersion || RED_VERSION}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Permiso de Instalación */}
                        {permissionNeeded && (
                            <div className="card-tactical" style={{ padding: "12px 14px", background: "rgba(255,179,0,0.10)", border: "1px solid rgba(255,179,0,0.4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                                <div style={{ fontSize: "0.78rem", color: "#fff" }}>
                                    Se requiere permiso para instalar paquetes desde RED.
                                </div>
                                <button
                                    onClick={() => UpdateManager.openInstallSettings()}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "6px 12px", fontSize: "0.72rem", flexShrink: 0 }}
                                >
                                    Conceder
                                </button>
                            </div>
                        )}

                        {/* Telemetría de Descarga en Vivo */}
                        {downloading && downloadProgress && (
                            <div className="card-tactical" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", border: "1px solid var(--accent-cyan)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.80rem", fontWeight: 800, color: "#fff" }}>Descargando APK en streaming...</span>
                                    <span style={{ fontSize: "0.80rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                        {(downloadProgress.progress * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden" }}>
                                    <div style={{
                                        width: `${Math.min(100, Math.max(0, downloadProgress.progress * 100))}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg, var(--primary) 0%, var(--accent-cyan) 100%)",
                                        transition: "width 0.2s ease-out"
                                    }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                    <span>{formatBytes(downloadProgress.receivedBytes)} / {formatBytes(downloadProgress.totalBytes)}</span>
                                    <span>{downloadProgress.speedKbps > 0 ? `${downloadProgress.speedKbps.toFixed(0)} KB/s` : "Conectando..."}</span>
                                </div>
                            </div>
                        )}

                        {/* Botones de Actualización */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {updateInfo?.hasUpdate ? (
                                <button
                                    onClick={handleDownloadAndInstall}
                                    disabled={downloading}
                                    className="btn-tactical-primary"
                                    style={{ padding: "14px", fontSize: "0.90rem", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                                >
                                    <span>📥</span>
                                    {downloading ? "Descargando Actualización..." : "Descargar e Instalar v" + updateInfo.latestVersion}
                                </button>
                            ) : (
                                <button
                                    onClick={handleCheckUpdates}
                                    disabled={checkingUpdates || downloading}
                                    className="btn-tactical-secondary"
                                    style={{ padding: "12px", fontSize: "0.85rem", fontWeight: 800 }}
                                >
                                    {checkingUpdates ? "Verificando Versión..." : "Buscar Actualizaciones"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

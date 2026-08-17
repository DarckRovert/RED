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
    SettingsManager,
} from "../lib/settingsManager";
import { UpdateManager, UpdateInfo, DownloadProgress } from "../lib/updateManager";
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME } from "../lib/version";
import { TacticalAudioEngine } from "../lib/TacticalAudioEngine";
import { toast } from "./Toast";

type SettingsTab = "appearance" | "audio" | "privacy" | "mesh" | "updates";

interface SettingsModalProps {
    onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const { preferences, updatePreferences, goBack, navigate } = useRedStore();
    const handleClose = onClose || goBack;

    const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

    // Estado del actualizador integrado
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [permissionNeeded, setPermissionNeeded] = useState(false);

    useEffect(() => {
        UpdateManager.checkInstallPermission().then(granted => {
            setPermissionNeeded(!granted);
        });
    }, []);

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
                            Ajustes & Personalización
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            TACTICAL CONFIGURATION HUB
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
                <button
                    onClick={() => { SettingsManager.triggerHaptic("light"); setActiveTab("appearance"); }}
                    className={`btn-tactical-pill ${activeTab === "appearance" ? "active" : ""}`}
                    style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "0.78rem" }}
                >
                    🎨 Apariencia
                </button>
                <button
                    onClick={() => { SettingsManager.triggerHaptic("light"); setActiveTab("audio"); }}
                    className={`btn-tactical-pill ${activeTab === "audio" ? "active" : ""}`}
                    style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "0.78rem" }}
                >
                    🔔 Sonido & Háptica
                </button>
                <button
                    onClick={() => { SettingsManager.triggerHaptic("light"); setActiveTab("privacy"); }}
                    className={`btn-tactical-pill ${activeTab === "privacy" ? "active" : ""}`}
                    style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "0.78rem" }}
                >
                    🛡️ Privacidad
                </button>
                <button
                    onClick={() => { SettingsManager.triggerHaptic("light"); setActiveTab("mesh"); }}
                    className={`btn-tactical-pill ${activeTab === "mesh" ? "active" : ""}`}
                    style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "0.78rem" }}
                >
                    📡 Malla & Batería
                </button>
                <button
                    onClick={() => { SettingsManager.triggerHaptic("light"); setActiveTab("updates"); }}
                    className={`btn-tactical-pill ${activeTab === "updates" ? "active" : ""}`}
                    style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: "0.78rem" }}
                >
                    🚀 Actualizador OTA
                </button>
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
                                Escala Tipográfica & Densidad de Información
                            </h4>
                            <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginBottom: "10px" }}>
                                Ajusta el tamaño de los textos y elementos para mayor campo de visión o máxima legibilidad.
                            </p>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
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

                        <hr style={{ borderColor: "var(--glass-border)", margin: "4px 0" }} />

                        {/* Toggles de Apariencia */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {/* Modo OLED Puro */}
                            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Modo OLED Negro Absoluto (#000000)</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Apaga los píxeles en pantallas AMOLED y desactiva desenfoques para mínimo consumo de batería.
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

                            {/* Reducir Animaciones */}
                            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div>
                                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Reducir Animaciones / Ahorro de GPU</div>
                                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                        Optimiza la tasa de cuadros en dispositivos con recursos limitados.
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

                {/* ── TAB 2: AUDIO & HÁPTICA ── */}
                {activeTab === "audio" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Retroalimentación Acústica y Háptica
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Configuración de respuestas sensoriales para operaciones tácticas.
                            </p>
                        </div>

                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Vibración Háptica Táctica</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Micro-pulsos de vibración en botones, teclado y confirmación de mensajes cifrados.
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
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Efectos de Sonido en Mensajería</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Tonos de baja frecuencia al recibir o despachar paquetes en la malla.
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
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "var(--accent-crimson)" }}>Sirena Acústica en Alertas SOS</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Emite sonido de máxima potencia al detectar una baliza SOS de emergencia en proximidad.
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

                        {/* Botones de Prueba Acústica */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
                            <button
                                onClick={() => {
                                    TacticalAudioEngine.playMessageSent();
                                    SettingsManager.triggerHaptic("light");
                                    toast.info("🔊 Tono de Envío Táctico");
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px", fontSize: "0.76rem" }}
                            >
                                📤 Probar Envío
                            </button>
                            <button
                                onClick={() => {
                                    TacticalAudioEngine.playMessageReceived();
                                    SettingsManager.triggerHaptic("medium");
                                    toast.info("📥 Tono de Recepción Táctico");
                                }}
                                className="btn-tactical-secondary"
                                style={{ padding: "10px", fontSize: "0.76rem" }}
                            >
                                📥 Probar Recepción
                            </button>
                        </div>
                    </div>
                )}

                {/* ── TAB 3: PRIVACIDAD & SEGURIDAD ── */}
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
                                    Tiempo de vida automático asignado a nuevos mensajes directos.
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

                {/* ── TAB 4: MALLA & BATERÍA ── */}
                {activeTab === "mesh" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>
                                Parámetros de Red Mesh & Eficiencia Energética
                            </h3>
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                Optimización del tráfico mDNS, BLE y compresión de paquetes en operaciones de campo.
                            </p>
                        </div>

                        {/* Perfil Energético */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Perfil de Descubrimiento de Pares</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Determina la frecuencia de balizas BLE y mDNS para descubrir nodos cercanos.
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

                        {/* Calidad de Compresión de Fotos */}
                        <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff" }}>Compresión de Multimedia en Malla</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                                    Comprime fotos antes de transmitirlas para minimizar tiempo de transferencia P2P.
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                                {(["low", "medium", "high"] as ImageCompressionQuality[]).map((q) => {
                                    const labels = { low: "Alta Res (Lento)", medium: "Balanceada", high: "Máx Ahorro" };
                                    const isSelected = preferences.imageCompression === q;
                                    return (
                                        <button
                                            key={q}
                                            onClick={() => {
                                                SettingsManager.triggerHaptic("light");
                                                updatePreferences({ imageCompression: q });
                                            }}
                                            className={`btn-tactical-pill ${isSelected ? "active" : ""}`}
                                            style={{ padding: "10px 6px", fontSize: "0.74rem" }}
                                        >
                                            {labels[q]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 5: ACTUALIZADOR OTA INTEGRADO ── */}
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

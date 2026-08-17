"use client";

import React, { useState, useEffect } from "react";
import { useRedStore } from "../store/useRedStore";
import { UpdateManager, UpdateInfo, DownloadProgress } from "../lib/updateManager";
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME } from "../lib/version";
import { toast } from "./Toast";
import { SettingsManager } from "../lib/settingsManager";

interface UpdateModalProps {
    onClose?: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ onClose }) => {
    const { goBack } = useRedStore();
    const handleClose = onClose || goBack;

    const [loading, setLoading] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [permissionNeeded, setPermissionNeeded] = useState(false);

    const checkUpdates = async (force = true) => {
        SettingsManager.triggerHaptic("light");
        setLoading(true);
        setPermissionNeeded(false);
        try {
            const info = await UpdateManager.checkForUpdates(force);
            setUpdateInfo(info);
            if (info.hasUpdate) {
                toast.success(`🚀 ¡Nueva versión disponible: v${info.latestVersion}!`);
            } else if (!info.error) {
                toast.info("✅ Tu nodo RED está ejecutando la versión más reciente.");
            }
        } catch (e: any) {
            toast.error(`Error al verificar actualizaciones: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkUpdates(false);
        UpdateManager.checkInstallPermission().then(granted => {
            setPermissionNeeded(!granted);
        });
    }, []);

    const handleStartDownloadAndInstall = async () => {
        if (!updateInfo?.apkUrl) return;
        SettingsManager.triggerHaptic("medium");
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
                    toast.error(`Fallo en la descarga: ${prog.error}`);
                    setDownloading(false);
                } else if (prog.done) {
                    SettingsManager.triggerHaptic("heavy");
                    toast.success("📦 Descarga completada. Abriendo instalador...");
                    setDownloading(false);
                }
            });
        } catch (e: any) {
            console.error("Update failed", e);
            toast.error(`Error durante la actualización: ${e.message || e}`);
            setDownloading(false);
        }
    };

    const formatBytes = (bytes: number): string => {
        if (!bytes || bytes <= 0) return "0 MB";
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
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
                            Actualizador Soberano OTA
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                            IN-APP PACKAGE INSTALLER
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => checkUpdates(true)}
                    disabled={loading || downloading}
                    className="btn-icon"
                    style={{ width: 38, height: 38, fontSize: "1.1rem" }}
                    title="Buscar actualizaciones"
                >
                    <span style={{ display: "inline-block", transform: loading ? "rotate(360deg)" : "none", transition: "transform 1s linear" }}>
                        🔄
                    </span>
                </button>
            </header>

            {/* Contenido Principal */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px", maxWidth: "600px", margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Banner de Estado de Versión */}
                <div className="card-tactical" style={{
                    padding: "20px",
                    background: updateInfo?.hasUpdate
                        ? "linear-gradient(135deg, rgba(232,33,58,0.15) 0%, rgba(14,16,28,0.85) 100%)"
                        : "linear-gradient(135deg, rgba(0,230,118,0.10) 0%, rgba(14,16,28,0.85) 100%)",
                    border: updateInfo?.hasUpdate
                        ? "1px solid var(--primary-bright)"
                        : "1px solid rgba(0,230,118,0.3)",
                    display: "flex", flexDirection: "column", gap: "14px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: "12px",
                                background: updateInfo?.hasUpdate ? "var(--primary-glow)" : "rgba(0,230,118,0.2)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "1.5rem"
                            }}>
                                {updateInfo?.hasUpdate ? "🚀" : "🛡️"}
                            </div>
                            <div>
                                <div style={{ fontSize: "1rem", fontWeight: 900, color: "#fff" }}>
                                    {updateInfo?.hasUpdate ? "¡Actualización Disponible!" : "Sistema Actualizado"}
                                </div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                    Build Code: {RED_BUILD_CODE}
                                </div>
                            </div>
                        </div>

                        <span className={`badge-tactical ${updateInfo?.hasUpdate ? "badge-tactical-crimson" : "badge-tactical-emerald"}`} style={{ padding: "4px 10px", fontSize: "0.72rem" }}>
                            {updateInfo?.hasUpdate ? "UPDATE DISPONIBLE" : "AL DÍA"}
                        </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "var(--radius-md)" }}>
                        <div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Versión Instalada</div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#fff", fontFamily: "JetBrains Mono, monospace" }}>
                                v{RED_VERSION}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Última Versión</div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 900, color: updateInfo?.hasUpdate ? "var(--primary-bright)" : "var(--accent-emerald)", fontFamily: "JetBrains Mono, monospace" }}>
                                v{updateInfo?.latestVersion || RED_VERSION}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Advertencia de Permiso Android Unknown Sources */}
                {permissionNeeded && (
                    <div className="card-tactical" style={{ padding: "14px 16px", background: "rgba(255,179,0,0.10)", border: "1px solid rgba(255,179,0,0.4)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "1.4rem" }}>⚠️</span>
                            <div>
                                <div style={{ fontSize: "0.84rem", fontWeight: 800, color: "#fff" }}>Permiso de Instalación Requerido</div>
                                <div style={{ fontSize: "0.70rem", color: "var(--text-secondary)" }}>
                                    Autoriza a RED a instalar paquetes para actualizar sin salir de la app.
                                </div>
                            </div>
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

                {/* Changelog / Novedades de la Versión */}
                {updateInfo && (
                    <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>📋</span> Novedades de la Versión {updateInfo.latestVersion}
                            </div>
                            {updateInfo.apkSize > 0 && (
                                <span style={{ fontSize: "0.70rem", color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                    Tamaño: {formatBytes(updateInfo.apkSize)}
                                </span>
                            )}
                        </div>

                        <div style={{
                            background: "rgba(0,0,0,0.4)", border: "1px solid var(--glass-border)",
                            borderRadius: "var(--radius-md)", padding: "12px",
                            fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5,
                            maxHeight: "180px", overflowY: "auto", whiteSpace: "pre-wrap",
                            fontFamily: "Inter, sans-serif"
                        }}>
                            {updateInfo.releaseNotes}
                        </div>
                    </div>
                )}

                {/* Telemetría de Descarga en Vivo */}
                {downloading && downloadProgress && (
                    <div className="card-tactical" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--accent-cyan)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span className="pulsing-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-cyan)", display: "inline-block" }} />
                                <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#fff" }}>Descargando Paquete Binario...</span>
                            </div>
                            <span style={{ fontSize: "0.80rem", fontWeight: 900, color: "var(--accent-cyan)", fontFamily: "JetBrains Mono, monospace" }}>
                                {(downloadProgress.progress * 100).toFixed(0)}%
                            </span>
                        </div>

                        {/* Barra de Progreso */}
                        <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{
                                width: `${Math.min(100, Math.max(0, downloadProgress.progress * 100))}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, var(--primary) 0%, var(--accent-cyan) 100%)",
                                transition: "width 0.2s ease-out"
                            }} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.70rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                            <span>{formatBytes(downloadProgress.receivedBytes)} / {formatBytes(downloadProgress.totalBytes)}</span>
                            <span>{downloadProgress.speedKbps > 0 ? `${downloadProgress.speedKbps.toFixed(0)} KB/s` : "Conectando..."}</span>
                        </div>
                    </div>
                )}

                {/* Acciones de Instalación */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto", paddingTop: "12px" }}>
                    {updateInfo?.hasUpdate ? (
                        <button
                            onClick={handleStartDownloadAndInstall}
                            disabled={downloading}
                            className="btn-tactical-primary"
                            style={{
                                width: "100%", padding: "14px 20px", fontSize: "0.95rem", fontWeight: 900,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                                boxShadow: "0 6px 24px rgba(232,33,58,0.4)"
                            }}
                        >
                            <span>📥</span>
                            {downloading ? "Descargando Actualización..." : "Descargar e Instalar Ahora"}
                        </button>
                    ) : (
                        <button
                            onClick={() => checkUpdates(true)}
                            disabled={loading || downloading}
                            className="btn-tactical-secondary"
                            style={{ width: "100%", padding: "12px 18px", fontSize: "0.88rem", fontWeight: 800 }}
                        >
                            {loading ? "Comprobando Versión..." : "Buscar Actualizaciones"}
                        </button>
                    )}

                    <div style={{ textAlign: "center", fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                        Canal Oficial: GitHub Releases / P2P Swarm Gossip
                    </div>
                </div>

            </div>
        </div>
    );
};

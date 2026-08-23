import React, { useState, useEffect } from "react";
import { UpdateManager, UpdateInfo, DownloadProgress } from "../../lib/updateManager";
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME } from "../../lib/version";
import { SettingsManager } from "../../lib/settingsManager";
import { toast } from "../Toast";

export const UpdatesTab: React.FC = () => {
    const [permissionNeeded, setPermissionNeeded] = useState(false);
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

    useEffect(() => {
        UpdateManager.checkInstallPermission().then(granted => {
            setPermissionNeeded(!granted);
        });
    }, []);

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
    );
};

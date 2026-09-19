import React, { useState, useEffect } from "react";
import { UpdateManager, UpdateInfo, DownloadProgress } from "../../lib/updateManager";
import { RED_VERSION, RED_BUILD_CODE, RED_APK_NAME } from "../../lib/version";
import { SettingsManager } from "../../lib/settingsManager";
import { toast } from "../Toast";
import { useTranslation } from "../../lib/i18n/i18nEngine";
import { LegalComplianceModal } from "../legal/LegalComplianceModal";
import { App } from "@capacitor/app";

export const UpdatesTab: React.FC = () => {
    const { t } = useTranslation();
    const [permissionNeeded, setPermissionNeeded] = useState(false);
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [cachedApk, setCachedApk] = useState<{ exists: boolean; filePath?: string; size?: number } | null>(null);
    const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);

    const refreshStatus = async () => {
        try {
            const granted = await UpdateManager.checkInstallPermission();
            setPermissionNeeded(!granted);
            const cached = await UpdateManager.getCachedApkInfo();
            setCachedApk(cached);
        } catch {}
    };

    useEffect(() => {
        refreshStatus();

        let appSub: any = null;
        try {
            appSub = App.addListener("appStateChange", async (state) => {
                if (state.isActive) {
                    await refreshStatus();
                    const granted = await UpdateManager.checkInstallPermission();
                    if (granted) {
                        setPermissionNeeded(false);
                        const res = await UpdateManager.resumePendingInstall();
                        if (res.resumed) {
                            toast.success("📦 Permiso concedido: abriendo instalador...");
                        }
                    }
                }
            });
        } catch {}

        const resumedSubPromise = UpdateManager.onApkInstallResumed((data) => {
            if (data.resumed) {
                toast.success("📦 Permiso concedido. Abriendo instalador...");
                refreshStatus();
            }
        });

        window.addEventListener("focus", refreshStatus);
        return () => {
            if (appSub) {
                appSub.then((h: any) => h.remove?.()).catch(() => {});
            }
            resumedSubPromise.then((h) => h.remove?.()).catch(() => {});
            window.removeEventListener("focus", refreshStatus);
        };
    }, []);

    const handleCheckUpdates = async () => {
        SettingsManager.triggerHaptic("light");
        setCheckingUpdates(true);
        try {
            const info = await UpdateManager.checkForUpdates(true);
            setUpdateInfo(info);
            await refreshStatus();
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

    const handleInstallCached = async () => {
        SettingsManager.triggerHaptic("heavy");
        try {
            toast.info("📦 Abriendo instalador con APK descargado...");
            const res = await UpdateManager.installCachedApk(cachedApk?.filePath);
            if (res.promptedPermission) {
                setPermissionNeeded(true);
                toast.info("⚙️ Concede el permiso en Ajustes. La instalación continuará automáticamente.");
            }
        } catch (e: any) {
            toast.error(`Fallo al instalar paquete: ${e.message || e}`);
        }
    };

    const handleDownloadAndInstall = async (overrideUrl?: string) => {
        const targetUrl = overrideUrl || updateInfo?.apkUrl;
        if (!targetUrl) {
            toast.error("No se localizó URL de binario APK para descargar.");
            return;
        }
        SettingsManager.triggerHaptic("heavy");
        setDownloading(true);
        setDownloadProgress({
            progress: 0,
            receivedBytes: 0,
            totalBytes: updateInfo?.apkSize || 0,
            speedKbps: 0,
            done: false,
        });

        try {
            const success = await UpdateManager.downloadAndInstall(targetUrl, (prog) => {
                setDownloadProgress(prog);
                if (prog.error) {
                    toast.error(`Error: ${prog.error}`);
                    setDownloading(false);
                } else if (prog.done) {
                    setDownloading(false);
                    refreshStatus();
                }
            });

            if (!success) {
                setPermissionNeeded(true);
                toast.info("⚙️ Activa 'Permitir desde esta fuente' en Ajustes. La instalación se reanudará al volver.");
            } else {
                toast.success("📦 Descarga completada. Abriendo instalador nativo...");
            }
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
                    {t.settings?.tab_updates || "Motor Autónomo de Actualizaciones OTA"}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {t.settings?.updates_check || "Detección semántica de versiones, descarga directa en streaming e instalación sin salir de la app."}
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
                                {updateInfo?.hasUpdate ? (t.settings?.updates_available || "Nueva Versión Disponible") : (t.settings?.updates_current || "Nodo RED Actualizado")}
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
                {cachedApk?.exists && (
                    <button
                        onClick={handleInstallCached}
                        disabled={downloading}
                        className="btn-tactical-primary"
                        style={{
                            padding: "14px",
                            fontSize: "0.90rem",
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            background: "linear-gradient(90deg, #00E676 0%, #00B0FF 100%)",
                            color: "#040711"
                        }}
                    >
                        <span>⚡</span>
                        Instalar APK Descargado ({formatBytes(cachedApk.size || 0)})
                    </button>
                )}

                {updateInfo?.hasUpdate ? (
                    <button
                        onClick={() => handleDownloadAndInstall()}
                        disabled={downloading}
                        className="btn-tactical-primary"
                        style={{ padding: "14px", fontSize: "0.90rem", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                    >
                        <span>📥</span>
                        {downloading ? "Descargando Actualización..." : "Descargar e Instalar v" + updateInfo.latestVersion}
                    </button>
                ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={handleCheckUpdates}
                            disabled={checkingUpdates || downloading}
                            className="btn-tactical-secondary"
                            style={{ flex: 1, padding: "12px", fontSize: "0.82rem", fontWeight: 800 }}
                        >
                            <span>🔄</span>
                            {checkingUpdates ? "Buscando..." : "Comprobar Actualizaciones"}
                        </button>

                        <button
                            onClick={() => handleDownloadAndInstall()}
                            disabled={downloading}
                            className="btn-tactical-secondary"
                            style={{
                                flex: 1,
                                padding: "12px",
                                fontSize: "0.82rem",
                                fontWeight: 800,
                                border: "1px solid rgba(0, 229, 255, 0.4)",
                                color: "#00E5FF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px"
                            }}
                            title="Descargar y reinstalar el binario oficial de la versión actual"
                        >
                            <span>📥</span>
                            {downloading ? "Descargando..." : `Reinstalar v${RED_VERSION}`}
                        </button>
                    </div>
                )}
            </div>

            {/* Acerca de RED, Marco Legal & Licencia */}
            <div className="card-tactical" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                <div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>⚖️</span> Marco Legal & Licencia AGPL-3.0
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        Términos de servicio, política de privacidad Zero-Knowledge y seguridad de datos.
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        SettingsManager.triggerHaptic("light");
                        setIsLegalModalOpen(true);
                    }}
                    className="btn-tactical-secondary"
                    style={{ padding: "8px 14px", fontSize: "0.74rem", whiteSpace: "nowrap" }}
                >
                    Ver Términos
                </button>
            </div>

            {/* Modal de Cumplimiento Legal */}
            <LegalComplianceModal
                isOpen={isLegalModalOpen}
                onClose={() => setIsLegalModalOpen(false)}
            />
        </div>
    );
};

/**
 * RED 2.0 — Autonomous In-App OTA Update Engine
 * Performs SemVer comparison against GitHub Releases / Sovereign CDN,
 * streams high-performance native APK downloads, and launches Android PackageInstaller.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import { RED_VERSION, RED_APK_NAME } from './version';

const RedNode = registerPlugin<any>('RedNode');

export interface UpdateInfo {
    hasUpdate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseName: string;
    releaseNotes: string;
    publishedAt: string;
    apkUrl: string;
    apkSize: number; // in bytes (0 if unknown)
    error?: string;
}

export interface DownloadProgress {
    progress: number;       // 0.0 to 1.0
    receivedBytes: number;
    totalBytes: number;
    speedKbps: number;
    done: boolean;
    error?: string;
    filePath?: string;
}

function parseSemVer(v: string): number[] {
    if (!v) return [0, 0, 0];
    const clean = v.trim().replace(/^v/i, '').split('-')[0].split('+')[0];
    const parts = clean.split('.').map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
}

export function isNewerVersion(remote: string, current: string): boolean {
    const r = parseSemVer(remote);
    const c = parseSemVer(current);
    for (let i = 0; i < 3; i++) {
        if (r[i] > c[i]) return true;
        if (r[i] < c[i]) return false;
    }
    return false;
}

export class UpdateManager {
    private static GITHUB_API_URL = 'https://api.github.com/repos/DarckRovert/RED/releases/latest';
    private static cachedUpdateInfo: UpdateInfo | null = null;
    private static lastCheckTimestamp = 0;

    /**
     * Comprueba si existe una versión superior en GitHub Releases.
     * Retorna detalles de la release, changelog y enlace directo al binario APK.
     */
    public static async checkForUpdates(forceRefresh = false): Promise<UpdateInfo> {
        const now = Date.now();
        if (!forceRefresh && this.cachedUpdateInfo && (now - this.lastCheckTimestamp < 60_000)) {
            return this.cachedUpdateInfo;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            const res = await fetch(this.GITHUB_API_URL, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'RED-Sovereign-Updater',
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                if (res.status === 404) {
                    return {
                        hasUpdate: false,
                        currentVersion: RED_VERSION,
                        latestVersion: RED_VERSION,
                        releaseName: `RED v${RED_VERSION}`,
                        releaseNotes: 'Estás ejecutando la versión más reciente del sistema.',
                        publishedAt: new Date().toISOString(),
                        apkUrl: '',
                        apkSize: 0,
                    };
                }
                throw new Error(`GitHub API HTTP ${res.status}: ${res.statusText}`);
            }

            const release = await res.json();
            const rawTag = release.tag_name || release.name || '';
            const latestVer = rawTag.replace(/^v/i, '').trim();

            const hasNewer = isNewerVersion(latestVer, RED_VERSION);

            // Localizar asset de APK o construir URL predeterminada
            let apkUrl = '';
            let apkSize = 0;

            if (Array.isArray(release.assets)) {
                const apkAsset = release.assets.find((a: any) => 
                    a.name?.endsWith('.apk') || a.browser_download_url?.endsWith('.apk')
                );
                if (apkAsset) {
                    apkUrl = apkAsset.browser_download_url;
                    apkSize = apkAsset.size || 0;
                }
            }

            if (!apkUrl) {
                apkUrl = `https://github.com/DarckRovert/RED/releases/download/${rawTag}/${RED_APK_NAME}`;
            }

            const updateInfo: UpdateInfo = {
                hasUpdate: hasNewer,
                currentVersion: RED_VERSION,
                latestVersion: latestVer || RED_VERSION,
                releaseName: release.name || `RED v${latestVer}`,
                releaseNotes: release.body || 'Mejoras de rendimiento, cifrado y estabilidad de malla P2P.',
                publishedAt: release.published_at || new Date().toISOString(),
                apkUrl,
                apkSize,
            };

            this.cachedUpdateInfo = updateInfo;
            this.lastCheckTimestamp = now;
            return updateInfo;

        } catch (e: any) {
            console.warn('[UpdateManager] Check failed:', e.message);
            return {
                hasUpdate: false,
                currentVersion: RED_VERSION,
                latestVersion: RED_VERSION,
                releaseName: `RED v${RED_VERSION}`,
                releaseNotes: 'No se pudo contactar con el servidor de actualizaciones o el nodo está operando 100% offline.',
                publishedAt: new Date().toISOString(),
                apkUrl: '',
                apkSize: 0,
                error: e.message || 'Error de conexión',
            };
        }
    }

    /**
     * Verifica si Android autoriza instalar paquetes desconocidos.
     */
    public static async checkInstallPermission(): Promise<boolean> {
        if (!Capacitor.isNativePlatform()) return true;
        try {
            const res = await RedNode.canRequestPackageInstalls();
            return !!res?.granted;
        } catch {
            return true;
        }
    }

    /**
     * Abre los ajustes del sistema Android para conceder permiso de instalación.
     */
    public static async openInstallSettings(): Promise<void> {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await RedNode.openInstallPermissionSettings();
        } catch (e) {
            console.error('[UpdateManager] Failed to open install settings', e);
        }
    }

    /**
     * Descarga el APK nativamente con telemetría en tiempo real y dispara el instalador.
     */
    public static async downloadAndInstall(
        apkUrl: string,
        onProgress: (progress: DownloadProgress) => void
    ): Promise<boolean> {
        if (!apkUrl) throw new Error('URL de APK no válida');

        // Modo Web / Desktop: Descarga directa en el navegador
        if (!Capacitor.isNativePlatform()) {
            const a = document.createElement('a');
            a.href = apkUrl;
            a.target = '_blank';
            a.download = RED_APK_NAME;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            onProgress({
                progress: 1.0,
                receivedBytes: 0,
                totalBytes: 0,
                speedKbps: 0,
                done: true,
            });
            return true;
        }

        // Modo Android Nativo: Descarga streaming en Java + FileProvider Intent
        let progressSub: any = null;

        try {
            // Suscribirse a eventos de progreso del plugin nativo
            progressSub = await RedNode.addListener('apkDownloadProgress', (prog: any) => {
                if (prog.error) {
                    onProgress({
                        progress: 0,
                        receivedBytes: 0,
                        totalBytes: 0,
                        speedKbps: 0,
                        done: false,
                        error: prog.error,
                    });
                    return;
                }

                onProgress({
                    progress: typeof prog.progress === 'number' ? prog.progress : 0,
                    receivedBytes: prog.receivedBytes || 0,
                    totalBytes: prog.totalBytes || 0,
                    speedKbps: prog.speedKbps || 0,
                    done: !!prog.done,
                    filePath: prog.filePath,
                });
            });

            // Iniciar descarga en hilo nativo
            const downloadResult = await RedNode.downloadApk({
                url: apkUrl,
                fileName: 'red_update.apk',
            });

            if (!downloadResult?.success || !downloadResult?.filePath) {
                throw new Error('La descarga nativa no completó correctamente.');
            }

            // Iniciar instalación nativa
            await RedNode.installApk({
                filePath: downloadResult.filePath,
            });

            if (progressSub && typeof progressSub.remove === 'function') {
                progressSub.remove();
                progressSub = null;
            }

            return true;

        } catch (err: any) {
            if (progressSub && typeof progressSub.remove === 'function') {
                try { progressSub.remove(); } catch {}
                progressSub = null;
            }
            throw err;
        }
    }
}

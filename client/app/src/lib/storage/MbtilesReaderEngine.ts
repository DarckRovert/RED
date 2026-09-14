/**
 * MbtilesReaderEngine.ts — RED Sovereign Tactical Map Engine (v106.0.0)
 *
 * Provides transparent access to offline raster and vector MBTiles map packages.
 * Operates natively via SQLite on Android (RedNodePlugin.getMbtilesTile) for
 * instant, zero-latency access to gigabyte-sized maps without RAM exhaustion,
 * and maintains an in-memory LRU cache for 60 FPS map panning.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

const RedNode = registerPlugin<any>('RedNode');

export interface MbtilesPackage {
    path: string;
    fileName: string;
    name: string;
    format: string;
    minzoom: number;
    maxzoom: number;
    bounds?: string;
    attribution?: string;
    description?: string;
    sizeBytes: number;
}

export class MbtilesReaderEngine {
    private static instance: MbtilesReaderEngine | null = null;

    private activePackage: MbtilesPackage | null = null;
    private tileCache: Map<string, string> = new Map(); // LRU Cache: "z/x/y" -> DataURL
    private maxCacheSize: number = 250;

    private constructor() {}

    public static getInstance(): MbtilesReaderEngine {
        if (!this.instance) {
            this.instance = new MbtilesReaderEngine();
        }
        return this.instance;
    }

    /**
     * Lists all available .mbtiles packages in device storage
     */
    public async listAvailablePackages(): Promise<MbtilesPackage[]> {
        if (!Capacitor.isNativePlatform()) {
            return [];
        }

        try {
            const res = await RedNode.listAvailableMbtiles();
            if (res && Array.isArray(res.packages)) {
                return res.packages.map((pkg: any) => ({
                    path: pkg.path || '',
                    fileName: pkg.fileName || '',
                    name: pkg.name || 'Mapa Táctico Offline',
                    format: pkg.format || 'png',
                    minzoom: parseInt(pkg.minzoom, 10) || 0,
                    maxzoom: parseInt(pkg.maxzoom, 10) || 18,
                    bounds: pkg.bounds || undefined,
                    attribution: pkg.attribution || 'RED Sovereign Tactical Maps',
                    description: pkg.description || '',
                    sizeBytes: pkg.sizeBytes || 0,
                }));
            }
            return [];
        } catch (e) {
            console.error('[MBTiles] Error listing packages:', e);
            return [];
        }
    }

    /**
     * Opens an MBTiles database package for tile queries
     */
    public async openPackage(filePath: string): Promise<boolean> {
        if (!filePath) return false;
        this.clearCache();

        if (Capacitor.isNativePlatform()) {
            try {
                const res = await RedNode.openMbtilesPackage({ filePath });
                if (res && res.success) {
                    const meta = res.metadata || {};
                    this.activePackage = {
                        path: filePath,
                        fileName: filePath.split('/').pop() || 'map.mbtiles',
                        name: meta.name || 'Mapa MBTiles',
                        format: meta.format || 'png',
                        minzoom: parseInt(meta.minzoom, 10) || 0,
                        maxzoom: parseInt(meta.maxzoom, 10) || 18,
                        bounds: meta.bounds,
                        attribution: meta.attribution,
                        description: meta.description,
                        sizeBytes: 0
                    };
                    console.log(`[MBTiles] ✅ Paquete abierto: ${this.activePackage.name} (${this.activePackage.format})`);
                    return true;
                }
                return false;
            } catch (e) {
                console.error('[MBTiles] Error opening package:', e);
                this.activePackage = null;
                return false;
            }
        }

        return false;
    }

    /**
     * Closes the active MBTiles package
     */
    public async closePackage(): Promise<void> {
        this.clearCache();
        this.activePackage = null;
        if (Capacitor.isNativePlatform()) {
            try {
                await RedNode.closeMbtilesPackage();
            } catch {}
        }
    }

    public getActivePackage(): MbtilesPackage | null {
        return this.activePackage;
    }

    public isPackageOpen(): boolean {
        return this.activePackage !== null;
    }

    /**
     * Sniffs MIME type from Base64 binary magic bytes (PNG: 89 50 4E 47, JPEG: FF D8 FF, GZIP/MVT: 1F 8B)
     */
    public detectMimeFromBase64(b64: string, fallbackFormat = 'png'): string {
        if (!b64 || b64.length < 8) {
            return (fallbackFormat === 'jpg' || fallbackFormat === 'jpeg') ? 'image/jpeg' : 'image/png';
        }
        // Base64 magic headers:
        // PNG header (89 50 4E 47) -> 'iVBORw0KGgo'
        if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
        // JPEG header (FF D8 FF) -> '/9j/'
        if (b64.startsWith('/9j/')) return 'image/jpeg';
        // GZIP / Mapbox Vector Tile (1F 8B) -> 'H4sI'
        if (b64.startsWith('H4sI')) return 'application/x-protobuf';
        return (fallbackFormat === 'jpg' || fallbackFormat === 'jpeg') ? 'image/jpeg' : 'image/png';
    }

    /**
     * Fetches a tile as a Base64 data URL with internal LRU cache
     */
    public async getTileDataUrl(z: number, x: number, y: number): Promise<string | null> {
        if (!this.activePackage) return null;

        const key = `${z}/${x}/${y}`;
        if (this.tileCache.has(key)) {
            const cached = this.tileCache.get(key)!;
            // Move to end of Map to maintain LRU freshness
            this.tileCache.delete(key);
            this.tileCache.set(key, cached);
            return cached;
        }

        if (Capacitor.isNativePlatform()) {
            try {
                const res = await RedNode.getMbtilesTile({ z, x, y });
                if (res && res.found && res.dataBase64) {
                    const mimeType = this.detectMimeFromBase64(res.dataBase64, this.activePackage.format);
                    const dataUrl = `data:${mimeType};base64,${res.dataBase64}`;

                    // Insert in LRU cache
                    if (this.tileCache.size >= this.maxCacheSize) {
                        const oldestKey = this.tileCache.keys().next().value;
                        if (oldestKey) this.tileCache.delete(oldestKey);
                    }
                    this.tileCache.set(key, dataUrl);
                    return dataUrl;
                }
                return null;
            } catch (e) {
                return null;
            }
        }

        return null;
    }

    /**
     * Converts Slippy XYZ coordinates to TMS Y coordinate
     */
    public static xyzToTmsY(z: number, y: number): number {
        return (1 << z) - 1 - y;
    }

    public clearCache(): void {
        this.tileCache.clear();
    }

    public destroy(): void {
        this.closePackage();
        MbtilesReaderEngine.instance = null;
    }
}

export const mbtilesReader = MbtilesReaderEngine.getInstance();

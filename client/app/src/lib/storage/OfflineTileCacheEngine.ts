/**
 * OfflineTileCacheEngine.ts — RED Sovereign Tactical Map Vault (IndexedDB)
 * 
 * Provides 100% offline map tile persistence, geo-bounding box calculations,
 * concurrent pre-download worker queues, and custom Leaflet layer integration.
 */

export interface TileCoord {
    z: number;
    x: number;
    y: number;
    key: string;
}

export interface TileCacheStats {
    totalTiles: number;
    totalSizeBytes: number;
    formattedSize: string;
}

export interface TileDownloadProgress {
    total: number;
    downloaded: number;
    failed: number;
    percent: number;
    bytesDownloaded: number;
    formattedBytes: string;
    isFinished: boolean;
    error?: string;
}

const DB_NAME = 'red_offline_map_vault';
const STORE_NAME = 'tiles';
const DB_VERSION = 1;

class OfflineTileCacheEngineClass {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private getDB(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) {
                return reject(new Error('IndexedDB not supported in this environment'));
            }

            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e: any) => {
                const db = e.target.result as IDBDatabase;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    // LRU index: allows efficient sort-by-last-access for eviction
                    store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
                } else {
                    // Migration for existing DBs: add index if missing
                    const store = (e.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
                    if (!store.indexNames.contains('lastAccessedAt')) {
                        store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
                    }
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.dbPromise;
    }

    /**
     * Converts WGS84 latitude, longitude and zoom level to Slippy Map tile coordinates
     */
    public latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
        const radLat = (lat * Math.PI) / 180;
        const n = Math.pow(2, zoom);
        const x = Math.floor(((lon + 180) / 360) * n);
        const y = Math.floor(((1 - Math.log(Math.tan(radLat) + 1 / Math.cos(radLat)) / Math.PI) / 2) * n);
        return {
            x: Math.max(0, Math.min(n - 1, x)),
            y: Math.max(0, Math.min(n - 1, y))
        };
    }

    /**
     * Calculates all tile coordinates covering a circular tactical radius around a center point
     */
    public calculateTilesForRadius(
        centerLat: number,
        centerLon: number,
        radiusKm: number,
        minZoom = 12,
        maxZoom = 17
    ): TileCoord[] {
        const tiles: TileCoord[] = [];
        const seen = new Set<string>();

        // 1. Clamping seguro de parámetros tácticos para evitar saturación de memoria en el cliente móvil
        const safeRadiusKm = Math.min(30, Math.max(0.5, radiusKm));
        const safeMinZoom = Math.max(8, Math.min(17, Math.floor(minZoom)));
        const safeMaxZoom = Math.max(safeMinZoom, Math.min(17, Math.floor(maxZoom)));
        const MAX_BATCH_TILES = 3500;

        // Approximate bounding box with safety margin
        const latDelta = safeRadiusKm / 111.0;
        const lonDelta = safeRadiusKm / (111.0 * Math.cos((centerLat * Math.PI) / 180));

        const minLat = centerLat - latDelta;
        const maxLat = centerLat + latDelta;
        const minLon = centerLon - lonDelta;
        const maxLon = centerLon + lonDelta;

        for (let z = safeMinZoom; z <= safeMaxZoom; z++) {
            const topLeft = this.latLonToTile(maxLat, minLon, z);
            const bottomRight = this.latLonToTile(minLat, maxLon, z);

            const minX = Math.min(topLeft.x, bottomRight.x);
            const maxX = Math.max(topLeft.x, bottomRight.x);
            const minY = Math.min(topLeft.y, bottomRight.y);
            const maxY = Math.max(topLeft.y, bottomRight.y);

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    const key = `${z}_${x}_${y}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        tiles.push({ z, x, y, key });
                        if (tiles.length >= MAX_BATCH_TILES) {
                            console.warn(`[OfflineTileCache] Batch tile limit reached (${MAX_BATCH_TILES}) for radius ${safeRadiusKm}km`);
                            return tiles;
                        }
                    }
                }
            }
        }

        return tiles;
    }

    /**
     * Retrieves a tile blob from IndexedDB by zoom, x, and y.
     * Updates lastAccessedAt for LRU eviction tracking.
     */
    public async getTile(z: number, x: number, y: number): Promise<Blob | null> {
        try {
            const db = await this.getDB();
            const key = `${z}_${x}_${y}`;
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);

                req.onsuccess = () => {
                    if (req.result && req.result.blob) {
                        // Update access timestamp for LRU
                        store.put({ ...req.result, lastAccessedAt: Date.now() });
                        resolve(req.result.blob);
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            });
        } catch {
            return null;
        }
    }

    /**
     * Stores a tile blob into IndexedDB with lastAccessedAt timestamp
     */
    public async saveTile(z: number, x: number, y: number, blob: Blob): Promise<void> {
        try {
            const db = await this.getDB();
            const key = `${z}_${x}_${y}`;
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.put({
                    key,
                    z,
                    x,
                    y,
                    blob,
                    timestamp: Date.now(),
                    lastAccessedAt: Date.now(),
                    size: blob.size
                });

                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.warn('[OfflineTileCache] Save tile error:', e);
        }
    }

    /**
     * LRU Eviction: purges least-recently-used tiles when cache exceeds maxSizeBytes.
     * Evicts in order of oldest lastAccessedAt until under the quota.
     * Default cap: 500 MB.
     */
    public async pruneByLRU(maxSizeBytes = 500 * 1024 * 1024): Promise<number> {
        try {
            const stats = await this.getCacheStats();
            if (stats.totalSizeBytes <= maxSizeBytes) return 0;

            const db = await this.getDB();
            // Collect all entries sorted by lastAccessedAt ASC (oldest first)
            const entries: { key: string; size: number; lastAccessedAt: number }[] = await new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const result: any[] = [];
                const req = store.openCursor();
                req.onsuccess = (e: any) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        result.push({
                            key: cursor.value.key,
                            size: cursor.value.size || 0,
                            lastAccessedAt: cursor.value.lastAccessedAt || cursor.value.timestamp || 0
                        });
                        cursor.continue();
                    } else {
                        resolve(result.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt));
                    }
                };
                req.onerror = () => resolve([]);
            });

            let freed = 0;
            let prunedCount = 0;
            let remaining = stats.totalSizeBytes;

            const keysToDelete: string[] = [];
            for (const entry of entries) {
                if (remaining <= maxSizeBytes) break;
                keysToDelete.push(entry.key);
                freed += entry.size;
                remaining -= entry.size;
                prunedCount++;
            }

            if (keysToDelete.length > 0) {
                await new Promise<void>((resolve) => {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    for (const k of keysToDelete) {
                        store.delete(k);
                    }
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => resolve();
                });
            }

            if (prunedCount > 0) {
                console.info(`[OfflineTileCache] LRU pruned ${prunedCount} tiles (${this.formatBytes(freed)} freed)`);
            }
            return prunedCount;
        } catch (e) {
            console.warn('[OfflineTileCache] LRU prune error:', e);
            return 0;
        }
    }

    /**
     * Pre-downloads all tiles for a specified geographic region with live progress callback
     */
    public async downloadRegion(
        centerLat: number,
        centerLon: number,
        radiusKm: number,
        minZoom = 12,
        maxZoom = 16,
        onProgress?: (p: TileDownloadProgress) => void,
        abortSignal?: AbortSignal
    ): Promise<TileDownloadProgress> {
        const tiles = this.calculateTilesForRadius(centerLat, centerLon, radiusKm, minZoom, maxZoom);
        const total = tiles.length;
        let downloaded = 0;
        let failed = 0;
        let bytesDownloaded = 0;

        const report = (isFinished = false, err?: string) => {
            if (onProgress) {
                const p: TileDownloadProgress = {
                    total,
                    downloaded,
                    failed,
                    percent: total > 0 ? Math.round(((downloaded + failed) / total) * 100) : 100,
                    bytesDownloaded,
                    formattedBytes: this.formatBytes(bytesDownloaded),
                    isFinished,
                    error: err
                };
                onProgress(p);
            }
        };

        report(false);

        // Worker concurrency pool of 4
        const concurrency = 4;
        let index = 0;

        const downloadWorker = async () => {
            while (index < tiles.length) {
                if (abortSignal?.aborted) {
                    throw new Error('Descarga cancelada por el usuario');
                }

                const currentTile = tiles[index++];
                if (!currentTile) break;

                // Check if already in cache
                const existing = await this.getTile(currentTile.z, currentTile.x, currentTile.y);
                if (existing) {
                    downloaded++;
                    bytesDownloaded += existing.size;
                    report(false);
                    continue;
                }

                // Fetch tile from OpenStreetMap
                const url = `https://tile.openstreetmap.org/${currentTile.z}/${currentTile.x}/${currentTile.y}.png`;
                try {
                    const res = await fetch(url, { signal: abortSignal });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    await this.saveTile(currentTile.z, currentTile.x, currentTile.y, blob);
                    downloaded++;
                    bytesDownloaded += blob.size;
                } catch (e: any) {
                    failed++;
                }

                report(false);
            }
        };

        const workers = Array.from({ length: concurrency }, () => downloadWorker());
        try {
            await Promise.all(workers);
            report(true);
        } catch (e: any) {
            report(true, e.message);
        }

        // W5: LRU eviction — purge oldest tiles if cache exceeds 500 MB
        void this.pruneByLRU(500 * 1024 * 1024);

        return {
            total,
            downloaded,
            failed,
            percent: 100,
            bytesDownloaded,
            formattedBytes: this.formatBytes(bytesDownloaded),
            isFinished: true
        };
    }

    /**
     * Retrieves disk usage metrics for cached tiles
     */
    public async getCacheStats(): Promise<TileCacheStats> {
        try {
            const db = await this.getDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.openCursor();

                let totalTiles = 0;
                let totalSizeBytes = 0;

                req.onsuccess = (e: any) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        totalTiles++;
                        if (cursor.value && cursor.value.size) {
                            totalSizeBytes += cursor.value.size;
                        }
                        cursor.continue();
                    } else {
                        resolve({
                            totalTiles,
                            totalSizeBytes,
                            formattedSize: this.formatBytes(totalSizeBytes)
                        });
                    }
                };

                req.onerror = () => {
                    resolve({ totalTiles: 0, totalSizeBytes: 0, formattedSize: '0 KB' });
                };
            });
        } catch {
            return { totalTiles: 0, totalSizeBytes: 0, formattedSize: '0 KB' };
        }
    }

    /**
     * Clears all cached tiles from IndexedDB
     */
    public async clearCache(): Promise<void> {
        try {
            const db = await this.getDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            console.error('[OfflineTileCache] Clear error:', e);
        }
    }

    public formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
}

export const offlineTileCacheEngine = new OfflineTileCacheEngineClass();

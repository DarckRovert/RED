/**
 * RED IndexedDB Media Vault (v2.0)
 *
 * High-performance, quota-free persistent storage for heavy media
 * (photos, voice notes, video chunks, and encrypted attachments).
 * Prevents localStorage QuotaExceededError crashes (5 MB ceiling).
 *
 * v2.0 — LRU RAM cache now adapts dynamically to the KineticDutyGovernor
 * profile to avoid Android Low-Memory-Killer (LMK) eviction on 2 GB devices:
 *   SURVIVAL_SENTRY  → max 20 items  (~40 MB heap impact)
 *   BALANCED_PATROL  → max 50 items
 *   HIGH_PERFORMANCE / SHAKE_BOOST → max 120 items
 */

import { KineticDutyGovernor, DutyCycleProfile } from '../sensors/KineticDutyGovernor';

export interface MediaVaultRecord {
    id: string;
    dataUrl: string;
    mimeType: string;
    size: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

class IndexedMediaVault {
    private readonly dbName = 'RED_MEDIA_VAULT_DB';
    private readonly storeName = 'media_store';
    private readonly dbVersion = 1;
    private dbPromise: Promise<IDBDatabase> | null = null;
    private memCache = new Map<string, string>();
    private maxCacheEntries = 50; // default BALANCED_PATROL

    constructor() {
        // Subscribe to KineticDutyGovernor profile changes to adapt LRU cap
        if (typeof window !== 'undefined') {
            try {
                const governor = KineticDutyGovernor.getInstance();
                governor.subscribe((telemetry) => {
                    this.applyProfileCap(telemetry.currentProfile);
                });
            } catch {
                // Governor not yet available — use default cap
            }
        }
    }

    private applyProfileCap(profile: DutyCycleProfile): void {
        switch (profile) {
            case 'SURVIVAL_SENTRY':
                this.maxCacheEntries = 20;
                break;
            case 'BALANCED_PATROL':
                this.maxCacheEntries = 50;
                break;
            case 'HIGH_PERFORMANCE':
            case 'SHAKE_BOOST':
                this.maxCacheEntries = 120;
                break;
        }
        // Evict excess entries immediately after cap reduction
        while (this.memCache.size > this.maxCacheEntries) {
            const oldestKey = this.memCache.keys().next().value;
            if (oldestKey) this.memCache.delete(oldestKey);
        }
    }

    /**
     * Libera inmediatamente toda la caché RAM de miniaturas y medios.
     * Llamar en respuesta a eventos de presión de memoria o cambio de perfil.
     */
    public clearMemoryCache(): void {
        this.memCache.clear();
    }

    private getDB(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            if (typeof window === 'undefined' || !window.indexedDB) {
                return reject(new Error('IndexedDB no está disponible en este entorno.'));
            }

            const req = window.indexedDB.open(this.dbName, this.dbVersion);

            req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => {
                this.dbPromise = null;
                reject(req.error || new Error('Error al abrir RED_MEDIA_VAULT_DB'));
            };
        });

        return this.dbPromise;
    }

    private normalizeId(idOrUri: string): string {
        if (!idOrUri) return '';
        if (idOrUri.startsWith('red_vault://')) {
            return idOrUri.replace('red_vault://', '');
        }
        return idOrUri;
    }

    private setInMemCache(id: string, dataUrl: string): void {
        // Move to newest by re-inserting
        if (this.memCache.has(id)) {
            this.memCache.delete(id);
        }
        this.memCache.set(id, dataUrl);
        while (this.memCache.size > this.maxCacheEntries) {
            const oldestKey = this.memCache.keys().next().value;
            if (oldestKey) this.memCache.delete(oldestKey);
        }
    }

    /**
     * Stores a heavy media item (Base64 dataUrl, Blob data) into IndexedDB.
     * Returns a lightweight reference URI: `red_vault://<id>`.
     */
    public async saveMedia(id: string, dataUrl: string, mimeType = 'application/octet-stream', metadata?: Record<string, any>): Promise<string> {
        const cleanId = this.normalizeId(id);
        if (!cleanId || !dataUrl) return dataUrl;

        // Keep in fast RAM cache — LRU eviction bounded by dynamic profile cap
        this.setInMemCache(cleanId, dataUrl);

        try {
            const db = await this.getDB();
            const record: MediaVaultRecord = {
                id: cleanId,
                dataUrl,
                mimeType,
                size: dataUrl.length,
                timestamp: Date.now(),
                metadata
            };

            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const putReq = store.put(record);

                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            });

            return `red_vault://${cleanId}`;
        } catch (err) {
            console.warn('[MediaVault] Fallback saving to memory cache:', err);
            return dataUrl;
        }
    }

    /**
     * Retrieves stored dataUrl by ID or URI (`red_vault://<id>`).
     */
    public async getMedia(idOrUri: string): Promise<string | null> {
        const cleanId = this.normalizeId(idOrUri);
        if (!cleanId) return null;

        // 1. Check RAM cache
        if (this.memCache.has(cleanId)) {
            const val = this.memCache.get(cleanId)!;
            // Refresh LRU order on access
            this.memCache.delete(cleanId);
            this.memCache.set(cleanId, val);
            return val;
        }

        try {
            const db = await this.getDB();
            return await new Promise<string | null>((resolve) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const req = store.get(cleanId);

                req.onsuccess = () => {
                    const record: MediaVaultRecord | undefined = req.result;
                    if (record && record.dataUrl) {
                        this.setInMemCache(cleanId, record.dataUrl);
                        resolve(record.dataUrl);
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            });
        } catch (err) {
            console.warn('[MediaVault] Error retrieving media:', err);
            return null;
        }
    }

    /**
     * Resolves any string: if it starts with `red_vault://`, fetches from vault.
     * Otherwise returns the string as-is.
     */
    public async resolveMediaUrl(urlOrData?: string | null): Promise<string> {
        if (!urlOrData) return '';
        if (urlOrData.startsWith('red_vault://')) {
            const resolved = await this.getMedia(urlOrData);
            return resolved || '';
        }
        return urlOrData;
    }

    /**
     * Check if a media ID exists in the vault.
     */
    public async hasMedia(idOrUri: string): Promise<boolean> {
        const cleanId = this.normalizeId(idOrUri);
        if (!cleanId) return false;
        if (this.memCache.has(cleanId)) return true;

        try {
            const db = await this.getDB();
            return await new Promise<boolean>((resolve) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const req = store.count(cleanId);
                req.onsuccess = () => resolve(req.result > 0);
                req.onerror = () => resolve(false);
            });
        } catch {
            return false;
        }
    }

    /**
     * Deletes media record from vault.
     */
    public async deleteMedia(idOrUri: string): Promise<void> {
        const cleanId = this.normalizeId(idOrUri);
        if (!cleanId) return;

        this.memCache.delete(cleanId);

        try {
            const db = await this.getDB();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const req = store.delete(cleanId);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn('[MediaVault] Error deleting media:', err);
        }
    }

    /**
     * Retrieves overall vault metrics (record count and total size in bytes).
     */
    public async getVaultStats(): Promise<{ count: number; totalBytes: number }> {
        try {
            const db = await this.getDB();
            return await new Promise<{ count: number; totalBytes: number }>((resolve) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                let totalBytes = 0;
                let count = 0;

                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (e: any) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        count++;
                        totalBytes += cursor.value.size || 0;
                        cursor.continue();
                    } else {
                        resolve({ count, totalBytes });
                    }
                };
                cursorReq.onerror = () => resolve({ count: 0, totalBytes: 0 });
            });
        } catch {
            return { count: 0, totalBytes: 0 };
        }
    }

    /**
     * Clears all stored media files.
     */
    public async clearMediaVault(): Promise<void> {
        this.memCache.clear();
        try {
            const db = await this.getDB();
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(this.storeName, 'readwrite');
                const store = tx.objectStore(this.storeName);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn('[MediaVault] Error clearing vault:', err);
        }
    }

    /**
     * Cierra la conexión activa de IndexedDB y vacía la caché en memoria.
     */
    public async closeDB(): Promise<void> {
        this.memCache.clear();
        if (this.dbPromise) {
            try {
                const db = await this.dbPromise;
                db.close();
            } catch {}
            this.dbPromise = null;
        }
    }
}

export const indexedMediaVault = new IndexedMediaVault();

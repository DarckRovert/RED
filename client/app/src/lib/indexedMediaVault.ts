/**
 * RED IndexedDB Media Vault (v1.0)
 * 
 * High-performance, quota-free persistent storage for heavy media
 * (photos, voice notes, video chunks, and encrypted attachments).
 * Prevents localStorage QuotaExceededError crashes (5MB ceiling).
 */

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

    /**
     * Stores a heavy media item (Base64 dataUrl, Blob data) into IndexedDB.
     * Returns a lightweight reference URI: `red_vault://<id>`.
     */
    public async saveMedia(id: string, dataUrl: string, mimeType = 'application/octet-stream', metadata?: Record<string, any>): Promise<string> {
        const cleanId = this.normalizeId(id);
        if (!cleanId || !dataUrl) return dataUrl;

        // Keep in fast RAM cache for immediate sequential reads
        this.memCache.set(cleanId, dataUrl);
        if (this.memCache.size > 150) {
            const firstKey = this.memCache.keys().next().value;
            if (firstKey) this.memCache.delete(firstKey);
        }

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
            return this.memCache.get(cleanId)!;
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
                        this.memCache.set(cleanId, record.dataUrl);
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
            const tx = db.transaction(this.storeName, 'readwrite');
            tx.objectStore(this.storeName).clear();
        } catch (err) {
            console.warn('[MediaVault] Error clearing vault:', err);
        }
    }
}

export const indexedMediaVault = new IndexedMediaVault();

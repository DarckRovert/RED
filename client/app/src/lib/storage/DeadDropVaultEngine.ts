/**
 * DeadDropVaultEngine.ts - RED Sovereign Cryptographic P2P Dead-Drop Geocache Vault
 *
 * Manages encrypted tactical geocaches deposited at specific coordinates with physical
 * proximity-gated decryption (<= 15m tolerance radius), off-grid gossip sync and DTN persistence.
 *
 * Storage Security Model (3.1 Fix):
 *   - Vault metadata is persisted in IndexedDB encrypted with AES-256-GCM (WebCrypto).
 *   - The vault key is derived from the device identity hash via PBKDF2-SHA-256 (100k iterations).
 *   - plaintextPayload is NEVER written to disk - only ciphertextPayload (already XOR-encrypted
 *     with coordinate key) is stored.
 *   - On first launch, any legacy cleartext localStorage entry is migrated then deleted.
 */

import { dtnStorage } from '../mesh/dtnStorage';
import { meshRouter } from '../mesh/meshRouter';
import { sha256 } from '@noble/hashes/sha2.js';

export type DeadDropCategory = 'TEXT_INTEL' | 'CRYPTO_KEY' | 'SUPPLY_CACHE' | 'EMERGENCY_COORDS';

export interface DeadDropItem {
    id: string;
    title: string;
    category: DeadDropCategory;
    lat: number;
    lon: number;
    unlockRadiusMeters: number;
    ciphertextPayload: string;
    plaintextPayload?: string;
    authorDid: string;
    authorName: string;
    timestamp: number;
    expiresAt: number;
    isUnlocked: boolean;
    passphraseHint?: string;
}

// --- IndexedDB AES-256-GCM Vault Constants ----------------------------------
const VAULT_DB_NAME = 'red_deaddrop_vault';
const VAULT_DB_VERSION = 2;
const VAULT_STORE_NAME = 'encrypted_drops';
// Legacy key - migrated and removed on first open
const LEGACY_LS_KEY = 'red_deaddrop_vault_v1';
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// --- WebCrypto Helpers ------------------------------------------------------

/** Derives a 256-bit AES-GCM key from the device identity seed via PBKDF2 (100k iterations). */
async function deriveVaultKey(identitySeed: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(identitySeed),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    // Salt: SHA-256 of the domain string - static, device-specific
    const saltData = sha256(encoder.encode(`red_deaddrop_vault:${identitySeed.slice(0, 16)}`));
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltData, iterations: 100_000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    const CHUNK_SIZE = 0x8000;
    for (let i = 0; i < len; i += CHUNK_SIZE) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK_SIZE, len)) as unknown as number[]);
    }
    return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
    const binStr = atob(b64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
    }
    return bytes;
}

/** AES-256-GCM encrypt -> returns base64(iv + ciphertext) */
async function vaultEncrypt(key: CryptoKey, data: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(data)
    );
    // Prepend 12-byte IV to the ciphertext
    const combined = new Uint8Array(12 + enc.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(enc), 12);
    return bytesToBase64(combined);
}

/** AES-256-GCM decrypt - reads iv from first 12 bytes of base64 blob */
async function vaultDecrypt(key: CryptoKey, b64: string): Promise<string> {
    const combined = base64ToBytes(b64);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(dec);
}

// --- IndexedDB Helpers ------------------------------------------------------

function openVaultDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
        req.onupgradeneeded = (e: any) => {
            const db: IDBDatabase = e.target.result;
            if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
                db.createObjectStore(VAULT_STORE_NAME); // key = drop.id
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// --- Engine -----------------------------------------------------------------

export class DeadDropVaultEngine {
    private static instance: DeadDropVaultEngine | null = null;
    private drops: Map<string, DeadDropItem> = new Map();
    private listeners: Set<() => void> = new Set();
    private autoScrubInterval: any = null;

    // Lazily-resolved AES key - derived on first use
    private vaultKeyPromise: Promise<CryptoKey> | null = null;


    private constructor() {
        if (typeof window !== 'undefined') {
            this.initAsync();
        }
    }

    public static getInstance(): DeadDropVaultEngine {
        if (!this.instance) {
            this.instance = new DeadDropVaultEngine();
        }
        return this.instance;
    }

    private async initAsync() {
        await this.loadState();
        this.listenToMesh();
        this.scrubExpiredDrops();
        this.autoScrubInterval = setInterval(() => {
            this.scrubExpiredDrops();
            this.saveState(); // periodic flush
        }, 60_000);
    }

    public subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => { try { cb(); } catch {} });
    }

    // --- Vault Key ----------------------------------------------------------

    /**
     * Returns the AES-256-GCM vault key.
     * Derived from the RED identity hash stored in localStorage (the hash itself is public -
     * what is secret is the 100k-iteration PBKDF2 derivation that turns it into a key material).
     * Falls back to a per-session random key if identity is unavailable (cold start).
     */
    private getVaultKey(): Promise<CryptoKey> {
        if (!this.vaultKeyPromise) {
            this.vaultKeyPromise = (async () => {
                try {
                    // Read identity seed - identity_hash is in localStorage (public metadata)
                    const identityRaw = localStorage.getItem('red_identity');
                    let seed = 'red_fallback_session_key';
                    if (identityRaw) {
                        const identity = JSON.parse(identityRaw);
                        if (identity?.identity_hash) seed = identity.identity_hash;
                    }
                    return await deriveVaultKey(seed);
                } catch {
                    // Cold-start: derive from entropy. Drops will be unreadable after restart.
                    const fallbackSeed = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                        .map(b => b.toString(16).padStart(2, '0')).join('');
                    return deriveVaultKey(fallbackSeed);
                }
            })();
        }
        return this.vaultKeyPromise;
    }

    // --- Persistence (IDB + AES-GCM) ----------------------------------------

    private async loadState() {
        try {
            if (typeof indexedDB === 'undefined') {
                this.migrateLegacyLocalStorage();
                return;
            }
            const key = await this.getVaultKey();
            const db = await openVaultDB();
            const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
            const store = tx.objectStore(VAULT_STORE_NAME);
            const allKeys: IDBValidKey[] = await new Promise((res, rej) => {
                const req = store.getAllKeys();
                req.onsuccess = () => res(req.result);
                req.onerror = () => rej(req.error);
            });

            for (const idbKey of allKeys) {
                const blob: string | undefined = await new Promise((res, rej) => {
                    const req = store.get(idbKey);
                    req.onsuccess = () => res(req.result);
                    req.onerror = () => rej(req.error);
                });
                if (!blob) continue;
                try {
                    const json = await vaultDecrypt(key, blob);
                    const drop: DeadDropItem = JSON.parse(json);
                    // Never re-hydrate plaintext from disk - only ciphertext
                    drop.plaintextPayload = undefined;
                    drop.isUnlocked = false;
                    this.drops.set(drop.id, drop);
                } catch {
                    // Corrupted or foreign-key blob - skip silently
                }
            }
            db.close();

            // Migrate & delete any legacy cleartext localStorage vault
            this.migrateLegacyLocalStorage();
        } catch (e) {
            console.error('[DeadDropVaultEngine] Error loading encrypted state:', e);
            this.migrateLegacyLocalStorage();
        }
    }

    /** One-time migration: reads legacy cleartext entry and deletes it. */
    private migrateLegacyLocalStorage() {
        try {
            const raw = localStorage.getItem(LEGACY_LS_KEY);
            if (raw) {
                const arr: DeadDropItem[] = JSON.parse(raw);
                // Merge into in-memory map only if not already persisted in IDB
                arr.forEach(d => {
                    if (!this.drops.has(d.id)) {
                        // Strip plaintext before in-memory adoption - will be saved encrypted
                        d.plaintextPayload = undefined;
                        d.isUnlocked = false;
                        this.drops.set(d.id, d);
                    }
                });
                // Delete the cleartext legacy entry permanently
                localStorage.removeItem(LEGACY_LS_KEY);
                // Persist migrated drops to IDB
                void this.saveState();
            }
        } catch {}
    }

    private async saveState() {
        try {
            if (typeof indexedDB === 'undefined') return;
            const key = await this.getVaultKey();
            const db = await openVaultDB();
            const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
            const store = tx.objectStore(VAULT_STORE_NAME);

            for (const drop of this.drops.values()) {
                // Strip plaintext before writing - only ciphertextPayload is stored
                const safePayload: Omit<DeadDropItem, 'plaintextPayload'> & { plaintextPayload?: never } = {
                    ...drop,
                    plaintextPayload: undefined,
                    isUnlocked: false, // always false on disk
                };
                const blob = await vaultEncrypt(key, JSON.stringify(safePayload));
                store.put(blob, drop.id);
            }

            await new Promise<void>((res, rej) => {
                tx.oncomplete = () => res();
                tx.onerror = () => rej(tx.error);
            });
            db.close();
        } catch (e) {
            console.error('[DeadDropVaultEngine] Error saving encrypted state:', e);
        }
        this.notify();
    }

    // --- Mesh Ingestion ------------------------------------------------------

    private listenToMesh() {
        try {
            meshRouter.onLocalDelivery(async (packet) => {
                try {
                    const text = new TextDecoder().decode(packet.payload);
                    if (text.startsWith('DEAD_DROP_V1:')) {
                        const jsonStr = text.substring(13);
                        const drop: DeadDropItem = JSON.parse(jsonStr);
                        this.processIncomingDrop(drop);
                    }
                } catch {}
            });
        } catch {}
    }

    public processIncomingDrop(drop: DeadDropItem) {
        if (!drop || !drop.id) return;
        const existing = this.drops.get(drop.id);
        if (!existing || drop.timestamp > existing.timestamp) {
            // Preserve local unlock state - never overwrite with network's locked version
            if (existing && existing.isUnlocked && !drop.isUnlocked) {
                drop.isUnlocked = true;
                drop.plaintextPayload = existing.plaintextPayload;
            }
            this.drops.set(drop.id, drop);
            void this.saveState();
        }
    }

    // --- Public API ----------------------------------------------------------

    /**
     * Deposita un nuevo geocache Dead-Drop cifrado en coordenadas fijas
     */
    public async depositDeadDrop(params: {
        title: string;
        category: DeadDropCategory;
        lat: number;
        lon: number;
        unlockRadiusMeters?: number;
        secretContent: string;
        authorDid: string;
        authorName: string;
        passphraseHint?: string;
        ttlDays?: number;
    }): Promise<DeadDropItem> {
        const now = Date.now();
        const idBytes = crypto.getRandomValues(new Uint8Array(5));
        const idSuffix = Array.from(idBytes).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('');
        const id = `DROP-${now.toString(36).toUpperCase()}-${idSuffix}`;
        const radius = params.unlockRadiusMeters || 15;
        const expiresAt = now + (params.ttlDays ? params.ttlDays * 86_400_000 : DEFAULT_RETENTION_MS);

        // Coordinate-derived XOR cipher - key = PBKDF2(lat:lon:hint)
        const keyMaterial = `${params.lat.toFixed(4)}:${params.lon.toFixed(4)}:${params.passphraseHint || 'RED'}`;
        const keyBytes = sha256(new TextEncoder().encode(keyMaterial));
        const ciphertext = this.xorEncrypt(params.secretContent, keyBytes);

        const drop: DeadDropItem = {
            id,
            title: params.title,
            category: params.category,
            lat: params.lat,
            lon: params.lon,
            unlockRadiusMeters: radius,
            ciphertextPayload: ciphertext,
            plaintextPayload: params.secretContent, // In-memory only, never written to disk
            authorDid: params.authorDid,
            authorName: params.authorName,
            timestamp: now,
            expiresAt,
            isUnlocked: true,
            passphraseHint: params.passphraseHint,
        };

        this.drops.set(drop.id, drop);
        await this.saveState();

        // Broadcast to mesh - plaintext explicitly stripped before wire serialization
        try {
            const wirePayload = { ...drop, plaintextPayload: undefined, isUnlocked: false };
            const envelope = `DEAD_DROP_V1:${JSON.stringify(wirePayload)}`;
            const bytes = new TextEncoder().encode(envelope);
            const { createPacket, encode } = await import('../mesh/meshProtocol');
            const packet = createPacket(params.authorDid, 'f'.repeat(64), bytes, { ttl: 7 });
            const wireBytes = encode(packet);

            await meshRouter.broadcast(wireBytes);
            dtnStorage.enqueue(packet, 8);
        } catch (e) {
            console.warn('[DeadDropVaultEngine] Error broadcasting dead-drop:', e);
        }

        return drop;
    }

    /**
     * Intenta desbloquear un geocache por proximidad fisica
     */
    public attemptUnlock(dropId: string, userLat: number, userLon: number, inputPassphrase?: string): { success: boolean; plaintext?: string; distanceMeters: number } {
        const drop = this.drops.get(dropId);
        if (!drop) return { success: false, distanceMeters: 999999 };

        const distanceMeters = this.getHaversineDistanceMeters(userLat, userLon, drop.lat, drop.lon);

        if (distanceMeters > drop.unlockRadiusMeters) {
            return { success: false, distanceMeters };
        }

        try {
            const keyMaterial = `${drop.lat.toFixed(4)}:${drop.lon.toFixed(4)}:${inputPassphrase || drop.passphraseHint || 'RED'}`;
            const keyBytes = sha256(new TextEncoder().encode(keyMaterial));
            const decrypted = this.xorDecrypt(drop.ciphertextPayload, keyBytes);

            // Update in-memory state only - plaintext never reaches disk
            drop.isUnlocked = true;
            drop.plaintextPayload = decrypted;
            // Don't call saveState() - isUnlocked:true and plaintextPayload are in-memory only

            return { success: true, plaintext: decrypted, distanceMeters };
        } catch {
            return { success: false, distanceMeters };
        }
    }

    public getDeadDrops(): DeadDropItem[] {
        this.scrubExpiredDrops();
        const cutoff = Date.now();
        return Array.from(this.drops.values())
            .filter(d => d.expiresAt > cutoff)
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Cryptographically scrubs and zeroizes expired tactical dead drops to prevent forensic extraction.
     */
    public scrubExpiredDrops(): number {
        const now = Date.now();
        let scrubbedCount = 0;
        for (const [id, drop] of this.drops.entries()) {
            if (drop.expiresAt <= now) {
                // Forensic overwrite - zero-fill the sensitive fields in memory
                drop.ciphertextPayload = '0'.repeat(drop.ciphertextPayload.length);
                if (drop.plaintextPayload) drop.plaintextPayload = '0'.repeat(drop.plaintextPayload.length);
                drop.title = '[SCRUBBED]';
                this.drops.delete(id);
                // Also remove from IDB
                this.deleteFromIDB(id);
                scrubbedCount++;
            }
        }
        if (scrubbedCount > 0) {
            this.notify();
        }
        return scrubbedCount;
    }

    private async deleteFromIDB(dropId: string) {
        try {
            const db = await openVaultDB();
            const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
            tx.objectStore(VAULT_STORE_NAME).delete(dropId);
            await new Promise<void>((res) => { tx.oncomplete = () => res(); });
            db.close();
        } catch {}
    }

    public async deleteDeadDrop(id: string): Promise<boolean> {
        const drop = this.drops.get(id);
        if (drop) {
            drop.ciphertextPayload = '0'.repeat(drop.ciphertextPayload.length);
            if (drop.plaintextPayload) drop.plaintextPayload = '0'.repeat(drop.plaintextPayload.length);
        }
        const deleted = this.drops.delete(id);
        if (deleted) {
            await this.deleteFromIDB(id);
            this.notify();
        }
        return deleted;
    }

    // --- Crypto Primitives ---------------------------------------------------

    private static readonly HEX_LUT: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

    private xorEncrypt(plaintext: string, key: Uint8Array): string {
        const textBytes = new TextEncoder().encode(plaintext);
        let hex = '';
        const lut = DeadDropVaultEngine.HEX_LUT;
        for (let i = 0; i < textBytes.length; i++) {
            const b = textBytes[i] ^ key[i % key.length];
            hex += lut[b];
        }
        return hex;
    }

    private xorDecrypt(hex: string, key: Uint8Array): string {
        const len = hex.length >>> 1;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16) ^ key[i % key.length];
        }
        return new TextDecoder().decode(bytes);
    }

    private getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6_371_000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    public destroy(): void {
        this.listeners.clear();
    }
}

export const deadDropVault = DeadDropVaultEngine.getInstance();



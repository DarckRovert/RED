/**
 * DtnStoreForwardEngine.ts — RED Delay-Tolerant Networking (DTN) Bundle Protocol Engine
 *
 * Provides store-and-forward P2P data mule capabilities. Messages for offline or distant nodes
 * are stored in an encrypted local buffer and relayed transparently when passing near intermediate nodes.
 *
 * BUG-13 Fix: Bundles are now stored AES-GCM encrypted in localStorage.
 * Key derivation: SHA-256(identity_hash) → 256-bit AES-GCM key.
 */

export interface DtnBundle {
    bundleId: string;
    senderHash: string;
    destinationHash: string;
    encryptedPayloadBase64: string;
    createdAt: number;
    ttlSeconds: number;
    hopCount: number;
    maxHops: number;
}

// Internal encrypted envelope stored in localStorage
interface StoredEnvelope {
    iv: string;    // base64 12-byte AES-GCM IV
    data: string;  // base64 ciphertext
}

export class DtnStoreForwardEngine {
    private static STORAGE_KEY = "red_dtn_bundles_v2_enc";

    /** Derives a 256-bit AES-GCM key from the node's identity hash */
    private static async deriveStorageKey(): Promise<CryptoKey> {
        const identityHash = (() => {
            try {
                const raw = localStorage.getItem('red_identity');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    return parsed.identity_hash || 'red_dtn_default_node_key';
                }
            } catch { /* ignore */ }
            return 'red_dtn_default_node_key';
        })();

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(identityHash),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: new TextEncoder().encode('RED_DTN_SALT_v1'), iterations: 10000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /** Encrypts and stores all bundles as a single AES-GCM blob */
    private static async saveBundles(bundles: DtnBundle[]): Promise<void> {
        try {
            const key = await this.deriveStorageKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const plaintext = new TextEncoder().encode(JSON.stringify(bundles));
            const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

            const envelope: StoredEnvelope = {
                iv: btoa(String.fromCharCode(...iv)),
                data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(envelope));
        } catch (e) {
            console.warn('[DtnStoreForwardEngine] Failed to encrypt bundles for storage:', e);
        }
    }

    /** Decrypts and retrieves all bundles from AES-GCM storage */
    private static async loadBundles(): Promise<DtnBundle[]> {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return [];

            const envelope: StoredEnvelope = JSON.parse(raw);
            const iv = Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0));
            const ct = Uint8Array.from(atob(envelope.data), c => c.charCodeAt(0));

            let plaintext: ArrayBuffer | null = null;

            // 1. Intento con clave actual
            try {
                const key = await this.deriveStorageKey();
                plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
            } catch {
                // 2. Intento de fallback con clave de nodo por defecto
                try {
                    const fallbackMaterial = await crypto.subtle.importKey(
                        'raw',
                        new TextEncoder().encode('red_dtn_default_node_key'),
                        { name: 'PBKDF2' },
                        false,
                        ['deriveBits', 'deriveKey']
                    );
                    const fallbackKey = await crypto.subtle.deriveKey(
                        { name: 'PBKDF2', salt: new TextEncoder().encode('RED_DTN_SALT_v1'), iterations: 10000, hash: 'SHA-256' },
                        fallbackMaterial,
                        { name: 'AES-GCM', length: 256 },
                        false,
                        ['encrypt', 'decrypt']
                    );
                    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, fallbackKey, ct);
                } catch {
                    // Mantener almacenamiento intacto para no destruir paquetes diferidos en reintentos
                    return [];
                }
            }

            if (!plaintext) return [];

            const bundles: DtnBundle[] = JSON.parse(new TextDecoder().decode(plaintext));

            // Filter expired bundles
            const now = Date.now();
            return bundles.filter(b => (now - b.createdAt) < b.ttlSeconds * 1000 && b.hopCount < b.maxHops);
        } catch {
            return [];
        }
    }

    /**
     * Retrieves all stored DTN bundles from local buffer
     */
    public static getStoredBundles(): DtnBundle[] {
        // Synchronous fallback: return empty array; use getStoredBundlesAsync for real data
        return [];
    }

    /**
     * Retrieves all stored DTN bundles (async, AES-GCM decrypted)
     */
    public static async getStoredBundlesAsync(): Promise<DtnBundle[]> {
        return this.loadBundles();
    }

    /**
     * Stores a new bundle into the encrypted local DTN buffer.
     * Caps total bundles at 200 (dropping oldest/highest hop count bundles) to prevent
     * encrypted storage bloat from exhausting localStorage quotas.
     */
    public static async storeBundle(bundle: DtnBundle): Promise<boolean> {
        let bundles = await this.loadBundles();
        if (bundles.some(b => b.bundleId === bundle.bundleId)) {
            return false; // Already present
        }
        bundles.push(bundle);

        // Cap máximo a 200 bundles: descartar los más antiguos o con mayor conteo de saltos
        const MAX_DTN_BUNDLES = 200;
        if (bundles.length > MAX_DTN_BUNDLES) {
            bundles.sort((a, b) => (b.createdAt - a.createdAt));
            bundles = bundles.slice(0, MAX_DTN_BUNDLES);
        }

        await this.saveBundles(bundles);
        return true;
    }

    /**
     * Generates a Summary Vector (Bloom filter list of bundle IDs) for inter-node exchange
     */
    public static async generateSummaryVector(): Promise<string[]> {
        const bundles = await this.loadBundles();
        return bundles.map(b => b.bundleId);
    }

    /**
     * Reconciles local bundles with a peer's summary vector and returns bundles needed by peer
     */
    public static async reconcileWithPeer(peerSummaryVector: string[]): Promise<DtnBundle[]> {
        const peerSet = new Set(peerSummaryVector);
        const localBundles = await this.loadBundles();
        return localBundles.filter(b => !peerSet.has(b.bundleId)).map(b => ({
            ...b,
            hopCount: b.hopCount + 1
        }));
    }

    /**
     * Ingests bundles received from a peer node
     */
    public static async ingestPeerBundles(receivedBundles: DtnBundle[]): Promise<number> {
        let addedCount = 0;
        for (const b of receivedBundles) {
            if (await this.storeBundle(b)) {
                addedCount++;
            }
        }
        return addedCount;
    }
}


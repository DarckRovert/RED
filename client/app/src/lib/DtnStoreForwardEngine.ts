/**
 * DtnStoreForwardEngine.ts — RED Delay-Tolerant Networking (DTN) Bundle Protocol Engine
 * 
 * Provides store-and-forward P2P data mule capabilities. Messages for offline or distant nodes
 * are stored in an encrypted local buffer and relayed transparently when passing near intermediate nodes.
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

export class DtnStoreForwardEngine {
    private static STORAGE_KEY = "red_dtn_bundles_v1";

    /**
     * Retrieves all stored DTN bundles from local buffer
     */
    public static getStoredBundles(): DtnBundle[] {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return [];
            const bundles: DtnBundle[] = JSON.parse(raw);
            const now = Date.now();
            // Filter out expired bundles (TTL)
            return bundles.filter(b => (now - b.createdAt) < b.ttlSeconds * 1000 && b.hopCount < b.maxHops);
        } catch {
            return [];
        }
    }

    /**
     * Stores a new bundle into the local DTN buffer
     */
    public static storeBundle(bundle: DtnBundle): boolean {
        const bundles = this.getStoredBundles();
        if (bundles.some(b => b.bundleId === bundle.bundleId)) {
            return false; // Already present
        }
        bundles.push(bundle);
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bundles));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Generates a Summary Vector (Bloom filter list of bundle IDs) for inter-node exchange
     */
    public static generateSummaryVector(): string[] {
        return this.getStoredBundles().map(b => b.bundleId);
    }

    /**
     * Reconciles local bundles with a peer's summary vector and returns bundles needed by peer
     */
    public static reconcileWithPeer(peerSummaryVector: string[]): DtnBundle[] {
        const peerSet = new Set(peerSummaryVector);
        const localBundles = this.getStoredBundles();

        // Return bundles local node has that peer is missing
        return localBundles.filter(b => !peerSet.has(b.bundleId)).map(b => ({
            ...b,
            hopCount: b.hopCount + 1
        }));
    }

    /**
     * Ingests bundles received from a peer node
     */
    public static ingestPeerBundles(receivedBundles: DtnBundle[]): number {
        let addedCount = 0;
        receivedBundles.forEach(b => {
            if (this.storeBundle(b)) {
                addedCount++;
            }
        });
        return addedCount;
    }
}

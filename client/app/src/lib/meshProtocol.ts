/**
 * RED — Mesh Store-and-Forward Protocol
 * Enables offline messaging when the destination device is not currently reachable.
 * Messages are encrypted, stored locally, and retransmitted when a route appears.
 *
 * Key properties:
 *  - TTL-limited (30 min default) to prevent stale message storms
 *  - Deduplication via unique message IDs
 *  - Hop-count limit to prevent routing loops
 *  - Payload always pre-encrypted (RED E2E crypto layer handles this)
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000;  // 30 minutes
const MAX_HOPS = 5;
const MAX_STORED_MSGS = 500;
const STORAGE_KEY = 'red_mesh_store';

export interface MeshMessage {
    /** Globally unique message ID */
    id: string;
    /** Destination peer ID */
    to: string;
    /** Originating peer ID */
    from: string;
    /** Encrypted payload (handled by RED crypto layer) */
    payload: number[]; // JSON-serializable Uint8Array
    /** Unix timestamp of creation (ms) */
    createdAt: number;
    /** TTL expiration timestamp (ms) */
    expiresAt: number;
    /** Number of hops traversed */
    hops: number;
    /** Whether this message is routed via Simulated Onion Routing */
    isOnion?: boolean;
    /** Obfuscated route ID (for Onion mode) */
    routeId?: string;
}

export interface MeshStats {
    stored: number;
    delivered: number;
    dropped: number;
    forwarded: number;
}

type DeliverCallback = (msg: MeshMessage) => Promise<boolean>;

export class MeshProtocol {
    private store = new Map<string, MeshMessage>();
    private seen = new Set<string>();
    private stats: MeshStats = { stored: 0, delivered: 0, dropped: 0, forwarded: 0 };
    private deliverFn: DeliverCallback | null = null;
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this._loadFromStorage();
        // Cleanup expired messages every 2 minutes
        if (typeof setInterval !== 'undefined') {
            this.cleanupInterval = setInterval(() => this._cleanup(), 2 * 60 * 1000);
        }
    }

    get stats_(): MeshStats { return { ...this.stats }; }
    get storedCount(): number { return this.store.size; }

    /**
     * Register the delivery function — called when attempting to forward a message.
     * Should return true if the message was successfully delivered to the peer.
     */
    onDeliver(fn: DeliverCallback): void {
        this.deliverFn = fn;
    }

    /**
     * Enqueue a message for a target peer.
     * Call this when you can't reach the peer directly right now.
     */
    enqueue(to: string, from: string, payload: Uint8Array, ttlMs = DEFAULT_TTL_MS): MeshMessage {
        const id = this._generateId();
        const now = Date.now();

        // Evict oldest if at capacity
        if (this.store.size >= MAX_STORED_MSGS) {
            const oldest = Array.from(this.store.values())
                .sort((a, b) => a.createdAt - b.createdAt)[0];
            this.store.delete(oldest.id);
            this.stats.dropped++;
        }

        const msg: MeshMessage = {
            id,
            to,
            from,
            payload: Array.from(payload),
            createdAt: now,
            expiresAt: now + ttlMs,
            hops: 0,
            isOnion: true, // Default to Onion Routing for privacy
            routeId: this._generateId().slice(0, 8),
        };

        this.store.set(id, msg);
        this.seen.add(id);
        this.stats.stored++;
        this._saveToStorage();
        console.log(`[Mesh] Enqueued message ${id.slice(0, 8)}… for ${to.slice(0, 12)}`);
        return msg;
    }

    /**
     * Called when a mesh message is received from a neighboring peer.
     * If we're the destination, deliver locally. Otherwise, store for forwarding.
     */
    async receive(localId: string, msg: MeshMessage): Promise<void> {
        // Deduplication
        if (this.seen.has(msg.id)) return;
        this.seen.add(msg.id);

        // Drop expired or over-hopped
        if (Date.now() > msg.expiresAt || msg.hops >= MAX_HOPS) {
            this.stats.dropped++;
            return;
        }

        if (msg.to === localId) {
            // We're the destination — deliver
            const delivered = this.deliverFn ? await this.deliverFn(msg) : false;
            if (delivered) {
                this.stats.delivered++;
                this.store.delete(msg.id);
                this._saveToStorage();
            } else {
                // Re-queue in case we can't deliver yet (e.g., app in background)
                this.store.set(msg.id, msg);
            }
        } else {
            // Simulated Onion Routing: We don't know the final destination if it's an onion packet,
            // we just act as a relay node. E2E encryption protects the payload.
            const relayMsg = { ...msg, hops: msg.hops + 1 };
            this.store.set(relayMsg.id, relayMsg);
            this.stats.forwarded++;
            this._saveToStorage();
            console.log(`[Mesh] Stored onion relay packet (route ${relayMsg.routeId || 'unknown'}) (hop ${relayMsg.hops})`);
        }
    }

    /**
     * Attempt to deliver all stored messages to the given peer.
     * Call when a new peer connects that might be the destination or a relay.
     */
    async flushTo(peerId: string): Promise<void> {
        if (!this.deliverFn) return;

        const pending = Array.from(this.store.values())
            .filter(m => m.to === peerId && Date.now() < m.expiresAt);

        for (const msg of pending) {
            const delivered = await this.deliverFn(msg);
            if (delivered) {
                this.store.delete(msg.id);
                this.stats.delivered++;
            }
        }

        if (pending.length > 0) {
            this._saveToStorage();
            console.log(`[Mesh] Flushed ${pending.length} stored messages to ${peerId.slice(0, 12)}`);
        }
    }

    /**
     * Get all messages stored for forwarding to a peer
     * (so we can advertise relay capability to neighbors).
     */
    getRelayableFor(peerId: string): MeshMessage[] {
        return Array.from(this.store.values())
            .filter(m => m.to === peerId && Date.now() < m.expiresAt);
    }

    /**
     * Serialize all pending stored messages for gossip relay.
     * Returns messages not originally from the given sender (avoid echo).
     */
    getGossipBatch(excludeFrom: string, maxCount = 10): MeshMessage[] {
        const now = Date.now();
        return Array.from(this.store.values())
            .filter(m => m.from !== excludeFrom && m.expiresAt > now && m.hops < MAX_HOPS)
            .sort((a, b) => a.createdAt - b.createdAt)
            .map(m => {
                // If it's an onion message, obfuscate the origin when gossiping
                if (m.isOnion) {
                    return { ...m, from: `onion-relay-${m.routeId}` };
                }
                return m;
            })
            .slice(0, maxCount);
    }

    dispose(): void {
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        this.store.clear();
        this.seen.clear();
    }

    // ── Private ──────────────────────────────────────────────

    private _cleanup(): void {
        const now = Date.now();
        let removed = 0;
        for (const [id, msg] of this.store) {
            if (msg.expiresAt <= now || msg.hops >= MAX_HOPS) {
                this.store.delete(id);
                this.stats.dropped++;
                removed++;
            }
        }
        if (removed > 0) {
            this._saveToStorage();
            console.log(`[Mesh] Cleaned up ${removed} expired messages`);
        }
    }

    private _generateId(): string {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    private _saveToStorage(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            const data = Array.from(this.store.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch { /* storage error — ignore */ }
    }

    private _loadFromStorage(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data: MeshMessage[] = JSON.parse(raw);
            const now = Date.now();
            data.forEach(msg => {
                if (msg.expiresAt > now && msg.hops < MAX_HOPS) {
                    this.store.set(msg.id, msg);
                    this.seen.add(msg.id);
                }
            });
            console.log(`[Mesh] Loaded ${this.store.size} stored messages from storage`);
        } catch { /* corrupted storage — ignore */ }
    }
}

export const meshProtocol = new MeshProtocol();

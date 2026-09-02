/**
 * RED AutoDestructEngine — Sovereign Ephemeral Message Lifecycle Manager.
 * 
 * Automatically counts down message TTLs, purges expired text and media
 * from all local persistence tiers (IndexedDB vault, localStorage, Sled, Zustand),
 * and notifies active UI subscribers.
 */

import { MessageItem } from '../api';
import { indexedMediaVault } from './indexedMediaVault';

type ExpireCallback = (msgId: string) => void;

class AutoDestructEngineClass {
    private activeTimers: Map<string, NodeJS.Timeout> = new Map();
    private subscribers: Set<ExpireCallback> = new Set();
    private tickInterval: NodeJS.Timeout | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.startTickLoop();
        }
    }

    /**
     * Registers a message with an expiration timestamp or TTL in seconds.
     */
    public registerMessage(msg: MessageItem) {
        if (!msg.id) return;
        const nowSec = Date.now() / 1000;
        
        let expiresAt: number | null = null;
        if (msg.expires_at && msg.expires_at > 0) {
            expiresAt = msg.expires_at > 1e11 ? msg.expires_at / 1000 : msg.expires_at;
        } else if (msg.ttl && msg.ttl > 0) {
            const baseTs = msg.timestamp > 1e11 ? msg.timestamp / 1000 : (msg.timestamp || nowSec);
            expiresAt = baseTs + msg.ttl;
        }

        if (!expiresAt) return;

        const remainingSec = expiresAt - nowSec;
        if (remainingSec <= 0) {
            // Already expired, purge immediately
            void this.purgeMessage(msg.id);
            return;
        }

        // Clear existing timer if any
        if (this.activeTimers.has(msg.id)) {
            clearTimeout(this.activeTimers.get(msg.id)!);
        }

        // Bound to 32-bit signed int max (2147483647 ms ≈ 24.8 days) to avoid V8 timer overflow
        const delayMs = Math.min(2147483647, Math.max(50, Math.round(remainingSec * 1000)));

        // Set timer for exact moment
        const timer = setTimeout(() => {
            void this.purgeMessage(msg.id);
        }, delayMs);

        this.activeTimers.set(msg.id, timer);
    }

    /**
     * Purges expired message from all storage tiers and notifies UI.
     */
    public async purgeMessage(msgId: string) {
        if (this.activeTimers.has(msgId)) {
            clearTimeout(this.activeTimers.get(msgId)!);
            this.activeTimers.delete(msgId);
        }

        // 1. Delete associated media from IndexedDB vault
        try {
            await indexedMediaVault.deleteMedia(msgId);
        } catch {}

        // 2. Remove from active Zustand store
        try {
            const { useRedStore } = await import('../../store/useRedStore');
            const state = useRedStore.getState();
            const filtered = state.messages.filter(m => m.id !== msgId);
            if (filtered.length !== state.messages.length) {
                useRedStore.setState({ messages: filtered });
            }
        } catch {}

        // 3. Purge from localStorage web store
        if (typeof window !== 'undefined') {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('red_web_messages_')) {
                        const raw = localStorage.getItem(key);
                        if (raw && raw.includes(msgId)) {
                            const parsed: MessageItem[] = JSON.parse(raw);
                            const updated = parsed.filter(m => m.id !== msgId);
                            localStorage.setItem(key, JSON.stringify(updated));
                        }
                    }
                }
            } catch {}
        }

        // 4. Notify all registered UI callbacks
        this.subscribers.forEach(cb => {
            try { cb(msgId); } catch {}
        });
    }

    /**
     * Subscribe to message purge events.
     */
    public onPurge(cb: ExpireCallback): () => void {
        this.subscribers.add(cb);
        return () => {
            this.subscribers.delete(cb);
        };
    }

    /**
     * Background interval to catch any messages whose timers might have slipped during device sleep.
     */
    private startTickLoop() {
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = setInterval(() => {
            if (typeof window === 'undefined') return;
            const nowSec = Date.now() / 1000;
            try {
                // Collect target keys first to prevent concurrent loop index shifting
                const keys: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('red_web_messages_')) {
                        keys.push(k);
                    }
                }

                for (const key of keys) {
                    const raw = localStorage.getItem(key);
                    if (raw && (raw.includes('"expires_at"') || raw.includes('"ttl"'))) {
                        const parsed: MessageItem[] = JSON.parse(raw);
                        const expiredIds: string[] = [];
                        const kept = parsed.filter(m => {
                            let exp = m.expires_at;
                            if (exp && exp > 1e11) exp = exp / 1000;
                            if (!exp && m.ttl) {
                                const base = m.timestamp > 1e11 ? m.timestamp / 1000 : m.timestamp;
                                exp = base + m.ttl;
                            }
                            if (exp && exp <= nowSec) {
                                expiredIds.push(m.id);
                                return false;
                            }
                            return true;
                        });

                        if (expiredIds.length > 0) {
                            localStorage.setItem(key, JSON.stringify(kept));
                            for (const id of expiredIds) {
                                void this.purgeMessage(id);
                            }
                        }
                    }
                }
            } catch {}
        }, 5000);
    }

    public destroy(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        for (const timer of this.activeTimers.values()) {
            clearTimeout(timer);
        }
        this.activeTimers.clear();
        this.subscribers.clear();
    }
}

export const AutoDestructEngine = new AutoDestructEngineClass();

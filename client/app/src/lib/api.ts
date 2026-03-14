/**
 * RED API Client
 * Connects to the local RED node HTTP API.
 * Development: http://localhost:7333 (set in .env.local)
 * Production:  set NEXT_PUBLIC_API_URL to a Cloudflare Tunnel URL
 */

import { Capacitor } from '@capacitor/core';

let BASE_URL = 'http://localhost:7333/api';

if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    // When running inside the Android APK, connect to the embedded Rust node
    BASE_URL = 'http://127.0.0.1:4555/api';
} else if (process.env.NEXT_PUBLIC_API_URL) {
    // In Production Web (PWA), connect to the Cloudflare Tunnel
    BASE_URL = process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api';
}

export interface IdentityResponse {
    identity_hash: string;
    short_id: string;
}

export interface StatusResponse {
    is_running: boolean;
    peer_count: number;
    identity_hash: string;
    version: string;
    // FIX A4: enriched fields from backend
    chain_height?: number;
    gossip_latency_ms?: number;
}

export interface ConversationItem {
    id: string;
    peer: string;
    message_count: number;
    last_message: string | null;
    unread_count?: number;
    last_timestamp: number;
    disappearing_timer?: number;
    is_burner?: boolean;
    is_pinned?: boolean;
    is_muted?: boolean;
}

export interface Reaction {
    emoji: string;
    senders: string[];
}

export interface MessageItem {
    id: string;
    sender: string;
    content: string;
    msg_type: string;
    timestamp: number;
    is_mine: boolean;
    status?: 'sent' | 'delivered' | 'read';
    reactions?: Reaction[];
    isDeleted?: boolean;
    editedAt?: number;
    reply_to?: string;
    replyTo?: { id: string; content: string; sender: string };
    media_data?: string;
    mime_type?: string;
    width?: number;
    height?: number;
    duration_ms?: number;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    target_message_id?: string;
    message_ids?: string[];
}

export interface SendMessageOptions {
    msg_type?: string;
    media_data?: string;
    mime_type?: string;
    width?: number;
    height?: number;
    duration_ms?: number;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    target_message_id?: string;
    message_ids?: string[];
    expires_at?: number;
}

// Simple fetch helper — no custom headers so browsers don't fire CORS preflight
const get = (path: string) =>
    fetch(`${BASE_URL}${path}`, { mode: 'cors' });

export class RedAPI {
    static async getStatus(): Promise<StatusResponse> {
        const res = await get('/status');
        if (!res.ok) throw new Error('Failed to fetch node status');
        return res.json();
    }

    static async getIdentity(): Promise<IdentityResponse> {
        const res = await get('/identity');
        if (!res.ok) throw new Error('Failed to fetch identity');
        return res.json();
    }

    static async getConversations(): Promise<ConversationItem[]> {
        const res = await get('/conversations');
        if (!res.ok) throw new Error('Failed to fetch conversations');
        return res.json();
    }

    static async getMessages(conversationId: string): Promise<MessageItem[]> {
        const res = await get(`/conversations/${conversationId}/messages`);
        if (!res.ok) throw new Error('Failed to fetch messages');
        return res.json();
    }

    static async getGroups(): Promise<any[]> {
        const res = await get('/groups');
        if (!res.ok) return [];
        return res.json();
    }

    static async getContacts(): Promise<any[]> {
        const res = await get('/contacts');
        if (!res.ok) return [];
        return res.json();
    }

    // FIX: correct endpoint — backend uses POST /groups not /groups/create
    static async createGroup(name: string): Promise<any> {
        const res = await fetch(`${BASE_URL}/groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (!res.ok) throw new Error('Failed to create group');
        return res.json();
    }

    static async sendGroupMessage(groupId: string, content: string, options?: SendMessageOptions): Promise<{ ok: boolean }> {
        const payload = { content, ...options };
        const res = await fetch(`${BASE_URL}/groups/${groupId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to send group message');
        return { ok: true };
    }

    // FIX L3: addContact calls POST /api/contacts
    static async addContact(identityHash: string, displayName: string): Promise<{ ok: boolean }> {
        const res = await fetch(`${BASE_URL}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity_hash: identityHash, display_name: displayName }),
        });
        if (!res.ok) throw new Error('Failed to add contact');
        return { ok: true };
    }

    // FIX M4: get list of connected P2P peers
    static async getPeers(): Promise<any[]> {
        const res = await fetch(`${BASE_URL}/peers`, { mode: 'cors' });
        if (!res.ok) return [];
        return res.json();
    }

    static async sendMessage(recipient: string, content: string, options?: SendMessageOptions): Promise<{ ok: boolean }> {
        const payload = { recipient, content, ...options };
        const res = await fetch(`${BASE_URL}/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to send message');
        return res.json();
    }

    static subscribeToEvents(onMessage: (data: any) => void): () => void {
        let active = true;
        let reconnectDelay = 1000;

        const poll = async () => {
            while (active) {
                try {
                    const res = await fetch(`${BASE_URL}/events`, {
                        signal: AbortSignal.timeout(60000), // Longer timeout for SSE
                        headers: { 'Cache-Control': 'no-cache' }
                    });
                    
                    if (!res.ok || !res.body) {
                        await new Promise(r => setTimeout(r, reconnectDelay));
                        reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
                        continue;
                    }
                    
                    // Connected successfully
                    reconnectDelay = 1000;
                    
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    
                    while (active) {
                        try {
                            const { value, done } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value, { stream: true });
                            for (const line of chunk.split('\n')) {
                                if (line.startsWith('data: ')) {
                                    try { onMessage(JSON.parse(line.slice(6))); } catch { /* ignore */ }
                                }
                            }
                        } catch (err) {
                            // DOMException or network error reading the stream (e.g., waking from background)
                            break;
                        }
                    }
                } catch (err) {
                    // Timeout or Fetch error
                    if (active) {
                        await new Promise(r => setTimeout(r, reconnectDelay));
                        reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
                    }
                }
            }
        };

        poll();
        return () => { active = false; };
    }
}

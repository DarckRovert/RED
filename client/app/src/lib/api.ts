/**
 * RED 2.0 API Client
 * Clean, synchronous bridge to the local Rust Node.
 */

export interface IdentityResponse {
    identity_hash: string;
    short_id: string;
}

export interface StatusResponse {
    is_running: boolean;
    peer_count: number;
    identity_hash: string;
    version: string;
    chain_height: number;
    gossip_latency_ms?: number;
}

export interface ConversationItem {
    id: string;
    peer: string;
    last_message?: string;
    last_timestamp?: number;
    unread_count?: number;
    is_group?: boolean;
}

export interface MessageItem {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
    is_mine: boolean;
    msg_type?: string;
    media_data?: string;
    mime_type?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    duration_ms?: number;
}

class RedAPIClient {
    private readonly baseURL = 'http://127.0.0.1:7333/api';

    private getFallbackURL() {
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && !window.location.port) {
            return 'http://127.0.0.1:4555/api';
        }
        return 'http://localhost:7333/api';
    }

    private getURL() {
        try {
             const cap = (window as any).Capacitor;
             if (cap?.isNativePlatform?.() || window.location.protocol === 'capacitor:') {
                 return this.baseURL;
             }
        } catch {}
        return this.getFallbackURL();
    }

    public async req<T>(path: string, options?: RequestInit): Promise<T> {
        const url = `${this.getURL()}${path}`;
        const res = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options?.headers
            }
        });
        if (!res.ok) throw new Error(`API Error ${res.status} on ${path}`);
        return res.json();
    }

    async getIdentity(): Promise<IdentityResponse> {
        return this.req<IdentityResponse>('/identity');
    }

    async getStatus(): Promise<StatusResponse> {
        return this.req<StatusResponse>('/status');
    }

    async getConversations(): Promise<ConversationItem[]> {
        return this.req<ConversationItem[]>('/conversations').catch(() => []);
    }

    async getContacts(): Promise<any[]> {
        return this.req<any[]>('/contacts').catch(() => []);
    }
    
    async getGroups(): Promise<any[]> {
        return this.req<any[]>('/groups').catch(() => []);
    }

    async getMessages(conversationId: string): Promise<MessageItem[]> {
        return this.req<MessageItem[]>(`/conversations/${conversationId}/messages`).catch(() => []);
    }

    async sendMessage(recipient: string, content: string, options?: Record<string, any>): Promise<void> {
        const body = { recipient, content, ...options };
        await this.req('/messages/send', { method: 'POST', body: JSON.stringify(body) });
    }

    async addContact(identity_hash: string, display_name: string): Promise<void> {
        const body = { identity_hash, display_name };
        await this.req('/contacts', { method: 'POST', body: JSON.stringify(body) });
    }

    async setBurnerMode(enabled: boolean): Promise<void> {
        await this.req('/settings/burner', { method: 'POST', body: JSON.stringify({ enabled }) }).catch(() => {});
    }

    async setDeadMansDays(days: number): Promise<void> {
        await this.req('/settings/dms', { method: 'POST', body: JSON.stringify({ days }) }).catch(() => {});
    }

    subscribeToEvents(onMessage: (data: any) => void): EventSource | null {
        if (typeof window === 'undefined') return null;
        try {
            const es = new EventSource(`${this.getURL()}/events`);
            es.addEventListener('message', (event) => {
                try { onMessage(JSON.parse(event.data)); } catch (e) {
                    console.warn('[RED SSE] Parse failed', event.data);
                }
            });
            return es;
        } catch {
            return null;
        }
    }
}

export const RedAPI = new RedAPIClient();

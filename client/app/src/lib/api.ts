/**
 * RED API Client
 *
 * Connects to the local RED node HTTP API.
 * In development: http://localhost:7333
 * In production:  set NEXT_PUBLIC_API_URL to your deployed node URL
 *
 * On Android: "localhost" in the WebView refers to the device itself,
 * NOT the developer machine. Always use a real URL for Android builds.
 */

const BASE_URL = (
    process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')
        : 'http://localhost:7333'
) + '/api';

export interface IdentityResponse {
    identity_hash: string;
    short_id: string;
}

export interface StatusResponse {
    is_running: boolean;
    peer_count: number;
    identity_hash: string;
    version: string;
}

export interface ConversationItem {
    id: string;
    peer: string;
    message_count: number;
    last_message: string | null;
    unread_count?: number;
    last_timestamp?: number;
    is_pinned?: boolean;
    is_muted?: boolean;
    is_burner?: boolean; // RAM-only chat flag
}

export interface Reaction {
    emoji: string;
    senders: string[];
}

export interface MessageItem {
    id: string;
    sender: string;
    content: string;
    timestamp: number;
    is_mine: boolean;
    status?: 'sent' | 'delivered' | 'read';
    replyTo?: { id: string; content: string; sender: string };
    reactions?: Reaction[];
    isDeleted?: boolean;
    editedAt?: number;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'video' | 'file';
    mediaMimeType?: string;
}

export class RedAPI {
    /**
     * Get node status
     */
    static async getStatus(): Promise<StatusResponse> {
        const res = await fetch(`${BASE_URL}/status`);
        if (!res.ok) throw new Error('Failed to fetch node status');
        return res.json();
    }

    /**
     * Get node identity
     */
    static async getIdentity(): Promise<IdentityResponse> {
        const res = await fetch(`${BASE_URL}/identity`);
        if (!res.ok) throw new Error('Failed to fetch identity');
        return res.json();
    }

    /**
     * List all conversations
     */
    static async getConversations(): Promise<ConversationItem[]> {
        const res = await fetch(`${BASE_URL}/conversations`);
        if (!res.ok) throw new Error('Failed to fetch conversations');
        return res.json();
    }

    /**
     * Get messages for a specific conversation
     */
    static async getMessages(conversationId: string): Promise<MessageItem[]> {
        const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages`);
        if (!res.ok) throw new Error('Failed to fetch messages');
        return res.json();
    }

    /**
     * Send a message to a recipient
     */
    static async sendMessage(recipient: string, content: string): Promise<{ ok: boolean }> {
        const res = await fetch(`${BASE_URL}/messages/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient, content }),
        });
        if (!res.ok) throw new Error('Failed to send message');
        return res.json();
    }

    /**
     * Subscribe to real-time events via SSE
     */
    static subscribeToEvents(onMessage: (data: any) => void): () => void {
        const eventSource = new EventSource(`${BASE_URL}/events`);

        eventSource.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (e) {
                console.error('Error parsing SSE data:', e);
            }
        });

        eventSource.onerror = (err) => {
            console.error('EventSource failed:', err);
            eventSource.close();
        };

        return () => eventSource.close();
    }
}

/**
 * RED 6.0 API Client
 * Full-typed bridge to the local Rust Node (Axum HTTP + SSE).
 */

export interface IdentityResponse {
    identity_hash: string;
    short_id: string;
    nickname?: string;
    public_key?: string;
}

export interface StatusResponse {
    is_running: boolean;
    peer_count: number;
    identity_hash: string;
    version: string;
    chain_height: number;
    gossip_latency_ms?: number;
    noise_packets_sent?: number;
    sybil_blocked?: number;
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
    msg_type?: string;       // 'text' | 'image' | 'voice' | 'location' | 'poll' | 'reaction' | 'system'
    media_data?: string;
    mime_type?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    duration_ms?: number;
    conversation_id?: string;
    /** Delivery status */
    status?: 'Pending' | 'Sent' | 'Delivered';
    /** Reply/quote metadata — set when this message is a reply to another */
    reply_to?: {
        id: string;
        content: string;
        sender: string;
        msg_type?: string;
    };
    /** Emoji reactions: { "❤️": ["peer1","peer2"], "👍": ["peer3"] } */
    reactions?: Record<string, string[]>;
    /** Poll data */
    poll_data?: {
        question: string;
        options: string[];
        votes: Record<string, string>; // option_index → peer_id
    };
}

/** Peer item returned by /api/peers */
export interface PeerItem {
    id: string;
    is_connected: boolean;
    transport?: string;
    latency_ms?: number;
    noise_session?: boolean;
    addr?: string;
}

/** Block item returned by /api/blockchain/blocks */
export interface BlockItem {
    height: number;
    hash: string;
    prev_hash: string;
    timestamp: number;
    tx_count: number;
    validator: string;
}

/** Validator item returned by /api/blockchain/validators */
export interface ValidatorItem {
    public_key: string;
    stake: number;
    active: boolean;
    blocks_produced: number;
    missed_slots: number;
    weight: number;
}

/** Consensus snapshot from /api/blockchain/consensus */
export interface ConsensusStatus {
    epoch: number;
    current_slot: number;
    total_stake: number;
    active_validators: number;
    chain_height: number;
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

    /** Expose base URL for constructing SSE and WebSocket URLs externally. */
    public getBaseURL() { return this.getURL(); }

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
        if (!res.ok) {
            const body = await res.text().catch(() => '(sin cuerpo)');
            throw new Error(`[RED ${res.status}] ${path}: ${body}`);
        }
        return res.json();
    }

    /**
     * Fetches a list endpoint and unwraps Rust's wrapped response envelope.
     * Handles both plain arrays and { "value": [...] } envelopes.
     */
    public async reqList<T>(path: string): Promise<T[]> {
        const raw: any = await this.req<any>(path);
        if (raw && typeof raw === 'object' && Array.isArray(raw.value)) {
            return raw.value as T[];
        }
        if (Array.isArray(raw)) return raw as T[];
        return [];
    }

    // ── Core ──────────────────────────────────────────────────────────────────

    async getIdentity(): Promise<IdentityResponse> {
        return this.req<IdentityResponse>('/identity');
    }

    async getStatus(): Promise<StatusResponse> {
        return this.req<StatusResponse>('/status');
    }

    // ── Conversations & Contacts ──────────────────────────────────────────────

    async getConversations(): Promise<ConversationItem[]> {
        return this.reqList<ConversationItem>('/conversations').catch(() => []);
    }

    async getContacts(): Promise<any[]> {
        return this.reqList<any>('/contacts').catch(() => []);
    }

    async getGroups(): Promise<any[]> {
        return this.reqList<any>('/groups').catch(() => []);
    }

    async getMessages(conversationId: string): Promise<MessageItem[]> {
        return this.reqList<MessageItem>(`/conversations/${conversationId}/messages`).catch(() => []);
    }

    async sendMessage(recipient: string, content: string, options?: Record<string, any>): Promise<void> {
        const body = { recipient, content, ...options };
        await this.req('/messages/send', { method: 'POST', body: JSON.stringify(body) });
    }

    /**
     * Send a message to a P2P group.
     * The Rust node fans it out to all group members and stores it under the
     * unified group conversation (my_hash, group_id).
     */
    async sendGroupMessage(groupId: string, content: string, options?: Record<string, any>): Promise<void> {
        const body = { content, ...options };
        await this.req(`/groups/${groupId}/send`, { method: 'POST', body: JSON.stringify(body) });
    }

    async addContact(identity_hash: string, display_name: string, public_key?: string | null): Promise<void> {
        const body = { identity_hash, display_name, public_key };
        await this.req('/contacts', { method: 'POST', body: JSON.stringify(body) });
    }

    async blockContact(identity_hash: string): Promise<void> {
        await this.req(`/contacts/${identity_hash}/block`, { method: 'POST' });
    }

    async unblockContact(identity_hash: string): Promise<void> {
        await this.req(`/contacts/${identity_hash}/unblock`, { method: 'POST' });
    }

    async verifyContact(identity_hash: string): Promise<void> {
        await this.req(`/contacts/${identity_hash}/verify`, { method: 'POST' });
    }

    async markRead(conversationId: string): Promise<void> {
        await this.req(`/conversations/${conversationId}/read`, { method: 'POST', body: '{}' }).catch(() => {});
    }

    /** A2: Delete a single message for both parties */
    async deleteMessage(conversationId: string, messageId: string): Promise<void> {
        await this.req(`/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' });
    }

    /** A3: Edit the text of an already-sent message */
    async editMessage(conversationId: string, messageId: string, content: string): Promise<void> {
        await this.req(`/conversations/${conversationId}/messages/${messageId}`, {
            method: 'PATCH',
            body: JSON.stringify({ content }),
        });
    }

    /** Clear all messages in a conversation (both parties) */
    async clearConversation(conversationId: string): Promise<void> {
        await this.req(`/conversations/${conversationId}/clear`, { method: 'DELETE' });
    }

    /** E1: Add a member to a group */
    async addGroupMember(groupId: string, identity_hash: string): Promise<void> {
        await this.req(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ identity_hash }) });
    }

    /** E1: Remove a member from a group */
    async removeGroupMember(groupId: string, memberHash: string): Promise<void> {
        await this.req(`/groups/${groupId}/members/${memberHash}`, { method: 'DELETE' });
    }

    async getProfile(): Promise<any> {
        return this.req<any>('/profile').catch(() => null);
    }

    async setProfile(nickname: string, bio?: string): Promise<void> {
        await this.req('/profile', { method: 'PUT', body: JSON.stringify({ nickname, bio }) });
    }

    // ── Network / Peers ───────────────────────────────────────────────────────

    async getPeers(): Promise<PeerItem[]> {
        return this.reqList<PeerItem>('/peers').catch(() => []);
    }

    async connectPeer(multiaddr: string): Promise<boolean> {
        try {
            await this.req('/network/connect', {
                method: 'POST',
                body: JSON.stringify({ multiaddr }),
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Injects a raw encrypted payload received from a physical mesh transport
     * (BLE, WiFi-Direct, LoRa) into the Rust node's processing queue.
     * @param payload_hex - Hex-encoded encrypted OnionPacket bytes
     * @param is_lora - True if payload arrived via LoRa radio
     */
    async injectMeshPayload(payload_hex: string, is_lora?: boolean): Promise<void> {
        await this.req('/mesh/receive', { 
            method: 'POST', 
            body: JSON.stringify({ payload_hex, is_lora: is_lora ?? false }) 
        });
    }

    // ── Blockchain ────────────────────────────────────────────────────────────

    async getBlocks(): Promise<BlockItem[]> {
        return this.reqList<BlockItem>('/blockchain/blocks').catch(() => []);
    }

    async getValidators(): Promise<ValidatorItem[]> {
        return this.reqList<ValidatorItem>('/blockchain/validators').catch(() => []);
    }

    async getConsensus(): Promise<ConsensusStatus | null> {
        return this.req<ConsensusStatus>('/blockchain/consensus').catch(() => null);
    }

    async stakeTokens(amount: number): Promise<void> {
        await this.req('/blockchain/stake', { method: 'POST', body: JSON.stringify({ amount }) });
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    async setBurnerMode(enabled: boolean): Promise<void> {
        await this.req('/settings/burner', { method: 'POST', body: JSON.stringify({ enabled }) }).catch(() => {});
    }

    /** 
     * Update only the trigger window of the Dead Man's Switch.
     * Reads the current DMS config first so we don't clobber wipe_messages /
     * wipe_identity flags that the user may have set in DMSSettings.
     */
    async setDeadMansDays(days: number): Promise<void> {
        try {
            const current = await this.req<any>('/settings/dms').catch(() => ({}));
            const updated = {
                enabled: current?.enabled ?? true,
                trigger_hours: days * 24,
                wipe_messages: current?.wipe_messages ?? true,
                wipe_identity: current?.wipe_identity ?? false,
                dead_message: current?.dead_message ?? '',
            };
            await this.req('/settings/dms', {
                method: 'POST',
                body: JSON.stringify(updated),
            });
        } catch {
            // Node not ready yet — silently ignore
        }
    }

    // ── SSE / Real-time ───────────────────────────────────────────────────────

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

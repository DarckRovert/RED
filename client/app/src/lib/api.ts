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

// ─── v19.0: Tipos AMBER-RED ───────────────────────────────────────────────────

export type AlertStatus = 'Active' | 'Resolved' | 'Expired' | 'Cancelled';

export interface AmberAlert {
    id: string;
    name: string;
    age: number;
    description: string;
    photo_b64?: string;
    last_seen_lat?: number;
    last_seen_lon?: number;
    last_seen_location?: string;
    issued_at: number;
    expires_at: number;
    authority_node_id: string;
    authority_signature: string;
    status: AlertStatus;
    resolution_notes?: string;
    sighting_count: number;
}

export interface AmberAlertCreate {
    name: string;
    age: number;
    description: string;
    photo_b64?: string;
    last_seen_lat?: number;
    last_seen_lon?: number;
    last_seen_location?: string;
    ttl_secs?: number;
    authority_signature: string;
    authority_node_id: string;
}

export interface AmberSighting {
    alert_id: string;
    reporter_node_id: string;
    reported_at: number;
    lat?: number;
    lon?: number;
    notes?: string;
}

// ─── v19.0: Tipos Guardian IA ─────────────────────────────────────────────────

export interface GuardianStats {
    messages_analyzed: number;
    messages_blocked: number;
    messages_flagged: number;
    images_analyzed: number;
    images_blocked: number;
    api_calls_made: number;
    api_errors: number;
    cache_hits: number;
}

export interface GuardianStatus {
    active: boolean;
    mode: 'strict' | 'warn' | 'off';
    has_api_key: boolean;
    model: string;
    stats: GuardianStats;
    authorities: string[];
}

// ─── v19.0: Funciones API AMBER ───────────────────────────────────────────────

const NODE_URL = typeof window !== 'undefined'
    ? (localStorage.getItem('red_node_url') || 'http://localhost:7333')
    : 'http://localhost:7333';

/** Obtener alertas AMBER activas */
export async function getAmberAlerts(): Promise<AmberAlert[]> {
    const res = await fetch(`${NODE_URL}/api/amber/alerts`);
    if (!res.ok) throw new Error(`AMBER alerts error: ${res.status}`);
    const data = await res.json();
    return data.alerts as AmberAlert[];
}

/** Obtener alerta específica por ID (incluye foto) */
export async function getAmberAlert(id: string): Promise<AmberAlert> {
    const res = await fetch(`${NODE_URL}/api/amber/alerts/${id}`);
    if (!res.ok) throw new Error(`AMBER alert ${id} error: ${res.status}`);
    return res.json() as Promise<AmberAlert>;
}

/** Crear nueva alerta AMBER (requiere autoridad) */
export async function createAmberAlert(payload: AmberAlertCreate): Promise<{ ok: boolean; alert: AmberAlert }> {
    const res = await fetch(`${NODE_URL}/api/amber/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Resolver alerta (persona encontrada) */
export async function resolveAmberAlert(
    id: string,
    payload: { authority_node_id: string; authority_signature: string; resolution_notes?: string }
): Promise<{ ok: boolean; alert: AmberAlert }> {
    const res = await fetch(`${NODE_URL}/api/amber/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Reportar avistamiento */
export async function reportSighting(
    alertId: string,
    payload: { lat?: number; lon?: number; notes?: string }
): Promise<{ ok: boolean }> {
    const res = await fetch(`${NODE_URL}/api/amber/alerts/${alertId}/sighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

// ─── v19.0: Funciones API Guardian ───────────────────────────────────────────

/** Obtener estado del Guardian IA */
export async function getGuardianStatus(): Promise<GuardianStatus> {
    const res = await fetch(`${NODE_URL}/api/guardian/status`);
    if (!res.ok) throw new Error(`Guardian status error: ${res.status}`);
    return res.json() as Promise<GuardianStatus>;
}

/** Reportar contenido manualmente */
export async function reportContent(payload: {
    conversation_id?: string;
    message_id?: string;
    reason: string;
    description?: string;
}): Promise<{ ok: boolean; report_id: string }> {
    const res = await fetch(`${NODE_URL}/api/guardian/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

// ─── v20.0: Interfaces & API SOS + Canales + Chunker ──────────────────────────

export interface SosBeacon {
    id: string;
    sender_did: string;
    sender_name: string;
    lat: number;
    lon: number;
    altitude?: number;
    timestamp: number;
    battery_level: number;
    note: string;
    is_active: boolean;
    signature: string;
}

export interface ChannelMessage {
    id: string;
    channel_id: string;
    sender_did: string;
    sender_name: string;
    content: string;
    timestamp: number;
    hash: string;
    is_moderated: boolean;
}

export interface ChunkManifest {
    file_id: string;
    filename: string;
    total_size: number;
    total_chunks: number;
    root_hash: string;
    chunk_hashes: string[];
}

/** Emitir baliza SOS */
export async function emitSos(payload: {
    sender_name: string;
    lat: number;
    lon: number;
    altitude?: number;
    battery_level: number;
    note: string;
}): Promise<{ ok: boolean; sos: SosBeacon }> {
    const res = await fetch(`${NODE_URL}/api/sos/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Desactivar baliza SOS */
export async function resolveSos(sosId: string): Promise<{ ok: boolean; resolved: boolean }> {
    const res = await fetch(`${NODE_URL}/api/sos/resolve/${sosId}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Obtener balizas SOS activas */
export async function getActiveSos(): Promise<SosBeacon[]> {
    const res = await fetch(`${NODE_URL}/api/sos/active`);
    if (!res.ok) throw new Error(`SOS active fetch error: ${res.status}`);
    const data = await res.json();
    return data.active_beacons as SosBeacon[];
}

/** Obtener mensajes de canal público local */
export async function getChannelMessages(channelId = 'red-local-general'): Promise<{ channel_id: string; channels: string[]; messages: ChannelMessage[] }> {
    const res = await fetch(`${NODE_URL}/api/channels/messages?channel=${encodeURIComponent(channelId)}`);
    if (!res.ok) throw new Error(`Channel fetch error: ${res.status}`);
    return res.json();
}

/** Publicar en canal público local con moderación Guardian IA */
export async function postChannelMessage(payload: { channel_id: string; sender_name: string; content: string }): Promise<{ ok: boolean; message: ChannelMessage }> {
    const res = await fetch(`${NODE_URL}/api/channels/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Fragmentar archivo base64 en chunks Torrent-mesh */
export async function splitFileChunker(filename: string, dataBase64: string): Promise<{ ok: boolean; manifest: ChunkManifest }> {
    const res = await fetch(`${NODE_URL}/api/chunker/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data_base64: dataBase64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

// ─── v21.0: Interfaces & API Voice + Sanitizer + Weather ──────────────────────

export interface VoiceBurst {
    id: string;
    sender_did: string;
    sender_name: string;
    duration_seconds: number;
    audio_opus_b64: string;
    timestamp: number;
    sample_rate: number;
}

export interface CleanImageResponse {
    ok: boolean;
    cleaned_b64: string;
    bytes_stripped: number;
    metadata_removed: string[];
}

export interface WeatherReport {
    id: string;
    sender_did: string;
    sender_name: string;
    pressure_hpa: number;
    temperature_c?: number;
    humidity_percent?: number;
    condition_summary: string;
    is_disaster_alert: boolean;
    timestamp: number;
}

/** Enviar ráfaga de voz Walkie-Talkie Push-To-Talk */
export async function sendVoiceBurst(payload: {
    sender_name: string;
    duration_seconds: number;
    audio_opus_b64: string;
}): Promise<{ ok: boolean; burst: VoiceBurst }> {
    const res = await fetch(`${NODE_URL}/api/voice/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Obtener ráfagas de voz recientes */
export async function getVoiceBursts(): Promise<VoiceBurst[]> {
    const res = await fetch(`${NODE_URL}/api/voice/bursts`);
    if (!res.ok) throw new Error(`Voice bursts error: ${res.status}`);
    const data = await res.json();
    return data.bursts as VoiceBurst[];
}

/** Limpiar metadatos EXIF / GPS de fotografía */
export async function cleanImageExif(imageB64: string): Promise<CleanImageResponse> {
    const res = await fetch(`${NODE_URL}/api/sanitizer/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: imageB64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Publicar boletín climático off-grid */
export async function postWeatherReport(payload: {
    sender_name: string;
    pressure_hpa: number;
    temperature_c?: number;
    humidity_percent?: number;
    condition_summary: string;
    is_disaster_alert: boolean;
}): Promise<{ ok: boolean; report: WeatherReport }> {
    const res = await fetch(`${NODE_URL}/api/weather/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

// ─── v22.0: Interfaces & API Discovery + Ephemeral + Battery ──────────────────

export interface ProximityNode {
    identity_hash: string;
    display_name: string;
    rssi_dbm: number;
    distance_meters: number;
    transport: string;
    last_seen: number;
}

export interface EphemeralConfig {
    conversation_id: string;
    self_destruct_seconds: number;
    burn_on_read: boolean;
}

export interface EcoMeshStatus {
    battery_level: number;
    ble_scan_interval_ms: number;
    lora_tx_power_dbm: number;
    estimated_mesh_hours: number;
    eco_mode_enabled: boolean;
}

/** Obtener nodos por proximidad zero-touch (<5m) */
export async function getProximityNodes(): Promise<ProximityNode[]> {
    const res = await fetch(`${NODE_URL}/api/discovery/proximity`);
    if (!res.ok) throw new Error(`Proximity nodes error: ${res.status}`);
    const data = await res.json();
    return data.proximity_nodes as ProximityNode[];
}

/** Iniciar saludo P2P instantáneo de proximidad */
export async function triggerWaveHandshake(targetIdentityHash: string): Promise<{ ok: boolean; wave_handshake: ProximityNode }> {
    const res = await fetch(`${NODE_URL}/api/discovery/wave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_identity_hash: targetIdentityHash }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Configurar temporizador efímero de autodestrucción */
export async function setEphemeralTimer(config: EphemeralConfig): Promise<{ ok: boolean; config: EphemeralConfig }> {
    const res = await fetch(`${NODE_URL}/api/ephemeral/set_timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

/** Consultar estado Eco-Mesh y resiliencia de batería */
export async function getBatteryStatus(): Promise<EcoMeshStatus> {
    const res = await fetch(`${NODE_URL}/api/battery/status`);
    if (!res.ok) throw new Error(`Battery status error: ${res.status}`);
    const data = await res.json();
    return data.battery_status as EcoMeshStatus;
}

/** Actualizar nivel de batería y recalcular ciclo Eco-Mesh */
export async function updateBatteryOptimize(batteryLevel: number): Promise<{ ok: boolean; battery_status: EcoMeshStatus }> {
    const res = await fetch(`${NODE_URL}/api/battery/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battery_level: batteryLevel }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

// ─── v23.0: Interfaces & API Proximity Anti-Spam & Stealth Guard ───────────────

export interface SafeZone {
    name: string;
    lat: number;
    lon: number;
    radius_meters: number;
}

export interface ProximityFilterConfig {
    cooldown_seconds: number;
    rssi_threshold_dbm: number;
    stealth_mode: 'silent' | 'vibrate' | 'discreet_sound';
    digest_enabled: boolean;
    safe_zones: SafeZone[];
}

export interface ProximityDigest {
    total_nodes_detected: number;
    nodes_summary: string[];
    timestamp: number;
    is_in_safe_zone: boolean;
}

/** Obtener configuración de filtro anti-spam de proximidad */
export async function getDiscoveryConfig(): Promise<ProximityFilterConfig> {
    const res = await fetch(`${NODE_URL}/api/discovery/config`);
    if (!res.ok) throw new Error(`Discovery config error: ${res.status}`);
    const data = await res.json();
    return data.config as ProximityFilterConfig;
}

/** Actualizar configuración de filtro anti-spam y Modo Sigilo */
export async function setDiscoveryConfig(config: ProximityFilterConfig): Promise<{ ok: boolean; config: ProximityFilterConfig }> {
    const res = await fetch(`${NODE_URL}/api/discovery/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
}

// ─── v24.0: Interfaces & API AI Copilot + Summarizer + Translator ──────────────

export interface CopilotResponse {
    answer: string;
    topic_category: string;
    source: string;
    execution_time_ms: number;
}

export interface ChannelSummaryResponse {
    channel_id: string;
    summary_bullets: string[];
    total_messages_analyzed: number;
    sentiment: string;
    execution_time_ms: number;
}

export interface TranslateResponse {
    original_text: string;
    translated_text: string;
    target_language: string;
    execution_time_ms: number;
}

/** Consultar al Copiloto / Asistente Táctico de Emergencia Offline */
export async function queryAICopilot(prompt: string, context?: string): Promise<CopilotResponse> {
    const res = await fetch(`${NODE_URL}/api/ai/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data as CopilotResponse;
}

/** Generar resumen sintético con IA de un canal local */
export async function summarizeChannelAI(channelId: string, messages: string[]): Promise<ChannelSummaryResponse> {
    const res = await fetch(`${NODE_URL}/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data as ChannelSummaryResponse;
}

/** Traducir texto en tiempo real off-grid */
export async function translateTextAI(text: string, targetLanguage: string): Promise<TranslateResponse> {
    const res = await fetch(`${NODE_URL}/api/ai/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language: targetLanguage }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data as TranslateResponse;
}


/** Obtener resumen por lote de proximidad */
export async function getDiscoveryDigest(): Promise<ProximityDigest> {
    const res = await fetch(`${NODE_URL}/api/discovery/digest`);
    if (!res.ok) throw new Error(`Discovery digest error: ${res.status}`);
    const data = await res.json();
    return data.digest as ProximityDigest;
}



/** Obtener boletines climáticos locales */
export async function getWeatherReports(): Promise<WeatherReport[]> {
    const res = await fetch(`${NODE_URL}/api/weather/reports`);
    if (!res.ok) throw new Error(`Weather reports error: ${res.status}`);
    const data = await res.json();
    return data.reports as WeatherReport[];
}



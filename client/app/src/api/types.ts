// RED API Types & Protocol Contracts

export interface IdentityResponse {
    identity_hash: string;
    short_id?: string;
    public_key?: string;
    nickname?: string;
    phone_number?: string;
    avatar_url?: string;
    bio?: string;
    created_at?: number;
    mnemonic?: string;
    [key: string]: any;
}

export interface StatusResponse {
    is_running: boolean;
    peer_count: number;
    identity_hash: string;
    version: string;
    chain_height?: number;
    gossip_latency_ms?: number;
    [key: string]: any;
}

export interface ConversationItem {
    id: string;
    peer?: string;
    last_message?: string;
    last_timestamp?: number;
    unread_count?: number;
    is_pinned?: boolean;
    is_archived?: boolean;
    is_group?: boolean;
    group_name?: string;
    [key: string]: any;
}

export interface ContactItem {
    identity_hash: string;
    display_name: string;
    public_key?: string | null;
    avatar_url?: string;
    online?: boolean;
    last_seen?: number;
    is_verified?: boolean;
    verified_at?: number | null;
    [key: string]: any;
}

export interface GroupMemberItem {
    identity_hash: string;
    display_name?: string;
    role?: 'Admin' | 'Moderator' | 'Member';
    joined_at?: number;
    muted?: boolean;
    [key: string]: any;
}

export interface GroupItem {
    id: string;
    group_id?: string;
    name: string;
    creator_hash?: string;
    members?: GroupMemberItem[];
    broadcast_only?: boolean;
    created_at?: number;
    [key: string]: any;
}

export interface MessageItem {
    id: string;
    sender: string;
    recipient?: string;
    content: string;
    timestamp: number;
    is_mine?: boolean;
    msg_type?: string;
    status?: 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Failed';
    media_data?: string;
    mime_type?: string;
    duration_ms?: number;
    waveform?: number[];
    target_id?: string;
    new_content?: string;
    conversation_id?: string;
    is_group?: boolean;
    group_id?: string;
    reaction?: string;
    expires_at?: number;
    ttl?: number;
    [key: string]: any;
}

export interface DmsConfig {
    enabled: boolean;
    trigger_hours: number;
    wipe_messages: boolean;
    wipe_identity: boolean;
    dead_message: string;
    last_active_timestamp?: number;
    [key: string]: any;
}

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
    [key: string]: any;
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
    [key: string]: any;
}

export interface AmberSighting {
    alert_id: string;
    reporter_node_id: string;
    reported_at: number;
    lat?: number;
    lon?: number;
    notes?: string;
    [key: string]: any;
}

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
    enabled?: boolean;
    total_evaluations?: number;
    [key: string]: any;
}

export interface SosBeacon {
    id: string;
    sender_did: string;
    sender_name: string;
    lat?: number;
    lon?: number;
    altitude?: number;
    timestamp: number;
    battery_level: number;
    note: string;
    is_active: boolean;
    signature?: string;
    [key: string]: any;
}

export interface ChannelMessage {
    id: string;
    channel_id: string;
    sender_did: string;
    sender_name: string;
    content: string;
    timestamp: number;
    hash?: string;
    is_moderated?: boolean;
    [key: string]: any;
}

export interface VoiceBurst {
    id: string;
    sender_did: string;
    sender_name: string;
    duration_seconds: number;
    audio_opus_b64: string;
    audio_base64?: string;
    timestamp: number;
    sample_rate?: number;
    is_emergency?: boolean;
    duration_ms?: number;
    [key: string]: any;
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
    cap_area_desc?: string;
    [key: string]: any;
}

export interface ProximityNode {
    identity_hash: string;
    display_name: string;
    node_hash?: string;
    peer_id?: string;
    nickname?: string;
    rssi_dbm: number | null;
    rssi?: number | null;
    distance_meters: number | null;
    bearing_deg?: number | null;
    transport: string;
    last_seen: number;
    [key: string]: any;
}

export interface P2PVoucher {
    id: string;
    voucher_id: string;
    amount: number;
    signature: string;
    created_at: number;
    expires_at: number;
    timestamp?: number;
    ok?: boolean;
    new_balance?: number;
    is_outgoing?: boolean;
    recipient?: string;
    [key: string]: any;
}

export interface StegoCapsule {
    id: string;
    carrier_image_b64: string;
    extracted_payload?: string;
    payload_type: 'text' | 'location' | 'crypto_seed';
    timestamp: number;
    is_decrypted?: boolean;
    [key: string]: any;
}

export type StegoCapsuleRecord = StegoCapsule;

export interface EmergencyBeaconRecord {
    id: string;
    beacon_type: 'medical' | 'disaster' | 'search_rescue' | 'general_sos';
    lat: number;
    lon: number;
    message: string;
    battery_pct: number;
    timestamp: number;
    is_active: boolean;
    [key: string]: any;
}

export interface TriageReport {
    id: string;
    patient_tag: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
    vitals_heart_rate: number;
    vitals_spo2: number;
    vitals_respiratory: number;
    injuries_summary: string;
    reporter_did: string;
    timestamp: number;
    [key: string]: any;
}

export type TriageReportRecord = TriageReport;

export interface SocialPost {
    id: string;
    author_did?: string;
    author_hash?: string;
    author_name: string;
    content: string;
    timestamp: number;
    reactions: Record<string, any>;
    comments_count?: number;
    media_data?: string;
    [key: string]: any;
}

export interface BlockItem {
    height: number;
    hash: string;
    prev_hash: string;
    timestamp: number;
    tx_count: number;
    validator: string;
    [key: string]: any;
}

export interface ValidatorItem {
    public_key: string;
    stake: number;
    active: boolean;
    blocks_produced: number;
    missed_slots: number;
    weight: number;
    [key: string]: any;
}

export interface ConsensusStatus {
    epoch: number;
    current_slot: number;
    total_stake: number;
    active_validators: number;
    chain_height: number;
    [key: string]: any;
}

export interface BlackoutStatusResponse {
    is_blackout: boolean;
    isolated_wan: boolean;
    active_transports: string[];
    epidemic_ttl: number;
    [key: string]: any;
}

export interface RfMetricsResponse {
    active_channel: number;
    frequency_mhz: number;
    noise_floor_dbm: number;
    fec_mode: string;
    packets_transmitted: number;
    packets_received: number;
    crc_errors: number;
    current_channel_mhz: number;
    total_hops_count: number;
    [key: string]: any;
}

export interface NativeBarometerResult {
    available: boolean;
    pressure_hpa: number;
    altitude_approx_meters?: number;
    sensor_name: string;
    value?: number;
    unit?: string;
    accuracy?: any;
    [key: string]: any;
}

export interface RustLogEntry {
    timestamp: number;
    level: string;
    target: string;
    message: string;
    [key: string]: any;
}

export interface SystemHealthResponse {
    os_target: string;
    uptime_seconds: number;
    storage_benchmark: any;
    crypto_benchmark: any;
    async_runtime: any;
    [key: string]: any;
}

export interface PeerItem {
    id: string;
    addr?: string;
    multiaddr?: string;
    latency_ms?: number;
    connected_at?: number;
    transport?: string;
    [key: string]: any;
}

export interface ChunkManifest {
    file_id: string;
    filename: string;
    total_size: number;
    total_chunks: number;
    root_hash: string;
    chunk_hashes: string[];
    [key: string]: any;
}

export interface CopilotResponse {
    answer: string;
    topic_category: string;
    source: string;
    execution_time_ms: number;
    [key: string]: any;
}

export interface ChannelSummaryResponse {
    channel_id: string;
    summary_bullets: string[];
    total_messages_analyzed: number;
    sentiment: string;
    execution_time_ms: number;
    [key: string]: any;
}

export interface TranslateResponse {
    original_text: string;
    translated_text: string;
    target_language: string;
    execution_time_ms: number;
    [key: string]: any;
}


export interface CleanImageResponse {
    ok: boolean;
    cleaned_b64: string;
    bytes_stripped: number;
    metadata_removed?: string[];
    [key: string]: any;
}

export interface EphemeralConfig {
    burn_after_read?: boolean;
    timer_seconds?: number;
    enabled?: boolean;
    [key: string]: any;
}

export interface EcoMeshStatus {
    battery_level: number;
    ble_scan_interval_ms: number;
    lora_tx_power_dbm: number;
    estimated_mesh_hours: number;
    eco_mode_enabled: boolean;
    [key: string]: any;
}

export interface ProximityFilterConfig {
    cooldown_seconds: number;
    rssi_threshold_dbm: number;
    stealth_mode: 'vibrate' | 'silent' | 'normal';
    digest_enabled: boolean;
    safe_zones?: any[];
    [key: string]: any;
}

export interface ProximityDigest {
    total_nodes_detected: number;
    nodes_summary: string[];
    timestamp: number;
    is_in_safe_zone: boolean;
    [key: string]: any;
}

export interface DmsStatusResponse {
    enabled: boolean;
    trigger_hours: number;
    wipe_messages: boolean;
    wipe_identity: boolean;
    dead_message: string;
    last_active_timestamp?: number;
    seconds_remaining?: number;
    is_triggered?: boolean;
    [key: string]: any;
}

export interface SaveDmsConfigRequest {
    enabled: boolean;
    trigger_hours: number;
    wipe_messages: boolean;
    wipe_identity: boolean;
    dead_message: string;
    [key: string]: any;
}

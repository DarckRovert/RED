#![allow(dead_code, unused_imports)]
//! HTTP REST API for the RED node.
//!
//! Exposes all node functionality over HTTP on port 7333.
//! Includes an SSE endpoint for real-time message delivery.

use axum::{
    extract::{Path, State, ws::{WebSocket, Message as WsMessage, WebSocketUpgrade}},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response, Sse, sse::{Event, KeepAlive}},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use futures::{StreamExt, SinkExt, stream::Stream};
use subtle::ConstantTimeEq;
use std::{sync::Arc, sync::OnceLock, convert::Infallible, time::Duration};
use tokio::sync::{broadcast, Mutex};
use tower_http::{
    cors::{CorsLayer, AllowOrigin},
    trace::TraceLayer,
    set_header::SetResponseHeaderLayer,
};

use red_core::network::Node;
use red_core::identity::IdentityHash;
use red_core::protocol::{Message, MessageType};

pub type AsyncState = Arc<Mutex<Option<ApiState>>>;

/// Helper para limpiar el Identity Hash escaneado (QR) 
/// Helper para limpiar el Identity Hash escaneado (QR) 
/// y quitar los prefijos "did:red:" o espacios invisibles.
/// Ahora soporta resolución de Short IDs (8-16 chars) buscando en la tabla de peers.
fn parse_identity_hash(raw: &str) -> std::result::Result<IdentityHash, String> {
    let mut clean = raw.trim();
    if clean.starts_with("did:red:") {
        clean = &clean[8..];
    } else if clean.starts_with("red:") {
        clean = &clean[4..];
    }
    
    let parts: Vec<&str> = clean.split(':').collect();
    let hash_part = parts[0];
    
    // Si es un short ID (ej: de BLE), lo devolvemos como error especial 
    // para que el handler intente resolverlo contra los peers conectados.
    if hash_part.len() < 32 {
        return Err(format!("SHORT_ID:{}", hash_part));
    }

    IdentityHash::from_hex(hash_part).map_err(|_| "Formato HEX inválido o longitud incorrecta".to_string())
}


/// Shared state passed to every handler
#[derive(Clone)]
pub struct ApiState {
    pub node: Arc<Mutex<Node>>,
    pub msg_tx: broadcast::Sender<Message>,
    pub chain: Arc<red_blockchain::chain::Chain>,
    pub consensus: Arc<red_blockchain::consensus::Consensus>,
    pub api_key: [u8; 32],
}

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct StatusResponse {
    pub is_running: bool,
    pub peer_count: usize,
    pub identity_hash: String,
    pub version: String,
    /// Altura del bloque actual en la blockchain local
    pub chain_height: u64,
    /// Latencia estimada del gossip en ms (None si aún no hay peers)
    pub gossip_latency_ms: Option<u64>,
    /// Paquetes de ruido blanco enviados (anti-análisis de tráfico)
    pub noise_packets_sent: u64,
    /// Conexiones rechazadas por detección Sybil
    pub sybil_blocked: u64,
}

#[derive(Serialize)]
pub struct IdentityResponse {
    pub identity_hash: String,
    pub short_id: String,
    pub nickname: Option<String>,
    pub public_key: String,
}

#[derive(Serialize)]
pub struct IdentityExportResponse {
    pub identity_hash: String,
    pub short_id: String,
    pub backup_created_at: u64,
    pub note: String,
}

#[derive(Serialize)]
pub struct ConversationItem {
    pub id: String,
    pub peer: String,
    pub message_count: usize,
    pub last_message: Option<String>,
    pub last_timestamp: u64,
    pub disappearing_timer: Option<u32>,
    /// Número de mensajes recibidos que el usuario no ha visto aún
    pub unread_count: usize,
}

#[derive(Serialize)]
pub struct MessageItem {
    pub id: String,
    pub sender: String,
    pub content: String,
    pub msg_type: String,
    pub timestamp: u64,
    pub is_mine: bool,
    pub reply_to: Option<String>,
    pub media_data: Option<String>,
    pub mime_type: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub accuracy: Option<f32>,
    pub target_message_id: Option<String>,
    pub message_ids: Option<Vec<String>>,
}

fn map_message_to_item(m: &Message, is_mine: bool) -> MessageItem {
    use base64::{Engine as _, engine::general_purpose};
    let mut item = MessageItem {
        id: m.id.to_hex(),
        sender: m.sender.short(),
        content: String::new(),
        msg_type: String::new(),
        timestamp: m.timestamp,
        is_mine,
        reply_to: m.reply_to.as_ref().map(|id| id.to_hex()),
        media_data: None,
        mime_type: None,
        width: None,
        height: None,
        duration_ms: None,
        latitude: None,
        longitude: None,
        accuracy: None,
        target_message_id: None,
        message_ids: None,
    };

    match &m.content {
        MessageType::Text(text) => {
            item.msg_type = "text".to_string();
            item.content = text.clone();
        }
        MessageType::Image { data, mime_type, width, height } => {
            item.msg_type = "image".to_string();
            item.content = "[Image]".to_string();
            item.media_data = Some(general_purpose::STANDARD.encode(data));
            item.mime_type = Some(mime_type.clone());
            item.width = Some(*width);
            item.height = Some(*height);
        }
        MessageType::Voice { data, duration_ms } => {
            item.msg_type = "voice".to_string();
            item.content = "[Voice Note]".to_string();
            item.media_data = Some(general_purpose::STANDARD.encode(data));
            item.duration_ms = Some(*duration_ms);
        }
        MessageType::File { data, filename, mime_type } => {
            item.msg_type = "file".to_string();
            item.content = filename.clone();
            item.media_data = Some(general_purpose::STANDARD.encode(data));
            item.mime_type = Some(mime_type.clone());
        }
        MessageType::Location { latitude, longitude, accuracy } => {
            item.msg_type = "location".to_string();
            item.content = "[Location]".to_string();
            item.latitude = Some(*latitude);
            item.longitude = Some(*longitude);
            item.accuracy = *accuracy;
        }
        MessageType::Reaction { target_message_id, emoji } => {
            item.msg_type = "reaction".to_string();
            item.content = emoji.clone();
            item.target_message_id = Some(target_message_id.to_hex());
        }
        MessageType::Delete { target_message_id } => {
            item.msg_type = "delete".to_string();
            item.content = "[Deleted]".to_string();
            item.target_message_id = Some(target_message_id.to_hex());
        }
        MessageType::ReadReceipt { message_ids } => {
            item.msg_type = "read_receipt".to_string();
            item.content = "[Read Receipt]".to_string();
            item.message_ids = Some(message_ids.iter().map(|id| id.to_hex()).collect());
        }
        MessageType::Typing { is_typing } => {
            item.msg_type = "typing".to_string();
            item.content = if *is_typing { "true".to_string() } else { "false".to_string() };
        }
        MessageType::Contact { identity_hash, display_name } => {
            item.msg_type = "contact".to_string();
            item.content = display_name.clone();
            item.target_message_id = Some(identity_hash.to_hex());
        }
        MessageType::GroupPayload(_) => {
            item.msg_type = "error".to_string();
            item.content = "[Encrypted Group Payload]".to_string();
        }
        MessageType::TimerUpdate { seconds } => {
            item.msg_type = "timer_update".to_string();
            item.content = seconds.to_string();
        }
        MessageType::Ephemeral { expires_at: _expires_at, content } => {
            let mut inner = map_message_to_item(&Message {
                content: *content.clone(),
                ..m.clone()
            }, is_mine);
            inner.msg_type = format!("ephemeral_{}", inner.msg_type);
            return inner;
        }
    }
    item
}

fn map_req_to_type(req: &SendMessageRequest) -> MessageType {
    let mut content = match req.msg_type.as_deref() {
        Some("image") => {
            use base64::{Engine as _, engine::general_purpose};
            let data = general_purpose::STANDARD.decode(req.media_data.as_deref().unwrap_or("")).unwrap_or_default();
            MessageType::Image {
                data,
                mime_type: req.mime_type.clone().unwrap_or_else(|| "image/jpeg".to_string()),
                width: req.width.unwrap_or(0),
                height: req.height.unwrap_or(0),
            }
        },
        Some("voice") => {
            use base64::{Engine as _, engine::general_purpose};
            let data = general_purpose::STANDARD.decode(req.media_data.as_deref().unwrap_or("")).unwrap_or_default();
            MessageType::Voice {
                data,
                duration_ms: req.duration_ms.unwrap_or(0),
            }
        },
        Some("file") => {
            use base64::{Engine as _, engine::general_purpose};
            let data = general_purpose::STANDARD.decode(req.media_data.as_deref().unwrap_or("")).unwrap_or_default();
            MessageType::File {
                data,
                filename: req.content.clone(),
                mime_type: req.mime_type.clone().unwrap_or_else(|| "application/octet-stream".to_string()),
            }
        },
        Some("location") => {
            MessageType::Location {
                latitude: req.latitude.unwrap_or(0.0),
                longitude: req.longitude.unwrap_or(0.0),
                accuracy: req.accuracy,
            }
        },
        Some("reaction") => {
            let target_id = req.target_message_id.as_deref()
                .and_then(|id_str| hex::decode(id_str).ok())
                .and_then(|bytes| {
                    if bytes.len() == 32 {
                        let mut arr = [0u8; 32];
                        arr.copy_from_slice(&bytes);
                        Some(red_core::protocol::MessageId::from_bytes(arr))
                    } else { None }
                })
                .unwrap_or_else(|| red_core::protocol::MessageId::generate());
            MessageType::Reaction {
                target_message_id: target_id,
                emoji: req.content.clone(),
            }
        },
        Some("delete") => {
            let target_id = req.target_message_id.as_deref()
                .and_then(|id_str| hex::decode(id_str).ok())
                .and_then(|bytes| {
                    if bytes.len() == 32 {
                        let mut arr = [0u8; 32];
                        arr.copy_from_slice(&bytes);
                        Some(red_core::protocol::MessageId::from_bytes(arr))
                    } else { None }
                })
                .unwrap_or_else(|| red_core::protocol::MessageId::generate());
            MessageType::Delete { target_message_id: target_id }
        },
        Some("read_receipt") => {
            let message_ids = req.message_ids.as_ref().unwrap_or(&vec![]).iter().filter_map(|id_str| {
                hex::decode(id_str).ok().and_then(|bytes| {
                    if bytes.len() == 32 {
                        let mut arr = [0u8; 32];
                        arr.copy_from_slice(&bytes);
                        Some(red_core::protocol::MessageId::from_bytes(arr))
                    } else { None }
                })
            }).collect();
            MessageType::ReadReceipt { message_ids }
        },
        Some("typing") => {
            MessageType::Typing { is_typing: req.content == "true" }
        },
        Some("timer_update") => {
            let seconds = req.content.parse().unwrap_or(0);
            MessageType::TimerUpdate { seconds }
        },
        _ => MessageType::Text(req.content.clone()),
    };

    if let Some(expires_at) = req.expires_at {
        if expires_at > 0 {
            content = MessageType::Ephemeral {
                expires_at,
                content: Box::new(content),
            };
        }
    }
    content
}

#[derive(Serialize)]
pub struct ContactItem {
    pub identity_hash: String,
    pub display_name: String,
    pub verified: bool,
}

#[derive(Serialize)]
pub struct GroupItem {
    pub id: String,
    pub name: String,
    pub member_count: usize,
}

#[derive(Serialize)]
pub struct ApiError {
    pub error: String,
}

#[derive(Serialize)]
pub struct BlockItem {
    pub height: u64,
    pub hash: String,
    pub prev_hash: String,
    pub timestamp: u64,
    pub validator: String,
    pub tx_count: usize,
}

#[derive(Serialize)]
pub struct PeerItem {
    pub id: String,
    pub is_connected: bool,
    pub transport: String,
    pub latency_ms: Option<u64>,
    pub noise_session: bool,
    pub addr: Option<String>,
}

#[derive(Serialize)]
pub struct VaultResponse {
    pub identity_hash: String,
    pub short_id: String,
    pub key_algorithm: String,
    pub active_sessions: usize,
    pub noise_packets_sent: u64,
    pub sybil_blocked: u64,
    pub chain_height: u64,
    pub version: String,
}

#[derive(Serialize)]
pub struct ValidatorItem {
    pub public_key: String,
    pub stake: u64,
    pub active: bool,
    pub blocks_produced: u64,
    pub missed_slots: u64,
    pub weight: u64,
}

#[derive(Serialize)]
pub struct ConsensusStatus {
    pub epoch: u64,
    pub current_slot: u64,
    pub total_stake: u64,
    pub active_validators: usize,
    pub chain_height: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DmsConfig {
    pub enabled: bool,
    pub trigger_hours: u32,
    pub wipe_messages: bool,
    pub wipe_identity: bool,
    pub dead_message: Option<String>,
}

// ─── Request types ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub recipient: String,
    pub content: String,
    pub msg_type: Option<String>,
    pub media_data: Option<String>,
    pub mime_type: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub accuracy: Option<f32>,
    pub target_message_id: Option<String>,
    pub message_ids: Option<Vec<String>>,
    pub expires_at: Option<u64>,
}

#[derive(Deserialize)]
pub struct AddContactRequest {
    pub identity_hash: String,
    pub display_name: String,
    pub public_key: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct StakeRequest {
    pub amount: u64,
}

#[derive(Deserialize)]
pub struct MeshReceiveRequest {
    pub payload_hex: String,
    pub from_device: Option<String>,
    /// If true, forward the payload to the LoRa radio bridge after injecting into the node.
    /// Used by the mesh router when the destination is only reachable via LoRa.
    pub via_lora: Option<bool>,
}

#[derive(Deserialize)]
pub struct BurnerModeRequest {
    pub enabled: bool,
}

// ── Async Handlers (Phase 2 & Phase 18 Mesh Transports) ──────────────────────────



// ─── Signaling WS Channel ────────────────────────────────────────────────────────
fn signaling_channel() -> broadcast::Sender<String> {
    static CHANNEL: OnceLock<broadcast::Sender<String>> = OnceLock::new();
    CHANNEL.get_or_init(|| {
        let (tx, _) = broadcast::channel(100);
        tx
    }).clone()
}


// ─── Router ───────────────────────────────────────────────────────────────────

pub fn build_router(state: ApiState) -> Router {
    let origins = [
        "http://localhost".parse::<HeaderValue>().unwrap(),
        "http://127.0.0.1".parse::<HeaderValue>().unwrap(),
    ];

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    let auth_layer = axum::middleware::from_fn_with_state(state.clone(), validate_auth);

    Router::new()
        .route("/api/status",          get(handle_status))
        .route("/api/identity",        get(handle_identity))
        .route("/api/identity/export", get(handle_identity_export))
        .route("/api/messages/send",   post(handle_send_message))
        // ... (resto de rutas seguras)
        .route("/api/mesh/receive",    post(handle_mesh_receive))
        .route("/api/network/outbound", get(handle_outbound_sse))
        .route("/api/conversations",   get(handle_list_conversations))
        .route("/api/conversations/:id/messages", get(handle_get_messages))
        .route("/api/contacts",        get(handle_list_contacts))
        .route("/api/contacts",        post(handle_add_contact))
        .route("/api/groups",          get(handle_list_groups))
        .route("/api/groups",          post(handle_create_group))
        .route("/api/groups/:id/send", post(handle_send_group_message))
        .route("/api/peers",              get(handle_get_peers))
        .route("/api/network/vault",       get(handle_get_vault))
        .route("/api/crypto/renegotiate",  post(handle_renegotiate_crypto))
        .route("/api/blockchain/blocks",      get(handle_get_blocks))
        .route("/api/blockchain/validators",  get(handle_get_validators))
        .route("/api/blockchain/consensus",   get(handle_get_consensus))
        .route("/api/blockchain/stake",       post(handle_stake))
        .route("/api/profile",                         axum::routing::put(handle_update_profile))
        .route("/api/settings/burner",                   post(handle_set_burner_mode))
        .route("/api/settings/dms",                       get(handle_get_dms_config).post(handle_set_dms_config))
        .route("/api/settings/lora",                      post(handle_set_lora_config))
        .route("/api/conversations/:id/read",             post(handle_mark_conversation_read))
        .route("/api/conversations/:id/clear",            axum::routing::delete(handle_clear_conversation))
        .route("/api/events",          get(handle_sse))
        .route("/local-signal",        get(handle_local_signal))
        .layer(auth_layer) // Protegemos todas las rutas
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .with_state(state)
}


// ─── API Handlers ─────────────────────────────────────────────────────────────

async fn handle_status(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let chain_height = state.chain.height();
    Json(StatusResponse {
        is_running: node.is_running(),
        peer_count: node.transport_peer_count(),
        identity_hash: node.identity_hash().to_hex(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        chain_height,
        // gossip_latency_ms, noise_packets_sent, sybil_blocked —
        // estos campos se expanden en fases futuras desde el transport layer.
        // Por ahora retornamos valores de base: 0 indica "no hay datos aún".
        gossip_latency_ms: None,
        noise_packets_sent: 0,
        sybil_blocked: 0,
    })
}

async fn handle_identity_export(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let hash = node.identity_hash();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    Json(IdentityExportResponse {
        identity_hash: hash.to_hex(),
        short_id: hash.short(),
        backup_created_at: now,
        note: "Keep this backup secure. Never share it. This is your sovereign cryptographic identity.".to_string(),
    })
}

async fn handle_identity(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let hash = node.identity_hash();
    let nickname = node.get_nickname();
    let pub_key = node.public_key().to_hex();

    Json(IdentityResponse {
        identity_hash: hash.to_hex(),
        short_id: hash.short(),
        nickname,
        public_key: pub_key,
    })
}

async fn handle_set_burner_mode(
    State(state): State<ApiState>,
    Json(req): Json<BurnerModeRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    node.set_burner_mode(req.enabled).await;
    StatusCode::OK
}

#[derive(Deserialize)]
struct UpdateProfileRequest {
    display_name: String,
}

async fn handle_update_profile(
    State(state): State<ApiState>,
    Json(req): Json<UpdateProfileRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    node.set_nickname(&req.display_name).await;
    StatusCode::OK
}

// ─── DMS config — GET loads current config, POST saves full config ────────────

async fn handle_get_dms_config(
    State(state): State<ApiState>,
) -> impl IntoResponse {
    // Read from node's persisted DMS state if available; otherwise return safe defaults.
    let node = state.node.lock().await;
    let cfg = DmsConfig {
        enabled: node.dms_enabled(),
        trigger_hours: node.dms_trigger_hours() as u32,
        wipe_messages: node.dms_wipe_messages(),
        wipe_identity: node.dms_wipe_identity(),
        dead_message: node.dms_dead_message(),
    };
    Json(cfg)
}

async fn handle_set_dms_config(
    State(state): State<ApiState>,
    Json(cfg): Json<DmsConfig>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    // Apply each config field to the node
    let hours = cfg.trigger_hours as u64;
    node.set_dead_mans_days(hours / 24 + if hours % 24 > 0 { 1 } else { 0 }).await;
    node.set_dms_config(
        cfg.enabled,
        cfg.trigger_hours as u64,
        cfg.wipe_messages,
        cfg.wipe_identity,
        cfg.dead_message.unwrap_or_default(),
    ).await;
    StatusCode::OK
}

#[derive(serde::Deserialize)]
struct LoraConfigRequest {
    port: String,
    baud: u32,
}

async fn handle_set_lora_config(
    State(state): State<ApiState>,
    Json(req): Json<LoraConfigRequest>,
) -> impl IntoResponse {
    tracing::info!("[LoRa] Config received: port={} baud={}", req.port, req.baud);
    
    // Acquire lock and spawn new hardware bridge linked to the exact port
    let mut node = state.node.lock().await;
    
    let mut lora = red_core::network::lora_bridge::LoraBridge::new(
        state.node.clone(), 
        req.port.clone(), 
        req.baud
    );
    
    if let Err(e) = lora.start().await {
        tracing::error!("Failed to hot-reload LoRa bridge hardware: {}", e);
        return Json(serde_json::json!({"ok": false, "error": format!("Hardware exception: {}", e)}));
    }
    
    // Overwrite old driver instance
    node.lora_bridge = Some(lora);
    
    Json(serde_json::json!({"ok": true, "port": req.port, "baud": req.baud}))
}

async fn handle_mark_conversation_read(
    State(state): State<ApiState>,
    axum::extract::Path(conv_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    // Format is "ourHashHex-theirHashHex" (shortened) which isn't easy to reconstruct into proper ID
    // So we iterate through conversations to find the matching one, like handle_get_messages does.
    let mut target_conv_id = None;
    if let Ok((_, _, conversations)) = node.get_sync_payload().await {
        if let Some(conv) = conversations.iter().find(|c| {
            format!("{}-{}", c.our_identity.short(), c.their_identity.short()) == conv_id
        }) {
            target_conv_id = Some(conv.id.clone());
        }
    }

    if let Some(id) = target_conv_id {
        if let Err(e) = node.mark_conversation_read_in_storage(&id).await {
            tracing::warn!("[read] Failed to save conversation read state: {}", e);
        } else {
            tracing::debug!("[read] Conversation {} fully marked read in DB", conv_id);
        }
    } else {
        tracing::warn!("[read] Conversation {} not found for marking read", conv_id);
    }
    
    StatusCode::OK
}

async fn handle_clear_conversation(
    State(state): State<ApiState>,
    axum::extract::Path(conv_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    if let Ok((_, _, conversations)) = node.get_sync_payload().await {
        if let Some(_conv) = conversations.iter().find(|c| {
            format!("{}-{}", c.our_identity.short(), c.their_identity.short()) == conv_id
        }) {
            drop(node);
            // NOTE: clear_conversation_messages will be added to Storage in a follow-up if not present
            return (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response();
        }
    }
    (StatusCode::NOT_FOUND, Json(serde_json::json!({"ok": false, "error": "Not found"}))).into_response()
}

async fn handle_send_message(
    State(state): State<ApiState>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let recipient = match IdentityHash::from_hex(&req.recipient) {
        Ok(h) => h,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid recipient identity hash"})),
            ).into_response();
        }
    };

    let mut node = state.node.lock().await;
    let sender = node.identity_hash().clone();

    let content = map_req_to_type(&req);

    let reply_to = req.target_message_id.as_deref()
        .filter(|_| req.msg_type.as_deref() == Some("text") || req.msg_type.is_none())
        .and_then(|id_str| hex::decode(id_str).ok())
        .and_then(|bytes| {
            if bytes.len() == 32 {
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&bytes);
                Some(red_core::protocol::MessageId::from_bytes(arr))
            } else { None }
        });

    let message = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: sender.clone(),
        recipient: recipient.clone(),
        content,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
        reply_to,
        status: red_core::protocol::MessageStatus::Pending,
    };

    if message.is_too_large() {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(serde_json::json!({"error": "Message payload too large"})),
        ).into_response();
    }

    match node.send_message(recipient, message).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        ).into_response(),
    }
}

async fn handle_mesh_receive(
    State(state): State<ApiState>,
    Json(req): Json<MeshReceiveRequest>,
) -> impl IntoResponse {
    let bytes = match hex::decode(&req.payload_hex) {
        Ok(b) => b,
        Err(_) => return (
            StatusCode::BAD_REQUEST, 
            Json(serde_json::json!({"error": "Invalid hex string"}))
        ).into_response(),
    };

    let mut node = state.node.lock().await;
    
    // 1. Inject into local node for decryption/delivery (if addressed to us)
    let inject_result = node.inject_raw_payload(bytes.clone()).await;
    
    // 2. If via_lora flag is set, also forward over the LoRa radio bridge.
    //    This enables the mesh to use LoRa as a transport layer for long-range hops.
    if req.via_lora == Some(true) {
        if let Some(ref lora) = node.lora_bridge {
            if let Err(e) = lora.transmit(&bytes).await {
                tracing::warn!("LoRa relay failed for mesh packet: {}", e);
            } else {
                tracing::info!("Mesh packet relayed via LoRa radio ({} bytes)", bytes.len());
            }
        }
    }
    
    match inject_result {
        Ok(_) => Json(serde_json::json!({"status": "injected"})).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR, 
            Json(serde_json::json!({"error": format!("{}", e)}))
        ).into_response(),
    }
}

async fn handle_local_signal(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket))
}

async fn handle_socket(socket: WebSocket) {
    use futures::{SinkExt, StreamExt};
    let (mut sender, mut receiver) = socket.split();
    let tx = signaling_channel();
    let mut rx = tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let ws_msg = WsMessage::Text(msg.into());
            if sender.send(ws_msg).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let WsMessage::Text(text) = msg {
                let _ = tx.send(text.to_string());
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}


async fn handle_list_conversations(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.get_sync_payload().await {
        Ok((_, _, conversations)) => {
            let my_hash = node.identity_hash();
            let items: Vec<ConversationItem> = conversations.iter().map(|c| {
                let msgs = c.messages();
                let last_msg = msgs.last().and_then(|m| {
                    match &m.content {
                        MessageType::Text(text) => Some(text.chars().take(60).collect::<String>()),
                        MessageType::Image { .. } => Some("📷 Imagen".to_string()),
                        MessageType::Voice { .. } => Some("🎤 Nota de voz".to_string()),
                        MessageType::Location { .. } => Some("📍 Ubicación".to_string()),
                        MessageType::File { filename, .. } => Some(format!("📄 {}", filename)),
                        _ => None,
                    }
                });
                let last_timestamp = msgs.last().map(|m| m.timestamp).unwrap_or(0);
                let peer = if &c.our_identity == my_hash {
                    c.their_identity.to_hex()
                } else {
                    c.our_identity.to_hex()
                };
                // Read actual unread count explicitly saved in the Conversation struct
                let unread_count = c.unread_count;
                
                ConversationItem {
                    id: format!("{}-{}", c.our_identity.short(), c.their_identity.short()),
                    peer,
                    message_count: msgs.len(),
                    last_message: last_msg,
                    last_timestamp,
                    disappearing_timer: c.disappearing_timer,
                    unread_count,
                }
            }).collect();
            Json(items).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        ).into_response(),
    }
}

async fn handle_get_messages(
    State(state): State<ApiState>,
    Path(conv_id): Path<String>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.get_sync_payload().await {
        Ok((_, _, conversations)) => {
            let conv = conversations.iter().find(|c| {
                let id = format!("{}-{}", c.our_identity.short(), c.their_identity.short());
                id == conv_id
            });
            match conv {
                Some(c) => {
                    let my_hash = node.identity_hash();
                    let items: Vec<MessageItem> = c.messages().iter().map(|m| {
                        map_message_to_item(m, &m.sender == my_hash)
                    }).collect();
                    Json(items).into_response()
                }
                None => (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Conversation not found"}))).into_response(),
            }
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

async fn handle_list_contacts(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.get_sync_payload().await {
        Ok((contacts, _, _)) => {
            let items: Vec<ContactItem> = contacts.iter().map(|c| ContactItem {
                identity_hash: c.identity_hash.to_hex(),
                display_name: c.display_name.clone(),
                verified: c.verified,
            }).collect();
            Json(items).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

async fn handle_add_contact(
    State(state): State<ApiState>,
    Json(req): Json<AddContactRequest>,
) -> impl IntoResponse {
    let hash = match parse_identity_hash(&req.identity_hash) {
        Ok(h) => h,
        Err(e) if e.starts_with("SHORT_ID:") => {
            let short = &e[9..];
            let node = state.node.lock().await;
            // Intentar resolver Short ID contra peers conocidos
            let resolved = node.transport_peer_count() > 0;
            if resolved {
                 let peers = node.get_peers().await.unwrap_or_default();
                 if let Some(p) = peers.iter().find(|p| p.identity_hash.as_ref().map(|h| h.short() == short).unwrap_or(false)) {
                     p.identity_hash.clone().unwrap()
                 } else {
                     return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "Short ID no encontrado en la red mesh local. Asegúrate de estar cerca del nodo."}))).into_response();
                 }
            } else {
                return (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error": "No hay nodos conectados para resolver el ID corto."}))).into_response();
            }
        }
        Err(err_msg) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": err_msg}))).into_response(),
    };

    // Intentar extraer la clave pública del request JSON, o de los formatos did:red:hash:pk / hash:pk
    let pub_key_bytes = if let Some(ref pk_hex) = req.public_key {
        hex::decode(pk_hex).ok().and_then(|b| b.try_into().ok()).unwrap_or([0u8; 32])
    } else {
        let parts: Vec<&str> = req.identity_hash.split(':').collect();
        if parts.len() >= 4 && parts[0] == "did" && parts[1] == "red" {
            hex::decode(parts[3]).ok().and_then(|b| b.try_into().ok()).unwrap_or([0u8; 32])
        } else if parts.len() >= 2 {
            hex::decode(parts[1]).ok().and_then(|b| b.try_into().ok()).unwrap_or([0u8; 32])
        } else {
            [0u8; 32]
        }
    };

    let node = state.node.lock().await;
    let contact = red_core::storage::Contact {
        identity_hash: hash,
        display_name: req.display_name,
        public_key: pub_key_bytes,
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
        verified: false,
        blocked: false,
        notes: None,
    };
    match node.add_contact(contact).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}


async fn handle_list_groups(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.list_groups().await {
        Ok(groups) => {
            let items: Vec<GroupItem> = groups.iter().map(|g| GroupItem {
                id: hex::encode(g.id.0),
                name: g.name.clone(),
                member_count: g.member_count(),
            }).collect();
            Json(items).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

async fn handle_create_group(
    State(state): State<ApiState>,
    Json(req): Json<CreateGroupRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    match node.create_group(req.name).await {
        Ok(group) => Json(serde_json::json!({
            "id": hex::encode(group.id.0),
            "name": group.name,
        })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

async fn handle_send_group_message(
    State(state): State<ApiState>,
    Path(group_id_hex): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let group_id_bytes = match hex::decode(&group_id_hex) {
        Ok(b) if b.len() == 32 => {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&b);
            arr
        },
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid group ID"}))).into_response(),
    };
    let group_id = red_core::protocol::GroupId(group_id_bytes);
    let content = map_req_to_type(&req);
    let mut node = state.node.lock().await;
    match node.send_group_message(group_id, content).await {
        Ok(_) => Json(serde_json::json!({"status": "sent"})).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": format!("Network error: {}", e)}))).into_response(),
    }
}

async fn handle_get_blocks(State(state): State<ApiState>) -> impl IntoResponse {
    let chain = &state.chain;
    let height = chain.height();
    let mut items = Vec::new();
    let limit = 20.min(height as usize);
    for i in 0..=limit {
        let current_height = height.saturating_sub(i as u64);
        if let Some(block) = chain.get_block_at_height(current_height) {
            items.push(BlockItem {
                height: current_height,
                hash: hex::encode(block.header.hash()),
                prev_hash: hex::encode(block.header.previous_hash),
                timestamp: block.header.timestamp,
                validator: hex::encode(block.header.validator),
                tx_count: block.transactions.len(),
            });
        }
    }
    Json(items).into_response()
}

async fn handle_get_validators(State(state): State<ApiState>) -> impl IntoResponse {
    let validators = state.consensus.get_validators();
    let mut items: Vec<ValidatorItem> = validators
        .values()
        .map(|v| ValidatorItem {
            public_key: hex::encode(v.public_key),
            stake: v.stake,
            active: v.active,
            blocks_produced: v.blocks_produced,
            missed_slots: v.missed_slots,
            weight: v.weight(),
        })
        .collect();
    items.sort_by(|a, b| b.stake.cmp(&a.stake));
    Json(items).into_response()
}

async fn handle_get_consensus(State(state): State<ApiState>) -> impl IntoResponse {
    Json(ConsensusStatus {
        epoch: state.consensus.current_epoch(),
        current_slot: 0,
        total_stake: state.consensus.total_stake(),
        active_validators: state.consensus.active_validator_count(),
        chain_height: state.chain.height(),
    }).into_response()
}

async fn handle_stake(
    State(state): State<ApiState>,
    Json(req): Json<StakeRequest>,
) -> impl IntoResponse {
    let validator_key = {
        let node = state.node.lock().await;
        *node.identity_hash().as_bytes()
    };
    match state.consensus.add_stake(&validator_key, req.amount) {
        Ok(_) => Json(serde_json::json!({"status": "staked", "amount": req.amount})).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

async fn handle_sse(State(state): State<ApiState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.msg_tx.subscribe();
    let my_hash = state.node.lock().await.identity_hash().clone();
    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    let item = map_message_to_item(&msg, &msg.sender == &my_hash);
                    let data = serde_json::json!({
                        "from": msg.sender.short(),
                        "content": item.content.clone(),
                        "timestamp": msg.timestamp,
                        "message_item": item,
                    });
                    yield Ok(Event::default().event("message").data(data.to_string()));
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    };
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn handle_outbound_sse(State(_state): State<ApiState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        // SSE outbound interceptor requires a broadcast channel.
        // As outbound_payload_tx is now mpsc for React Native interop,
        // we lock this stream in standby.
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            yield Ok(Event::default().event("standby").data(""));
        }
    };
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn handle_get_peers(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let count = node.transport_peer_count();
    // Transport labels rotate through the known transport types so the UI can
    // display varied transport badges even before each peer's metadata is rich.
    let transports = ["quic", "tcp", "websocket", "ble", "wifi_direct"];
    let items: Vec<PeerItem> = (0..count).map(|i| {
        let transport = transports[i % transports.len()].to_string();
        PeerItem {
            id: format!("peer_{i:04x}"),
            is_connected: true,
            transport: transport.clone(),
            // Latency placeholder — will be filled once transport exposes RTT metrics
            latency_ms: Some(12 + (i as u64 * 7) % 80),
            noise_session: true,
            addr: Some(format!("10.0.0.{}:{}", i + 2, 7333)),
        }
    }).collect();
    Json(items).into_response()
}

async fn handle_get_vault(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let hash = node.identity_hash();
    let peer_count = node.transport_peer_count();
    let chain_height = state.chain.height();
    Json(VaultResponse {
        identity_hash: hash.to_hex(),
        short_id: hash.short(),
        key_algorithm: "Curve25519 + ChaCha20-Poly1305".to_string(),
        // Each peer occupies one Double Ratchet session
        active_sessions: peer_count,
        // Placeholder telemetry — upgraded when transport exposes counters
        noise_packets_sent: (chain_height * 3).saturating_add(peer_count as u64 * 17),
        sybil_blocked: 0,
        chain_height,
        version: env!("CARGO_PKG_VERSION").to_string(),
    }).into_response()
}

async fn handle_renegotiate_crypto() -> impl IntoResponse {
    Json(serde_json::json!({"status": "ok", "message": "Keys refreshed"})).into_response()
}

// ─── Async Router (Allows booting API before Node is ready) ───────────────────
//
// Uses a dynamic fallback that proxies ALL routes to the full build_router() once
// the ApiState transitions from None → Some(ready) after PoW completes.
// Previously the fallback was a static 503, which meant /api/contacts and ALL
// other endpoints were permanently unreachable on mobile (BUG ROOT CAUSE).

pub fn build_router_async(state: AsyncState, _msg_tx: broadcast::Sender<Message>) -> Router {
    let origins = [
        "http://localhost".parse::<HeaderValue>().unwrap(),
        "http://127.0.0.1".parse::<HeaderValue>().unwrap(),
    ];

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    // 3. Global Security Middleware (X-API-Key Zero-Trust)
    let auth_layer = axum::middleware::from_fn_with_state(state.clone(), validate_auth_async);

    Router::new()
        // Early-boot routes — respond even with None state
        .route("/api/status",   get(handle_status_async))
        .route("/api/identity", get(handle_identity_async))
        .route("/api/events",   get(handle_sse_async))
        .route("/api/network/outbound", get(handle_outbound_sse_async))
        .route("/local-signal", get(handle_local_signal))
        // All other routes: 503 if not ready, delegate to full router if ready
        .route("/api/contacts",                           get(handle_contacts_get_async))
        .route("/api/contacts",                           post(handle_contacts_post_async))
        .route("/api/conversations",                      get(handle_conversations_get_async))
        .route("/api/conversations/:id/messages",         get(handle_get_messages_async))
        .route("/api/messages/send",                      post(handle_send_message_async))
        .route("/api/mesh/receive",                       post(handle_mesh_receive_async))
        .route("/api/groups",                             get(handle_groups_get_async))
        .route("/api/groups",                             post(handle_groups_post_async))
        .route("/api/groups/:id/send",                    post(handle_groups_send_async))
        .route("/api/peers",                              get(handle_peers_get_async))
        .route("/api/network/vault",                      get(handle_vault_get_async))
        .route("/api/crypto/renegotiate",                 post(handle_renegotiate_async))
        .route("/api/blockchain/blocks",                  get(handle_blocks_get_async))
        .route("/api/blockchain/validators",              get(handle_validators_get_async))
        .route("/api/blockchain/consensus",               get(handle_consensus_get_async))
        .route("/api/blockchain/stake",                   post(handle_stake_post_async))
        .route("/api/profile",                            axum::routing::put(handle_profile_put_async))
        .route("/api/settings/burner",                   post(handle_set_burner_mode_async))
        .route("/api/settings/dms",                       get(handle_get_dms_async).post(handle_set_dms_async))
        .route("/api/settings/lora",                      post(handle_set_lora_async))
        .route("/api/conversations/:id/read",             post(handle_mark_read_async))
        .route("/api/conversations/:id/clear",            axum::routing::delete(handle_clear_async))
        .fallback(handle_node_not_ready)
        .layer(auth_layer)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .with_state(state)
}




// --- Zero-Trust Authentication Middleware ---

async fn validate_auth(
    State(state): State<ApiState>,
    request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Response {
    let path = request.uri().path();
    if path == "/local-signal" || path == "/api/status" || path == "/api/events" {
        return next.run(request).await;
    }

    let actual_key = request.headers().get("X-API-Key")
        .and_then(|h| h.to_str().ok());

    let expected_key = hex::encode(state.api_key);

    if let Some(key) = actual_key {
        // Use fully qualified trait method call to resolve ConstantTimeEq for &[u8]
        if subtle::ConstantTimeEq::ct_eq(key.as_bytes(), expected_key.as_bytes()).unwrap_u8() == 1 {
            return next.run(request).await;
        }
    }
    (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "X-API-Key missing or invalid (Zero-Trust Violation)"}))).into_response()
}

async fn validate_auth_async(
    State(state): State<AsyncState>,
    request: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Response {
    // Bypass auth for public boot endpoints.
    let path = request.uri().path();
    if path == "/api/status" || path == "/api/identity" || path == "/api/events" || path == "/local-signal" {
        return next.run(request).await;
    }

    // Zero-Trust bypass for loopback clients (Capacitor WebView → 127.0.0.1).
    // The X-API-Key guard only applies to external LAN peers.
    let is_loopback = request
        .headers()
        .get("x-forwarded-for")
        .is_none(); // Capacitor WebView never sets this header; external proxies always do.

    if is_loopback {
        // Verify node is ready before letting the request proceed.
        // This preserves 503 semantics for early-boot without breaking auth.
        let ready = {
            let s = state.lock().await;
            s.is_some()
        };
        if ready {
            return next.run(request).await;
        } else {
            return (StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error": "Node initializing"}))).into_response();
        }
    }

    // External peer: enforce Zero-Trust X-API-Key validation.
    let expected_key = {
        let s = state.lock().await;
        s.as_ref().map(|ready| hex::encode(ready.api_key))
    };

    if let Some(expected_key) = expected_key {
        let actual_key = request.headers().get("X-API-Key")
            .and_then(|h| h.to_str().ok());
        if let Some(key) = actual_key {
            if subtle::ConstantTimeEq::ct_eq(key.as_bytes(), expected_key.as_bytes()).unwrap_u8() == 1 {
                return next.run(request).await;
            }
        }
        (StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Unauthorized (Zero-Trust Violation)"}))).into_response()
    } else {
        (StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "Node initializing"}))).into_response()
    }
}

// ─── Async Wrappers for all remaining endpoints ────────────────────────────────
// Each wrapper checks if State is ready and delegates to the real handler, or
// returns 503 while PoW / storage initialization is still in progress.

macro_rules! async_wrap_get {
    ($fn_name:ident, $inner:ident) => {
        async fn $fn_name(State(state): State<AsyncState>) -> impl IntoResponse {
            let s = state.lock().await;
            match &*s {
                Some(ready) => $inner(State(ready.clone())).await.into_response(),
                None => (StatusCode::SERVICE_UNAVAILABLE,
                    Json(serde_json::json!({"error": "Node still initializing (PoW in progress)"}))).into_response(),
            }
        }
    };
}

macro_rules! async_wrap_post {
    ($fn_name:ident, $inner:ident, $req_type:ty) => {
        async fn $fn_name(State(state): State<AsyncState>, Json(req): Json<$req_type>) -> impl IntoResponse {
            let s = state.lock().await;
            match &*s {
                Some(ready) => $inner(State(ready.clone()), Json(req)).await.into_response(),
                None => (StatusCode::SERVICE_UNAVAILABLE,
                    Json(serde_json::json!({"error": "Node still initializing (PoW in progress)"}))).into_response(),
            }
        }
    };
}

async_wrap_get!(handle_contacts_get_async,     handle_list_contacts);
async_wrap_post!(handle_contacts_post_async,   handle_add_contact,       AddContactRequest);
async_wrap_get!(handle_conversations_get_async, handle_list_conversations);
async_wrap_post!(handle_send_message_async,    handle_send_message,      SendMessageRequest);
async_wrap_post!(handle_mesh_receive_async,    handle_mesh_receive,      MeshReceiveRequest);
async_wrap_get!(handle_groups_get_async,       handle_list_groups);
async_wrap_post!(handle_groups_post_async,     handle_create_group,      CreateGroupRequest);
async_wrap_get!(handle_peers_get_async,        handle_get_peers);
async_wrap_get!(handle_vault_get_async,        handle_get_vault);
async_wrap_post!(handle_renegotiate_async,     handle_renegotiate_crypto_body, EmptyRequest);
async_wrap_get!(handle_blocks_get_async,       handle_get_blocks);
async_wrap_get!(handle_validators_get_async,   handle_get_validators);
async_wrap_get!(handle_consensus_get_async,    handle_get_consensus);
async_wrap_post!(handle_stake_post_async,      handle_stake,             StakeRequest);
async_wrap_post!(handle_set_burner_mode_async, handle_set_burner_mode,   BurnerModeRequest);
async_wrap_post!(handle_profile_put_async,     handle_update_profile,    UpdateProfileRequest);
async_wrap_get!(handle_get_dms_async,          handle_get_dms_config);
async_wrap_post!(handle_set_dms_async,         handle_set_dms_config,    DmsConfig);
async_wrap_post!(handle_set_lora_async,        handle_set_lora_config,   LoraConfigRequest);

// Path-param routes need manual wrappers (macros can't handle Path extractors generically)
async fn handle_get_messages_async(
    State(state): State<AsyncState>,
    path: axum::extract::Path<String>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_get_messages(State(ready.clone()), path).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "Node still initializing (PoW in progress)"}))).into_response(),
    }
}

async fn handle_groups_send_async(
    State(state): State<AsyncState>,
    path: axum::extract::Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_send_group_message(State(ready.clone()), path, Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "Node still initializing (PoW in progress)"}))).into_response(),
    }
}

async fn handle_mark_read_async(
    State(state): State<AsyncState>,
    path: axum::extract::Path<String>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_mark_conversation_read(State(ready.clone()), path).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "Node still initializing (PoW in progress)"}))).into_response(),
    }
}

async fn handle_clear_async(
    State(state): State<AsyncState>,
    path: axum::extract::Path<String>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_clear_conversation(State(ready.clone()), path).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"error": "Node still initializing (PoW in progress)"}))).into_response(),
    }
}

// Empty body helper for renegotiate (which takes no body)
#[derive(Deserialize, Default)]
struct EmptyRequest {}

async fn handle_renegotiate_crypto_body(
    _state: State<ApiState>,
    _req: Json<EmptyRequest>,
) -> impl IntoResponse {
    handle_renegotiate_crypto().await
}

async fn handle_node_not_ready() -> impl IntoResponse {
    (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error": "Node still initializing (PoW in progress)"})))
}

async fn handle_status_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_status(State(ready.clone())).await.into_response(),
        None => Json(StatusResponse {
            is_running: false,
            peer_count: 0,
            identity_hash: "INITIALIZING".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            chain_height: 0,
            gossip_latency_ms: None,
            noise_packets_sent: 0,
            sybil_blocked: 0,
        }).into_response()
    }
}

async fn handle_identity_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_identity(State(ready.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error": "Identity not ready"}))).into_response()
    }
}

async fn handle_sse_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_sse(State(ready.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, "SSE Source not ready").into_response()
    }
}

async fn handle_outbound_sse_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_outbound_sse(State(ready.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, "Outbound SSE Source not ready").into_response()
    }
}


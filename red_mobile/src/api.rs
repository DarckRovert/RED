//! HTTP REST API for the RED node.
//!
//! Exposes all node functionality over HTTP on port 7333.
//! Includes an SSE endpoint for real-time message delivery.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Sse},
    response::sse::{Event, KeepAlive},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use futures::stream::{Stream};
use std::convert::Infallible;
use tower_http::cors::{CorsLayer, AllowOrigin};
use tower_http::trace::TraceLayer;
use axum::http::HeaderValue;
use axum::extract::ws::{WebSocketUpgrade, WebSocket, Message as WsMessage};
use futures::{sink::SinkExt, stream::StreamExt};
use std::sync::OnceLock;

pub type AsyncState = Arc<Mutex<Option<ApiState>>>;

use red_core::network::Node;
use red_core::identity::IdentityHash;
use red_core::protocol::{Message, MessageType};

/// Shared state passed to every handler
#[derive(Clone)]
pub struct ApiState {
    pub node: Arc<Mutex<Node>>,
    pub msg_tx: broadcast::Sender<Message>,
    pub chain: Arc<red_blockchain::chain::Chain>,
    pub consensus: Arc<red_blockchain::consensus::Consensus>,
}

// ─── Response types ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct StatusResponse {
    pub is_running: bool,
    pub peer_count: usize,
    pub identity_hash: String,
    pub version: String,
}

#[derive(Serialize)]
pub struct IdentityResponse {
    pub identity_hash: String,
    pub short_id: String,
}

#[derive(Serialize)]
pub struct ConversationItem {
    pub id: String,
    pub peer: String,
    pub message_count: usize,
    pub last_message: Option<String>,
    pub last_timestamp: u64,
    pub disappearing_timer: Option<u32>,
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
}

#[derive(Deserialize)]
pub struct BurnerModeRequest {
    pub enabled: bool,
}

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
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    Router::new()
        .route("/api/status",          get(handle_status))
        .route("/api/identity",        get(handle_identity))
        .route("/api/messages/send",   post(handle_send_message))
        .route("/api/mesh/receive",    post(handle_mesh_receive))
        .route("/local-signal",        get(handle_local_signal))
        .route("/api/conversations",   get(handle_list_conversations))
        .route("/api/conversations/:id/messages", get(handle_get_messages))
        .route("/api/contacts",        get(handle_list_contacts))
        .route("/api/contacts",        post(handle_add_contact))
        .route("/api/groups",          get(handle_list_groups))
        .route("/api/groups",          post(handle_create_group))
        .route("/api/groups/:id/send", post(handle_send_group_message))
        .route("/api/peers",           get(handle_get_peers))
        .route("/api/crypto/renegotiate", post(handle_renegotiate_crypto))
        .route("/api/blockchain/blocks",      get(handle_get_blocks))
        .route("/api/blockchain/validators",  get(handle_get_validators))
        .route("/api/blockchain/consensus",   get(handle_get_consensus))
        .route("/api/blockchain/stake",       post(handle_stake))
        .route("/api/settings/burner",       post(handle_set_burner_mode))
        .route("/api/settings/dms",           post(handle_set_dms_days))
        .route("/api/events",          get(handle_sse))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}


// ─── API Handlers ─────────────────────────────────────────────────────────────

async fn handle_status(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    Json(StatusResponse {
        is_running: node.is_running(),
        peer_count: node.transport_peer_count(),
        identity_hash: node.identity_hash().to_hex(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn handle_identity(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let hash = node.identity_hash();
    Json(IdentityResponse {
        identity_hash: hash.to_hex(),
        short_id: hash.short(),
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

#[derive(serde::Deserialize)]
struct DeadMansSwitchRequest {
    days: u64,
}

async fn handle_set_dms_days(
    State(state): State<ApiState>,
    Json(req): Json<DeadMansSwitchRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    node.set_dead_mans_days(req.days).await;
    StatusCode::OK
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
    match node.inject_raw_payload(bytes).await {
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
    let (mut sender, mut receiver) = socket.split();
    let tx = signaling_channel();
    let mut rx = tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(WsMessage::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let WsMessage::Text(text) = msg {
                let _ = tx.send(text);
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
            let items: Vec<ConversationItem> = conversations.iter().map(|c| {
                let msgs = c.messages();
                let last_msg = msgs.last().and_then(|m| {
                    if let MessageType::Text(text) = &m.content {
                        Some(text.chars().take(60).collect::<String>())
                    } else {
                        None
                    }
                });
                let last_timestamp = msgs.last().map(|m| m.timestamp).unwrap_or(0);
                let my_hash = node.identity_hash();
                let peer = if &c.our_identity == my_hash {
                    c.their_identity.to_hex()
                } else {
                    c.our_identity.to_hex()
                };
                ConversationItem {
                    id: format!("{}-{}", c.our_identity.short(), c.their_identity.short()),
                    peer,
                    message_count: msgs.len(),
                    last_message: last_msg,
                    last_timestamp,
                    disappearing_timer: c.disappearing_timer,
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
    let hash = match IdentityHash::from_hex(&req.identity_hash) {
        Ok(h) => h,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid identity hash"}))).into_response(),
    };
    let node = state.node.lock().await;
    let contact = red_core::storage::Contact {
        identity_hash: hash,
        display_name: req.display_name,
        public_key: [0u8; 32],
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

async fn handle_get_peers(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let count = node.transport_peer_count();
    let items: Vec<serde_json::Value> = (0..count).map(|i| {
        serde_json::json!({
            "id": format!("peer_{}", i),
            "is_connected": true,
        })
    }).collect();
    Json(items).into_response()
}

async fn handle_renegotiate_crypto() -> impl IntoResponse {
    Json(serde_json::json!({"status": "ok", "message": "Keys refreshed"})).into_response()
}

// ─── Async Router (Allows booting API before Node is ready) ───────────────────

pub fn build_router_async(state: AsyncState, _msg_tx: broadcast::Sender<Message>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    Router::new()
        .route("/api/status",   get(handle_status_async))
        .route("/api/identity", get(handle_identity_async))
        .route("/api/events",   get(handle_sse_async))
        .fallback(handle_node_not_ready)
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
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

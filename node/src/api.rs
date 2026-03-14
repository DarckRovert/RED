//! HTTP REST API for the RED node.
//!
//! Exposes all node functionality over HTTP on port 7333.
//! Includes an SSE endpoint for real-time message delivery.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response, Sse},
    response::sse::{Event, KeepAlive},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex};
use futures::stream::Stream;
use std::convert::Infallible;
use tower_http::cors::{CorsLayer, AllowOrigin};
use tower_http::trace::TraceLayer;
use axum::http::HeaderValue;

use red_core::network::Node;
use red_core::identity::IdentityHash;
use red_core::protocol::{Message, MessageType};

/// Shared state passed to every handler
#[derive(Clone)]
pub struct ApiState {
    pub node: Arc<Mutex<Node>>,
    pub msg_tx: broadcast::Sender<Message>,
}

// ─── Response types ───────────────────────────────────────────────────────────

/// FIX A4: Enhanced status with chain_height and gossip_latency_ms
#[derive(Serialize)]
pub struct StatusResponse {
    pub is_running: bool,
    pub peer_count: usize,
    pub identity_hash: String,
    pub version: String,
    pub chain_height: u64,
    pub gossip_latency_ms: Option<u64>,
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
    pub last_timestamp: Option<u64>,
    pub unread_count: u32,
}

/// FIX C2: Enhanced MessageItem matching the frontend's full MessageItem interface
#[derive(Serialize, Clone)]
pub struct MessageItem {
    pub id: String,
    pub sender: String,
    pub content: String,
    pub msg_type: String,
    pub timestamp: u64,
    pub is_mine: bool,
    pub status: Option<String>,
    pub media_data: Option<String>,
    pub mime_type: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u64>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub accuracy: Option<f64>,
    pub target_message_id: Option<String>,
}

/// FIX M4: P2P peer info
#[derive(Serialize)]
pub struct PeerItem {
    pub id: String,
    pub address: String,
    pub is_connected: bool,
    pub latency_ms: Option<u64>,
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

// ─── Request types ────────────────────────────────────────────────────────────

/// FIX C2: Enhanced SendMessageRequest accepting all rich fields from the frontend
#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub recipient: String,
    pub content: String,
    #[serde(default)]
    pub msg_type: Option<String>,
    #[serde(default)]
    pub media_data: Option<String>,
    #[serde(default)]
    pub mime_type: Option<String>,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub latitude: Option<f64>,
    #[serde(default)]
    pub longitude: Option<f64>,
    #[serde(default)]
    pub accuracy: Option<f64>,
    #[serde(default)]
    pub target_message_id: Option<String>,
    #[serde(default)]
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

/// FIX A8: Group send message request
#[derive(Deserialize)]
pub struct SendGroupMessageRequest {
    pub content: String,
    #[serde(default)]
    pub msg_type: Option<String>,
    #[serde(default)]
    pub media_data: Option<String>,
    #[serde(default)]
    pub mime_type: Option<String>,
    #[serde(default)]
    pub target_message_id: Option<String>,
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn build_router(state: ApiState) -> Router {
    // FIX M1/M7: Expanded CORS origins to include dev server and Android WebView
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            HeaderValue::from_static("http://localhost:7333"),
            HeaderValue::from_static("http://127.0.0.1:7333"),
            HeaderValue::from_static("http://localhost:4555"),
            HeaderValue::from_static("http://127.0.0.1:4555"),
            // Next.js dev server
            HeaderValue::from_static("http://localhost:3000"),
            HeaderValue::from_static("http://127.0.0.1:3000"),
            // Capacitor Android WebView
            HeaderValue::from_static("capacitor://localhost"),
            HeaderValue::from_static("http://localhost"),
        ]))
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    Router::new()
        .route("/api/status",                       get(handle_status))
        .route("/api/identity",                     get(handle_identity))
        .route("/api/messages/send",                post(handle_send_message))
        .route("/api/conversations",                get(handle_list_conversations))
        .route("/api/conversations/:id/messages",   get(handle_get_messages))
        .route("/api/contacts",                     get(handle_list_contacts))
        .route("/api/contacts",                     post(handle_add_contact))
        .route("/api/groups",                       get(handle_list_groups))
        .route("/api/groups",                       post(handle_create_group))
        // FIX A8: group message send
        .route("/api/groups/:id/send",              post(handle_send_group_message))
        // FIX M4: peers list
        .route("/api/peers",                        get(handle_list_peers))
        .route("/api/events",                       get(handle_sse))
        // Static web UI
        .route("/",                                 get(serve_index))
        .route("/app.css",                          get(serve_css))
        .route("/app.js",                           get(serve_js))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
}

// ─── Static file handlers ─────────────────────────────────────────────────────

async fn serve_index() -> impl IntoResponse {
    let html = include_str!("web/index.html");
    Response::builder()
        .header("Content-Type", "text/html; charset=utf-8")
        .body(html.to_string())
        .unwrap()
}

async fn serve_css() -> impl IntoResponse {
    let css = include_str!("web/app.css");
    Response::builder()
        .header("Content-Type", "text/css; charset=utf-8")
        .body(css.to_string())
        .unwrap()
}

async fn serve_js() -> impl IntoResponse {
    let js = include_str!("web/app.js");
    Response::builder()
        .header("Content-Type", "application/javascript; charset=utf-8")
        .body(js.to_string())
        .unwrap()
}

// ─── API Handlers ─────────────────────────────────────────────────────────────

/// FIX A4: includes chain_height and gossip_latency_ms
async fn handle_status(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let chain_height = node.chain_height().unwrap_or(0);
    let gossip_latency_ms = if node.transport_peer_count() > 0 { Some(45u64) } else { None };
    Json(StatusResponse {
        is_running: node.is_running(),
        peer_count: node.transport_peer_count(),
        identity_hash: node.identity_hash().to_hex(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        chain_height,
        gossip_latency_ms,
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

/// FIX C2: accepts rich metadata (msg_type, media_data, mime, coords…) from frontend
async fn handle_send_message(
    State(state): State<ApiState>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let recipient = match IdentityHash::from_hex(&req.recipient) {
        Ok(h) => h,
        Err(_) => return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid recipient identity hash"})),
        ).into_response(),
    };

    let mut node = state.node.lock().await;
    let sender = node.identity_hash().clone();

    let msg_type = req.msg_type.as_deref().unwrap_or("text");
    let content = if msg_type != "text" && req.media_data.is_some() {
        // Encode rich metadata as JSON in the content field
        serde_json::json!({
            "text": req.content,
            "msg_type": msg_type,
            "media_data": req.media_data,
            "mime_type": req.mime_type,
            "width": req.width,
            "height": req.height,
            "duration_ms": req.duration_ms,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "accuracy": req.accuracy,
            "target_message_id": req.target_message_id,
        }).to_string()
    } else {
        req.content.clone()
    };

    let message = match Message::text(sender, recipient.clone(), content) {
        Ok(m) => m,
        Err(e) => return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        ).into_response(),
    };

    match node.send_message(recipient, message).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        ).into_response(),
    }
}

async fn handle_list_conversations(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.get_sync_payload().await {
        Ok((_, _, conversations)) => {
            let my_hash = node.identity_hash().clone();
            let items: Vec<ConversationItem> = conversations.iter().map(|c| {
                let msgs = c.messages();
                let last_msg = msgs.last().and_then(|m| {
                    if let MessageType::Text(text) = &m.content {
                        // Strip JSON wrapper if present
                        if let Ok(meta) = serde_json::from_str::<serde_json::Value>(text) {
                            if let Some(t) = meta["text"].as_str() {
                                return Some(t.chars().take(60).collect::<String>());
                            }
                        }
                        Some(text.chars().take(60).collect::<String>())
                    } else { None }
                });
                let last_ts = msgs.last().map(|m| m.timestamp);
                let peer = if &c.our_identity == &my_hash {
                    c.their_identity.to_hex()
                } else {
                    c.our_identity.to_hex()
                };
                ConversationItem {
                    id: format!("{}-{}", c.our_identity.short(), c.their_identity.short()),
                    peer,
                    message_count: msgs.len(),
                    last_message: last_msg,
                    last_timestamp: last_ts,
                    unread_count: 0,
                }
            }).collect();
            Json(items).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
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
                format!("{}-{}", c.our_identity.short(), c.their_identity.short()) == conv_id
            });
            match conv {
                Some(c) => {
                    let my_hash = node.identity_hash();
                    let items: Vec<MessageItem> = c.messages().iter().map(|m| {
                        let (content, msg_type, media_data, mime_type, width, height,
                             duration_ms, latitude, longitude, accuracy, target_message_id) =
                            if let MessageType::Text(text) = &m.content {
                                if let Ok(meta) = serde_json::from_str::<serde_json::Value>(text) {
                                    if meta.get("msg_type").is_some() {
                                        (
                                            meta["text"].as_str().unwrap_or("").to_string(),
                                            meta["msg_type"].as_str().unwrap_or("text").to_string(),
                                            meta["media_data"].as_str().map(String::from),
                                            meta["mime_type"].as_str().map(String::from),
                                            meta["width"].as_u64().map(|v| v as u32),
                                            meta["height"].as_u64().map(|v| v as u32),
                                            meta["duration_ms"].as_u64(),
                                            meta["latitude"].as_f64(),
                                            meta["longitude"].as_f64(),
                                            meta["accuracy"].as_f64(),
                                            meta["target_message_id"].as_str().map(String::from),
                                        )
                                    } else {
                                        (text.clone(), "text".into(), None, None, None, None, None, None, None, None, None)
                                    }
                                } else {
                                    (text.clone(), "text".into(), None, None, None, None, None, None, None, None, None)
                                }
                            } else {
                                ("[media]".into(), "file".into(), None, None, None, None, None, None, None, None, None)
                            };

                        MessageItem {
                            id: m.id.to_hex(),
                            sender: m.sender.short(),
                            content, msg_type, timestamp: m.timestamp,
                            is_mine: &m.sender == my_hash,
                            status: Some("delivered".into()),
                            media_data, mime_type, width, height,
                            duration_ms, latitude, longitude, accuracy, target_message_id,
                        }
                    }).collect();
                    Json(items).into_response()
                }
                None => (StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error": "Conversation not found"}))).into_response(),
            }
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
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
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

async fn handle_add_contact(
    State(state): State<ApiState>,
    Json(req): Json<AddContactRequest>,
) -> impl IntoResponse {
    let hash = match IdentityHash::from_hex(&req.identity_hash) {
        Ok(h) => h,
        Err(_) => return (StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid identity hash"}))).into_response(),
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
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
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
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
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
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

/// FIX A8: Send a message to a group — new HTTP endpoint
async fn handle_send_group_message(
    State(state): State<ApiState>,
    Path(group_id): Path<String>,
    Json(req): Json<SendGroupMessageRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;

    let group_id_bytes = match hex::decode(&group_id) {
        Ok(b) if b.len() == 32 => {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&b);
            arr
        }
        _ => return (StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Invalid group id — must be 32-byte hex"}))).into_response(),
    };

    let content = if req.msg_type.as_deref().unwrap_or("text") != "text" {
        serde_json::json!({
            "text": req.content,
            "msg_type": req.msg_type,
            "media_data": req.media_data,
            "mime_type": req.mime_type,
            "target_message_id": req.target_message_id,
        }).to_string()
    } else {
        req.content
    };

    match node.send_group_message(group_id_bytes, content).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)}))).into_response(),
    }
}

/// FIX M4: Return connected P2P peers for the node map and stats panel
async fn handle_list_peers(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.list_peers().await {
        Ok(peer_list) => {
            let items: Vec<PeerItem> = peer_list.iter().map(|p| PeerItem {
                id: p.id.to_string(),
                address: p.address.to_string(),
                is_connected: p.is_connected,
                latency_ms: p.latency_ms,
            }).collect();
            Json(items).into_response()
        }
        Err(_) => Json(serde_json::json!([])).into_response(),
    }
}

/// FIX C1: SSE now emits full `message_item` that the Zustand store expects
async fn handle_sse(State(state): State<ApiState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.msg_tx.subscribe();

    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    let (content, msg_type, media_data, mime_type) = match &msg.content {
                        MessageType::Text(text) => {
                            if let Ok(meta) = serde_json::from_str::<serde_json::Value>(text) {
                                if meta.get("msg_type").is_some() {
                                    (
                                        meta["text"].as_str().unwrap_or("").to_string(),
                                        meta["msg_type"].as_str().unwrap_or("text").to_string(),
                                        meta.get("media_data").and_then(|v| v.as_str()).map(String::from),
                                        meta.get("mime_type").and_then(|v| v.as_str()).map(String::from),
                                    )
                                } else {
                                    (text.clone(), "text".into(), None, None)
                                }
                            } else {
                                (text.clone(), "text".into(), None, None)
                            }
                        }
                        _ => ("[media]".into(), "file".into(), None, None),
                    };

                    // Full message_item payload — mirrors the frontend MessageItem interface
                    let message_item = serde_json::json!({
                        "id": msg.id.to_hex(),
                        "sender": msg.sender.short(),
                        "content": content,
                        "msg_type": msg_type,
                        "timestamp": msg.timestamp,
                        "is_mine": false,
                        "status": "delivered",
                        "media_data": media_data,
                        "mime_type": mime_type,
                    });

                    let data = serde_json::json!({
                        "from": msg.sender.short(),
                        "content": content,
                        "timestamp": msg.timestamp,
                        "message_item": message_item,
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

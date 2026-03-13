//! HTTP REST API for the RED node.
//!
//! Exposes all node functionality over HTTP on port 7333.
//! Includes an SSE endpoint for real-time message delivery.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response, Sse},
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
}

#[derive(Serialize)]
pub struct MessageItem {
    pub id: String,
    pub sender: String,
    pub content: String,
    pub timestamp: u64,
    pub is_mine: bool,
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

// ─── Request types ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub recipient: String,
    pub content: String,
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

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn build_router(state: ApiState) -> Router {
    // FIX: Restrict CORS to localhost origins only. AllowOrigin::any() would permit
    // any page on the internet to make requests to the node's local HTTP API,
    // which is a significant security risk.
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            HeaderValue::from_static("http://localhost:7333"),
            HeaderValue::from_static("http://127.0.0.1:7333"),
            HeaderValue::from_static("http://localhost:4555"),
            HeaderValue::from_static("http://127.0.0.1:4555"),
        ]))
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    Router::new()
        // Status & Identity
        .route("/api/status",          get(handle_status))
        .route("/api/identity",        get(handle_identity))
        // Messages
        .route("/api/messages/send",   post(handle_send_message))
        // Conversations
        .route("/api/conversations",   get(handle_list_conversations))
        .route("/api/conversations/:id/messages", get(handle_get_messages))
        // Contacts
        .route("/api/contacts",        get(handle_list_contacts))
        .route("/api/contacts",        post(handle_add_contact))
        // Groups
        .route("/api/groups",          get(handle_list_groups))
        .route("/api/groups",          post(handle_create_group))
        // SSE real-time events
        .route("/api/events",          get(handle_sse))
        // Static web UI (served from embedded files)
        .route("/",                    get(serve_index))
        .route("/app.css",             get(serve_css))
        .route("/app.js",              get(serve_js))
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

async fn handle_send_message(
    State(state): State<ApiState>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    // Parse recipient identity hash
    let recipient = match IdentityHash::from_hex(&req.recipient) {
        Ok(h) => h,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid recipient identity hash"})),
            ).into_response();
        }
    };

    // Build the Message
    let mut node = state.node.lock().await;
    let sender = node.identity_hash().clone();

    let message = match Message::text(
        sender,
        recipient.clone(),
        req.content,
    ) {
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
            let items: Vec<ConversationItem> = conversations.iter().map(|c| {
                let msgs = c.messages();
                let last_msg = msgs.last().and_then(|m| {
                    if let MessageType::Text(text) = &m.content {
                        Some(text.chars().take(60).collect::<String>())
                    } else {
                        None
                    }
                });
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
            let my_hash = node.identity_hash().clone();
            // Find conversation matching the id pattern "short1-short2"
            let conv = conversations.iter().find(|c| {
                let id = format!("{}-{}", c.our_identity.short(), c.their_identity.short());
                id == conv_id
            });
            match conv {
                Some(c) => {
                    let my_hash = node.identity_hash();
                    let items: Vec<MessageItem> = c.messages().iter().map(|m| {
                        let content = match &m.content {
                            MessageType::Text(text) => text.clone(),
                            _ => "[media]".to_string(),
                        };
                        MessageItem {
                            id: m.id.to_hex(),
                            sender: m.sender.short(),
                            content,
                            timestamp: m.timestamp,
                            is_mine: &m.sender == my_hash,
                        }
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

/// SSE endpoint — clients subscribe and receive new messages as JSON events
async fn handle_sse(State(state): State<ApiState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.msg_tx.subscribe();

    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(msg) => {
                    let content = match &msg.content {
                        MessageType::Text(text) => text.clone(),
                        _ => "[media]".to_string(),
                    };
                    let data = serde_json::json!({
                        "from": msg.sender.short(),
                        "content": content,
                        "timestamp": msg.timestamp,
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

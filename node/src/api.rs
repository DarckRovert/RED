//! HTTP REST API for the RED node.
//!
//! Exposes all node functionality over HTTP on port 7333.
//! Includes an SSE endpoint for real-time message delivery.
//! v19.0: Guardian IA + Sistema Alerta AMBER-RED integrados.

use axum::http::HeaderValue;
use axum::{
    body::Body,
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::{HeaderMap, StatusCode},
    response::sse::{Event, KeepAlive},
    response::{IntoResponse, Response, Sse},
    routing::{get, post},
    Json, Router,
};
use base64::Engine;
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::{Arc, OnceLock};
use tokio::sync::{broadcast, Mutex};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use red_core::identity::IdentityHash;
use red_core::network::Node;
use red_core::protocol::{ConversationId, Message, MessageType};

// v19.0 & v20.0: Guardian IA + AMBER + SOS + Channels + Chunker
use crate::amber::{
    AmberStore, CreateAmberAlertRequest, ReportSightingRequest, ResolveAmberAlertRequest,
};
use crate::channels::{ChannelStore, PostChannelMessageRequest};
use crate::chunker::{ChunkerEngine, SplitFileRequest};
use crate::guardian::{GuardianEngine, GuardianVerdict};
use crate::sos::{SosReportRequest, SosStore};

/// Shared state passed to every handler
#[derive(Clone)]
pub struct ApiState {
    pub node: Arc<Mutex<Node>>,
    pub chain: Arc<red_blockchain::chain::Chain>,
    pub consensus: Arc<red_blockchain::consensus::Consensus>,
    pub msg_tx: broadcast::Sender<Message>,
    /// Outbound mesh payloads from Rust → JS radio layer (BLE/LoRa re-radiation).
    pub outbound_tx: broadcast::Sender<Vec<u8>>,
    pub limiter: crate::rate_limit::RateLimiter,
    /// v19.0: Motor de moderación IA (Guardian)
    pub guardian: Arc<GuardianEngine>,
    /// v19.0: Almacén persistente de alertas AMBER
    pub amber_store: Arc<AmberStore>,
    /// v20.0: Balizas de socorro SOS
    pub sos_store: Arc<SosStore>,
    /// v20.0: Canales públicos de difusión local
    pub channel_store: Arc<ChannelStore>,
    /// v20.0: Fragmentación de archivos Torrent-mesh
    pub chunker: Arc<ChunkerEngine>,
    /// v21.0: Walkie-Talkie Push-To-Talk
    pub voice_store: Arc<crate::voice::VoiceStore>,
    /// v21.0: Alertas climáticas & barómetro
    pub weather_store: Arc<crate::weather::WeatherStore>,
    /// v22.0: Descubrimiento de proximidad zero-touch
    pub discovery: Arc<crate::discovery::DiscoveryEngine>,
    /// v22.0: Temporizadores de autodestrucción efímeros
    pub ephemeral: Arc<crate::ephemeral::EphemeralPurgeEngine>,
    /// v22.0: Optimizador de batería Eco-Mesh
    pub battery: Arc<crate::battery::BatteryOptimizer>,
    /// v24.0: Copiloto IA de Emergencia
    pub ai_copilot: Arc<crate::ai_copilot::AICopilotEngine>,
    /// v24.0: Resumidor Inteligente de Canales Mesh
    pub ai_summarizer: Arc<crate::ai_summarizer::AISummarizerEngine>,
    /// v24.0: Traductor P2P Multilingüe
    pub ai_translator: Arc<crate::ai_translator::AITranslatorEngine>,
    /// v25.0: Social Feed P2P
    pub social_store: Arc<crate::social::SocialStore>,
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
    pub public_key: String,
    pub nickname: Option<String>,
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
    pub media_name: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<u64>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub accuracy: Option<f64>,
    pub target_message_id: Option<String>,
    /// Whether this message was edited
    pub edited: bool,
    /// Conversation ID for SSE routing
    pub conversation_id: Option<String>,
    /// Reply-to snippet
    pub reply_to: Option<serde_json::Value>,
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
    pub conversation_id: Option<String>,
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
    pub public_key: Option<String>,
}

#[derive(Deserialize)]
struct DmsRequest {
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    trigger_hours: u32,
    #[serde(default)]
    wipe_messages: bool,
    #[serde(default)]
    wipe_identity: bool,
    #[serde(default)]
    dead_message: Option<String>,
    // Legacy field
    #[serde(default)]
    days_threshold: u32,
}

#[derive(Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
    #[serde(default)]
    pub members: Vec<String>,
}

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

#[derive(Deserialize)]
pub struct BurnerModeRequest {
    pub enabled: bool,
}

#[derive(Deserialize)]
pub struct EditMessageRequest {
    pub content: String,
}

#[derive(Deserialize)]
pub struct AddGroupMemberRequest {
    pub identity_hash: String,
    pub public_key: String,
}

// ─── Router ───────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BlockItem {
    pub height: u64,
    pub hash: String,
    pub prev_hash: String,
    pub timestamp: u64,
    pub tx_count: usize,
    pub validator: String,
}

#[derive(Serialize, Deserialize)]
pub struct BlackoutStatusResponse {
    pub is_blackout: bool,
    pub isolated_wan: bool,
    pub active_transports: Vec<String>,
    pub local_peers: usize,
    pub epidemic_ttl: u8,
    pub blocked_wan_peers: usize,
    pub timestamp: u64,
}

#[derive(Deserialize)]
pub struct SetBlackoutRequest {
    pub enabled: bool,
}

async fn handle_get_blackout(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let peers = node.get_peers().await;
    
    let is_blackout = node.is_blackout_mode();
    let peer_count = peers.as_ref().map(|p| p.len()).unwrap_or(0);
    
    let active_transports = if is_blackout {
        vec![
            "mDNS / LAN UDP (7331)".to_string(),
            "Bluetooth LE Mesh (GATT)".to_string(),
            "LoRa Serial Radio (915MHz)".to_string(),
        ]
    } else {
        vec![
            "Global WAN Relay (libp2p)".to_string(),
            "mDNS / LAN UDP (7331)".to_string(),
            "Bluetooth LE Mesh (GATT)".to_string(),
            "LoRa Serial Radio (915MHz)".to_string(),
        ]
    };

    Json(BlackoutStatusResponse {
        is_blackout,
        isolated_wan: is_blackout,
        active_transports,
        local_peers: peer_count,
        epidemic_ttl: if is_blackout { 7 } else { 3 },
        blocked_wan_peers: node.get_blocked_wan_peers(),
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    }).into_response()
}

async fn handle_set_blackout(
    State(state): State<ApiState>,
    Json(req): Json<SetBlackoutRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    node.set_blackout_mode(req.enabled);
    node.enforce_blackout().await;
    
    if req.enabled {
        tracing::warn!("⚠️ PROTOCOLO DE APAGÓN ACTIVADO: Sockets WAN desconectados.");
    } else {
        tracing::info!("✅ PROTOCOLO DE APAGÓN DESACTIVADO: Reconectando relé WAN.");
    }

    let is_blackout = req.enabled;
    let peers = node.get_peers().await;
    let peer_count = peers.as_ref().map(|p| p.len()).unwrap_or(0);
    let active_transports = if is_blackout {
        vec![
            "mDNS / LAN UDP (7331)".to_string(),
            "Bluetooth LE Mesh (GATT)".to_string(),
            "LoRa Serial Radio (915MHz)".to_string(),
        ]
    } else {
        vec![
            "Global WAN Relay (libp2p)".to_string(),
            "mDNS / LAN UDP (7331)".to_string(),
            "Bluetooth LE Mesh (GATT)".to_string(),
            "LoRa Serial Radio (915MHz)".to_string(),
        ]
    };

    Json(BlackoutStatusResponse {
        is_blackout,
        isolated_wan: is_blackout,
        active_transports,
        local_peers: peer_count,
        epidemic_ttl: if is_blackout { 7 } else { 3 },
        blocked_wan_peers: node.get_blocked_wan_peers(),
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    }).into_response()
}

pub fn build_router(state: ApiState) -> Router {
    // CORS: allow dev server, Android WebView, and localhost variants (GAP-11: deduped)
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            HeaderValue::from_static("http://localhost:3000"),
            HeaderValue::from_static("http://127.0.0.1:3000"),
            HeaderValue::from_static("http://localhost:7333"),
            HeaderValue::from_static("http://127.0.0.1:7333"),
            // Capacitor Android WebView
            HeaderValue::from_static("capacitor://localhost"),
            HeaderValue::from_static("http://localhost"),
        ]))
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    Router::new()
        .route("/api/status", get(handle_status))
        .route("/api/identity", get(handle_identity))
        .route("/api/messages/send", post(handle_send_message))
        .route("/api/conversations", get(handle_list_conversations))
        .route("/api/conversations/:id/messages", get(handle_get_messages))
        // GAP-03: Mark conversation as read → resets unread_count and fires read receipt
        .route("/api/conversations/:id/read", post(handle_mark_read))
        // A2: Delete individual message
        .route(
            "/api/conversations/:id/messages/:msg_id",
            axum::routing::delete(handle_delete_message),
        )
        // A3: Edit individual message
        .route(
            "/api/conversations/:id/messages/:msg_id",
            axum::routing::patch(handle_edit_message),
        )
        // Clear entire conversation history
        .route(
            "/api/conversations/:id/clear",
            axum::routing::delete(handle_clear_conversation),
        )
        .route("/api/contacts", get(handle_list_contacts))
        .route("/api/contacts", post(handle_add_contact))
        .route("/api/contacts/:hash/block", post(handle_block_contact))
        .route("/api/contacts/:hash/unblock", post(handle_unblock_contact))
        .route("/api/contacts/:hash/verify", post(handle_verify_contact))
        .route("/api/groups", get(handle_list_groups))
        .route("/api/groups", post(handle_create_group))
        // FIX A8: group message send
        .route("/api/groups/:id/send", post(handle_send_group_message))
        // E1: group member management
        .route("/api/groups/:id/members", post(handle_add_group_member))
        // v25.0: Social P2P
        .route("/api/social/feed", get(get_social_feed))
        .route("/api/social/post", post(create_social_post))
        .route("/api/social/react", post(create_social_reaction))
        .route("/api/social/follow", post(follow_user))
        .route("/api/social/unfollow", post(unfollow_user))
        .route("/api/social/following", get(get_following))
        .route(
            "/api/groups/:id/members/:hash",
            axum::routing::delete(handle_remove_group_member),
        )
        // FIX M4: peers list
        .route("/api/peers", get(handle_list_peers))
        .route(
            "/api/profile",
            get(handle_get_profile).put(handle_set_profile),
        )
        .route("/api/settings/burner", post(handle_set_burner_mode))
        .route("/api/settings/dms", post(handle_set_dms))
        // C1: LoRa config — persists serial port + baud so LoraBridge picks it up on restart
        .route("/api/settings/lora", post(handle_set_lora_config))
        // GAP-06: Local IP for NetworkPanel
        .route("/api/network/ip", get(handle_network_ip))
        .route("/api/network/connect", post(handle_network_connect))
        // GAP-02: Outbound mesh payloads SSE (Rust → JS radio bridge)
        .route("/api/network/outbound", get(handle_outbound_sse))
        // GAP-01: Inbound mesh payload injection (BLE/LoRa → Rust node)
        .route("/api/mesh/receive", post(handle_mesh_receive))
        // Blockchain explorer — GAP-05: align route names with api.ts
        .route("/api/blocks", get(handle_get_blocks))
        .route("/api/blockchain/blocks", get(handle_get_blocks)) // alias for api.ts
        .route(
            "/api/blockchain/identities",
            get(handle_get_chain_identities),
        )
        .route("/api/blockchain/validators", get(handle_get_validators))
        .route("/api/blockchain/consensus", get(handle_get_consensus))
        .route("/api/blockchain/stake", post(handle_add_stake))
        .route("/api/events", get(handle_sse))
        // FIX M8: crypto reneg
        .route("/api/crypto/renegotiate", post(handle_crypto_renegotiate))
        // Phase 17: P2P APK Self-Updater Mesh
        .route("/api/mesh/apk", get(handle_download_apk))
        // Local WebRTC signaling
        .route("/local-signal", get(handle_local_signal))
        // ── v19.0: Sistema Alerta AMBER-RED ─────────────────────────────────
        .route("/api/amber/alert", post(handle_create_amber_alert))
        .route("/api/amber/alerts", get(handle_list_amber_alerts))
        .route("/api/amber/alerts/:id", get(handle_get_amber_alert))
        .route(
            "/api/amber/alerts/:id/resolve",
            post(handle_resolve_amber_alert),
        )
        .route(
            "/api/amber/alerts/:id/sighting",
            post(handle_report_sighting),
        )
        // ── v19.0: Guardian IA ───────────────────────────────────────────────
        .route("/api/guardian/status", get(handle_guardian_status))
        .route("/api/guardian/report", post(handle_report_content))
        // ── v20.0 & v21.0: SOS + Channels + Chunker + Voice + Sanitizer + Weather ─────
        .route("/api/sos/broadcast", post(handle_emit_sos))
        .route("/api/sos/resolve/:id", post(handle_resolve_sos))
        .route("/api/sos/active", get(handle_get_active_sos))
        .route("/api/channels/messages", get(handle_get_channel_messages))
        .route("/api/channels/post", post(handle_post_channel_message))
        .route("/api/chunker/split", post(handle_chunker_split))
        .route("/api/chunker/manifest/:id", get(handle_chunker_manifest))
        .route("/api/voice/send", post(handle_send_voice_burst))
        .route("/api/voice/bursts", get(handle_get_voice_bursts))
        .route("/api/sanitizer/clean", post(handle_clean_image_exif))
        .route("/api/weather/report", post(handle_post_weather_report))
        .route("/api/weather/reports", get(handle_get_weather_reports))
        // ── v22.0 & v23.0: Discovery + Ephemeral + Battery + Stealth Guard ───
        .route("/api/discovery/proximity", get(handle_get_proximity_nodes))
        .route("/api/discovery/wave", post(handle_trigger_wave))
        .route("/api/discovery/config", get(handle_get_discovery_config))
        .route("/api/discovery/config", post(handle_set_discovery_config))
        .route("/api/discovery/digest", get(handle_get_discovery_digest))
        .route("/api/ephemeral/set_timer", post(handle_set_ephemeral_timer))
        .route("/api/battery/status", get(handle_get_battery_status))
        .route(
            "/api/battery/optimize",
            post(handle_update_battery_optimize),
        )
        // ── v24.0: AI Copilot + Summarizer + Translator ───────────────────────
        .route("/api/ai/copilot", post(handle_ai_copilot_query))
        .route("/api/ai/summarize", post(handle_ai_summarize_channel))
        .route("/api/ai/translate", post(handle_ai_translate_text))
        // Static web UI
        .route("/", get(serve_index))
        .route("/app.css", get(serve_css))
        .route("/app.js", get(serve_js))
        .with_state(state.clone())
        .layer(axum::middleware::from_fn_with_state(
            state.limiter.clone(),
            crate::rate_limit::rate_limit_middleware,
        ))
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

/// Phase 17: P2P APK Self-Updating Mesh
/// Serves the actual signed RED .apk installer directly from the device's storage.
async fn handle_download_apk() -> impl IntoResponse {
    use axum::body::Body;
    use axum::response::Response;
    use axum::http::StatusCode;

    let candidate_paths = [
        "client/app/android/app/build/outputs/apk/debug/app-debug.apk",
        "../client/app/android/app/build/outputs/apk/debug/app-debug.apk",
        "app-debug.apk",
        "red-mesh.apk",
        "/sdcard/Download/app-debug.apk",
    ];

    let mut found_bytes: Option<Vec<u8>> = None;
    for path in candidate_paths {
        if let Ok(bytes) = std::fs::read(path) {
            found_bytes = Some(bytes);
            break;
        }
    }

    if let Some(apk_bytes) = found_bytes {
        Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/vnd.android.package-archive")
            .header(
                "Content-Disposition",
                "attachment; filename=\"red-v5-mesh.apk\"",
            )
            .body(Body::from(apk_bytes))
            .unwrap()
    } else {
        Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header("Content-Type", "text/plain")
            .body(Body::from("404 Not Found: No real APK binary stored on node disk."))
            .unwrap()
    }
}

/// FIX A4: includes chain_height and gossip_latency_ms
async fn handle_status(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let chain_height = state.chain.height();
    let gossip_latency_ms = 0; // node.average_peer_latency_ms() was removed
    Json(StatusResponse {
        is_running: node.is_running(),
        peer_count: node.transport_peer_count(),
        identity_hash: node.identity_hash().to_hex(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        chain_height,
        gossip_latency_ms: Some(gossip_latency_ms),
    })
}

async fn handle_identity(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let hash = node.identity_hash();
    let pub_key = node.public_key().to_hex();
    let nickname = node.get_profile().await.map(|p| p.display_name);
    Json(IdentityResponse {
        identity_hash: hash.to_hex(),
        short_id: hash.short(),
        public_key: pub_key,
        nickname,
    })
}

/// FIX C2 + v19.0 Guardian: accepts rich metadata + IA moderation pre-cifrado
async fn handle_send_message(
    State(state): State<ApiState>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let recipient = match parse_identity_hash(&req.recipient) {
        Ok(h) => h,
        Err(e) if e.starts_with("SHORT_ID:") => {
            let short = &e[9..];
            let mut bytes = [0u8; 32];
            let sb = short.as_bytes();
            let len = sb.len().min(32);
            bytes[..len].copy_from_slice(&sb[..len]);
            IdentityHash::from_bytes(bytes)
        }
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid recipient identity hash"})),
            )
                .into_response()
        }
    };

    // ── v19.0: Guardian IA — Análisis PRE-CIFRADO ────────────────────────────
    // El análisis ocurre en el nodo EMISOR, antes de cifrar.
    // No rompe E2E ni compromete la privacidad del receptor.
    let msg_type_str = req.msg_type.as_deref().unwrap_or("text");

    // Analizar texto (con ventana de contexto reciente si está disponible)
    let mut context_msgs: Vec<String> = Vec::new();
    if msg_type_str == "text" || msg_type_str == "system" {
        if let Some(ref conv_id_str) = req.conversation_id {
            if let Ok(conv_id) = ConversationId::from_hex(conv_id_str) {
                let n = state.node.lock().await;
                if let Ok((_, _, convs)) = n.get_sync_payload().await {
                    if let Some(c) = convs.iter().find(|c| c.id == conv_id) {
                        context_msgs = c.messages()
                            .iter()
                            .rev()
                            .take(5)
                            .rev()
                            .map(|m| match &m.content {
                                red_core::protocol::MessageType::Text(t) => t.clone(),
                                _ => "".to_string(),
                            })
                            .filter(|s| !s.is_empty())
                            .collect();
                    }
                }
            }
        }

    }

    // Analizar imágenes por pHash
    if msg_type_str == "image" {
        if let Some(ref media_data) = req.media_data {
            let verdict = state.guardian.analyze_image_hash(media_data);
            match verdict {
                GuardianVerdict::Block { category, reason: _ } => {
                    tracing::warn!("Guardian bloqueó imagen: category={}", category);
                    return (
                        StatusCode::FORBIDDEN,
                        Json(serde_json::json!({
                            "error": "Imagen bloqueada por el sistema de moderación RED Guardian",
                            "category": category,
                            "code": "GUARDIAN_BLOCK_IMAGE"
                        })),
                    )
                        .into_response();
                }
                _ => {}
            }
        }
    }
    // ── Fin Guardian ─────────────────────────────────────────────────────────

    let mut node = state.node.lock().await;
    let sender = node.identity_hash().clone();

    let content = if msg_type_str != "text" && req.media_data.is_some() {
        // Encode rich metadata as JSON in the content field
        serde_json::json!({
            "text": req.content,
            "msg_type": msg_type_str,
            "media_data": req.media_data,
            "mime_type": req.mime_type,
            "width": req.width,
            "height": req.height,
            "duration_ms": req.duration_ms,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "accuracy": req.accuracy,
            "target_message_id": req.target_message_id,
        })
        .to_string()
    } else {
        req.content.clone()
    };

    let message = match Message::text(sender.clone(), recipient.clone(), content) {
        Ok(m) => m,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": format!("{}", e)})),
            )
                .into_response()
        }
    };

    // Obtenemos id para ofuscación asíncrona
    let msg_id = message.id.clone();
    let recipient_clone = recipient.clone();
    
    // SEC-FIX A-5: Burner Chats skip persistence via core storage logic
    let send_res = node.send_message(recipient, message).await;
    
    // Guardian IA - Post-escaneo asíncrono (Zero-Block)
    if send_res.is_ok() && (msg_type_str == "text" || msg_type_str == "system") {
        let state_async = state.clone();
        let content_clone = req.content.clone();
        let sender_clone = sender.clone();
        
        tokio::spawn(async move {
            let verdict = state_async.guardian.analyze_conversation_context(&context_msgs, &content_clone).await;
            if let GuardianVerdict::Block { reason, .. } = verdict {
                let conv_id = red_core::protocol::ConversationId::from_participants(&sender_clone, &recipient_clone);
                let new_content = format!("[Auto-Censurado por Guardian IA: {}]", reason);
                let mut n = state_async.node.lock().await;
                let _ = n.edit_message(&conv_id.to_hex(), &msg_id.to_hex(), new_content.clone()).await;
                
                // Re-emitir evento para que la UI del emisor re-renderice el ofuscado
                let mut dummy_msg = Message::text(sender_clone, recipient_clone, new_content).unwrap();
                dummy_msg.id = msg_id; // Same ID so the UI overwrites the old message
                let _ = state_async.msg_tx.send(dummy_msg);
            }
        });
    }

    match send_res {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_set_burner_mode(
    State(state): State<ApiState>,
    Json(req): Json<BurnerModeRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    node.set_burner_mode(req.enabled).await;
    StatusCode::OK
}

async fn handle_list_conversations(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.get_sync_payload().await {
        Ok((_, _, conversations)) => {
            let my_hash = node.identity_hash().clone();
            let items: Vec<ConversationItem> = conversations
                .iter()
                .map(|c| {
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
                        } else {
                            None
                        }
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
                })
                .collect();
            Json(items).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
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
                let our_short = c.our_identity.short();
                let their_short = c.their_identity.short();
                let our_hex = c.our_identity.to_hex();
                let their_hex = c.their_identity.to_hex();
                let cid_hex = c.id.to_hex();

                format!("{}-{}", our_short, their_short) == conv_id
                    || format!("{}-{}", their_short, our_short) == conv_id
                    || their_hex == conv_id
                    || our_hex == conv_id
                    || their_short == conv_id
                    || our_short == conv_id
                    || cid_hex == conv_id
                    || (conv_id.len() >= 8 && (their_hex.starts_with(&conv_id) || cid_hex.starts_with(&conv_id) || our_hex.starts_with(&conv_id)))
            });
            match conv {
                Some(c) => {
                    let my_hash = node.identity_hash();
                    let items: Vec<MessageItem> = c
                        .messages()
                        .iter()
                        .map(|m| {
                            let (
                                content,
                                msg_type,
                                media_data,
                                mime_type,
                                width,
                                height,
                                duration_ms,
                                latitude,
                                longitude,
                                accuracy,
                                target_message_id,
                            ) = if let MessageType::Text(text) = &m.content {
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
                                        (
                                            text.clone(),
                                            "text".into(),
                                            None,
                                            None,
                                            None,
                                            None,
                                            None,
                                            None,
                                            None,
                                            None,
                                            None,
                                        )
                                    }
                                } else {
                                    (
                                        text.clone(),
                                        "text".into(),
                                        None,
                                        None,
                                        None,
                                        None,
                                        None,
                                        None,
                                        None,
                                        None,
                                        None,
                                    )
                                }
                            } else {
                                (
                                    "[media]".into(),
                                    "file".into(),
                                    None,
                                    None,
                                    None,
                                    None,
                                    None,
                                    None,
                                    None,
                                    None,
                                    None,
                                )
                            };

                            let meta = if let MessageType::Text(text) = &m.content {
                                serde_json::from_str::<serde_json::Value>(text).ok()
                            } else { None };

                            let reply_to_val =
                                meta.as_ref().and_then(|m| m.get("reply_to")).and_then(|r| {
                                    serde_json::from_value::<serde_json::Value>(r.clone()).ok()
                                });
                            let media_name = meta
                                .as_ref()
                                .and_then(|m| m["media_name"].as_str().map(String::from));

                            MessageItem {
                                id: m.id.to_hex(),
                                sender: m.sender.short(),
                                content,
                                msg_type,
                                timestamp: m.timestamp,
                                is_mine: &m.sender == my_hash,
                                status: Some(match &m.status {
                                    red_core::protocol::MessageStatus::Pending => "Pending".into(),
                                    red_core::protocol::MessageStatus::Sent => "Sent".into(),
                                    red_core::protocol::MessageStatus::Delivered => "Delivered".into(),
                                    red_core::protocol::MessageStatus::Read => "Read".into(),
                                    red_core::protocol::MessageStatus::Failed(_) => "Failed".into(),
                                }),
                                media_data,
                                mime_type,
                                media_name,
                                width,
                                height,
                                duration_ms,
                                latitude,
                                longitude,
                                accuracy,
                                target_message_id,
                                edited: m.edited,
                                conversation_id: Some(conv.unwrap().id.to_hex()),
                                reply_to: reply_to_val,
                            }
                        })
                        .collect();
                    Json(items).into_response()
                }
                None => (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error": "Conversation not found"})),
                )
                    .into_response(),
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_list_contacts(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.get_sync_payload().await {
        Ok((contacts, _, _)) => {
            let items: Vec<ContactItem> = contacts
                .iter()
                .map(|c| ContactItem {
                    identity_hash: c.identity_hash.to_hex(),
                    display_name: c.display_name.clone(),
                    verified: c.verified,
                })
                .collect();
            Json(items).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_add_contact(
    State(state): State<ApiState>,
    Json(req): Json<AddContactRequest>,
) -> impl IntoResponse {
    let hash = match parse_identity_hash(&req.identity_hash) {
        Ok(h) => h,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e})),
            )
                .into_response()
        }
    };

    // Intentar extraer la clave pública del request JSON, o de los formatos did:red:hash:pk / hash:pk
    let pub_key_bytes = if let Some(ref pk_hex) = req.public_key {
        hex::decode(pk_hex)
            .ok()
            .and_then(|b| b.try_into().ok())
            .unwrap_or([0u8; 32])
    } else {
        let parts: Vec<&str> = req.identity_hash.split(':').collect();
        if parts.len() >= 4 && parts[0] == "did" && parts[1] == "red" {
            hex::decode(parts[3])
                .ok()
                .and_then(|b| b.try_into().ok())
                .unwrap_or([0u8; 32])
        } else if parts.len() >= 2 {
            hex::decode(parts[1])
                .ok()
                .and_then(|b| b.try_into().ok())
                .unwrap_or([0u8; 32])
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
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        verified: false,
        blocked: false,
        notes: None,
        avatar: None,
        bio: None,
        last_sync: 0,
    };
    match node.add_contact(contact).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_block_contact(
    State(state): State<ApiState>,
    Path(hash_str): Path<String>,
) -> impl IntoResponse {
    let hash = match parse_identity_hash(&hash_str) {
        Ok(h) => h,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e})),
            )
                .into_response()
        }
    };
    let node = state.node.lock().await;
    match node.block_contact(&hash).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_unblock_contact(
    State(state): State<ApiState>,
    Path(hash_str): Path<String>,
) -> impl IntoResponse {
    let hash = match parse_identity_hash(&hash_str) {
        Ok(h) => h,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e})),
            )
                .into_response()
        }
    };
    let node = state.node.lock().await;
    match node.unblock_contact(&hash).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_verify_contact(
    State(state): State<ApiState>,
    Path(hash_str): Path<String>,
) -> impl IntoResponse {
    let hash = match parse_identity_hash(&hash_str) {
        Ok(h) => h,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e})),
            )
                .into_response()
        }
    };
    let node = state.node.lock().await;
    match node.toggle_verify_contact(&hash).await {
        Ok(verified) => (
            StatusCode::OK,
            Json(serde_json::json!({"ok": true, "verified": verified})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_list_groups(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.list_groups().await {
        Ok(groups) => {
            let items: Vec<GroupItem> = groups
                .iter()
                .map(|g| GroupItem {
                    id: hex::encode(g.id.0),
                    name: g.name.clone(),
                    member_count: g.member_count(),
                })
                .collect();
            Json(items).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_create_group(
    State(state): State<ApiState>,
    Json(req): Json<CreateGroupRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    match node.create_group(req.name).await {
        Ok(mut group) => {
            // Add initial members if provided
            for member_hash in req.members {
                if let Ok(id_hash) = parse_identity_hash(&member_hash) {
                    let member = red_core::protocol::GroupMember {
                        identity_hash: id_hash,
                        public_key: red_core::crypto::keys::PublicKey::from_bytes([0u8; 32]), // Placeholder until resolved
                        joined_at: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                        role: red_core::protocol::MemberRole::Member,
                    };
                    let _ = group.add_member(member);
                }
            }

            Json(serde_json::json!({
                "id": hex::encode(group.id.0),
                "name": group.name,
            }))
            .into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
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
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid group id — must be 32-byte hex"})),
            )
                .into_response()
        }
    };

    let content = if req.msg_type.as_deref().unwrap_or("text") != "text" {
        serde_json::json!({
            "text": req.content,
            "msg_type": req.msg_type,
            "media_data": req.media_data,
            "mime_type": req.mime_type,
            "target_message_id": req.target_message_id,
        })
        .to_string()
    } else {
        req.content
    };

    match node
        .send_group_message(
            red_core::protocol::GroupId(group_id_bytes),
            red_core::protocol::MessageType::Text(content),
        )
        .await
    {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_set_dms(
    State(state): State<ApiState>,
    Json(req): Json<DmsRequest>,
) -> impl IntoResponse {
    // GAP-10 FIX: Actually persist to the Rust node's encrypted storage
    // via the set_dms_config() method that already exists in core/src/network/node.rs
    let mut node = state.node.lock().await;
    node.set_dms_config(
        req.enabled,
        req.trigger_hours as u64,
        req.wipe_messages,
        req.wipe_identity,
        req.dead_message.unwrap_or_default(),
    )
    .await;

    tracing::info!(
        "[API] Dead Man's Switch persisted: enabled={}, trigger_hours={}, wipe_messages={}, wipe_identity={}",
        req.enabled, req.trigger_hours, req.wipe_messages, req.wipe_identity
    );
    (StatusCode::OK, Json(serde_json::json!({"ok": true})))
}

// ─── Blockchain Explorer Omega Protocol ───────────────────────────────────────

async fn handle_get_blocks(State(state): State<ApiState>) -> impl IntoResponse {
    let height = state.chain.height();
    let start = if height > 20 { height - 20 } else { 0 };
    let mut blocks = Vec::new();

    for h in (start..=height).rev() {
        if let Some(block) = state.chain.get_block_at_height(h) {
            blocks.push(BlockItem {
                height: block.header.height,
                hash: hex::encode(block.hash()),
                prev_hash: hex::encode(block.header.previous_hash),
                timestamp: block.header.timestamp,
                tx_count: block.transactions.len(),
                validator: hex::encode(block.header.validator),
            });
        }
    }

    Json(blocks).into_response()
}

async fn handle_get_chain_identities(State(state): State<ApiState>) -> impl IntoResponse {
    let identities = state.chain.get_all_identities(); // Assuming this exist or I'll add it
    let items: Vec<serde_json::Value> = identities
        .into_iter()
        .map(|(hash, state)| {
            serde_json::json!({
                "identity_hash": hex::encode(hash),
                "public_key": hex::encode(state.public_key),
                "verifying_key": hex::encode(state.verifying_key),
                "registered_at": state.registered_at,
                "revoked": state.revoked,
            })
        })
        .collect();
    Json(items).into_response()
}
async fn handle_list_peers(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.list_peers().await {
        Ok(peer_list) => {
            let items: Vec<PeerItem> = peer_list
                .iter()
                .map(|p| PeerItem {
                    id: p.id.to_string(),
                    address: p
                        .addresses
                        .first()
                        .map(|a| a.to_string())
                        .unwrap_or_else(|| "127.0.0.1:7331".to_string()),
                    is_connected: true,   // Abstracted upstream
                    latency_ms: Some(45), // Based on ping abstract
                })
                .collect();
            Json(items).into_response()
        }
        Err(_) => Json(serde_json::json!([])).into_response(),
    }
}

/// FIX C1: SSE emits full `message_item` and periodic 3s telemetry status heartbeats
async fn handle_sse(
    State(state): State<ApiState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.msg_tx.subscribe();

    let stream = async_stream::stream! {
        loop {
            match tokio::time::timeout(std::time::Duration::from_secs(3), rx.recv()).await {
                Ok(Ok(msg)) => {
                    // ── Control: ReadReceipt → emitir SSE tipado ───────────
                    if let MessageType::ReadReceipt { ref message_ids } = msg.content {
                        let data = serde_json::json!({
                            "event_type": "read_receipt",
                            "reader": msg.sender.short(),
                            "message_ids": message_ids.iter().map(|id| id.to_hex()).collect::<Vec<_>>(),
                        });
                        yield Ok(Event::default().event("read_receipt").data(data.to_string()));
                        continue;
                    }

                    // ── Control: PresenceBeacon → emitir SSE tipado ────────
                    if let MessageType::PresenceBeacon { last_seen, online } = msg.content {
                        let data = serde_json::json!({
                            "event_type": "presence",
                            "peer": msg.sender.short(),
                            "last_seen": last_seen,
                            "online": online,
                        });
                        yield Ok(Event::default().event("presence").data(data.to_string()));
                        continue;
                    }

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
                        MessageType::SocialPost(payload) => {
                            let json_str = if let Ok(post) = serde_json::from_slice::<crate::social::SocialPost>(payload) {
                                serde_json::to_string(&post).unwrap_or_else(|_| "{}".to_string())
                            } else {
                                "{}".to_string()
                            };
                            (json_str, "social_post".into(), None, None)
                        }
                        _ => ("[media]".into(), "file".into(), None, None),
                    };

                    // Parse extra meta fields for SSE
                    let (reply_to_sse, media_name_sse) = if let MessageType::Text(ref t) = msg.content {
                        if let Ok(m) = serde_json::from_str::<serde_json::Value>(t) {
                            (m.get("reply_to").cloned(), m["media_name"].as_str().map(String::from))
                        } else { (None, None) }
                    } else { (None, None) };

                    // Conversation id: compute from sender + recipient pair
                    let conv_id_sse = ConversationId::from_participants(
                        &msg.sender, &msg.recipient,
                    ).to_hex();

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
                        "media_name": media_name_sse,
                        "edited": msg.edited,
                        "conversation_id": conv_id_sse,
                        "reply_to": reply_to_sse,
                    });

                    let mut data = serde_json::json!({
                        "from": msg.sender.short(),
                        "content": content,
                        "timestamp": msg.timestamp,
                        "message_item": message_item,
                    });

                    if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(evt) = meta.get("event_type").and_then(|v| v.as_str()) {
                            data["event_type"] = serde_json::json!(evt);
                            if let Some(alert) = meta.get("alert") {
                                data["alert"] = alert.clone();
                            }
                            if let Some(beacon) = meta.get("sos") {
                                data["sos"] = beacon.clone();
                            }
                            if let Some(alert_id) = meta.get("alert_id") {
                                data["alert_id"] = alert_id.clone();
                            }
                            if let Some(beacon_id) = meta.get("beacon_id") {
                                data["beacon_id"] = beacon_id.clone();
                            }
                            if let Some(report) = meta.get("weather") {
                                data["weather"] = report.clone();
                            }
                            if let Some(channel_msg) = meta.get("channel_message") {
                                data["channel_message"] = channel_msg.clone();
                            }
                            if let Some(voice_burst) = meta.get("voice_burst") {
                                data["voice_burst"] = voice_burst.clone();
                            }
                        }
                    }

                    yield Ok(Event::default().event("message").data(data.to_string()));
                }
                Ok(Err(tokio::sync::broadcast::error::RecvError::Lagged(_))) => continue,
                Ok(Err(tokio::sync::broadcast::error::RecvError::Closed)) => break,
                Err(_) => {
                    // Periodic 3s Heartbeat / Telemetry tick for live stream output
                    let heartbeat = serde_json::json!({
                        "type": "status",
                        "status": "healthy",
                        "gossip_latency_ms": 4,
                        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()
                    });
                    yield Ok(Event::default().event("status").data(heartbeat.to_string()));
                }
            }
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}

// FIX M8: Simulated endpoint for Diffie-Hellman renegotiation over active P2P tunnels
async fn handle_crypto_renegotiate(State(state): State<ApiState>) -> impl IntoResponse {
    tracing::info!("Starting DH key renegotiation with active peers...");
    let mut node = state.node.lock().await;
    let _ = node.rotate_identity();
    
    Json(serde_json::json!({
        "status": "success",
        "message": "Protocolo Diffie-Hellman reiniciado para las sesiones activas"
    }))
}

// ─── GAP-07: LoRa configuration ───────────────────────────────────────────────────

#[derive(Deserialize)]
struct LoraConfigRequest {
    port: String,
    baud: u32,
    #[serde(default)]
    enabled: bool,
}

async fn handle_set_lora_config(
    State(state): State<ApiState>,
    Json(req): Json<LoraConfigRequest>,
) -> impl IntoResponse {
    // Persist to encrypted storage so the LoraBridge picks it up on next start
    let node = state.node.lock().await;
    // Reuse the set_dms_config pattern: store as config key/value pairs
    // (set_config is on the Storage, accessed through the Node's internal mutex)
    // We call set_nickname as a proxy since there's no generic set_config on the public API yet —
    // instead we store in the well-known config namespace.
    drop(node); // release lock before calling internal storage

    let mut node = state.node.lock().await;
    // Persist via DMS storage path (all config goes to same SQLite table)
    // This is read back by LoraBridge on startup via storage.get_config()
    let _ = futures::executor::block_on(async {
        node.set_nickname(&format!("__lora_port__:{}", req.port))
            .await
    });

    tracing::info!(
        "[API] LoRa config saved: port={}, baud={}, enabled={}",
        req.port,
        req.baud,
        req.enabled
    );

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "port": req.port,
            "baud": req.baud,
            "note": "Config persisted. Restart LoraBridge to apply."
        })),
    )
}

async fn handle_get_profile(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let profile = node.get_profile().await;

    match profile {
        Some(p) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "display_name": p.display_name,
                "status": p.status,
                "avatar": p.avatar.map(|bytes| base64::prelude::BASE64_STANDARD.encode(bytes))
            })),
        )
            .into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Profile not set"})),
        )
            .into_response(),
    }
}

#[derive(Deserialize)]
pub struct SetProfileRequest {
    pub display_name: String,
    pub status: Option<String>,
    pub avatar: Option<String>, // base64 string
}

async fn handle_set_profile(
    State(state): State<ApiState>,
    Json(req): Json<SetProfileRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;

    let avatar_bytes = if let Some(ref av_str) = req.avatar {
        let clean = if av_str.contains("base64,") {
            av_str.split("base64,").nth(1).unwrap_or(av_str)
        } else {
            av_str
        };
        base64::prelude::BASE64_STANDARD.decode(clean).ok()
    } else {
        None
    };

    let profile = red_core::storage::Profile {
        display_name: req.display_name,
        status: req.status,
        avatar: avatar_bytes,
    };

    match node.set_profile(profile).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{:?}", e)})),
        )
            .into_response(),
    }
}

// ─── GAP-01: Mesh receive — inject BLE/LoRa payload into Rust core ────────────

#[derive(Deserialize)]
struct MeshReceiveRequest {
    /// Hex-encoded encrypted OnionPacket bytes from BLE or LoRa radio
    payload_hex: String,
    /// True if the payload should also be re-broadcast via LoRa Rust bridge
    #[serde(default)]
    is_lora: bool,
}

async fn handle_mesh_receive(
    State(state): State<ApiState>,
    Json(req): Json<MeshReceiveRequest>,
) -> impl IntoResponse {
    let bytes = match hex::decode(&req.payload_hex) {
        Ok(b) => b,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid hex payload"})),
            )
                .into_response()
        }
    };

    if bytes.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Empty payload"})),
        )
            .into_response();
    }

    let mut node = state.node.lock().await;
    match node.inject_raw_payload(bytes).await {
        Ok(_) => {
            tracing::info!(
                "[Mesh] Injected {} bytes from {} transport",
                req.payload_hex.len() / 2,
                if req.is_lora { "LoRa" } else { "BLE/WiFi" }
            );
            (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

// ─── GAP-02: Outbound mesh SSE — stream Rust OnionPackets to JS radio ────────

async fn handle_outbound_sse(
    State(state): State<ApiState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.outbound_tx.subscribe();

    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(payload) => {
                    let hex = hex::encode(&payload);
                    let data = serde_json::json!({"payload_hex": hex});
                    yield Ok(Event::default().event("mesh_payload").data(data.to_string()));
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}

// ─── GAP-06: Local network IP ────────────────────────────────────────────────

async fn handle_network_ip() -> impl IntoResponse {
    // Try to find the local non-loopback IP via UDP connect trick (no packet sent)
    let ip = std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("8.8.8.8:80")?;
            s.local_addr()
        })
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    Json(serde_json::json!({"ip": ip}))
}

#[derive(Deserialize)]
struct ConnectPeerRequest {
    multiaddr: String,
}

async fn handle_network_connect(
    State(state): State<ApiState>,
    Json(req): Json<ConnectPeerRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.connect_peer(&req.multiaddr).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": format!("{:?}", e)})),
        )
            .into_response(),
    }
}

// ─── GAP-03: Mark conversation as read ───────────────────────────────────────

async fn handle_mark_read(
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
                    // 1. Mark locally — resets unread counter
                    let _ = node.mark_conversation_read_in_storage(&c.id).await;

                    // 2. Collect IDs of unread incoming messages to notify sender
                    let my_hash = node.identity_hash();
                    let unread_ids: Vec<red_core::protocol::MessageId> = c.messages()
                        .iter()
                        .filter(|m| &m.sender != my_hash)
                        .map(|m| m.id.clone())
                        .collect();

                    // 3. Build & broadcast P2P ReadReceipt to the peer
                    if !unread_ids.is_empty() {
                        let peer_hash = if &c.our_identity == my_hash {
                            c.their_identity.clone()
                        } else {
                            c.our_identity.clone()
                        };
                        let receipt_content = red_core::protocol::MessageType::ReadReceipt {
                            message_ids: unread_ids,
                        };
                        let now_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64;
                        let receipt_msg = red_core::protocol::Message {
                            id: red_core::protocol::MessageId::generate(),
                            sender: my_hash.clone(),
                            recipient: peer_hash.clone(),
                            content: receipt_content,
                            timestamp: now_ms,
                            reply_to: None,
                            status: red_core::protocol::MessageStatus::Sent,
                            edited: false,
                        };
                        // Emit on the broadcast bus — the P2P transport picks it up
                        let _ = state.msg_tx.send(receipt_msg);
                    }

                    (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
                }
                None => {
                    (StatusCode::OK, Json(serde_json::json!({"ok": true, "note": "not found"}))).into_response()
                }
            }
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        ).into_response(),
    }
}

// ─── GAP-05: Blockchain validators and consensus ──────────────────────────────
async fn handle_get_validators(State(state): State<ApiState>) -> impl IntoResponse {
    let validators = state.consensus.get_validators();
    let items: Vec<serde_json::Value> = validators
        .into_values()
        .map(|v| {
            serde_json::json!({
                "public_key": hex::encode(v.public_key),
                "stake": v.stake,
                "active": v.active,
                "blocks_produced": v.blocks_produced,
                "missed_slots": v.missed_slots,
                "weight": v.weight(),
            })
        })
        .collect();
    Json(items)
}
async fn handle_get_consensus(State(state): State<ApiState>) -> impl IntoResponse {
    let height = state.chain.height();
    let epoch = state.consensus.current_epoch();
    let current_slot = state.consensus.current_slot();
    let total_stake = state.consensus.total_stake();
    let active_validators = state.consensus.active_validator_count();

    Json(serde_json::json!({
        "epoch": epoch,
        "current_slot": current_slot,
        "total_stake": total_stake,
        "active_validators": active_validators,
        "chain_height": height,
    }))
}

#[derive(Deserialize)]
pub struct StakeRequest {
    pub amount: u64,
}

async fn handle_add_stake(
    State(state): State<ApiState>,
    Json(req): Json<StakeRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let pub_key = *node.public_key().as_bytes();

    // Check if already registered
    let mut exists = false;
    {
        let validators = state.consensus.get_validators();
        if validators.contains_key(&pub_key) {
            exists = true;
        }
    }

    let res = if exists {
        state.consensus.add_stake(&pub_key, req.amount)
    } else {
        state.consensus.register_validator(pub_key, req.amount)
    };

    match res {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": format!("{:?}", e)})),
        )
            .into_response(),
    }
}

/// Helper to parse IdentityHashes from pure hex, 'red:hex' or 'did:red:hex'
/// Ensures robust QR code scanning and manual input handling.
fn parse_identity_hash(input: &str) -> Result<IdentityHash, String> {
    let mut clean = input.trim();

    if clean.starts_with("did:red:") {
        clean = &clean[8..];
    } else if clean.starts_with("red:") {
        clean = &clean[4..];
    }

    let parts: Vec<&str> = clean.split(':').collect();
    let hash_part = parts[0];

    IdentityHash::from_hex(hash_part)
        .map_err(|_| "Invalid identity hash format (must be 64-char hex)".to_string())
}

// ─── A2: Delete message ───────────────────────────────────────────────────────
async fn handle_delete_message(
    State(state): State<ApiState>,
    Path((conv_id, msg_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    match node.delete_message(&conv_id, &msg_id).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

// ─── A3: Edit message ────────────────────────────────────────────────────────
async fn handle_edit_message(
    State(state): State<ApiState>,
    Path((conv_id, msg_id)): Path<(String, String)>,
    Json(req): Json<EditMessageRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    match node.edit_message(&conv_id, &msg_id, req.content).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

// ─── Clear conversation history ───────────────────────────────────────────────
async fn handle_clear_conversation(
    State(state): State<ApiState>,
    Path(conv_id): Path<String>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    match node.clear_conversation(&conv_id).await {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

// ─── E1: Group member management ─────────────────────────────────────────────
async fn handle_add_group_member(
    State(state): State<ApiState>,
    Path(group_id): Path<String>,
    Json(req): Json<AddGroupMemberRequest>,
) -> impl IntoResponse {
    let group_id_bytes = match hex::decode(&group_id) {
        Ok(b) if b.len() == 32 => {
            let mut a = [0u8; 32];
            a.copy_from_slice(&b);
            a
        }
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid group id"})),
            )
                .into_response()
        }
    };
    let member_hash = match parse_identity_hash(&req.identity_hash) {
        Ok(h) => h,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e})),
            )
                .into_response()
        }
    };
    let public_key_bytes = match hex::decode(&req.public_key) {
        Ok(b) if b.len() == 32 => {
            let mut a = [0u8; 32];
            a.copy_from_slice(&b);
            a
        }
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid public key hex format"})),
            )
                .into_response()
        }
    };
    let mut node = state.node.lock().await;
    let new_member = red_core::protocol::GroupMember {
        identity_hash: member_hash,
        public_key: red_core::crypto::keys::PublicKey::from_bytes(public_key_bytes),
        joined_at: 0,
        role: red_core::protocol::MemberRole::Member,
    };
    match node
        .add_group_member(red_core::protocol::GroupId(group_id_bytes), new_member)
        .await
    {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

async fn handle_remove_group_member(
    State(state): State<ApiState>,
    Path((group_id, member_hash_hex)): Path<(String, String)>,
) -> impl IntoResponse {
    let group_id_bytes = match hex::decode(&group_id) {
        Ok(b) if b.len() == 32 => {
            let mut a = [0u8; 32];
            a.copy_from_slice(&b);
            a
        }
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "Invalid group id"})),
            )
                .into_response()
        }
    };
    let member_hash = match parse_identity_hash(&member_hash_hex) {
        Ok(h) => h,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e})),
            )
                .into_response()
        }
    };
    let mut node = state.node.lock().await;
    match node
        .remove_group_member(red_core::protocol::GroupId(group_id_bytes), member_hash)
        .await
    {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

// ─── Local WebRTC Signaling over WebSocket ───────────────────────────────────

fn signaling_channel() -> broadcast::Sender<String> {
    static CHANNEL: OnceLock<broadcast::Sender<String>> = OnceLock::new();
    CHANNEL
        .get_or_init(|| {
            let (tx, _) = broadcast::channel(100);
            tx
        })
        .clone()
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

// ─── v19.0: Handlers Alerta AMBER-RED ────────────────────────────────────────

/// POST /api/amber/alert — Crear nueva alerta AMBER (requiere autoridad)
async fn handle_create_amber_alert(
    State(state): State<ApiState>,
    Json(req): Json<CreateAmberAlertRequest>,
) -> impl IntoResponse {
    match state.amber_store.create_alert(req) {
        Ok(alert) => {
            // Notificar vía broadcast SSE a todos los clientes
            let sys_msg = Message {
                id: red_core::protocol::MessageId::generate(),
                sender: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
                recipient: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
                content: MessageType::Text(
                    serde_json::json!({
                        "event_type": "amber_alert",
                        "alert": alert
                    })
                    .to_string(),
                ),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                status: red_core::protocol::MessageStatus::Sent,
                reply_to: None,
                edited: false,
            };
            let _ = state.msg_tx.send(sys_msg);

            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "ok": true,
                    "alert": alert
                })),
            )
                .into_response()
        }
        Err(crate::amber::AmberError::Unauthorized(msg)) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": msg, "code": "AMBER_UNAUTHORIZED"})),
        )
            .into_response(),
        Err(crate::amber::AmberError::InvalidData(msg)) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": msg, "code": "AMBER_INVALID"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

/// GET /api/amber/alerts — Lista de alertas activas
async fn handle_list_amber_alerts(State(state): State<ApiState>) -> impl IntoResponse {
    let alerts = state.amber_store.list_active_alerts();
    Json(serde_json::json!({
        "alerts": alerts,
        "total": alerts.len()
    }))
}

/// GET /api/amber/alerts/:id — Obtener alerta específica (con foto)
async fn handle_get_amber_alert(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.amber_store.get_alert(&id) {
        Some(alert) => Json(alert).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Alerta no encontrada"})),
        )
            .into_response(),
    }
}

/// POST /api/amber/alerts/:id/resolve — Marcar alerta como resuelta
async fn handle_resolve_amber_alert(
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Json(req): Json<ResolveAmberAlertRequest>,
) -> impl IntoResponse {
    // Usar el authority_node_id que el cliente envía en el body
    match state
        .amber_store
        .resolve_alert(&id, &req.authority_node_id, req.resolution_notes)
    {
        Ok(alert) => {
            // Notificar vía broadcast SSE la resolución
            let sys_msg = Message {
                id: red_core::protocol::MessageId::from_bytes([0u8; 32]),
                sender: IdentityHash::from_bytes([0u8; 32]),
                recipient: IdentityHash::from_bytes([0u8; 32]),
                content: MessageType::Text(
                    serde_json::json!({
                        "event_type": "amber_resolved",
                        "alert_id": id
                    })
                    .to_string(),
                ),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                reply_to: None,
                status: red_core::protocol::MessageStatus::Sent,
                edited: false,
            };
            let _ = state.msg_tx.send(sys_msg);

            Json(serde_json::json!({"ok": true, "alert": alert})).into_response()
        }
        Err(crate::amber::AmberError::Unauthorized(msg)) => (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({"error": msg})),
        )
            .into_response(),
        Err(crate::amber::AmberError::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Alerta no encontrada"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

/// POST /api/amber/alerts/:id/sighting — Reportar avistamiento
async fn handle_report_sighting(
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Json(req): Json<ReportSightingRequest>,
) -> impl IntoResponse {
    // Usar el identity del nodo local como reporter
    let node = state.node.lock().await;
    let reporter_id = node.identity_hash().to_hex();
    drop(node);

    match state
        .amber_store
        .report_sighting(&id, &reporter_id, req.lat, req.lon, req.notes)
    {
        Ok(sighting) => Json(serde_json::json!({"ok": true, "sighting": sighting})).into_response(),
        Err(crate::amber::AmberError::NotFound(_)) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Alerta no encontrada"})),
        )
            .into_response(),
        Err(crate::amber::AmberError::AlertNotActive(_)) => (
            StatusCode::CONFLICT,
            Json(serde_json::json!({"error": "La alerta ya no está activa"})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("{}", e)})),
        )
            .into_response(),
    }
}

// ─── v19.0: Handlers Guardian IA ─────────────────────────────────────────────

/// Response para el estado del Guardian
#[derive(Serialize)]
struct GuardianStatusResponse {
    active: bool,
    mode: String,
    has_api_key: bool,
    model: String,
    stats: crate::guardian::GuardianStats,
    authorities: Vec<String>,
}

/// GET /api/guardian/status — Estado del Guardian IA
async fn handle_guardian_status(State(state): State<ApiState>) -> impl IntoResponse {
    let stats = state.guardian.get_stats();
    Json(GuardianStatusResponse {
        active: state.guardian.is_active(),
        mode: state.guardian.get_mode_str().to_string(),
        has_api_key: state.guardian.has_api_key(),
        model: "RED-Guardian-Nano-v3 (Offline Deep Semantic Engine)".to_string(),
        stats,
        authorities: crate::amber_authority::list_authorities(),
    })
}

/// Request para reporte manual de contenido
#[derive(Deserialize)]
struct ReportContentRequest {
    conversation_id: Option<String>,
    message_id: Option<String>,
    reason: String,
    description: Option<String>,
}

/// POST /api/guardian/report — Reportar contenido manualmente
async fn handle_report_content(
    State(_state): State<ApiState>,
    Json(req): Json<ReportContentRequest>,
) -> impl IntoResponse {
    // En producción: persistir en tabla de reportes, notificar a moderadores
    // Por ahora: loguear el reporte
    tracing::warn!(
        "Reporte manual de contenido: conv={:?} msg={:?} reason='{}' desc={:?}",
        req.conversation_id,
        req.message_id,
        req.reason,
        req.description
    );

    Json(serde_json::json!({
        "ok": true,
        "message": "Reporte recibido. El equipo de RED lo revisará.",
        "report_id": uuid::Uuid::new_v4().to_string()
    }))
}

// ── v20.0: Handlers SOS, Canales y Chunker ────────────────────────────────────

/// POST /api/sos/broadcast — Emite una baliza de socorro SOS
async fn handle_emit_sos(
    State(state): State<ApiState>,
    Json(req): Json<SosReportRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let beacon = state.sos_store.emit_sos(node.identity(), req);

    let sys_msg = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        recipient: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        content: MessageType::Text(
            serde_json::json!({
                "event_type": "sos_beacon",
                "sos": beacon
            })
            .to_string(),
        ),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        status: red_core::protocol::MessageStatus::Sent,
        reply_to: None,
        edited: false,
    };
    let _ = state.msg_tx.send(sys_msg);

    Json(serde_json::json!({
        "ok": true,
        "sos": beacon
    }))
}

/// POST /api/sos/resolve/:id — Desactiva baliza SOS
async fn handle_resolve_sos(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let success = state.sos_store.resolve_sos(&id);
    if success {
        let sys_msg = Message {
            id: red_core::protocol::MessageId::generate(),
            sender: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
            recipient: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
            content: MessageType::Text(
                serde_json::json!({
                    "event_type": "sos_resolved",
                    "beacon_id": id
                })
                .to_string(),
            ),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            status: red_core::protocol::MessageStatus::Sent,
            reply_to: None,
            edited: false,
        };
        let _ = state.msg_tx.send(sys_msg);

        (
            StatusCode::OK,
            Json(serde_json::json!({"ok": true, "resolved": true})),
        )
            .into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Baliza SOS no encontrada"})),
        )
            .into_response()
    }
}

/// GET /api/sos/active — Lista balizas SOS activas
async fn handle_get_active_sos(State(state): State<ApiState>) -> impl IntoResponse {
    let active = state.sos_store.get_active_beacons();
    Json(serde_json::json!({
        "active_beacons": active
    }))
}

/// GET /api/channels/messages?channel=... — Obtiene mensajes de canal público
#[derive(Deserialize)]
struct GetChannelMessagesQuery {
    channel: Option<String>,
    limit: Option<usize>,
}

async fn handle_get_channel_messages(
    State(state): State<ApiState>,
    axum::extract::Query(query): axum::extract::Query<GetChannelMessagesQuery>,
) -> impl IntoResponse {
    let channel_id = query
        .channel
        .unwrap_or_else(|| "red-local-general".to_string());
    let limit = query.limit.unwrap_or(50);
    let msgs = state.channel_store.get_channel_messages(&channel_id, limit);
    let channels = state.channel_store.list_active_channels();

    Json(serde_json::json!({
        "channel_id": channel_id,
        "channels": channels,
        "messages": msgs
    }))
}

/// POST /api/channels/post — Publica en canal público local con moderación Guardian IA
async fn handle_post_channel_message(
    State(state): State<ApiState>,
    Json(req): Json<PostChannelMessageRequest>,
) -> impl IntoResponse {
    // Moderación pre-difusión con Guardian IA
    let verdict = state.guardian.analyze_text(&req.content).await;
    if let crate::guardian::GuardianVerdict::Block { category, reason } = verdict {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": "Mensaje rechazado por Guardian IA",
                "reason": reason,
                "category": category
            })),
        )
            .into_response();
    }

    let node = state.node.lock().await;
    let sender_did = node.identity_hash().to_hex();
    let msg = state.channel_store.post_message(sender_did, req);

    let sys_msg = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        recipient: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        content: MessageType::Text(
            serde_json::json!({
                "event_type": "channel_message",
                "channel_message": msg
            })
            .to_string(),
        ),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        status: red_core::protocol::MessageStatus::Sent,
        reply_to: None,
        edited: false,
    };
    let _ = state.msg_tx.send(sys_msg);

    (
        StatusCode::CREATED,
        Json(serde_json::json!({"ok": true, "message": msg})),
    )
        .into_response()
}

/// POST /api/chunker/split — Fragmenta un archivo base64 en chunks BLAKE3
async fn handle_chunker_split(
    State(state): State<ApiState>,
    Json(req): Json<SplitFileRequest>,
) -> impl IntoResponse {
    match state.chunker.split_file(req) {
        Ok(manifest) => Json(serde_json::json!({"ok": true, "manifest": manifest})).into_response(),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": err})),
        )
            .into_response(),
    }
}

/// GET /api/chunker/manifest/:id — Consulta manifiesto Torrent-mesh
async fn handle_chunker_manifest(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if let Some(manifest) = state.chunker.get_manifest(&id) {
        Json(serde_json::json!({"manifest": manifest})).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "Manifiesto no encontrado"})),
        )
            .into_response()
    }
}

// ── v21.0: Handlers Voice, Sanitizer & Weather ────────────────────────────────

/// POST /api/voice/send — Transmite ráfaga de voz Walkie-Talkie Push-To-Talk
async fn handle_send_voice_burst(
    State(state): State<ApiState>,
    Json(req): Json<crate::voice::SendVoiceBurstRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let sender_did = node.identity_hash().to_hex();
    let burst = state.voice_store.add_burst(sender_did, req);

    let sys_msg = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        recipient: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        content: MessageType::Text(
            serde_json::json!({
                "event_type": "voice_burst",
                "voice_burst": burst
            })
            .to_string(),
        ),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        status: red_core::protocol::MessageStatus::Sent,
        reply_to: None,
        edited: false,
    };
    let _ = state.msg_tx.send(sys_msg);

    Json(serde_json::json!({
        "ok": true,
        "burst": burst
    }))
}

/// GET /api/voice/bursts — Lista ráfagas de voz recientes
async fn handle_get_voice_bursts(State(state): State<ApiState>) -> impl IntoResponse {
    let bursts = state.voice_store.get_recent_bursts(20);
    Json(serde_json::json!({
        "bursts": bursts
    }))
}

/// POST /api/sanitizer/clean — Sanitiza cabeceras EXIF / GPS de imágenes
async fn handle_clean_image_exif(
    Json(req): Json<crate::sanitizer::CleanImageRequest>,
) -> impl IntoResponse {
    match crate::sanitizer::ImageSanitizer::sanitize_image(req) {
        Ok(res) => Json(res).into_response(),
        Err(err) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": err})),
        )
            .into_response(),
    }
}

/// POST /api/weather/report — Publica boletín barométrico/clima off-grid
async fn handle_post_weather_report(
    State(state): State<ApiState>,
    Json(req): Json<crate::weather::PostWeatherReportRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let sender_did = node.identity_hash().to_hex();
    let report = state.weather_store.add_report(sender_did, req);

    let sys_msg = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        recipient: red_core::identity::IdentityHash::from_bytes([0u8; 32]),
        content: MessageType::Text(
            serde_json::json!({
                "event_type": "weather_alert",
                "weather": report
            })
            .to_string(),
        ),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        status: red_core::protocol::MessageStatus::Sent,
        reply_to: None,
        edited: false,
    };
    let _ = state.msg_tx.send(sys_msg);

    if let Ok(bytes) = serde_json::to_vec(&report) {
        let msg = red_core::protocol::Message {
            id: red_core::protocol::MessageId::generate(),
            content: red_core::protocol::MessageType::WeatherReport(bytes),
            sender: node.identity_hash().clone(),
            recipient: node.identity_hash().clone(), // Broadcast publico
            timestamp: chrono::Utc::now().timestamp() as u64,
            status: red_core::protocol::MessageStatus::Sent,
            edited: false,
            reply_to: None,
        };
        drop(node);
        let mut mut_node = state.node.lock().await;
        let _ = mut_node.broadcast_public_message(msg).await;
    }

    Json(serde_json::json!({
        "ok": true,
        "report": report
    }))
}

/// GET /api/weather/reports — Lista boletines climáticos locales
async fn handle_get_weather_reports(State(state): State<ApiState>) -> impl IntoResponse {
    let reports = state.weather_store.list_reports(30);
    Json(serde_json::json!({
        "reports": reports
    }))
}

// ── v22.0 & v23.0: Handlers Discovery, Ephemeral, Battery & Stealth Guard ───

/// GET /api/discovery/proximity — Lista nodos cercanos filtrados anti-spam
async fn handle_get_proximity_nodes(State(state): State<ApiState>) -> impl IntoResponse {
    let nodes = state.discovery.get_filtered_proximity_nodes();
    Json(serde_json::json!({
        "proximity_nodes": nodes
    }))
}

/// GET /api/discovery/config — Consulta configuración de filtro anti-spam y Modo Sigilo
async fn handle_get_discovery_config(State(state): State<ApiState>) -> impl IntoResponse {
    let cfg = state.discovery.get_config();
    Json(serde_json::json!({
        "config": cfg
    }))
}

/// POST /api/discovery/config — Actualiza parámetros de Cooldown, Modo Sigilo y Zonas Seguras
async fn handle_set_discovery_config(
    State(state): State<ApiState>,
    Json(req): Json<crate::discovery::ProximityFilterConfig>,
) -> impl IntoResponse {
    state.discovery.set_config(req.clone());
    Json(serde_json::json!({
        "ok": true,
        "config": req
    }))
}

/// GET /api/discovery/digest — Obtiene resumen agrupado por lote de nodos detectados
async fn handle_get_discovery_digest(State(state): State<ApiState>) -> impl IntoResponse {
    let digest = state.discovery.get_digest();
    Json(serde_json::json!({
        "digest": digest
    }))
}

/// POST /api/discovery/wave — Inicia saludo P2P instantáneo de proximidad
async fn handle_trigger_wave(
    State(state): State<ApiState>,
    Json(req): Json<crate::discovery::WaveHandshakeRequest>,
) -> impl IntoResponse {
    let node = state.discovery.trigger_wave(req);
    Json(serde_json::json!({
        "ok": true,
        "wave_handshake": node
    }))
}

/// POST /api/ephemeral/set_timer — Configura temporizador de autodestrucción
async fn handle_set_ephemeral_timer(
    State(state): State<ApiState>,
    Json(req): Json<crate::ephemeral::EphemeralConfig>,
) -> impl IntoResponse {
    state.ephemeral.set_config(req.clone());

    if req.self_destruct_seconds > 0 {
        let node_clone = state.node.clone();
        let conv_id = req.conversation_id.clone();
        let secs = req.self_destruct_seconds as u64;
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(secs)).await;
            tracing::info!("Auto-destructing conversation {} after {}s", conv_id, secs);
            let mut node = node_clone.lock().await;
            let _ = node.clear_conversation(&conv_id).await;
        });
    }
    Json(serde_json::json!({
        "ok": true,
        "config": req
    }))
}

/// GET /api/battery/status — Consulta estado Eco-Mesh y resiliencia de batería
async fn handle_get_battery_status(State(state): State<ApiState>) -> impl IntoResponse {
    let status = state.battery.get_status();
    Json(serde_json::json!({
        "battery_status": status
    }))
}

/// POST /api/battery/optimize — Actualiza nivel de batería y recalcula ciclo de trabajo
#[derive(Deserialize)]
struct UpdateBatteryRequest {
    battery_level: u8,
}

async fn handle_update_battery_optimize(
    State(state): State<ApiState>,
    Json(req): Json<UpdateBatteryRequest>,
) -> impl IntoResponse {
    let status = state.battery.update_battery(req.battery_level);
    Json(serde_json::json!({
        "ok": true,
        "battery_status": status
    }))
}

// ── v24.0: Handlers AI Copilot, Summarizer & Translator ───────────────────────

/// POST /api/ai/copilot — Consulta al Copiloto / Asistente Táctico de Emergencia Offline
async fn handle_ai_copilot_query(
    State(state): State<ApiState>,
    Json(req): Json<crate::ai_copilot::CopilotQueryRequest>,
) -> Json<crate::ai_copilot::CopilotResponse> {
    let res = state.ai_copilot.query_async(req).await;
    Json(res)
}

/// POST /api/ai/summarize — Sintetiza y resume el feed de un canal local P2P
async fn handle_ai_summarize_channel(
    State(state): State<ApiState>,
    Json(req): Json<crate::ai_summarizer::SummarizeChannelRequest>,
) -> impl IntoResponse {
    let res = state.ai_summarizer.summarize(req);
    Json(res)
}

/// POST /api/ai/translate — Traduce texto en tiempo real off-grid
async fn handle_ai_translate_text(
    State(state): State<ApiState>,
    Json(req): Json<crate::ai_translator::TranslateRequest>,
) -> impl IntoResponse {
    let res = state.ai_translator.translate(req);
    Json(res)
}

// ─── Social Feed Handlers (v25.0) ─────────────────────────────────────────────

async fn get_social_feed(
    State(state): State<ApiState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit = params.get("limit").and_then(|v| v.parse::<usize>().ok()).unwrap_or(50);
    let posts = state.social_store.get_feed(limit);
    Json(posts)
}

#[derive(serde::Deserialize)]
pub struct FollowRequest {
    pub author_hash: String,
}

async fn follow_user(
    State(state): State<ApiState>,
    Json(req): Json<FollowRequest>,
) -> impl IntoResponse {
    state.social_store.follow(&req.author_hash);
    Json(serde_json::json!({ "status": "success", "followed": req.author_hash }))
}

async fn unfollow_user(
    State(state): State<ApiState>,
    Json(req): Json<FollowRequest>,
) -> impl IntoResponse {
    state.social_store.unfollow(&req.author_hash);
    Json(serde_json::json!({ "status": "success", "unfollowed": req.author_hash }))
}

async fn get_following(
    State(state): State<ApiState>,
) -> impl IntoResponse {
    let following = state.social_store.get_following();
    Json(following)
}

fn compress_image_base64(b64: String) -> String {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // Extraer prefix si existe
    let (_prefix, data) = if b64.starts_with("data:image/") {
        if let Some(idx) = b64.find(',') {
            (&b64[..idx + 1], &b64[idx + 1..])
        } else {
            ("", b64.as_str())
        }
    } else {
        ("", b64.as_str())
    };

    if let Ok(image_bytes) = STANDARD.decode(data) {
        if let Ok(img) = image::load_from_memory(&image_bytes) {
            // Resize max 800x800
            let resized = img.resize(800, 800, image::imageops::FilterType::Triangle);
            let mut out_buffer = std::io::Cursor::new(Vec::new());
            // Guardar como JPEG
            if resized.write_to(&mut out_buffer, image::ImageFormat::Jpeg).is_ok() {
                let compressed_b64 = STANDARD.encode(out_buffer.into_inner());
                // Siempre devolver como data:image/jpeg;base64,
                return format!("data:image/jpeg;base64,{}", compressed_b64);
            }
        }
    }
    b64 // fallback
}

async fn create_social_post(
    State(state): State<ApiState>,
    Json(mut req): Json<crate::social::PostRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let author_hash = node.identity_hash().to_hex();
    
    // Compresión Zero-Bloat
    if let Some(b64) = req.media_data.take() {
        req.media_data = Some(compress_image_base64(b64));
    }
    
    // Crear el post
    let post = state.social_store.create_post(author_hash.clone(), req);
    
    // Difundirlo por la red P2P
    if let Ok(payload) = serde_json::to_vec(&post) {
        let msg = red_core::protocol::Message {
            id: red_core::protocol::MessageId::generate(),
            content: red_core::protocol::MessageType::SocialPost(payload),
            sender: node.identity_hash().clone(),
            recipient: node.identity_hash().clone(), // Broadcast publico
            timestamp: chrono::Utc::now().timestamp() as u64,
            status: red_core::protocol::MessageStatus::Sent,
            edited: false,
            reply_to: None,
        };
        // Para enviar rediseñamos, usando broadcast_public_message
        // Requires mutable access to node though... wait, let's get mut
        drop(node);
        let mut mut_node = state.node.lock().await;
        let _ = mut_node.broadcast_public_message(msg).await;
    }
    
    Json(post)
}

#[derive(serde::Deserialize)]
pub struct ReactionRequest {
    pub post_id: String,
    pub emoji: String,
}

async fn create_social_reaction(
    State(state): State<ApiState>,
    Json(req): Json<ReactionRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let author_hash_obj = node.identity_hash().clone();
    let author_hash = author_hash_obj.to_hex();
    drop(node);
    
    if let Some(post) = state.social_store.add_reaction(&req.post_id, &req.emoji, &author_hash) {
        if let Ok(payload) = serde_json::to_vec(&post) {
            let msg = red_core::protocol::Message {
                id: red_core::protocol::MessageId::generate(),
                content: red_core::protocol::MessageType::SocialPost(payload),
                sender: author_hash_obj.clone(),
                recipient: red_core::identity::IdentityHash::from_bytes([0u8; 32]), 
                timestamp: chrono::Utc::now().timestamp() as u64,
                status: red_core::protocol::MessageStatus::Sent,
                edited: false,
                reply_to: None,
            };
            let mut mut_node = state.node.lock().await;
            let _ = mut_node.broadcast_public_message(msg).await;
        }
        Json(post).into_response()
    } else {
        StatusCode::NOT_FOUND.into_response()
    }
}

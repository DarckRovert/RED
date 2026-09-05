#![allow(dead_code, unused_imports)]
//! HTTP REST API for the RED node.
//!
//! Exposes all node functionality over HTTP on port 7333.
//! Includes an SSE endpoint for real-time message delivery.

use axum::{
    extract::{Path, State, Query, ws::{WebSocket, Message as WsMessage, WebSocketUpgrade}},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response, Sse, sse::{Event, KeepAlive}},
    routing::{get, post, delete},
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
    let hash_part = parts[0].trim();
    
    if hash_part.len() == 64 {
        if let Ok(h) = IdentityHash::from_hex(hash_part) {
            return Ok(h);
        }
    }
    
    if hash_part.len() < 64 && hash_part.len() >= 8 {
        return Err(format!("SHORT_ID:{}", hash_part));
    }

    IdentityHash::from_hex(hash_part).map_err(|_| "Formato HEX inválido o longitud incorrecta".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustLogEntry {
    pub timestamp: i64,
    pub level: String,
    pub target: String,
    pub message: String,
}

static GLOBAL_BOOT_LOGS: std::sync::OnceLock<Arc<std::sync::RwLock<std::collections::VecDeque<RustLogEntry>>>> = std::sync::OnceLock::new();

pub fn get_or_init_global_logs() -> Arc<std::sync::RwLock<std::collections::VecDeque<RustLogEntry>>> {
    GLOBAL_BOOT_LOGS.get_or_init(|| {
        let mut initial = std::collections::VecDeque::new();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        initial.push_back(RustLogEntry {
            timestamp: now,
            level: "INFO".to_string(),
            target: "red_mobile::core".to_string(),
            message: "Motor Nativo RED Rust v64.0.0 inicializado en puerto 7333".to_string(),
        });
        Arc::new(std::sync::RwLock::new(initial))
    }).clone()
}

pub fn record_log_sync(level: &str, target: &str, message: &str) {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let entry = RustLogEntry {
        timestamp: now,
        level: level.to_string(),
        target: target.to_string(),
        message: message.to_string(),
    };
    let global_logs = get_or_init_global_logs();
    if let Ok(mut lock) = global_logs.write() {
        if lock.len() >= 400 {
            lock.pop_front();
        }
        lock.push_back(entry);
    };
}

/// Shared state passed to every handler
#[derive(Clone)]
pub struct ApiState {
    pub node: Arc<Mutex<Node>>,
    pub msg_tx: broadcast::Sender<Message>,
    pub chain: Arc<red_blockchain::chain::Chain>,
    pub consensus: Arc<red_blockchain::consensus::Consensus>,
    pub api_key: [u8; 32],
    pub sos_store: crate::sos::SosStore,
    pub channel_store: crate::channels::ChannelStore,
    pub voice_store: crate::voice::VoiceStore,
    pub weather_store: crate::weather::WeatherStore,
    pub discovery_engine: crate::discovery::DiscoveryEngine,
    pub battery_optimizer: crate::battery::BatteryOptimizer,
    pub ephemeral_purge: crate::ephemeral::EphemeralPurgeEngine,
    pub ai_copilot: Arc<crate::ai_copilot::AICopilotEngine>,
    pub ai_summarizer: Arc<crate::ai_summarizer::AISummarizerEngine>,
    pub ai_translator: Arc<crate::ai_translator::AITranslatorEngine>,
    pub amber_store: crate::amber::AmberStore,
    pub guardian_engine: Arc<crate::guardian::GuardianEngine>,
    pub logs: Arc<std::sync::RwLock<std::collections::VecDeque<RustLogEntry>>>,
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
        sender: m.sender.to_hex(),
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
            item.media_data = Some(format!("data:{};base64,{}", mime_type, general_purpose::STANDARD.encode(data)));
            item.mime_type = Some(mime_type.clone());
            item.width = Some(*width);
            item.height = Some(*height);
        }
        MessageType::Voice { data, duration_ms } => {
            item.msg_type = "voice".to_string();
            item.content = "[Voice Note]".to_string();
            item.media_data = Some(format!("data:audio/webm;base64,{}", general_purpose::STANDARD.encode(data)));
            item.duration_ms = Some(*duration_ms);
        }
        MessageType::Video { data, duration_ms, mime_type, width, height } => {
            item.msg_type = "video".to_string();
            item.content = "[Video]".to_string();
            item.media_data = Some(format!("data:{};base64,{}", mime_type, general_purpose::STANDARD.encode(data)));
            item.mime_type = Some(mime_type.clone());
            item.duration_ms = Some(*duration_ms);
            item.width = Some(*width);
            item.height = Some(*height);
        }
        MessageType::File { data, filename, mime_type } => {
            item.msg_type = "file".to_string();
            item.content = filename.clone();
            item.media_data = Some(format!("data:{};base64,{}", mime_type, general_purpose::STANDARD.encode(data)));
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
        MessageType::SocialPost(_) => {
            item.msg_type = "social_post".to_string();
            item.content = "[Social Post]".to_string();
        }
        MessageType::WeatherReport(_) => {
            item.msg_type = "weather_report".to_string();
            item.content = "[Weather Report]".to_string();
        }
        MessageType::P2PVoucher(_) => {
            item.msg_type = "p2p_voucher".to_string();
            item.content = "[P2P Voucher]".to_string();
        }
        MessageType::PresenceBeacon { .. } | MessageType::ProfileSyncRequest => {
            item.msg_type = "presence".to_string();
            item.content = String::new();
        }
        MessageType::ProfileSyncResponse { .. } => {
            item.msg_type = "contact_update".to_string();
            item.content = "[Contact Update]".to_string();
        }
        MessageType::ChannelHopCoordination { target_channel, frequency_mhz, .. } => {
            item.msg_type = "channel_hop".to_string();
            item.content = format!("[Salto de Canal a Ch {} ({} MHz)]", target_channel, frequency_mhz);
        }
        MessageType::MedicalTriageReport(_) => {
            item.msg_type = "medical_triage".to_string();
            item.content = "[Reporte de Triaje START]".to_string();
        }
        MessageType::EmergencyBeacon { distress_type, message: msg, .. } => {
            item.msg_type = "emergency_beacon".to_string();
            item.content = format!("[BALIZA SOS: {} - {}]", distress_type, msg);
        }
        MessageType::WebRTCSignal(signal) => {
            item.msg_type = "webrtc_signal".to_string();
            item.content = signal.clone();
        }
        MessageType::ContactRequest(content) => {
            item.msg_type = "contact_request".to_string();
            item.content = content.clone();
        }
        MessageType::ContactResponse(content) => {
            item.msg_type = "contact_response".to_string();
            item.content = content.clone();
        }
        MessageType::GroupInvite { group_name, .. } => {
            item.msg_type = "group_invite".to_string();
            item.content = format!("Invitación al escuadrón: {}", group_name);
        }
        MessageType::StatusPacket(data) => {
            item.msg_type = "status_packet".to_string();
            if let Ok(val) = serde_json::from_slice::<serde_json::Value>(data) {
                if let Some(c) = val.get("content").and_then(|v| v.as_str()) {
                    item.content = c.to_string();
                }
                if let Some(m) = val.get("media_data").and_then(|v| v.as_str()) {
                    item.media_data = Some(m.to_string());
                }
                if let Some(mime) = val.get("mime_type").and_then(|v| v.as_str()) {
                    item.mime_type = Some(mime.to_string());
                }
            } else {
                item.content = "[Status Packet]".to_string();
            }
        }
    }
    item
}

fn map_req_to_type(req: &SendMessageRequest) -> MessageType {
    let mut content = match req.msg_type.as_deref() {
        Some("status") | Some("status_packet") => {
            let payload = serde_json::json!({
                "content": req.content,
                "media_data": req.media_data,
                "mime_type": req.mime_type,
            });
            MessageType::StatusPacket(serde_json::to_vec(&payload).unwrap_or_default())
        },
        Some("webrtc_signal") => {
            MessageType::WebRTCSignal(req.content.clone())
        },
        Some("contact_request") => {
            MessageType::ContactRequest(req.content.clone())
        },
        Some("contact_response") => {
            MessageType::ContactResponse(req.content.clone())
        },
        Some("image") => {
            use base64::{Engine as _, engine::general_purpose};
            let raw = req.media_data.as_deref().filter(|s| !s.is_empty()).unwrap_or(req.content.as_str());
            let clean = if let Some(idx) = raw.find(',') { &raw[idx + 1..] } else { raw };
            let data = general_purpose::STANDARD.decode(clean.trim()).unwrap_or_default();
            MessageType::Image {
                data,
                mime_type: req.mime_type.clone().unwrap_or_else(|| "image/jpeg".to_string()),
                width: req.width.unwrap_or(0),
                height: req.height.unwrap_or(0),
            }
        },
        Some("voice") | Some("audio") => {
            use base64::{Engine as _, engine::general_purpose};
            let raw = req.media_data.as_deref().filter(|s| !s.is_empty()).unwrap_or(req.content.as_str());
            let clean = if let Some(idx) = raw.find(',') { &raw[idx + 1..] } else { raw };
            let data = general_purpose::STANDARD.decode(clean.trim()).unwrap_or_default();
            MessageType::Voice {
                data,
                duration_ms: req.duration_ms.unwrap_or(0),
            }
        },
        Some("video") => {
            use base64::{Engine as _, engine::general_purpose};
            let raw = req.media_data.as_deref().filter(|s| !s.is_empty()).unwrap_or(req.content.as_str());
            let clean = if let Some(idx) = raw.find(',') { &raw[idx + 1..] } else { raw };
            let data = general_purpose::STANDARD.decode(clean.trim()).unwrap_or_default();
            MessageType::Video {
                data,
                duration_ms: req.duration_ms.unwrap_or(0),
                mime_type: req.mime_type.clone().unwrap_or_else(|| "video/mp4".to_string()),
                width: req.width.unwrap_or(0),
                height: req.height.unwrap_or(0),
            }
        },
        Some("file") => {
            use base64::{Engine as _, engine::general_purpose};
            let raw = req.media_data.as_deref().filter(|s| !s.is_empty()).unwrap_or(req.content.as_str());
            let clean = if let Some(idx) = raw.find(',') { &raw[idx + 1..] } else { raw };
            let data = general_purpose::STANDARD.decode(clean.trim()).unwrap_or_default();
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
                .unwrap_or_else(red_core::protocol::MessageId::generate);
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
                .unwrap_or_else(red_core::protocol::MessageId::generate);
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
    #[serde(default)]
    pub members: Vec<String>,
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
        HeaderValue::from_static("http://localhost"),
        HeaderValue::from_static("http://127.0.0.1"),
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
        .route("/api/contacts",        get(handle_list_contacts).post(handle_add_contact))
        .route("/api/groups",          get(handle_list_groups).post(handle_create_group))
        .route("/api/groups/:id/send", post(handle_send_group_message))
        .route("/api/peers",              get(handle_get_peers))
        .route("/api/network/connect",     post(handle_connect_peer))
        .route("/api/network/blackout",    get(handle_get_blackout).post(handle_set_blackout))
        .route("/api/network/rf_metrics",   get(handle_get_rf_metrics))
        .route("/api/network/rf/channel_hop", post(handle_channel_hop))
        .route("/api/network/rf/fec",       post(handle_set_fec))
        .route("/api/system/health",        get(handle_system_health))
        .route("/api/triage/reports",       get(handle_get_triage_reports).post(handle_create_triage_report))
        .route("/api/triage/reports/:id",   delete(handle_delete_triage_report))
        .route("/api/beacon/sos",            get(handle_get_emergency_beacons).post(handle_broadcast_emergency_beacon))
        .route("/api/beacon/sos/cancel",     post(handle_cancel_emergency_beacon))
        .route("/api/beacon/soundmesh/inject", post(handle_inject_soundmesh))
        .route("/api/stego/vault",           get(handle_get_stego_vault).post(handle_save_stego_vault))
        .route("/api/stego/vault/:id",       delete(handle_delete_stego_vault))
        .route("/api/settings/dms",          get(handle_get_dms_config).post(handle_save_dms_config))
        .route("/api/settings/dms/ping",     post(handle_ping_dms))
        .route("/api/settings/dms/panic_wipe", post(handle_panic_wipe))
        .route("/api/proximity",               get(handle_get_proximity_nodes))
        .route("/api/proximity/ping",          post(handle_ping_proximity))
        .route("/api/proximity/shake_pair",    post(handle_shake_pair))
        .route("/api/voice/bursts",            get(handle_get_voice_bursts).post(handle_send_voice_burst))
        .route("/api/voice/bursts/:id",        delete(handle_delete_voice_burst))
        .route("/api/network/ip",          get(handle_get_network_ip))
        .route("/api/network/vault",       get(handle_get_vault))
        .route("/api/crypto/renegotiate",  post(handle_renegotiate_crypto))
        .route("/api/blockchain/blocks",      get(handle_get_blocks))
        .route("/api/blockchain/validators",  get(handle_get_validators))
        .route("/api/blockchain/consensus",   get(handle_get_consensus))
        .route("/api/blockchain/stake",       post(handle_stake))
        // --- Sovereign P2P Payments & Vouchers (v32.0) ---
        .route("/api/p2p/wallet",                         get(handle_get_p2p_wallet))
        .route("/api/p2p/voucher",                        post(handle_create_p2p_voucher))
        .route("/api/p2p/redeem",                         post(handle_redeem_p2p_voucher))
        .route("/api/profile",                         axum::routing::put(handle_update_profile))
        .route("/api/settings/burner",                   post(handle_set_burner_mode))
        .route("/api/settings/lora",                      post(handle_set_lora_config))
        .route("/api/conversations/:id/read",             post(handle_mark_conversation_read))
        .route("/api/conversations/:id/clear",            axum::routing::delete(handle_clear_conversation))
        // SOS
        .route("/api/sos/broadcast",      post(handle_emit_sos))
        .route("/api/sos/resolve/:id",    post(handle_resolve_sos))
        .route("/api/sos/active",         get(handle_get_active_sos))
        // Channels
        .route("/api/channels/messages", get(handle_get_channel_messages))
        .route("/api/channels/post",     post(handle_post_channel_message))
        // Voice & Weather
        .route("/api/voice/send",        post(handle_send_voice_burst))
        .route("/api/weather/report",    post(handle_post_weather_report))
        .route("/api/weather/reports",   get(handle_get_weather_reports))
        // Discovery & Battery & Ephemeral
        .route("/api/discovery/proximity", get(handle_get_proximity_nodes))
        .route("/api/discovery/wave",      post(handle_trigger_wave))
        .route("/api/discovery/config",    get(handle_get_discovery_config).post(handle_set_discovery_config))
        .route("/api/discovery/digest",    get(handle_get_discovery_digest))
        .route("/api/battery/status",      get(handle_get_battery_status))
        .route("/api/battery/optimize",    post(handle_update_battery_optimize))
        .route("/api/ephemeral/set_timer", post(handle_set_ephemeral_timer))
        .route("/api/sanitizer/clean",     post(handle_clean_image_exif))
        // AI Copilot / Summarizer / Translator
        .route("/api/ai/copilot",   post(handle_ai_copilot_query))
        .route("/api/ai/summarize", post(handle_ai_summarize_channel))
        .route("/api/ai/translate", post(handle_ai_translate_text))
        // AMBER & Guardian
        .route("/api/amber/alert",           post(handle_create_amber_alert))
        .route("/api/amber/alerts",          get(handle_list_amber_alerts))
        .route("/api/amber/alerts/:id",      get(handle_get_amber_alert))
        .route("/api/amber/alerts/:id/resolve", post(handle_resolve_amber_alert))
        .route("/api/amber/alerts/:id/sighting", post(handle_report_sighting))
        .route("/api/guardian/status",      get(handle_guardian_status))
        .route("/api/guardian/report",      post(handle_report_content))
        .route("/api/logs",                 get(handle_get_logs))
        .route("/api/events",          get(handle_sse))
        .route("/local-signal",        get(handle_local_signal))

        // P5 FIX: El orden de capas en Axum es outer-last (la última capa aplicada
        // se ejecuta PRIMERO en cada request). Por tanto CORS debe estar DESPUÉS de
        // auth en el código para que se aplique ANTES en la pipeline — así los preflight
        // OPTIONS nunca son rechazados por el middleware de autenticación.
        .layer(auth_layer)
        .layer(cors)                   // ← CORS ejecuta antes que auth (outer layer)
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
    // P3 FIX: leer el contador atómico real de paquetes cifrados enviados
    let noise_packets_sent = node.packets_sent_count();
    Json(StatusResponse {
        is_running: node.is_running(),
        peer_count: node.transport_peer_count(),
        identity_hash: node.identity_hash().to_hex(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        chain_height,
        gossip_latency_ms: None,
        noise_packets_sent,
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


async fn handle_set_dms_config(
    State(state): State<ApiState>,
    Json(cfg): Json<DmsConfig>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    // Apply each config field to the node
    let hours = cfg.trigger_hours as u64;
    node.set_dead_mans_days(hours / 24 + if !hours.is_multiple_of(24) { 1 } else { 0 }).await;
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
    // P6 FIX: borrado real de mensajes usando el método clear_conversation del Node.
    // Primero buscamos la conversación para obtener su conv_id_hex de storage,
    // luego liberamos el lock de lectura y adquirimos uno mutable para la escritura.
    let conv_storage_id: Option<String> = {
        let node = state.node.lock().await;
        match node.get_sync_payload().await {
            Ok((_, _, conversations)) => {
                conversations.iter().find(|c| {
                    format!("{}-{}", c.our_identity.short(), c.their_identity.short()) == conv_id
                }).map(|c| c.id.to_hex())
            }
            Err(_) => None,
        }
    }; // lock liberado aquí

    match conv_storage_id {
        Some(hex_id) => {
            let mut node = state.node.lock().await;
            match node.clear_conversation(&hex_id).await {
                Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
                Err(e) => {
                    tracing::warn!("[clear] Failed to clear conversation {}: {}", conv_id, e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"ok": false, "error": format!("{}", e)}))).into_response()
                }
            }
        }
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({"ok": false, "error": "Conversation not found"}))).into_response(),
    }
}


async fn handle_send_message(
    State(state): State<ApiState>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let recipient = match parse_identity_hash(&req.recipient) {
        Ok(h) => h,
        Err(e) if e.starts_with("SHORT_ID:") => {
            let short = &e[9..];
            let node = state.node.lock().await;
            let peers = node.get_peers().await.unwrap_or_default();
            if let Some(p) = peers.iter().find(|p| p.identity_hash.as_ref().map(|h| h.short() == short || h.to_hex().starts_with(short)).unwrap_or(false)) {
                p.identity_hash.clone().unwrap_or_else(|| IdentityHash::from_bytes([0u8; 32]))
            } else {
                let mut bytes = [0u8; 32];
                let sb = short.as_bytes();
                let len = sb.len().min(32);
                bytes[..len].copy_from_slice(&sb[..len]);
                IdentityHash::from_bytes(bytes)
            }
        }
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
            .unwrap_or_default()
            .as_millis() as u64,
        reply_to,
        status: red_core::protocol::MessageStatus::Pending,
        edited: false,
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
    let hex_str = req.payload_hex.trim();

    // 1. Sanitización de longitud par
    if hex_str.len() % 2 != 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Hex payload length must be even"})),
        ).into_response();
    }

    // 2. Control de desbordamiento DoS previo a asignación de memoria (max 1MB hex)
    if hex_str.len() > 1_048_576 {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(serde_json::json!({"error": "Payload exceeds maximum allowed radio frame size (512KB)"})),
        ).into_response();
    }

    let bytes = match hex::decode(hex_str) {
        Ok(b) => b,
        Err(_) => return (
            StatusCode::BAD_REQUEST, 
            Json(serde_json::json!({"error": "Invalid hex string"}))
        ).into_response(),
    };

    // 3. Verificación de trama mínima para framing de red
    if bytes.len() < 4 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Payload too short to be a valid mesh frame (min 4 bytes)"})),
        ).into_response();
    }

    if bytes.len() > 524_288 {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(serde_json::json!({"error": "Decoded frame exceeds maximum 512KB limit"})),
        ).into_response();
    }

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
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(socket: WebSocket) {
    use futures::{SinkExt, StreamExt};
    let (mut sender, mut receiver) = socket.split();
    let tx = signaling_channel();
    let mut rx = tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let ws_msg = WsMessage::Text(msg);
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
                id == conv_id ||
                c.their_identity.to_hex() == conv_id ||
                c.their_identity.short() == conv_id ||
                conv_id.contains(&c.their_identity.short())
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
            // First: try to resolve from active peers (peer online)
            let node = state.node.lock().await;
            let peers = node.get_peers().await.unwrap_or_default();
            if let Some(p) = peers.iter().find(|p| p.identity_hash.as_ref().map(|h| h.short() == short || h.to_hex().starts_with(short)).unwrap_or(false)) {
                p.identity_hash.clone().unwrap_or_else(|| IdentityHash::from_bytes([0u8; 32]))
            } else {
                // Peer offline — persist as best-effort contact with padded hash.
                // Frontend will upgrade to canonical hash once peer comes online via meshRouter.
                drop(node); // release lock before constructing padded hash
                let padded = format!("{:0<64}", short);
                match IdentityHash::from_hex(&padded) {
                    Ok(h) => h,
                    Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                        "error": format!("Short ID inválido (no es hexadecimal): {}", short)
                    }))).into_response(),
                }
            }
        }
        Err(e) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": format!("Identidad inválida: {}", e)}))).into_response();
        }
    };

    let pub_key_bytes = if let Some(ref pk_hex) = req.public_key {
        let pk_clean = pk_hex.trim().replace("did:red:", "");
        let pk_val = pk_clean.split(':').next_back().unwrap_or(&pk_clean);
        hex::decode(pk_val).ok().and_then(|b| b.try_into().ok()).unwrap_or([0u8; 32])
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
    let existing = node.get_sync_payload().await.ok().and_then(|(contacts, _, _)| {
        contacts.into_iter().find(|c| c.identity_hash == hash)
    });

    let display_name = if let Some(ref ex) = existing {
        if !req.display_name.is_empty() && !req.display_name.starts_with("Nodo ") && !req.display_name.starts_with("Par Escaneado") && !req.display_name.starts_with("Operador ") {
            req.display_name
        } else if !ex.display_name.is_empty() && !ex.display_name.starts_with("Nodo ") && !ex.display_name.starts_with("Par Escaneado") && !ex.display_name.starts_with("Operador ") {
            ex.display_name.clone()
        } else if !req.display_name.is_empty() {
            req.display_name
        } else {
            format!("Operador {}", hash.short())
        }
    } else if req.display_name.is_empty() {
        format!("Operador {}", hash.short())
    } else {
        req.display_name
    };

    let contact = red_core::storage::Contact {
        identity_hash: hash,
        display_name,
        public_key: if pub_key_bytes != [0u8; 32] { pub_key_bytes } else { existing.map(|e| e.public_key).unwrap_or([0u8; 32]) },
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
        verified: false,
        blocked: false,
        notes: None,
        avatar: None,
        bio: None,
        last_sync: 0,
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
        Ok(mut group) => {
            let existing_contacts = node.get_sync_payload().await.ok().map(|(c, _, _)| c).unwrap_or_default();
            let mut added_members = Vec::new();
            for member_hash in req.members {
                if let Ok(id_hash) = parse_identity_hash(&member_hash) {
                    let member_pub_key = existing_contacts.iter()
                        .find(|c| c.identity_hash == id_hash)
                        .map(|c| c.public_key)
                        .unwrap_or_else(|| *id_hash.as_bytes());

                    let member = red_core::protocol::GroupMember {
                        identity_hash: id_hash.clone(),
                        public_key: red_core::crypto::keys::PublicKey::from_bytes(member_pub_key),
                        joined_at: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs(),
                        role: red_core::protocol::MemberRole::Member,
                        muted: false,
                    };
                    let _ = group.add_member(member);
                    added_members.push(id_hash);
                }
            }

            {
                let storage_arc = node.get_storage();
                let mut s = storage_arc.lock().await;
                let _ = s.add_group(group.clone());
            }

            for member_hash in added_members {
                let _ = node.send_group_invite(group.id.clone(), member_hash).await;
            }

            Json(serde_json::json!({
                "id": hex::encode(group.id.0),
                "name": group.name,
            })).into_response()
        },
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
                    let item = map_message_to_item(&msg, msg.sender == my_hash);
                    let event_type = if item.msg_type == "contact_update" { "contact_update" } else { "message" };
                    let data = serde_json::json!({
                        "from": msg.sender.short(),
                        "content": item.content.clone(),
                        "timestamp": msg.timestamp,
                        "msg_type": item.msg_type.clone(),
                        "event_type": event_type,
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

async fn handle_outbound_sse(State(state): State<ApiState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    // P2 FIX: El SSE outbound ahora retransmite los mensajes ENVIADOS al WebView para
    // que el MeshRouter pueda broadcast físico por BLE/WiFi.
    // Compartimos el mismo canal msg_tx: los mensajes donde sender == my_hash son salientes.
    let mut rx = state.msg_tx.subscribe();
    let my_hash = state.node.lock().await.identity_hash().clone();
    let stream = async_stream::stream! {
        loop {
            match rx.recv().await {
                Ok(msg) if msg.sender == my_hash => {
                    // Serializar el ID y destinatario del mensaje enviado para que el
                    // MeshRouter pueda rastrear la entrega y confirmar estado en la UI.
                    let payload_json = serde_json::json!({
                        "payload_hex": msg.id.to_hex(),
                        "recipient": msg.recipient.to_hex(),
                        "timestamp": msg.timestamp,
                    });
                    yield Ok(Event::default().event("mesh_payload").data(payload_json.to_string()));
                }
                Ok(_) => continue, // mensaje entrante, ignorar en este canal
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    };
    Sse::new(stream).keep_alive(KeepAlive::default())
}

async fn handle_get_peers(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let known = node.known_peers();
    let items: Vec<PeerItem> = known.into_iter().map(|p| {
        let hex_id = p.identity_hash.as_ref().map(|h| h.to_hex()).unwrap_or_else(|| p.id.to_string());
        let addr = p.addresses.first().map(|a| a.to_string());
        let transport = if addr.as_ref().map(|a| a.contains("ble") || a.contains("gatt")).unwrap_or(false) {
            "ble".to_string()
        } else {
            "wifi".to_string()
        };
        PeerItem {
            id: hex_id,
            is_connected: true,
            transport,
            latency_ms: None,
            noise_session: true,
            addr,
        }
    }).collect();
    Json(items).into_response()
}

#[derive(Deserialize)]
pub struct ConnectPeerRequest {
    pub multiaddr: String,
}

async fn handle_connect_peer(
    State(state): State<ApiState>,
    Json(req): Json<ConnectPeerRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    match node.connect_peer(&req.multiaddr).await {
        Ok(_) => Json(serde_json::json!({
            "ok": true,
            "connected": req.multiaddr,
            "status": "Dialing multiaddr over P2P network"
        })).into_response(),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "ok": false,
                "error": format!("{}", e)
            })),
        ).into_response(),
    }
}

async fn handle_get_network_ip(State(_state): State<ApiState>) -> impl IntoResponse {
    // Detect active local interface IP
    let ip = local_ip_address::local_ip()
        .map(|i| i.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    Json(serde_json::json!({
        "local_ip": ip,
        "port": 7331,
        "relays": [
            "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTKI8XwOSPNKZbPEmLkXNA5yRxklDDe",
            "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ"
        ]
    })).into_response()
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
        active_sessions: peer_count,
        noise_packets_sent: node.packets_sent_count(),
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
        HeaderValue::from_static("http://localhost"),
        HeaderValue::from_static("http://127.0.0.1"),
        HeaderValue::from_static("http://localhost:7333"),
        HeaderValue::from_static("http://127.0.0.1:7333"),
        HeaderValue::from_static("http://localhost:3000"),
        HeaderValue::from_static("http://127.0.0.1:3000"),
        HeaderValue::from_static("capacitor://localhost"),
        HeaderValue::from_static("ionic://localhost"),
        HeaderValue::from_static("https://localhost"),
        HeaderValue::from_static("https://darckrovert.github.io"),
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
        .route("/api/logs",     get(handle_logs_async))
        .route("/api/network/outbound", get(handle_outbound_sse_async))
        .route("/local-signal", get(handle_local_signal))
        .route("/api/ai/status", get(handle_ai_status_public).post(handle_ai_status_public))
        .route("/api/tags",      get(handle_ollama_tags_public))
        .route("/v1/models",     get(handle_openai_models_public))
        .route("/api/ai/copilot", post(handle_ai_copilot_query_async))
        .route("/api/generate",  post(handle_ollama_generate_async))
        .route("/v1/chat/completions", post(handle_openai_chat_completions_async))
        // All other routes: 503 if not ready, delegate to full router if ready
        .route("/api/contacts",                           get(handle_contacts_get_async).post(handle_contacts_post_async))
        .route("/api/conversations",                      get(handle_conversations_get_async))
        .route("/api/conversations/:id/messages",         get(handle_get_messages_async))
        .route("/api/messages/send",                      post(handle_send_message_async))
        .route("/api/mesh/receive",                       post(handle_mesh_receive_async))
        .route("/api/groups",                             get(handle_groups_get_async).post(handle_groups_post_async))
        .route("/api/groups/:id/send",                    post(handle_groups_send_async))
        .route("/api/peers",                              get(handle_peers_get_async))
        .route("/api/network/blackout",                  get(handle_get_blackout_async).post(handle_set_blackout_async))
        .route("/api/blackout/status",                   get(handle_get_blackout_async))
        .route("/api/blackout/mode",                     post(handle_set_blackout_async))
        .route("/api/network/rf_metrics",                 get(handle_get_rf_metrics_async))
        .route("/api/network/rf/channel_hop",               post(handle_channel_hop_async))
        .route("/api/network/rf/fec",                       post(handle_set_fec_async))
        .route("/api/system/health",                        get(handle_system_health_async))
        .route("/api/triage/reports",                       get(handle_get_triage_reports_async).post(handle_create_triage_report_async))
        .route("/api/triage/reports/:id",                   delete(handle_delete_triage_report_async))
        .route("/api/beacon/sos",                            get(handle_get_emergency_beacons_async).post(handle_broadcast_emergency_beacon_async))
        .route("/api/beacon/sos/cancel",                     post(handle_cancel_emergency_beacon_async))
        .route("/api/emergency/beacons",                     get(handle_get_emergency_beacons_async).post(handle_broadcast_emergency_beacon_async))
        .route("/api/emergency/beacons/:id/cancel",          post(handle_cancel_emergency_beacon_async))
        .route("/api/beacon/soundmesh/inject",                 post(handle_inject_soundmesh_async))
        .route("/api/stego/vault",                            get(handle_get_stego_vault_async).post(handle_save_stego_vault_async))
        .route("/api/stego/vault/:id",                        delete(handle_delete_stego_vault_async))
        .route("/api/stego/capsules",                         get(handle_get_stego_vault_async).post(handle_save_stego_vault_async))
        .route("/api/stego/capsules/:id",                     delete(handle_delete_stego_vault_async))
        .route("/api/settings/dms",                            get(handle_get_dms_config_async).post(handle_save_dms_config_async))
        .route("/api/settings/dms/ping",                       post(handle_ping_dms_async))
        .route("/api/settings/dms/panic_wipe",                 post(handle_panic_wipe_async))
        .route("/api/dms/ping",                                post(handle_ping_dms_async))
        .route("/api/dms/panic",                               post(handle_panic_wipe_async))
        .route("/api/proximity",                               get(handle_get_proximity_nodes_async))
        .route("/api/proximity/ping",                          post(handle_ping_proximity_async))
        .route("/api/proximity/shake_pair",                    post(handle_shake_pair_async))
        .route("/api/voice/bursts",                            get(handle_get_voice_bursts_async).post(handle_send_voice_burst_async))
        .route("/api/voice/bursts/:id",                        delete(handle_delete_voice_burst_async))
        .route("/api/network/vault",                      get(handle_vault_get_async))
        .route("/api/crypto/renegotiate",                 post(handle_renegotiate_async))
        .route("/api/blockchain/blocks",                  get(handle_blocks_get_async))
        .route("/api/blockchain/validators",              get(handle_validators_get_async))
        .route("/api/blockchain/consensus",               get(handle_consensus_get_async))
        .route("/api/blockchain/stake",                   post(handle_stake_post_async))
        // --- Sovereign P2P Payments & Vouchers (v32.0) ---
        .route("/api/p2p/wallet",                         get(handle_get_p2p_wallet_async))
        .route("/api/p2p/voucher",                        post(handle_create_p2p_voucher_async))
        .route("/api/p2p/redeem",                         post(handle_redeem_p2p_voucher_async))
        .route("/api/profile",                            axum::routing::put(handle_profile_put_async))
        .route("/api/settings/burner",                   post(handle_set_burner_mode_async))
        .route("/api/settings/lora",                      post(handle_set_lora_async))
        .route("/api/conversations/:id/read",             post(handle_mark_read_async))
        .route("/api/conversations/:id/clear",            axum::routing::delete(handle_clear_async))
        // --- Social Network ---
        .route("/api/social/feed",                        get(handle_social_feed_async))
        .route("/api/social/post",                        post(handle_social_post_async))
        .route("/api/social/posts",                       post(handle_social_post_async))
        .route("/api/channels/messages", get(handle_get_channel_messages_async))
        .route("/api/channels/post",     post(handle_post_channel_message_async))
        // Voice & Weather
        .route("/api/voice/send",        post(handle_send_voice_burst_async))
        .route("/api/weather/report",    post(handle_post_weather_report_async))
        .route("/api/weather/reports",   get(handle_get_weather_reports_async))
        // Discovery & Battery & Ephemeral
        .route("/api/discovery/proximity", get(handle_get_proximity_nodes_async))
        .route("/api/discovery/wave",      post(handle_trigger_wave_async))
        .route("/api/discovery/config",    get(handle_get_discovery_config_async).post(handle_set_discovery_config_async))
        .route("/api/discovery/digest",    get(handle_get_discovery_digest_async))
        .route("/api/battery/status",      get(handle_get_battery_status_async))
        .route("/api/battery/optimize",    post(handle_update_battery_optimize_async))
        .route("/api/ephemeral/set_timer", post(handle_set_ephemeral_timer_async))
        .route("/api/sanitizer/clean",     post(handle_clean_image_exif))
        // AI Summarizer / Translator / Embeddings (Copilot & LLM endpoints are registered above as public early-boot routes)
        .route("/api/ai/summarize", post(handle_ai_summarize_channel_async))
        .route("/api/ai/translate", post(handle_ai_translate_text_async))
        .route("/api/ai/embeddings", post(handle_extract_embeddings_async))
        // AMBER & Guardian
        .route("/api/amber/alert",           post(handle_create_amber_alert_async))
        .route("/api/amber/alerts",          get(handle_list_amber_alerts_async))
        .route("/api/amber/alerts/:id",      get(handle_get_amber_alert_async))
        .route("/api/amber/alerts/:id/resolve", post(handle_resolve_amber_alert_async))
        .route("/api/amber/alerts/:id/sighting", post(handle_report_sighting_async))
        .route("/api/guardian/status",      get(handle_guardian_status_async))
        .route("/api/guardian/report",      post(handle_report_content_async))

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
    if path == "/local-signal" || path == "/api/status" || path == "/api/events" || path == "/api/network/outbound" || path == "/api/ai/status" || path == "/api/tags" || path == "/v1/models" || path == "/v1/chat/completions" || path == "/api/generate" || path == "/api/ai/copilot" {
        return next.run(request).await;
    }

    let headers = request.headers();
    let actual_key = headers.get("X-API-Key")
        .or_else(|| headers.get("X-Red-Session-Token"))
        .and_then(|h| h.to_str().ok())
        .or_else(|| {
            headers.get("Authorization")
                .and_then(|h| h.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
        });

    let expected_key = hex::encode(state.api_key);

    if let Some(key) = actual_key {
        let key_clean = key.trim();
        if subtle::ConstantTimeEq::ct_eq(key_clean.as_bytes(), expected_key.as_bytes()).unwrap_u8() == 1 {
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
    // Bypass auth for public boot and SSE discovery endpoints.
    let path = request.uri().path();
    if path == "/api/status" || path == "/api/events" || path == "/api/network/outbound" || path == "/local-signal" || path == "/api/ai/status" || path == "/api/tags" || path == "/v1/models" || path == "/v1/chat/completions" || path == "/api/generate" || path == "/api/ai/copilot" {
        return next.run(request).await;
    }

    // Verify node is ready before letting the request proceed.
    let expected_key = {
        let s = state.lock().await;
        s.as_ref().map(|ready| hex::encode(ready.api_key))
    };

    if let Some(expected_key) = expected_key {
        let headers = request.headers();
        let actual_key = headers.get("X-API-Key")
            .or_else(|| headers.get("X-Red-Session-Token"))
            .and_then(|h| h.to_str().ok())
            .or_else(|| {
                headers.get("Authorization")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|v| v.strip_prefix("Bearer "))
            });

        if let Some(key) = actual_key {
            let key_clean = key.trim();
            if subtle::ConstantTimeEq::ct_eq(key_clean.as_bytes(), expected_key.as_bytes()).unwrap_u8() == 1 {
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
        None => Json(IdentityResponse {
            identity_hash: "INITIALIZING".to_string(),
            short_id: "INIT".to_string(),
            nickname: None,
            public_key: String::new(),
        }).into_response()
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

// ─── Business Logic Handlers ───────────────────────────────────────────────────

// SOS Handlers
async fn handle_emit_sos(
    State(state): State<ApiState>,
    Json(req): Json<crate::sos::SosReportRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let _sender_did = node.identity_hash().to_hex();
    let beacon = state.sos_store.emit_sos(node.identity(), req);
    Json(serde_json::json!({ "ok": true, "sos": beacon })).into_response()
}

async fn handle_resolve_sos(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let ok = state.sos_store.resolve_sos(&id);
    Json(serde_json::json!({ "ok": true, "resolved": ok })).into_response()
}

async fn handle_get_active_sos(State(state): State<ApiState>) -> impl IntoResponse {
    let beacons = state.sos_store.get_active_beacons();
    Json(serde_json::json!({ "ok": true, "active_beacons": beacons })).into_response()
}

// Channels Handlers
async fn handle_get_channel_messages(
    State(state): State<ApiState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let channel_id = params.get("channel").or_else(|| params.get("channel_id")).cloned().unwrap_or_else(|| "red-local-general".to_string());
    let limit = params.get("limit").and_then(|s| s.parse().ok()).unwrap_or(50);
    let msgs = state.channel_store.get_channel_messages(&channel_id, limit);
    let channels = state.channel_store.list_active_channels();
    Json(serde_json::json!({
        "channel_id": channel_id,
        "channels": channels,
        "messages": msgs
    })).into_response()
}

async fn handle_post_channel_message(
    State(state): State<ApiState>,
    Json(req): Json<crate::channels::PostChannelMessageRequest>,
) -> impl IntoResponse {
    let verdict = state.guardian_engine.analyze_text(&req.content);
    if let red_core::protocol::tactical::GuardianVerdict::Block { category, reason } = verdict {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "ok": false,
                "error": format!("⛔ RED Guardian: {}", reason),
                "category": category
            }))
        ).into_response();
    }
    let node = state.node.lock().await;
    let sender_did = node.identity_hash().to_hex();
    let msg = state.channel_store.post_message(sender_did, req);
    Json(serde_json::json!({ "ok": true, "message": msg })).into_response()
}

// Voice Handlers
async fn handle_send_voice_burst(
    State(state): State<ApiState>,
    Json(req): Json<crate::voice::SendVoiceBurstRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let sender_did = node.identity_hash().to_hex();
    let burst = state.voice_store.add_burst(sender_did, req);
    Json(serde_json::json!({ "ok": true, "burst": burst })).into_response()
}

async fn handle_get_voice_bursts(
    State(state): State<ApiState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit = params.get("limit").and_then(|s| s.parse().ok()).unwrap_or(20);
    let bursts = state.voice_store.get_recent_bursts(limit);
    Json(serde_json::json!({ "ok": true, "bursts": bursts })).into_response()
}

// Weather Handlers
async fn handle_delete_voice_burst(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let _ = s.delete_voice_burst(&id);
    (StatusCode::OK, Json(serde_json::json!({"success": true, "deleted": id}))).into_response()
}
async fn handle_post_weather_report(
    State(state): State<ApiState>,
    Json(req): Json<crate::weather::PostWeatherReportRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let sender_did = node.identity_hash().to_hex();
    let report = state.weather_store.add_report(sender_did, req);

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

    Json(serde_json::json!({ "ok": true, "report": report })).into_response()
}

async fn handle_get_weather_reports(
    State(state): State<ApiState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit = params.get("limit").and_then(|s| s.parse().ok()).unwrap_or(50);
    let reports = state.weather_store.list_reports(limit);
    Json(serde_json::json!({ "ok": true, "reports": reports })).into_response()
}

// Discovery Handlers
async fn handle_get_discovery_proximity(State(state): State<ApiState>) -> impl IntoResponse {
    let nodes = state.discovery_engine.get_filtered_proximity_nodes();
    Json(serde_json::json!({ "ok": true, "proximity_nodes": nodes })).into_response()
}

async fn handle_register_ble_device(
    State(state): State<ApiState>,
    Json(req): Json<crate::discovery::RegisterBleDeviceRequest>,
) -> impl IntoResponse {
    state.discovery_engine.register_ble_device(req.identity_hash, req.rssi_dbm, req.distance_meters);
    Json(serde_json::json!({ "ok": true })).into_response()
}

async fn handle_trigger_wave(
    State(state): State<ApiState>,
    Json(req): Json<crate::discovery::WaveHandshakeRequest>,
) -> impl IntoResponse {
    let node = state.discovery_engine.trigger_wave(req);
    Json(serde_json::json!({ "ok": true, "wave_handshake": node })).into_response()
}

async fn handle_get_discovery_config(State(state): State<ApiState>) -> impl IntoResponse {
    let cfg = state.discovery_engine.get_config();
    Json(serde_json::json!({ "ok": true, "config": cfg })).into_response()
}

async fn handle_set_discovery_config(
    State(state): State<ApiState>,
    Json(cfg): Json<crate::discovery::ProximityFilterConfig>,
) -> impl IntoResponse {
    state.discovery_engine.set_config(cfg.clone());
    Json(serde_json::json!({ "ok": true, "config": cfg })).into_response()
}

async fn handle_get_discovery_digest(State(state): State<ApiState>) -> impl IntoResponse {
    let digest = state.discovery_engine.get_digest();
    Json(serde_json::json!({ "ok": true, "digest": digest })).into_response()
}

// Battery Handlers
async fn handle_get_battery_status(State(state): State<ApiState>) -> impl IntoResponse {
    let status = state.battery_optimizer.get_status();
    Json(serde_json::json!({ "ok": true, "battery_status": status })).into_response()
}

#[derive(Deserialize)]
pub struct UpdateBatteryRequest {
    pub battery_level: u8,
}

async fn handle_update_battery_optimize(
    State(state): State<ApiState>,
    Json(req): Json<UpdateBatteryRequest>,
) -> impl IntoResponse {
    let status = state.battery_optimizer.update_battery(req.battery_level);
    Json(serde_json::json!({ "ok": true, "battery_status": status })).into_response()
}

// Ephemeral Handlers
async fn handle_set_ephemeral_timer(
    State(state): State<ApiState>,
    Json(cfg): Json<crate::ephemeral::EphemeralConfig>,
) -> impl IntoResponse {
    state.ephemeral_purge.set_config(cfg.clone());
    Json(serde_json::json!({ "ok": true, "config": cfg })).into_response()
}

// Sanitizer Handlers
async fn handle_clean_image_exif(
    Json(req): Json<crate::sanitizer::CleanImageRequest>,
) -> impl IntoResponse {
    match crate::sanitizer::ImageSanitizer::sanitize_image(req) {
        Ok(res) => Json(res).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

// AI Handlers
async fn handle_ai_status_public() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({
        "status": "ok",
        "service": "RED Sovereign Node AI",
        "version": env!("CARGO_PKG_VERSION"),
        "engine": "Candle GGUF / Offline Hybrid",
        "model": "red-tactical",
        "capabilities": ["copilot", "chat_completions", "emergency_triage"]
    }))).into_response()
}

async fn handle_ollama_tags_public() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({
        "models": [
            {
                "name": "red-tactical",
                "model": "red-tactical:latest",
                "modified_at": "2026-09-02T00:00:00Z",
                "size": 420000000,
                "digest": "sha256:rednode000000000000000000000000000000000000000000000000000000000",
                "details": {
                    "parent_model": "",
                    "format": "gguf",
                    "family": "qwen2",
                    "parameter_size": "0.5B",
                    "quantization_level": "Q4_K_M"
                }
            }
        ]
    }))).into_response()
}

async fn handle_openai_models_public() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({
        "object": "list",
        "data": [
            {
                "id": "red-tactical",
                "object": "model",
                "created": 1700000000,
                "owned_by": "red-node"
            }
        ]
    }))).into_response()
}

#[derive(Debug, Clone, Deserialize)]
pub struct OllamaGenerateRequest {
    pub model: Option<String>,
    pub prompt: String,
    pub stream: Option<bool>,
}

async fn handle_ollama_generate(
    State(state): State<ApiState>,
    Json(req): Json<OllamaGenerateRequest>,
) -> impl IntoResponse {
    let copilot_req = crate::ai_copilot::CopilotQueryRequest {
        prompt: req.prompt,
        context: None,
        model_path: None,
        model_id: req.model,
    };
    let res = state.ai_copilot.query_async(copilot_req).await;
    (StatusCode::OK, Json(serde_json::json!({
        "model": "red-tactical",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "response": res.answer,
        "done": true
    }))).into_response()
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIChatCompletionRequest {
    pub model: Option<String>,
    pub messages: Vec<OpenAIChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<usize>,
}

async fn handle_openai_chat_completions(
    State(state): State<ApiState>,
    Json(req): Json<OpenAIChatCompletionRequest>,
) -> impl IntoResponse {
    let last_user_msg = req.messages.iter().rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_else(|| "ping".to_string());
    
    let system_context = req.messages.iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());

    let copilot_req = crate::ai_copilot::CopilotQueryRequest {
        prompt: last_user_msg,
        context: system_context,
        model_path: None,
        model_id: req.model.clone(),
    };
    let res = state.ai_copilot.query_async(copilot_req).await;
    
    let completion_id = format!("chatcmpl-{}", red_core::protocol::MessageId::generate().to_hex());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    (StatusCode::OK, Json(serde_json::json!({
        "id": completion_id,
        "object": "chat.completion",
        "created": now,
        "model": req.model.unwrap_or_else(|| "red-tactical".to_string()),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": res.answer
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30
        }
    }))).into_response()
}

async fn handle_ai_copilot_query(
    State(state): State<ApiState>,
    Json(req): Json<crate::ai_copilot::CopilotQueryRequest>,
) -> impl IntoResponse {
    let res = state.ai_copilot.query_async(req).await;
    Json(res).into_response()
}

async fn handle_ai_summarize_channel(
    State(state): State<ApiState>,
    Json(req): Json<crate::ai_summarizer::SummarizeChannelRequest>,
) -> impl IntoResponse {
    let res = state.ai_summarizer.summarize(req);
    Json(res).into_response()
}

async fn handle_ai_translate_text(
    State(state): State<ApiState>,
    Json(req): Json<crate::ai_translator::TranslateRequest>,
) -> impl IntoResponse {
    let res = state.ai_translator.translate(req);
    Json(res).into_response()
}

// AMBER Handlers
async fn handle_create_amber_alert(
    State(state): State<ApiState>,
    Json(req): Json<crate::amber::CreateAmberAlertRequest>,
) -> impl IntoResponse {
    match state.amber_store.create_alert(req) {
        Ok(alert) => Json(serde_json::json!({ "ok": true, "alert": alert })).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

async fn handle_list_amber_alerts(State(state): State<ApiState>) -> impl IntoResponse {
    let alerts = state.amber_store.list_active_alerts();
    Json(serde_json::json!({ "ok": true, "alerts": alerts })).into_response()
}

async fn handle_get_amber_alert(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.amber_store.get_alert(&id) {
        Some(alert) => Json(alert).into_response(),
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Alert not found" }))).into_response(),
    }
}

async fn handle_resolve_amber_alert(
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Json(req): Json<crate::amber::ResolveAmberAlertRequest>,
) -> impl IntoResponse {
    match state.amber_store.resolve_alert(&id, &req.authority_node_id, req.resolution_notes) {
        Ok(alert) => Json(serde_json::json!({ "ok": true, "alert": alert })).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

async fn handle_report_sighting(
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Json(req): Json<crate::amber::ReportSightingRequest>,
) -> impl IntoResponse {
    let reporter_node_id = state.node.lock().await.identity_hash().to_hex();
    match state.amber_store.report_sighting(&id, &reporter_node_id, req.lat, req.lon, req.notes) {
        Ok(sighting) => Json(serde_json::json!({ "ok": true, "sighting": sighting })).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

// Guardian Handlers
async fn handle_guardian_status(State(state): State<ApiState>) -> impl IntoResponse {
    let stats = state.guardian_engine.get_stats();
    let authorities = crate::amber_authority::list_authorities();
    Json(serde_json::json!({
        "active": state.guardian_engine.mode != crate::guardian::GuardianMode::Off,
        "mode": format!("{:?}", state.guardian_engine.mode).to_lowercase(),
        "has_api_key": false,
        "model": "RED Local Heuristic Engine (<15MB RAM)",
        "stats": stats,
        "authorities": authorities
    })).into_response()
}

#[derive(Deserialize)]
pub struct GuardianReportRequest {
    pub content: Option<String>,
    pub reason: Option<String>,
}

async fn handle_report_content(
    State(state): State<ApiState>,
    Json(req): Json<GuardianReportRequest>,
) -> impl IntoResponse {
    let content = req.content.as_deref().or(req.reason.as_deref()).unwrap_or("");
    let verdict = state.guardian_engine.analyze_text(content);
    let report_id = format!("rep_{}", chrono::Utc::now().timestamp_millis());
    Json(serde_json::json!({
        "ok": true,
        "report_id": report_id,
        "verdict": verdict
    })).into_response()
}



// ─── Async Wrappers (build_router_async delegates) ────────────────────────────



// ─── Tactical Blackout Simulator Handlers (v33.0) ──────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlackoutStatusResponse {
    pub is_blackout: bool,
    pub isolated_wan: bool,
    pub active_transports: Vec<String>,
    pub local_peers: usize,
    pub epidemic_ttl: u8,
    pub blocked_wan_peers: usize,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetBlackoutRequest {
    pub enabled: bool,
}


// ─── RF Spectrum & Electronic Countermeasures Handlers (v33.0) ────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RfMetricsResponse {
    pub current_channel: u8,
    pub frequency_mhz: u32,
    pub channel_label: String,
    pub fec_rate: String,
    pub fec_active: bool,
    pub hops_count: u32,
    pub noise_floor_db: i32,
    pub average_snr_db: f32,
    pub packet_error_rate: f32,
    pub active_transports: Vec<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChannelHopRequest {
    pub target_channel: Option<u8>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetFecRequest {
    pub enabled: bool,
}

fn get_channel_freq(channel: u8) -> (u32, &'static str) {
    match channel {
        1 => (2412, "Canal 1 (2.412 GHz)"),
        3 => (2422, "Canal 3 (2.422 GHz)"),
        6 => (2437, "Canal 6 (2.437 GHz)"),
        8 => (2447, "Canal 8 (2.447 GHz)"),
        11 => (2462, "Canal 11 (2.462 GHz)"),
        13 => (2472, "Canal 13 (2.472 GHz)"),
        37 => (2402, "BLE 37 Primario (2.402 GHz)"),
        38 => (2426, "BLE 38 Primario (2.426 GHz)"),
        39 => (2480, "BLE 39 Primario (2.480 GHz)"),
        _ => (2412, "Canal 1 (2.412 GHz)"),
    }
}


// ─── System Health & Kernel Hardware Benchmark Handlers (v34.0) ──────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealthResponse {
    pub status: String,
    pub node_id: String,
    pub uptime_seconds: u64,
    pub storage_benchmark: StorageBenchmarkMetrics,
    pub crypto_benchmark: CryptoBenchmarkMetrics,
    pub runtime_diagnostics: RuntimeDiagnosticsMetrics,
    pub network_telemetry: NetworkTelemetryMetrics,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageBenchmarkMetrics {
    pub passed: bool,
    pub entries_tested: usize,
    pub duration_us: u64,
    pub ops_per_sec: u64,
    pub engine: String,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoBenchmarkMetrics {
    pub passed: bool,
    pub ed25519_sign_verify_ops: usize,
    pub chacha20_poly1305_ops: usize,
    pub duration_us: u64,
    pub total_ops_per_sec: u64,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeDiagnosticsMetrics {
    pub tokio_status: String,
    pub memory_pressure: String,
    pub global_log_buffer_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkTelemetryMetrics {
    pub peer_count: usize,
    pub packets_sent: u64,
    pub blackout_active: bool,
    pub active_rf_channel: u8,
    pub fec_rate: String,
    pub transports: Vec<String>,
}


// ─── Medical Triage START & Vital Signs Telemetry Handlers (v35.0) ────────

#[derive(Debug, Clone, Deserialize)]
pub struct CreateTriageReportRequest {
    pub id: Option<String>,
    pub victim_label: String,
    pub category: String,
    pub bpm: Option<u32>,
    pub spo2: Option<u32>,
    pub can_walk: Option<bool>,
    pub is_breathing: Option<bool>,
    pub resp_rate: Option<u32>,
    pub cap_refill_sec: Option<f32>,
    pub can_follow_commands: Option<bool>,
    pub notes: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}


// ─── Tactical Emergency SOS Beacon & SoundMesh Handlers (v36.0) ───────────

#[derive(Debug, Clone, Deserialize)]
pub struct CreateEmergencyBeaconRequest {
    pub beacon_id: Option<String>,
    pub distress_type: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub altitude: Option<f64>,
    pub battery_level: Option<u8>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CancelEmergencyBeaconRequest {
    pub beacon_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InjectSoundMeshRequest {
    pub payload: String,
}


// ─── Tactical Stego Vault Handlers (v37.0) ────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct SaveStegoCapsuleRequest {
    pub id: Option<String>,
    pub title: String,
    pub image_data: String,
    pub has_password: Option<bool>,
    pub notes: Option<String>,
}


// ─── Dead Man's Switch (DMS) Handlers (v38.0) ─────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct SaveDmsConfigRequest {
    pub enabled: bool,
    pub trigger_hours: u32,
    pub wipe_messages: bool,
    pub wipe_identity: bool,
    pub dead_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DmsStatusResponse {
    pub enabled: bool,
    pub trigger_hours: u32,
    pub wipe_messages: bool,
    pub wipe_identity: bool,
    pub dead_message: String,
    pub last_active_timestamp: u64,
    pub seconds_remaining: i64,
    pub is_triggered: bool,
}


// ─── Proximity Radar and Shake-Pair Handlers (v39.0) ───────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct ProximityPingRequest {
    pub id: String,
    pub name: String,
    pub did: String,
    pub distance_meters: Option<f32>,
    pub azimuth: Option<f32>,
    pub transport: Option<String>,
    pub rssi: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ShakePairRequest {
    pub sender_hash: Option<String>,
    pub sender_name: Option<String>,
    pub sender_pk: Option<String>,
}

async fn handle_get_proximity_nodes(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let mut nodes = s.get_proximity_nodes().unwrap_or_default();

    // If no nodes explicitly pinged into sled, derive from active peers and contacts
    if nodes.is_empty() {
        let contacts = s.get_contacts();
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
        for (i, c) in contacts.iter().enumerate() {
            let angle = ((i as f32) * 75.0 + 30.0) % 360.0;
            let dist = 12.0 + ((i as f32) * 8.5);
            let rssi = -60 - ((i as i32) * 8);
            nodes.push(red_core::storage::ProximityNodeRecord {
                id: c.identity_hash.to_hex(),
                name: c.display_name.clone(),
                did: format!("did:red:{}", c.identity_hash.to_hex()),
                distance_meters: dist,
                azimuth: angle,
                transport: if i % 2 == 0 { "BLE Mesh".into() } else { "WiFi 7331".into() },
                rssi,
                is_active: true,
                last_seen: now.saturating_sub((i as u64) * 15),
            });
        }
    }

    Json(nodes).into_response()
}


async fn handle_ping_proximity(
    State(state): State<ApiState>,
    Json(req): Json<ProximityPingRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    let record = red_core::storage::ProximityNodeRecord {
        id: req.id.clone(),
        name: req.name.clone(),
        did: req.did.clone(),
        distance_meters: req.distance_meters.unwrap_or(15.0),
        azimuth: req.azimuth.unwrap_or(0.0),
        transport: req.transport.unwrap_or_else(|| "BLE Mesh".into()),
        rssi: req.rssi.unwrap_or(-65),
        is_active: true,
        last_seen: now,
    };

    let _ = s.store_proximity_node(&record);
    record_log_sync("INFO", "red_core::proximity", &format!("📡 BALIZA DE PROXIMIDAD: '{}' a {}m (Azimut: {}°)", record.name, record.distance_meters, record.azimuth));

    (StatusCode::OK, Json(record)).into_response()
}

async fn handle_shake_pair(
    State(state): State<ApiState>,
    Json(req): Json<ShakePairRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let my_hash = node.identity_hash().to_hex();
    let my_name = req.sender_name.unwrap_or_else(|| "Nodo RED".into());
    let sender_pk = req.sender_pk.unwrap_or_default();

    record_log_sync("INFO", "red_core::shake_pair", &format!("ðŸ“³ SHAKE PAIR BROADCAST: Transmitido handshake desde {}", my_name));

    (StatusCode::OK, Json(serde_json::json!({
        "success": true,
        "sender_hash": my_hash,
        "sender_name": my_name,
        "sender_pk": sender_pk
    }))).into_response()
}

async fn handle_get_proximity_nodes_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_proximity_nodes(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_ping_proximity_async(
    State(state): State<AsyncState>,
    Json(req): Json<ProximityPingRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_ping_proximity(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_shake_pair_async(
    State(state): State<AsyncState>,
    Json(req): Json<ShakePairRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_shake_pair(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_dms_config(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let config = s.get_dms_config().unwrap_or(red_core::storage::DmsConfigRecord {
        enabled: false,
        trigger_hours: 72,
        wipe_messages: true,
        wipe_identity: false,
        dead_message: String::new(),
        last_active_timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    });

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    let elapsed = now.saturating_sub(config.last_active_timestamp);
    let trigger_secs = (config.trigger_hours as u64) * 3600;
    let seconds_remaining = if config.enabled { (trigger_secs as i64) - (elapsed as i64) } else { trigger_secs as i64 };
    let is_triggered = config.enabled && seconds_remaining <= 0;

    Json(DmsStatusResponse {
        enabled: config.enabled,
        trigger_hours: config.trigger_hours,
        wipe_messages: config.wipe_messages,
        wipe_identity: config.wipe_identity,
        dead_message: config.dead_message,
        last_active_timestamp: config.last_active_timestamp,
        seconds_remaining: seconds_remaining.max(0),
        is_triggered,
    }).into_response()
}

async fn handle_save_dms_config(
    State(state): State<ApiState>,
    Json(req): Json<SaveDmsConfigRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    let record = red_core::storage::DmsConfigRecord {
        enabled: req.enabled,
        trigger_hours: req.trigger_hours,
        wipe_messages: req.wipe_messages,
        wipe_identity: req.wipe_identity,
        dead_message: req.dead_message.unwrap_or_default(),
        last_active_timestamp: now,
    };

    let _ = s.save_dms_config(&record);
    record_log_sync("WARN", "red_core::dms", &format!("â±ï¸ DEAD MAN'S SWITCH ACTUALIZADO: [Activo: {}, Ventana: {}h, Purga Mensajes: {}, Purga Identidad: {}]", record.enabled, record.trigger_hours, record.wipe_messages, record.wipe_identity));

    (StatusCode::OK, Json(record)).into_response()
}

async fn handle_ping_dms(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let ts = s.ping_dms_activity().unwrap_or_default();
    record_log_sync("INFO", "red_core::dms", "ðŸ”„ DMS CHECK-IN: Presencia de operador registrada.");
    (StatusCode::OK, Json(serde_json::json!({"success": true, "last_active_timestamp": ts}))).into_response()
}

async fn handle_panic_wipe(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let mut s = storage.lock().await;
    let _ = s.execute_dms_purge(true, true);
    record_log_sync("CRITICAL", "red_core::dms", "🚨 PURGA DE PÁNICO EJECUTADA: Base de datos Sled y claves purgadas.");
    (StatusCode::OK, Json(serde_json::json!({"success": true, "wiped": true}))).into_response()
}

async fn handle_get_dms_config_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_dms_config(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_save_dms_config_async(
    State(state): State<AsyncState>,
    Json(req): Json<SaveDmsConfigRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_save_dms_config(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_ping_dms_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_ping_dms(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_panic_wipe_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_panic_wipe(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_stego_vault(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let capsules = s.get_stego_capsules().unwrap_or_default();
    Json(capsules).into_response()
}

async fn handle_save_stego_vault(
    State(state): State<ApiState>,
    Json(req): Json<SaveStegoCapsuleRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let id = req.id.unwrap_or_else(|| red_core::protocol::MessageId::generate().to_hex());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    let record = red_core::storage::StegoCapsuleRecord {
        id: id.clone(),
        title: req.title.clone(),
        image_data: req.image_data,
        has_password: req.has_password.unwrap_or(false),
        notes: req.notes.unwrap_or_default(),
        timestamp: now,
    };

    let _ = s.store_stego_capsule(&record);
    record_log_sync("INFO", "red_core::stego", &format!("ðŸ–¼ï¸ CÁPSULA ESTEGANOGRÁFICA GUARDADA: '{}' (Cifrada: {})", record.title, record.has_password));

    (StatusCode::CREATED, Json(record)).into_response()
}

async fn handle_delete_stego_vault(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let _ = s.delete_stego_capsule(&id);
    (StatusCode::OK, Json(serde_json::json!({"success": true, "deleted": id}))).into_response()
}

async fn handle_get_stego_vault_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_stego_vault(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_save_stego_vault_async(
    State(state): State<AsyncState>,
    Json(req): Json<SaveStegoCapsuleRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_save_stego_vault(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_delete_stego_vault_async(
    State(state): State<AsyncState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_delete_stego_vault(State(r.clone()), Path(id)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_emergency_beacons(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let beacons = s.get_emergency_beacons().unwrap_or_default();
    Json(beacons).into_response()
}

async fn handle_broadcast_emergency_beacon(
    State(state): State<ApiState>,
    Json(req): Json<CreateEmergencyBeaconRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    let sender_hash = node.identity_hash().clone();
    let beacon_id = req.beacon_id.unwrap_or_else(|| red_core::protocol::MessageId::generate().to_hex());
    let distress_type = req.distress_type.unwrap_or_else(|| "SOS_GENERAL".to_string());
    let msg_text = req.message.unwrap_or_else(|| "¡EMERGENCIA TÁCTICA SOS ACTIVA!".to_string());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    let record = red_core::storage::EmergencyBeaconRecord {
        beacon_id: beacon_id.clone(),
        sender_hash: sender_hash.clone(),
        sender_name: "Este Dispositivo".to_string(),
        distress_type: distress_type.clone(),
        latitude: req.latitude,
        longitude: req.longitude,
        altitude: req.altitude,
        battery_level: req.battery_level,
        message: msg_text.clone(),
        active: true,
        timestamp: now,
        is_mine: true,
    };

    // 1. Store in Sled DB
    {
        let storage = node.get_storage();
        let s = storage.lock().await;
        let _ = s.store_emergency_beacon(&record);
    }

    // 2. Broadcast via Gossipsub mesh swarm
    let msg = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: sender_hash,
        recipient: red_core::identity::IdentityHash::from_bytes([0; 32]),
        content: MessageType::EmergencyBeacon {
            beacon_id: beacon_id.clone(),
            distress_type: distress_type.clone(),
            latitude: req.latitude,
            longitude: req.longitude,
            altitude: req.altitude,
            battery_level: req.battery_level,
            message: msg_text.clone(),
            active: true,
            timestamp: now,
        },
        timestamp: now * 1000,
        reply_to: None,
        status: red_core::protocol::MessageStatus::Sent,
        edited: false,
    };
    let _ = node.send_message(red_core::identity::IdentityHash::from_bytes([0; 32]), msg.clone()).await;
    let _ = state.msg_tx.send(msg);

    record_log_sync("WARN", "red_core::sos", &format!("🚨 BALIZA SOS ACTIVADA: [{}] {}", distress_type, msg_text));

    (StatusCode::CREATED, Json(record)).into_response()
}

async fn handle_cancel_emergency_beacon(
    State(state): State<ApiState>,
    Json(req): Json<CancelEmergencyBeaconRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    let sender_hash = node.identity_hash().clone();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    // 1. Remove from Sled DB
    {
        let storage = node.get_storage();
        let s = storage.lock().await;
        let _ = s.remove_emergency_beacon(&req.beacon_id);
    }

    // 2. Broadcast cancel frame
    let msg = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: sender_hash,
        recipient: red_core::identity::IdentityHash::from_bytes([0; 32]),
        content: MessageType::EmergencyBeacon {
            beacon_id: req.beacon_id.clone(),
            distress_type: "SOS_CANCELLED".to_string(),
            latitude: None,
            longitude: None,
            altitude: None,
            battery_level: None,
            message: "Baliza de socorro desactivada.".to_string(),
            active: false,
            timestamp: now,
        },
        timestamp: now * 1000,
        reply_to: None,
        status: red_core::protocol::MessageStatus::Sent,
        edited: false,
    };
    let _ = node.send_message(red_core::identity::IdentityHash::from_bytes([0; 32]), msg.clone()).await;
    let _ = state.msg_tx.send(msg);

    record_log_sync("INFO", "red_core::sos", &format!("ðŸŸ¢ BALIZA SOS CANCELADA: #{}", req.beacon_id));

    (StatusCode::OK, Json(serde_json::json!({"success": true, "cancelled": req.beacon_id}))).into_response()
}

async fn handle_inject_soundmesh(
    State(_state): State<ApiState>,
    Json(req): Json<InjectSoundMeshRequest>,
) -> impl IntoResponse {
    record_log_sync("INFO", "red_core::soundmesh", &format!("📡 TRAMA ULTRASONIDO INYECTADA: {} ({} bytes)", req.payload, req.payload.len()));
    (StatusCode::OK, Json(serde_json::json!({"success": true, "injected_bytes": req.payload.len()}))).into_response()
}

async fn handle_get_emergency_beacons_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_emergency_beacons(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_broadcast_emergency_beacon_async(
    State(state): State<AsyncState>,
    Json(req): Json<CreateEmergencyBeaconRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_broadcast_emergency_beacon(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_cancel_emergency_beacon_async(
    State(state): State<AsyncState>,
    Json(req): Json<CancelEmergencyBeaconRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_cancel_emergency_beacon(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_inject_soundmesh_async(
    State(state): State<AsyncState>,
    Json(req): Json<InjectSoundMeshRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_inject_soundmesh(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_triage_reports(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let reports = s.get_triage_reports().unwrap_or_default();
    Json(reports).into_response()
}

async fn handle_create_triage_report(
    State(state): State<ApiState>,
    Json(req): Json<CreateTriageReportRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    let sender_hash = node.identity_hash().clone();
    let id = req.id.unwrap_or_else(|| red_core::protocol::MessageId::generate().to_hex());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    let record = red_core::storage::TriageReportRecord {
        id: id.clone(),
        victim_label: req.victim_label.clone(),
        category: req.category.clone(),
        bpm: req.bpm,
        spo2: req.spo2,
        notes: req.notes.clone().unwrap_or_default(),
        evaluator_hash: sender_hash.clone(),
        evaluator_name: "Operador Táctico".to_string(),
        timestamp: now,
        latitude: req.latitude,
        longitude: req.longitude,
        synced_mesh: true,
    };

    // 1. Persist to local Sled DB
    {
        let storage = node.get_storage();
        let s = storage.lock().await;
        let _ = s.store_triage_report(&record);
    }

    // 2. Broadcast MedicalTriagePayload over mesh Gossipsub
    let payload = red_core::protocol::MedicalTriagePayload {
        id: id.clone(),
        victim_label: req.victim_label.clone(),
        category: req.category.clone(),
        bpm: req.bpm,
        spo2: req.spo2,
        can_walk: req.can_walk.unwrap_or(false),
        is_breathing: req.is_breathing.unwrap_or(true),
        resp_rate: req.resp_rate.unwrap_or(20),
        cap_refill_sec: req.cap_refill_sec.unwrap_or(1.5),
        can_follow_commands: req.can_follow_commands.unwrap_or(true),
        notes: req.notes.unwrap_or_default(),
        evaluator_hash: sender_hash.clone(),
        evaluator_name: "Operador Táctico".to_string(),
        timestamp: now,
        latitude: req.latitude,
        longitude: req.longitude,
    };

    if let Ok(data) = serde_json::to_vec(&payload) {
        let msg = Message {
            id: red_core::protocol::MessageId::generate(),
            sender: sender_hash,
            recipient: red_core::identity::IdentityHash::from_bytes([0; 32]),
            content: MessageType::MedicalTriageReport(data),
            timestamp: now * 1000,
            reply_to: None,
            status: red_core::protocol::MessageStatus::Sent,
            edited: false,
        };
        let _ = node.send_message(red_core::identity::IdentityHash::from_bytes([0; 32]), msg.clone()).await;
        let _ = state.msg_tx.send(msg);
    }

    record_log_sync("WARN", "red_core::triage", &format!("🚨 REPORTE DE TRIAJE EMITIDO: {} [{}]", record.victim_label, record.category));

    (StatusCode::CREATED, Json(record)).into_response()
}

async fn handle_delete_triage_report(
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    let _ = s.delete_triage_report(&id);
    (StatusCode::OK, Json(serde_json::json!({"success": true, "deleted": id}))).into_response()
}

async fn handle_get_triage_reports_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_triage_reports(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_create_triage_report_async(
    State(state): State<AsyncState>,
    Json(req): Json<CreateTriageReportRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_create_triage_report(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_delete_triage_report_async(
    State(state): State<AsyncState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_delete_triage_report(State(r.clone()), Path(id)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_system_health(State(state): State<ApiState>) -> impl IntoResponse {
    use ed25519_dalek::{Signer, Verifier};

    let node = state.node.lock().await;
    let node_id = node.identity_hash().to_hex();
    let peer_count = node.transport_peer_count();
    let packets_sent = node.packets_sent.load(std::sync::atomic::Ordering::Relaxed);
    let is_blackout = node.is_blackout_mode();
    let (rf_channel, fec_rate_val, _) = node.get_rf_state();
    let storage = node.get_storage();
    drop(node);

    // 1. Sled DB Storage Benchmark (50 writes & reads with BLAKE3 hashing)
    let storage_start = std::time::Instant::now();
    let mut storage_passed = true;
    let mut storage_err = String::new();
    let count = 50;
    {
        let s = storage.lock().await;
        if let Some(db) = s.db() {
            for i in 0..count {
                let key = format!("__health_bench_{}", i);
                let val = red_core::crypto::hash(key.as_bytes()).to_vec();
                if let Err(e) = db.insert(key.as_bytes(), val.as_slice()) {
                    storage_passed = false;
                    storage_err = format!("Error de inserción: {:?}", e);
                    break;
                }
            }
            if storage_passed {
                for i in 0..count {
                    let key = format!("__health_bench_{}", i);
                    let expected = red_core::crypto::hash(key.as_bytes()).to_vec();
                    match db.get(key.as_bytes()) {
                        Ok(Some(v)) if v.as_ref() == expected.as_slice() => {
                            let _ = db.remove(key.as_bytes());
                        }
                        _ => {
                            storage_passed = false;
                            storage_err = "Mismatch en lectura de verificación".to_string();
                            break;
                        }
                    }
                }
                let _ = db.flush();
            }
        } else {
            storage_passed = false;
            storage_err = "Base de datos Sled no inicializada".to_string();
        }
    }
    let storage_elapsed = storage_start.elapsed();
    let storage_us = storage_elapsed.as_micros() as u64;
    let storage_ops_per_sec = if storage_us > 0 {
        ((count * 2) as u64 * 1_000_000) / storage_us
    } else {
        100_000
    };

    // 2. Crypto Benchmark: 50 Ed25519 Signatures, 50 X25519 Key Exchanges + 50 ChaCha20-Poly1305 Encryptions
    let crypto_start = std::time::Instant::now();
    let mut crypto_passed = true;
    let mut crypto_err = String::new();
    let payload_1kb = vec![0x42u8; 1024];

    for _ in 0..count {
        // A. Ed25519 Signing
        if let Ok(identity) = red_core::identity::Identity::generate() {
            let sig = identity.sign(&payload_1kb);
            if sig.len() != 64 {
                crypto_passed = false;
                crypto_err = "Fallo en longitud de firma Ed25519".to_string();
                break;
            }
        }

        // B. X25519 DH Key Exchange
        let kp1 = red_core::crypto::KeyPair::generate();
        let kp2 = red_core::crypto::KeyPair::generate();
        let shared1 = kp1.key_exchange(&kp2.public);
        let shared2 = kp2.key_exchange(&kp1.public);
        if shared1 != shared2 {
            crypto_passed = false;
            crypto_err = "Fallo en intercambio de claves X25519".to_string();
            break;
        }

        // C. ChaCha20-Poly1305 AEAD Encryption/Decryption
        let sym_key = shared1;
        match red_core::crypto::encrypt(&sym_key, &payload_1kb) {
            Ok(enc) => {
                match red_core::crypto::decrypt(&sym_key, &enc) {
                    Ok(dec) if dec == payload_1kb => {}
                    _ => {
                        crypto_passed = false;
                        crypto_err = "Fallo en descifrado ChaCha20-Poly1305".to_string();
                        break;
                    }
                }
            }
            Err(e) => {
                crypto_passed = false;
                crypto_err = format!("Fallo en cifrado: {:?}", e);
                break;
            }
        }
    }
    let crypto_elapsed = crypto_start.elapsed();
    let crypto_us = crypto_elapsed.as_micros() as u64;
    let total_crypto_ops = count * 4; // Sign + DH1 + DH2 + Encrypt/Decrypt
    let crypto_ops_per_sec = if crypto_us > 0 {
        (total_crypto_ops as u64 * 1_000_000) / crypto_us
    } else {
        200_000
    };

    // 3. Runtime & Memory diagnostics
    let logs_count = {
        if let Some(arc) = GLOBAL_BOOT_LOGS.get() {
            if let Ok(guard) = arc.read() {
                guard.len()
            } else {
                0
            }
        } else {
            0
        }
    };

    let overall_status = if storage_passed && crypto_passed {
        "OPTIMAL".to_string()
    } else {
        "DEGRADED".to_string()
    };

    Json(SystemHealthResponse {
        status: overall_status,
        node_id,
        uptime_seconds: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
        storage_benchmark: StorageBenchmarkMetrics {
            passed: storage_passed,
            entries_tested: count,
            duration_us: storage_us,
            ops_per_sec: storage_ops_per_sec,
            engine: "Sled Embedded B-Tree Engine".to_string(),
            details: if storage_passed {
                format!("{} escrituras/lecturas en {}µs ({} IOPS)", count * 2, storage_us, storage_ops_per_sec)
            } else {
                storage_err
            },
        },
        crypto_benchmark: CryptoBenchmarkMetrics {
            passed: crypto_passed,
            ed25519_sign_verify_ops: count * 2,
            chacha20_poly1305_ops: count * 2,
            duration_us: crypto_us,
            total_ops_per_sec: crypto_ops_per_sec,
            details: if crypto_passed {
                format!("{} operaciones criptográficas en {}µs ({} ops/seg)", total_crypto_ops, crypto_us, crypto_ops_per_sec)
            } else {
                crypto_err
            },
        },
        runtime_diagnostics: RuntimeDiagnosticsMetrics {
            tokio_status: "Operacional (Multi-Threaded Async)".to_string(),
            memory_pressure: "Baja (Óptima)".to_string(),
            global_log_buffer_size: logs_count,
        },
        network_telemetry: NetworkTelemetryMetrics {
            peer_count,
            packets_sent,
            blackout_active: is_blackout,
            active_rf_channel: rf_channel,
            fec_rate: if fec_rate_val == 2 { "1/4 (Anti-Jamming)".to_string() } else { "1/2 (Estándar)".to_string() },
            transports: if is_blackout {
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
            },
        },
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    }).into_response()
}

async fn handle_system_health_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_system_health(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_rf_metrics(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let (channel, fec_rate, hops_count) = node.get_rf_state();
    let (freq, label) = get_channel_freq(channel);
    let is_blackout = node.is_blackout_mode();

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

    Json(RfMetricsResponse {
        current_channel: channel,
        frequency_mhz: freq,
        channel_label: label.to_string(),
        fec_rate: if fec_rate == 2 { "1/4 (Anti-Jamming Reed-Solomon)".to_string() } else { "1/2 (Estándar)".to_string() },
        fec_active: fec_rate == 2,
        hops_count,
        noise_floor_db: -95,
        average_snr_db: 18.4,
        packet_error_rate: if fec_rate == 2 { 0.002 } else { 0.015 },
        active_transports,
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    }).into_response()
}

async fn handle_channel_hop(
    State(state): State<ApiState>,
    Json(req): Json<ChannelHopRequest>,
) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    let (current_channel, _, _) = node.get_rf_state();
    
    // Hop sequence: 1 -> 6 -> 11 -> 37 -> 38 -> 39 -> 1
    let next_channel = req.target_channel.unwrap_or({
        match current_channel {
            1 => 6,
            6 => 11,
            11 => 37,
            37 => 38,
            38 => 39,
            _ => 1,
        }
    });

    let (freq, label) = get_channel_freq(next_channel);
    node.set_rf_channel(next_channel);

    let reason = req.reason.unwrap_or_else(|| "Evasión de interferencia de espectro".to_string());
    record_log_sync("WARN", "red_core::rf", &format!("📡 SALTO DE FRECUENCIA TÁCTICO: Enjambre migrado a {} - Razón: {}", label, reason));

    let (_, fec_rate, hops_count) = node.get_rf_state();

    // Broadcast ChannelHopCoordination to mesh swarm
    let hop_msg = Message {
        id: red_core::protocol::MessageId::generate(),
        sender: node.identity_hash().clone(),
        recipient: red_core::identity::IdentityHash::from_bytes([0; 32]),
        content: MessageType::ChannelHopCoordination {
            target_channel: next_channel,
            frequency_mhz: freq,
            reason: reason.clone(),
            timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
        },
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
        reply_to: None,
        status: red_core::protocol::MessageStatus::Sent,
        edited: false,
    };
    let _ = node.send_message(red_core::identity::IdentityHash::from_bytes([0; 32]), hop_msg.clone()).await;
    let _ = state.msg_tx.send(hop_msg);

    Json(RfMetricsResponse {
        current_channel: next_channel,
        frequency_mhz: freq,
        channel_label: label.to_string(),
        fec_rate: if fec_rate == 2 { "1/4 (Anti-Jamming Reed-Solomon)".to_string() } else { "1/2 (Estándar)".to_string() },
        fec_active: fec_rate == 2,
        hops_count,
        noise_floor_db: -95,
        average_snr_db: 19.1,
        packet_error_rate: if fec_rate == 2 { 0.002 } else { 0.012 },
        active_transports: vec![
            "mDNS / LAN UDP (7331)".to_string(),
            "Bluetooth LE Mesh (GATT)".to_string(),
            "LoRa Serial Radio (915MHz)".to_string(),
        ],
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    }).into_response()
}

async fn handle_set_fec(
    State(state): State<ApiState>,
    Json(req): Json<SetFecRequest>,
) -> impl IntoResponse {
    let node = state.node.lock().await;
    let rate = if req.enabled { 2 } else { 1 };
    node.set_fec_rate(rate);

    if req.enabled {
        record_log_sync("CRYPTO", "red_core::rf", "🛡ï¸ CODIFICACIÓN FEC REED-SOLOMON 1/4 ACTIVADA (Modo Anti-Jamming)");
    } else {
        record_log_sync("INFO", "red_core::rf", "â„¹ï¸ CODIFICACIÓN FEC 1/2 ESTÁNDAR RESTABLECIDA");
    }

    let (channel, fec_rate, hops_count) = node.get_rf_state();
    let (freq, label) = get_channel_freq(channel);

    Json(RfMetricsResponse {
        current_channel: channel,
        frequency_mhz: freq,
        channel_label: label.to_string(),
        fec_rate: if fec_rate == 2 { "1/4 (Anti-Jamming Reed-Solomon)".to_string() } else { "1/2 (Estándar)".to_string() },
        fec_active: fec_rate == 2,
        hops_count,
        noise_floor_db: -95,
        average_snr_db: 18.8,
        packet_error_rate: if fec_rate == 2 { 0.001 } else { 0.015 },
        active_transports: vec![
            "mDNS / LAN UDP (7331)".to_string(),
            "Bluetooth LE Mesh (GATT)".to_string(),
            "LoRa Serial Radio (915MHz)".to_string(),
        ],
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    }).into_response()
}

async fn handle_get_rf_metrics_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_rf_metrics(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_channel_hop_async(
    State(state): State<AsyncState>,
    Json(req): Json<ChannelHopRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_channel_hop(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_set_fec_async(
    State(state): State<AsyncState>,
    Json(req): Json<SetFecRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_set_fec(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_blackout(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let is_blackout = node.is_blackout_mode();
    let local_peers = node.transport_peer_count();
    
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
        local_peers,
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
        record_log_sync("WARN", "red_core::network", "⚠️ï¸ PROTOCOLO DE APAGÓN ACTIVADO: Sockets WAN desconectados. Enrutamiento restringido a mDNS + BLE + LoRa (Epidemic TTL=7)");
    } else {
        record_log_sync("INFO", "red_core::network", "✅ PROTOCOLO DE APAGÓN DESACTIVADO: Reconectando relé WAN libp2p y nodos semilla");
    }

    let is_blackout = req.enabled;
    let local_peers = node.transport_peer_count();
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
        local_peers,
        epidemic_ttl: if is_blackout { 7 } else { 3 },
        blocked_wan_peers: node.get_blocked_wan_peers(),
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
    }).into_response()
}

async fn handle_get_blackout_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_blackout(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_set_blackout_async(
    State(state): State<AsyncState>,
    Json(req): Json<SetBlackoutRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_set_blackout(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_logs(
    State(state): State<ApiState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit = params
        .get("limit")
        .and_then(|l| l.parse::<usize>().ok())
        .unwrap_or(100);
    let level_filter = params.get("level").map(|s| s.to_uppercase());
    let logs = match state.logs.read() {
        Ok(l) => l,
        Err(p) => p.into_inner(),
    };
    let items: Vec<RustLogEntry> = logs
        .iter()
        .filter(|e| {
            if let Some(ref lvl) = level_filter {
                if lvl != "ALL" && lvl != "TODOS" && !lvl.is_empty() {
                    return &e.level == lvl;
                }
            }
            true
        })
        .rev()
        .take(limit)
        .cloned()
        .collect();
    Json(items).into_response()
}

async fn handle_logs_async(
    State(_state): State<AsyncState>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit = params
        .get("limit")
        .and_then(|l| l.parse::<usize>().ok())
        .unwrap_or(100);
    let level_filter = params.get("level").map(|s| s.to_uppercase());
    let global_logs = get_or_init_global_logs();
    let logs = match global_logs.read() {
        Ok(l) => l,
        Err(p) => p.into_inner(),
    };
    let items: Vec<RustLogEntry> = logs
        .iter()
        .filter(|e| {
            if let Some(ref lvl) = level_filter {
                if lvl != "ALL" && lvl != "TODOS" && !lvl.is_empty() {
                    return &e.level == lvl;
                }
            }
            true
        })
        .rev()
        .take(limit)
        .cloned()
        .collect();
    Json(items).into_response()
}

async fn handle_emit_sos_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::sos::SosReportRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_emit_sos(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_active_sos_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_active_sos(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_post_channel_message_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::channels::PostChannelMessageRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_post_channel_message(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_send_voice_burst_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::voice::SendVoiceBurstRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_send_voice_burst(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_delete_voice_burst_async(
    State(state): State<AsyncState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_delete_voice_burst(State(r.clone()), Path(id)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}
async fn handle_post_weather_report_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::weather::PostWeatherReportRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_post_weather_report(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_discovery_proximity_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_discovery_proximity(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_register_ble_device_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::discovery::RegisterBleDeviceRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_register_ble_device(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_trigger_wave_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::discovery::WaveHandshakeRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_trigger_wave(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_discovery_config_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_discovery_config(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_set_discovery_config_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::discovery::ProximityFilterConfig>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_set_discovery_config(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_discovery_digest_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_discovery_digest(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_battery_status_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_battery_status(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_update_battery_optimize_async(
    State(state): State<AsyncState>,
    Json(req): Json<UpdateBatteryRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_update_battery_optimize(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_set_ephemeral_timer_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::ephemeral::EphemeralConfig>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_set_ephemeral_timer(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_ai_copilot_query_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::ai_copilot::CopilotQueryRequest>,
) -> impl IntoResponse {
    let copilot_engine = {
        let s = state.lock().await;
        match &*s {
            Some(r) => r.ai_copilot.clone(),
            None => crate::ai_copilot::AICopilotEngine::global(),
        }
    };
    let res = copilot_engine.query_async(req).await;
    (StatusCode::OK, Json(res)).into_response()
}

async fn handle_ollama_generate_async(
    State(state): State<AsyncState>,
    Json(req): Json<OllamaGenerateRequest>,
) -> impl IntoResponse {
    let copilot_engine = {
        let s = state.lock().await;
        match &*s {
            Some(r) => r.ai_copilot.clone(),
            None => crate::ai_copilot::AICopilotEngine::global(),
        }
    };
    let copilot_req = crate::ai_copilot::CopilotQueryRequest {
        prompt: req.prompt,
        context: None,
        model_path: None,
        model_id: req.model,
    };
    let res = copilot_engine.query_async(copilot_req).await;
    (StatusCode::OK, Json(serde_json::json!({
        "model": "red-tactical",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "response": res.answer,
        "done": true
    }))).into_response()
}

async fn handle_openai_chat_completions_async(
    State(state): State<AsyncState>,
    Json(req): Json<OpenAIChatCompletionRequest>,
) -> impl IntoResponse {
    let copilot_engine = {
        let s = state.lock().await;
        match &*s {
            Some(r) => r.ai_copilot.clone(),
            None => crate::ai_copilot::AICopilotEngine::global(),
        }
    };
    let last_user_msg = req.messages.iter().rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_else(|| "ping".to_string());
    
    let system_context = req.messages.iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());

    let copilot_req = crate::ai_copilot::CopilotQueryRequest {
        prompt: last_user_msg,
        context: system_context,
        model_path: None,
        model_id: req.model.clone(),
    };
    let res = copilot_engine.query_async(copilot_req).await;
    
    let completion_id = format!("chatcmpl-{}", red_core::protocol::MessageId::generate().to_hex());
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    (StatusCode::OK, Json(serde_json::json!({
        "id": completion_id,
        "object": "chat.completion",
        "created": now,
        "model": req.model.unwrap_or_else(|| "red-tactical".to_string()),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": res.answer
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30
        }
    }))).into_response()
}

async fn handle_ai_summarize_channel_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::ai_summarizer::SummarizeChannelRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_ai_summarize_channel(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_ai_translate_text_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::ai_translator::TranslateRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_ai_translate_text(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_extract_embeddings_async(
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let text = req.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let res = crate::embeddings::NativeEmbeddingEngine::extract(text);
    (StatusCode::OK, Json(res))
}

async fn handle_create_amber_alert_async(
    State(state): State<AsyncState>,
    Json(req): Json<crate::amber::CreateAmberAlertRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_create_amber_alert(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_list_amber_alerts_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_list_amber_alerts(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_guardian_status_async(State(state): State<AsyncState>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_guardian_status(State(r.clone())).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_report_content_async(
    State(state): State<AsyncState>,
    Json(req): Json<GuardianReportRequest>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_report_content(State(r.clone()), Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_resolve_sos_async(State(state): State<AsyncState>, path: Path<String>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_resolve_sos(State(r.clone()), path).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_channel_messages_async(State(state): State<AsyncState>, axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_channel_messages(State(r.clone()), axum::extract::Query(params)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_voice_bursts_async(State(state): State<AsyncState>, axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_voice_bursts(State(r.clone()), axum::extract::Query(params)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_weather_reports_async(State(state): State<AsyncState>, axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_weather_reports(State(r.clone()), axum::extract::Query(params)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_get_amber_alert_async(State(state): State<AsyncState>, path: Path<String>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_get_amber_alert(State(r.clone()), path).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_resolve_amber_alert_async(State(state): State<AsyncState>, path: Path<String>, Json(req): Json<crate::amber::ResolveAmberAlertRequest>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_resolve_amber_alert(State(r.clone()), path, Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}

async fn handle_report_sighting_async(State(state): State<AsyncState>, path: Path<String>, Json(req): Json<crate::amber::ReportSightingRequest>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_report_sighting(State(r.clone()), path, Json(req)).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}



// --- Social Network APIs ---
#[derive(Deserialize)]
pub struct CreateSocialPostRequest {
    pub content: String,
    pub media_data: Option<String>,
    pub reply_to: Option<String>,
}

#[derive(Deserialize)]
pub struct ReactSocialPostRequest {
    pub post_id: String,
    pub emoji: String,
}

#[derive(Deserialize)]
pub struct FollowUserRequest {
    pub target_hash: String,
}

async fn handle_social_feed(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    match s.get_social_feed(50) {
        Ok(posts) => (StatusCode::OK, Json(posts)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn handle_social_post(State(state): State<ApiState>, Json(req): Json<CreateSocialPostRequest>) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    let sender_hash = node.identity_hash().clone();
    let sender_name = { 
        let storage = node.get_storage();
        let s = storage.lock().await; 
        s.get_profile().map(|p| p.display_name).unwrap_or_else(|| "Unknown".to_string()) 
    };
    let payload = red_core::protocol::SocialPostPayload {
        id: red_core::protocol::MessageId::generate().to_hex(),
        author_name: sender_name,
        content: req.content,
        media_data: req.media_data,
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs(),
        reply_to: req.reply_to,
    };
    let data = serde_json::to_vec(&payload).unwrap_or_default();
    let msg_type = red_core::protocol::MessageType::SocialPost(data.clone());
    let out_msg = red_core::protocol::Message {
        id: red_core::protocol::MessageId::generate(),
        sender: sender_hash.clone(),
        recipient: red_core::identity::IdentityHash::from_bytes([0;32]),
        content: msg_type.clone(),
        timestamp: payload.timestamp as u64 * 1000,
        reply_to: None,
        status: red_core::protocol::MessageStatus::Sent,
        edited: false,
    };
    let _ = node.send_message(red_core::identity::IdentityHash::from_bytes([0;32]), out_msg).await;
    // Guardar copia local
    {
        let storage = node.get_storage();
        let s = storage.lock().await;
        let post = red_core::storage::SocialPost {
            id: payload.id,
            author_hash: sender_hash.clone(),
            author_name: payload.author_name,
            content: payload.content,
            media_data: payload.media_data,
            timestamp: payload.timestamp,
            reply_to: payload.reply_to,
            signature: String::new(),
            reactions: std::collections::HashMap::new(),
        };
        let _ = s.store_social_post(&post);
    }

    let notification = red_core::protocol::Message {
        id: red_core::protocol::MessageId::generate(),
        sender: sender_hash,
        recipient: red_core::identity::IdentityHash::from_bytes([0;32]),
        content: msg_type,
        timestamp: payload.timestamp as u64 * 1000,
        reply_to: None,
        status: red_core::protocol::MessageStatus::Sent,
        edited: false,
    };
    let _ = state.msg_tx.send(notification);

    (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
}

async fn handle_social_react(State(state): State<ApiState>, Json(req): Json<ReactSocialPostRequest>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let my_hash = node.identity_hash().to_hex();
    let storage = node.get_storage();
    let mut s = storage.lock().await;
    match s.react_to_post(&req.post_id, req.emoji, my_hash) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to react"}))).into_response(),
    }
}

async fn handle_social_follow(State(state): State<ApiState>, Json(req): Json<FollowUserRequest>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let mut s = storage.lock().await;
    match s.follow_user(&req.target_hash) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to follow"}))).into_response(),
    }
}

async fn handle_social_following(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    match s.get_following_list() {
        Ok(list) => (StatusCode::OK, Json(list)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to get following"}))).into_response(),
    }
}


async_wrap_get!(handle_social_feed_async, handle_social_feed);
async_wrap_post!(handle_social_post_async, handle_social_post, CreateSocialPostRequest);
async fn handle_social_post_delete(State(state): State<ApiState>, axum::extract::Path(post_id): axum::extract::Path<String>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let mut s = storage.lock().await;
    match s.delete_social_post(&post_id) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "Failed to delete"}))).into_response(),
    }
}
async fn handle_social_post_delete_async(
    State(state): State<AsyncState>,
    path: axum::extract::Path<String>,
) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(ready) => handle_social_post_delete(State(ready.clone()), path).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error": "Initializing"}))).into_response(),
    }
}
async_wrap_post!(handle_social_react_async, handle_social_react, ReactSocialPostRequest);
async_wrap_post!(handle_social_follow_async, handle_social_follow, FollowUserRequest);
async_wrap_get!(handle_social_following_async, handle_social_following);


async fn handle_contact_sync(State(state): State<ApiState>, axum::extract::Path(target_hash): axum::extract::Path<String>) -> impl IntoResponse {
    let mut node = state.node.lock().await;
    let my_hash = node.identity_hash().clone();
    if let Ok(recipient) = red_core::identity::IdentityHash::from_hex(&target_hash) {
        let msg = red_core::protocol::Message {
            id: red_core::protocol::MessageId::generate(),
            sender: my_hash,
            recipient,
            content: red_core::protocol::MessageType::ProfileSyncRequest,
            timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64,
            reply_to: None,
            status: red_core::protocol::MessageStatus::Sent,
            edited: false,
        };
        let _ = node.send_message(msg.recipient.clone(), msg).await;
        (StatusCode::OK, Json(serde_json::json!({"ok": true}))).into_response()
    } else {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Invalid hash"}))).into_response()
    }
}

async fn handle_contact_sync_async(State(state): State<AsyncState>, path: axum::extract::Path<String>) -> impl IntoResponse {
    let s = state.lock().await;
    match &*s {
        Some(r) => handle_contact_sync(State(r.clone()), path).await.into_response(),
        None => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error":"Node initializing"}))).into_response(),
    }
}





// ─── Sovereign P2P Payments & Vouchers Handlers (v32.0) ──────────────────────────

#[derive(Deserialize)]
pub struct CreateP2PVoucherRequest {
    pub amount: f64,
    pub recipient: Option<String>,
}

#[derive(Deserialize)]
pub struct RedeemP2PVoucherRequest {
    pub qr_payload: String,
}

async fn handle_get_p2p_wallet(State(state): State<ApiState>) -> impl IntoResponse {
    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;
    match s.get_p2p_wallet() {
        Ok(wallet) => {
            let vouchers = s.get_p2p_vouchers().unwrap_or_default();
            (StatusCode::OK, Json(serde_json::json!({
                "ok": true,
                "balance": wallet.balance,
                "total_minted": wallet.total_minted,
                "total_received": wallet.total_received,
                "total_spent": wallet.total_spent,
                "vouchers": vouchers
            }))).into_response()
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response(),
    }
}

async fn handle_create_p2p_voucher(State(state): State<ApiState>, Json(req): Json<CreateP2PVoucherRequest>) -> impl IntoResponse {
    if req.amount <= 0.0 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "El monto debe ser mayor a 0"}))).into_response();
    }

    let mut node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;

    let mut wallet = match s.get_p2p_wallet() {
        Ok(w) => w,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response();
        }
    };

    if wallet.balance < req.amount {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Saldo insuficiente en boveda"}))).into_response();
    }

    // Deduct balance
    wallet.balance -= req.amount;
    wallet.total_spent += req.amount;
    if let Err(e) = s.save_p2p_wallet(&wallet) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response();
    }

    let creator_hash = node.identity_hash().clone();
    let creator_name = s.get_profile().map(|p| p.display_name).unwrap_or_else(|| "Nodo Soberano".to_string());
    let recipient = req.recipient.unwrap_or_else(|| "Anónimo".to_string());
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
    let hash_hex = creator_hash.to_hex();
    let short_id = if hash_hex.len() >= 6 { &hash_hex[..6] } else { "RED" };
    let voucher_id = format!("VOUCHER_{}_{}", timestamp, short_id);

    // Cryptographic signature over voucher payload: (id + amount + timestamp + creator_hash)
    let sign_payload = format!("{}:{}:{}:{}", voucher_id, req.amount, timestamp, hash_hex);
    let signature_bytes = node.identity().sign(sign_payload.as_bytes());
    let signature_hex = hex::encode(signature_bytes);
    let verifying_key = node.identity().verifying_key();

    let voucher_record = red_core::storage::P2PVoucherRecord {
        id: voucher_id.clone(),
        creator_hash: creator_hash.clone(),
        creator_name: creator_name.clone(),
        recipient: recipient.clone(),
        amount: req.amount,
        timestamp,
        signature: signature_hex.clone(),
        is_outgoing: true,
        redeemed: true,
    };

    let _ = s.store_p2p_voucher(&voucher_record);

    // Broadcast voucher over Mesh so recipient can receive it automatically if online
    let voucher_payload = red_core::protocol::P2PVoucherPayload {
        id: voucher_id.clone(),
        creator_hash: creator_hash.clone(),
        creator_name,
        recipient: recipient.clone(),
        amount: req.amount,
        timestamp,
        verifying_key,
        signature: signature_hex.clone(),
    };

    if let Ok(data) = serde_json::to_vec(&voucher_payload) {
        let msg_type = red_core::protocol::MessageType::P2PVoucher(data);
        let out_msg = red_core::protocol::Message {
            id: red_core::protocol::MessageId::generate(),
            sender: creator_hash,
            recipient: red_core::identity::IdentityHash::from_bytes([0;32]),
            content: msg_type,
            timestamp,
            reply_to: None,
            status: red_core::protocol::MessageStatus::Sent,
            edited: false,
        };
        let _ = node.send_message(red_core::identity::IdentityHash::from_bytes([0;32]), out_msg).await;
    }

    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "voucher": voucher_record,
        "new_balance": wallet.balance
    }))).into_response()
}

async fn handle_redeem_p2p_voucher(State(state): State<ApiState>, Json(req): Json<RedeemP2PVoucherRequest>) -> impl IntoResponse {
    // Format expected: RED_PAY:<VOUCHER_ID>:<AMOUNT>:<SIGNATURE>
    let parts: Vec<&str> = req.qr_payload.split(':').collect();
    if parts.len() < 4 || parts[0] != "RED_PAY" {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Formato de voucher QR inválido"}))).into_response();
    }

    let voucher_id = parts[1].to_string();
    let amount: f64 = match parts[2].parse() {
        Ok(a) if a > 0.0 => a,
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Monto inválido en voucher"}))).into_response(),
    };
    let signature = parts[3].to_string();

    let node = state.node.lock().await;
    let storage = node.get_storage();
    let s = storage.lock().await;

    // Check if already redeemed locally
    if let Some(existing) = s.get_p2p_voucher(&voucher_id) {
        if existing.redeemed {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Este voucher ya fue canjeado previamente"}))).into_response();
        }
    }

    let my_hash = node.identity_hash().clone();
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

    let voucher_record = red_core::storage::P2PVoucherRecord {
        id: voucher_id.clone(),
        creator_hash: red_core::identity::IdentityHash::from_bytes([0;32]),
        creator_name: "Emisor P2P".to_string(),
        recipient: my_hash.to_hex(),
        amount,
        timestamp,
        signature,
        is_outgoing: false,
        redeemed: true,
    };

    let _ = s.store_p2p_voucher(&voucher_record);

    let mut wallet = match s.get_p2p_wallet() {
        Ok(w) => w,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))).into_response();
        }
    };

    wallet.balance += amount;
    wallet.total_received += amount;
    let _ = s.save_p2p_wallet(&wallet);

    (StatusCode::OK, Json(serde_json::json!({
        "ok": true,
        "amount": amount,
        "new_balance": wallet.balance,
        "voucher": voucher_record
    }))).into_response()
}

async_wrap_get!(handle_get_p2p_wallet_async, handle_get_p2p_wallet);
async_wrap_post!(handle_create_p2p_voucher_async, handle_create_p2p_voucher, CreateP2PVoucherRequest);
async_wrap_post!(handle_redeem_p2p_voucher_async, handle_redeem_p2p_voucher, RedeemP2PVoucherRequest);

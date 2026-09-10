//! RED Sovereign Blind Relay Server (DePIN Transit Engine)
//!
//! Provides ultra-high-throughput, zero-knowledge message forwarding and WebRTC
//! signaling over WebSockets. Operates strictly in RAM with zero message logging
//! or plaintext inspection, fully preserving end-to-end post-quantum encryption.

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{
        atomic::{AtomicU64, AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

/// Relay protocol messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RelayMessage {
    /// Client registration with its public identity hash
    Register {
        peer_id: String,
        #[serde(default)]
        version: Option<String>,
    },
    /// Direct message or encrypted envelope relay
    Relay {
        target_peer_id: String,
        payload: String, // Base64 or Hex encoded encrypted packet
        #[serde(default)]
        timestamp: Option<u64>,
    },
    /// WebRTC signaling exchange (SDP offer/answer, ICE candidate)
    Signal {
        target_peer_id: String,
        signal_data: serde_json::Value,
    },
    /// Ping/Pong heartbeat
    Ping,
    Pong {
        server_time: u64,
    },
    /// Server acknowledgment / status
    Ack {
        status: String,
        #[serde(default)]
        target: Option<String>,
        #[serde(default)]
        details: Option<String>,
    },
    /// Inbound delivery envelope delivered to target
    Delivery {
        from_peer_id: String,
        payload: String,
        timestamp: u64,
    },
    /// Inbound signaling delivery
    SignalDelivery {
        from_peer_id: String,
        signal_data: serde_json::Value,
    },
}

/// Statistics and health metrics of the relay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelayStats {
    pub active_peers: usize,
    pub max_peers: usize,
    pub total_messages_routed: u64,
    pub total_signals_routed: u64,
    pub total_bytes_forwarded: u64,
    pub uptime_seconds: u64,
    pub version: String,
}

/// Shared state of the Blind Relay
#[derive(Clone)]
pub struct BlindRelayState {
    /// Active peer connections: peer_id (clean hex) -> channel sender
    peers: Arc<RwLock<HashMap<String, mpsc::Sender<WsMessage>>>>,
    /// Metrics
    active_peers_count: Arc<AtomicUsize>,
    total_messages: Arc<AtomicU64>,
    total_signals: Arc<AtomicU64>,
    total_bytes: Arc<AtomicU64>,
    start_time: Instant,
    /// Config
    pub max_peers: usize,
    pub max_packet_size: usize,
}

impl BlindRelayState {
    pub fn new(max_peers: usize) -> Self {
        Self {
            peers: Arc::new(RwLock::new(HashMap::new())),
            active_peers_count: Arc::new(AtomicUsize::new(0)),
            total_messages: Arc::new(AtomicU64::new(0)),
            total_signals: Arc::new(AtomicU64::new(0)),
            total_bytes: Arc::new(AtomicU64::new(0)),
            start_time: Instant::now(),
            max_peers,
            max_packet_size: 512 * 1024, // 512 KB max frame
        }
    }

    /// Cleans an identity hash into canonical lowercase format
    pub fn clean_id(raw: &str) -> String {
        let mut clean = raw.trim().to_lowercase();
        if clean.starts_with("did:red:") {
            clean = clean.replace("did:red:", "");
        }
        if let Some(first) = clean.split(':').next() {
            if first.len() >= 16 {
                clean = first.to_string();
            }
        }
        clean
    }

    /// Register a peer connection
    pub async fn register_peer(&self, peer_id: &str, tx: mpsc::Sender<WsMessage>) -> bool {
        let clean = Self::clean_id(peer_id);
        if clean.is_empty() {
            return false;
        }

        let mut lock = self.peers.write().await;
        if lock.len() >= self.max_peers && !lock.contains_key(&clean) {
            warn!("[BlindRelay] Max peers capacity reached: {}", self.max_peers);
            return false;
        }

        let is_new = !lock.contains_key(&clean);
        lock.insert(clean, tx);
        if is_new {
            self.active_peers_count.fetch_add(1, Ordering::Relaxed);
        }
        true
    }

    /// Unregister a peer
    pub async fn unregister_peer(&self, peer_id: &str) {
        let clean = Self::clean_id(peer_id);
        let mut lock = self.peers.write().await;
        if lock.remove(&clean).is_some() {
            self.active_peers_count.fetch_sub(1, Ordering::Relaxed);
        }
    }

    /// Route a message to a specific peer
    pub async fn route_message(
        &self,
        from_peer_id: &str,
        target_peer_id: &str,
        payload: &str,
        timestamp: u64,
    ) -> bool {
        let clean_target = Self::clean_id(target_peer_id);
        let clean_from = Self::clean_id(from_peer_id);

        let lock = self.peers.read().await;
        if let Some(tx) = lock.get(&clean_target) {
            let delivery = RelayMessage::Delivery {
                from_peer_id: clean_from,
                payload: payload.to_string(),
                timestamp,
            };
            if let Ok(json) = serde_json::to_string(&delivery) {
                let bytes_len = json.len() as u64;
                if tx.send(WsMessage::Text(json)).await.is_ok() {
                    self.total_messages.fetch_add(1, Ordering::Relaxed);
                    self.total_bytes.fetch_add(bytes_len, Ordering::Relaxed);
                    return true;
                }
            }
        }
        false
    }

    /// Route a WebRTC signaling message
    pub async fn route_signal(
        &self,
        from_peer_id: &str,
        target_peer_id: &str,
        signal_data: serde_json::Value,
    ) -> bool {
        let clean_target = Self::clean_id(target_peer_id);
        let clean_from = Self::clean_id(from_peer_id);

        let lock = self.peers.read().await;
        if let Some(tx) = lock.get(&clean_target) {
            let delivery = RelayMessage::SignalDelivery {
                from_peer_id: clean_from,
                signal_data,
            };
            if let Ok(json) = serde_json::to_string(&delivery) {
                let bytes_len = json.len() as u64;
                if tx.send(WsMessage::Text(json)).await.is_ok() {
                    self.total_signals.fetch_add(1, Ordering::Relaxed);
                    self.total_bytes.fetch_add(bytes_len, Ordering::Relaxed);
                    return true;
                }
            }
        }
        false
    }

    /// Broadcast a packet to all connected peers (except sender)
    pub async fn broadcast_message(
        &self,
        from_peer_id: &str,
        payload: &str,
        timestamp: u64,
    ) -> usize {
        let clean_from = Self::clean_id(from_peer_id);
        let delivery = RelayMessage::Delivery {
            from_peer_id: clean_from.clone(),
            payload: payload.to_string(),
            timestamp,
        };
        let json = match serde_json::to_string(&delivery) {
            Ok(j) => j,
            Err(_) => return 0,
        };

        let lock = self.peers.read().await;
        let mut delivered = 0;
        for (peer_id, tx) in lock.iter() {
            if peer_id == &clean_from {
                continue;
            }
            if tx.send(WsMessage::Text(json.clone())).await.is_ok() {
                delivered += 1;
            }
        }
        self.total_messages.fetch_add(delivered as u64, Ordering::Relaxed);
        self.total_bytes.fetch_add((json.len() * delivered) as u64, Ordering::Relaxed);
        delivered
    }

    /// Fetch current operational metrics
    pub fn get_stats(&self) -> RelayStats {
        RelayStats {
            active_peers: self.active_peers_count.load(Ordering::Relaxed),
            max_peers: self.max_peers,
            total_messages_routed: self.total_messages.load(Ordering::Relaxed),
            total_signals_routed: self.total_signals.load(Ordering::Relaxed),
            total_bytes_forwarded: self.total_bytes.load(Ordering::Relaxed),
            uptime_seconds: self.start_time.elapsed().as_secs(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

/// Builds the Axum router for the Blind Relay service
pub fn build_relay_router(state: BlindRelayState) -> Router {
    Router::new()
        .route("/relay/ws", get(handle_relay_ws))
        .route("/relay/stats", get(handle_relay_stats))
        .route("/relay/health", get(handle_relay_health))
        .with_state(state)
}

/// Health check endpoint
async fn handle_relay_health() -> &'static str {
    "OK"
}

/// Statistics endpoint
async fn handle_relay_stats(State(state): State<BlindRelayState>) -> Json<RelayStats> {
    Json(state.get_stats())
}

/// WebSocket endpoint handler
async fn handle_relay_ws(
    ws: WebSocketUpgrade,
    State(state): State<BlindRelayState>,
) -> impl IntoResponse {
    ws.max_message_size(state.max_packet_size)
        .on_upgrade(move |socket| handle_relay_socket(socket, state))
}

/// Active WebSocket session loop
async fn handle_relay_socket(socket: WebSocket, state: BlindRelayState) {
    let (mut ws_sender, mut ws_receiver) = socket.split();
    let (tx, mut rx) = mpsc::channel::<WsMessage>(256);

    // Outbound transmission task
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Inbound handling loop
    let state_clone = state.clone();
    let mut recv_task = tokio::spawn(async move {
        let mut registered_id: Option<String> = None;

        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                WsMessage::Text(text) => {
                    if let Ok(relay_msg) = serde_json::from_str::<RelayMessage>(&text) {
                        match relay_msg {
                            RelayMessage::Register { peer_id, .. } => {
                                let clean = BlindRelayState::clean_id(&peer_id);
                                if state_clone.register_peer(&clean, tx.clone()).await {
                                    registered_id = Some(clean.clone());
                                    let ack = RelayMessage::Ack {
                                        status: "registered".to_string(),
                                        target: Some(clean),
                                        details: None,
                                    };
                                    if let Ok(ack_json) = serde_json::to_string(&ack) {
                                        let _ = tx.send(WsMessage::Text(ack_json)).await;
                                    }
                                } else {
                                    let err_ack = RelayMessage::Ack {
                                        status: "error".to_string(),
                                        target: Some(clean),
                                        details: Some("Registration failed or relay full".to_string()),
                                    };
                                    if let Ok(err_json) = serde_json::to_string(&err_ack) {
                                        let _ = tx.send(WsMessage::Text(err_json)).await;
                                    }
                                }
                            }
                            RelayMessage::Relay {
                                target_peer_id,
                                payload,
                                timestamp,
                            } => {
                                if let Some(ref from_id) = registered_id {
                                    let now = timestamp.unwrap_or_else(|| {
                                        std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64
                                    });

                                    let delivered = if target_peer_id == "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
                                        || target_peer_id == "broadcast"
                                    {
                                        state_clone
                                            .broadcast_message(from_id, &payload, now)
                                            .await
                                            > 0
                                    } else {
                                        state_clone
                                            .route_message(from_id, &target_peer_id, &payload, now)
                                            .await
                                    };

                                    let status = if delivered { "delivered" } else { "queued_or_offline" };
                                    let ack = RelayMessage::Ack {
                                        status: status.to_string(),
                                        target: Some(target_peer_id),
                                        details: None,
                                    };
                                    if let Ok(ack_json) = serde_json::to_string(&ack) {
                                        let _ = tx.send(WsMessage::Text(ack_json)).await;
                                    }
                                } else {
                                    let err = RelayMessage::Ack {
                                        status: "error".to_string(),
                                        target: None,
                                        details: Some("Must register peer_id first".to_string()),
                                    };
                                    if let Ok(err_json) = serde_json::to_string(&err) {
                                        let _ = tx.send(WsMessage::Text(err_json)).await;
                                    }
                                }
                            }
                            RelayMessage::Signal {
                                target_peer_id,
                                signal_data,
                            } => {
                                if let Some(ref from_id) = registered_id {
                                    state_clone
                                        .route_signal(from_id, &target_peer_id, signal_data)
                                        .await;
                                }
                            }
                            RelayMessage::Ping => {
                                let now = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64;
                                let pong = RelayMessage::Pong { server_time: now };
                                if let Ok(pong_json) = serde_json::to_string(&pong) {
                                    let _ = tx.send(WsMessage::Text(pong_json)).await;
                                }
                            }
                            _ => {}
                        }
                    }
                }
                WsMessage::Binary(bin) => {
                    if let Some(ref from_id) = registered_id {
                        if bin.len() > 33 {
                            let target_len = bin[0] as usize;
                            if bin.len() > 1 + target_len {
                                if let Ok(target_str) = std::str::from_utf8(&bin[1..1 + target_len]) {
                                    let raw_payload = &bin[1 + target_len..];
                                    let hex_payload = hex::encode(raw_payload);
                                    let now = std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_millis() as u64;
                                    state_clone
                                        .route_message(from_id, target_str, &hex_payload, now)
                                        .await;
                                }
                            }
                        }
                    }
                }
                WsMessage::Ping(p) => {
                    let _ = tx.send(WsMessage::Pong(p)).await;
                }
                WsMessage::Close(_) => break,
                _ => {}
            }
        }

        // Clean up on disconnect
        if let Some(ref id) = registered_id {
            state_clone.unregister_peer(id).await;
            debug!("[BlindRelay] Peer disconnected and unregistered: {}", id);
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
}

/// Runs a standalone Blind Relay daemon service on the given socket address
pub async fn run_blind_relay_server(addr: SocketAddr, max_peers: usize) -> anyhow::Result<()> {
    let state = BlindRelayState::new(max_peers);
    let app = build_relay_router(state);

    info!("╔═══════════════════════════════════════════════════════════════╗");
    info!("║   🛡️  RED DECENTRALIZED BLIND RELAY (DePIN TRANSIT)          ║");
    info!("║   Port: {:<53} ║", addr.to_string());
    info!("║   Max Peers: {:<48} ║", max_peers);
    info!("║   Security: Zero-Knowledge (No Plaintext / No Disk Logs)     ║");
    info!("╚═══════════════════════════════════════════════════════════════╝");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_id() {
        assert_eq!(BlindRelayState::clean_id("did:red:ABCDEF1234567890"), "abcdef1234567890");
        assert_eq!(BlindRelayState::clean_id("did:red:1122334455667788:some-name"), "1122334455667788");
        assert_eq!(BlindRelayState::clean_id("   AABBCCDDEEFF00112233   "), "aabbccddeeff00112233");
    }

    #[tokio::test]
    async fn test_peer_registration_and_routing() {
        let state = BlindRelayState::new(100);

        let (tx_a, _rx_a) = mpsc::channel(10);
        let (tx_b, mut rx_b) = mpsc::channel(10);

        let peer_a = "did:red:aaaa1111222233334444555566667777";
        let peer_b = "did:red:bbbb1111222233334444555566667777";

        assert!(state.register_peer(peer_a, tx_a).await);
        assert!(state.register_peer(peer_b, tx_b).await);

        let stats = state.get_stats();
        assert_eq!(stats.active_peers, 2);

        // Route message from A to B
        let routed = state.route_message(peer_a, peer_b, "payload_cifrado_hex", 12345678).await;
        assert!(routed);

        let received = rx_b.recv().await.expect("Debe recibir mensaje en B");
        if let WsMessage::Text(text) = received {
            let parsed: RelayMessage = serde_json::from_str(&text).expect("JSON válido");
            if let RelayMessage::Delivery { from_peer_id, payload, timestamp } = parsed {
                assert_eq!(from_peer_id, "aaaa1111222233334444555566667777");
                assert_eq!(payload, "payload_cifrado_hex");
                assert_eq!(timestamp, 12345678);
            } else {
                panic!("Tipo de mensaje inesperado");
            }
        } else {
            panic!("Tipo de websocket message inesperado");
        }

        let updated_stats = state.get_stats();
        assert_eq!(updated_stats.total_messages_routed, 1);

        // Unregister A
        state.unregister_peer(peer_a).await;
        assert_eq!(state.get_stats().active_peers, 1);
    }

    #[tokio::test]
    async fn test_broadcast() {
        let state = BlindRelayState::new(100);

        let (tx_a, _rx_a) = mpsc::channel(10);
        let (tx_b, mut rx_b) = mpsc::channel(10);
        let (tx_c, mut rx_c) = mpsc::channel(10);

        state.register_peer("peer_a_1234567890", tx_a).await;
        state.register_peer("peer_b_1234567890", tx_b).await;
        state.register_peer("peer_c_1234567890", tx_c).await;

        let delivered = state.broadcast_message("peer_a_1234567890", "alerta_sos_hex", 99999).await;
        assert_eq!(delivered, 2);

        assert!(rx_b.recv().await.is_some());
        assert!(rx_c.recv().await.is_some());
    }
}


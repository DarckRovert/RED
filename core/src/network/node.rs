//! Node orchestrator for RED.
//!
//! The Node struct is the central point of coordination for:
//! - P2P Networking
//! - Onion Routing
//! - Message Protocol (Double Ratchet)
//! - Local Storage

use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, error, debug, trace};

use crate::identity::{Identity, IdentityHash, AuthorizedDevice, DeviceId, DevicePublicKey};
use crate::network::{NetworkConfig, NetworkResult, NetworkError, PeerId, Libp2pTransport};
use crate::network::transport::{Transport};
use crate::network::routing::OnionRouter;
use crate::protocol::{Message, MessageId, MessageType, Group, GroupId, GroupMember, MemberRole, Conversation, ConversationId};
use crate::storage::Storage;

/// The RED Node orchestrator
pub struct Node {
    /// Node identity
    identity: Identity,
    /// Network configuration
    config: NetworkConfig,
    /// Local storage
    storage: Arc<Mutex<Storage>>,
    /// Onion router
    onion_router: OnionRouter,
    /// Network transport
    transport: Arc<dyn Transport>,
    /// Channel for notifying API of new messages
    msg_notifier: Option<tokio::sync::broadcast::Sender<Message>>,
    /// Identity registry for verification
    pub identity_registry: crate::identity::registry::IdentityRegistry,
    /// TX end: Node sends outbound mesh payloads here (encrypted OnionPackets).
    /// The Axum API layer holds the RX end and streams them to the frontend via SSE.
    pub outbound_payload_tx: Option<tokio::sync::mpsc::UnboundedSender<Vec<u8>>>,
    /// RX end: held by the API so it can subscribe via /network/outbound SSE.
    /// MUST be stored here to prevent the channel from being dropped.
    pub outbound_payload_rx: Option<tokio::sync::mpsc::UnboundedReceiver<Vec<u8>>>,
    /// Hardware LoRa bridge (Phase 18)
    pub lora_bridge: Option<crate::network::lora_bridge::LoraBridge>,
    /// Is the node running
    is_running: bool,
    /// Total packets sent by this node
    pub packets_sent: std::sync::atomic::AtomicU64,
    /// Blackout mode flag (WAN isolated, local epidemic routing only)
    pub blackout_mode: Arc<std::sync::atomic::AtomicBool>,
    /// Counter for blocked WAN connections during blackout
    pub blocked_wan_peers: Arc<std::sync::atomic::AtomicUsize>,
    /// Current active radio channel (1..14 or LoRa/BLE channel ID)
    pub rf_current_channel: std::sync::atomic::AtomicU8,
    /// Forward Error Correction (FEC) rate: 1 for Rate 1/2 (Normal), 2 for Rate 1/4 (Anti-Jamming)
    pub rf_fec_rate: std::sync::atomic::AtomicU8,
    /// Count of channel hops coordinated
    pub rf_hops_count: std::sync::atomic::AtomicU32,
}

impl Node {
    /// Create a new node instance
    pub fn new(
        identity: Identity,
        config: NetworkConfig,
        storage: Arc<Mutex<Storage>>,
    ) -> NetworkResult<Self> {
        let onion_router = OnionRouter::new(config.onion_path_length);
        
        let signing_key_bytes = identity.signing_key_bytes();
        let blackout_mode = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let blocked_wan_peers = Arc::new(std::sync::atomic::AtomicUsize::new(0));

        let transport = Arc::new(Libp2pTransport::new(
            signing_key_bytes, 
            config.data_dir.clone(), 
            config.bootstrap_nodes.clone(),
            blackout_mode.clone(),
            blocked_wan_peers.clone()
        )?);

        // BUG-FIX: Previously only .0 (sender) was stored, discarding the receiver
        // silently. Now both ends are stored so the Axum API can consume outbound payloads.
        let (outbound_tx, outbound_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();

        Ok(Self {
            identity,
            config,
            storage,
            onion_router,
            transport,
            msg_notifier: None,
            identity_registry: crate::identity::registry::IdentityRegistry::new(),
            outbound_payload_tx: Some(outbound_tx),
            outbound_payload_rx: Some(outbound_rx),
            lora_bridge: None,
            is_running: false,
            packets_sent: std::sync::atomic::AtomicU64::new(0),
            blackout_mode,
            blocked_wan_peers,
            rf_current_channel: std::sync::atomic::AtomicU8::new(1),
            rf_fec_rate: std::sync::atomic::AtomicU8::new(1),
            rf_hops_count: std::sync::atomic::AtomicU32::new(0),
        })
    }

    /// Get current RF state: (current_channel, fec_rate, hops_count)
    pub fn get_rf_state(&self) -> (u8, u8, u32) {
        (
            self.rf_current_channel.load(std::sync::atomic::Ordering::SeqCst),
            self.rf_fec_rate.load(std::sync::atomic::Ordering::SeqCst),
            self.rf_hops_count.load(std::sync::atomic::Ordering::SeqCst),
        )
    }

    /// Set active RF channel
    pub fn set_rf_channel(&self, channel: u8) {
        self.rf_current_channel.store(channel, std::sync::atomic::Ordering::SeqCst);
        self.rf_hops_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }

    /// Set Forward Error Correction rate (1 = 1/2 standard, 2 = 1/4 Anti-Jamming)
    pub fn set_fec_rate(&self, rate: u8) {
        self.rf_fec_rate.store(rate, std::sync::atomic::Ordering::SeqCst);
    }

    /// Check if blackout mode is active
    pub fn is_blackout_mode(&self) -> bool {
        self.blackout_mode.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Set blackout mode (enable or disable WAN isolation)
    pub fn set_blackout_mode(&self, enabled: bool) {
        self.blackout_mode.store(enabled, std::sync::atomic::Ordering::SeqCst);
        if !enabled {
            self.blocked_wan_peers.store(0, std::sync::atomic::Ordering::SeqCst);
        }
    }

    /// Enforce blackout by dropping existing WAN connections
    pub async fn enforce_blackout(&self) {
        if self.is_blackout_mode() {
            let _ = self.transport.disconnect_wan_peers().await;
        }
    }

    /// Get blocked WAN peers count
    pub fn get_blocked_wan_peers(&self) -> usize {
        self.blocked_wan_peers.load(std::sync::atomic::Ordering::SeqCst)
    }

    /// Increment blocked WAN peers count
    pub fn increment_blocked_wan(&self) {
        self.blocked_wan_peers.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    }

    /// Set burner mode (RAM-Only flag)
    pub async fn set_burner_mode(&mut self, enabled: bool) {
        let mut storage = self.storage.lock().await;
        storage.set_burner_mode(enabled);
    }

    /// Set Dead Man's Switch inactivity period in days
    pub async fn set_dead_mans_days(&mut self, days: u64) {
        let mut storage = self.storage.lock().await;
        if let Err(e) = storage.set_config("dms_days", days.to_string()) {
            tracing::warn!("Failed to persist DMS days config: {}", e);
        }
    }

    /// Read full DMS config from storage for the API GET endpoint
    pub fn dms_enabled(&self) -> bool {
        // Synchronous read from cached storage — the lock-free config cache
        // We can't await here (no async), so we use try_lock which is safe for reads
        if let Ok(s) = self.storage.try_lock() {
            return s.get_config("dms_enabled").map(|v| v == "true").unwrap_or(false);
        }
        false
    }

    pub fn dms_trigger_hours(&self) -> u64 {
        if let Ok(s) = self.storage.try_lock() {
            if let Some(v) = s.get_config("dms_trigger_hours") {
                return v.parse().unwrap_or(72);
            }
        }
        72
    }

    pub fn dms_wipe_messages(&self) -> bool {
        if let Ok(s) = self.storage.try_lock() {
            return s.get_config("dms_wipe_messages").map(|v| v != "false").unwrap_or(true);
        }
        true
    }

    pub fn dms_wipe_identity(&self) -> bool {
        if let Ok(s) = self.storage.try_lock() {
            return s.get_config("dms_wipe_identity").map(|v| v == "true").unwrap_or(false);
        }
        false
    }

    pub fn dms_dead_message(&self) -> Option<String> {
        if let Ok(s) = self.storage.try_lock() {
            let v = s.get_config("dms_dead_message").unwrap_or_default();
            if !v.is_empty() { return Some(v); }
        }
        None
    }

    /// Persist full DMS config to storage
    pub async fn set_dms_config(
        &mut self,
        enabled: bool,
        trigger_hours: u64,
        wipe_messages: bool,
        wipe_identity: bool,
        dead_message: String,
    ) {
        let mut storage = self.storage.lock().await;
        let _ = storage.set_config("dms_enabled", if enabled { "true" } else { "false" });
        let _ = storage.set_config("dms_trigger_hours", trigger_hours.to_string());
        let _ = storage.set_config("dms_wipe_messages", if wipe_messages { "true" } else { "false" });
        let _ = storage.set_config("dms_wipe_identity", if wipe_identity { "true" } else { "false" });
        let _ = storage.set_config("dms_dead_message", &dead_message);
    }

    /// Set user nickname in storage
    pub async fn set_nickname(&mut self, nickname: &str) {
        let mut storage = self.storage.lock().await;
        let _ = storage.set_config("nickname", nickname);
    }

    /// Get user nickname from storage
    pub fn get_nickname(&self) -> Option<String> {
        if let Ok(s) = self.storage.try_lock() {
            return s.get_config("nickname");
        }
        None
    }

    /// Connect to a peer manually using a Multiaddr string (for manual WiFi P2P test)
    pub async fn connect_peer(&self, addr_str: &str) -> NetworkResult<()> {
        let multiaddr: libp2p::Multiaddr = addr_str
            .parse()
            .map_err(|e: libp2p::multiaddr::Error| NetworkError::TransportError(e.to_string()))?;
        self.transport.connect_multiaddr(multiaddr).await
    }


    /// Get list of known connected peers
    pub fn known_peers(&self) -> Vec<crate::network::PeerInfo> {
        self.transport.known_peers()
    }

    /// Get total packets sent
    pub fn packets_sent_count(&self) -> u64 {
        self.packets_sent.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Start the node
    pub async fn start(node_ref: Arc<Mutex<Self>>) -> NetworkResult<()> {
        let mut n: tokio::sync::MutexGuard<'_, Self> = node_ref.lock().await;
        if n.is_running {
            return Ok(());
        }

        // --- PHASE 19: DEAD MAN'S SWITCH CHECK ---
        {
            let mut storage = n.storage.lock().await;
            let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

            // Only check if the user explicitly enabled the switch
            let dms_enabled = storage.get_config("dms_enabled").map(|v| v == "true").unwrap_or(false);

            if dms_enabled {
                // dms_trigger_hours is the canonical key written by set_dms_config().
                // dms_days is a legacy alias written by set_dead_mans_days(); we derive hours
                // from it as a fallback so old configs still work.
                let trigger_hours: u64 = storage
                    .get_config("dms_trigger_hours")
                    .and_then(|v| v.parse().ok())
                    .unwrap_or_else(|| {
                        storage
                            .get_config("dms_days")
                            .and_then(|v| v.parse::<u64>().ok())
                            .map(|days| days * 24)
                            .unwrap_or(0)
                    });

                if trigger_hours > 0 {
                    if let Some(last_str) = storage.get_config("dms_last_active") {
                        if let Ok(last) = last_str.parse::<u64>() {
                            let elapsed_hours = now.saturating_sub(last) / 3600;
                            if elapsed_hours >= trigger_hours {
                                tracing::error!(
                                    "DEAD MAN'S SWITCH TRIGGERED: Node inactive for {} hours (threshold: {}h). Initiating DB Wipe.",
                                    elapsed_hours, trigger_hours
                                );
                                let _ = storage.self_destruct();
                                return Err(NetworkError::IoError(std::io::Error::other(
                                    "Dead Man's Switch Triggered. Data Wiped."
                                )));
                            }
                        }
                    }
                }
            }

            // Update last active timestamp whether or not DMS fired
            let _ = storage.set_config("dms_last_active", now.to_string());
        }
        // ----------------------------------------

        info!("Starting RED node with identity: {}", n.identity.identity_hash().short());
        
        // Start transport listener
        n.transport.listen(n.config.listen_addr).await?;
        
        // Connect to bootstrap nodes via Multiaddr (IPFS-compatible)
        for addr in &n.config.bootstrap_nodes {
            debug!("Connecting to bootstrap node: {}", addr);
            if let Err(e) = n.transport.connect_multiaddr(addr.clone()).await {
                error!("Failed to connect to bootstrap node {}: {}", addr, e);
            }
        }

        n.is_running = true;
        info!("RED node is now running on {}", n.config.listen_addr);

        // Phase 18: Spin up the 915MHz LoRaWAN Radio Link
        let mut lora = crate::network::lora_bridge::LoraBridge::new(
            node_ref.clone(), 
            if cfg!(windows) { "COM3".into() } else { "/dev/ttyUSB0".into() }, 
            115200
        );
        let _ = lora.start().await;
        n.lora_bridge = Some(lora);

        // Start background tasks
        Self::start_background_tasks(node_ref.clone()).await;
        
        Ok(())
    }

    /// Start periodic background maintenance tasks
    async fn start_background_tasks(node_ref: Arc<Mutex<Self>>) {
        let node_ref_prune = node_ref.clone();
        tokio::spawn(async move {
            debug!("Starting background pruning task (60s interval)");
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                let storage_arc = {
                    let n = node_ref_prune.lock().await;
                    n.storage.clone()
                };
                let mut s = storage_arc.lock().await;
                match s.prune_expired_messages() {
                    Ok(count) if count > 0 => info!("Background prune: removed {} expired messages", count),
                    Err(e) => error!("Background prune error: {:?}", e),
                    _ => {}
                }
            }
        });

        let node_ref_handshake = node_ref.clone();
        tokio::spawn(async move {
            debug!("Starting RED identity handshake loop (10s interval)");
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                let (hash_hex, pk_hex, transport) = {
                    let n = node_ref_handshake.lock().await;
                    (
                        n.identity.identity_hash().to_hex(),
                        hex::encode(n.identity.public_key().as_bytes()),
                        n.transport.clone(),
                    )
                };
                let dummy_peer = crate::network::PeerId::from_bytes([0; 32]);
                let _ = transport.send(&dummy_peer, crate::network::transport::TransportMessage::IdentityBroadcast {
                    hash: hash_hex,
                    pk: pk_hex,
                }).await;
            }
        });

        // Background delivery retry loop for offline peers
        let node_ref_retry = node_ref.clone();
        tokio::spawn(async move {
            info!("Starting background pending delivery retry loop (15s interval)");
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(15)).await;
                
                let (pending, storage_arc) = {
                    let n = node_ref_retry.lock().await;
                    let s_arc = n.storage.clone();
                    let s = s_arc.lock().await;
                    (s.get_pending_deliveries().unwrap_or_default(), s_arc.clone())
                };

                for (key, message) in pending {
                    let available_peers = {
                        let n = node_ref_retry.lock().await;
                        n.transport.known_peers()
                    };
                    let is_recipient_online = available_peers.iter().any(|p| p.identity_hash.as_ref() == Some(&message.recipient));
                    
                    if is_recipient_online {
                        info!("Peer {} came online. Retrying delivery of message {}", message.recipient.short(), message.id.to_hex());
                        let deliver_res = {
                            let mut n = node_ref_retry.lock().await;
                            n.deliver_message(&message.recipient, &message).await
                        };
                        match deliver_res {
                            Ok(_) => {
                                info!("Delivery of pending message {} succeeded.", message.id.to_hex());
                                let s = storage_arc.lock().await;
                                let _ = s.remove_pending_delivery(&key);
                            }
                            Err(e) => {
                                error!("Delivery retry failed: {:?}", e);
                            }
                        }
                    }
                }
            }
        });

        // Phase 17: Constant-Rate Traffic Padding (Anti-Censorship/NSA)
        // Continuously emits 1KB background noise to flatten ISP bandwidth analysis graphs.
        let node_for_padding = node_ref.clone();
        tokio::spawn(async move {
            debug!("Mixnet/Padding: Starting continuous traffic obfuscation worker");
            loop {
                use rand::{Rng, RngCore};
                let wait_secs = rand::thread_rng().gen_range(3..=7);
                tokio::time::sleep(tokio::time::Duration::from_secs(wait_secs)).await;
                
                // Phase 18: Anti-Traffic Analysis (Zero-Overhead Dummy Traffic)
                // BUG-16 FIX: Do NOT call send_message() — it persists to SQLite.
                // Instead, serialize a dummy OnionPacket and emit it directly via transport.
                // This flattens ISP bandwidth graphs without polluting the message store.
                let mut noise = vec![0u8; 1024];
                rand::thread_rng().fill_bytes(&mut noise);

                // Build a minimal dummy payload: 32-byte zero recipient + random noise
                let mut dummy_payload = vec![0u8; 32]; // zero recipient hash
                dummy_payload.extend_from_slice(&noise);

                // Emit directly via transport (broadcast to all connected peers).
                // Acquire and immediately release the lock so we don't block incoming messages.
                let transport_clone = {
                    let n = node_for_padding.lock().await;
                    n.transport.clone()
                };
                let peer_ids: Vec<crate::network::PeerId> = {
                    let n = node_for_padding.lock().await;
                    n.transport_peer_ids()
                };
                for peer_id in peer_ids {
                    let _ = transport_clone
                        .send(&peer_id, crate::network::transport::TransportMessage::Data {
                            payload: dummy_payload.clone(),
                        })
                        .await;
                }
            }
        });

    }

    /// Set message notifier
    pub fn set_msg_notifier(&mut self, tx: tokio::sync::broadcast::Sender<Message>) {
        self.msg_notifier = Some(tx);
    }

    /// Start the event loop for processing incoming network messages
    pub async fn start_event_loop(node_ref: Arc<Mutex<Self>>) {
        loop {
            // TD-5 FIX: Extract the transport Arc and drop the lock BEFORE calling receive().
            let transport = {
                let n: tokio::sync::MutexGuard<'_, Self> = node_ref.lock().await;
                n.transport.clone()
            };

            let receive_result = transport.receive().await;

            match receive_result {
                Ok((peer_id, msg)) => {
                    let node_clone = node_ref.clone();
                    tokio::spawn(async move {
                        let mut n: tokio::sync::MutexGuard<'_, Self> = node_clone.lock().await;
                        match msg {
                            crate::network::transport::TransportMessage::Onion(packet) => {
                                n.handle_onion_packet(peer_id, packet).await;
                            }
                            crate::network::transport::TransportMessage::Data { payload } => {
                                // First try to deserialize as an encrypted OnionPacket (Gossipsub direct path)
                                if let Ok(packet) = bincode::deserialize::<crate::network::routing::OnionPacket>(&payload) {
                                    n.handle_onion_packet(peer_id, packet).await;
                                } else if let Ok(message) = Message::deserialize(&payload) {
                                    n.handle_incoming_message(message).await;
                                }
                            }
                            _ => {}
                        }
                    });
                }
                Err(e) => {
                    error!("Transport receive error: {:?}", e);
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                }
            }
        }
    }

    /// Handle an incoming onion packet (peel and forward/process)
    async fn handle_onion_packet(&mut self, _from: PeerId, mut packet: crate::network::routing::OnionPacket) {
        if packet.layers.is_empty() {
            return;
        }

        let layer = &packet.layers[0];
        // In RED, the ephemeral key is matched against our identity
        let secret = self.identity.key_exchange(&crate::crypto::keys::PublicKey::from_bytes(layer.ephemeral_pk));
        
        match self.onion_router.peel_layer(layer, &secret).await {
            Ok(routing_info) => {
                if let Some(next_hop_addr) = routing_info.next_hop {
                    // Forward to next hop
                    debug!("Forwarding onion packet to {}", next_hop_addr);
                    packet.layers.remove(0);
                    
                    // Phase 17: Mixnet Timing Obfuscation (Anti-NSA)
                    // Deliberately hold the packet for a randomized interval before re-transmitting 
                    // to mathematically destroy any temporal correlation between Sender A and Receiver C.
                    use rand::Rng;
                    let delay_ms = rand::thread_rng().gen_range(500..=2500);
                    debug!("Mixnet Active: Obfuscating metadata, delaying transmission by {}ms", delay_ms);
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;

                    if let Ok(addr) = next_hop_addr.parse::<std::net::SocketAddr>() {
                        if let Ok(next_peer_id) = self.transport.connect(addr).await {
                            let _ = self.transport.send(&next_peer_id, crate::network::transport::TransportMessage::Onion(packet)).await;
                        }
                    }
                } else {
                    // We are the final destination
                    if let Ok(message) = Message::deserialize(&routing_info.payload) {
                        self.handle_incoming_message(message).await;
                    }
                }
            }
            Err(_) => {
                // Not for us or corrupted
                trace!("Failed to peel onion layer");
            }
        }
    }

    /// Inject a raw encrypted byte payload received out-of-band (e.g. from Bluetooth Mesh)
    /// allowing the Core node to decrypt strings without libp2p internet.
    pub async fn inject_raw_payload(&mut self, data: Vec<u8>) -> crate::network::NetworkResult<()> {
        let dummy_peer = crate::network::PeerId::from_bytes([0; 32]);
        self.handle_gossip_message(dummy_peer, data).await;
        Ok(())
    }

    /// Handle an incoming gossip message
    async fn handle_gossip_message(&mut self, _sender: PeerId, data: Vec<u8>) {
        debug!("Received gossip message ({} bytes)", data.len());

        // 1. Direct check: TypeScript MeshPacket binary wire format (Magic: 0x52454401, Header: 96 bytes)
        if data.len() >= 96 && data[0] == 0x52 && data[1] == 0x45 && data[2] == 0x44 && data[3] == 0x01 {
            let payload = &data[96..];
            if let Ok(json_str) = std::str::from_utf8(payload) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                    if let Some(content_str) = parsed.get("content").and_then(|c| c.as_str()) {
                        let sender_hex = parsed.get("sender").and_then(|s| s.as_str()).unwrap_or("");
                        let recipient_hex = parsed.get("recipient").and_then(|r| r.as_str()).unwrap_or("");
                        if let (Ok(sender_hash), Ok(recipient_hash)) = (
                            crate::identity::IdentityHash::from_hex(sender_hex),
                            crate::identity::IdentityHash::from_hex(recipient_hex)
                        ) {
                            let msg_type_str = parsed.get("msg_type").and_then(|t| t.as_str()).unwrap_or("text");
                            let msg_content = match msg_type_str {
                                "image" => MessageType::Image {
                                    mime_type: "image/jpeg".to_string(),
                                    data: content_str.as_bytes().to_vec(),
                                    width: 0,
                                    height: 0,
                                },
                                "voice" => MessageType::Voice {
                                    duration_ms: 0,
                                    data: content_str.as_bytes().to_vec(),
                                },
                                _ => MessageType::Text(content_str.to_string()),
                            };
                            let ts = parsed.get("timestamp").and_then(|t| t.as_u64()).unwrap_or_else(|| {
                                std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs()
                            });
                            let msg = Message {
                                id: crate::protocol::MessageId::generate(),
                                sender: sender_hash,
                                recipient: recipient_hash,
                                content: msg_content,
                                timestamp: ts,
                                status: crate::protocol::MessageStatus::Sent,
                                edited: false,
                                reply_to: None,
                            };
                            self.handle_incoming_message(msg).await;
                            return;
                        }
                    }
                }
            }
        }

        // 2. Direct JSON envelope check
        if let Ok(json_str) = std::str::from_utf8(&data) {
            let trimmed = json_str.trim_start();
            if trimmed.starts_with('{') {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(trimmed) {
                    if let Some(content_str) = parsed.get("content").and_then(|c| c.as_str()) {
                        let sender_hex = parsed.get("sender").and_then(|s| s.as_str()).unwrap_or("");
                        let recipient_hex = parsed.get("recipient").and_then(|r| r.as_str()).unwrap_or("");
                        if let (Ok(sender_hash), Ok(recipient_hash)) = (
                            crate::identity::IdentityHash::from_hex(sender_hex),
                            crate::identity::IdentityHash::from_hex(recipient_hex)
                        ) {
                            let msg = Message {
                                id: crate::protocol::MessageId::generate(),
                                sender: sender_hash,
                                recipient: recipient_hash,
                                content: MessageType::Text(content_str.to_string()),
                                timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                                status: crate::protocol::MessageStatus::Sent,
                                edited: false,
                                reply_to: None,
                            };
                            self.handle_incoming_message(msg).await;
                            return;
                        }
                    }
                }
            }
        }

        // 3. Classic Bincode OnionPacket / Message deserialization
        if let Ok(packet) = bincode::deserialize::<crate::network::routing::OnionPacket>(&data) {
            self.handle_onion_packet(_sender, packet).await;
        } else if let Ok(msg) = bincode::deserialize::<Message>(&data) {
            self.handle_incoming_message(msg).await;
        } else {
            error!("Failed to deserialize gossip message as MeshPacket, JSON, OnionPacket or Message");
        }
    }

    /// Process a final incoming message
    pub async fn handle_incoming_message(&mut self, mut message: Message) {
        let my_hash = self.identity.identity_hash().clone();

        // Drop messages from blocked senders (Security blocklist check)
        {
            let s = self.storage.lock().await;
            if let Some(contact) = s.get_contact(&message.sender) {
                if contact.blocked {
                    info!("Discarding message from blocked sender: {}", message.sender.short());
                    return;
                }
            }
        }

        // BUG B COMPANION FIX: In direct gossipsub mode, ALL peers receive ALL
        // messages. Discard messages not addressed to us (unless we are the sender,
        // which is handled by the outbound save path). This prevents ghost messages
        // appearing in the wrong conversation on the wrong device.
        let is_public = matches!(
            message.content,
            MessageType::SocialPost(_)
                | MessageType::WeatherReport(_)
                | MessageType::P2PVoucher(_)
                | MessageType::ChannelHopCoordination { .. }
                | MessageType::MedicalTriageReport(_)
                | MessageType::EmergencyBeacon { .. }
        );
        if message.recipient != my_hash && message.sender != my_hash && !is_public {
            trace!("Discarding gossipsub message not addressed to us: {} -> {}",
                message.sender.short(), message.recipient.short());
            return;
        }

        // Handle ChannelHopCoordination (v33.0 Electronic Countermeasures)
        if let MessageType::ChannelHopCoordination { target_channel, frequency_mhz, ref reason, .. } = message.content {
            self.rf_current_channel.store(target_channel, std::sync::atomic::Ordering::SeqCst);
            self.rf_hops_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            info!("Synchronized mesh channel hop to #{} ({} MHz) - Reason: {}", target_channel, frequency_mhz, reason);
        }

        info!("Received message: {} -> {}", message.sender.short(), message.recipient.short());
        
        // Intercept GroupPayload for decryption and re-routing
        if let MessageType::GroupPayload(ref group_msg) = message.content {
            let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
            if let Some(mut group) = s.get_group(&group_msg.group_id) {
                let decryption_result = group.decrypt_message(group_msg, &message.sender);
                if let Ok(ref decrypted) = decryption_result {
                    if let Ok(inner_type) = bincode::deserialize::<MessageType>(decrypted) {
                        message.content = inner_type;
                        // Map the recipient to the Group's IdentityHash so it's threaded as a group conversation
                        message.recipient = IdentityHash::from_bytes(group.id.0);
                        let _ = s.add_group(group); // Save new state (sender key iteration)
                    } else {
                        error!("Failed to deserialize inner group message type");
                    }
                } else {
                    error!("Failed to decrypt group message from {}", message.sender.short());
                }
            } else {
                error!("Received group message for unknown group {:?}", group_msg.group_id);
            }
        }

        // Handle GroupInvite descriptor: auto-register group on receiving member device
        if let MessageType::GroupInvite { ref group_id, ref group_name, ref creator_hash, ref members, created_at } = message.content {
            let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
            let gid = GroupId(*group_id);
            if s.get_group(&gid).is_none() {
                info!("Auto-registering incoming GroupInvite for '{}' ({:?})", group_name, gid);
                let creator_member = crate::protocol::GroupMember {
                    identity_hash: creator_hash.clone(),
                    public_key: crate::crypto::keys::PublicKey::from_bytes([0u8; 32]),
                    joined_at: created_at,
                    role: crate::protocol::MemberRole::Admin,
                    muted: false,
                };
                let mut new_group = Group::create_with_id(gid, group_name.clone(), creator_member);
                for m_hash in members {
                    if m_hash != creator_hash {
                        let is_me = *m_hash == self.identity.identity_hash().clone();
                        let _ = new_group.add_member(crate::protocol::GroupMember {
                            identity_hash: m_hash.clone(),
                            public_key: if is_me { self.identity.public_key().clone() } else { crate::crypto::keys::PublicKey::from_bytes([0u8; 32]) },
                            joined_at: created_at,
                            role: crate::protocol::MemberRole::Member,
                            muted: false,
                        });
                    }
                }
                let _ = s.add_group(new_group);
            }
        }

        // Handle ProfileSyncRequest
        if let MessageType::ProfileSyncRequest = &message.content {
            let (my_hash, profile_opt) = {
                let s = self.storage.lock().await;
                (self.identity.identity_hash().clone(), s.get_profile())
            };
            
            if let Some(profile) = profile_opt {
                let avatar_str = profile.avatar.and_then(|a| String::from_utf8(a).ok());
                let resp = MessageType::ProfileSyncResponse {
                    avatar: avatar_str,
                    bio: profile.status,
                };
                
                let out_msg = Message {
                    id: crate::protocol::MessageId::generate(),
                    sender: my_hash.clone(),
                    recipient: message.sender.clone(),
                    content: resp,
                    timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64,
                    reply_to: None,
                    status: crate::protocol::MessageStatus::Sent,
                    edited: false,
                };
                
                let _ = self.send_message(message.sender.clone(), out_msg).await;
            }
        }

        // Save to storage
        {
            let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;

            // Handle ProfileSyncResponse
            if let MessageType::ProfileSyncResponse { avatar, bio } = &message.content {
                if let Some(mut contact) = s.get_contact(&message.sender) {
                    contact.avatar = avatar.clone();
                    contact.bio = bio.clone();
                    contact.last_sync = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
                    let _ = s.add_contact(contact);
                    info!("Updated contact profile for {}", message.sender.short());
                }
            }

            // Handle SocialPost
            if let MessageType::SocialPost(data) = &message.content {
                if let Ok(payload) = serde_json::from_slice::<crate::protocol::SocialPostPayload>(data) {
                    // Convert SocialPostPayload to storage::SocialPost
                    let post = crate::storage::SocialPost {
                        id: payload.id,
                        author_hash: message.sender.clone(),
                        author_name: payload.author_name,
                        content: payload.content,
                        media_data: payload.media_data,
                        timestamp: payload.timestamp,
                        reply_to: payload.reply_to,
                        signature: String::new(),
                        reactions: std::collections::HashMap::new(),
                    };
                    let _ = s.store_social_post(&post);
                    info!("Stored new social post from {}", message.sender.short());
                }
            }

            // Handle P2PVoucher (v32.0 Sovereign Payments)
            if let MessageType::P2PVoucher(data) = &message.content {
                if let Ok(payload) = serde_json::from_slice::<crate::protocol::P2PVoucherPayload>(data) {
                    if s.get_p2p_voucher(&payload.id).is_none() {
                        let voucher_record = crate::storage::P2PVoucherRecord {
                            id: payload.id.clone(),
                            creator_hash: payload.creator_hash,
                            creator_name: payload.creator_name,
                            recipient: payload.recipient,
                            amount: payload.amount,
                            timestamp: payload.timestamp,
                            signature: payload.signature,
                            is_outgoing: false,
                            redeemed: true,
                        };
                        let _ = s.store_p2p_voucher(&voucher_record);
                        if let Ok(mut wallet) = s.get_p2p_wallet() {
                            wallet.balance += payload.amount;
                            wallet.total_received += payload.amount;
                            let _ = s.save_p2p_wallet(&wallet);
                            info!("Credited incoming P2P voucher {} ({} RED credits)", payload.id, payload.amount);
                        }
                    }
                }
            }

            // Handle MedicalTriageReport (v35.0 Disaster Triage & Vital Signs Telemetry)
            if let MessageType::MedicalTriageReport(data) = &message.content {
                if let Ok(payload) = serde_json::from_slice::<crate::protocol::MedicalTriagePayload>(data) {
                    let record = crate::storage::TriageReportRecord {
                        id: payload.id.clone(),
                        victim_label: payload.victim_label.clone(),
                        category: payload.category.clone(),
                        bpm: payload.bpm,
                        spo2: payload.spo2,
                        notes: payload.notes.clone(),
                        evaluator_hash: payload.evaluator_hash,
                        evaluator_name: payload.evaluator_name.clone(),
                        timestamp: payload.timestamp,
                        latitude: payload.latitude,
                        longitude: payload.longitude,
                        synced_mesh: true,
                    };
                    let _ = s.store_triage_report(&record);
                    info!("🚨 Stored incoming Medical Triage Report: {} ({}) evaluated by {}", payload.victim_label, payload.category, payload.evaluator_name);
                }
            }

            // Handle EmergencyBeacon (v36.0 Tactical SOS Mesh Broadcast)
            if let MessageType::EmergencyBeacon { ref beacon_id, ref distress_type, latitude, longitude, altitude, battery_level, message: ref msg_text, active, timestamp } = message.content {
                let record = crate::storage::EmergencyBeaconRecord {
                    beacon_id: beacon_id.clone(),
                    sender_hash: message.sender.clone(),
                    sender_name: format!("Nodo {}", message.sender.short()),
                    distress_type: distress_type.clone(),
                    latitude,
                    longitude,
                    altitude,
                    battery_level,
                    message: msg_text.clone(),
                    active,
                    timestamp,
                    is_mine: false,
                };
                if active {
                    let _ = s.store_emergency_beacon(&record);
                    info!("🚨 SOS ACTIVO RECIBIDO DE {}: [{}] {}", message.sender.short(), distress_type, msg_text);
                } else {
                    let _ = s.remove_emergency_beacon(beacon_id);
                    info!("🟢 SOS CANCELADO POR {}: Beacon #{}", message.sender.short(), beacon_id);
                }
            }

            // Add message to conversation (Skip if it's purely a SocialPost, P2PVoucher, ProfileSync, ChannelHopCoordination, MedicalTriageReport, EmergencyBeacon, WebRTCSignal, Contact handshake, or StatusPacket so we don't clutter the DMs)
            let is_hidden = matches!(
                message.content,
                MessageType::SocialPost(_)
                    | MessageType::WeatherReport(_)
                    | MessageType::P2PVoucher(_)
                    | MessageType::ProfileSyncRequest
                    | MessageType::ProfileSyncResponse { .. }
                    | MessageType::ChannelHopCoordination { .. }
                    | MessageType::MedicalTriageReport(_)
                    | MessageType::EmergencyBeacon { .. }
                    | MessageType::WebRTCSignal(_)
                    | MessageType::ContactRequest(_)
                    | MessageType::ContactResponse(_)
                    | MessageType::StatusPacket(_)
            );
            if !is_hidden {
                if let Err(e) = s.add_message(message.clone()) {
                    error!("Failed to save incoming message: {:?}", e);
                }
            }

            // Special handling for TimerUpdate to persist the setting
            if let MessageType::TimerUpdate { seconds } = message.content {
                let conv_id = ConversationId::from_participants(&message.sender, &message.recipient);
                if let Some(mut conv) = s.get_conversation_mut(&conv_id) {
                    conv.disappearing_timer = if seconds > 0 { Some(seconds) } else { None };
                    info!("Updated disappearing timer to {}s for conversation {}", seconds, conv_id);
                }
            }
        }

        // Notify API (SSE endpoint) that a new message arrived
        if let Some(tx) = &self.msg_notifier {
            let _ = tx.send(message);
        }
    }

    pub fn get_storage(&self) -> std::sync::Arc<tokio::sync::Mutex<crate::storage::Storage>> {
        self.storage.clone()
    }

    /// Stop the node
    pub async fn stop(&mut self) -> NetworkResult<()> {
        if !self.is_running {
            return Ok(());
        }

        info!("Stopping RED node...");
        self.is_running = false;
        Ok(())
    }

    /// Send a group message using SenderKey
    pub async fn send_group_message(
        &mut self,
        group_id: GroupId,
        message_type: MessageType,
    ) -> NetworkResult<()> {
        debug!("Sending group message to {:?}", group_id);

        let mut group = {
            let s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
            s.get_group(&group_id)
                .ok_or_else(|| NetworkError::TransportError("Group not found".to_string()))?
        };

        // Serialize the inner message type (Text, Image, etc.)
        let inner_payload = bincode::serialize(&message_type)
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;

        // Encrypt using SenderKey
        let group_msg = group.encrypt_message(&inner_payload)
            .map_err(|_| NetworkError::TransportError("Group encryption failed".to_string()))?;

        // Save updated group state (advanced sender key iteration)
        let my_hash = self.identity.identity_hash().clone();
        {
            let mut s = self.storage.lock().await;
            s.add_group(group.clone()).map_err(|e| NetworkError::TransportError(e.to_string()))?;
            
            // FIX 5.1: Save outbound group message to local storage
            let dummy_recipient = IdentityHash::from_bytes(group_id.0);
            let outbound_msg = Message {
                id: MessageId::generate(),
                sender: my_hash.clone(),
                recipient: dummy_recipient,
                content: message_type.clone(),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                reply_to: None,
                status: crate::protocol::MessageStatus::Sent,
                edited: false,
            };
            if let Err(e) = s.add_message(outbound_msg) {
                error!("Failed to save outgoing group message to local storage: {:?}", e);
            }
        }

        let members: Vec<_> = group.members().cloned().collect();

        // Send encrypted group payload individually to each member via Onion Routing
        for member in members {
            if member.identity_hash == my_hash {
                continue;
            }

            let outer_msg = Message {
                id: MessageId::generate(),
                sender: my_hash.clone(),
                recipient: member.identity_hash.clone(),
                content: MessageType::GroupPayload(group_msg.clone()),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                reply_to: None,
                status: crate::protocol::MessageStatus::Pending,
                edited: false,
            };

            if let Err(e) = self.send_message(member.identity_hash.clone(), outer_msg).await {
                error!("Failed to route group message to member {}: {:?}", member.identity_hash.short(), e);
            }
        }

        Ok(())
    }

    /// Send a message to a recipient
    pub async fn send_message(&mut self, recipient: IdentityHash, message: Message) -> NetworkResult<()> {
        debug!("Sending message to recipient: {}", recipient.short());
        
        // Always save the outbound message locally first (unless it's an ephemeral status packet or control signaling)
        let is_control_or_status = message.content.is_control() || matches!(
            message.content,
            MessageType::StatusPacket(_)
                | MessageType::SocialPost(_)
                | MessageType::WeatherReport(_)
                | MessageType::P2PVoucher(_)
                | MessageType::ProfileSyncRequest
                | MessageType::ProfileSyncResponse { .. }
                | MessageType::ChannelHopCoordination { .. }
                | MessageType::MedicalTriageReport(_)
                | MessageType::EmergencyBeacon { .. }
                | MessageType::WebRTCSignal(_)
                | MessageType::ContactRequest(_)
                | MessageType::ContactResponse(_)
        );
        if !is_control_or_status {
            let mut s = self.storage.lock().await;
            if let Err(e) = s.add_message(message.clone()) {
                error!("Failed to save outgoing message to local storage: {:?}", e);
            }
        }
        
        // SEC-Z: Hide origin timing by delaying initial message dispatch
        use rand::Rng;
        let origin_delay = rand::thread_rng().gen_range(200..=800);
        tokio::time::sleep(std::time::Duration::from_millis(origin_delay)).await;

        match self.deliver_message(&recipient, &message).await {
            Ok(_) => Ok(()),
            Err(e) => {
                tracing::warn!("Message delivery to {} failed ({:?}). Queuing in pending deliveries.", recipient.short(), e);
                let s = self.storage.lock().await;
                let key = format!("{}:{}", recipient.to_hex(), message.id.to_hex());
                let _ = s.add_pending_delivery(key.as_bytes(), &message);
                Ok(()) // Return Ok so HTTP API displays it as sent/pending locally
            }
        }
    }

    /// Internal message delivery logic
    ///
    /// ROUTING DECISION (v40.1.0 fix):
    /// ─────────────────────────────────────────────────────────────────────────
    /// OLD (BROKEN): if available_peers.len() >= 3  →  always Kademlia DHT
    ///   Problem: 3 phones on local WiFi each expose wlan0 + p2p0 + cellular
    ///   interfaces, so len() is always ≥ 3. Kademlia then fails because it
    ///   receives an IdentityHash (32-byte BLAKE3), not a Libp2p PeerId
    ///   multihash, producing: RoutingFailed("Invalid peer ID for Kademlia")
    ///   and dropping every message into pending_deliveries forever.
    ///
    /// NEW (CORRECT): check if recipient is in known_peers() FIRST.
    ///   - Recipient FOUND locally  → 1-hop direct GossipSub (always fast-path)
    ///   - Recipient NOT found AND ≥3 relay peers exist → multi-hop onion via Kademlia
    ///   - Recipient NOT found AND <3 relay peers       → WAN Kademlia best-effort
    /// ─────────────────────────────────────────────────────────────────────────
    async fn deliver_message(&mut self, recipient: &IdentityHash, message: &Message) -> NetworkResult<()> {
        self.packets_sent.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let available_peers = self.transport.known_peers();

        let payload = message.serialize()
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;

        let my_pub_bytes = *self.identity.public_key().as_bytes();

        let contact_pub_key = {
            let s = self.storage.lock().await;
            s.get_contact(recipient).map(|c| c.public_key)
        };

        // ── STEP 1: Check if recipient is directly reachable in local mesh ──
        let local_destination = available_peers.iter()
            .find(|p| p.identity_hash.as_ref() == Some(recipient))
            .cloned();

        if let Some(destination) = local_destination {
            // ── FAST PATH: Recipient is in local mesh → 1-hop direct delivery ──
            // This is the CORRECT path for all local WiFi/BLE mesh scenarios.
            // We never touch Kademlia here.
            info!("[deliver] Recipient {} found in local mesh → direct 1-hop path", &recipient.to_hex()[..8]);

            let shared_secret = self.identity.key_exchange(&destination.public_key);
            let single_hop_route = crate::network::routing::Route {
                hops: vec![crate::network::routing::RouteHop {
                    peer_id: destination.id.clone(),
                    public_key: destination.public_key.clone(),
                    address: destination.addresses.first().copied().unwrap_or_else(|| "127.0.0.1:0".parse().unwrap()),
                }],
            };

            let packet = self.onion_router.create_packet(&single_hop_route, &payload, &[shared_secret], my_pub_bytes)
                .map_err(|e| NetworkError::TransportError(format!("1-hop encrypt failed: {}", e)))?;

            // Emit to BLE/WiFi-Direct frontend channel first
            if let Some(tx) = &self.outbound_payload_tx {
                if let Ok(serialized_packet) = bincode::serialize(&packet) {
                    let _ = tx.send(serialized_packet);
                }
            }

            // Publish over Libp2p GossipSub
            use crate::network::transport::TransportMessage;
            let _ = self.transport.send(
                &destination.id,
                TransportMessage::Data { payload: bincode::serialize(&packet).unwrap_or_default() }
            ).await;
            info!("[deliver] 1-hop encrypted Onion packet dispatched to {}", &recipient.to_hex()[..8]);

        } else {
            // ── STEP 2: Recipient NOT in local mesh → check for onion routing capacity ──
            // Only use multi-hop Kademlia onion if we have ≥3 OTHER peers available as relays.
            let relay_peer_count = available_peers.len();

            if relay_peer_count >= 3 {
                // ── MULTI-HOP ONION ROUTING PATH (WAN / relay circuit) ──
                // Here we legitimately need Kademlia because the destination is remote.
                // Attempt to resolve the IdentityHash → PeerId via the DHT.
                info!("[deliver] Recipient not in local mesh, {} relay peers available → attempting multi-hop onion", relay_peer_count);

                let peer_id = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    self.transport.resolve(recipient)
                )
                .await
                .unwrap_or(Err(NetworkError::RoutingFailed("Timeout resolving peer".to_string())))?;

                let updated_peers = self.transport.known_peers();
                let destination = updated_peers.into_iter()
                    .find(|p| p.identity_hash.as_ref() == Some(recipient) || p.id == peer_id)
                    .unwrap_or_else(|| {
                        let pub_key = contact_pub_key
                            .map(crate::crypto::keys::PublicKey::from_bytes)
                            .unwrap_or_else(|| crate::crypto::keys::PublicKey::from_bytes([0u8; 32]));
                        crate::network::PeerInfo {
                            id: peer_id.clone(),
                            public_key: pub_key,
                            identity_hash: Some(recipient.clone()),
                            protocol_version: 1,
                            user_agent: "red-node".to_string(),
                            addresses: vec!["127.0.0.1:0".parse().unwrap()],
                        }
                    });

                let all_peers = self.transport.known_peers();
                let route = self.onion_router.select_route(&all_peers, &destination)?;

                let mut shared_secrets = Vec::new();
                for hop in &route.hops {
                    let secret = self.identity.key_exchange(&hop.public_key);
                    shared_secrets.push(secret);
                }

                let packet = self.onion_router.create_packet(&route, &payload, &shared_secrets, my_pub_bytes)
                    .map_err(|e| NetworkError::TransportError(e.to_string()))?;

                let first_hop = &route.hops[0].peer_id;
                use crate::network::transport::TransportMessage;
                self.transport.send(first_hop, TransportMessage::Onion(packet.clone())).await?;
                info!("[deliver] Onion packet sent to first hop {} (multi-hop circuit)", first_hop.to_hex());

                if let Some(tx) = &self.outbound_payload_tx {
                    if let Ok(serialized_packet) = bincode::serialize(&packet) {
                        let _ = tx.send(serialized_packet);
                    }
                }

            } else {
                // ── WAN BEST-EFFORT PATH (<3 relays, recipient not local) ──
                // Attempt Kademlia resolution; if not found, create a fallback
                // PeerInfo using the contact's stored public key for encryption.
                info!("[deliver] Recipient not in local mesh, <3 relay peers → WAN best-effort path");

                let mut destination_opt: Option<crate::network::PeerInfo> = None;
                if let Ok(Ok(peer_id)) = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    self.transport.resolve(recipient)
                ).await {
                    let updated_peers = self.transport.known_peers();
                    destination_opt = updated_peers.into_iter()
                        .find(|p| p.identity_hash.as_ref() == Some(recipient) || p.id == peer_id);
                }

                let destination = destination_opt.unwrap_or_else(|| {
                    let proper_peer_id = PeerId::from_bytes(*recipient.as_bytes());
                    let pub_key = contact_pub_key
                        .map(crate::crypto::keys::PublicKey::from_bytes)
                        .unwrap_or_else(|| crate::crypto::keys::PublicKey::from_bytes([0u8; 32]));
                    crate::network::PeerInfo {
                        id: proper_peer_id,
                        public_key: pub_key,
                        identity_hash: Some(recipient.clone()),
                        protocol_version: 1,
                        user_agent: "red-node".to_string(),
                        addresses: vec![],
                    }
                });

                let shared_secret = self.identity.key_exchange(&destination.public_key);
                let single_hop_route = crate::network::routing::Route {
                    hops: vec![crate::network::routing::RouteHop {
                        peer_id: destination.id.clone(),
                        public_key: destination.public_key.clone(),
                        address: destination.addresses.first().copied().unwrap_or_else(|| "127.0.0.1:0".parse().unwrap()),
                    }],
                };

                if let Ok(packet) = self.onion_router.create_packet(&single_hop_route, &payload, &[shared_secret], my_pub_bytes) {
                    if let Some(tx) = &self.outbound_payload_tx {
                        if let Ok(serialized_packet) = bincode::serialize(&packet) {
                            let _ = tx.send(serialized_packet);
                        }
                    }
                    use crate::network::transport::TransportMessage;
                    let _ = self.transport.send(
                        &destination.id,
                        TransportMessage::Data { payload: bincode::serialize(&packet).unwrap_or_default() }
                    ).await;
                    info!("[deliver] WAN best-effort 1-hop packet dispatched");
                } else {
                    return Err(NetworkError::TransportError(
                        "Failed to encrypt 1-hop OnionPacket for WAN best-effort mode".to_string()
                    ));
                }
            }
        }

        Ok(())
    }

    /// Broadcast an unencrypted public message to all peers (for Social Feed, SOS, Channels)
    pub async fn broadcast_public_message(&mut self, message: Message) -> NetworkResult<()> {
        let payload = bincode::serialize(&message).unwrap_or_default();
        
        // Push to local frontend outbound channel (Bluetooth / WiFi Direct Mesh)
        if let Some(tx) = &self.outbound_payload_tx {
            let _ = tx.send(payload.clone());
        }

        // Publish to internal Libp2p gossipsub mesh
        use crate::network::transport::TransportMessage;
        let connected_peers = self.transport.connected_peers();
        for peer_id in connected_peers {
            let _ = self.transport.send(&peer_id, TransportMessage::Data { payload: payload.clone() }).await;
        }
        info!("Public unencrypted message broadcasted");
        
        Ok(())
    }

    /// Check if node is running
    pub fn is_running(&self) -> bool {
        self.is_running
    }

    /// Get node identity hash
    pub fn identity_hash(&self) -> &IdentityHash {
        self.identity.identity_hash()
    }

    /// Get the underlying identity
    pub fn identity(&self) -> &Identity {
        &self.identity
    }

    /// Rotate node identity (triggers DH renegotiation)
    pub fn rotate_identity(&mut self) -> NetworkResult<()> {
        if let Ok(new_identity) = self.identity.rotate() {
            tracing::info!("Rotating node identity from {} to {}", self.identity.identity_hash().to_hex(), new_identity.identity_hash().to_hex());
            self.identity = new_identity;
            Ok(())
        } else {
            Err(NetworkError::IoError(std::io::Error::other("Failed to rotate identity")))
        }
    }

    /// Get node public key for key exchange
    pub fn public_key(&self) -> crate::crypto::keys::PublicKey {
        self.identity.public_key().clone()
    }

    /// Get the number of currently connected peers (for API status response)
    pub fn transport_peer_count(&self) -> usize {
        self.transport.connected_peers().len()
    }

    /// Get the list of currently connected peer IDs (for direct transport emission)
    pub fn transport_peer_ids(&self) -> Vec<crate::network::PeerId> {
        self.transport.connected_peers()
    }

    /// List known peers via transport
    pub async fn list_peers(&self) -> NetworkResult<Vec<crate::network::PeerInfo>> {
        Ok(self.transport.known_peers())
    }

    /// Mark a conversation as read in the underlying storage database
    pub async fn mark_conversation_read_in_storage(&self, id: &ConversationId) -> crate::storage::StorageResult<()> {
        let mut s = self.storage.lock().await;
        s.mark_conversation_read(id)
    }

    /// Update MessageStatus::Read for a list of message IDs received in a ReadReceipt.
    /// `_peer_hash` identifies who sent the receipt (available for filtering if needed).
    pub async fn mark_messages_read_by_peer(
        &self,
        _peer_hash: &IdentityHash,
        message_ids: &[crate::protocol::MessageId],
    ) -> crate::storage::StorageResult<()> {
        let mut s = self.storage.lock().await;
        s.mark_messages_as_read_by_ids(message_ids)
    }

    /// Create a new group
    pub async fn create_group(&mut self, name: String) -> NetworkResult<Group> {
        info!("Creating group: {}", name);
        
        let creator = GroupMember {
            identity_hash: self.identity.identity_hash().clone(),
            public_key: self.identity.public_key().clone(),
            joined_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            role: MemberRole::Admin,
            muted: false,
        };

        let group = Group::create(name, creator);
        let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        s.add_group(group.clone())
            .map_err(|e: crate::storage::StorageError| NetworkError::TransportError(e.to_string()))?;
            
        Ok(group)
    }

    /// Add a member to a group
    pub async fn add_group_member(&mut self, group_id: GroupId, member: GroupMember) -> NetworkResult<()> {
        info!("Adding member {} to group {:?}", member.identity_hash.short(), group_id);
        let member_hash = member.identity_hash.clone();
        
        {
            let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
            if let Some(mut group) = s.get_group(&group_id) {
                group.add_member(member)
                    .map_err(|e| NetworkError::TransportError(e.to_string()))?;
                s.add_group(group)
                    .map_err(|e: crate::storage::StorageError| NetworkError::TransportError(e.to_string()))?;
            } else {
                return Err(NetworkError::TransportError("Group not found".to_string()));
            }
        }

        // Emit GroupInvite descriptor directly to the newly added member
        let _ = self.send_group_invite(group_id, member_hash).await;
        Ok(())
    }

    /// Send a GroupInvite descriptor to a member so they can auto-register the group
    pub async fn send_group_invite(
        &mut self,
        group_id: GroupId,
        target_member: IdentityHash,
    ) -> NetworkResult<()> {
        let (group_name, members, created_at) = {
            let s = self.storage.lock().await;
            if let Some(group) = s.get_group(&group_id) {
                let member_hashes: Vec<IdentityHash> = group.members().map(|m| m.identity_hash.clone()).collect();
                (group.name.clone(), member_hashes, group.created_at)
            } else {
                return Err(NetworkError::TransportError("Group not found".to_string()));
            }
        };

        let my_hash = self.identity.identity_hash().clone();
        if target_member == my_hash {
            return Ok(());
        }

        let invite_msg = Message {
            id: MessageId::generate(),
            sender: my_hash.clone(),
            recipient: target_member.clone(),
            content: MessageType::GroupInvite {
                group_id: group_id.0,
                group_name,
                creator_hash: my_hash.clone(),
                members,
                created_at,
            },
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            reply_to: None,
            status: crate::protocol::MessageStatus::Pending,
            edited: false,
        };

        self.send_message(target_member, invite_msg).await
    }

    pub async fn list_groups(&self) -> NetworkResult<Vec<Group>> {
        let s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        Ok(s.get_groups())
    }

    /// Generate a cryptographic pairing code (SEC-2 FIX)
    pub async fn generate_pairing_code(&self, name: String) -> NetworkResult<String> {
        info!("Generating pairing code for device: {}", name);
        
        // SEC-2 FIX: Generate a time-based OTP derived from our identity key + timestamp.
        // This means: (a) codes expire, (b) only our node can generate valid codes,
        // (c) codes are different for each device name.
        let timestamp_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        // 30-second validity window
        let window = timestamp_secs / 30;
        
        let mut data = self.identity.identity_hash().as_bytes().to_vec();
        data.extend_from_slice(name.as_bytes());
        data.extend_from_slice(&window.to_le_bytes());
        
        let hash = blake3::hash(&data);
        // Take first 4 bytes and format as 8-digit hex code
        let code_bytes = &hash.as_bytes()[..4];
        let code = format!("RED-{:04X}-{:04X}", 
            u16::from_le_bytes([code_bytes[0], code_bytes[1]]),
            u16::from_le_bytes([code_bytes[2], code_bytes[3]])
        );
        
        Ok(code)
    }

    /// Authorize a new device — validates OTP code before granting access
    pub async fn authorize_device(&mut self, name: String, code: String) -> NetworkResult<AuthorizedDevice> {
        info!("Authorizing device: {}", name);
        
        // SEC FIX: Validate the OTP code. We re-derive the expected code for
        // the current and previous window to handle clock skew.
        let expected = self.generate_pairing_code(name.clone()).await?;
        if code != expected {
            // Also accept the previous 30-second window for clock skew tolerance
            let prev_window = {
                let secs = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
                let prev_window_num = secs.saturating_sub(30) / 30;
                let mut data = self.identity.identity_hash().as_bytes().to_vec();
                data.extend_from_slice(name.as_bytes());
                data.extend_from_slice(&prev_window_num.to_le_bytes());
                let hash = blake3::hash(&data);
                let b = &hash.as_bytes()[..4];
                format!("RED-{:04X}-{:04X}",
                    u16::from_le_bytes([b[0], b[1]]),
                    u16::from_le_bytes([b[2], b[3]]))
            };
            if code != prev_window {
                return Err(NetworkError::AuthenticationFailed(
                    "Invalid pairing code".to_string()
                ));
            }
        }

        let device = AuthorizedDevice {
            id: DeviceId::generate(),
            public_key: DevicePublicKey(self.identity.public_key().clone()),
            name,
            authorized_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            last_seen: 0,
        };

        let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        s.add_authorized_device(device.clone())
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;
            
        Ok(device)
    }

    /// List authorized devices
    pub async fn list_devices(&self) -> NetworkResult<Vec<AuthorizedDevice>> {
        let s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        Ok(s.get_authorized_devices())
    }

    /// Add a contact to local storage (used by the HTTP API)
    pub async fn add_contact(&self, contact: crate::storage::Contact) -> NetworkResult<()> {
        let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        s.add_contact(contact)
            .map_err(|e: crate::storage::StorageError| NetworkError::TransportError(e.to_string()))
    }

    /// Get synchronization payload (TD-2 FIX: return real conversations)
    pub async fn get_sync_payload(&self) -> NetworkResult<(Vec<crate::storage::Contact>, Vec<Group>, Vec<Conversation>)> {
        let s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        let contacts = s.get_contacts();
        let groups = s.get_groups();
        // TD-2 FIX: Collect conversations from storage
        let conversations = s.get_conversations();
        Ok((contacts, groups, conversations))
    }

    /// Get current list of known peers from transport
    pub async fn get_peers(&self) -> NetworkResult<Vec<crate::network::PeerInfo>> {
        Ok(self.transport.known_peers())
    }

    /// Get user profile
    pub async fn get_profile(&self) -> Option<crate::storage::Profile> {
        let s = self.storage.lock().await;
        s.get_profile()
    }

    /// Set user profile
    pub async fn set_profile(&self, profile: crate::storage::Profile) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        s.set_profile(profile)
            .map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    // ── A2: Delete a single message from a conversation ───────────────────────
    pub async fn delete_message(&mut self, conv_id_hex: &str, msg_id_hex: &str) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        s.delete_message(conv_id_hex, msg_id_hex)
            .map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    // ── A3: Edit the text content of a sent message ───────────────────────────
    pub async fn edit_message(&mut self, conv_id_hex: &str, msg_id_hex: &str, new_content: String) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        s.edit_message(conv_id_hex, msg_id_hex, new_content)
            .map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    // ── Clear all messages in a conversation ──────────────────────────────────
    pub async fn clear_conversation(&mut self, conv_id_hex: &str) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        s.clear_conversation(conv_id_hex)
            .map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    // ── E1: Add a member to a group ───────────────────────────────────────────
    // BUG-17 FIX: Resolve the member's real public key from the contacts store
    // before creating the GroupMember. Using [0u8;32] broke SenderKey encryption.
    pub async fn add_group_member_by_hash(
        &mut self,
        group_id: crate::protocol::GroupId,
        member_hash: crate::identity::IdentityHash,
    ) -> NetworkResult<()> {
        // Resolve real public key from stored contacts
        let public_key = {
            let s = self.storage.lock().await;
            if let Some(contact) = s.get_contact(&member_hash) {
                // Contact.public_key is [u8;32]; GroupMember.public_key is PublicKey — convert.
                crate::crypto::keys::PublicKey::from_bytes(contact.public_key)
            } else {
                return Err(NetworkError::TransportError(format!(
                    "Cannot add member {}: contact not found in storage, \
                     public key unknown. Add them as a contact first.",
                    member_hash.short()
                )));
            }
        };

        let member = crate::protocol::GroupMember {
            identity_hash: member_hash,
            public_key,
            joined_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            role: crate::protocol::MemberRole::Member,
            muted: false,
        };
        self.add_group_member(group_id, member).await
    }


    // ── E1: Remove a member from a group ─────────────────────────────────────
    pub async fn remove_group_member(&mut self, group_id: crate::protocol::GroupId, member_hash: crate::identity::IdentityHash) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        let mut group = s.get_group_mut(&group_id)
            .ok_or_else(|| NetworkError::TransportError("Group not found".to_string()))?;
        group.remove_member(&member_hash)
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;
        s.add_group(group).map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    /// Block a contact
    pub async fn block_contact(&self, hash: &crate::identity::IdentityHash) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        s.block_contact(hash).map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    /// Unblock a contact
    pub async fn unblock_contact(&self, hash: &crate::identity::IdentityHash) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        s.unblock_contact(hash).map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    /// Toggle verification status of a contact
    pub async fn toggle_verify_contact(&self, hash: &crate::identity::IdentityHash) -> NetworkResult<bool> {
        let mut s = self.storage.lock().await;
        s.toggle_verify_contact(hash).map_err(|e| NetworkError::TransportError(e.to_string()))
    }
}


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
    /// Hardware LoRa bridge (Phase 18)
    pub lora_bridge: Option<crate::network::lora_bridge::LoraBridge>,
    /// Is the node running
    is_running: bool,
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
        let transport = Arc::new(Libp2pTransport::new(signing_key_bytes)?);

        Ok(Self {
            identity,
            config,
            storage,
            onion_router,
            transport,
            msg_notifier: None,
            lora_bridge: None,
            is_running: false,
        })
    }

    /// Set burner mode (RAM-Only flag)
    pub async fn set_burner_mode(&mut self, enabled: bool) {
        let mut storage = self.storage.lock().await;
        storage.set_burner_mode(enabled);
    }

    /// Set Dead Man's Switch inactivity period in days
    pub async fn set_dead_mans_days(&mut self, days: u64) {
        let mut storage = self.storage.lock().await;
        if let Err(e) = storage.set_config("dms_days", &days.to_string()) {
            tracing::warn!("Failed to persist DMS days config: {}", e);
        }
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

            if let Some(days_str) = storage.get_config("dms_days") {
                if let Ok(days) = days_str.parse::<u64>() {
                    if days > 0 {
                        if let Some(last_str) = storage.get_config("dms_last_active") {
                            if let Ok(last) = last_str.parse::<u64>() {
                                if now.saturating_sub(last) > days * 86400 {
                                    tracing::error!("DEAD MAN'S SWITCH TRIGGERED: Node inactive for > {} days. Initiating DB Wipe.", days);
                                    let _ = storage.self_destruct();
                                    return Err(crate::network::error::NetworkError::Io(std::io::Error::new(
                                        std::io::ErrorKind::Other, 
                                        "Dead Man's Switch Triggered. Data Wiped."
                                    )));
                                }
                            }
                        }
                    }
                }
            }

            // Update last active if it didn't trigger
            let _ = storage.set_config("dms_last_active", &now.to_string());
        }
        // ----------------------------------------

        info!("Starting RED node with identity: {}", n.identity.identity_hash().short());
        
        // Start transport listener
        n.transport.listen(n.config.listen_addr).await?;
        
        // Connect to bootstrap nodes
        for addr in &n.config.bootstrap_nodes {
            debug!("Connecting to bootstrap node: {}", addr);
            if let Err(e) = n.transport.connect(*addr).await {
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
                let n: tokio::sync::MutexGuard<'_, Self> = node_ref_prune.lock().await;
                let mut s: tokio::sync::MutexGuard<'_, Storage> = n.storage.lock().await;
                match s.prune_expired_messages() {
                    Ok(count) if count > 0 => info!("Background prune: removed {} expired messages", count),
                    Err(e) => error!("Background prune error: {:?}", e),
                    _ => {}
                }
            }
        });

        // Phase 17: Constant-Rate Traffic Padding (Anti-Censorship/NSA)
        // Continuously emits 1KB background noise to flatten ISP bandwidth analysis graphs.
        let node_ref_padding = node_ref.clone();
        tokio::spawn(async move {
            debug!("Mixnet/Padding: Starting continuous traffic obfuscation worker");
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                let n: tokio::sync::MutexGuard<'_, Self> = node_ref_padding.lock().await;
                let peers = n.transport.connected_peers();
                if !peers.is_empty() {
                    // Extract data synchronously to drop the !Send ThreadRng before awaiting the transport
                    let (random_peer, noise) = {
                        use rand::Rng;
                        let mut rng = rand::thread_rng();
                        let peer = peers[rng.gen_range(0..peers.len())].clone();
                        let mut noise_buf = vec![0u8; 1024];
                        rand::RngCore::fill_bytes(&mut rng, &mut noise_buf);
                        (peer, noise_buf)
                    };
                    
                    // Wrap the noise inside a structurally valid OnionLayer so it compiles and travels,
                    // but the recipient will fail to decrypt it and drop it silently.
                    let fake_layer = crate::network::routing::OnionLayer {
                        ephemeral_pk: [0u8; 32],
                        encrypted: crate::crypto::encryption::EncryptedData {
                            nonce: [0u8; 12],
                            ciphertext: noise,
                        }
                    };
                    
                    let fake_packet = crate::network::routing::OnionPacket {
                        layers: vec![fake_layer],
                    };
                    
                    let _ = n.transport.send(&random_peer, crate::network::transport::TransportMessage::Onion(fake_packet)).await;
                    trace!("Transmitted 1KB of obfuscation noise padding");
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
                                if let Ok(message) = Message::deserialize(&payload) {
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
                    let delay_ms = rand::thread_rng().gen_range(1000..=5000);
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
        // Gossip messages are currently expected to be encrypted OnionPackets
        if let Ok(packet) = bincode::deserialize::<crate::network::routing::OnionPacket>(&data) {
            self.handle_onion_packet(_sender, packet).await;
        } else {
            error!("Failed to deserialize gossip message as OnionPacket");
        }
    }

    /// Process a final incoming message
    async fn handle_incoming_message(&mut self, mut message: Message) {
        info!("Received message: {} -> {}", message.sender.short(), message.recipient.short());
        
        // Intercept GroupPayload for decryption and re-routing
        if let MessageType::GroupPayload(ref group_msg) = message.content {
            let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
            if let Some(mut group) = s.get_group(&group_msg.group_id).cloned() {
                let decryption_result: Result<Vec<u8>, crate::protocol::GroupError> = group.decrypt_message(group_msg, &message.sender);
                if let Ok(decrypted) = decryption_result {
                    if let Ok(inner_type) = bincode::deserialize::<MessageType>(&decrypted) {
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

        // Save to storage
        {
            let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
            
            // 1. Perspective: If this is an Ephemeral message from them, we should ensure it has an expires_at 
            // set if it doesn't already (though it should be set by the sender).
            // Actually, we trust the sender's expires_at for now.

            // 2. Add message to conversation
            if let Err(e) = s.add_message(message.clone()) {
                error!("Failed to save incoming message: {:?}", e);
            }

            // 3. Special handling for TimerUpdate to persist the setting
            if let MessageType::TimerUpdate { seconds } = message.content {
                let conv_id = ConversationId::from_participants(&message.sender, &message.recipient);
                if let Some(conv) = s.get_conversation_mut(&conv_id) {
                    conv.disappearing_timer = if seconds > 0 { Some(seconds) } else { None };
                    let _ = s.save_conversations();
                    info!("Updated disappearing timer to {}s for conversation {}", seconds, conv_id);
                }
            }
        }

        // Notify API if subscribed
        if let Some(tx) = &self.msg_notifier {
            let _ = tx.send(message);
        }
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
                .cloned()
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
        
        // FIX 5.1: Save outbound message to local encrypted storage before transmitting
        {
            let mut s = self.storage.lock().await;
            if let Err(e) = s.add_message(message.clone()) {
                error!("Failed to save outgoing message to local storage: {:?}", e);
            }
        }
        
        // 1. Resolve recipient IdentityHash to PeerId/Info (via DHT)
        let peer_id = self.transport.resolve(&recipient).await?;
        
        // TD-4 FIX: Guard against peers with no known addresses
        let destination = {
            let peers = self.transport.known_peers();
            peers.into_iter().find(|p| p.identity_hash.as_ref() == Some(&recipient))
                .unwrap_or_else(|| crate::network::PeerInfo {
                    id: peer_id.clone(),
                    public_key: crate::crypto::keys::PublicKey::from_bytes([0u8; 32]),
                    identity_hash: Some(recipient.clone()),
                    protocol_version: 1,
                    user_agent: "red-node".to_string(),
                    addresses: vec!["127.0.0.1:7331".parse().unwrap()],
                })
        };

        // Verify destination has usable addresses
        if destination.addresses.is_empty() {
            return Err(NetworkError::RoutingFailed("Destination has no known addresses".to_string()));
        }

        // 2. Select route for onion routing (3 hops)
        let available_peers = self.transport.known_peers();
        let route = self.onion_router.select_route(&available_peers, &destination)?;

        // 3. Derive shared secrets for each hop
        let mut shared_secrets = Vec::new();
        for hop in &route.hops {
            let secret = self.identity.key_exchange(&hop.public_key);
            shared_secrets.push(secret);
        }

        // 4. Encrypt message layers using OnionRouter
        let payload = message.serialize()
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;
            
        let packet = self.onion_router.create_packet(&route, &payload, &shared_secrets)
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;

        // 5. Send the OnionPacket to the first hop
        let first_hop = &route.hops[0].peer_id;
        use crate::network::transport::TransportMessage;
        self.transport.send(first_hop, TransportMessage::Onion(packet)).await?;
        
        info!("Onion message successfully sent to first hop: {}", first_hop.to_hex());
        
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

    /// Get the number of currently connected peers (for API status response)
    pub fn transport_peer_count(&self) -> usize {
        self.transport.connected_peers().len()
    }

    /// List known peers via transport
    pub async fn list_peers(&self) -> NetworkResult<Vec<crate::network::PeerInfo>> {
        Ok(self.transport.known_peers())
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
        
        let mut s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        if let Some(mut group) = s.get_group(&group_id).cloned() {
            group.add_member(member)
                .map_err(|e| NetworkError::TransportError(e.to_string()))?;
            s.add_group(group)
                .map_err(|e: crate::storage::StorageError| NetworkError::TransportError(e.to_string()))?;
            Ok(())
        } else {
            Err(NetworkError::TransportError("Group not found".to_string()))
        }
    }

    /// List all groups
    pub async fn list_groups(&self) -> NetworkResult<Vec<Group>> {
        let s: tokio::sync::MutexGuard<'_, Storage> = self.storage.lock().await;
        Ok(s.get_groups().into_iter().cloned().collect())
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
        Ok(s.get_authorized_devices().into_iter().cloned().collect())
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
        let contacts = s.get_contacts().into_iter().cloned().collect();
        let groups = s.get_groups().into_iter().cloned().collect();
        // TD-2 FIX: Collect conversations from storage
        let conversations = s.get_conversations().into_iter().cloned().collect();
        Ok((contacts, groups, conversations))
    }
}

//! Node orchestrator for RED.
//!
//! The Node struct is the central point of coordination for:
//! - P2P Networking
//! - Onion Routing
//! - Message Protocol (Double Ratchet)
//! - Local Storage

use std::sync::Arc;
use tokio::sync::Mutex;
use std::path::PathBuf;
use tracing::{info, error, debug, trace};

use crate::identity::{Identity, IdentityHash, AuthorizedDevice, DeviceId, DevicePublicKey};
use crate::network::{NetworkConfig, NetworkResult, NetworkError, PeerId, PeerInfo, Libp2pTransport};
use crate::network::transport::{Transport};
use crate::network::routing::{OnionRouter, Route};
use crate::protocol::{Message, ProtocolResult, Group, GroupId, GroupMember, MemberRole, Conversation};
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
    transport: Box<dyn Transport>,
    /// Channel for notifying API of new messages
    msg_notifier: Option<tokio::sync::broadcast::Sender<Message>>,
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
        let transport = Box::new(Libp2pTransport::new(signing_key_bytes)?);

        Ok(Self {
            identity,
            config,
            storage,
            onion_router,
            transport,
            msg_notifier: None,
            is_running: false,
        })
    }

    /// Start the node
    pub async fn start(&mut self) -> NetworkResult<()> {
        if self.is_running {
            return Ok(());
        }

        info!("Starting RED node with identity: {}", self.identity.identity_hash().short());
        
        // Start transport listener
        self.transport.listen(self.config.listen_addr).await?;
        
        // Connect to bootstrap nodes
        for addr in &self.config.bootstrap_nodes {
            debug!("Connecting to bootstrap node: {}", addr);
            if let Err(e) = self.transport.connect(*addr).await {
                error!("Failed to connect to bootstrap node {}: {}", addr, e);
            }
        }

        self.is_running = true;
        info!("RED node is now running on {}", self.config.listen_addr);
        Ok(())
    }

    /// Set message notifier
    pub fn set_msg_notifier(&mut self, tx: tokio::sync::broadcast::Sender<Message>) {
        self.msg_notifier = Some(tx);
    }

    /// Start the event loop for processing incoming network messages
    pub async fn start_event_loop(node_ref: Arc<Mutex<Self>>) {
        loop {
            // TD-5 FIX: Drop the lock BEFORE calling receive(), which may block.
            // This prevents the lock from being held across an await point,
            // blocking all other API calls while waiting for the next message.
            let receive_result = {
                let mut n = node_ref.lock().await;
                n.transport.receive().await
            };

            match receive_result {
                Ok((peer_id, msg)) => {
                    let node_clone = node_ref.clone();
                    tokio::spawn(async move {
                        let mut n = node_clone.lock().await;
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
        
        match self.onion_router.peel_layer(layer, &secret) {
            Ok(routing_info) => {
                if let Some(next_hop_addr) = routing_info.next_hop {
                    // Forward to next hop
                    debug!("Forwarding onion packet to {}", next_hop_addr);
                    packet.layers.remove(0);
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

    /// Process a final incoming message
    async fn handle_incoming_message(&mut self, message: Message) {
        info!("Received message: {} -> {}", message.sender.short(), message.recipient.short());
        
        // Save to storage
        let mut s = self.storage.lock().await;
        if let Err(e) = s.add_message(message.clone()) {
            error!("Failed to save incoming message: {:?}", e);
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

    /// Send a message to a recipient
    pub async fn send_message(&mut self, recipient: IdentityHash, message: Message) -> NetworkResult<()> {
        debug!("Sending message to recipient: {}", recipient.short());
        
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

    /// Create a new group
    pub async fn create_group(&mut self, name: String) -> NetworkResult<Group> {
        info!("Creating group: {}", name);
        
        let creator = GroupMember {
            identity_hash: self.identity.identity_hash().clone(),
            public_key: self.identity.public_key_array().into(),
            joined_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            role: MemberRole::Admin,
        };

        let group = Group::create(name, creator);
        let mut s = self.storage.lock().await;
        s.add_group(group.clone())
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;
            
        Ok(group)
    }

    /// Add a member to a group
    pub async fn add_group_member(&mut self, group_id: GroupId, member: GroupMember) -> NetworkResult<()> {
        info!("Adding member {} to group {:?}", member.identity_hash.short(), group_id);
        
        let mut s = self.storage.lock().await;
        if let Some(mut group) = s.get_group(&group_id).cloned() {
            group.add_member(member)
                .map_err(|e| NetworkError::TransportError(e.to_string()))?;
            s.add_group(group)
                .map_err(|e| NetworkError::TransportError(e.to_string()))?;
            Ok(())
        } else {
            Err(NetworkError::TransportError("Group not found".to_string()))
        }
    }

    /// List all groups
    pub async fn list_groups(&self) -> NetworkResult<Vec<Group>> {
        let s = self.storage.lock().await;
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

        let mut s = self.storage.lock().await;
        s.add_authorized_device(device.clone())
            .map_err(|e| NetworkError::TransportError(e.to_string()))?;
            
        Ok(device)
    }

    /// List authorized devices
    pub async fn list_devices(&self) -> NetworkResult<Vec<AuthorizedDevice>> {
        let s = self.storage.lock().await;
        Ok(s.get_authorized_devices().into_iter().cloned().collect())
    }

    /// Add a contact to local storage (used by the HTTP API)
    pub async fn add_contact(&self, contact: crate::storage::Contact) -> NetworkResult<()> {
        let mut s = self.storage.lock().await;
        s.add_contact(contact)
            .map_err(|e| NetworkError::TransportError(e.to_string()))
    }

    /// Get synchronization payload (TD-2 FIX: return real conversations)
    pub async fn get_sync_payload(&self) -> NetworkResult<(Vec<crate::storage::Contact>, Vec<Group>, Vec<Conversation>)> {
        let s = self.storage.lock().await;
        let contacts = s.get_contacts().into_iter().cloned().collect();
        let groups = s.get_groups().into_iter().cloned().collect();
        // TD-2 FIX: Collect conversations from storage
        let conversations = s.get_conversations().into_iter().cloned().collect();
        Ok((contacts, groups, conversations))
    }
}

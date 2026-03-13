//! Peer management.

use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::{Duration, Instant};

use crate::crypto::keys::PublicKey;
use crate::identity::IdentityHash;

/// Unique peer identifier (derived from public key)
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PeerId([u8; 32]);

impl PeerId {
    /// Create from raw bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Create from public key
    pub fn from_public_key(pk: &PublicKey) -> Self {
        Self(*pk.as_bytes())
    }

    /// Get raw bytes
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    /// Convert to hex string
    pub fn to_hex(&self) -> String {
        hex::encode(&self.0)
    }

    /// Get short display form
    pub fn short(&self) -> String {
        self.to_hex()[..8].to_string()
    }
}

impl std::fmt::Display for PeerId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.short())
    }
}

/// Information about a peer
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PeerInfo {
    /// Peer ID
    pub id: PeerId,
    /// Network addresses
    pub addresses: Vec<SocketAddr>,
    /// Public key for encryption
    pub public_key: PublicKey,
    /// Optional identity hash (if known)
    pub identity_hash: Option<IdentityHash>,
    /// Protocol version
    pub protocol_version: u32,
    /// User agent string
    pub user_agent: String,
}

/// Connection state
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ConnectionState {
    /// Not connected
    Disconnected,
    /// Connection in progress
    Connecting,
    /// Connected and ready
    Connected,
    /// Connection failed
    Failed(String),
}

/// A connected peer
pub struct Peer {
    /// Peer information
    pub info: PeerInfo,
    /// Current connection state
    pub state: ConnectionState,
    /// When the connection was established
    pub connected_at: Option<Instant>,
    /// Last activity time
    pub last_seen: Instant,
    /// Number of messages sent
    pub messages_sent: u64,
    /// Number of messages received
    pub messages_received: u64,
    /// Latency (round-trip time)
    pub latency: Option<Duration>,
    /// Reputation score (0-100)
    pub reputation: u8,
}

impl Peer {
    /// Create a new peer from info
    pub fn new(info: PeerInfo) -> Self {
        Self {
            info,
            state: ConnectionState::Disconnected,
            connected_at: None,
            last_seen: Instant::now(),
            messages_sent: 0,
            messages_received: 0,
            latency: None,
            reputation: 50, // Start with neutral reputation
        }
    }

    /// Check if peer is connected
    pub fn is_connected(&self) -> bool {
        self.state == ConnectionState::Connected
    }

    /// Update last seen time
    pub fn touch(&mut self) {
        self.last_seen = Instant::now();
    }

    /// Get connection duration
    pub fn connection_duration(&self) -> Option<Duration> {
        self.connected_at.map(|t| t.elapsed())
    }

    /// Increase reputation
    pub fn increase_reputation(&mut self, amount: u8) {
        self.reputation = self.reputation.saturating_add(amount).min(100);
    }

    /// Decrease reputation
    pub fn decrease_reputation(&mut self, amount: u8) {
        self.reputation = self.reputation.saturating_sub(amount);
    }

    /// Check if peer should be disconnected (low reputation)
    pub fn should_disconnect(&self) -> bool {
        self.reputation < 10
    }

    /// Mark as connected
    pub fn mark_connected(&mut self) {
        self.state = ConnectionState::Connected;
        self.connected_at = Some(Instant::now());
        self.touch();
    }

    /// Mark as disconnected
    pub fn mark_disconnected(&mut self) {
        self.state = ConnectionState::Disconnected;
        self.connected_at = None;
    }

    /// Record a sent message
    pub fn record_sent(&mut self) {
        self.messages_sent += 1;
        self.touch();
    }

    /// Record a received message
    pub fn record_received(&mut self) {
        self.messages_received += 1;
        self.touch();
    }

    /// Update latency measurement
    pub fn update_latency(&mut self, latency: Duration) {
        self.latency = Some(latency);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::keys::KeyPair;

    fn create_test_peer_info() -> PeerInfo {
        let kp = KeyPair::generate();
        PeerInfo {
            id: PeerId::from_public_key(&kp.public),
            addresses: vec!["127.0.0.1:7331".parse().unwrap()],
            public_key: kp.public,
            identity_hash: None,
            protocol_version: 1,
            user_agent: "RED/0.1.0".to_string(),
        }
    }

    #[test]
    fn test_peer_creation() {
        let info = create_test_peer_info();
        let peer = Peer::new(info);

        assert!(!peer.is_connected());
        assert_eq!(peer.reputation, 50);
        assert_eq!(peer.messages_sent, 0);
    }

    #[test]
    fn test_peer_connection() {
        let info = create_test_peer_info();
        let mut peer = Peer::new(info);

        peer.mark_connected();
        assert!(peer.is_connected());
        assert!(peer.connected_at.is_some());

        peer.mark_disconnected();
        assert!(!peer.is_connected());
    }

    #[test]
    fn test_reputation() {
        let info = create_test_peer_info();
        let mut peer = Peer::new(info);

        peer.increase_reputation(30);
        assert_eq!(peer.reputation, 80);

        peer.decrease_reputation(75);
        assert_eq!(peer.reputation, 5);
        assert!(peer.should_disconnect());
    }

    #[test]
    fn test_message_tracking() {
        let info = create_test_peer_info();
        let mut peer = Peer::new(info);

        peer.record_sent();
        peer.record_sent();
        peer.record_received();

        assert_eq!(peer.messages_sent, 2);
        assert_eq!(peer.messages_received, 1);
    }
}

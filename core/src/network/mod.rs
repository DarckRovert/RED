//! P2P networking layer for RED protocol.
//!
//! This module provides:
//! - Peer discovery and connection management
//! - Onion routing for anonymous message delivery
//! - Gossip protocol for message propagation
//! - DHT for decentralized storage

mod config;
mod peer;
mod routing;
mod transport;
pub mod control;
pub mod node;
pub mod onion;
pub mod dummy_traffic;
pub mod gossip;
pub mod libp2p_transport;
pub mod lora_bridge;

pub use config::NetworkConfig;
pub use peer::{Peer, PeerId, PeerInfo};
pub use routing::{OnionRouter, Route};
pub use transport::Transport;
pub use libp2p_transport::Libp2pTransport;
pub use node::Node;

use thiserror::Error;

/// Network-related errors
#[derive(Error, Debug)]
pub enum NetworkError {
    /// Connection failed
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    /// Peer not found
    #[error("Peer not found: {0}")]
    PeerNotFound(String),

    /// Routing failed
    #[error("Routing failed: {0}")]
    RoutingFailed(String),

    /// Transport error
    #[error("Transport error: {0}")]
    TransportError(String),

    /// Timeout
    #[error("Operation timed out")]
    Timeout,

    /// Network not initialized
    #[error("Network not initialized")]
    NotInitialized,

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// Authentication / authorization failed
    #[error("Authentication failed: {0}")]
    AuthenticationFailed(String),
}

/// Result type for network operations
pub type NetworkResult<T> = Result<T, NetworkError>;

/// Default port for RED nodes
pub const DEFAULT_PORT: u16 = 7331;

/// Maximum number of peers to maintain
pub const MAX_PEERS: usize = 50;

/// Minimum number of peers for healthy network
pub const MIN_PEERS: usize = 3;

/// Onion routing path length
pub const ONION_PATH_LENGTH: usize = 3;

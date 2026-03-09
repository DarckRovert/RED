//! Network configuration.

use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::Duration;

use super::{DEFAULT_PORT, MAX_PEERS, MIN_PEERS, ONION_PATH_LENGTH};

/// Network configuration
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkConfig {
    /// Listen address
    pub listen_addr: SocketAddr,
    
    /// Bootstrap nodes
    pub bootstrap_nodes: Vec<SocketAddr>,
    
    /// Maximum number of peers
    pub max_peers: usize,
    
    /// Minimum number of peers
    pub min_peers: usize,
    
    /// Onion routing path length
    pub onion_path_length: usize,
    
    /// Connection timeout
    pub connection_timeout: Duration,
    
    /// Ping interval
    pub ping_interval: Duration,
    
    /// Enable mDNS for local discovery
    pub enable_mdns: bool,
    
    /// Enable DHT
    pub enable_dht: bool,
    
    /// Enable gossip protocol
    pub enable_gossip: bool,
    
    /// Dummy traffic rate (messages per minute)
    pub dummy_traffic_rate: f64,
}

impl NetworkConfig {
    /// Create a new configuration with default settings
    pub fn new(listen_port: u16) -> Self {
        Self {
            listen_addr: format!("0.0.0.0:{}", listen_port).parse().unwrap(),
            bootstrap_nodes: Vec::new(),
            max_peers: MAX_PEERS,
            min_peers: MIN_PEERS,
            onion_path_length: ONION_PATH_LENGTH,
            connection_timeout: Duration::from_secs(10),
            ping_interval: Duration::from_secs(30),
            enable_mdns: true,
            enable_dht: true,
            enable_gossip: true,
            dummy_traffic_rate: 1.0, // 1 dummy message per minute
        }
    }

    /// Add a bootstrap node
    pub fn with_bootstrap_node(mut self, addr: SocketAddr) -> Self {
        self.bootstrap_nodes.push(addr);
        self
    }

    /// Add multiple bootstrap nodes
    pub fn with_bootstrap_nodes(mut self, addrs: Vec<SocketAddr>) -> Self {
        self.bootstrap_nodes.extend(addrs);
        self
    }

    /// Set maximum peers
    pub fn with_max_peers(mut self, max: usize) -> Self {
        self.max_peers = max;
        self
    }

    /// Set onion path length
    pub fn with_onion_path_length(mut self, length: usize) -> Self {
        self.onion_path_length = length;
        self
    }

    /// Disable mDNS
    pub fn without_mdns(mut self) -> Self {
        self.enable_mdns = false;
        self
    }

    /// Set dummy traffic rate
    pub fn with_dummy_traffic_rate(mut self, rate: f64) -> Self {
        self.dummy_traffic_rate = rate;
        self
    }
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self::new(DEFAULT_PORT)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = NetworkConfig::default();
        
        assert_eq!(config.listen_addr.port(), DEFAULT_PORT);
        assert_eq!(config.max_peers, MAX_PEERS);
        assert_eq!(config.onion_path_length, ONION_PATH_LENGTH);
        assert!(config.enable_mdns);
        assert!(config.enable_dht);
    }

    #[test]
    fn test_builder_pattern() {
        let addr: SocketAddr = "192.168.1.1:7331".parse().unwrap();
        
        let config = NetworkConfig::new(8080)
            .with_bootstrap_node(addr)
            .with_max_peers(100)
            .with_onion_path_length(5)
            .without_mdns();

        assert_eq!(config.listen_addr.port(), 8080);
        assert_eq!(config.bootstrap_nodes.len(), 1);
        assert_eq!(config.max_peers, 100);
        assert_eq!(config.onion_path_length, 5);
        assert!(!config.enable_mdns);
    }
}

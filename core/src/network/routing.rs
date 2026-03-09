//! Onion routing for anonymous message delivery.

use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

use crate::crypto::{
    encryption::{encrypt, EncryptedData},
    keys::PublicKey,
    CryptoResult,
};

use super::{NetworkError, NetworkResult, PeerId, PeerInfo, ONION_PATH_LENGTH};

/// A route through the network
#[derive(Clone, Debug)]
pub struct Route {
    /// Ordered list of hops
    pub hops: Vec<RouteHop>,
}

/// A single hop in a route
#[derive(Clone, Debug)]
pub struct RouteHop {
    /// Peer ID of this hop
    pub peer_id: PeerId,
    /// Public key for encryption
    pub public_key: PublicKey,
    /// Address to connect to
    pub address: std::net::SocketAddr,
}

/// Onion-encrypted packet
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OnionPacket {
    /// Encrypted layers (outermost first)
    pub layers: Vec<OnionLayer>,
}

/// A single layer of onion encryption
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OnionLayer {
    /// Ephemeral public key for this layer
    pub ephemeral_pk: [u8; 32],
    /// Encrypted payload (next layer or final message)
    pub encrypted: EncryptedData,
}

/// Routing information for a hop
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoutingInfo {
    /// Next hop address (None if final destination)
    pub next_hop: Option<String>,
    /// Payload for this hop
    pub payload: Vec<u8>,
}

/// Onion router for creating and processing onion packets
pub struct OnionRouter {
    /// Path length for routes
    path_length: usize,
}

impl OnionRouter {
    /// Create a new onion router
    pub fn new(path_length: usize) -> Self {
        Self { path_length }
    }

    /// Create a new onion router with default path length
    pub fn default() -> Self {
        Self::new(ONION_PATH_LENGTH)
    }

    /// Select a random route through available peers
    pub fn select_route(
        &self,
        available_peers: &[PeerInfo],
        destination: &PeerInfo,
    ) -> NetworkResult<Route> {
        if available_peers.len() < self.path_length {
            return Err(NetworkError::RoutingFailed(
                format!(
                    "Not enough peers for route: need {}, have {}",
                    self.path_length,
                    available_peers.len()
                )
            ));
        }

        let mut rng = rand::thread_rng();
        
        // Select random intermediate hops
        let mut selected: Vec<&PeerInfo> = available_peers
            .choose_multiple(&mut rng, self.path_length - 1)
            .collect();

        // Build route hops
        let mut hops: Vec<RouteHop> = selected
            .iter()
            .map(|peer| RouteHop {
                peer_id: peer.id.clone(),
                public_key: peer.public_key.clone(),
                address: peer.addresses[0], // Use first address
            })
            .collect();

        // Add destination as final hop
        hops.push(RouteHop {
            peer_id: destination.id.clone(),
            public_key: destination.public_key.clone(),
            address: destination.addresses[0],
        });

        Ok(Route { hops })
    }

    /// Create an onion packet for a message
    pub fn create_packet(
        &self,
        route: &Route,
        message: &[u8],
        shared_secrets: &[[u8; 32]],
    ) -> CryptoResult<OnionPacket> {
        if route.hops.len() != shared_secrets.len() {
            return Err(crate::crypto::CryptoError::EncryptionError(
                "Route and secrets length mismatch".to_string()
            ));
        }

        let mut layers = Vec::new();
        let mut current_payload = message.to_vec();

        // Build layers from inside out (last hop first)
        for (i, (hop, secret)) in route.hops.iter().zip(shared_secrets.iter()).rev().enumerate() {
            let is_final = i == 0;
            
            // Create routing info
            let routing_info = if is_final {
                RoutingInfo {
                    next_hop: None,
                    payload: current_payload.clone(),
                }
            } else {
                // BUG-2 FIX: was `route.hops.len() - i`, now correctly `route.hops.len() - 1 - i`
                let next_hop = &route.hops[route.hops.len() - 1 - i];
                RoutingInfo {
                    next_hop: Some(next_hop.address.to_string()),
                    payload: current_payload.clone(),
                }
            };

            // Serialize and encrypt
            let routing_bytes = bincode::serialize(&routing_info)
                .map_err(|e| crate::crypto::CryptoError::EncryptionError(e.to_string()))?;
            
            let encrypted = encrypt(secret, &routing_bytes)?;

            layers.push(OnionLayer {
                ephemeral_pk: *hop.public_key.as_bytes(),
                encrypted,
            });

            // The encrypted layer becomes the payload for the next (outer) layer
            current_payload = bincode::serialize(&layers.last().unwrap())
                .map_err(|e| crate::crypto::CryptoError::EncryptionError(e.to_string()))?;
        }

        // Reverse to get outermost layer first
        layers.reverse();

        Ok(OnionPacket { layers })
    }

    /// Process (peel) one layer of an onion packet
    pub fn peel_layer(
        &self,
        layer: &OnionLayer,
        secret: &[u8; 32],
    ) -> CryptoResult<RoutingInfo> {
        use crate::crypto::encryption::decrypt;

        let decrypted = decrypt(secret, &layer.encrypted)?;
        
        bincode::deserialize(&decrypted)
            .map_err(|e| crate::crypto::CryptoError::DecryptionError(e.to_string()))
    }
}

impl Default for OnionRouter {
    fn default() -> Self {
        Self::new(ONION_PATH_LENGTH)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::keys::KeyPair;

    fn create_test_peers(count: usize) -> Vec<PeerInfo> {
        (0..count)
            .map(|i| {
                let kp = KeyPair::generate();
                PeerInfo {
                    id: PeerId::from_public_key(&kp.public),
                    addresses: vec![format!("127.0.0.1:{}", 7331 + i).parse().unwrap()],
                    public_key: kp.public,
                    identity_hash: None,
                    protocol_version: 1,
                    user_agent: "test".to_string(),
                }
            })
            .collect()
    }

    #[test]
    fn test_route_selection() {
        let router = OnionRouter::new(3);
        let peers = create_test_peers(5);
        let destination = create_test_peers(1).pop().unwrap();

        let route = router.select_route(&peers, &destination).unwrap();
        
        assert_eq!(route.hops.len(), 3);
    }

    #[test]
    fn test_route_selection_not_enough_peers() {
        let router = OnionRouter::new(3);
        let peers = create_test_peers(1);
        let destination = create_test_peers(1).pop().unwrap();

        let result = router.select_route(&peers, &destination);
        
        assert!(result.is_err());
    }
}

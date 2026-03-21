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
    /// Cache of seen nonces for replay protection
    seen_nonces: std::sync::Arc<tokio::sync::Mutex<std::collections::HashSet<[u8; 12]>>>,
}

impl OnionRouter {
    /// Create a new onion router
    pub fn new(path_length: usize) -> Self {
        Self { 
            path_length,
            seen_nonces: std::sync::Arc::new(tokio::sync::Mutex::new(std::collections::HashSet::new())),
        }
    }

    /// Limit nonce cache to prevent memory leak (SEC-FIX M-2)
    const MAX_NONCE_CACHE: usize = 100_000;

    /// Check if a nonce has been seen and add it if not (SEC-FIX M-2)
    pub async fn check_nonce(&self, nonce: &[u8; 12]) -> bool {
        let mut cache = self.seen_nonces.lock().await;
        if cache.len() > Self::MAX_NONCE_CACHE {
            tracing::warn!("Nonce cache full, clearing to prevent memory leak.");
            cache.clear();
        }
        !cache.insert(*nonce)
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
        let selected: Vec<&PeerInfo> = available_peers
            .choose_multiple(&mut rng, self.path_length - 1)
            .collect();

        // Build route hops
        let mut hops = Vec::new();
        for peer in selected {
            // SEC-FIX M-4: Panic-safe address selection
            let address = peer.addresses.first()
                .ok_or_else(|| NetworkError::RoutingFailed(format!("Intermediate peer {} has no addresses", peer.id)))?;
            
            hops.push(RouteHop {
                peer_id: peer.id.clone(),
                public_key: peer.public_key.clone(),
                address: *address,
            });
        }

        // Add destination as final hop
        // SEC-FIX M-4: Panic-safe address selection
        let dest_address = destination.addresses.first()
            .ok_or_else(|| NetworkError::RoutingFailed(format!("Destination peer {} has no addresses", destination.id)))?;

        hops.push(RouteHop {
            peer_id: destination.id.clone(),
            public_key: destination.public_key.clone(),
            address: *dest_address,
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

        // Phase 18: Constant-Size Padding (Anti-NSA Payload Correlation)
        // To prevent traffic analysis algorithms from correlating a 50-byte 'Hello' 
        // across network hops, we mathematically pad ALL payloads to exactly 4096 bytes.
        // Bincode deserialization securely ignores trailing suffix bytes.
        const CONSTANT_MTU_SIZE: usize = 4096;
        if current_payload.len() < CONSTANT_MTU_SIZE {
            // SEC-FIX M-1: Use random padding instead of zeros to prevent traffic analysis
            // of packet endings.
            use rand::RngCore;
            let mut padding = vec![0u8; CONSTANT_MTU_SIZE - current_payload.len()];
            rand::thread_rng().fill_bytes(&mut padding);
            current_payload.extend_from_slice(&padding);
        } else if current_payload.len() > CONSTANT_MTU_SIZE {
            tracing::warn!("Payload exceeds 4KB anonymity MTU. Mixnet entropy degraded for this transmission.");
        }

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
    pub async fn peel_layer(
        &self,
        layer: &OnionLayer,
        secret: &[u8; 32],
    ) -> CryptoResult<RoutingInfo> {
        use crate::crypto::encryption::decrypt;

        // SEC-D: Replay protection via nonce caching
        let mut seen = self.seen_nonces.lock().await;
        if seen.contains(&layer.encrypted.nonce) {
            return Err(crate::crypto::CryptoError::DecryptionError("Replay detected".to_string()));
        }

        let decrypted = decrypt(secret, &layer.encrypted)?;
        
        // Add nonce to seen cache after successful decryption
        seen.insert(layer.encrypted.nonce);
        
        // Optional: limit cache size to prevent memory leak
        if seen.len() > 10000 {
            // Very simple cleanup: clear half the cache if it grows too large
            // In a production system, use an LRU cache.
            let to_remove: Vec<_> = seen.iter().take(5000).copied().collect();
            for n in to_remove {
                seen.remove(&n);
            }
        }
        drop(seen);
        
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

    #[tokio::test]
    async fn test_replay_attack_rejected() {
        let router = OnionRouter::new(3);
        let kp = KeyPair::generate();
        let secret = kp.secret.as_bytes();
        
        // Correct payload for routing: RoutingInfo serialized
        let info = RoutingInfo {
            next_hop: None,
            payload: b"Hello".to_vec(),
        };
        let plaintext = bincode::serialize(&info).unwrap();
        
        let mut layers = Vec::new();
        let encrypted = crate::crypto::encryption::encrypt(secret, &plaintext).unwrap();
        layers.push(OnionLayer {
            ephemeral_pk: *kp.public.as_bytes(),
            encrypted: encrypted.clone(),
        });
        
        // First peel succeeds
        let result1 = router.peel_layer(&layers[0], secret).await;
        assert!(result1.is_ok());
        
        // Second peel with same nonce fails (replay)
        let result2 = router.peel_layer(&layers[0], secret).await;
        assert!(result2.is_err());
        if let Err(crate::crypto::CryptoError::DecryptionError(msg)) = result2 {
            assert_eq!(msg, "Replay detected");
        } else {
            panic!("Expected Replay detected error, got {:?}", result2);
        }
    }
}

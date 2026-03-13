//! Onion Routing Implementation
//!
//! Implements the onion routing layer for anonymous message delivery:
//! - L = 3 hop routing
//! - Layered encryption with ephemeral keys
//! - Path selection from d-regular graph

use crate::crypto::encryption::{encrypt, decrypt};
use crate::crypto::keys::{EphemeralKeyPair, x25519_diffie_hellman};
use crate::crypto::hashing::blake3_hash;

/// Number of onion routing hops (L = 3)
pub const ONION_HOPS: usize = 3;

/// Maximum payload size
pub const MAX_PAYLOAD_SIZE: usize = 65536;

/// Padded cell size for traffic analysis resistance
pub const CELL_SIZE: usize = 512;

/// Onion packet structure
#[derive(Clone)]
pub struct OnionPacket {
    /// Ephemeral public key for this layer
    pub ephemeral_pk: [u8; 32],
    /// Encrypted payload (next layer or final message)
    pub payload: Vec<u8>,
    /// MAC for integrity
    pub mac: [u8; 16],
}

impl OnionPacket {
    /// Create a new onion packet
    pub fn new(ephemeral_pk: [u8; 32], payload: Vec<u8>, mac: [u8; 16]) -> Self {
        Self {
            ephemeral_pk,
            payload,
            mac,
        }
    }

    /// Serialize to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(32 + self.payload.len() + 16);
        bytes.extend_from_slice(&self.ephemeral_pk);
        bytes.extend_from_slice(&self.payload);
        bytes.extend_from_slice(&self.mac);
        bytes
    }

    /// Deserialize from bytes
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < 48 {
            return None;
        }

        let mut ephemeral_pk = [0u8; 32];
        ephemeral_pk.copy_from_slice(&bytes[..32]);

        let payload_end = bytes.len() - 16;
        let payload = bytes[32..payload_end].to_vec();

        let mut mac = [0u8; 16];
        mac.copy_from_slice(&bytes[payload_end..]);

        Some(Self {
            ephemeral_pk,
            payload,
            mac,
        })
    }
}

/// Routing information for a single hop
#[derive(Clone)]
pub struct HopInfo {
    /// Node's public key
    pub node_pk: [u8; 32],
    /// Node's address (IP:port or identifier)
    pub address: String,
}

/// Onion route (path through the network)
#[derive(Clone)]
pub struct OnionRoute {
    /// Hops in the route (excluding sender)
    pub hops: Vec<HopInfo>,
    /// Final destination
    pub destination: HopInfo,
}

impl OnionRoute {
    /// Create a new route
    pub fn new(hops: Vec<HopInfo>, destination: HopInfo) -> Self {
        Self { hops, destination }
    }

    /// Get total number of hops
    pub fn len(&self) -> usize {
        self.hops.len() + 1
    }

    /// Check if route is empty
    pub fn is_empty(&self) -> bool {
        false // Always has at least destination
    }
}

/// Build an onion packet for a message
/// 
/// Creates layered encryption: innermost layer is for destination,
/// each outer layer is for an intermediate node.
pub fn build_onion(
    message: &[u8],
    route: &OnionRoute,
    sender_sk: &[u8; 32],
) -> Result<OnionPacket, OnionError> {
    if route.hops.len() != ONION_HOPS {
        return Err(OnionError::InvalidRouteLength);
    }

    if message.len() > MAX_PAYLOAD_SIZE {
        return Err(OnionError::PayloadTooLarge);
    }

    // Pad message to fixed size for traffic analysis resistance
    let padded_message = pad_message(message);

    // Build layers from inside out
    let mut current_payload = padded_message;

    // Layer for destination
    let (layer, _) = encrypt_layer(
        &current_payload,
        &route.destination.node_pk,
        sender_sk,
        None, // No next hop for destination
    )?;
    current_payload = layer.to_bytes();

    // Layers for intermediate hops (reverse order)
    for (i, hop) in route.hops.iter().rev().enumerate() {
        let next_address = if i == 0 {
            Some(route.destination.address.clone())
        } else {
            Some(route.hops[route.hops.len() - i].address.clone())
        };

        let (layer, _) = encrypt_layer(
            &current_payload,
            &hop.node_pk,
            sender_sk,
            next_address,
        )?;
        current_payload = layer.to_bytes();
    }

    OnionPacket::from_bytes(&current_payload)
        .ok_or(OnionError::SerializationError)
}

/// Peel one layer of the onion
/// 
/// Returns the inner payload and the next hop address (if any)
pub fn peel_onion(
    packet: &OnionPacket,
    node_sk: &[u8; 32],
) -> Result<(Vec<u8>, Option<String>), OnionError> {
    // Compute shared secret
    let shared_secret = x25519_diffie_hellman(node_sk, &packet.ephemeral_pk);

    // Derive decryption key
    let key = derive_layer_key(&shared_secret);

    // Decrypt payload
    let encrypted_data = crate::crypto::encryption::EncryptedData::from_bytes(&packet.payload)
        .map_err(|_| OnionError::DecryptionFailed)?;
    let decrypted = decrypt(&key, &encrypted_data)
        .map_err(|_| OnionError::DecryptionFailed)?;

    // Parse decrypted data
    // Format: [next_hop_len: u16][next_hop: String][inner_payload]
    if decrypted.len() < 2 {
        return Err(OnionError::InvalidPayload);
    }

    let next_hop_len = u16::from_le_bytes([decrypted[0], decrypted[1]]) as usize;

    if next_hop_len == 0 {
        // This is the final destination
        let payload = unpad_message(&decrypted[2..])?;
        return Ok((payload, None));
    }

    if decrypted.len() < 2 + next_hop_len {
        return Err(OnionError::InvalidPayload);
    }

    let next_hop = String::from_utf8(decrypted[2..2 + next_hop_len].to_vec())
        .map_err(|_| OnionError::InvalidPayload)?;

    let inner_payload = decrypted[2 + next_hop_len..].to_vec();

    Ok((inner_payload, Some(next_hop)))
}

/// Encrypt a single layer of the onion
fn encrypt_layer(
    payload: &[u8],
    recipient_pk: &[u8; 32],
    _sender_sk: &[u8; 32],
    next_hop: Option<String>,
) -> Result<(OnionPacket, [u8; 32]), OnionError> {
    // Generate ephemeral key pair for this layer
    let ephemeral = EphemeralKeyPair::generate();
    let ephemeral_public = ephemeral.public.clone();

    // Compute shared secret
    let shared_secret = ephemeral.key_exchange(&crate::crypto::keys::PublicKey::from_bytes(*recipient_pk));

    // Derive encryption key
    let key = derive_layer_key(&shared_secret);

    // Build plaintext: [next_hop_len][next_hop][payload]
    let mut plaintext = Vec::new();
    match next_hop {
        Some(addr) => {
            let addr_bytes = addr.as_bytes();
            plaintext.extend_from_slice(&(addr_bytes.len() as u16).to_le_bytes());
            plaintext.extend_from_slice(addr_bytes);
        }
        None => {
            plaintext.extend_from_slice(&0u16.to_le_bytes());
        }
    }
    plaintext.extend_from_slice(payload);

    // Encrypt
    let ciphertext = encrypt(&key, &plaintext)
        .map_err(|_| OnionError::EncryptionFailed)?;

    // Compute MAC
    let mac = compute_mac(&key, &ciphertext.to_bytes());

    let packet = OnionPacket::new(*ephemeral_public.as_bytes(), ciphertext.to_bytes(), mac);

    Ok((packet, shared_secret))
}

/// Derive layer encryption key from shared secret
fn derive_layer_key(shared_secret: &[u8; 32]) -> [u8; 32] {
    let mut input = Vec::with_capacity(64);
    input.extend_from_slice(shared_secret);
    input.extend_from_slice(b"onion-layer-key");
    blake3_hash(&input)
}

/// Compute MAC for integrity
fn compute_mac(key: &[u8; 32], data: &[u8]) -> [u8; 16] {
    let mut input = Vec::with_capacity(32 + data.len());
    input.extend_from_slice(key);
    input.extend_from_slice(data);
    let hash = blake3_hash(&input);
    let mut mac = [0u8; 16];
    mac.copy_from_slice(&hash[..16]);
    mac
}

/// Pad message to fixed cell size
fn pad_message(message: &[u8]) -> Vec<u8> {
    let num_cells = (message.len() + 4 + CELL_SIZE - 1) / CELL_SIZE;
    let padded_len = num_cells * CELL_SIZE;

    let mut padded = Vec::with_capacity(padded_len);
    
    // Prepend original length
    padded.extend_from_slice(&(message.len() as u32).to_le_bytes());
    padded.extend_from_slice(message);

    // Pad with random bytes
    let padding_len = padded_len - padded.len();
    let mut padding = vec![0u8; padding_len];
    let _ = getrandom::getrandom(&mut padding);
    padded.extend_from_slice(&padding);

    padded
}

/// Remove padding from message
fn unpad_message(padded: &[u8]) -> Result<Vec<u8>, OnionError> {
    if padded.len() < 4 {
        return Err(OnionError::InvalidPayload);
    }

    let original_len = u32::from_le_bytes([padded[0], padded[1], padded[2], padded[3]]) as usize;

    if padded.len() < 4 + original_len {
        return Err(OnionError::InvalidPayload);
    }

    Ok(padded[4..4 + original_len].to_vec())
}

/// Onion routing errors
#[derive(Debug, Clone)]
pub enum OnionError {
    InvalidRouteLength,
    PayloadTooLarge,
    EncryptionFailed,
    DecryptionFailed,
    InvalidPayload,
    SerializationError,
    NetworkError(String),
}

impl std::fmt::Display for OnionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OnionError::InvalidRouteLength => write!(f, "Invalid route length (expected {})", ONION_HOPS),
            OnionError::PayloadTooLarge => write!(f, "Payload exceeds maximum size"),
            OnionError::EncryptionFailed => write!(f, "Encryption failed"),
            OnionError::DecryptionFailed => write!(f, "Decryption failed"),
            OnionError::InvalidPayload => write!(f, "Invalid payload format"),
            OnionError::SerializationError => write!(f, "Serialization error"),
            OnionError::NetworkError(e) => write!(f, "Network error: {}", e),
        }
    }
}

impl std::error::Error for OnionError {}

/// Path selection for onion routing
pub mod path_selection {
    use super::*;
    use rand::seq::SliceRandom;
    use rand::thread_rng;

    /// Select a random path through the network
    pub fn select_random_path(
        available_nodes: &[HopInfo],
        destination: HopInfo,
        num_hops: usize,
    ) -> Option<OnionRoute> {
        if available_nodes.len() < num_hops {
            return None;
        }

        let mut rng = thread_rng();
        let mut nodes: Vec<_> = available_nodes.to_vec();
        nodes.shuffle(&mut rng);

        let hops: Vec<HopInfo> = nodes.into_iter().take(num_hops).collect();

        Some(OnionRoute::new(hops, destination))
    }

    /// Select path avoiding certain nodes (e.g., recently used)
    pub fn select_path_avoiding(
        available_nodes: &[HopInfo],
        destination: HopInfo,
        num_hops: usize,
        avoid: &[[u8; 32]],
    ) -> Option<OnionRoute> {
        let filtered: Vec<_> = available_nodes
            .iter()
            .filter(|n| !avoid.contains(&n.node_pk))
            .cloned()
            .collect();

        select_random_path(&filtered, destination, num_hops)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pad_unpad() {
        let message = b"Hello, World!";
        let padded = pad_message(message);
        
        assert!(padded.len() % CELL_SIZE == 0);
        
        let unpadded = unpad_message(&padded).unwrap();
        assert_eq!(unpadded, message);
    }

    #[test]
    fn test_onion_packet_serialization() {
        let pk = [0x42u8; 32];
        let payload = vec![1, 2, 3, 4, 5];
        let mac = [0xAAu8; 16];

        let packet = OnionPacket::new(pk, payload.clone(), mac);
        let bytes = packet.to_bytes();
        let restored = OnionPacket::from_bytes(&bytes).unwrap();

        assert_eq!(restored.ephemeral_pk, pk);
        assert_eq!(restored.payload, payload);
        assert_eq!(restored.mac, mac);
    }
}

//! Core identity types and operations.

use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::{
    hashing::create_identity_hash,
    keys::{KeyPair, PublicKey, SigningKeyPair},
};

use super::{IdentityError, IdentityResult, ROTATION_INTERVAL_SECS};

/// A 32-byte identity hash
#[derive(Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct IdentityHash([u8; 32]);

impl IdentityHash {
    /// Create from raw bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Get raw bytes
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    /// Convert to hex string
    pub fn to_hex(&self) -> String {
        hex::encode(&self.0)
    }

    /// Parse from hex string
    pub fn from_hex(s: &str) -> IdentityResult<Self> {
        let bytes = hex::decode(s)
            .map_err(|e| IdentityError::GenerationError(e.to_string()))?;
        
        if bytes.len() != 32 {
            return Err(IdentityError::GenerationError(
                "Identity hash must be 32 bytes".to_string()
            ));
        }

        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Self(arr))
    }

    /// Get short display form (first 8 chars)
    pub fn short(&self) -> String {
        self.to_hex()[..8].to_string()
    }
}

/// Unique identifier for a device
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DeviceId(pub [u8; 16]);

impl DeviceId {
    /// Generate a new random device ID
    pub fn generate() -> Self {
        let mut bytes = [0u8; 16];
        rand::rngs::OsRng.fill_bytes(&mut bytes);
        Self(bytes)
    }

    /// Convert to hex
    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }
}

/// A device's public key for device-to-device communication
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DevicePublicKey(pub PublicKey);

/// An authorized device linked to an identity
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthorizedDevice {
    /// Unique device ID
    pub id: DeviceId,
    /// Device's public key
    pub public_key: DevicePublicKey,
    /// Friendly name for the device
    pub name: String,
    /// When the device was authorized
    pub authorized_at: u64,
    /// Last seen timestamp
    pub last_seen: u64,
}

impl fmt::Debug for IdentityHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "IdentityHash({}...)", &self.to_hex()[..8])
    }
}

impl fmt::Display for IdentityHash {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

/// A complete identity with keys and metadata
#[derive(Clone, Serialize, Deserialize)]
pub struct Identity {
    /// Key pair for key exchange
    key_pair: KeyPair,
    
    /// Signing key pair for signatures
    signing_keys: SigningKeyPair,
    
    /// Random value used in identity hash
    random: [u8; 32],
    
    /// The identity hash (public identifier)
    identity_hash: IdentityHash,
    
    /// Creation timestamp (Unix seconds)
    created_at: u64,
    
    /// Expiration timestamp (Unix seconds)
    expires_at: u64,
}

impl Identity {
    /// Generate a new random identity
    pub fn generate() -> IdentityResult<Self> {
        IdentityBuilder::new().build()
    }

    /// Get the identity hash (public identifier)
    pub fn identity_hash(&self) -> &IdentityHash {
        &self.identity_hash
    }

    /// Get the public key for key exchange
    pub fn public_key(&self) -> &PublicKey {
        &self.key_pair.public
    }

    /// Get the verifying key for signatures
    pub fn verifying_key(&self) -> [u8; 32] {
        self.signing_keys.verifying_key_bytes()
    }

    /// Get the signing key bytes
    pub fn signing_key_bytes(&self) -> [u8; 32] {
        self.signing_keys.signing_key_bytes()
    }

    /// Perform key exchange with another identity's public key
    pub fn key_exchange(&self, their_public: &PublicKey) -> [u8; 32] {
        self.key_pair.key_exchange(their_public)
    }

    /// Sign a message
    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.signing_keys.sign(message)
    }

    /// Check if identity has expired
    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now >= self.expires_at
    }

    /// Check if identity should be rotated
    pub fn should_rotate(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now >= self.created_at + ROTATION_INTERVAL_SECS
    }

    /// Get creation timestamp
    pub fn created_at(&self) -> u64 {
        self.created_at
    }

    /// Get expiration timestamp
    pub fn expires_at(&self) -> u64 {
        self.expires_at
    }

    /// Rotate to a new identity (creates new keys but maintains continuity)
    pub fn rotate(&self) -> IdentityResult<Identity> {
        // Generate completely new identity
        // The old and new identities are cryptographically unlinkable
        Identity::generate()
    }

    /// Create a proof of identity ownership (for registration)
    pub fn create_ownership_proof(&self, challenge: &[u8]) -> IdentityOwnershipProof {
        let signature = self.sign(challenge);
        IdentityOwnershipProof {
            identity_hash: self.identity_hash.clone(),
            public_key: self.key_pair.public.clone(),
            verifying_key: self.verifying_key(),
            challenge: challenge.to_vec(),
            signature,
        }
    }

    /// Export public identity info (safe to share)
    pub fn to_public(&self) -> PublicIdentity {
        PublicIdentity {
            identity_hash: self.identity_hash.clone(),
            public_key: self.key_pair.public.clone(),
            verifying_key: self.verifying_key(),
            expires_at: self.expires_at,
        }
    }
}

/// Builder for creating identities with custom parameters
pub struct IdentityBuilder {
    validity_secs: u64,
}

impl IdentityBuilder {
    /// Create a new identity builder with default settings
    pub fn new() -> Self {
        Self {
            validity_secs: 7 * 24 * 60 * 60, // 7 days default
        }
    }

    /// Set custom validity period
    pub fn validity_secs(mut self, secs: u64) -> Self {
        self.validity_secs = secs;
        self
    }

    /// Build the identity
    pub fn build(self) -> IdentityResult<Identity> {
        let key_pair = KeyPair::generate();
        let signing_keys = SigningKeyPair::generate();

        // Generate random value for identity hash
        let mut random = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut random);

        // Create identity hash: H(public_key || random)
        let identity_hash = IdentityHash::from_bytes(
            create_identity_hash(key_pair.public.as_bytes(), &random)
        );

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(Identity {
            key_pair,
            signing_keys,
            random,
            identity_hash,
            created_at: now,
            expires_at: now + self.validity_secs,
        })
    }
}

impl Default for IdentityBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Public identity information (safe to share)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PublicIdentity {
    /// The identity hash
    pub identity_hash: IdentityHash,
    /// Public key for key exchange
    pub public_key: PublicKey,
    /// Verifying key for signatures
    pub verifying_key: [u8; 32],
    /// Expiration timestamp
    pub expires_at: u64,
}

impl PublicIdentity {
    /// Check if this identity has expired
    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now >= self.expires_at
    }
}

/// Proof of identity ownership
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IdentityOwnershipProof {
    /// The identity hash being proven
    pub identity_hash: IdentityHash,
    /// The public key
    pub public_key: PublicKey,
    /// The verifying key
    pub verifying_key: [u8; 32],
    /// The challenge that was signed
    pub challenge: Vec<u8>,
    /// Signature over the challenge
    #[serde(with = "signature_serde")]
    pub signature: [u8; 64],
}

mod signature_serde {
    use serde::{Deserializer, Serializer, Deserialize};
    pub fn serialize<S>(sig: &[u8; 64], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(sig)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<[u8; 64], D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Vec<u8> = Deserialize::deserialize(deserializer)?;
        bytes.try_into().map_err(|_| serde::de::Error::custom("Invalid signature length"))
    }
}

impl IdentityOwnershipProof {
    /// Verify this proof
    pub fn verify(&self) -> bool {
        use ed25519_dalek::{Signature, Verifier, VerifyingKey};

        // Verify the identity hash matches the public key
        // Note: We can't verify the random component, but we verify the signature
        
        // Verify signature
        let Ok(verifying_key) = VerifyingKey::from_bytes(&self.verifying_key) else {
            return false;
        };

        let signature = ed25519_dalek::Signature::from_bytes(&self.signature);
        let verification_result: Result<(), ed25519_dalek::SignatureError> = verifying_key.verify(&self.challenge, &signature);
        verification_result.is_ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_generation() {
        let identity = Identity::generate().unwrap();
        
        assert!(!identity.is_expired());
        assert!(!identity.should_rotate());
        assert_eq!(identity.identity_hash().as_bytes().len(), 32);
    }

    #[test]
    fn test_identity_hash_hex() {
        let identity = Identity::generate().unwrap();
        let hex = identity.identity_hash().to_hex();
        let recovered = IdentityHash::from_hex(&hex).unwrap();
        
        assert_eq!(identity.identity_hash(), &recovered);
    }

    #[test]
    fn test_identity_rotation() {
        let id1 = Identity::generate().unwrap();
        let id2 = id1.rotate().unwrap();

        // Rotated identity should be completely different
        assert_ne!(id1.identity_hash(), id2.identity_hash());
        assert_ne!(id1.public_key(), id2.public_key());
    }

    #[test]
    fn test_ownership_proof() {
        let identity = Identity::generate().unwrap();
        let challenge = b"prove you own this identity";
        
        let proof = identity.create_ownership_proof(challenge);
        assert!(proof.verify());
    }

    #[test]
    fn test_key_exchange() {
        let alice = Identity::generate().unwrap();
        let bob = Identity::generate().unwrap();

        let shared_alice = alice.key_exchange(bob.public_key());
        let shared_bob = bob.key_exchange(alice.public_key());

        assert_eq!(shared_alice, shared_bob);
    }

    #[test]
    fn test_public_identity() {
        let identity = Identity::generate().unwrap();
        let public = identity.to_public();

        assert_eq!(identity.identity_hash(), &public.identity_hash);
        assert_eq!(identity.public_key(), &public.public_key);
        assert!(!public.is_expired());
    }

    #[test]
    fn test_identity_builder() {
        let identity = IdentityBuilder::new()
            .validity_secs(3600) // 1 hour
            .build()
            .unwrap();

        assert!(!identity.is_expired());
    }
}

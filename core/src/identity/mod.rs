//! Decentralized identity management for RED protocol.
//!
//! This module provides:
//! - Ephemeral identity generation
//! - Identity rotation
//! - Zero-knowledge proofs for identity verification
//! - Blockchain registration

mod identity;
mod registry;

pub use identity::{Identity, IdentityHash, IdentityBuilder};
pub use registry::{IdentityRegistry, RegistrationProof};

use serde::{Deserialize, Serialize};

/// Unique device identifier
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DeviceId(pub [u8; 32]);

impl DeviceId {
    pub fn new(bytes: [u8; 32]) -> Self { Self(bytes) }
    pub fn as_bytes(&self) -> &[u8; 32] { &self.0 }
}

/// Device public key (raw bytes)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DevicePublicKey(pub [u8; 32]);

/// An authorized secondary device linked to this identity
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthorizedDevice {
    pub id: DeviceId,
    pub public_key: DevicePublicKey,
    pub name: String,
    pub authorized_at: u64,
}

use thiserror::Error;

/// Identity-related errors
#[derive(Error, Debug)]
pub enum IdentityError {
    /// Identity generation failed
    #[error("Identity generation failed: {0}")]
    GenerationError(String),

    /// Identity not found
    #[error("Identity not found: {0}")]
    NotFound(String),

    /// Identity already exists
    #[error("Identity already registered")]
    AlreadyExists,

    /// Identity expired
    #[error("Identity has expired")]
    Expired,

    /// Invalid proof
    #[error("Invalid identity proof")]
    InvalidProof,

    /// Cryptographic error
    #[error("Crypto error: {0}")]
    CryptoError(#[from] crate::crypto::CryptoError),
}

/// Result type for identity operations
pub type IdentityResult<T> = Result<T, IdentityError>;

/// Identity rotation interval (24 hours)
pub const ROTATION_INTERVAL_SECS: u64 = 24 * 60 * 60;

/// Maximum identity age before forced rotation (7 days)
pub const MAX_IDENTITY_AGE_SECS: u64 = 7 * 24 * 60 * 60;

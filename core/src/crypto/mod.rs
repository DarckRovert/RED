//! Cryptographic primitives for RED protocol.
//!
//! This module provides:
//! - Key generation and management
//! - Symmetric encryption (ChaCha20-Poly1305)
//! - Key exchange (X25519)
//! - Digital signatures (Ed25519)
//! - Hashing (BLAKE3)
//! - Key derivation (HKDF)

pub mod keys;
pub mod encryption;
pub mod hashing;
pub mod ratchet;
pub mod zk_proofs;

pub use keys::{KeyPair, PublicKey, SecretKey, EphemeralKeyPair};
pub use encryption::{encrypt, decrypt, EncryptedData};
pub use hashing::{hash, derive_key};
pub use ratchet::{DoubleRatchet, RatchetState};

use thiserror::Error;

/// Cryptographic errors
#[derive(Error, Debug)]
pub enum CryptoError {
    /// Key generation failed
    #[error("Key generation failed: {0}")]
    KeyGenerationError(String),

    /// Encryption failed
    #[error("Encryption failed: {0}")]
    EncryptionError(String),

    /// Decryption failed
    #[error("Decryption failed: {0}")]
    DecryptionError(String),

    /// Invalid key format
    #[error("Invalid key format: {0}")]
    InvalidKeyFormat(String),

    /// Signature verification failed
    #[error("Signature verification failed")]
    SignatureVerificationFailed,

    /// Key derivation failed
    #[error("Key derivation failed: {0}")]
    KeyDerivationError(String),
}

/// Result type for cryptographic operations
pub type CryptoResult<T> = Result<T, CryptoError>;

/// Size of symmetric keys in bytes
pub const SYMMETRIC_KEY_SIZE: usize = 32;

/// Size of nonces in bytes
pub const NONCE_SIZE: usize = 12;

/// Size of authentication tags in bytes
pub const TAG_SIZE: usize = 16;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(SYMMETRIC_KEY_SIZE, 32);
        assert_eq!(NONCE_SIZE, 12);
        assert_eq!(TAG_SIZE, 16);
    }
}

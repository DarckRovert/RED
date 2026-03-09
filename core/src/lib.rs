//! # RED Core Library
//!
//! Core implementation of the RED (Red Encriptada Descentralizada) protocol.
//!
//! ## Modules
//!
//! - `crypto`: Cryptographic primitives (encryption, signatures, key exchange)
//! - `identity`: Decentralized identity management
//! - `network`: P2P networking layer
//! - `storage`: Local encrypted storage
//! - `protocol`: Message protocol implementation

#![warn(missing_docs)]
#![warn(rust_2018_idioms)]

pub mod crypto;
pub mod ffi;
pub mod identity;
pub mod network;
pub mod protocol;
pub mod storage;

/// Re-exports of commonly used types
pub mod prelude {
    pub use crate::crypto::{KeyPair, PublicKey, SecretKey};
    pub use crate::identity::{Identity, IdentityHash};
    pub use crate::network::NetworkConfig;
    pub use crate::protocol::{Message, MessageId};
    pub use crate::storage::Storage;
}

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Security parameter (256 bits)
pub const SECURITY_PARAMETER: usize = 256;

/// Maximum message size (64 KB)
pub const MAX_MESSAGE_SIZE: usize = 65536;

/// Identity rotation interval (24 hours in seconds)
pub const IDENTITY_ROTATION_INTERVAL: u64 = 86400;

/// Message retention period (30 days in seconds)
pub const MESSAGE_RETENTION_PERIOD: u64 = 30 * 24 * 60 * 60;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(SECURITY_PARAMETER, 256);
        assert_eq!(MAX_MESSAGE_SIZE, 65536);
        assert_eq!(IDENTITY_ROTATION_INTERVAL, 86400);
    }
}

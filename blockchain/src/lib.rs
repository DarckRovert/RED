//! # RED Blockchain
//!
//! Lightweight blockchain for decentralized identity management.
//!
//! This blockchain is used ONLY for:
//! - Identity registration
//! - Identity revocation
//! - Public key directory
//!
//! Messages are NOT stored on the blockchain.

#![warn(missing_docs)]
#![forbid(unsafe_code)]

pub mod block;
pub mod chain;
pub mod consensus;
pub mod transaction;
pub mod store;

use thiserror::Error;

/// Blockchain errors
#[derive(Error, Debug)]
pub enum BlockchainError {
    /// Invalid block
    #[error("Invalid block: {0}")]
    InvalidBlock(String),

    /// Invalid transaction
    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),

    /// Block not found
    #[error("Block not found: {0}")]
    BlockNotFound(String),

    /// Chain error
    #[error("Chain error: {0}")]
    ChainError(String),

    /// Consensus error
    #[error("Consensus error: {0}")]
    ConsensusError(String),

    /// Storage error
    #[error("Storage error: {0}")]
    StorageError(String),
}

/// Result type for blockchain operations
pub type BlockchainResult<T> = Result<T, BlockchainError>;

/// Block time in seconds
pub const BLOCK_TIME_SECS: u64 = 6;

/// Maximum transactions per block
pub const MAX_TXS_PER_BLOCK: usize = 1000;

/// Minimum stake to become a validator (in smallest unit)
pub const MIN_VALIDATOR_STAKE: u64 = 1000_000_000_000; // 1000 RED

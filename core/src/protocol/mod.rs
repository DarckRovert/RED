//! Message protocol for RED.
//!
//! This module provides:
//! - Message types and serialization
//! - Conversation management
//! - Group messaging

mod message;
mod conversation;
pub mod group;

pub use message::{Message, MessageId, MessageType, MessageStatus};
pub use conversation::{Conversation, ConversationId};
pub use group::{Group, GroupId, GroupMember, GroupMessage, MemberRole, GroupError};

use thiserror::Error;

/// Protocol-related errors
#[derive(Error, Debug)]
pub enum ProtocolError {
    /// Message too large
    #[error("Message too large: {0} bytes (max: {1})")]
    MessageTooLarge(usize, usize),

    /// Invalid message format
    #[error("Invalid message format: {0}")]
    InvalidFormat(String),

    /// Conversation not found
    #[error("Conversation not found: {0}")]
    ConversationNotFound(String),

    /// Duplicate message
    #[error("Duplicate message: {0}")]
    DuplicateMessage(String),

    /// Crypto error
    #[error("Crypto error: {0}")]
    CryptoError(#[from] crate::crypto::CryptoError),
}

/// Result type for protocol operations
pub type ProtocolResult<T> = Result<T, ProtocolError>;

/// Protocol version
pub const PROTOCOL_VERSION: u32 = 1;

/// Maximum message size (64 KB)
pub const MAX_MESSAGE_SIZE: usize = 65536;

//! Message protocol for RED.
//!
//! This module provides:
//! - Message types and serialization
//! - Conversation management
//! - Group messaging

mod conversation;
pub mod group;
mod message;
pub mod tactical;

pub use conversation::{Conversation, ConversationId};
pub use group::{Group, GroupError, GroupId, GroupMember, GroupMessage, MemberRole};
pub use message::{
    MedicalTriagePayload, Message, MessageId, MessageStatus, MessageType, P2PVoucherPayload,
    SocialPostPayload,
};
pub use tactical::{
    AlertStatus, AmberAlert, AmberSighting, ChannelMessage, ChannelSummaryResponse, ChunkManifest,
    CleanImageRequest, CleanImageResponse, CopilotQueryRequest, CopilotResponse,
    CreateAmberAlertRequest, EcoMeshStatus, EphemeralConfig, FileChunk, GuardianMode,
    GuardianVerdict, PostChannelMessageRequest, PostRequest, PostWeatherReportRequest,
    ProximityDigest, ProximityFilterConfig, ProximityNode, RegisterBleDeviceRequest,
    ReportSightingRequest, ResolveAmberAlertRequest, SafeZone, SendVoiceBurstRequest, SocialPost,
    SosBeacon, SosReportRequest, SplitFileRequest, SummarizeChannelRequest, TranslateRequest,
    TranslateResponse, VoiceBurst, WaveHandshakeRequest, WeatherReport, AMBER_GOSSIP_TOPIC,
    DEFAULT_ALERT_TTL_SECS, MAX_LOCAL_POSTS,
};

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

/// Maximum message size (2 MB for multimedia, compressed photos, voice notes & video clips)
pub const MAX_MESSAGE_SIZE: usize = 2 * 1024 * 1024;

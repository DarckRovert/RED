//! Message protocol for RED.
//!
//! This module provides:
//! - Message types and serialization
//! - Conversation management
//! - Group messaging

mod message;
mod conversation;
pub mod group;
pub mod tactical;

pub use message::{Message, MessageType, MessageId, MessageStatus, SocialPostPayload, P2PVoucherPayload, MedicalTriagePayload};
pub use conversation::{Conversation, ConversationId};
pub use group::{Group, GroupId, GroupMember, GroupMessage, MemberRole, GroupError};
pub use tactical::{
    AlertStatus, AmberAlert, AmberSighting, CreateAmberAlertRequest, ReportSightingRequest, ResolveAmberAlertRequest,
    SosBeacon, SosReportRequest, WeatherReport, PostWeatherReportRequest, ChannelMessage, PostChannelMessageRequest,
    SocialPost, PostRequest, GuardianVerdict, GuardianMode, VoiceBurst, SendVoiceBurstRequest, EphemeralConfig,
    ProximityNode, RegisterBleDeviceRequest, WaveHandshakeRequest, SafeZone, ProximityFilterConfig, ProximityDigest,
    EcoMeshStatus, CleanImageRequest, CleanImageResponse, FileChunk, ChunkManifest, SplitFileRequest,
    CopilotQueryRequest, CopilotResponse, SummarizeChannelRequest, ChannelSummaryResponse, TranslateRequest, TranslateResponse,
    AMBER_GOSSIP_TOPIC, DEFAULT_ALERT_TTL_SECS, MAX_LOCAL_POSTS,
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

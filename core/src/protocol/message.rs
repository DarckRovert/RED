//! Message types and handling.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::encryption::EncryptedData;
use crate::identity::IdentityHash;

use super::{ProtocolError, ProtocolResult, MAX_MESSAGE_SIZE};

/// Unique message identifier
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct MessageId([u8; 32]);

impl MessageId {
    /// Generate a new random message ID
    pub fn generate() -> Self {
        let uuid = uuid::Uuid::new_v4();
        let mut bytes = [0u8; 32];
        bytes[..16].copy_from_slice(uuid.as_bytes());
        
        // Add timestamp for uniqueness
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos() as u64;
        bytes[16..24].copy_from_slice(&timestamp.to_le_bytes());
        
        // Fill rest with random
        use rand::RngCore;
        rand::rngs::OsRng.fill_bytes(&mut bytes[24..]);
        
        Self(bytes)
    }

    /// Create from bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Get bytes
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    /// Convert to hex
    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }

    /// Parse from 64-char hex string
    pub fn from_hex(s: &str) -> Result<Self, String> {
        let bytes = hex::decode(s).map_err(|e| e.to_string())?;
        if bytes.len() != 32 {
            return Err(format!("Expected 32 bytes, got {}", bytes.len()));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Self(arr))
    }
}

impl std::fmt::Display for MessageId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", &self.to_hex()[..16])
    }
}

/// Message type
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum MessageType {
    /// Plain text message
    Text(String),
    /// Image (base64 encoded)
    Image {
        data: Vec<u8>,
        mime_type: String,
        width: u32,
        height: u32,
    },
    /// File attachment
    File {
        data: Vec<u8>,
        filename: String,
        mime_type: String,
    },
    /// Voice message
    Voice {
        data: Vec<u8>,
        duration_ms: u32,
    },
    /// Video message
    Video {
        data: Vec<u8>,
        duration_ms: u32,
        mime_type: String,
        width: u32,
        height: u32,
    },
    /// Location
    Location {
        latitude: f64,
        longitude: f64,
        accuracy: Option<f32>,
    },
    /// Contact card
    Contact {
        identity_hash: IdentityHash,
        display_name: String,
    },
    /// Reaction to another message
    Reaction {
        target_message_id: MessageId,
        emoji: String,
    },
    /// Message deletion request
    Delete {
        target_message_id: MessageId,
    },
    /// Read receipt
    ReadReceipt {
        message_ids: Vec<MessageId>,
    },
    /// Typing indicator
    Typing {
        is_typing: bool,
    },
    /// Encrypted group message using SenderKey
    GroupPayload(crate::protocol::group::GroupMessage),
    /// Group Invitation / Descriptor Distribution (v64.1)
    GroupInvite {
        group_id: [u8; 32],
        group_name: String,
        creator_hash: IdentityHash,
        members: Vec<IdentityHash>,
        created_at: u64,
    },
    /// Timer update for disappearing messages
    TimerUpdate {
        seconds: u32,
    },
    /// Ephemeral message with expiration
    Ephemeral {
        expires_at: u64,
        content: Box<MessageType>,
    },
    /// Social Feed P2P post (v25.0)
    SocialPost(Vec<u8>),
    /// Weather Barometric Off-grid report
    WeatherReport(Vec<u8>),
    /// Presence beacon — emitted periodically to signal that a node is online.
    /// `last_seen` is Unix ms; `online` true = connected, false = graceful offline.
    PresenceBeacon {
        last_seen: u64,
        online: bool,
    },
    /// Profile Sync Request (v31.0)
    ProfileSyncRequest,
    /// Profile Sync Response (v31.0)
    ProfileSyncResponse {
        avatar: Option<String>,
        bio: Option<String>,
    },
    /// Sovereign P2P Offline Voucher & Payment (v32.0)
    P2PVoucher(Vec<u8>),
    /// Radio Frequency Hop Coordination Frame (v33.0)
    ChannelHopCoordination {
        target_channel: u8,
        frequency_mhz: u32,
        reason: String,
        timestamp: u64,
    },
    /// Medical Triage & START Victim Report (v35.0)
    MedicalTriageReport(Vec<u8>),
    /// Tactical Emergency SOS Beacon (v36.0)
    /// Tactical Emergency SOS Beacon (v36.0)
    EmergencyBeacon {
        beacon_id: String,
        distress_type: String,
        latitude: Option<f64>,
        longitude: Option<f64>,
        altitude: Option<f64>,
        battery_level: Option<u8>,
        message: String,
        active: bool,
        timestamp: u64,
    },
    /// WebRTC P2P Call Signaling (Offer, Answer, ICE Candidates, Hangup)
    WebRTCSignal(String),
    /// Contact Request handshake payload (sender_hash, sender_name, etc.)
    ContactRequest(String),
    /// Contact Response handshake payload
    ContactResponse(String),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MedicalTriagePayload {
    pub id: String,
    pub victim_label: String,
    pub category: String,
    pub bpm: Option<u32>,
    pub spo2: Option<u32>,
    pub can_walk: bool,
    pub is_breathing: bool,
    pub resp_rate: u32,
    pub cap_refill_sec: f32,
    pub can_follow_commands: bool,
    pub notes: String,
    pub evaluator_hash: crate::identity::IdentityHash,
    pub evaluator_name: String,
    pub timestamp: u64,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct P2PVoucherPayload {
    pub id: String,
    pub creator_hash: crate::identity::IdentityHash,
    pub creator_name: String,
    pub recipient: String,
    pub amount: f64,
    pub timestamp: u64,
    pub verifying_key: [u8; 32],
    pub signature: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SocialPostPayload {
    pub id: String,
    pub author_name: String,
    pub content: String,
    pub media_data: Option<String>,
    pub timestamp: u64,
    pub reply_to: Option<String>,
}


impl MessageType {
    /// Get the size of this message type in bytes
    pub fn size(&self) -> usize {
        match self {
            MessageType::Text(s) => s.len(),
            MessageType::Image { data, .. } => data.len(),
            MessageType::File { data, .. } => data.len(),
            MessageType::Voice { data, .. } => data.len(),
            MessageType::Video { data, .. } => data.len(),
            MessageType::Location { .. } => 24,
            MessageType::Contact { .. } => 64,
            MessageType::Reaction { .. } => 48,
            MessageType::Delete { .. } => 32,
            MessageType::ReadReceipt { message_ids } => message_ids.len() * 32,
            MessageType::Typing { .. } => 1,
            MessageType::GroupPayload(msg) => msg.ciphertext.len() + 68,
            MessageType::GroupInvite { group_name, members, .. } => 72 + group_name.len() + members.len() * 32,
            MessageType::TimerUpdate { .. } => 4,
            MessageType::Ephemeral { content, .. } => 8 + content.size(),
            MessageType::SocialPost(data) => data.len(),
            MessageType::WeatherReport(data) => data.len(),
            MessageType::PresenceBeacon { .. } => 9,
            MessageType::ProfileSyncRequest => 1,
            MessageType::ProfileSyncResponse { avatar, bio } => {
                avatar.as_ref().map_or(0, |a| a.len()) + bio.as_ref().map_or(0, |b| b.len())
            }
            MessageType::P2PVoucher(data) => data.len(),
            MessageType::ChannelHopCoordination { reason, .. } => 16 + reason.len(),
            MessageType::MedicalTriageReport(data) => data.len(),
            MessageType::EmergencyBeacon { beacon_id, distress_type, message, .. } => 32 + beacon_id.len() + distress_type.len() + message.len(),
            MessageType::WebRTCSignal(signal) => signal.len(),
            MessageType::ContactRequest(payload) => payload.len(),
            MessageType::ContactResponse(payload) => payload.len(),
        }
    }

    /// Check if this is a control message (not user content)
    pub fn is_control(&self) -> bool {
        match self {
            MessageType::ReadReceipt { .. } | MessageType::Typing { .. } | MessageType::TimerUpdate { .. } | MessageType::PresenceBeacon { .. } | MessageType::ChannelHopCoordination { .. } | MessageType::WebRTCSignal(_) | MessageType::ContactRequest(_) | MessageType::ContactResponse(_) | MessageType::GroupInvite { .. } => true,
            MessageType::Ephemeral { content, .. } => content.is_control(),
            _ => false,
        }
    }
}

/// Message delivery status
#[derive(Clone, Debug, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum MessageStatus {
    /// Message is being prepared
    #[default]
    Pending,
    /// Message sent to network
    Sent,
    /// Message delivered to recipient's device
    Delivered,
    /// Message read by recipient
    Read,
    /// Message delivery failed
    Failed(String),
}

/// A complete message
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Message {
    /// Unique message ID
    pub id: MessageId,
    /// Sender's identity hash
    pub sender: IdentityHash,
    /// Recipient's identity hash
    pub recipient: IdentityHash,
    /// Message content
    pub content: MessageType,
    /// Timestamp (Unix milliseconds)
    pub timestamp: u64,
    /// Optional reply-to message ID
    pub reply_to: Option<MessageId>,
    /// Message status
    #[serde(skip)]
    pub status: MessageStatus,
    /// Whether this message has been edited
    #[serde(default)]
    pub edited: bool,
}

impl Message {
    /// Create a new text message
    pub fn text(
        sender: IdentityHash,
        recipient: IdentityHash,
        text: impl Into<String>,
    ) -> ProtocolResult<Self> {
        let text = text.into();
        
        if text.len() > MAX_MESSAGE_SIZE {
            return Err(ProtocolError::MessageTooLarge(text.len(), MAX_MESSAGE_SIZE));
        }

        Ok(Self {
            id: MessageId::generate(),
            sender,
            recipient,
            content: MessageType::Text(text),
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            reply_to: None,
            status: MessageStatus::Pending,
            edited: false,
        })
    }

    /// Create a reply to another message
    pub fn reply(
        sender: IdentityHash,
        recipient: IdentityHash,
        text: impl Into<String>,
        reply_to: MessageId,
    ) -> ProtocolResult<Self> {
        let mut msg = Self::text(sender, recipient, text)?;
        msg.reply_to = Some(reply_to);
        Ok(msg)
    }

    /// Serialize message for encryption
    pub fn serialize(&self) -> ProtocolResult<Vec<u8>> {
        bincode::serialize(self)
            .map_err(|e| ProtocolError::InvalidFormat(e.to_string()))
    }

    /// Deserialize message
    pub fn deserialize(bytes: &[u8]) -> ProtocolResult<Self> {
        bincode::deserialize(bytes)
            .map_err(|e| ProtocolError::InvalidFormat(e.to_string()))
    }

    /// Get message size
    pub fn size(&self) -> usize {
        self.content.size() + 128 // Content + metadata overhead
    }

    /// Check if message is too large
    pub fn is_too_large(&self) -> bool {
        self.size() > MAX_MESSAGE_SIZE
    }
}

/// Encrypted message ready for transport
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EncryptedMessage {
    /// Message ID (not encrypted, for deduplication)
    pub id: MessageId,
    /// Sender's ephemeral public key
    pub sender_ephemeral_pk: [u8; 32],
    /// Encrypted content
    pub encrypted: EncryptedData,
    /// Timestamp
    pub timestamp: u64,
}

/// A 3-hop Onion Routing envelope ensuring total anonymity
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OnionPacket {
    /// The target relay or final destination for this hop (IdentityHash/PeerId)
    pub target_node: [u8; 32],
    /// The encrypted inner payload (either another OnionPacket or an EncryptedMessage)
    pub payload: Vec<u8>,
    /// Ephemeral public key used exclusively to decrypt this specific routing layer
    pub ephemeral_key: [u8; 32],
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_identity() -> IdentityHash {
        IdentityHash::from_bytes([0x42u8; 32])
    }

    #[test]
    fn test_message_id_generation() {
        let id1 = MessageId::generate();
        let id2 = MessageId::generate();
        
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_text_message() {
        let sender = create_test_identity();
        let recipient = IdentityHash::from_bytes([0x43u8; 32]);
        
        let msg = Message::text(sender.clone(), recipient.clone(), "Hello!").unwrap();
        
        assert_eq!(msg.sender, sender);
        assert_eq!(msg.recipient, recipient);
        assert!(matches!(msg.content, MessageType::Text(_)));
        assert_eq!(msg.status, MessageStatus::Pending);
    }

    #[test]
    fn test_message_serialization() {
        let sender = create_test_identity();
        let recipient = IdentityHash::from_bytes([0x43u8; 32]);
        
        let msg = Message::text(sender, recipient, "Test").unwrap();
        let bytes = msg.serialize().unwrap();
        let recovered = Message::deserialize(&bytes).unwrap();
        
        assert_eq!(msg.id, recovered.id);
    }

    #[test]
    fn test_message_too_large() {
        let sender = create_test_identity();
        let recipient = IdentityHash::from_bytes([0x43u8; 32]);
        let large_text = "x".repeat(MAX_MESSAGE_SIZE + 1);
        
        let result = Message::text(sender, recipient, large_text);
        
        assert!(matches!(result, Err(ProtocolError::MessageTooLarge(_, _))));
    }
}

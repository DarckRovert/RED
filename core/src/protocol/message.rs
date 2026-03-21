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
        hex::encode(&self.0)
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
    /// Timer update for disappearing messages
    TimerUpdate {
        seconds: u32,
    },
    /// Ephemeral message with expiration
    Ephemeral {
        expires_at: u64,
        content: Box<MessageType>,
    },
}

impl MessageType {
    /// Get the size of this message type in bytes
    pub fn size(&self) -> usize {
        match self {
            MessageType::Text(s) => s.len(),
            MessageType::Image { data, .. } => data.len(),
            MessageType::File { data, .. } => data.len(),
            MessageType::Voice { data, .. } => data.len(),
            MessageType::Location { .. } => 24,
            MessageType::Contact { .. } => 64,
            MessageType::Reaction { .. } => 48,
            MessageType::Delete { .. } => 32,
            MessageType::ReadReceipt { message_ids } => message_ids.len() * 32,
            MessageType::Typing { .. } => 1,
            MessageType::GroupPayload(msg) => msg.ciphertext.len() + 68,
            MessageType::TimerUpdate { .. } => 4,
            MessageType::Ephemeral { content, .. } => 8 + content.size(),
        }
    }

    /// Check if this is a control message (not user content)
    pub fn is_control(&self) -> bool {
        match self {
            MessageType::ReadReceipt { .. } | MessageType::Typing { .. } | MessageType::TimerUpdate { .. } => true,
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

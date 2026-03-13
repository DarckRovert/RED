//! Conversation management.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::crypto::ratchet::{DoubleRatchet, RatchetMessage};
use crate::identity::IdentityHash;

use super::{Message, MessageId, MessageStatus, ProtocolError, ProtocolResult};

/// Unique conversation identifier
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ConversationId([u8; 32]);

impl ConversationId {
    /// Create from two identity hashes (order-independent)
    pub fn from_participants(a: &IdentityHash, b: &IdentityHash) -> Self {
        use crate::crypto::hashing::hash_many;
        
        // Sort to ensure same ID regardless of order
        let (first, second) = if a.as_bytes() < b.as_bytes() {
            (a.as_bytes(), b.as_bytes())
        } else {
            (b.as_bytes(), a.as_bytes())
        };

        Self(hash_many(&[first, second]))
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

impl std::fmt::Display for ConversationId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", &self.to_hex()[..16])
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Conversation {
    /// Conversation ID
    pub id: ConversationId,
    /// Our identity in this conversation
    pub our_identity: IdentityHash,
    /// Their identity
    pub their_identity: IdentityHash,
    /// Double ratchet state
    ratchet: Option<DoubleRatchet>,
    /// Message history (in memory)
    messages: Vec<Message>,
    /// Message index by ID
    message_index: HashMap<MessageId, usize>,
    /// Unread message count
    pub unread_count: usize,
    /// Last activity timestamp
    pub last_activity: u64,
    /// Is the other party currently typing
    pub is_typing: bool,
    /// Disappearing message timer in seconds (None = disabled)
    pub disappearing_timer: Option<u32>,
}

impl Conversation {
    /// Create a new conversation
    pub fn new(our_identity: IdentityHash, their_identity: IdentityHash) -> Self {
        let id = ConversationId::from_participants(&our_identity, &their_identity);
        
        Self {
            id,
            our_identity,
            their_identity,
            ratchet: None,
            messages: Vec::new(),
            message_index: HashMap::new(),
            unread_count: 0,
            last_activity: 0,
            is_typing: false,
            disappearing_timer: None,
        }
    }

    /// Prune expired messages from the conversation
    pub fn prune_expired(&mut self, now_ms: u64) -> usize {
        let mut count = 0;
        let mut i = 0;
        while i < self.messages.len() {
            let expires_at = if let crate::protocol::MessageType::Ephemeral { expires_at, .. } = self.messages[i].content {
                Some(expires_at)
            } else {
                None
            };

            if let Some(expiry) = expires_at {
                if now_ms >= expiry {
                    self.messages.remove(i);
                    count += 1;
                    continue;
                }
            }
            i += 1;
        }

        if count > 0 {
            // Rebuild index
            self.message_index.clear();
            for (idx, msg) in self.messages.iter().enumerate() {
                self.message_index.insert(msg.id.clone(), idx);
            }
        }
        count
    }

    /// Initialize the ratchet (as initiator)
    pub fn init_as_initiator(
        &mut self,
        shared_secret: [u8; 32],
        their_public: crate::crypto::keys::PublicKey,
    ) -> ProtocolResult<()> {
        self.ratchet = Some(
            DoubleRatchet::new_initiator(shared_secret, their_public)?
        );
        Ok(())
    }

    /// Initialize the ratchet (as responder)
    pub fn init_as_responder(
        &mut self,
        shared_secret: [u8; 32],
        our_keypair: crate::crypto::keys::KeyPair,
    ) -> ProtocolResult<()> {
        self.ratchet = Some(
            DoubleRatchet::new_responder(shared_secret, our_keypair)?
        );
        Ok(())
    }

    /// Encrypt a message for sending
    pub fn encrypt_message(&mut self, message: &Message) -> ProtocolResult<RatchetMessage> {
        let ratchet = self.ratchet.as_mut()
            .ok_or_else(|| ProtocolError::InvalidFormat("Ratchet not initialized".to_string()))?;
        
        let serialized = message.serialize()?;
        let encrypted = ratchet.encrypt(&serialized)?;
        
        Ok(encrypted)
    }

    /// Decrypt a received message
    pub fn decrypt_message(&mut self, encrypted: &RatchetMessage) -> ProtocolResult<Message> {
        let ratchet = self.ratchet.as_mut()
            .ok_or_else(|| ProtocolError::InvalidFormat("Ratchet not initialized".to_string()))?;
        
        let decrypted = ratchet.decrypt(encrypted)?;
        let message = Message::deserialize(&decrypted)?;
        
        Ok(message)
    }

    /// Add a message to the conversation
    pub fn add_message(&mut self, message: Message) -> ProtocolResult<()> {
        if self.message_index.contains_key(&message.id) {
            return Err(ProtocolError::DuplicateMessage(message.id.to_hex()));
        }

        // Do not persist transient control messages like Typing indicators
        if message.content.is_control() {
            return Ok(());
        }

        let index = self.messages.len();
        self.message_index.insert(message.id.clone(), index);
        
        // Update last activity
        self.last_activity = message.timestamp;
        
        // Increment unread if from other party
        if message.sender == self.their_identity {
            self.unread_count += 1;
        }

        self.messages.push(message);
        Ok(())
    }

    /// Get a message by ID
    pub fn get_message(&self, id: &MessageId) -> Option<&Message> {
        self.message_index.get(id).map(|&i| &self.messages[i])
    }

    /// Get all messages
    pub fn messages(&self) -> &[Message] {
        &self.messages
    }

    /// Get recent messages
    pub fn recent_messages(&self, count: usize) -> &[Message] {
        let start = self.messages.len().saturating_sub(count);
        &self.messages[start..]
    }

    /// Mark all messages as read
    pub fn mark_all_read(&mut self) {
        self.unread_count = 0;
    }

    /// Update message status
    pub fn update_message_status(&mut self, id: &MessageId, status: MessageStatus) {
        if let Some(&index) = self.message_index.get(id) {
            self.messages[index].status = status;
        }
    }

    /// Get message count
    pub fn message_count(&self) -> usize {
        self.messages.len()
    }

    /// Check if conversation is initialized
    pub fn is_initialized(&self) -> bool {
        self.ratchet.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_identity(seed: u8) -> IdentityHash {
        IdentityHash::from_bytes([seed; 32])
    }

    #[test]
    fn test_conversation_id_order_independent() {
        let a = create_test_identity(0x01);
        let b = create_test_identity(0x02);

        let id1 = ConversationId::from_participants(&a, &b);
        let id2 = ConversationId::from_participants(&b, &a);

        assert_eq!(id1, id2);
    }

    #[test]
    fn test_conversation_creation() {
        let our = create_test_identity(0x01);
        let their = create_test_identity(0x02);

        let conv = Conversation::new(our.clone(), their.clone());

        assert_eq!(conv.our_identity, our);
        assert_eq!(conv.their_identity, their);
        assert_eq!(conv.message_count(), 0);
        assert!(!conv.is_initialized());
    }

    #[test]
    fn test_add_message() {
        let our = create_test_identity(0x01);
        let their = create_test_identity(0x02);

        let mut conv = Conversation::new(our.clone(), their.clone());
        let msg = Message::text(our, their, "Hello!").unwrap();
        let msg_id = msg.id.clone();

        conv.add_message(msg).unwrap();

        assert_eq!(conv.message_count(), 1);
        assert!(conv.get_message(&msg_id).is_some());
    }

    #[test]
    fn test_duplicate_message() {
        let our = create_test_identity(0x01);
        let their = create_test_identity(0x02);

        let mut conv = Conversation::new(our.clone(), their.clone());
        let msg = Message::text(our, their, "Hello!").unwrap();

        conv.add_message(msg.clone()).unwrap();
        let result = conv.add_message(msg);

        assert!(matches!(result, Err(ProtocolError::DuplicateMessage(_))));
    }

    #[test]
    fn test_unread_count() {
        let our = create_test_identity(0x01);
        let their = create_test_identity(0x02);

        let mut conv = Conversation::new(our.clone(), their.clone());
        
        // Message from them
        let msg1 = Message::text(their.clone(), our.clone(), "Hi!").unwrap();
        conv.add_message(msg1).unwrap();
        assert_eq!(conv.unread_count, 1);

        // Message from us
        let msg2 = Message::text(our, their, "Hello!").unwrap();
        conv.add_message(msg2).unwrap();
        assert_eq!(conv.unread_count, 1); // Still 1

        conv.mark_all_read();
        assert_eq!(conv.unread_count, 0);
    }
}

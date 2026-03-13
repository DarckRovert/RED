//! Group Messaging Protocol
//!
//! Implements secure group messaging with:
//! - Sender Keys for efficient group encryption
//! - Member management (add/remove)
//! - Group key rotation
//! - Forward secrecy within groups

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::crypto::{
    encryption::{encrypt, decrypt},
    hashing::blake3_hash,
    keys::{KeyPair, PublicKey},
};
use crate::identity::IdentityHash;

/// Unique identifier for a group
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GroupId(pub [u8; 32]);

impl GroupId {
    /// Generate a new random group ID
    pub fn generate() -> Self {
        let mut bytes = [0u8; 32];
        getrandom::getrandom(&mut bytes).expect("Failed to generate random bytes");
        Self(bytes)
    }

    /// Create from bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }
}

/// Group member information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroupMember {
    /// Member's identity hash
    pub identity_hash: IdentityHash,
    /// Member's public key for group messages
    pub public_key: PublicKey,
    /// When the member joined
    pub joined_at: u64,
    /// Member role
    pub role: MemberRole,
}

/// Member roles in a group
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemberRole {
    /// Can manage members and settings
    Admin,
    /// Regular member
    Member,
}

/// Sender Key for efficient group encryption
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SenderKey {
    /// Chain key for deriving message keys
    chain_key: [u8; 32],
    /// Signature key for authenticating messages
    signature_key: KeyPair,
    /// Current iteration
    iteration: u32,
}

impl SenderKey {
    /// Generate a new sender key
    pub fn generate() -> Self {
        let mut chain_key = [0u8; 32];
        getrandom::getrandom(&mut chain_key).expect("Failed to generate random bytes");
        
        Self {
            chain_key,
            signature_key: KeyPair::generate(),
            iteration: 0,
        }
    }

    /// Derive the next message key
    pub fn next_message_key(&mut self) -> [u8; 32] {
        let message_key = blake3_hash(&[&self.chain_key[..], &[0x01]].concat());
        self.chain_key = blake3_hash(&[&self.chain_key[..], &[0x02]].concat());
        self.iteration += 1;
        message_key
    }

    /// Get the public signature key
    pub fn public_key(&self) -> &PublicKey {
        &self.signature_key.public
    }

    /// Get current iteration
    pub fn iteration(&self) -> u32 {
        self.iteration
    }
}

/// Distributed Sender Key for a member
#[derive(Clone, Serialize, Deserialize)]
pub struct DistributedSenderKey {
    /// The chain key (encrypted for recipient)
    pub encrypted_chain_key: Vec<u8>,
    /// Public signature key
    pub signature_public_key: PublicKey,
    /// Starting iteration
    pub iteration: u32,
}

/// Group state
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Group {
    /// Group identifier
    pub id: GroupId,
    /// Group name
    pub name: String,
    /// Group members
    members: HashMap<IdentityHash, GroupMember>,
    /// Our sender key
    our_sender_key: SenderKey,
    /// Other members' sender keys
    member_sender_keys: HashMap<IdentityHash, SenderKey>,
    /// Group creation time
    pub created_at: u64,
    /// Last activity time
    pub last_activity: u64,
}

impl Group {
    /// Create a new group
    pub fn create(name: String, creator: GroupMember) -> Self {
        let id = GroupId::generate();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut members = HashMap::new();
        let creator_hash = creator.identity_hash.clone();
        members.insert(creator_hash, creator);

        Self {
            id,
            name,
            members,
            our_sender_key: SenderKey::generate(),
            member_sender_keys: HashMap::new(),
            created_at: now,
            last_activity: now,
        }
    }

    /// Add a member to the group
    pub fn add_member(&mut self, member: GroupMember) -> Result<(), GroupError> {
        if self.members.contains_key(&member.identity_hash) {
            return Err(GroupError::MemberAlreadyExists);
        }

        self.members.insert(member.identity_hash.clone(), member);
        
        // Rotate sender key when adding members for forward secrecy
        self.rotate_sender_key();
        
        Ok(())
    }

    /// Remove a member from the group
    pub fn remove_member(&mut self, identity_hash: &IdentityHash) -> Result<(), GroupError> {
        if !self.members.contains_key(identity_hash) {
            return Err(GroupError::MemberNotFound);
        }

        self.members.remove(identity_hash);
        self.member_sender_keys.remove(identity_hash);
        
        // Rotate sender key when removing members
        self.rotate_sender_key();
        
        Ok(())
    }

    /// Rotate our sender key
    pub fn rotate_sender_key(&mut self) {
        self.our_sender_key = SenderKey::generate();
    }

    /// Encrypt a message for the group
    pub fn encrypt_message(&mut self, plaintext: &[u8]) -> Result<GroupMessage, GroupError> {
        let message_key = self.our_sender_key.next_message_key();
        
        let ciphertext = encrypt(&message_key, plaintext)
            .map_err(|_| GroupError::EncryptionFailed)?;

        Ok(GroupMessage {
            group_id: self.id.clone(),
            sender_key_id: self.our_sender_key.public_key().clone(),
            iteration: self.our_sender_key.iteration() - 1,
            ciphertext: ciphertext.to_bytes(),
        })
    }

    /// Decrypt a message from the group
    pub fn decrypt_message(
        &mut self,
        message: &GroupMessage,
        sender: &IdentityHash,
    ) -> Result<Vec<u8>, GroupError> {
        let sender_key = self.member_sender_keys.get_mut(sender)
            .ok_or(GroupError::SenderKeyNotFound)?;

        // Advance to correct iteration
        while sender_key.iteration() < message.iteration {
            sender_key.next_message_key();
        }

        let message_key = sender_key.next_message_key();
        
        let encrypted = crate::crypto::encryption::EncryptedData::from_bytes(&message.ciphertext)
            .map_err(|_| GroupError::DecryptionFailed)?;
        
        decrypt(&message_key, &encrypted)
            .map_err(|_| GroupError::DecryptionFailed)
    }

    /// Get all members
    pub fn members(&self) -> impl Iterator<Item = &GroupMember> {
        self.members.values()
    }

    /// Get member count
    pub fn member_count(&self) -> usize {
        self.members.len()
    }

    /// Check if identity is a member
    pub fn is_member(&self, identity_hash: &IdentityHash) -> bool {
        self.members.contains_key(identity_hash)
    }

    /// Check if identity is an admin
    pub fn is_admin(&self, identity_hash: &IdentityHash) -> bool {
        self.members.get(identity_hash)
            .map(|m| m.role == MemberRole::Admin)
            .unwrap_or(false)
    }

    /// Store a member's sender key
    pub fn store_sender_key(
        &mut self,
        member: &IdentityHash,
        sender_key: SenderKey,
    ) {
        self.member_sender_keys.insert(member.clone(), sender_key);
    }

    /// Distribute our sender key to a member
    pub fn distribute_sender_key(
        &self,
        _recipient_pk: &PublicKey,
        our_sk: &[u8; 32],
    ) -> Result<DistributedSenderKey, GroupError> {
        // Encrypt chain key for recipient using their public key
        // In practice, this would use the pairwise session
        let encrypted_chain_key = encrypt(our_sk, &self.our_sender_key.chain_key)
            .map_err(|_| GroupError::EncryptionFailed)?
            .to_bytes();

        Ok(DistributedSenderKey {
            encrypted_chain_key,
            signature_public_key: self.our_sender_key.public_key().clone(),
            iteration: self.our_sender_key.iteration(),
        })
    }
}

/// Encrypted group message
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroupMessage {
    /// Group identifier
    pub group_id: GroupId,
    /// Sender's key identifier
    pub sender_key_id: PublicKey,
    /// Message iteration
    pub iteration: u32,
    /// Encrypted content
    pub ciphertext: Vec<u8>,
}

/// Group-related errors
#[derive(Debug, Clone)]
pub enum GroupError {
    MemberAlreadyExists,
    MemberNotFound,
    SenderKeyNotFound,
    EncryptionFailed,
    DecryptionFailed,
    NotAuthorized,
}

impl std::fmt::Display for GroupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GroupError::MemberAlreadyExists => write!(f, "Member already exists"),
            GroupError::MemberNotFound => write!(f, "Member not found"),
            GroupError::SenderKeyNotFound => write!(f, "Sender key not found"),
            GroupError::EncryptionFailed => write!(f, "Encryption failed"),
            GroupError::DecryptionFailed => write!(f, "Decryption failed"),
            GroupError::NotAuthorized => write!(f, "Not authorized"),
        }
    }
}

impl std::error::Error for GroupError {}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_member(name: &str) -> GroupMember {
        GroupMember {
            identity_hash: IdentityHash::from_bytes([0x42u8; 32]),
            public_key: KeyPair::generate().public,
            joined_at: 0,
            role: MemberRole::Member,
        }
    }

    #[test]
    fn test_group_creation() {
        let creator = GroupMember {
            identity_hash: IdentityHash::from_bytes([0x01u8; 32]),
            public_key: KeyPair::generate().public,
            joined_at: 0,
            role: MemberRole::Admin,
        };

        let group = Group::create("Test Group".to_string(), creator);
        
        assert_eq!(group.name, "Test Group");
        assert_eq!(group.member_count(), 1);
    }

    #[test]
    fn test_add_remove_member() {
        let creator = GroupMember {
            identity_hash: IdentityHash::from_bytes([0x01u8; 32]),
            public_key: KeyPair::generate().public,
            joined_at: 0,
            role: MemberRole::Admin,
        };

        let mut group = Group::create("Test Group".to_string(), creator);
        
        let member = GroupMember {
            identity_hash: IdentityHash::from_bytes([0x02u8; 32]),
            public_key: KeyPair::generate().public,
            joined_at: 0,
            role: MemberRole::Member,
        };
        let member_hash = member.identity_hash.clone();

        group.add_member(member).unwrap();
        assert_eq!(group.member_count(), 2);

        group.remove_member(&member_hash).unwrap();
        assert_eq!(group.member_count(), 1);
    }
}

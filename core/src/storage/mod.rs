//! Local encrypted storage for RED using Sled.
//!
//! This module provides:
//! - Encrypted local database
//! - Message persistence
//! - Contact storage
//! - Key backup

use serde::{Deserialize, Serialize};
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::path::PathBuf;
use thiserror::Error;

use crate::crypto::encryption::{decrypt, encrypt, EncryptedData};
use crate::identity::{Identity, IdentityHash, AuthorizedDevice, DeviceId};
use crate::protocol::{Conversation, ConversationId, Message, Group, GroupId};

/// Storage-related errors
#[derive(Error, Debug)]
pub enum StorageError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Encryption error: {0}")]
    EncryptionError(#[from] crate::crypto::CryptoError),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Database error: {0}")]
    DatabaseError(String),
}

pub type StorageResult<T> = Result<T, StorageError>;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Contact {
    pub identity_hash: IdentityHash,
    pub display_name: String,
    pub public_key: [u8; 32],
    pub added_at: u64,
    pub verified: bool,
    pub blocked: bool,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Profile {
    pub display_name: String,
    pub status: Option<String>,
    pub avatar: Option<Vec<u8>>,
}

/// Local storage interface
pub struct Storage {
    path: PathBuf,
    encryption_key: [u8; 32],
    db: Option<sled::Db>,
    is_open: bool,
    pub burner_mode: bool,
}

impl Storage {
    pub fn new(path: PathBuf, encryption_key: [u8; 32]) -> Self {
        Self {
            path,
            encryption_key,
            db: None,
            is_open: false,
            burner_mode: false,
        }
    }

    pub fn open(&mut self) -> StorageResult<()> {
        std::fs::create_dir_all(&self.path)?;
        let db_path = self.path.join("red_db");
        let db = sled::open(db_path)
            .map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        self.db = Some(db);
        self.is_open = true;
        Ok(())
    }

    pub fn close(&mut self) -> StorageResult<()> {
        if let Some(db) = &self.db {
            let _ = db.flush().map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        }
        self.is_open = false;
        Ok(())
    }

    pub fn self_destruct(&mut self) -> StorageResult<()> {
        if let Some(db) = self.db.take() {
            let _ = db.flush();
            drop(db);
        }
        self.is_open = false;
        let _ = std::fs::remove_dir_all(&self.path);
        Ok(())
    }

    fn store<V: Serialize>(&self, tree_name: &str, key: &[u8], value: &V) -> StorageResult<()> {
        if self.burner_mode && tree_name == "conversations" { return Ok(()); }
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree(tree_name).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        let serialized = bincode::serialize(value).map_err(|e| StorageError::SerializationError(e.to_string()))?;
        let encrypted = encrypt(&self.encryption_key, &serialized)?;
        tree.insert(key, encrypted.to_bytes()).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    fn fetch<V: DeserializeOwned>(&self, tree_name: &str, key: &[u8]) -> StorageResult<Option<V>> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree(tree_name).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        if let Some(encrypted_data) = tree.get(key).map_err(|e| StorageError::DatabaseError(e.to_string()))? {
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            let value = bincode::deserialize(&decrypted).map_err(|e| StorageError::SerializationError(e.to_string()))?;
            Ok(Some(value))
        } else {
            Ok(None)
        }
    }

    fn fetch_all<V: DeserializeOwned>(&self, tree_name: &str) -> StorageResult<Vec<V>> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree(tree_name).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        let mut results = Vec::new();
        for item in tree.iter() {
            let (_, encrypted_data) = item.map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            let value = bincode::deserialize(&decrypted).map_err(|e| StorageError::SerializationError(e.to_string()))?;
            results.push(value);
        }
        Ok(results)
    }

    fn delete(&self, tree_name: &str, key: &[u8]) -> StorageResult<()> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree(tree_name).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        tree.remove(key).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    // Config
    pub fn set_config(&mut self, key: impl Into<String>, value: impl Into<String>) -> StorageResult<()> {
        let k = key.into();
        self.store("config", k.as_bytes(), &value.into())
    }
    pub fn get_config(&self, key: &str) -> Option<String> {
        self.fetch("config", key.as_bytes()).unwrap_or(None)
    }

    // Contacts
    pub fn add_contact(&mut self, contact: Contact) -> StorageResult<()> {
        self.store("contacts", contact.identity_hash.as_bytes(), &contact)
    }
    pub fn get_contact(&self, hash: &IdentityHash) -> Option<Contact> {
        self.fetch("contacts", hash.as_bytes()).unwrap_or(None)
    }
    pub fn get_contacts(&self) -> Vec<Contact> {
        self.fetch_all("contacts").unwrap_or_default()
    }
    pub fn contact_count(&self) -> usize {
        self.get_contacts().len()
    }
    pub fn remove_contact(&mut self, hash: &IdentityHash) -> StorageResult<()> {
        self.delete("contacts", hash.as_bytes())
    }
    pub fn block_contact(&mut self, hash: &IdentityHash) -> StorageResult<()> {
        if let Some(mut c) = self.get_contact(hash) {
            c.blocked = true;
            self.add_contact(c)?;
        }
        Ok(())
    }
    pub fn unblock_contact(&mut self, hash: &IdentityHash) -> StorageResult<()> {
        if let Some(mut c) = self.get_contact(hash) {
            c.blocked = false;
            self.add_contact(c)?;
        }
        Ok(())
    }
    pub fn toggle_verify_contact(&mut self, hash: &IdentityHash) -> StorageResult<bool> {
        if let Some(mut c) = self.get_contact(hash) {
            c.verified = !c.verified;
            let val = c.verified;
            self.add_contact(c)?;
            Ok(val)
        } else {
            Err(StorageError::NotFound("Contact not found".into()))
        }
    }

    // Profile & Identity
    pub fn set_profile(&mut self, profile: Profile) -> StorageResult<()> {
        self.store("profile", b"user_profile", &profile)
    }
    pub fn get_profile(&self) -> Option<Profile> {
        self.fetch("profile", b"user_profile").unwrap_or(None)
    }
    pub fn set_identity(&mut self, identity: Identity) -> StorageResult<()> {
        self.store("identity", b"user_identity", &identity)
    }
    pub fn get_identity(&self) -> Option<Identity> {
        self.fetch("identity", b"user_identity").unwrap_or(None)
    }

    pub fn path(&self) -> &PathBuf { &self.path }
    pub fn is_open(&self) -> bool { self.is_open }

    // Groups
    pub fn add_group(&mut self, group: Group) -> StorageResult<()> {
        self.store("groups", group.id.as_bytes(), &group)
    }
    pub fn get_group(&self, id: &GroupId) -> Option<Group> {
        self.fetch("groups", id.as_bytes()).unwrap_or(None)
    }
    pub fn get_groups(&self) -> Vec<Group> {
        self.fetch_all("groups").unwrap_or_default()
    }
    pub fn get_group_mut(&mut self, id: &GroupId) -> Option<Group> {
        self.get_group(id) // Compatibility, caller must save it
    }

    // Devices
    pub fn add_authorized_device(&mut self, device: AuthorizedDevice) -> StorageResult<()> {
        self.store("devices", device.id.as_bytes(), &device)
    }
    pub fn get_authorized_devices(&self) -> Vec<AuthorizedDevice> {
        self.fetch_all("devices").unwrap_or_default()
    }

    // Conversations
    pub fn set_burner_mode(&mut self, enabled: bool) {
        self.burner_mode = enabled;
    }

    pub fn add_message(&mut self, message: Message) -> StorageResult<()> {
        if self.burner_mode { return Ok(()); }
        let is_group = self.get_group(&crate::protocol::GroupId(*message.recipient.as_bytes())).is_some();
        let my_hash = self.get_identity().map(|i| i.identity_hash().clone()).unwrap_or_else(|| message.sender.clone());
        
        let conv_id = if is_group {
            ConversationId::from_participants(&my_hash, &message.recipient)
        } else {
            ConversationId::from_participants(&message.sender, &message.recipient)
        };

        let mut conv = self.get_conversation(&conv_id).unwrap_or_else(|| {
            let sender_for_conv = if is_group { my_hash.clone() } else { message.sender.clone() };
            Conversation::new(sender_for_conv, message.recipient.clone())
        });

        conv.add_message(message).map_err(|e| StorageError::SerializationError(e.to_string()))?;
        self.save_conversation(&conv)
    }

    pub fn save_conversation(&mut self, conv: &Conversation) -> StorageResult<()> {
        if self.burner_mode { return Ok(()); }
        let id = ConversationId::from_participants(&conv.our_identity, &conv.their_identity);
        self.store("conversations", id.to_bytes().as_ref(), conv)
    }

    pub fn get_conversations(&self) -> Vec<Conversation> {
        self.fetch_all("conversations").unwrap_or_default()
    }
    pub fn get_conversation(&self, id: &ConversationId) -> Option<Conversation> {
        self.fetch("conversations", id.to_bytes().as_ref()).unwrap_or(None)
    }
    pub fn get_conversation_mut(&mut self, id: &ConversationId) -> Option<Conversation> {
        self.get_conversation(id) // compatibility, caller must re-save
    }
    pub fn mark_conversation_read(&mut self, id: &ConversationId) -> StorageResult<()> {
        if let Some(mut conv) = self.get_conversation(id) {
            conv.mark_all_read();
            self.save_conversation(&conv)?;
        }
        Ok(())
    }
    pub fn delete_message(&mut self, conv_id_path: &str, msg_id_hex: &str) -> StorageResult<()> {
        let key = self.find_conv_key(conv_id_path)?;
        if let Some(mut conv) = self.get_conversation(&key) {
            conv.remove_message(msg_id_hex).map_err(|e| StorageError::SerializationError(e.to_string()))?;
            self.save_conversation(&conv)?;
        }
        Ok(())
    }
    pub fn edit_message(&mut self, conv_id_path: &str, msg_id_hex: &str, new_content: String) -> StorageResult<()> {
        let key = self.find_conv_key(conv_id_path)?;
        if let Some(mut conv) = self.get_conversation(&key) {
            conv.edit_message_content(msg_id_hex, new_content).map_err(|e| StorageError::SerializationError(e.to_string()))?;
            self.save_conversation(&conv)?;
        }
        Ok(())
    }
    pub fn clear_conversation(&mut self, conv_id_path: &str) -> StorageResult<()> {
        let key = self.find_conv_key(conv_id_path)?;
        if let Some(mut conv) = self.get_conversation(&key) {
            conv.clear_messages();
            self.save_conversation(&conv)?;
        }
        Ok(())
    }
    pub fn prune_expired_messages(&mut self) -> StorageResult<usize> {
        let mut pruned = 0;
        let convs = self.get_conversations();
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64;
        for mut conv in convs {
            let p = conv.prune_expired(now);
            if p > 0 {
                pruned += p;
                self.save_conversation(&conv)?;
            }
        }
        Ok(pruned)
    }

    fn find_conv_key(&self, id_str: &str) -> StorageResult<ConversationId> {
        if let Ok(cid) = ConversationId::from_hex(id_str) {
            if self.get_conversation(&cid).is_some() { return Ok(cid); }
        }
        for conv in self.get_conversations() {
            let cid = ConversationId::from_participants(&conv.our_identity, &conv.their_identity);
            let hex = cid.to_hex();
            if hex.starts_with(id_str) || hex.ends_with(id_str) { return Ok(cid); }
        }
        if id_str.contains('-') {
            let parts: Vec<&str> = id_str.split('-').collect();
            if parts.len() == 2 {
                let p0 = parts[0];
                let p1 = parts[1];
                for conv in self.get_conversations() {
                    let our_hex = conv.our_identity.to_hex();
                    let their_hex = conv.their_identity.to_hex();
                    if (our_hex.starts_with(p0) && their_hex.starts_with(p1))
                        || (our_hex.starts_with(p1) && their_hex.starts_with(p0)) {
                        return Ok(ConversationId::from_participants(&conv.our_identity, &conv.their_identity));
                    }
                }
            }
        }
        Err(StorageError::NotFound(format!("Conversation not found for id: {}", id_str)))
    }

    // Pending deliveries for offline queueing
    pub fn add_pending_delivery(&self, key: &[u8], message: &Message) -> StorageResult<()> {
        self.store("pending_deliveries", key, message)
    }

    pub fn remove_pending_delivery(&self, key: &[u8]) -> StorageResult<()> {
        self.delete("pending_deliveries", key)
    }

    pub fn get_pending_deliveries(&self) -> StorageResult<Vec<(Vec<u8>, Message)>> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree("pending_deliveries").map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        let mut results = Vec::new();
        for item in tree.iter() {
            let (key, encrypted_data) = item.map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            let message = bincode::deserialize(&decrypted).map_err(|e| StorageError::SerializationError(e.to_string()))?;
            results.push((key.to_vec(), message));
        }
        Ok(results)
    }
}

impl Drop for Storage {
    fn drop(&mut self) {
        let _ = self.close();
    }
}

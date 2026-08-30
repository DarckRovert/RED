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
    pub avatar: Option<String>,
    pub bio: Option<String>,
    pub last_sync: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SocialPost {
    pub id: String,
    pub author_hash: IdentityHash,
    pub author_name: String,
    pub content: String,
    pub media_data: Option<String>,
    pub timestamp: u64,
    pub reply_to: Option<String>,
    pub signature: String,
    pub reactions: std::collections::HashMap<String, Vec<String>>, // Emoji -> Vec<ReactorHash>
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Profile {
    pub display_name: String,
    pub status: Option<String>,
    pub avatar: Option<Vec<u8>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct P2PVoucherRecord {
    pub id: String,
    pub creator_hash: IdentityHash,
    pub creator_name: String,
    pub recipient: String,
    pub amount: f64,
    pub timestamp: u64,
    pub signature: String,
    pub is_outgoing: bool,
    pub redeemed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct P2PWalletState {
    pub balance: f64,
    pub total_minted: f64,
    pub total_received: f64,
    pub total_spent: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TriageReportRecord {
    pub id: String,
    pub victim_label: String,
    pub category: String,
    pub bpm: Option<u32>,
    pub spo2: Option<u32>,
    pub notes: String,
    pub evaluator_hash: IdentityHash,
    pub evaluator_name: String,
    pub timestamp: u64,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub synced_mesh: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmergencyBeaconRecord {
    pub beacon_id: String,
    pub sender_hash: IdentityHash,
    pub sender_name: String,
    pub distress_type: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub altitude: Option<f64>,
    pub battery_level: Option<u8>,
    pub message: String,
    pub active: bool,
    pub timestamp: u64,
    pub is_mine: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StegoCapsuleRecord {
    pub id: String,
    pub title: String,
    pub image_data: String,
    pub has_password: bool,
    pub notes: String,
    pub timestamp: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DmsConfigRecord {
    pub enabled: bool,
    pub trigger_hours: u32,
    pub wipe_messages: bool,
    pub wipe_identity: bool,
    pub dead_message: String,
    pub last_active_timestamp: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProximityNodeRecord {
    pub id: String,
    pub name: String,
    pub did: String,
    pub distance_meters: f32,
    pub azimuth: f32,
    pub transport: String,
    pub rssi: i32,
    pub is_active: bool,
    pub last_seen: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VoiceBurstRecord {
    pub id: String,
    pub sender_hash: String,
    pub sender_name: String,
    pub duration_seconds: u32,
    pub audio_opus_b64: String,
    pub is_mine: bool,
    pub timestamp: u64,
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

    /// Access underlying sled database instance (for diagnostics & benchmarks)
    pub fn db(&self) -> Option<&sled::Db> {
        self.db.as_ref()
    }

    fn store<V: Serialize>(&self, tree_name: &str, key: &[u8], value: &V) -> StorageResult<()> {
        if self.burner_mode && tree_name == "conversations" { return Ok(()); }
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree(tree_name).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        let serialized = bincode::serialize(value).map_err(|e| StorageError::SerializationError(e.to_string()))?;
        let encrypted = encrypt(&self.encryption_key, &serialized)?;
        tree.insert(key, encrypted.to_bytes()).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        // tree.flush() persists THIS tree's WAL to disk (~3ms) — ACID safe per write.
        // db.flush() (global fsync, ~10-50ms) is intentionally NOT called here to avoid
        // blocking the message-receive hot path in high-frequency BLE mesh scenarios.
        // Use flush_db() at node shutdown or checkpoint boundaries instead.
        let _ = tree.flush().map_err(|e| StorageError::DatabaseError(e.to_string()));
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

    /// Paginated variant of fetch_all — materialises at most `page_size` records starting from
    /// `cursor_key` (exclusive). Returns (records, next_cursor) where next_cursor is None when
    /// the last page has been reached.
    ///
    /// Use this for large collections (contacts, conversations) to avoid blocking the Tokio
    /// async runtime with a full O(N) heap allocation on startup or export operations.
    fn fetch_paged<V: DeserializeOwned>(
        &self,
        tree_name: &str,
        cursor_key: Option<&[u8]>,
        page_size: usize,
    ) -> StorageResult<(Vec<V>, Option<Vec<u8>>)> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree(tree_name).map_err(|e| StorageError::DatabaseError(e.to_string()))?;

        let iter: Box<dyn Iterator<Item = sled::Result<(sled::IVec, sled::IVec)>>> =
            match cursor_key {
                // Range starting AFTER the cursor key (exclusive lower bound)
                Some(key) => Box::new(tree.range::<&[u8], _>((std::ops::Bound::Excluded(key), std::ops::Bound::Unbounded))),
                None       => Box::new(tree.iter()),
            };


        let mut results = Vec::with_capacity(page_size);
        let mut last_key: Option<Vec<u8>> = None;

        for item in iter.take(page_size) {
            let (k, encrypted_data) = item.map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            let value = bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
            results.push(value);
            last_key = Some(k.to_vec());
        }

        // If we received a full page, there may be more records — return the last key as cursor
        let next_cursor = if results.len() == page_size { last_key } else { None };
        Ok((results, next_cursor))
    }



    fn delete(&self, tree_name: &str, key: &[u8]) -> StorageResult<()> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree(tree_name).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        tree.remove(key).map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        // tree.flush() is sufficient for durability per-operation.
        // db.flush() (global fsync) is reserved for node shutdown via flush_db().
        let _ = tree.flush().map_err(|e| StorageError::DatabaseError(e.to_string()));
        Ok(())
    }

    /// Global WAL flush for use at node shutdown or checkpoint boundaries.
    /// Do NOT call on every write — use tree.flush() in store()/delete() instead.
    pub fn flush_db(&self) -> StorageResult<()> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        db.flush().map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    /// Prunes expired emergency beacons and voice bursts to compact flash storage on mobile nodes.
    pub fn prune_expired_records(&self, max_age_seconds: u64) -> StorageResult<usize> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let cutoff = now.saturating_sub(max_age_seconds);
        let mut pruned = 0;

        // 1. Prune inactive emergency beacons older than cutoff
        if let Ok(tree) = db.open_tree("emergency_beacons") {
            let mut to_remove = Vec::new();
            for item in tree.iter() {
                if let Ok((k, encrypted_data)) = item {
                    if let Ok(encrypted) = EncryptedData::from_bytes(&encrypted_data) {
                        if let Ok(decrypted) = decrypt(&self.encryption_key, &encrypted) {
                            if let Ok(b) = bincode::deserialize::<EmergencyBeaconRecord>(&decrypted) {
                                if !b.active && b.timestamp < cutoff {
                                    to_remove.push(k);
                                }
                            }
                        }
                    }
                }
            }
            for k in to_remove {
                if tree.remove(k).is_ok() {
                    pruned += 1;
                }
            }
            let _ = tree.flush();
        }

        // 2. Prune old voice bursts older than cutoff
        if let Ok(tree) = db.open_tree("voice_bursts") {
            let mut to_remove = Vec::new();
            for item in tree.iter() {
                if let Ok((k, encrypted_data)) = item {
                    if let Ok(encrypted) = EncryptedData::from_bytes(&encrypted_data) {
                        if let Ok(decrypted) = decrypt(&self.encryption_key, &encrypted) {
                            if let Ok(b) = bincode::deserialize::<VoiceBurstRecord>(&decrypted) {
                                if b.timestamp < cutoff {
                                    to_remove.push(k);
                                }
                            }
                        }
                    }
                }
            }
            for k in to_remove {
                if tree.remove(k).is_ok() {
                    pruned += 1;
                }
            }
            let _ = tree.flush();
        }

        // 3. Prune obsolete proximity node sightings older than cutoff.
        //    Uses the standard AES-256-GCM pipeline (EncryptedData + bincode) so that
        //    geographic coordinates and peer DIDs are never stored in readable form on NAND.
        if let Ok(tree) = db.open_tree("proximity_nodes") {
            let mut to_remove = Vec::new();
            for item in tree.iter() {
                if let Ok((k, encrypted_data)) = item {
                    if let Ok(encrypted) = EncryptedData::from_bytes(&encrypted_data) {
                        if let Ok(decrypted) = decrypt(&self.encryption_key, &encrypted) {
                            if let Ok(record) = bincode::deserialize::<ProximityNodeRecord>(&decrypted) {
                                if record.last_seen < cutoff {
                                    to_remove.push(k);
                                }
                            }
                        }
                    }
                }
            }
            for k in to_remove {
                if tree.remove(k).is_ok() {
                    pruned += 1;
                }
            }
            let _ = tree.flush();
        }

        let _ = db.flush();
        Ok(pruned)
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
    /// Paginated contact fetch — prefer over get_contacts() for large address books (> 100 contacts).
    /// Returns (contacts_page, next_cursor_key). Pass next_cursor_key back as cursor for the next page.
    pub fn get_contacts_paged(
        &self,
        cursor: Option<&[u8]>,
        page_size: usize,
    ) -> StorageResult<(Vec<Contact>, Option<Vec<u8>>)> {
        self.fetch_paged("contacts", cursor, page_size)
    }
    pub fn contact_count(&self) -> usize {
        if let Some(db) = self.db.as_ref() {
            if let Ok(tree) = db.open_tree("contacts") {
                return tree.len();
            }
        }
        0
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
    pub fn try_get_identity(&self) -> StorageResult<Option<Identity>> {
        self.fetch("identity", b"user_identity")
    }
    pub fn has_raw_entry(&self, tree_name: &str, key: &[u8]) -> bool {
        if let Some(db) = self.db.as_ref() {
            if let Ok(tree) = db.open_tree(tree_name) {
                if let Ok(Some(_)) = tree.get(key) {
                    return true;
                }
            }
        }
        false
    }

    pub fn path(&self) -> &PathBuf { &self.path }
    pub fn is_open(&self) -> bool { self.is_open }

    // Groups
    pub fn add_group(&mut self, group: Group) -> StorageResult<()> {
        self.store("groups", &group.id.0, &group)
    }
    pub fn get_group(&self, id: &GroupId) -> Option<Group> {
        self.fetch("groups", &id.0).unwrap_or(None)
    }
    pub fn get_groups(&self) -> Vec<Group> {
        self.fetch_all("groups").unwrap_or_default()
    }
    pub fn get_group_mut(&mut self, id: &GroupId) -> Option<Group> {
        self.get_group(id) // Compatibility, caller must save it
    }

    // Devices
    pub fn add_authorized_device(&mut self, device: AuthorizedDevice) -> StorageResult<()> {
        self.store("devices", &device.id.0, &device)
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
        self.store("conversations", id.as_bytes(), conv)
    }

    pub fn get_conversations(&self) -> Vec<Conversation> {
        self.fetch_all("conversations").unwrap_or_default()
    }
    pub fn get_conversation(&self, id: &ConversationId) -> Option<Conversation> {
        self.fetch("conversations", id.as_bytes()).unwrap_or(None)
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
    /// Mark specific message IDs as `Read` in every conversation where they appear.
    /// Called when a `ReadReceipt` arrives from a peer.
    pub fn mark_messages_as_read_by_ids(&mut self, ids: &[crate::protocol::MessageId]) -> StorageResult<()> {
        let id_set: std::collections::HashSet<_> = ids.iter().collect();
        let convs = self.get_conversations();
        for mut conv in convs {
            let mut changed = false;
            // Iterate by clone to avoid borrow issues with update_message_status
            let msg_ids: Vec<crate::protocol::MessageId> = conv
                .messages()
                .iter()
                .filter(|m| id_set.contains(&m.id))
                .map(|m| m.id.clone())
                .collect();
            for mid in msg_ids {
                conv.update_message_status(&mid, crate::protocol::MessageStatus::Read);
                changed = true;
            }
            if changed {
                self.save_conversation(&conv)?;
            }
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
            let our_hex = conv.our_identity.to_hex();
            let their_hex = conv.their_identity.to_hex();
            if hex == id_str || hex.starts_with(id_str) || hex.ends_with(id_str)
                || their_hex == id_str || our_hex == id_str
                || (id_str.len() >= 8 && (their_hex.starts_with(id_str) || our_hex.starts_with(id_str))) {
                return Ok(cid);
            }
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

    // Social Network
    pub fn store_social_post(&self, post: &SocialPost) -> StorageResult<()> {
        self.store("social_posts", post.id.as_bytes(), post)
    }

    pub fn get_social_feed(&self, limit: usize) -> StorageResult<Vec<SocialPost>> {
        let mut posts: Vec<SocialPost> = self.fetch_all("social_posts")?;
        posts.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        posts.truncate(limit);
        Ok(posts)
    }

    pub fn get_social_post(&self, post_id: &str) -> Option<SocialPost> {
        self.fetch("social_posts", post_id.as_bytes()).unwrap_or(None)
    }

    pub fn react_to_post(&mut self, post_id: &str, emoji: String, reactor_hash: String) -> StorageResult<()> {
        if let Some(mut post) = self.get_social_post(post_id) {
            post.reactions.entry(emoji).or_default().push(reactor_hash);
            self.store_social_post(&post)?;
        }
        Ok(())
    }

    pub fn delete_social_post(&mut self, post_id: &str) -> StorageResult<()> {
        self.delete("social_posts", post_id.as_bytes())
    }

    pub fn follow_user(&mut self, target_hash: &str) -> StorageResult<()> {
        self.store("social_following", target_hash.as_bytes(), &true)
    }

    pub fn get_following_list(&self) -> StorageResult<Vec<String>> {
        let db = self.db.as_ref().ok_or_else(|| StorageError::DatabaseError("DB not open".into()))?;
        let tree = db.open_tree("social_following").map_err(|e| StorageError::DatabaseError(e.to_string()))?;
        let mut results = Vec::new();
        for item in tree.iter() {
            let (key, _) = item.map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            if let Ok(s) = String::from_utf8(key.to_vec()) {
                results.push(s);
            }
        }
        Ok(results)
    }

    // Sovereign P2P Wallet & Vouchers (v32.0)
    pub fn get_p2p_wallet(&self) -> StorageResult<P2PWalletState> {
        let key = b"p2p_wallet_state";
        if let Some(wallet) = self.fetch("p2p_wallet", key)? {
            Ok(wallet)
        } else {
            // Initial genesis sovereign wallet with 1,000 RED Credits
            let initial = P2PWalletState {
                balance: 1000.0,
                total_minted: 1000.0,
                total_received: 0.0,
                total_spent: 0.0,
            };
            let _ = self.save_p2p_wallet(&initial);
            Ok(initial)
        }
    }

    pub fn save_p2p_wallet(&self, wallet: &P2PWalletState) -> StorageResult<()> {
        let key = b"p2p_wallet_state";
        self.store("p2p_wallet", key, wallet)
    }

    pub fn store_p2p_voucher(&self, voucher: &P2PVoucherRecord) -> StorageResult<()> {
        self.store("p2p_vouchers", voucher.id.as_bytes(), voucher)
    }

    pub fn get_p2p_voucher(&self, voucher_id: &str) -> Option<P2PVoucherRecord> {
        self.fetch("p2p_vouchers", voucher_id.as_bytes()).unwrap_or(None)
    }

    pub fn get_p2p_vouchers(&self) -> StorageResult<Vec<P2PVoucherRecord>> {
        let mut list: Vec<P2PVoucherRecord> = self.fetch_all("p2p_vouchers")?;
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(list)
    }

    pub fn redeem_p2p_voucher(&mut self, voucher_id: &str) -> StorageResult<bool> {
        if let Some(mut v) = self.get_p2p_voucher(voucher_id) {
            if !v.redeemed {
                v.redeemed = true;
                self.store_p2p_voucher(&v)?;
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub fn store_triage_report(&self, report: &TriageReportRecord) -> StorageResult<()> {
        self.store("triage_reports", report.id.as_bytes(), report)
    }

    pub fn get_triage_reports(&self) -> StorageResult<Vec<TriageReportRecord>> {
        let mut list: Vec<TriageReportRecord> = self.fetch_all("triage_reports")?;
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(list)
    }

    pub fn delete_triage_report(&self, id: &str) -> StorageResult<()> {
        if let Some(db) = &self.db {
            let tree = db.open_tree("triage_reports").map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            let _ = tree.remove(id.as_bytes());
            let _ = db.flush();
        }
        Ok(())
    }

    pub fn store_emergency_beacon(&self, beacon: &EmergencyBeaconRecord) -> StorageResult<()> {
        self.store("emergency_beacons", beacon.beacon_id.as_bytes(), beacon)
    }

    pub fn get_emergency_beacons(&self) -> StorageResult<Vec<EmergencyBeaconRecord>> {
        let mut list: Vec<EmergencyBeaconRecord> = self.fetch_all("emergency_beacons")?;
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(list)
    }

    pub fn remove_emergency_beacon(&self, beacon_id: &str) -> StorageResult<()> {
        if let Some(db) = &self.db {
            let tree = db.open_tree("emergency_beacons").map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            let _ = tree.remove(beacon_id.as_bytes());
            let _ = db.flush();
        }
        Ok(())
    }

    pub fn store_stego_capsule(&self, capsule: &StegoCapsuleRecord) -> StorageResult<()> {
        self.store("stego_vault", capsule.id.as_bytes(), capsule)
    }

    pub fn get_stego_capsules(&self) -> StorageResult<Vec<StegoCapsuleRecord>> {
        let mut list: Vec<StegoCapsuleRecord> = self.fetch_all("stego_vault")?;
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(list)
    }

    pub fn delete_stego_capsule(&self, id: &str) -> StorageResult<()> {
        if let Some(db) = &self.db {
            let tree = db.open_tree("stego_vault").map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            let _ = tree.remove(id.as_bytes());
            let _ = db.flush();
        }
        Ok(())
    }

    pub fn get_dms_config(&self) -> StorageResult<DmsConfigRecord> {
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
        if let Some(config) = self.fetch::<DmsConfigRecord>("dms_config", b"active_config")? {
            Ok(config)
        } else {
            Ok(DmsConfigRecord {
                enabled: false,
                trigger_hours: 72,
                wipe_messages: true,
                wipe_identity: false,
                dead_message: String::new(),
                last_active_timestamp: now,
            })
        }
    }

    pub fn save_dms_config(&self, config: &DmsConfigRecord) -> StorageResult<()> {
        self.store("dms_config", b"active_config", config)
    }

    pub fn ping_dms_activity(&self) -> StorageResult<u64> {
        let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
        let mut config = self.get_dms_config()?;
        config.last_active_timestamp = now;
        self.save_dms_config(&config)?;
        Ok(now)
    }

    pub fn execute_dms_purge(&mut self, wipe_messages: bool, wipe_identity: bool) -> StorageResult<()> {
        if let Some(db) = &self.db {
            if wipe_messages {
                let _ = db.drop_tree("conversations");
                let _ = db.drop_tree("messages");
                let _ = db.drop_tree("channels");
                let _ = db.drop_tree("social_posts");
                let _ = db.drop_tree("triage_reports");
                let _ = db.drop_tree("emergency_beacons");
            }
            if wipe_identity {
                let _ = db.drop_tree("identity");
                let _ = db.drop_tree("peers");
                let _ = db.drop_tree("contacts");
                let _ = db.drop_tree("p2p_wallet");
                let _ = db.drop_tree("p2p_vouchers");
                let _ = db.drop_tree("stego_vault");
            }
            let _ = db.flush();
        }
        Ok(())
    }

    pub fn store_proximity_node(&self, node: &ProximityNodeRecord) -> StorageResult<()> {
        self.store("proximity_nodes", node.id.as_bytes(), node)
    }

    pub fn get_proximity_nodes(&self) -> StorageResult<Vec<ProximityNodeRecord>> {
        let mut list: Vec<ProximityNodeRecord> = self.fetch_all("proximity_nodes")?;
        list.sort_by(|a, b| a.distance_meters.partial_cmp(&b.distance_meters).unwrap_or(std::cmp::Ordering::Equal));
        Ok(list)
    }

    pub fn store_voice_burst(&self, burst: &VoiceBurstRecord) -> StorageResult<()> {
        self.store("voice_bursts", burst.id.as_bytes(), burst)
    }

    pub fn get_voice_bursts(&self) -> StorageResult<Vec<VoiceBurstRecord>> {
        let mut list: Vec<VoiceBurstRecord> = self.fetch_all("voice_bursts")?;
        list.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(list)
    }

    pub fn delete_voice_burst(&self, id: &str) -> StorageResult<()> {
        if let Some(db) = &self.db {
            let tree = db.open_tree("voice_bursts").map_err(|e| StorageError::DatabaseError(e.to_string()))?;
            let _ = tree.remove(id.as_bytes());
            let _ = db.flush();
        }
        Ok(())
    }
}

impl Drop for Storage {
    fn drop(&mut self) {
        let _ = self.close();
    }
}

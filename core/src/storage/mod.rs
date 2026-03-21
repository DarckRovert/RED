//! Local encrypted storage for RED.
//!
//! This module provides:
//! - Encrypted local database
//! - Message persistence
//! - Contact storage
//! - Key backup

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use thiserror::Error;

use crate::crypto::encryption::{decrypt, encrypt, EncryptedData};
use crate::identity::{Identity, IdentityHash, AuthorizedDevice, DeviceId};
use crate::protocol::{Conversation, ConversationId, Message, Group, GroupId};

/// Storage-related errors
#[derive(Error, Debug)]
pub enum StorageError {
    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// Serialization error
    #[error("Serialization error: {0}")]
    SerializationError(String),

    /// Encryption error
    #[error("Encryption error: {0}")]
    EncryptionError(#[from] crate::crypto::CryptoError),

    /// Not found
    #[error("Not found: {0}")]
    NotFound(String),

    /// Database error
    #[error("Database error: {0}")]
    DatabaseError(String),
}

/// Result type for storage operations
pub type StorageResult<T> = Result<T, StorageError>;

/// Contact information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Contact {
    /// Contact's identity hash
    pub identity_hash: IdentityHash,
    /// Display name
    pub display_name: String,
    /// Contact's public key
    pub public_key: [u8; 32],
    /// When the contact was added
    pub added_at: u64,
    /// Is this contact verified (out-of-band)
    pub verified: bool,
    /// Is this contact blocked
    pub blocked: bool,
    /// Custom notes
    pub notes: Option<String>,
}

/// User profile
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Profile {
    /// Display name
    pub display_name: String,
    /// Status message
    pub status: Option<String>,
    /// Avatar (base64 encoded)
    pub avatar: Option<Vec<u8>>,
}

/// Local storage interface
pub struct Storage {
    /// Storage path
    path: PathBuf,
    /// Encryption key (derived from user password)
    encryption_key: [u8; 32],
    /// Cached contacts
    contacts: HashMap<IdentityHash, Contact>,
    /// User profile
    profile: Option<Profile>,
    /// Secure identity
    identity: Option<Identity>,
    /// Groups
    groups: HashMap<GroupId, Group>,
    /// Authorized devices
    authorized_devices: HashMap<DeviceId, AuthorizedDevice>,
    /// Conversations (TD-2 FIX: store conversations for sync)
    conversations: HashMap<ConversationId, Conversation>,
    /// Global configuration (Dead Man's Switch, etc.)
    config: HashMap<String, String>,
    /// Is storage open
    is_open: bool,
    /// Burner Mode (RAM-Only chat storage)
    pub burner_mode: bool,
}

impl Storage {
    /// Create a new storage instance
    pub fn new(path: PathBuf, encryption_key: [u8; 32]) -> Self {
        Self {
            path,
            encryption_key,
            contacts: HashMap::new(),
            profile: None,
            identity: None,
            groups: HashMap::new(),
            authorized_devices: HashMap::new(),
            conversations: HashMap::new(),
            config: HashMap::new(),
            is_open: false,
            burner_mode: false,
        }
    }

    /// Open the storage (load data)
    pub fn open(&mut self) -> StorageResult<()> {
        // Create directory if it doesn't exist
        std::fs::create_dir_all(&self.path)?;
        
        // Load contacts
        let contacts_path = self.path.join("contacts.enc");
        if contacts_path.exists() {
            let encrypted_data = std::fs::read(&contacts_path)?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            self.contacts = bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        }

        // Load profile
        let profile_path = self.path.join("profile.enc");
        if profile_path.exists() {
            let encrypted_data = std::fs::read(&profile_path)?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            self.profile = Some(bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?);
        }

        // Load identity
        let identity_path = self.path.join("identity.enc");
        if identity_path.exists() {
            let encrypted_data = std::fs::read(&identity_path)?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            // Note: Identity needs to implement Serialize/Deserialize
            self.identity = Some(bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?);
        }

        // Load groups
        let groups_path = self.path.join("groups.enc");
        if groups_path.exists() {
            let encrypted_data = std::fs::read(&groups_path)?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            self.groups = bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        }

        // Load authorized devices
        let devices_path = self.path.join("devices.enc");
        if devices_path.exists() {
            let encrypted_data = std::fs::read(&devices_path)?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            self.authorized_devices = bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        }

        // Load conversations (TD-2 FIX)
        let convos_path = self.path.join("conversations.enc");
        if convos_path.exists() {
            let encrypted_data = std::fs::read(&convos_path)?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            self.conversations = bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        }

        // Load config
        let config_path = self.path.join("config.enc");
        if config_path.exists() {
            let encrypted_data = std::fs::read(&config_path)?;
            let encrypted = EncryptedData::from_bytes(&encrypted_data)?;
            let decrypted = decrypt(&self.encryption_key, &encrypted)?;
            self.config = bincode::deserialize(&decrypted)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        }

        self.is_open = true;
        Ok(())
    }

    /// Close the storage (save data)
    pub fn close(&mut self) -> StorageResult<()> {
        self.save_contacts()?;
        self.save_profile()?;
        self.save_identity()?;
        self.save_groups()?;
        self.save_authorized_devices()?;
        self.save_conversations()?;
        self.save_config()?;
        self.is_open = false;
        Ok(())
    }

    /// Wipes all encrypted data from disk and clears memory (Dead Man's Switch Trigger)
    pub fn self_destruct(&mut self) -> StorageResult<()> {
        // 1. Clear memory
        self.contacts.clear();
        self.profile = None;
        self.identity = None;
        self.groups.clear();
        self.authorized_devices.clear();
        self.conversations.clear();
        self.config.clear();
        self.is_open = false;

        // 2. Erase encrypted files securely (standard filesystem delete for now)
        let files_to_delete = [
            "contacts.enc", "profile.enc", "identity.enc", 
            "groups.enc", "devices.enc", "conversations.enc", 
            "config.enc", "app.db" // just in case SQLite was used earlier
        ];

        for file in files_to_delete.iter() {
            let file_path = self.path.join(file);
            if file_path.exists() {
                // Ignore errors during panic wipe
                let _ = std::fs::remove_file(file_path);
            }
        }
        
        Ok(())
    }

    /// Save config to disk
    fn save_config(&self) -> StorageResult<()> {
        if !self.is_open { return Ok(()); }
        let serialized = bincode::serialize(&self.config)
            .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        let encrypted = encrypt(&self.encryption_key, &serialized)?;
        std::fs::write(self.path.join("config.enc"), encrypted.to_bytes())?;
        Ok(())
    }

    /// Save contacts to disk
    fn save_contacts(&self) -> StorageResult<()> {
        if !self.is_open { return Ok(()); }
        let serialized = bincode::serialize(&self.contacts)
            .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        let encrypted = encrypt(&self.encryption_key, &serialized)?;
        std::fs::write(self.path.join("contacts.enc"), encrypted.to_bytes())?;
        Ok(())
    }

    /// Save profile to disk
    fn save_profile(&self) -> StorageResult<()> {
        if !self.is_open { return Ok(()); }
        if let Some(profile) = &self.profile {
            let serialized = bincode::serialize(profile)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
            let encrypted = encrypt(&self.encryption_key, &serialized)?;
            std::fs::write(self.path.join("profile.enc"), encrypted.to_bytes())?;
        }
        Ok(())
    }

    /// Save groups to disk
    fn save_groups(&self) -> StorageResult<()> {
        if !self.is_open { return Ok(()); }
        let serialized = bincode::serialize(&self.groups)
            .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        let encrypted = encrypt(&self.encryption_key, &serialized)?;
        std::fs::write(self.path.join("groups.enc"), encrypted.to_bytes())?;
        Ok(())
    }

    /// Save authorized devices to disk
    fn save_authorized_devices(&self) -> StorageResult<()> {
        if !self.is_open { return Ok(()); }
        let serialized = bincode::serialize(&self.authorized_devices)
            .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        let encrypted = encrypt(&self.encryption_key, &serialized)?;
        std::fs::write(self.path.join("devices.enc"), encrypted.to_bytes())?;
        Ok(())
    }

    /// Save identity to disk
    pub fn save_identity(&self) -> StorageResult<()> {
        if !self.is_open { return Ok(()); }
        if let Some(identity) = &self.identity {
            let serialized = bincode::serialize(identity)
                .map_err(|e| StorageError::SerializationError(e.to_string()))?;
            let encrypted = encrypt(&self.encryption_key, &serialized)?;
            std::fs::write(self.path.join("identity.enc"), encrypted.to_bytes())?;
        }
        Ok(())
    }

    /// Add a contact
    pub fn add_contact(&mut self, contact: Contact) -> StorageResult<()> {
        self.contacts.insert(contact.identity_hash.clone(), contact);
        self.save_contacts()?;
        Ok(())
    }

    /// Get a contact
    pub fn get_contact(&self, identity_hash: &IdentityHash) -> Option<&Contact> {
        self.contacts.get(identity_hash)
    }

    /// Get all contacts
    pub fn get_contacts(&self) -> Vec<&Contact> {
        self.contacts.values().collect()
    }

    /// Remove a contact
    pub fn remove_contact(&mut self, identity_hash: &IdentityHash) -> StorageResult<()> {
        self.contacts.remove(identity_hash);
        self.save_contacts()?;
        Ok(())
    }

    /// Block a contact
    pub fn block_contact(&mut self, identity_hash: &IdentityHash) -> StorageResult<()> {
        if let Some(contact) = self.contacts.get_mut(identity_hash) {
            contact.blocked = true;
            self.save_contacts()?;
        }
        Ok(())
    }

    /// Unblock a contact
    pub fn unblock_contact(&mut self, identity_hash: &IdentityHash) -> StorageResult<()> {
        if let Some(contact) = self.contacts.get_mut(identity_hash) {
            contact.blocked = false;
            self.save_contacts()?;
        }
        Ok(())
    }

    /// Set user profile
    pub fn set_profile(&mut self, profile: Profile) -> StorageResult<()> {
        self.profile = Some(profile);
        self.save_profile()?;
        Ok(())
    }

    /// Get user profile
    pub fn get_profile(&self) -> Option<&Profile> {
        self.profile.as_ref()
    }

    /// Set identity
    pub fn set_identity(&mut self, identity: Identity) -> StorageResult<()> {
        self.identity = Some(identity);
        self.save_identity()?;
        Ok(())
    }

    /// Get identity
    pub fn get_identity(&self) -> Option<&Identity> {
        self.identity.as_ref()
    }

    /// Get storage path
    pub fn path(&self) -> &PathBuf {
        &self.path
    }

    /// Check if storage is open
    pub fn is_open(&self) -> bool {
        self.is_open
    }

    /// Get contact count
    pub fn contact_count(&self) -> usize {
        self.contacts.len()
    }

    /// Add a group
    pub fn add_group(&mut self, group: Group) -> StorageResult<()> {
        self.groups.insert(group.id.clone(), group);
        self.save_groups()?;
        Ok(())
    }

    /// Get a group
    pub fn get_group(&self, id: &GroupId) -> Option<&Group> {
        self.groups.get(id)
    }

    /// Get all groups
    pub fn get_groups(&self) -> Vec<&Group> {
        self.groups.values().collect()
    }

    /// Add an authorized device
    pub fn add_authorized_device(&mut self, device: AuthorizedDevice) -> StorageResult<()> {
        self.authorized_devices.insert(device.id.clone(), device);
        self.save_authorized_devices()?;
        Ok(())
    }

    /// Get an authorized device
    pub fn get_authorized_device(&self, id: &DeviceId) -> Option<&AuthorizedDevice> {
        self.authorized_devices.get(id)
    }

    /// Get all authorized devices
    pub fn get_authorized_devices(&self) -> Vec<&AuthorizedDevice> {
        self.authorized_devices.values().collect()
    }

    /// Remove an authorized device
    pub fn remove_authorized_device(&mut self, id: &DeviceId) -> StorageResult<()> {
        self.authorized_devices.remove(id);
        self.save_authorized_devices()?;
        Ok(())
    }

    // ─── Conversations & Messages (TD-2 FIX) ───────────────────────────────────

    /// Set burner mode (RAM-Only flag)
    pub fn set_burner_mode(&mut self, enabled: bool) {
        self.burner_mode = enabled;
    }

    /// Persist a received/sent message into its conversation.
    /// Creates the conversation if it doesn't exist yet. // MODIFIED FOR BURNER CHATS
    pub fn add_message(&mut self, message: Message) -> StorageResult<()> {
        if self.burner_mode {
            // Burner Mode is active: DO NOT save anything to the conversation map.
            // The message lives purely in the frontend's RAM (Zustand state).
            return Ok(());
        }

        // Conversation ID = deterministic ID from the two participant hashes
        let conv_id = ConversationId::from_participants(&message.sender, &message.recipient);
        let conv = self.conversations.entry(conv_id).or_insert_with(|| {
            Conversation::new(message.sender.clone(), message.recipient.clone())
        });
        conv.add_message(message)
            .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        // Mano Pesada: local disk persistence happens later via save_conversations
        Ok(())
    }

    /// Prune all expired messages across all conversations
    pub fn prune_expired_messages(&mut self) -> StorageResult<usize> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        
        let mut total_pruned = 0;
        for conv in self.conversations.values_mut() {
            total_pruned += conv.prune_expired(now);
        }

        if total_pruned > 0 {
            self.save_conversations()?;
        }
        Ok(total_pruned)
    }

    /// Get all conversations
    pub fn get_conversations(&self) -> Vec<&Conversation> {
        self.conversations.values().collect()
    }

    /// Get a specific conversation
    pub fn get_conversation(&self, id: &ConversationId) -> Option<&Conversation> {
        self.conversations.get(id)
    }

    /// Get a specific conversation (mutable)
    pub fn get_conversation_mut(&mut self, id: &ConversationId) -> Option<&mut Conversation> {
        self.conversations.get_mut(id)
    }

    /// Save conversations to disk
    pub fn save_conversations(&self) -> StorageResult<()> {
        let serialized = bincode::serialize(&self.conversations)
            .map_err(|e| StorageError::SerializationError(e.to_string()))?;
        let encrypted = encrypt(&self.encryption_key, &serialized)?;
        let path = self.path.join("conversations.enc");
        std::fs::write(path, encrypted.to_bytes())?;
        Ok(())
    }

    /// Update a configuration value
    pub fn set_config(&mut self, key: impl Into<String>, value: impl Into<String>) -> StorageResult<()> {
        self.config.insert(key.into(), value.into());
        self.save_config()?;
        Ok(())
    }

    /// Get a configuration value
    pub fn get_config(&self, key: &str) -> Option<String> {
        self.config.get(key).cloned()
    }
}

impl Drop for Storage {
    fn drop(&mut self) {
        if self.is_open {
            let _ = self.close();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_test_contact() -> Contact {
        Contact {
            identity_hash: IdentityHash::from_bytes([0x42u8; 32]),
            display_name: "Test User".to_string(),
            public_key: [0x01u8; 32],
            added_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            verified: false,
            blocked: false,
            notes: None,
        }
    }

    #[test]
    fn test_storage_creation() {
        let path = std::env::temp_dir().join("red_test_storage");
        let key = [0x42u8; 32];
        
        let storage = Storage::new(path, key);
        
        assert!(!storage.is_open());
        assert_eq!(storage.contact_count(), 0);
    }

    #[test]
    fn test_add_contact() {
        let path = std::env::temp_dir().join("red_test_storage_2");
        let key = [0x42u8; 32];
        
        let mut storage = Storage::new(path.clone(), key);
        storage.open().unwrap();
        
        let contact = create_test_contact();
        let hash = contact.identity_hash.clone();
        
        storage.add_contact(contact).unwrap();
        
        assert_eq!(storage.contact_count(), 1);
        assert!(storage.get_contact(&hash).is_some());
        
        // Cleanup
        let _ = std::fs::remove_dir_all(path);
    }
}

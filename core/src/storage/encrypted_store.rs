//! Almacenamiento cifrado local para mensajes y estado
//! 
//! Implementa almacenamiento persistente con cifrado AES-256-GCM
//! y política de borrado automático según T_max

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};

use crate::crypto::encryption::{encrypt, decrypt};
use crate::crypto::keys::SymmetricKey;
use crate::crypto::hashing::blake3_hash;

/// Duración máxima de retención de mensajes (30 días en segundos)
pub const T_MAX_SECONDS: u64 = 30 * 24 * 60 * 60;

/// Entrada cifrada en el almacenamiento
#[derive(Clone, Serialize, Deserialize)]
pub struct EncryptedEntry {
    /// Texto cifrado del mensaje
    pub ciphertext: Vec<u8>,
    /// Nonce usado para cifrado
    pub nonce: [u8; 12],
    /// Timestamp de creación
    pub timestamp: u64,
    /// Metadatos cifrados (ID del contacto, etc.)
    pub encrypted_metadata: Vec<u8>,
    /// Nonce para metadatos
    pub metadata_nonce: [u8; 12],
}

/// Almacenamiento cifrado local
pub struct EncryptedStore {
    /// Clave maestra de almacenamiento
    master_key: SymmetricKey,
    /// Entradas almacenadas (ID -> Entry)
    entries: HashMap<[u8; 32], EncryptedEntry>,
    /// Ruta del archivo de almacenamiento
    storage_path: PathBuf,
    /// Índice de conversaciones (contact_id -> message_ids)
    conversation_index: HashMap<[u8; 32], Vec<[u8; 32]>>,
}

impl EncryptedStore {
    /// Crea un nuevo almacenamiento cifrado
    pub fn new(master_key: SymmetricKey, storage_path: PathBuf) -> Self {
        Self {
            master_key,
            entries: HashMap::new(),
            storage_path,
            conversation_index: HashMap::new(),
        }
    }

    /// Almacena un mensaje cifrado
    pub fn store_message(
        &mut self,
        message: &[u8],
        contact_id: &[u8; 32],
    ) -> Result<[u8; 32], StoreError> {
        let timestamp = current_timestamp();
        
        // Generar nonces aleatorios
        let mut nonce = [0u8; 12];
        let mut metadata_nonce = [0u8; 12];
        getrandom::getrandom(&mut nonce).map_err(|_| StoreError::RandomError)?;
        getrandom::getrandom(&mut metadata_nonce).map_err(|_| StoreError::RandomError)?;

        // Cifrar mensaje
        let ciphertext = encrypt(&self.master_key.0, &nonce, message)
            .map_err(|_| StoreError::EncryptionError)?;

        // Cifrar metadatos (contact_id || timestamp)
        let mut metadata = Vec::with_capacity(40);
        metadata.extend_from_slice(contact_id);
        metadata.extend_from_slice(&timestamp.to_le_bytes());
        
        let encrypted_metadata = encrypt(&self.master_key.0, &metadata_nonce, &metadata)
            .map_err(|_| StoreError::EncryptionError)?;

        // Generar ID único para la entrada
        let entry_id = blake3_hash(&[&ciphertext, &timestamp.to_le_bytes()].concat());

        let entry = EncryptedEntry {
            ciphertext,
            nonce,
            timestamp,
            encrypted_metadata,
            metadata_nonce,
        };

        // Almacenar entrada
        self.entries.insert(entry_id, entry);

        // Actualizar índice de conversación
        self.conversation_index
            .entry(*contact_id)
            .or_insert_with(Vec::new)
            .push(entry_id);

        Ok(entry_id)
    }

    /// Recupera y descifra un mensaje
    pub fn retrieve_message(&self, entry_id: &[u8; 32]) -> Result<Vec<u8>, StoreError> {
        let entry = self.entries.get(entry_id)
            .ok_or(StoreError::NotFound)?;

        decrypt(&self.master_key.0, &entry.nonce, &entry.ciphertext)
            .map_err(|_| StoreError::DecryptionError)
    }

    /// Obtiene todos los mensajes de una conversación
    pub fn get_conversation(&self, contact_id: &[u8; 32]) -> Result<Vec<Vec<u8>>, StoreError> {
        let message_ids = self.conversation_index.get(contact_id)
            .ok_or(StoreError::NotFound)?;

        let mut messages = Vec::new();
        for id in message_ids {
            if let Ok(msg) = self.retrieve_message(id) {
                messages.push(msg);
            }
        }

        Ok(messages)
    }

    /// Elimina mensajes antiguos según política T_max
    pub fn cleanup_old_messages(&mut self) -> usize {
        let current_time = current_timestamp();
        let cutoff_time = current_time.saturating_sub(T_MAX_SECONDS);

        let mut to_remove = Vec::new();

        for (id, entry) in &self.entries {
            if entry.timestamp < cutoff_time {
                to_remove.push(*id);
            }
        }

        let removed_count = to_remove.len();

        for id in &to_remove {
            self.entries.remove(id);
            
            // Limpiar índices de conversación
            for messages in self.conversation_index.values_mut() {
                messages.retain(|msg_id| msg_id != id);
            }
        }

        // Eliminar conversaciones vacías
        self.conversation_index.retain(|_, messages| !messages.is_empty());

        removed_count
    }

    /// Elimina un mensaje específico (borrado seguro)
    pub fn secure_delete(&mut self, entry_id: &[u8; 32]) -> Result<(), StoreError> {
        // Sobrescribir con ceros antes de eliminar
        if let Some(entry) = self.entries.get_mut(entry_id) {
            // Sobrescribir datos sensibles
            for byte in entry.ciphertext.iter_mut() {
                *byte = 0;
            }
            for byte in entry.encrypted_metadata.iter_mut() {
                *byte = 0;
            }
        }

        self.entries.remove(entry_id)
            .ok_or(StoreError::NotFound)?;

        // Limpiar de índices
        for messages in self.conversation_index.values_mut() {
            messages.retain(|id| id != entry_id);
        }

        Ok(())
    }

    /// Obtiene estadísticas del almacenamiento
    pub fn stats(&self) -> StoreStats {
        let total_messages = self.entries.len();
        let total_conversations = self.conversation_index.len();
        let total_size: usize = self.entries.values()
            .map(|e| e.ciphertext.len() + e.encrypted_metadata.len())
            .sum();

        StoreStats {
            total_messages,
            total_conversations,
            total_size_bytes: total_size,
        }
    }

    /// Guarda el almacenamiento a disco (serializado y cifrado)
    pub fn persist(&self) -> Result<(), StoreError> {
        let payload = EncryptedStorePayload {
            entries: self.entries.clone(),
            conversation_index: self.conversation_index.clone(),
        };

        let encoded = bincode::serialize(&payload)
            .map_err(|_| StoreError::SerializationError)?;

        std::fs::write(&self.storage_path, encoded)
            .map_err(StoreError::IoError)?;

        Ok(())
    }

    /// Carga el almacenamiento desde disco
    pub fn load(master_key: SymmetricKey, storage_path: PathBuf) -> Result<Self, StoreError> {
        if !storage_path.exists() {
            return Ok(Self::new(master_key, storage_path));
        }

        let encoded = std::fs::read(&storage_path)
            .map_err(StoreError::IoError)?;

        let payload: EncryptedStorePayload = bincode::deserialize(&encoded)
            .map_err(|_| StoreError::SerializationError)?;

        Ok(Self {
            master_key,
            entries: payload.entries,
            storage_path,
            conversation_index: payload.conversation_index,
        })
    }
}

/// Payload serializable para el almacenamiento cifrado
#[derive(Serialize, Deserialize)]
struct EncryptedStorePayload {
    entries: HashMap<[u8; 32], EncryptedEntry>,
    conversation_index: HashMap<[u8; 32], Vec<[u8; 32]>>,
}

/// Estadísticas del almacenamiento
#[derive(Debug, Clone)]
pub struct StoreStats {
    pub total_messages: usize,
    pub total_conversations: usize,
    pub total_size_bytes: usize,
}

/// Errores del almacenamiento
#[derive(Debug)]
pub enum StoreError {
    NotFound,
    EncryptionError,
    DecryptionError,
    RandomError,
    IoError(std::io::Error),
    SerializationError,
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::NotFound => write!(f, "Entry not found"),
            StoreError::EncryptionError => write!(f, "Encryption failed"),
            StoreError::DecryptionError => write!(f, "Decryption failed"),
            StoreError::RandomError => write!(f, "Random generation failed"),
            StoreError::IoError(e) => write!(f, "IO error: {}", e),
            StoreError::SerializationError => write!(f, "Serialization error"),
        }
    }
}

impl std::error::Error for StoreError {}

/// Obtiene el timestamp actual en segundos
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_and_retrieve() {
        let key = SymmetricKey([0u8; 32]);
        let mut store = EncryptedStore::new(key, PathBuf::from("/tmp/test"));
        
        let contact_id = [1u8; 32];
        let message = b"Hello, World!";
        
        let entry_id = store.store_message(message, &contact_id).unwrap();
        let retrieved = store.retrieve_message(&entry_id).unwrap();
        
        assert_eq!(message.to_vec(), retrieved);
    }

    #[test]
    fn test_secure_delete() {
        let key = SymmetricKey([0u8; 32]);
        let mut store = EncryptedStore::new(key, PathBuf::from("/tmp/test"));
        
        let contact_id = [1u8; 32];
        let entry_id = store.store_message(b"Secret", &contact_id).unwrap();
        
        store.secure_delete(&entry_id).unwrap();
        
        assert!(store.retrieve_message(&entry_id).is_err());
    }
}

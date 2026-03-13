//! Identity registry for blockchain registration.

use std::collections::HashMap;
use std::sync::RwLock;

use serde::{Deserialize, Serialize};

use super::{IdentityError, IdentityHash, IdentityResult};
use crate::crypto::hashing::hash;

/// Proof of identity registration
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegistrationProof {
    /// The identity hash that was registered
    pub identity_hash: IdentityHash,
    /// Block number where registration occurred
    pub block_number: u64,
    /// Transaction hash
    pub tx_hash: [u8; 32],
    /// Merkle proof of inclusion
    pub merkle_proof: Vec<[u8; 32]>,
    /// Timestamp of registration
    pub timestamp: u64,
}

impl RegistrationProof {
    /// Verify this proof against a known root
    pub fn verify(&self, merkle_root: &[u8; 32]) -> bool {
        let mut current = *self.identity_hash.as_bytes();
        
        for sibling in &self.merkle_proof {
            // Combine current with sibling (order matters)
            if current < *sibling {
                current = hash(&[current.as_slice(), sibling.as_slice()].concat());
            } else {
                current = hash(&[sibling.as_slice(), current.as_slice()].concat());
            }
        }

        &current == merkle_root
    }
}

/// Registration status
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum RegistrationStatus {
    /// Not registered
    NotRegistered,
    /// Registration pending
    Pending,
    /// Successfully registered
    Registered(RegistrationProof),
    /// Registration revoked
    Revoked,
}

/// Local identity registry (in-memory cache)
/// In production, this would sync with the blockchain
pub struct IdentityRegistry {
    /// Registered identities
    identities: RwLock<HashMap<IdentityHash, RegistrationStatus>>,
    /// Current merkle root (from blockchain)
    merkle_root: RwLock<[u8; 32]>,
}

impl IdentityRegistry {
    /// Create a new empty registry
    pub fn new() -> Self {
        Self {
            identities: RwLock::new(HashMap::new()),
            merkle_root: RwLock::new([0u8; 32]),
        }
    }

    /// Check if an identity is registered
    pub fn is_registered(&self, identity_hash: &IdentityHash) -> bool {
        let identities = self.identities.read().unwrap();
        matches!(
            identities.get(identity_hash),
            Some(RegistrationStatus::Registered(_))
        )
    }

    /// Get registration status
    pub fn get_status(&self, identity_hash: &IdentityHash) -> RegistrationStatus {
        let identities = self.identities.read().unwrap();
        identities
            .get(identity_hash)
            .cloned()
            .unwrap_or(RegistrationStatus::NotRegistered)
    }

    /// Register an identity (local cache update)
    /// In production, this would submit a transaction to the blockchain
    pub fn register(
        &self,
        identity_hash: IdentityHash,
        proof: RegistrationProof,
    ) -> IdentityResult<()> {
        let mut identities = self.identities.write().unwrap();
        
        if identities.contains_key(&identity_hash) {
            return Err(IdentityError::AlreadyExists);
        }

        identities.insert(identity_hash, RegistrationStatus::Registered(proof));
        Ok(())
    }

    /// Mark an identity as pending registration
    pub fn mark_pending(&self, identity_hash: IdentityHash) {
        let mut identities = self.identities.write().unwrap();
        identities.insert(identity_hash, RegistrationStatus::Pending);
    }

    /// Revoke an identity
    pub fn revoke(&self, identity_hash: &IdentityHash) -> IdentityResult<()> {
        let mut identities = self.identities.write().unwrap();
        
        if !identities.contains_key(identity_hash) {
            return Err(IdentityError::NotFound(identity_hash.to_hex()));
        }

        identities.insert(identity_hash.clone(), RegistrationStatus::Revoked);
        Ok(())
    }

    /// Update merkle root (from blockchain sync)
    pub fn update_merkle_root(&self, root: [u8; 32]) {
        let mut merkle_root = self.merkle_root.write().unwrap();
        *merkle_root = root;
    }

    /// Get current merkle root
    pub fn merkle_root(&self) -> [u8; 32] {
        *self.merkle_root.read().unwrap()
    }

    /// Verify a registration proof
    pub fn verify_proof(&self, proof: &RegistrationProof) -> bool {
        let root = self.merkle_root.read().unwrap();
        proof.verify(&root)
    }

    /// Get all registered identity hashes
    pub fn list_registered(&self) -> Vec<IdentityHash> {
        let identities = self.identities.read().unwrap();
        identities
            .iter()
            .filter_map(|(hash, status)| {
                if matches!(status, RegistrationStatus::Registered(_)) {
                    Some(hash.clone())
                } else {
                    None
                }
            })
            .collect()
    }

    /// Get count of registered identities
    pub fn count(&self) -> usize {
        let identities = self.identities.read().unwrap();
        identities
            .values()
            .filter(|s| matches!(s, RegistrationStatus::Registered(_)))
            .count()
    }
}

impl Default for IdentityRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::identity::Identity;

    fn create_mock_proof(identity_hash: IdentityHash) -> RegistrationProof {
        RegistrationProof {
            identity_hash,
            block_number: 1,
            tx_hash: [0x42u8; 32],
            merkle_proof: vec![],
            timestamp: 1234567890,
        }
    }

    #[test]
    fn test_registry_new() {
        let registry = IdentityRegistry::new();
        assert_eq!(registry.count(), 0);
    }

    #[test]
    fn test_register_identity() {
        let registry = IdentityRegistry::new();
        let identity = Identity::generate().unwrap();
        let hash = identity.identity_hash().clone();
        let proof = create_mock_proof(hash.clone());

        registry.register(hash.clone(), proof).unwrap();
        
        assert!(registry.is_registered(&hash));
        assert_eq!(registry.count(), 1);
    }

    #[test]
    fn test_duplicate_registration() {
        let registry = IdentityRegistry::new();
        let identity = Identity::generate().unwrap();
        let hash = identity.identity_hash().clone();
        let proof = create_mock_proof(hash.clone());

        registry.register(hash.clone(), proof.clone()).unwrap();
        let result = registry.register(hash, proof);
        
        assert!(matches!(result, Err(IdentityError::AlreadyExists)));
    }

    #[test]
    fn test_revoke_identity() {
        let registry = IdentityRegistry::new();
        let identity = Identity::generate().unwrap();
        let hash = identity.identity_hash().clone();
        let proof = create_mock_proof(hash.clone());

        registry.register(hash.clone(), proof).unwrap();
        registry.revoke(&hash).unwrap();
        
        assert!(!registry.is_registered(&hash));
        assert!(matches!(
            registry.get_status(&hash),
            RegistrationStatus::Revoked
        ));
    }

    #[test]
    fn test_pending_status() {
        let registry = IdentityRegistry::new();
        let identity = Identity::generate().unwrap();
        let hash = identity.identity_hash().clone();

        registry.mark_pending(hash.clone());
        
        assert!(matches!(
            registry.get_status(&hash),
            RegistrationStatus::Pending
        ));
    }
}

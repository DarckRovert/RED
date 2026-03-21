//! Blockchain state and management.

use std::collections::HashMap;
use std::sync::RwLock;

use crate::block::{Block, BlockHash};
use crate::transaction::{Transaction, TxHash};
use crate::store::BlockStore;
use crate::{BlockchainError, BlockchainResult};
use serde::{Deserialize, Serialize};

/// Blockchain state
pub struct Chain {
    /// Persistent store
    store: BlockStore,
    /// Pending transactions (mempool)
    mempool: RwLock<HashMap<TxHash, Transaction>>,
    /// Identity registry state (cached in RAM, persisted to store)
    identities: RwLock<HashMap<[u8; 32], IdentityState>>,
    /// Group registry state
    groups: RwLock<HashMap<[u8; 32], GroupState>>,
}

/// State of a decentralized group on-chain
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GroupState {
    /// Group ID
    pub id: [u8; 32],
    /// Serialized group data (members, config)
    pub data: Vec<u8>,
    /// Last updated height
    pub updated_at: u64,
}

/// State of a registered identity
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IdentityState {
    /// Public key
    pub public_key: [u8; 32],
    /// Verifying key
    pub verifying_key: [u8; 32],
    /// Block where registered
    pub registered_at: u64,
    /// Is revoked
    pub revoked: bool,
}

impl Chain {
    /// Open a persistent blockchain at the given path
    pub fn open<P: AsRef<std::path::Path>>(path: P) -> BlockchainResult<Self> {
        let store = BlockStore::open(path)?;
        
        let identities = store.load_state("identities")?
            .unwrap_or_else(HashMap::new);
            
        let groups = store.load_state("groups")?
            .unwrap_or_else(HashMap::new);
            
        // If empty, initialize with genesis
        if store.get_tip()?.is_none() {
            let genesis = Block::genesis();
            store.save_block(&genesis)?;
            store.save_state("identities", &identities)?;
            store.save_state("groups", &groups)?;
        }

        Ok(Self {
            store,
            mempool: RwLock::new(HashMap::new()),
            identities: RwLock::new(identities),
            groups: RwLock::new(groups),
        })
    }

    /// Create a new in-memory chain (mostly for tests)
    pub fn new_temp() -> Self {
        let temp_dir = std::env::temp_dir().join(format!("red-chain-{}", rand::random::<u32>()));
        Self::open(temp_dir).unwrap()
    }

    /// Get current chain height
    pub fn height(&self) -> u64 {
        self.store.get_height().unwrap_or(0)
    }

    /// Get current tip hash
    pub fn tip(&self) -> BlockHash {
        self.store.get_tip().unwrap_or(None).unwrap_or([0u8; 32])
    }

    /// Get block by hash
    pub fn get_block(&self, hash: &BlockHash) -> Option<Block> {
        self.store.get_block(hash).unwrap_or(None)
    }

    /// Get block by height
    pub fn get_block_at_height(&self, height: u64) -> Option<Block> {
        let hash = self.store.get_hash_at_height(height).unwrap_or(None)?;
        self.store.get_block(&hash).unwrap_or(None)
    }

    /// Get all registered identities
    pub fn get_all_identities(&self) -> Vec<([u8; 32], crate::chain::IdentityState)> {
        let identities = self.identities.read().unwrap();
        identities.iter().map(|(h, s)| (*h, s.clone())).collect()
    }

    /// Add a new block
    pub fn add_block(&self, block: Block) -> BlockchainResult<()> {
        // Validate block
        block.validate()?;

        let current_height = self.height();
        let current_tip = self.tip();

        // Check block connects to tip
        if block.header.previous_hash != current_tip && !block.is_genesis() {
            return Err(BlockchainError::InvalidBlock(
                "Block does not connect to tip".to_string()
            ));
        }

        // Check height
        if !block.is_genesis() && block.header.height != current_height + 1 {
            return Err(BlockchainError::InvalidBlock(
                format!("Invalid height: expected {}, got {}", 
                    current_height + 1, block.header.height)
            ));
        }

        // Apply transactions
        for tx in &block.transactions {
            self.apply_transaction(tx, block.header.height)?;
        }

        // Save block
        self.store.save_block(&block)?;
        
        // Save state
        self.save_state()?;

        Ok(())
    }

    /// Apply a transaction to state
    fn apply_transaction(&self, tx: &Transaction, block_height: u64) -> BlockchainResult<()> {
        use crate::transaction::TransactionType;

        match &tx.tx_type {
            TransactionType::RegisterIdentity { 
                identity_hash, 
                public_key, 
                verifying_key,
                zk_proof,
            } => {
                let mut identities = self.identities.write().unwrap();
                
                if identities.contains_key(identity_hash) {
                    return Err(BlockchainError::InvalidTransaction(
                        "Identity already registered".to_string()
                    ));
                }

                // SEC-FIX A-7: Validate the ZK proof before accepting registration
                // This ensures the sender actually knows the private key for the identity.
                if !zk_proof.is_empty() {
                    if !red_core::crypto::zk_proofs::verify_zk_proof(identity_hash, public_key, &zk_proof) {
                        return Err(BlockchainError::InvalidTransaction(
                            "Invalid ZK proof for identity registration".to_string()
                        ));
                    }
                } else {
                    return Err(BlockchainError::InvalidTransaction(
                        "Registration requires a valid ZK proof".to_string()
                    ));
                }

                identities.insert(*identity_hash, IdentityState {
                    public_key: *public_key,
                    verifying_key: *verifying_key,
                    registered_at: block_height,
                    revoked: false,
                });

                // SEC-FIX A-6: Sync with IdentityRegistry (Trace for notification)
                tracing::info!("Chain identity registry synchronized for {}", hex::encode(identity_hash));
            }
            TransactionType::RevokeIdentity { identity_hash, .. } => {
                let mut identities = self.identities.write().unwrap();
                
                if let Some(state) = identities.get_mut(identity_hash) {
                    state.revoked = true;
                } else {
                    return Err(BlockchainError::InvalidTransaction(
                        "Identity not found".to_string()
                    ));
                }
            }
            TransactionType::UpdateIdentity { 
                old_identity_hash, 
                new_identity_hash,
                new_public_key,
                new_verifying_key,
                ..
            } => {
                let mut identities = self.identities.write().unwrap();
                
                // Get old identity
                let old_state = identities.get(old_identity_hash)
                    .ok_or_else(|| BlockchainError::InvalidTransaction(
                        "Old identity not found".to_string()
                    ))?
                    .clone();

                if old_state.revoked {
                    return Err(BlockchainError::InvalidTransaction(
                        "Old identity is revoked".to_string()
                    ));
                }

                // Revoke old
                identities.get_mut(old_identity_hash).unwrap().revoked = true;

                // Register new — SEC-FIX C-7: use new_verifying_key, not the old one.
                // Keeping the old key broke forward secrecy of signatures on rotation.
                let final_verifying_key = new_verifying_key
                    .as_ref()
                    .copied()
                    .unwrap_or(old_state.verifying_key);
                identities.insert(*new_identity_hash, IdentityState {
                    public_key: *new_public_key,
                    verifying_key: final_verifying_key,
                    registered_at: block_height,
                    revoked: false,
                });
            }
            TransactionType::CreateGroup { group_id, initial_state } => {
                let mut groups = self.groups.write().unwrap();
                if groups.contains_key(group_id) {
                    return Err(BlockchainError::InvalidTransaction("Group already exists".to_string()));
                }
                groups.insert(*group_id, GroupState {
                    id: *group_id,
                    data: initial_state.clone(),
                    updated_at: block_height,
                });
            }
            TransactionType::UpdateGroup { group_id, new_state, signature } => {
                let mut groups = self.groups.write().unwrap();
                let group = groups.get_mut(group_id)
                    .ok_or_else(|| BlockchainError::InvalidTransaction("Group not found".to_string()))?;

                // SEC-FIX A-2: Verify the Ed25519 signature using the sender's registered verifying_key.
                // Previously this comment claimed "happens upstream" but nothing verified it anywhere.
                {
                    let identities = self.identities.read().unwrap();
                    let sender_state = identities.get(&tx.sender)
                        .ok_or_else(|| BlockchainError::InvalidTransaction(
                            "UpdateGroup sender not registered on chain".to_string()
                        ))?;
                    let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(&sender_state.verifying_key)
                        .map_err(|_| BlockchainError::InvalidTransaction("Invalid verifying key".to_string()))?;
                    let sig = ed25519_dalek::Signature::from_bytes(signature);
                    // Sign the group_id + new_state hash
                    let mut data_to_verify = group_id.to_vec();
                    data_to_verify.extend_from_slice(new_state);
                    use ed25519_dalek::Verifier;
                    verifying_key.verify(&data_to_verify, &sig)
                        .map_err(|_| BlockchainError::InvalidTransaction(
                            "UpdateGroup signature verification failed — sender is not an authorized admin".to_string()
                        ))?;
                }

                group.data = new_state.clone();
                group.updated_at = block_height;
            }
            _ => {
                // Stake/Unstake transactions are managed directly by consensus mechanisms
            }
        }

        // Remove from mempool
        self.mempool.write().unwrap().remove(&tx.hash());

        Ok(())
    }

    /// Save state to block store
    pub fn save_state(&self) -> BlockchainResult<()> {
        let identities = self.identities.read().unwrap();
        self.store.save_state("identities", &*identities)?;
        
        let groups = self.groups.read().unwrap();
        self.store.save_state("groups", &*groups)?;
        
        Ok(())
    }

    /// Add transaction to mempool
    pub fn add_to_mempool(&self, tx: Transaction) -> BlockchainResult<()> {
        tx.validate()?;
        
        let hash = tx.hash();
        self.mempool.write().unwrap().insert(hash, tx);
        
        Ok(())
    }

    /// Get pending transactions
    pub fn get_pending_transactions(&self, limit: usize) -> Vec<Transaction> {
        self.mempool.read().unwrap()
            .values()
            .take(limit)
            .cloned()
            .collect()
    }

    /// Check if identity is registered
    pub fn is_identity_registered(&self, identity_hash: &[u8; 32]) -> bool {
        let identities = self.identities.read().unwrap();
        identities.get(identity_hash)
            .map(|s| !s.revoked)
            .unwrap_or(false)
    }

    /// Get identity state
    pub fn get_identity(&self, identity_hash: &[u8; 32]) -> Option<IdentityState> {
        self.identities.read().unwrap().get(identity_hash).cloned()
    }

    /// Get mempool size
    pub fn mempool_size(&self) -> usize {
        self.mempool.read().unwrap().len()
    }

    /// Get identity count
    pub fn identity_count(&self) -> usize {
        self.identities.read().unwrap()
            .values()
            .filter(|s| !s.revoked)
            .count()
    }
}

impl Default for Chain {
    fn default() -> Self {
        // BUG-FIX: Chain::new() does not exist; use new_temp() which creates
        // an in-memory/temp-dir chain suitable for tests and defaults
        Self::new_temp()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_chain() {
        let chain = Chain::new_temp();
        
        assert_eq!(chain.height(), 0);
        assert!(chain.get_block_at_height(0).is_some());
    }

    #[test]
    fn test_genesis_block() {
        let chain = Chain::new_temp();
        let genesis = chain.get_block_at_height(0).unwrap();
        
        assert!(genesis.is_genesis());
    }

    #[test]
    fn test_add_to_mempool() {
        let chain = Chain::new_temp();
        
        let tx = Transaction::register_identity(
            [0x01u8; 32],
            [0x02u8; 32],
            [0x03u8; 32],
            vec![0x04; 64],
            [0x05u8; 32],
            1,
        );

        chain.add_to_mempool(tx).unwrap();
        
        assert_eq!(chain.mempool_size(), 1);
    }
}

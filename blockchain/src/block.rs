//! Block structure and validation.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use ed25519_dalek::Signer;

use crate::transaction::Transaction;
use crate::{BlockchainError, BlockchainResult};

/// Block hash (32 bytes)
pub type BlockHash = [u8; 32];

/// Block header
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BlockHeader {
    /// Block version
    pub version: u32,
    /// Block height
    pub height: u64,
    /// Previous block hash
    pub previous_hash: BlockHash,
    /// Merkle root of transactions
    pub merkle_root: [u8; 32],
    /// State root (identity registry)
    pub state_root: [u8; 32],
    /// Timestamp (Unix seconds)
    pub timestamp: u64,
    /// Validator who created this block
    pub validator: [u8; 32],
    /// Validator signature
    #[serde(with = "crate::serde_utils")]
    pub signature: [u8; 64],
}

impl BlockHeader {
    /// Calculate block hash
    pub fn hash(&self) -> BlockHash {
        let mut data = Vec::new();
        data.extend_from_slice(&self.version.to_le_bytes());
        data.extend_from_slice(&self.height.to_le_bytes());
        data.extend_from_slice(&self.previous_hash);
        data.extend_from_slice(&self.merkle_root);
        data.extend_from_slice(&self.state_root);
        data.extend_from_slice(&self.timestamp.to_le_bytes());
        data.extend_from_slice(&self.validator);
        // Note: signature is not included in hash
        
        *blake3::hash(&data).as_bytes()
    }

    /// Get data to sign
    pub fn signing_data(&self) -> Vec<u8> {
        let mut data = Vec::new();
        data.extend_from_slice(&self.version.to_le_bytes());
        data.extend_from_slice(&self.height.to_le_bytes());
        data.extend_from_slice(&self.previous_hash);
        data.extend_from_slice(&self.merkle_root);
        data.extend_from_slice(&self.state_root);
        data.extend_from_slice(&self.timestamp.to_le_bytes());
        data.extend_from_slice(&self.validator);
        data
    }
}

/// A complete block
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    /// Block header
    pub header: BlockHeader,
    /// Transactions in this block
    pub transactions: Vec<Transaction>,
}

impl Block {
    /// Create a new block
    pub fn new(
        height: u64,
        previous_hash: BlockHash,
        transactions: Vec<Transaction>,
        validator: [u8; 32],
    ) -> Self {
        let merkle_root = Self::calculate_merkle_root(&transactions);
        let state_root = [0u8; 32]; // Calculated dynamically from state matrix upstream
        
        let header = BlockHeader {
            version: 1,
            height,
            previous_hash,
            merkle_root,
            state_root,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            validator,
            signature: [0u8; 64], // To be signed
        };

        Self {
            header,
            transactions,
        }
    }

    /// Create genesis block
    pub fn genesis() -> Self {
        Self {
            header: BlockHeader {
                version: 1,
                height: 0,
                previous_hash: [0u8; 32],
                merkle_root: [0u8; 32],
                state_root: [0u8; 32],
                timestamp: 1704067200, // 2024-01-01 00:00:00 UTC
                validator: [0u8; 32],
                signature: [0u8; 64],
            },
            transactions: Vec::new(),
        }
    }

    /// Get block hash
    pub fn hash(&self) -> BlockHash {
        self.header.hash()
    }

    /// Calculate merkle root of transactions
    fn calculate_merkle_root(transactions: &[Transaction]) -> [u8; 32] {
        if transactions.is_empty() {
            return [0u8; 32];
        }

        let mut hashes: Vec<[u8; 32]> = transactions
            .iter()
            .map(|tx| tx.hash())
            .collect();

        while hashes.len() > 1 {
            let mut next_level = Vec::new();
            
            for chunk in hashes.chunks(2) {
                let combined = if chunk.len() == 2 {
                    [chunk[0].as_slice(), chunk[1].as_slice()].concat()
                } else {
                    [chunk[0].as_slice(), chunk[0].as_slice()].concat()
                };
                next_level.push(*blake3::hash(&combined).as_bytes());
            }
            
            hashes = next_level;
        }

        hashes[0]
    }

    /// Validate block structure
    pub fn validate(&self) -> BlockchainResult<()> {
        // Check merkle root
        let calculated_root = Self::calculate_merkle_root(&self.transactions);
        if calculated_root != self.header.merkle_root {
            return Err(BlockchainError::InvalidBlock(
                "Invalid merkle root".to_string()
            ));
        }

        // Check transaction count
        if self.transactions.len() > crate::MAX_TXS_PER_BLOCK {
            return Err(BlockchainError::InvalidBlock(
                "Too many transactions".to_string()
            ));
        }

        // Validate each transaction
        for tx in &self.transactions {
            tx.validate()?;
        }

        // Validate signature
        if self.header.height > 0 {
            self.verify_signature()?;
        }

        Ok(())
    }

    /// Sign the block
    pub fn sign(&mut self, signing_key: &ed25519_dalek::SigningKey) {
        self.header.validator = signing_key.verifying_key().to_bytes();
        let data = self.header.signing_data();
        let signature = signing_key.sign(&data);
        self.header.signature = signature.to_bytes();
    }

    /// Verify block signature
    pub fn verify_signature(&self) -> BlockchainResult<()> {
        use ed25519_dalek::{Verifier, VerifyingKey, Signature};

        let verifying_key = VerifyingKey::from_bytes(&self.header.validator)
            .map_err(|e| BlockchainError::ConsensusError(format!("Invalid validator key: {}", e)))?;
        
        let signature = Signature::from_bytes(&self.header.signature);
        let data = self.header.signing_data();

        verifying_key.verify(&data, &signature)
            .map_err(|_| BlockchainError::ConsensusError("Invalid block signature".to_string()))?;

        Ok(())
    }

    /// Get transaction count
    pub fn tx_count(&self) -> usize {
        self.transactions.len()
    }

    /// Check if block is genesis
    pub fn is_genesis(&self) -> bool {
        self.header.height == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_genesis_block() {
        let genesis = Block::genesis();
        
        assert!(genesis.is_genesis());
        assert_eq!(genesis.header.height, 0);
        assert_eq!(genesis.transactions.len(), 0);
    }

    #[test]
    fn test_block_hash() {
        let block = Block::genesis();
        let hash1 = block.hash();
        let hash2 = block.hash();
        
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_merkle_root_empty() {
        let root = Block::calculate_merkle_root(&[]);
        assert_eq!(root, [0u8; 32]);
    }
}

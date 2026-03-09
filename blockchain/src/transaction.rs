//! Transaction types for identity management.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{BlockchainError, BlockchainResult};

/// Transaction hash
pub type TxHash = [u8; 32];

/// Transaction types
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum TransactionType {
    /// Register a new identity
    RegisterIdentity {
        /// Identity hash
        identity_hash: [u8; 32],
        /// Public key for key exchange
        public_key: [u8; 32],
        /// Verifying key for signatures
        verifying_key: [u8; 32],
        /// Zero-knowledge proof of ownership
        zk_proof: Vec<u8>,
    },
    /// Revoke an identity
    RevokeIdentity {
        /// Identity hash to revoke
        identity_hash: [u8; 32],
        /// Proof of ownership
        signature: [u8; 64],
    },
    /// Update identity keys (rotation)
    UpdateIdentity {
        /// Old identity hash
        old_identity_hash: [u8; 32],
        /// New identity hash
        new_identity_hash: [u8; 32],
        /// New public key
        new_public_key: [u8; 32],
        /// Proof signed with old key
        signature: [u8; 64],
    },
    /// Validator stake
    Stake {
        /// Validator public key
        validator_key: [u8; 32],
        /// Amount to stake
        amount: u64,
    },
    /// Validator unstake
    Unstake {
        /// Validator public key
        validator_key: [u8; 32],
        /// Amount to unstake
        amount: u64,
    },
    /// Create a new decentralized group
    CreateGroup {
        /// Group ID
        group_id: [u8; 32],
        /// Initial group state (serialized)
        initial_state: Vec<u8>,
    },
    /// Update group state (add/remove members, change roles)
    UpdateGroup {
        /// Group ID
        group_id: [u8; 32],
        /// New group state (serialized)
        new_state: Vec<u8>,
        /// Proof of authority
        signature: [u8; 64],
    },
}

/// A transaction
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transaction {
    /// Transaction type and data
    pub tx_type: TransactionType,
    /// Nonce (for replay protection)
    pub nonce: u64,
    /// Timestamp
    pub timestamp: u64,
    /// Sender's public key
    pub sender: [u8; 32],
    /// Signature
    pub signature: [u8; 64],
}

impl Transaction {
    /// Create a new identity registration transaction
    pub fn register_identity(
        identity_hash: [u8; 32],
        public_key: [u8; 32],
        verifying_key: [u8; 32],
        zk_proof: Vec<u8>,
        sender: [u8; 32],
        nonce: u64,
    ) -> Self {
        Self {
            tx_type: TransactionType::RegisterIdentity {
                identity_hash,
                public_key,
                verifying_key,
                zk_proof,
            },
            nonce,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            sender,
            signature: [0u8; 64], // To be signed
        }
    }

    /// Create a revocation transaction
    pub fn revoke_identity(
        identity_hash: [u8; 32],
        sender: [u8; 32],
        nonce: u64,
    ) -> Self {
        Self {
            tx_type: TransactionType::RevokeIdentity {
                identity_hash,
                signature: [0u8; 64], // Inner signature
            },
            nonce,
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            sender,
            signature: [0u8; 64],
        }
    }

    /// Calculate transaction hash
    pub fn hash(&self) -> TxHash {
        let serialized = bincode::serialize(self).unwrap_or_default();
        *blake3::hash(&serialized).as_bytes()
    }

    /// Get data to sign
    pub fn signing_data(&self) -> Vec<u8> {
        let mut data = Vec::new();
        
        // Serialize tx_type
        let tx_type_bytes = bincode::serialize(&self.tx_type).unwrap_or_default();
        data.extend_from_slice(&tx_type_bytes);
        data.extend_from_slice(&self.nonce.to_le_bytes());
        data.extend_from_slice(&self.timestamp.to_le_bytes());
        data.extend_from_slice(&self.sender);
        
        data
    }

    /// Validate transaction
    pub fn validate(&self) -> BlockchainResult<()> {
        // Check timestamp is not too far in the future
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if self.timestamp > now + 300 {
            return Err(BlockchainError::InvalidTransaction(
                "Timestamp too far in future".to_string()
            ));
        }

        // Validate based on type
        match &self.tx_type {
            TransactionType::RegisterIdentity { zk_proof, .. } => {
                if zk_proof.is_empty() {
                    return Err(BlockchainError::InvalidTransaction(
                        "Missing ZK proof".to_string()
                    ));
                }
            }
            TransactionType::Stake { amount, .. } => {
                if *amount < crate::MIN_VALIDATOR_STAKE {
                    return Err(BlockchainError::InvalidTransaction(
                        format!("Stake too low: {} < {}", amount, crate::MIN_VALIDATOR_STAKE)
                    ));
                }
            }
            _ => {}
        }

        // Verify signature
        if self.signature != [0u8; 64] {
            self.verify_signature()?;
        }

        Ok(())
    }

    /// Sign the transaction
    pub fn sign(&mut self, signing_key: &ed25519_dalek::SigningKey) {
        self.sender = signing_key.verifying_key().to_bytes();
        let data = self.signing_data();
        let signature = signing_key.sign(&data);
        self.signature = signature.to_bytes();
    }

    /// Verify transaction signature
    pub fn verify_signature(&self) -> BlockchainResult<()> {
        use ed25519_dalek::{Verifier, VerifyingKey, Signature};

        let verifying_key = VerifyingKey::from_bytes(&self.sender)
            .map_err(|e| BlockchainError::InvalidTransaction(format!("Invalid sender key: {}", e)))?;
        
        let signature = Signature::from_bytes(&self.signature);
        let data = self.signing_data();

        verifying_key.verify(&data, &signature)
            .map_err(|_| BlockchainError::InvalidTransaction("Invalid signature".to_string()))?;

        Ok(())
    }

    /// Get transaction type name
    pub fn type_name(&self) -> &'static str {
        match &self.tx_type {
            TransactionType::RegisterIdentity { .. } => "RegisterIdentity",
            TransactionType::RevokeIdentity { .. } => "RevokeIdentity",
            TransactionType::UpdateIdentity { .. } => "UpdateIdentity",
            TransactionType::Stake { .. } => "Stake",
            TransactionType::Unstake { .. } => "Unstake",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_identity_tx() {
        let tx = Transaction::register_identity(
            [0x01u8; 32],
            [0x02u8; 32],
            [0x03u8; 32],
            vec![0x04; 64],
            [0x05u8; 32],
            1,
        );

        assert_eq!(tx.type_name(), "RegisterIdentity");
        assert_eq!(tx.nonce, 1);
    }

    #[test]
    fn test_tx_hash() {
        let tx = Transaction::register_identity(
            [0x01u8; 32],
            [0x02u8; 32],
            [0x03u8; 32],
            vec![0x04; 64],
            [0x05u8; 32],
            1,
        );

        let hash1 = tx.hash();
        let hash2 = tx.hash();
        
        assert_eq!(hash1, hash2);
    }
}

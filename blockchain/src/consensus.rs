//! Proof of Stake consensus mechanism with slashing.

use tracing::{debug, info, warn};

use std::collections::HashMap;
use std::sync::RwLock;

use crate::block::Block;
use crate::{BlockchainError, BlockchainResult, BLOCK_TIME_SECS, MIN_VALIDATOR_STAKE};

/// Reason for slashing a validator
#[derive(Debug, Clone, PartialEq)]
pub enum SlashReason {
    /// Validator signed two conflicting blocks in the same slot
    DoubleSign,
    /// Validator was offline too long (missed too many slots)
    Downtime,
}

/// Validator information
#[derive(Clone, Debug)]
pub struct Validator {
    /// Validator public key
    pub public_key: [u8; 32],
    /// Staked amount
    pub stake: u64,
    /// Is currently active
    pub active: bool,
    /// Blocks produced
    pub blocks_produced: u64,
    /// Missed slots
    pub missed_slots: u64,
}

impl Validator {
    /// Calculate validator weight (for leader selection)
    pub fn weight(&self) -> u64 {
        if !self.active {
            return 0;
        }
        
        // Weight based on stake and performance
        let performance = if self.blocks_produced + self.missed_slots > 0 {
            (self.blocks_produced * 100) / (self.blocks_produced + self.missed_slots)
        } else {
            100
        };
        
        (self.stake * performance) / 100
    }
}

/// Consensus state
pub struct Consensus {
    /// Registered validators
    validators: RwLock<HashMap<[u8; 32], Validator>>,
    /// Current epoch
    epoch: RwLock<u64>,
    /// Slots per epoch
    slots_per_epoch: u64,
    /// Current slot
    current_slot: RwLock<u64>,
}

impl Consensus {
    /// Create new consensus state
    pub fn new() -> Self {
        Self {
            validators: RwLock::new(HashMap::new()),
            epoch: RwLock::new(0),
            slots_per_epoch: 100,
            current_slot: RwLock::new(0),
        }
    }

    /// Register a new validator
    pub fn register_validator(
        &self,
        public_key: [u8; 32],
        stake: u64,
    ) -> BlockchainResult<()> {
        if stake < MIN_VALIDATOR_STAKE {
            return Err(BlockchainError::ConsensusError(
                format!("Stake too low: {} < {}", stake, MIN_VALIDATOR_STAKE)
            ));
        }

        let mut validators = self.validators.write().unwrap();
        
        if validators.contains_key(&public_key) {
            return Err(BlockchainError::ConsensusError(
                "Validator already registered".to_string()
            ));
        }

        validators.insert(public_key, Validator {
            public_key,
            stake,
            active: true,
            blocks_produced: 0,
            missed_slots: 0,
        });

        Ok(())
    }

    /// Add stake to existing validator
    pub fn add_stake(&self, public_key: &[u8; 32], amount: u64) -> BlockchainResult<()> {
        let mut validators = self.validators.write().unwrap();
        
        let validator = validators.get_mut(public_key)
            .ok_or_else(|| BlockchainError::ConsensusError(
                "Validator not found".to_string()
            ))?;

        validator.stake += amount;
        Ok(())
    }

    /// Remove stake from validator
    pub fn remove_stake(&self, public_key: &[u8; 32], amount: u64) -> BlockchainResult<()> {
        let mut validators = self.validators.write().unwrap();
        
        let validator = validators.get_mut(public_key)
            .ok_or_else(|| BlockchainError::ConsensusError(
                "Validator not found".to_string()
            ))?;

        if validator.stake < amount {
            return Err(BlockchainError::ConsensusError(
                "Insufficient stake".to_string()
            ));
        }

        validator.stake -= amount;

        // Deactivate if below minimum
        if validator.stake < MIN_VALIDATOR_STAKE {
            validator.active = false;
        }

        Ok(())
    }

    /// Select leader for a slot
    pub fn select_leader(&self, slot: u64) -> Option<[u8; 32]> {
        let validators = self.validators.read().unwrap();
        
        let mut active_validators: Vec<_> = validators.values()
            .filter(|v| v.active)
            .collect();
        
        // SEC-4 FIX: Sort by public key for deterministic selection across all nodes
        active_validators.sort_by_key(|v| v.public_key);

        if active_validators.is_empty() {
            return None;
        }

        // Calculate total weight
        let total_weight: u64 = active_validators.iter()
            .map(|v| v.weight())
            .sum();

        if total_weight == 0 {
            return None;
        }

        // Deterministic selection based on slot
        let seed = blake3::hash(&slot.to_le_bytes());
        let seed_value = u64::from_le_bytes(seed.as_bytes()[..8].try_into().unwrap());
        let target = seed_value % total_weight;

        let mut cumulative = 0u64;
        for validator in &active_validators {
            cumulative += validator.weight();
            if cumulative > target {
                return Some(validator.public_key);
            }
        }

        // Fallback to first validator
        active_validators.first().map(|v| v.public_key)
    }

    /// Verify block was produced by correct leader
    pub fn verify_block_producer(&self, block: &Block) -> BlockchainResult<()> {
        let slot = block.header.height; // Using height as slot for simplicity
        
        let expected_leader = self.select_leader(slot)
            .ok_or_else(|| BlockchainError::ConsensusError(
                "No active validators".to_string()
            ))?;

        if block.header.validator != expected_leader {
            return Err(BlockchainError::ConsensusError(
                "Block produced by wrong validator".to_string()
            ));
        }

        Ok(())
    }

    /// Record block production
    pub fn record_block_produced(&self, validator: &[u8; 32]) {
        let mut validators = self.validators.write().unwrap();
        if let Some(v) = validators.get_mut(validator) {
            v.blocks_produced += 1;
        }
    }

    /// Record missed slot
    pub fn record_missed_slot(&self, validator: &[u8; 32]) {
        let mut validators = self.validators.write().unwrap();
        if let Some(v) = validators.get_mut(validator) {
            v.missed_slots += 1;
        }
    }

    /// Slash a validator for misbehavior.
    ///
    /// - `DoubleSign`: removes 20% of stake and immediately deactivates.
    /// - `Downtime`: removes 5% of stake; deactivates if below min stake.
    pub fn slash_validator(&self, public_key: &[u8; 32], reason: SlashReason) -> BlockchainResult<()> {
        let mut validators = self.validators.write().unwrap();
        let v = validators.get_mut(public_key)
            .ok_or_else(|| BlockchainError::ConsensusError("Validator not found".to_string()))?;

        if !v.active {
            return Err(BlockchainError::ConsensusError("Validator is already inactive".to_string()));
        }

        let slash_pct = match reason {
            SlashReason::DoubleSign => 20u64,   // 20% stake slashed
            SlashReason::Downtime  =>  5u64,    //  5% stake slashed
        };

        let slash_amount = (v.stake * slash_pct) / 100;
        v.stake = v.stake.saturating_sub(slash_amount);

        // DoubleSign always deactivates immediately
        if reason == SlashReason::DoubleSign {
            v.active = false;
            warn!("Validator {:?} SLASHED for DoubleSign — deactivated. Stake remaining: {}", &public_key[..4], v.stake);
        } else {
            // Downtime: deactivate only if below minimum stake
            if v.stake < MIN_VALIDATOR_STAKE {
                v.active = false;
                warn!("Validator {:?} slashed for Downtime and fell below min stake — deactivated", &public_key[..4]);
            } else {
                info!("Validator {:?} slashed for Downtime. Stake remaining: {}", &public_key[..4], v.stake);
            }
        }

        Ok(())
    }

    /// Get a read-only snapshot of all validators (for tests and status endpoints)
    pub fn get_validators(&self) -> HashMap<[u8; 32], Validator> {
        self.validators.read().unwrap().clone()
    }

    /// Get active validator count
    pub fn active_validator_count(&self) -> usize {
        self.validators.read().unwrap()
            .values()
            .filter(|v| v.active)
            .count()
    }

    /// Get total staked amount
    pub fn total_stake(&self) -> u64 {
        self.validators.read().unwrap()
            .values()
            .filter(|v| v.active)
            .map(|v| v.stake)
            .sum()
    }

    /// Get current epoch
    pub fn current_epoch(&self) -> u64 {
        *self.epoch.read().unwrap()
    }

    /// Advance to next slot
    pub fn advance_slot(&self) {
        let mut slot = self.current_slot.write().unwrap();
        *slot += 1;

        // Check for epoch transition
        if *slot % self.slots_per_epoch == 0 {
            let mut epoch = self.epoch.write().unwrap();
            *epoch += 1;
        }
    }

    /// Run block production loop (for validators)
    pub async fn run_block_production(
        self: std::sync::Arc<Self>,
        chain: std::sync::Arc<crate::chain::Chain>,
        signing_key: ed25519_dalek::SigningKey,
    ) {
        use crate::block::Block;
        use tracing::{info, warn, error};

        let public_key = signing_key.verifying_key().to_bytes();
        info!("Starting block production for validator: {}", hex::encode(public_key));

        let mut interval = tokio::time::interval(std::time::Duration::from_secs(BLOCK_TIME_SECS));

        loop {
            interval.tick().await;

            let current_slot = *self.current_slot.read().unwrap();
            self.advance_slot();

            // Check if we are the leader for this slot
            if let Some(leader) = self.select_leader(current_slot) {
                if leader == public_key {
                    info!("Produced block leader for slot {}: We are the leader!", current_slot);
                    
                    // Collect transactions from mempool
                    let txs = chain.get_pending_transactions(crate::MAX_TXS_PER_BLOCK);
                    
                    let height = chain.height() + 1;
                    let prev_hash = chain.tip();
                    
                    let mut block = Block::new(
                        height,
                        prev_hash,
                        txs,
                        public_key,
                    );
                    
                    // Sign the block
                    block.sign(&signing_key);
                    
                    // Add to local chain
                    if let Err(e) = chain.add_block(block) {
                        error!("Failed to add self-produced block: {:?}", e);
                    } else {
                        info!("Successfully produced and added block at height {}", height);
                        self.record_block_produced(&public_key);
                    }
                } else {
                    debug!("Slot {}: Leader is {}", current_slot, hex::encode(leader));
                    // In a real implementation, we would wait for the block from the network
                    // and record a missed slot if it doesn't arrive.
                }
            } else {
                warn!("No active validators for slot {}", current_slot);
            }
        }
    }
}

impl Default for Consensus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_validator() {
        let consensus = Consensus::new();
        
        let result = consensus.register_validator(
            [0x01u8; 32],
            MIN_VALIDATOR_STAKE,
        );

        assert!(result.is_ok());
        assert_eq!(consensus.active_validator_count(), 1);
    }

    #[test]
    fn test_stake_too_low() {
        let consensus = Consensus::new();
        
        let result = consensus.register_validator(
            [0x01u8; 32],
            MIN_VALIDATOR_STAKE - 1,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_leader_selection() {
        let consensus = Consensus::new();
        
        consensus.register_validator([0x01u8; 32], MIN_VALIDATOR_STAKE).unwrap();
        consensus.register_validator([0x02u8; 32], MIN_VALIDATOR_STAKE * 2).unwrap();

        let leader = consensus.select_leader(0);
        assert!(leader.is_some());
    }

    #[test]
    fn test_total_stake() {
        let consensus = Consensus::new();
        
        consensus.register_validator([0x01u8; 32], MIN_VALIDATOR_STAKE).unwrap();
        consensus.register_validator([0x02u8; 32], MIN_VALIDATOR_STAKE * 2).unwrap();

        assert_eq!(consensus.total_stake(), MIN_VALIDATOR_STAKE * 3);
    }
}

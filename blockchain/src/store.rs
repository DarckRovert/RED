//! Persistent storage for blockchain data using Sled (Pure Rust).

use std::path::Path;
use sled::{Db, Batch};
use serde::{de::DeserializeOwned, Serialize};

use crate::{BlockchainError, BlockchainResult};
use crate::block::{Block, BlockHash};

/// Keys for metadata
const KEY_TIP: &[u8] = b"tip";
const KEY_HEIGHT: &[u8] = b"height";

/// Persistent block store
pub struct BlockStore {
    db: Db,
}

impl BlockStore {
    /// Open a new block store at the given path
    pub fn open<P: AsRef<Path>>(path: P) -> BlockchainResult<Self> {
        let db = sled::open(path)
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        Ok(Self { db })
    }

    /// Save a block
    pub fn save_block(&self, block: &Block) -> BlockchainResult<()> {
        let hash = block.hash();
        let height = block.header.height;
        
        let mut batch = Batch::default();
        
        // Save block data
        let block_data = bincode::serialize(block)
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
        batch.insert(format!("b:{}", hex::encode(hash)).as_bytes(), block_data);
        
        // Save height index
        batch.insert(format!("h:{}", height).as_bytes(), hash.to_vec());
        
        // Update tip and height
        batch.insert(KEY_TIP, hash.to_vec());
        batch.insert(KEY_HEIGHT, height.to_le_bytes().to_vec());
        
        self.db.apply_batch(batch)
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        // Flush to disk
        self.db.flush()
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        Ok(())
    }

    /// Get a block by hash
    pub fn get_block(&self, hash: &BlockHash) -> BlockchainResult<Option<Block>> {
        let data = self.db.get(format!("b:{}", hex::encode(hash)))
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        match data {
            Some(bytes) => {
                let block = bincode::deserialize(&bytes)
                    .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
                Ok(Some(block))
            }
            None => Ok(None),
        }
    }

    /// Get a block hash by height
    pub fn get_hash_at_height(&self, height: u64) -> BlockchainResult<Option<BlockHash>> {
        let data = self.db.get(format!("h:{}", height))
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        match data {
            Some(bytes) => {
                let arr: [u8; 32] = bytes.to_vec().try_into()
                    .map_err(|_| BlockchainError::StorageError("Invalid hash length in DB".to_string()))?;
                Ok(Some(arr))
            }
            None => Ok(None),
        }
    }

    /// Get current tip hash
    pub fn get_tip(&self) -> BlockchainResult<Option<BlockHash>> {
        let data = self.db.get(KEY_TIP)
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        match data {
            Some(bytes) => {
                let arr: [u8; 32] = bytes.to_vec().try_into()
                    .map_err(|_| BlockchainError::StorageError("Invalid hash length in DB".to_string()))?;
                Ok(Some(arr))
            }
            None => Ok(None),
        }
    }

    /// Get current height
    pub fn get_height(&self) -> BlockchainResult<u64> {
        let data = self.db.get(KEY_HEIGHT)
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        match data {
            Some(bytes) => {
                let arr: [u8; 8] = bytes.to_vec().try_into()
                    .map_err(|_| BlockchainError::StorageError("Invalid height length in DB".to_string()))?;
                Ok(u64::from_le_bytes(arr))
            }
            None => Ok(0),
        }
    }

    /// Save arbitrary state (e.g. identity registry)
    pub fn save_state<S: Serialize>(&self, key: &str, state: &S) -> BlockchainResult<()> {
        let data = bincode::serialize(state)
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
        self.db.insert(format!("s:{}", key).as_bytes(), data)
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
        self.db.flush()
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
        Ok(())
    }

    /// Load arbitrary state
    pub fn load_state<S: DeserializeOwned>(&self, key: &str) -> BlockchainResult<Option<S>> {
        let data = self.db.get(format!("s:{}", key).as_bytes())
            .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
            
        match data {
            Some(bytes) => {
                let state = bincode::deserialize(&bytes)
                    .map_err(|e| BlockchainError::StorageError(e.to_string()))?;
                Ok(Some(state))
            }
            None => Ok(None),
        }
    }
}

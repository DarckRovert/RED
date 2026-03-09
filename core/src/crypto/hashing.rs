//! Hashing and key derivation functions.

use hkdf::Hkdf;
use sha2::Sha256;

use super::{CryptoError, CryptoResult};

/// Hash data using BLAKE3
pub fn hash(data: &[u8]) -> [u8; 32] {
    *blake3::hash(data).as_bytes()
}

/// Alias for hash() — used by other modules as blake3_hash
pub fn blake3_hash(data: &[u8]) -> [u8; 32] {
    hash(data)
}


/// Hash multiple pieces of data
pub fn hash_many(parts: &[&[u8]]) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new();
    for part in parts {
        hasher.update(part);
    }
    *hasher.finalize().as_bytes()
}

/// Derive a key using HKDF-SHA256
///
/// # Arguments
/// * `ikm` - Input key material
/// * `salt` - Optional salt (can be empty)
/// * `info` - Context info for domain separation
/// * `output_len` - Desired output length
///
/// # Returns
/// Derived key material
pub fn derive_key(
    ikm: &[u8],
    salt: &[u8],
    info: &[u8],
    output_len: usize,
) -> CryptoResult<Vec<u8>> {
    let hk = Hkdf::<Sha256>::new(Some(salt), ikm);
    let mut okm = vec![0u8; output_len];
    
    hk.expand(info, &mut okm)
        .map_err(|e| CryptoError::KeyDerivationError(e.to_string()))?;
    
    Ok(okm)
}

/// Derive a 32-byte symmetric key
pub fn derive_symmetric_key(
    ikm: &[u8],
    salt: &[u8],
    info: &[u8],
) -> CryptoResult<[u8; 32]> {
    let derived = derive_key(ikm, salt, info, 32)?;
    let mut key = [0u8; 32];
    key.copy_from_slice(&derived);
    Ok(key)
}

/// Derive chain and message keys for Double Ratchet
pub fn derive_chain_keys(
    chain_key: &[u8; 32],
) -> CryptoResult<([u8; 32], [u8; 32])> {
    // Derive new chain key
    let new_chain_key = derive_symmetric_key(
        chain_key,
        b"",
        b"RED-chain-key",
    )?;

    // Derive message key
    let message_key = derive_symmetric_key(
        chain_key,
        b"",
        b"RED-message-key",
    )?;

    Ok((new_chain_key, message_key))
}

/// Create identity hash from public key
pub fn create_identity_hash(public_key: &[u8; 32], random: &[u8; 32]) -> [u8; 32] {
    hash_many(&[public_key, random])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash() {
        let data = b"Hello, RED!";
        let h1 = hash(data);
        let h2 = hash(data);
        
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 32);
    }

    #[test]
    fn test_hash_different_inputs() {
        let h1 = hash(b"Hello");
        let h2 = hash(b"World");
        
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_hash_many() {
        let parts = [b"Hello".as_slice(), b"World".as_slice()];
        let h = hash_many(&parts);
        
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn test_derive_key() {
        let ikm = b"input key material";
        let salt = b"salt";
        let info = b"context info";

        let key1 = derive_key(ikm, salt, info, 32).unwrap();
        let key2 = derive_key(ikm, salt, info, 32).unwrap();

        assert_eq!(key1, key2);
        assert_eq!(key1.len(), 32);
    }

    #[test]
    fn test_derive_different_info() {
        let ikm = b"input key material";
        let salt = b"salt";

        let key1 = derive_key(ikm, salt, b"info1", 32).unwrap();
        let key2 = derive_key(ikm, salt, b"info2", 32).unwrap();

        assert_ne!(key1, key2);
    }

    #[test]
    fn test_derive_chain_keys() {
        let chain_key = [0x42u8; 32];
        
        let (new_chain, message) = derive_chain_keys(&chain_key).unwrap();
        
        assert_ne!(new_chain, chain_key);
        assert_ne!(message, chain_key);
        assert_ne!(new_chain, message);
    }

    #[test]
    fn test_identity_hash() {
        let pk = [0x42u8; 32];
        let r1 = [0x01u8; 32];
        let r2 = [0x02u8; 32];

        let id1 = create_identity_hash(&pk, &r1);
        let id2 = create_identity_hash(&pk, &r2);

        // Same public key with different random should produce different IDs
        assert_ne!(id1, id2);
    }
}

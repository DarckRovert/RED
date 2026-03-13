//! Symmetric encryption using ChaCha20-Poly1305.

use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use rand::RngCore;
use serde::{Deserialize, Serialize};

use super::{CryptoError, CryptoResult, NONCE_SIZE};

/// Encrypted data with nonce
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EncryptedData {
    /// The nonce used for encryption
    pub nonce: [u8; NONCE_SIZE],
    /// The ciphertext (includes authentication tag)
    pub ciphertext: Vec<u8>,
}

impl EncryptedData {
    /// Get total size in bytes
    pub fn size(&self) -> usize {
        NONCE_SIZE + self.ciphertext.len()
    }

    /// Serialize to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(self.size());
        bytes.extend_from_slice(&self.nonce);
        bytes.extend_from_slice(&self.ciphertext);
        bytes
    }

    /// Deserialize from bytes
    pub fn from_bytes(bytes: &[u8]) -> CryptoResult<Self> {
        if bytes.len() < NONCE_SIZE {
            return Err(CryptoError::DecryptionError(
                "Data too short".to_string()
            ));
        }

        let mut nonce = [0u8; NONCE_SIZE];
        nonce.copy_from_slice(&bytes[..NONCE_SIZE]);
        let ciphertext = bytes[NONCE_SIZE..].to_vec();

        Ok(Self { nonce, ciphertext })
    }
}

/// Encrypt plaintext using ChaCha20-Poly1305
///
/// # Arguments
/// * `key` - 32-byte symmetric key
/// * `plaintext` - Data to encrypt
///
/// # Returns
/// Encrypted data with nonce
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> CryptoResult<EncryptedData> {
    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;

    Ok(EncryptedData {
        nonce: nonce_bytes,
        ciphertext,
    })
}

/// Decrypt ciphertext using ChaCha20-Poly1305
///
/// # Arguments
/// * `key` - 32-byte symmetric key
/// * `encrypted` - Encrypted data with nonce
///
/// # Returns
/// Decrypted plaintext
pub fn decrypt(key: &[u8; 32], encrypted: &EncryptedData) -> CryptoResult<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))?;

    let nonce = Nonce::from_slice(&encrypted.nonce);

    cipher
        .decrypt(nonce, encrypted.ciphertext.as_ref())
        .map_err(|_| CryptoError::DecryptionError(
            "Authentication failed".to_string()
        ))
}

/// Encrypt with associated data (AEAD)
pub fn encrypt_with_aad(
    key: &[u8; 32],
    plaintext: &[u8],
    aad: &[u8],
) -> CryptoResult<EncryptedData> {
    use chacha20poly1305::aead::Payload;

    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let payload = Payload {
        msg: plaintext,
        aad,
    };

    let ciphertext = cipher
        .encrypt(nonce, payload)
        .map_err(|e| CryptoError::EncryptionError(e.to_string()))?;

    Ok(EncryptedData {
        nonce: nonce_bytes,
        ciphertext,
    })
}

/// Decrypt with associated data (AEAD)
pub fn decrypt_with_aad(
    key: &[u8; 32],
    encrypted: &EncryptedData,
    aad: &[u8],
) -> CryptoResult<Vec<u8>> {
    use chacha20poly1305::aead::Payload;

    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| CryptoError::DecryptionError(e.to_string()))?;

    let nonce = Nonce::from_slice(&encrypted.nonce);

    let payload = Payload {
        msg: &encrypted.ciphertext,
        aad,
    };

    cipher
        .decrypt(nonce, payload)
        .map_err(|_| CryptoError::DecryptionError(
            "Authentication failed".to_string()
        ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = [0x42u8; 32];
        let plaintext = b"Hello, RED Protocol!";

        let encrypted = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &encrypted).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = [0x42u8; 32];
        let key2 = [0x43u8; 32];
        let plaintext = b"Secret message";

        let encrypted = encrypt(&key1, plaintext).unwrap();
        let result = decrypt(&key2, &encrypted);

        assert!(result.is_err());
    }

    #[test]
    fn test_encrypt_decrypt_with_aad() {
        let key = [0x42u8; 32];
        let plaintext = b"Hello, RED!";
        let aad = b"additional data";

        let encrypted = encrypt_with_aad(&key, plaintext, aad).unwrap();
        let decrypted = decrypt_with_aad(&key, &encrypted, aad).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }

    #[test]
    fn test_wrong_aad_fails() {
        let key = [0x42u8; 32];
        let plaintext = b"Hello, RED!";
        let aad1 = b"correct aad";
        let aad2 = b"wrong aad";

        let encrypted = encrypt_with_aad(&key, plaintext, aad1).unwrap();
        let result = decrypt_with_aad(&key, &encrypted, aad2);

        assert!(result.is_err());
    }

    #[test]
    fn test_serialization() {
        let key = [0x42u8; 32];
        let plaintext = b"Test serialization";

        let encrypted = encrypt(&key, plaintext).unwrap();
        let bytes = encrypted.to_bytes();
        let recovered = EncryptedData::from_bytes(&bytes).unwrap();
        let decrypted = decrypt(&key, &recovered).unwrap();

        assert_eq!(plaintext.as_slice(), decrypted.as_slice());
    }
}

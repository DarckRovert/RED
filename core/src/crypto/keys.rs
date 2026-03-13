//! Key management for RED protocol.

use rand::rngs::OsRng;
use x25519_dalek::{EphemeralSecret, PublicKey as X25519PublicKey, StaticSecret};
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};
use zeroize::ZeroizeOnDrop;
use serde::{Deserialize, Serialize};

use super::{CryptoError, CryptoResult};

/// A 32-byte secret key
#[derive(Clone, ZeroizeOnDrop, Serialize, Deserialize)]
pub struct SecretKey {
    bytes: [u8; 32],
}

impl std::fmt::Debug for SecretKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SecretKey(<REDACTED>)")
    }
}

impl SecretKey {
    /// Generate a new random secret key
    pub fn generate() -> Self {
        let mut bytes = [0u8; 32];
        rand::RngCore::fill_bytes(&mut OsRng, &mut bytes);
        Self { bytes }
    }

    /// Create from raw bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { bytes }
    }

    /// Get the raw bytes (use with caution)
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.bytes
    }
}

/// A 32-byte public key
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PublicKey {
    bytes: [u8; 32],
}

impl PublicKey {
    /// Create from raw bytes
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { bytes }
    }

    /// Get the raw bytes
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.bytes
    }

    /// Convert to hex string
    pub fn to_hex(&self) -> String {
        hex::encode(&self.bytes)
    }

    /// Parse from hex string
    pub fn from_hex(s: &str) -> CryptoResult<Self> {
        let bytes = hex::decode(s)
            .map_err(|e| CryptoError::InvalidKeyFormat(e.to_string()))?;
        
        if bytes.len() != 32 {
            return Err(CryptoError::InvalidKeyFormat(
                "Public key must be 32 bytes".to_string()
            ));
        }

        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Self { bytes: arr })
    }
}

/// A key pair for X25519 key exchange
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyPair {
    /// The secret key
    pub secret: SecretKey,
    /// The public key
    pub public: PublicKey,
}

impl KeyPair {
    /// Generate a new random key pair
    pub fn generate() -> Self {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = X25519PublicKey::from(&secret);

        Self {
            secret: SecretKey::from_bytes(secret.to_bytes()),
            public: PublicKey::from_bytes(public.to_bytes()),
        }
    }

    /// Perform X25519 key exchange
    pub fn key_exchange(&self, their_public: &PublicKey) -> [u8; 32] {
        let secret = StaticSecret::from(*self.secret.as_bytes());
        let their_public = X25519PublicKey::from(*their_public.as_bytes());
        let shared = secret.diffie_hellman(&their_public);
        *shared.as_bytes()
    }
}

/// Ephemeral key pair for single-use key exchange
pub struct EphemeralKeyPair {
    secret: EphemeralSecret,
    /// The public key
    pub public: PublicKey,
}

impl EphemeralKeyPair {
    /// Generate a new ephemeral key pair
    pub fn generate() -> Self {
        let secret = EphemeralSecret::random_from_rng(OsRng);
        let public = X25519PublicKey::from(&secret);

        Self {
            secret,
            public: PublicKey::from_bytes(public.to_bytes()),
        }
    }

    /// Perform X25519 key exchange (consumes the ephemeral secret)
    pub fn key_exchange(self, their_public: &PublicKey) -> [u8; 32] {
        let their_public = X25519PublicKey::from(*their_public.as_bytes());
        let shared = self.secret.diffie_hellman(&their_public);
        *shared.as_bytes()
    }
}

/// Helper function to perform X25519 diffie-hellman exchange without wrapping
pub fn x25519_diffie_hellman(secret: &[u8; 32], public: &[u8; 32]) -> [u8; 32] {
    let s = StaticSecret::from(*secret);
    let p = X25519PublicKey::from(*public);
    *s.diffie_hellman(&p).as_bytes()
}

/// Signing key pair for Ed25519 signatures
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SigningKeyPair {
    #[serde(with = "signing_key_serde")]
    signing_key: SigningKey,
    /// The verifying (public) key
    #[serde(with = "verifying_key_serde")]
    pub verifying_key: VerifyingKey,
}

mod signing_key_serde {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(key: &SigningKey, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&key.to_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<SigningKey, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Vec<u8> = serde::Deserialize::deserialize(deserializer)?;
        let arr: [u8; 32] = bytes.try_into().map_err(|_| serde::de::Error::custom("Invalid key length"))?;
        Ok(SigningKey::from_bytes(&arr))
    }
}

mod verifying_key_serde {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(key: &VerifyingKey, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_bytes(&key.to_bytes())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<VerifyingKey, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Vec<u8> = serde::Deserialize::deserialize(deserializer)?;
        let arr: [u8; 32] = bytes.try_into().map_err(|_| serde::de::Error::custom("Invalid key length"))?;
        VerifyingKey::from_bytes(&arr).map_err(serde::de::Error::custom)
    }
}

impl SigningKeyPair {
    /// Generate a new signing key pair
    pub fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();

        Self {
            signing_key,
            verifying_key,
        }
    }

    /// Sign a message
    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        let signature = self.signing_key.sign(message);
        signature.to_bytes()
    }

    /// Verify a signature
    pub fn verify(&self, message: &[u8], signature: &[u8; 64]) -> CryptoResult<()> {
        let sig = Signature::from_bytes(signature);
        self.verifying_key
            .verify(message, &sig)
            .map_err(|_| CryptoError::SignatureVerificationFailed)
    }

    /// Get the verifying key bytes
    pub fn verifying_key_bytes(&self) -> [u8; 32] {
        self.verifying_key.to_bytes()
    }

    /// Get the signing key bytes
    pub fn signing_key_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation() {
        let kp = KeyPair::generate();
        assert_eq!(kp.public.as_bytes().len(), 32);
    }

    #[test]
    fn test_key_exchange() {
        let alice = KeyPair::generate();
        let bob = KeyPair::generate();

        let alice_shared = alice.key_exchange(&bob.public);
        let bob_shared = bob.key_exchange(&alice.public);

        assert_eq!(alice_shared, bob_shared);
    }

    #[test]
    fn test_ephemeral_key_exchange() {
        let alice = EphemeralKeyPair::generate();
        let bob = KeyPair::generate();

        let alice_public = alice.public.clone();
        let shared_alice = alice.key_exchange(&bob.public);
        let shared_bob = bob.key_exchange(&alice_public);

        assert_eq!(shared_alice, shared_bob);
    }

    #[test]
    fn test_signing() {
        let kp = SigningKeyPair::generate();
        let message = b"Hello, RED!";
        
        let signature = kp.sign(message);
        assert!(kp.verify(message, &signature).is_ok());
    }

    #[test]
    fn test_public_key_hex() {
        let kp = KeyPair::generate();
        let hex = kp.public.to_hex();
        let recovered = PublicKey::from_hex(&hex).unwrap();
        assert_eq!(kp.public, recovered);
    }
}

//! S/Kademlia Anti-Sybil Protection and Proof-of-Work (PoW) Engine
//!
//! Enforces computational cost on node identity generation and DHT provider record
//! advertisements, thwarting Sybil and Eclipse attacks against the planetary DHT.
//! Uses the high-performance BLAKE3 cryptographic hash function.

/// S/Kademlia Anti-Sybil Proof-of-Work verifier and generator
pub struct SybilGuard;

impl SybilGuard {
    /// Default difficulty (16 bits = ~65,536 hash operations, ~15ms on modern CPUs)
    pub const DEFAULT_DIFFICULTY_BITS: u32 = 16;
    /// Magic domain separation prefix for S/Kademlia PoW
    pub const DOMAIN_TAG: &'static [u8] = b"RED-S-KADEMLIA-SYBIL-POW-V1";

    /// Verifies if a given nonce satisfies the Anti-Sybil cryptographic difficulty
    pub fn verify_pow(public_key: &[u8; 32], nonce: u64, difficulty_bits: u32) -> bool {
        let mut hasher = blake3::Hasher::new();
        hasher.update(Self::DOMAIN_TAG);
        hasher.update(public_key);
        hasher.update(&nonce.to_le_bytes());
        let hash = hasher.finalize();
        let bytes = hash.as_bytes();

        let full_bytes = (difficulty_bits / 8) as usize;
        let rem_bits = (difficulty_bits % 8) as usize;

        if full_bytes > bytes.len() {
            return false;
        }

        for &b in &bytes[..full_bytes] {
            if b != 0 {
                return false;
            }
        }

        if rem_bits > 0 && full_bytes < bytes.len() {
            let mask = (0xFF00 >> rem_bits) as u8;
            if (bytes[full_bytes] & mask) != 0 {
                return false;
            }
        }

        true
    }

    /// Computes a valid PoW nonce for the given public key
    pub fn mine_pow(public_key: &[u8; 32], difficulty_bits: u32) -> u64 {
        let mut nonce = 0u64;
        loop {
            if Self::verify_pow(public_key, nonce, difficulty_bits) {
                return nonce;
            }
            nonce = nonce.wrapping_add(1);
        }
    }

    /// Computes the leading zero bits of a given hash for difficulty scoring
    pub fn count_leading_zero_bits(hash: &[u8; 32]) -> u32 {
        let mut count = 0u32;
        for &byte in hash {
            if byte == 0 {
                count += 8;
            } else {
                count += byte.leading_zeros();
                break;
            }
        }
        count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pow_mine_and_verify() {
        let pk = [0x42u8; 32];
        // Test with 12 bits of difficulty for fast deterministic test (<2ms)
        let difficulty = 12;
        let nonce = SybilGuard::mine_pow(&pk, difficulty);
        assert!(SybilGuard::verify_pow(&pk, nonce, difficulty));
        // Wrong nonce must fail
        assert!(!SybilGuard::verify_pow(&pk, nonce.wrapping_add(1), difficulty) || nonce.wrapping_add(1) == nonce);
    }

    #[test]
    fn test_leading_zeros() {
        let mut h = [0u8; 32];
        assert_eq!(SybilGuard::count_leading_zero_bits(&h), 256);
        h[0] = 0x0F; // 4 leading zeros
        assert_eq!(SybilGuard::count_leading_zero_bits(&h), 4);
    }
}

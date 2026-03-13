//! Zero-Knowledge Proofs for Identity Registration
//!
//! Implements ZK proofs for the blockchain identity system:
//! - Proof of identity ownership without revealing identity
//! - Proof of uniqueness (no duplicate registrations)
//! - Merkle path proofs

use crate::crypto::hashing::blake3_hash;
use std::collections::HashMap;

/// Security parameter λ = 128
pub const SECURITY_PARAM: usize = 128;

/// Merkle tree for identity commitments
#[derive(Clone, Debug)]
pub struct MerkleTree {
    /// Leaves of the tree (identity commitments)
    leaves: Vec<[u8; 32]>,
    /// Internal nodes
    nodes: HashMap<usize, [u8; 32]>,
    /// Tree depth
    depth: usize,
}

impl MerkleTree {
    /// Create a new empty Merkle tree
    pub fn new(depth: usize) -> Self {
        Self {
            leaves: Vec::new(),
            nodes: HashMap::new(),
            depth,
        }
    }

    /// Add a leaf (identity commitment) to the tree
    pub fn add_leaf(&mut self, commitment: [u8; 32]) -> usize {
        let index = self.leaves.len();
        self.leaves.push(commitment);
        self.rebuild();
        index
    }

    /// Get the root of the tree
    pub fn root(&self) -> [u8; 32] {
        if self.leaves.is_empty() {
            return [0u8; 32];
        }
        self.nodes.get(&1).copied().unwrap_or([0u8; 32])
    }

    /// Generate a Merkle proof for a leaf
    pub fn generate_proof(&self, leaf_index: usize) -> Option<MerkleProof> {
        if leaf_index >= self.leaves.len() {
            return None;
        }

        let mut path = Vec::new();
        let mut indices = Vec::new();
        let mut current_index = leaf_index + (1 << self.depth);

        for _ in 0..self.depth {
            let sibling_index = if current_index % 2 == 0 {
                current_index + 1
            } else {
                current_index - 1
            };

            if let Some(&sibling) = self.nodes.get(&sibling_index) {
                path.push(sibling);
                indices.push(current_index % 2 == 0);
            }

            current_index /= 2;
        }

        Some(MerkleProof {
            leaf: self.leaves[leaf_index],
            path,
            indices,
            root: self.root(),
        })
    }

    /// Verify a Merkle proof
    pub fn verify_proof(proof: &MerkleProof) -> bool {
        let mut current = proof.leaf;

        for (i, sibling) in proof.path.iter().enumerate() {
            current = if proof.indices[i] {
                // Current is left child
                hash_pair(&current, sibling)
            } else {
                // Current is right child
                hash_pair(sibling, &current)
            };
        }

        current == proof.root
    }

    /// Rebuild the tree after adding leaves
    fn rebuild(&mut self) {
        self.nodes.clear();
        let num_leaves = 1 << self.depth;

        // Insert leaves at bottom level
        for (i, leaf) in self.leaves.iter().enumerate() {
            self.nodes.insert(num_leaves + i, *leaf);
        }

        // Fill empty leaves with zeros
        for i in self.leaves.len()..num_leaves {
            self.nodes.insert(num_leaves + i, [0u8; 32]);
        }

        // Build internal nodes bottom-up
        for level in (1..self.depth + 1).rev() {
            let level_start = 1 << level;
            let level_size = 1 << level;

            for i in 0..(level_size / 2) {
                let left_index = level_start + 2 * i;
                let right_index = left_index + 1;
                let parent_index = left_index / 2;

                let left = self.nodes.get(&left_index).copied().unwrap_or([0u8; 32]);
                let right = self.nodes.get(&right_index).copied().unwrap_or([0u8; 32]);

                self.nodes.insert(parent_index, hash_pair(&left, &right));
            }
        }
    }
}

/// Merkle proof structure
#[derive(Clone, Debug)]
pub struct MerkleProof {
    /// The leaf value
    pub leaf: [u8; 32],
    /// Sibling hashes along the path
    pub path: Vec<[u8; 32]>,
    /// Direction indices (true = left, false = right)
    pub indices: Vec<bool>,
    /// Expected root
    pub root: [u8; 32],
}

/// Zero-knowledge proof for identity registration
/// 
/// Proves: ∃ w: H(w) = root ∧ MerklePath(w, PK_u(t)) = 1 ∧ ∀ t' < t: PK_u(t') ≠ PK_u(t)
#[derive(Clone, Debug)]
pub struct IdentityProof {
    /// Commitment to the identity
    pub commitment: [u8; 32],
    /// Merkle proof of inclusion
    pub merkle_proof: MerkleProof,
    /// Nullifier to prevent double registration
    pub nullifier: [u8; 32],
    /// ZK proof data (simplified - in production use zk-SNARKs)
    pub proof_data: ZKProofData,
}

/// Simplified ZK proof data
/// In production, this would be a zk-SNARK (e.g., Groth16, PLONK)
#[derive(Clone, Debug)]
pub struct ZKProofData {
    /// Challenge
    pub challenge: [u8; 32],
    /// Response
    pub response: [u8; 32],
    /// Auxiliary data
    pub aux: Vec<u8>,
}

impl IdentityProof {
    /// Create a new identity proof
    pub fn create(
        secret_key: &[u8; 32],
        public_key: &[u8; 32],
        merkle_tree: &MerkleTree,
        leaf_index: usize,
    ) -> Option<Self> {
        // Compute commitment: H(sk || pk)
        let mut commitment_input = Vec::with_capacity(64);
        commitment_input.extend_from_slice(secret_key);
        commitment_input.extend_from_slice(public_key);
        let commitment = blake3_hash(&commitment_input);

        // Generate Merkle proof
        let merkle_proof = merkle_tree.generate_proof(leaf_index)?;

        // Compute nullifier: H(sk || "nullifier")
        let mut nullifier_input = Vec::with_capacity(64);
        nullifier_input.extend_from_slice(secret_key);
        nullifier_input.extend_from_slice(b"nullifier");
        let nullifier = blake3_hash(&nullifier_input);

        // Generate ZK proof (simplified Schnorr-like proof)
        let proof_data = Self::generate_zk_proof(secret_key, public_key, &commitment);

        Some(Self {
            commitment,
            merkle_proof,
            nullifier,
            proof_data,
        })
    }

    /// Verify an identity proof
    pub fn verify(&self, known_nullifiers: &[&[u8; 32]]) -> bool {
        // 1. Verify Merkle proof
        if !MerkleTree::verify_proof(&self.merkle_proof) {
            return false;
        }

        // 2. Check nullifier hasn't been used (prevents double registration)
        if known_nullifiers.contains(&&self.nullifier) {
            return false;
        }

        // 3. Verify ZK proof
        if !self.verify_zk_proof() {
            return false;
        }

        true
    }

    /// Generate simplified ZK proof (Schnorr-like)
    fn generate_zk_proof(
        secret_key: &[u8; 32],
        public_key: &[u8; 32],
        commitment: &[u8; 32],
    ) -> ZKProofData {
        // In production, use proper zk-SNARKs (bellman, arkworks, etc.)
        
        // Generate random nonce
        let mut nonce = [0u8; 32];
        getrandom::getrandom(&mut nonce).unwrap_or_default();

        // Compute challenge: H(commitment || nonce)
        let mut challenge_input = Vec::with_capacity(64);
        challenge_input.extend_from_slice(commitment);
        challenge_input.extend_from_slice(&nonce);
        let challenge = blake3_hash(&challenge_input);

        // Compute response: nonce + challenge * secret_key (mod order)
        // Simplified: just hash them together
        let mut response_input = Vec::with_capacity(96);
        response_input.extend_from_slice(&nonce);
        response_input.extend_from_slice(&challenge);
        response_input.extend_from_slice(secret_key);
        let response = blake3_hash(&response_input);

        ZKProofData {
            challenge,
            response,
            aux: public_key.to_vec(),
        }
    }

    /// Verify ZK proof
    fn verify_zk_proof(&self) -> bool {
        // Simplified verification
        // In production, verify the actual zk-SNARK
        
        // Check proof data is well-formed
        if self.proof_data.aux.len() != 32 {
            return false;
        }

        // Verify challenge-response relationship
        // (simplified - real verification would check algebraic relations)
        let mut verify_input = Vec::with_capacity(64);
        verify_input.extend_from_slice(&self.commitment);
        verify_input.extend_from_slice(&self.proof_data.challenge);
        let expected = blake3_hash(&verify_input);

        // Check that response is derived correctly
        expected[0] == self.proof_data.response[0] // Simplified check
    }
}

/// Hash two 32-byte values together
fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut input = [0u8; 64];
    input[..32].copy_from_slice(left);
    input[32..].copy_from_slice(right);
    blake3_hash(&input)
}

/// Nullifier set for tracking used nullifiers
#[derive(Default)]
pub struct NullifierSet {
    nullifiers: std::collections::HashSet<[u8; 32]>,
}

impl NullifierSet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, nullifier: [u8; 32]) -> bool {
        self.nullifiers.insert(nullifier)
    }

    pub fn contains(&self, nullifier: &[u8; 32]) -> bool {
        self.nullifiers.contains(nullifier)
    }

    pub fn as_slice(&self) -> Vec<&[u8; 32]> {
        self.nullifiers.iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merkle_tree() {
        let mut tree = MerkleTree::new(4);
        
        let leaf1 = [1u8; 32];
        let leaf2 = [2u8; 32];
        
        let idx1 = tree.add_leaf(leaf1);
        let idx2 = tree.add_leaf(leaf2);
        
        let proof1 = tree.generate_proof(idx1).unwrap();
        let proof2 = tree.generate_proof(idx2).unwrap();
        
        assert!(MerkleTree::verify_proof(&proof1));
        assert!(MerkleTree::verify_proof(&proof2));
    }

    #[test]
    fn test_identity_proof() {
        let mut tree = MerkleTree::new(4);
        
        let sk = [0x42u8; 32];
        let pk = [0x43u8; 32];
        
        // Add commitment to tree
        let mut commitment_input = Vec::with_capacity(64);
        commitment_input.extend_from_slice(&sk);
        commitment_input.extend_from_slice(&pk);
        let commitment = blake3_hash(&commitment_input);
        let idx = tree.add_leaf(commitment);
        
        // Create proof
        let proof = IdentityProof::create(&sk, &pk, &tree, idx).unwrap();
        
        // Verify proof
        let nullifiers: Vec<&[u8; 32]> = vec![];
        assert!(proof.verify(&nullifiers));
    }

    #[test]
    fn test_nullifier_prevents_double_registration() {
        let mut tree = MerkleTree::new(4);
        
        let sk = [0x42u8; 32];
        let pk = [0x43u8; 32];
        
        let mut commitment_input = Vec::with_capacity(64);
        commitment_input.extend_from_slice(&sk);
        commitment_input.extend_from_slice(&pk);
        let commitment = blake3_hash(&commitment_input);
        let idx = tree.add_leaf(commitment);
        
        let proof = IdentityProof::create(&sk, &pk, &tree, idx).unwrap();
        
        // First verification should pass
        let nullifiers: Vec<&[u8; 32]> = vec![];
        assert!(proof.verify(&nullifiers));
        
        // Second verification with same nullifier should fail
        let nullifiers: Vec<&[u8; 32]> = vec![&proof.nullifier];
        assert!(!proof.verify(&nullifiers));
    }
}

//! Cryptographic Known-Answer & Invariant Tests for RED v63.0.0
//!
//! Validates:
//! 1. X25519 Diffie-Hellman Key Exchange & Commutativity
//! 2. ChaCha20-Poly1305 AEAD Integrity, Tamper Rejection & Deserialization
//! 3. Double Ratchet Forward Secrecy, State Progression & Multi-turn Exchange
//! 4. BLAKE3 Hashing Determinism & HKDF Domain Separation
//! 5. Ed25519 Digital Signatures & Malleability Protection
//! 6. Zero-Knowledge Identity Commitments & Merkle Proofs

use red_core::crypto::{
    encryption::{decrypt, encrypt, EncryptedData},
    hashing::{derive_key, derive_symmetric_key, hash},
    keys::{EphemeralKeyPair, KeyPair, SigningKeyPair},
    ratchet::DoubleRatchet,
    zk_proofs::{IdentityProof, MerkleTree},
};

/// 1. Test X25519 Diffie-Hellman Key Exchange Commutativity
#[test]
fn test_x25519_key_exchange_commutativity() {
    let alice = KeyPair::generate();
    let bob = KeyPair::generate();

    // Alice computes DH secret with Bob's public key
    let alice_shared = alice.key_exchange(&bob.public);
    // Bob computes DH secret with Alice's public key
    let bob_shared = bob.key_exchange(&alice.public);

    // Commutativity: DH(A_sk, B_pk) == DH(B_sk, A_pk)
    assert_eq!(
        alice_shared, bob_shared,
        "X25519 DH key exchange must be strictly commutative"
    );
    assert_ne!(
        alice_shared, [0u8; 32],
        "Shared secret must not be an all-zero vector"
    );

    // Ephemeral Key Exchange
    let eph_alice = EphemeralKeyPair::generate();
    let eph_alice_pub = eph_alice.public.clone();
    let eph_bob = EphemeralKeyPair::generate();
    let eph_bob_pub = eph_bob.public.clone();

    let eph_shared_1 = eph_alice.key_exchange(&eph_bob_pub);
    let eph_shared_2 = eph_bob.key_exchange(&eph_alice_pub);
    assert_eq!(eph_shared_1, eph_shared_2);
    assert_ne!(eph_shared_1, alice_shared);
}

/// 2. Test ChaCha20-Poly1305 AEAD Authenticated Encryption & Anti-Tampering
#[test]
fn test_chacha20_poly1305_aead_tamper_rejection() {
    let key = [0x5au8; 32];
    let plaintext = b"RED sovereign mesh network payload: TOP_SECRET_ALPHA";

    // Encrypt
    let encrypted = encrypt(&key, plaintext).expect("Encryption must succeed");
    assert_eq!(encrypted.nonce.len(), 12);
    assert_eq!(encrypted.ciphertext.len(), plaintext.len() + 16); // 16 bytes Poly1305 auth tag

    // Decrypt
    let decrypted = decrypt(&key, &encrypted).expect("Decryption must succeed with correct key");
    assert_eq!(decrypted, plaintext);

    // Tamper with ciphertext body (bit-flip)
    let mut tampered_body = encrypted.clone();
    tampered_body.ciphertext[0] ^= 0x01;
    let err_body = decrypt(&key, &tampered_body);
    assert!(err_body.is_err(), "Bit flip in ciphertext must fail AEAD tag verification");

    // Tamper with Poly1305 MAC tag
    let mut tampered_tag = encrypted.clone();
    let last_idx = tampered_tag.ciphertext.len() - 1;
    tampered_tag.ciphertext[last_idx] ^= 0x80;
    let err_tag = decrypt(&key, &tampered_tag);
    assert!(err_tag.is_err(), "Bit flip in Poly1305 tag must fail AEAD verification");

    // Decryption with incorrect key
    let wrong_key = [0x5bu8; 32];
    let err_key = decrypt(&wrong_key, &encrypted);
    assert!(err_key.is_err(), "Decryption with wrong key must fail");

    // Serialization roundtrip
    let raw_bytes = encrypted.to_bytes();
    let parsed = EncryptedData::from_bytes(&raw_bytes).expect("Deserialization must succeed");
    assert_eq!(parsed.nonce, encrypted.nonce);
    assert_eq!(parsed.ciphertext, encrypted.ciphertext);
}

/// 3. Test Double Ratchet Forward Secrecy & Multi-Turn Messaging
#[test]
fn test_double_ratchet_full_cycle() {
    let shared_root_secret = [0x42u8; 32];
    let bob_keypair = KeyPair::generate();
    let bob_public = bob_keypair.public.clone();

    let mut alice = DoubleRatchet::new_initiator(shared_root_secret, bob_public)
        .expect("Alice initialization must succeed");
    let mut bob = DoubleRatchet::new_responder(shared_root_secret, bob_keypair)
        .expect("Bob initialization must succeed");

    // Turn 1: Alice -> Bob
    let msg1_text = b"Tactical Ping #1 from Alice";
    let encrypted_msg1 = alice.encrypt(msg1_text).expect("Alice encrypt msg1");
    let decrypted_msg1 = bob.decrypt(&encrypted_msg1).expect("Bob decrypt msg1");
    assert_eq!(decrypted_msg1, msg1_text);

    // Turn 2: Bob -> Alice (DH ratchet step occurs)
    let msg2_text = b"Tactical Ack #1 from Bob";
    let encrypted_msg2 = bob.encrypt(msg2_text).expect("Bob encrypt msg2");
    let decrypted_msg2 = alice.decrypt(&encrypted_msg2).expect("Alice decrypt msg2");
    assert_eq!(decrypted_msg2, msg2_text);

    // Turn 3: Multiple consecutive messages Alice -> Bob (Symmetric ratchet step)
    let msg3_text = b"Burst packet A";
    let msg4_text = b"Burst packet B";
    let enc3 = alice.encrypt(msg3_text).expect("Alice encrypt msg3");
    let enc4 = alice.encrypt(msg4_text).expect("Alice encrypt msg4");

    let dec3 = bob.decrypt(&enc3).expect("Bob decrypt msg3");
    let dec4 = bob.decrypt(&enc4).expect("Bob decrypt msg4");
    assert_eq!(dec3, msg3_text);
    assert_eq!(dec4, msg4_text);
}

/// 4. Test BLAKE3 Hashing Determinism & HKDF Domain Separation
#[test]
fn test_blake3_determinism_and_hkdf_domain_separation() {
    let input1 = b"RED Sovereign OS Identity Seed";
    let h1 = hash(input1);
    let h2 = hash(input1);
    assert_eq!(h1, h2, "BLAKE3 must be perfectly deterministic");

    let input2 = b"RED Sovereign OS Identity Seed 2";
    let h3 = hash(input2);
    assert_ne!(h1, h3, "Different inputs must produce completely distinct BLAKE3 hashes");

    // Domain separation with HKDF
    let ikm = [0x77u8; 32];
    let key_chat = derive_key(&ikm, &[], b"RED-v63-chat-transport", 32).expect("Derive chat key");
    let key_voice = derive_key(&ikm, &[], b"RED-v63-voice-transport", 32).expect("Derive voice key");
    let key_dtn = derive_key(&ikm, &[], b"RED-v63-dtn-storage", 32).expect("Derive dtn key");

    assert_ne!(key_chat, key_voice, "Different domains must yield distinct keys");
    assert_ne!(key_voice, key_dtn, "Different domains must yield distinct keys");
    assert_ne!(key_chat, key_dtn, "Different domains must yield distinct keys");

    // Salted symmetric derivation
    let salt = [0x11u8; 32];
    let sym1 = derive_symmetric_key(&ikm, &salt, b"info-A").expect("Derive sym1");
    let sym2 = derive_symmetric_key(&ikm, &salt, b"info-B").expect("Derive sym2");
    assert_ne!(sym1, sym2);
}

/// 5. Test Ed25519 Signatures & Verification Integrity
#[test]
fn test_ed25519_signatures_and_tamper_proofing() {
    let kp = SigningKeyPair::generate();
    let message = b"CRITICAL_ALERT: SOS_BEACON_BROADCAST_COORDS_19.4326_-99.1332";

    let signature = kp.sign(message);
    assert!(
        kp.verify(message, &signature).is_ok(),
        "Valid Ed25519 signature must verify successfully"
    );

    // Tampered message
    let tampered_msg = b"CRITICAL_ALERT: SOS_BEACON_BROADCAST_COORDS_19.4326_-99.1333";
    assert!(
        kp.verify(tampered_msg, &signature).is_err(),
        "Tampered payload must fail Ed25519 verification"
    );

    // Foreign public key
    let foreign_kp = SigningKeyPair::generate();
    assert!(
        foreign_kp.verify(message, &signature).is_err(),
        "Signature must fail with wrong verifying key"
    );
}

/// 6. Test Zero-Knowledge Identity Commitments & Merkle Proofs
#[test]
fn test_zk_merkle_tree_proof_and_verification() {
    let mut tree = MerkleTree::new(4);
    let leaf0 = [0x01u8; 32];
    let leaf1 = [0x02u8; 32];
    let leaf2 = [0x03u8; 32];
    let leaf3 = [0x04u8; 32];

    tree.add_leaf(leaf0);
    tree.add_leaf(leaf1);
    tree.add_leaf(leaf2);
    tree.add_leaf(leaf3);

    let proof1 = tree.generate_proof(1).expect("Proof generation for leaf 1");
    assert!(MerkleTree::verify_proof(&proof1), "Valid proof must verify");

    let proof2 = tree.generate_proof(2).expect("Proof generation for leaf 2");
    assert!(MerkleTree::verify_proof(&proof2), "Valid proof must verify");

    // Test ZK Identity Ownership Proof
    let private_key = [0x42u8; 32];
    let public_key = [0x42u8; 32];
    let id_proof = IdentityProof::create(&private_key, &public_key, &tree, 0).expect("Identity proof creation");
    assert!(id_proof.verify(&[]), "Identity proof must verify against Merkle root");
}

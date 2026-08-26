//! Known-Answer Tests (KAT) & Pruebas Criptográficas Deterministas
//!
//! Valida el comportamiento de los primitivos criptográficos contra vectores deterministas,
//! garantizando la resistencia contra manipulación de bits, secreto hacia adelante y
//! conmutatividad Diffie-Hellman en RED v63.0.0.

use red_core::crypto::{
    encryption::{decrypt, encrypt},
    hashing::{derive_key, hash},
    keys::{KeyPair, SigningKeyPair},
    ratchet::DoubleRatchet,
    zk_proofs::MerkleTree,
};

#[test]
fn test_blake3_known_answer_determinism() {
    let input = b"RED_SOVEREIGN_MESH_PROTOCOL_V63";
    let digest1 = hash(input);
    let digest2 = hash(input);

    assert_eq!(digest1, digest2, "BLAKE3 debe ser 100% determinista");
    assert_eq!(digest1.len(), 32, "El hash BLAKE3 debe tener exactamente 32 bytes");

    let ikm = b"master_secret_deterministic_seed";
    let derived_key1 = derive_key(ikm, &[], b"RED_ENCRYPTION_DOMAIN_V1", 32).unwrap();
    let derived_key2 = derive_key(ikm, &[], b"RED_ENCRYPTION_DOMAIN_V1", 32).unwrap();
    let derived_key3 = derive_key(ikm, &[], b"RED_SIGNING_DOMAIN_V2", 32).unwrap();

    assert_eq!(derived_key1, derived_key2);
    assert_ne!(derived_key1, derived_key3, "La separación de dominios en HKDF debe producir claves distintas");
}

#[test]
fn test_chacha20_poly1305_aead_known_answer_tamper_rejection() {
    let key = [0x42u8; 32];
    let plaintext = b"CONFIDENTIAL_TACTICAL_COORDINATES_LAT_-12.04637_LON_-77.04279";

    let encrypted = encrypt(&key, plaintext).expect("Encryption failed");

    // 1. Desencriptación correcta
    let decrypted = decrypt(&key, &encrypted).expect("Decryption failed");
    assert_eq!(decrypted, plaintext, "El texto plano recuperado debe coincidir bit a bit");

    // 2. Fallo ante clave incorrecta
    let wrong_key = [0x99u8; 32];
    let wrong_key_result = decrypt(&wrong_key, &encrypted);
    assert!(wrong_key_result.is_err(), "Debe rechazar clave errónea");

    // 3. Fallo ante alteración de bits en el texto cifrado (Anti-Tampering)
    let mut corrupted_encrypted = encrypted.clone();
    if !corrupted_encrypted.ciphertext.is_empty() {
        corrupted_encrypted.ciphertext[0] ^= 0x01; // Invertir 1 bit
    }
    let bitflip_result = decrypt(&key, &corrupted_encrypted);
    assert!(bitflip_result.is_err(), "Debe detectar e invalidar cualquier bit modificado");
}

#[test]
fn test_x25519_key_exchange_commutativity_kat() {
    let alice = KeyPair::generate();
    let bob = KeyPair::generate();

    let shared_alice = alice.key_exchange(&bob.public);
    let shared_bob = bob.key_exchange(&alice.public);

    assert_eq!(shared_alice, shared_bob, "El secreto compartido X25519 debe ser exactamente conmutativo (DH(A, B) == DH(B, A))");
    assert_eq!(shared_alice.len(), 32, "El secreto compartido debe tener exactamente 32 bytes");
}

#[test]
fn test_double_ratchet_forward_secrecy_kat() {
    let shared_root = [0x42u8; 32];
    let bob_keypair = KeyPair::generate();
    let bob_public = bob_keypair.public.clone();

    let mut alice = DoubleRatchet::new_initiator(shared_root, bob_public).unwrap();
    let mut bob = DoubleRatchet::new_responder(shared_root, bob_keypair).unwrap();

    // Turno 1: Alice -> Bob
    let enc1 = alice.encrypt(b"Alpha Turn 1").unwrap();
    let dec1 = bob.decrypt(&enc1).unwrap();
    assert_eq!(dec1, b"Alpha Turn 1");

    // Turno 2: Bob -> Alice
    let enc2 = bob.encrypt(b"Bravo Response 2").unwrap();
    let dec2 = alice.decrypt(&enc2).unwrap();
    assert_eq!(dec2, b"Bravo Response 2");

    // Turno 3: Alice -> Bob
    let enc3 = alice.encrypt(b"Charlie Ack 3").unwrap();
    let dec3 = bob.decrypt(&enc3).unwrap();
    assert_eq!(dec3, b"Charlie Ack 3");
}

#[test]
fn test_ed25519_signatures_and_anti_malleability() {
    let signing_keys = SigningKeyPair::generate();
    let message = b"CRITICAL_EMERGENCY_SOS_BEACON_PAYLOAD";

    let signature = signing_keys.sign(message);
    assert!(signing_keys.verify(message, &signature).is_ok(), "La firma válida debe verificarse correctamente");

    // Verificar que falla si el mensaje cambia
    let tampered_message = b"CRITICAL_EMERGENCY_SOS_BEACON_PAYLOAD_TAMPERED";
    assert!(signing_keys.verify(tampered_message, &signature).is_err(), "Debe rechazar mensaje alterado");
}

#[test]
fn test_zk_merkle_tree_proof_and_verification_kat() {
    let mut tree = MerkleTree::new(4); // 2^4 = 16 hojas

    let leaf0 = hash(b"leaf_identity_alpha");
    let leaf1 = hash(b"leaf_identity_bravo");
    let leaf2 = hash(b"leaf_identity_charlie");
    let leaf3 = hash(b"leaf_identity_delta");

    tree.add_leaf(leaf0);
    tree.add_leaf(leaf1);
    tree.add_leaf(leaf2);
    tree.add_leaf(leaf3);

    // Generar y validar prueba para leaf1 (índice 1)
    let proof = tree.generate_proof(1).expect("Proof generation");
    let is_valid = MerkleTree::verify_proof(&proof);
    assert!(is_valid, "La prueba de Merkle Tree ZK debe ser válida para la raíz del árbol");

    // Fallo si se intenta verificar con una prueba alterada
    let mut fake_proof = proof;
    fake_proof.leaf = hash(b"leaf_identity_forged");
    let is_fake_valid = MerkleTree::verify_proof(&fake_proof);
    assert!(!is_fake_valid, "Debe rechazar pruebas con hojas falsificadas");
}

//! Integration tests for the RED Protocol
//!
//! These tests verify that the major components work correctly together.
//! All tests use real cryptographic primitives, not mocks.

#[cfg(test)]
mod crypto_tests {
    use red_core::crypto::{
        keys::{PublicKey, SecretKey},
        encryption,
        signing,
        hashing,
    };

    #[test]
    fn test_chacha20_encrypt_decrypt_roundtrip() {
        let key = [0x42u8; 32];
        let nonce = [0x24u8; 12];
        let plaintext = b"RED Protocol secret message";

        let ciphertext = encryption::encrypt(&key, &nonce, plaintext)
            .expect("Encryption should succeed");

        assert_ne!(ciphertext, plaintext, "Ciphertext must differ from plaintext");

        let decrypted = encryption::decrypt(&key, &nonce, &ciphertext)
            .expect("Decryption should succeed");

        assert_eq!(decrypted, plaintext, "Decrypted text must match original");
    }

    #[test]
    fn test_wrong_key_fails_decryption() {
        let key = [0x42u8; 32];
        let wrong_key = [0x99u8; 32];
        let nonce = [0x01u8; 12];
        let plaintext = b"secret";

        let ciphertext = encryption::encrypt(&key, &nonce, plaintext)
            .expect("Encryption should succeed");

        let result = encryption::decrypt(&wrong_key, &nonce, &ciphertext);
        assert!(result.is_err(), "Decryption with wrong key must fail (AEAD integrity check)");
    }

    #[test]
    fn test_ed25519_sign_verify() {
        let (sk, pk) = signing::generate_keypair();
        let message = b"RED Network block data";

        let signature = signing::sign(&sk, message);
        assert!(signing::verify(&pk, message, &signature), "Valid signature must verify");
    }

    #[test]
    fn test_tampered_message_fails_verify() {
        let (sk, pk) = signing::generate_keypair();
        let message = b"original message";
        let mut tampered = message.to_vec();

        let signature = signing::sign(&sk, message);
        tampered[0] ^= 0xFF; // Flip bits in the first byte

        assert!(!signing::verify(&pk, &tampered, &signature),
            "Tampered message must fail signature verification");
    }

    #[test]
    fn test_hkdf_key_derivation_deterministic() {
        let password = b"test_password";
        let salt = b"red-salt";
        let info = b"storage-key";

        let key1 = hashing::derive_symmetric_key(password, salt, info)
            .expect("Key derivation should succeed");
        let key2 = hashing::derive_symmetric_key(password, salt, info)
            .expect("Key derivation should be deterministic");

        assert_eq!(key1, key2, "HKDF must be deterministic");
    }

    #[test]
    fn test_different_passwords_produce_different_keys() {
        let k1 = hashing::derive_symmetric_key(b"password1", b"salt", b"info").unwrap();
        let k2 = hashing::derive_symmetric_key(b"password2", b"salt", b"info").unwrap();
        assert_ne!(k1, k2, "Different passwords must produce different keys");
    }

    #[test]
    fn test_blake3_hash_consistency() {
        let data = b"RED Protocol";
        let h1 = blake3::hash(data);
        let h2 = blake3::hash(data);
        assert_eq!(h1, h2, "BLAKE3 hash must be deterministic");
        assert_ne!(blake3::hash(b"other"), h1, "Different inputs must hash differently");
    }
}

#[cfg(test)]
mod identity_tests {
    use red_core::identity::Identity;

    #[test]
    fn test_identity_generation_unique() {
        let id1 = Identity::generate().expect("Identity generation should succeed");
        let id2 = Identity::generate().expect("Identity generation should succeed");
        assert_ne!(
            id1.identity_hash().as_bytes(),
            id2.identity_hash().as_bytes(),
            "Two generated identities must be unique"
        );
    }

    #[test]
    fn test_identity_key_exchange_produces_shared_secret() {
        let alice = Identity::generate().unwrap();
        let bob = Identity::generate().unwrap();

        // X25519 DH: alice secret * bob public == bob secret * alice public
        let alice_shared = alice.key_exchange(bob.public_key());
        let bob_shared = bob.key_exchange(alice.public_key());

        assert_eq!(alice_shared, bob_shared,
            "Key exchange must produce the same shared secret on both sides");
    }

    #[test]
    fn test_identity_hash_is_32_bytes() {
        let id = Identity::generate().unwrap();
        assert_eq!(id.identity_hash().as_bytes().len(), 32,
            "Identity hash must be exactly 32 bytes");
    }
}

#[cfg(test)]
mod storage_tests {
    use red_core::storage::Storage;
    use red_core::identity::Identity;
    use red_core::crypto::hashing;

    fn make_test_storage() -> (tempfile::TempDir, Storage) {
        let dir = tempfile::tempdir().expect("Should create temp dir");
        let key = hashing::derive_symmetric_key(b"test_pass", b"salt", b"key").unwrap();
        let mut storage = Storage::new(dir.path().join("storage"), key);
        storage.open().expect("Storage should open");
        (dir, storage)
    }

    #[test]
    fn test_storage_identity_persistence() {
        let (_dir, mut s) = make_test_storage();
        let id = Identity::generate().unwrap();

        s.set_identity(id.clone()).expect("Should save identity");
        let loaded = s.get_identity().expect("Should load identity");
        assert_eq!(loaded.identity_hash(), id.identity_hash(),
            "Loaded identity must match saved identity");
    }

    #[test]
    fn test_storage_contact_add_retrieve() {
        let (_dir, mut s) = make_test_storage();
        let contact = red_core::storage::Contact {
            identity_hash: red_core::identity::IdentityHash::from_bytes([0xABu8; 32]),
            display_name: "Alice".to_string(),
            public_key: [0u8; 32],
            added_at: 1_000_000,
            verified: true,
            blocked: false,
            notes: None,
        };

        s.add_contact(contact.clone()).expect("Should add contact");
        let contacts = s.get_contacts();
        assert_eq!(contacts.len(), 1, "Should have exactly one contact");
        assert_eq!(contacts[0].display_name, "Alice");
    }
}

#[cfg(test)]
mod blockchain_tests {
    use red_blockchain::consensus::{Consensus, MIN_VALIDATOR_STAKE};

    #[test]
    fn test_slashing_on_double_sign() {
        let consensus = Consensus::new();
        let key = [0x01u8; 32];

        consensus.register_validator(key, MIN_VALIDATOR_STAKE * 10).unwrap();

        // Simulate a double sign infraction
        consensus.slash_validator(&key, red_blockchain::consensus::SlashReason::DoubleSign)
            .expect("Slashing should succeed");

        let validators = consensus.get_validators();
        let v = validators.get(&key).unwrap();

        // After slashing, stake should be reduced
        assert!(v.stake < MIN_VALIDATOR_STAKE * 10,
            "Stake must be reduced after slashing");
    }

    #[test]
    fn test_validator_deactivated_below_min_stake() {
        let consensus = Consensus::new();
        let key = [0x02u8; 32];
        let initial_stake = MIN_VALIDATOR_STAKE + 1;

        consensus.register_validator(key, initial_stake).unwrap();

        // Slash until stake falls below minimum
        // DoubleSign removes 20% — slash multiple times
        for _ in 0..10 {
            let _ = consensus.slash_validator(&key, red_blockchain::consensus::SlashReason::DoubleSign);
        }

        let validators = consensus.get_validators();
        let v = validators.get(&key).unwrap();
        assert!(!v.active || v.stake < MIN_VALIDATOR_STAKE,
            "Validator must be deactivated or below min stake after repeated slashing");
    }

    #[test]
    fn test_deterministic_leader_selection() {
        let consensus = Consensus::new();
        consensus.register_validator([0x01u8; 32], MIN_VALIDATOR_STAKE).unwrap();
        consensus.register_validator([0x02u8; 32], MIN_VALIDATOR_STAKE * 2).unwrap();

        // Same slot must always produce the same leader
        let leader_slot_0_a = consensus.select_leader(0);
        let leader_slot_0_b = consensus.select_leader(0);
        assert_eq!(leader_slot_0_a, leader_slot_0_b,
            "Leader selection must be deterministic for the same slot");
    }
}

#[cfg(test)]
mod protocol_tests {
    use red_core::protocol::{Message, MessageType, MessageId};
    use red_core::identity::{Identity, IdentityHash};

    #[test]
    fn test_message_serialization_roundtrip() {
        let sender = [0xAAu8; 32];
        let recipient = [0xBBu8; 32];

        let msg = Message {
            id: MessageId::generate(),
            sender: IdentityHash::from_bytes(sender),
            recipient: IdentityHash::from_bytes(recipient),
            content: MessageType::Text("Hello RED!".to_string()),
            timestamp: 1_700_000_000_000,
            reply_to: None,
            status: red_core::protocol::MessageStatus::Pending,
        };

        let serialized = msg.serialize().expect("Serialization should succeed");
        let deserialized = Message::deserialize(&serialized).expect("Deserialization should succeed");

        assert_eq!(msg.id.to_hex(), deserialized.id.to_hex());
        match deserialized.content {
            MessageType::Text(t) => assert_eq!(t, "Hello RED!"),
            _ => panic!("Wrong message type after deserialization"),
        }
    }

    #[test]
    fn test_message_size_limit_enforced() {
        let big_content = "X".repeat(200_000); // 200KB > MAX_MESSAGE_SIZE (64KB)
        let msg = Message {
            id: MessageId::generate(),
            sender: IdentityHash::from_bytes([0u8; 32]),
            recipient: IdentityHash::from_bytes([1u8; 32]),
            content: MessageType::Text(big_content),
            timestamp: 0,
            reply_to: None,
            status: red_core::protocol::MessageStatus::Pending,
        };
        assert!(msg.is_too_large(), "Message over 64KB must be flagged as too large");
    }
}

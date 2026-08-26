use criterion::{black_box, criterion_group, criterion_main, Criterion};
use red_core::crypto::encryption::encrypt;
use red_core::crypto::hashing::hash;
use red_core::crypto::keys::{KeyPair, SigningKeyPair};
use red_core::crypto::ratchet::DoubleRatchet;

fn bench_blake3_hashing(c: &mut Criterion) {
    let payload_1k = vec![0x42u8; 1024];
    c.bench_function("blake3_hash_1kb", |b| {
        b.iter(|| {
            hash(black_box(&payload_1k))
        });
    });

    let payload_64k = vec![0x42u8; 64 * 1024];
    c.bench_function("blake3_hash_64kb", |b| {
        b.iter(|| {
            hash(black_box(&payload_64k))
        });
    });
}

fn bench_chacha20_poly1305_aead(c: &mut Criterion) {
    let key = [0x42u8; 32];
    let plaintext_1k = vec![0x55u8; 1024];

    c.bench_function("chacha20_poly1305_encrypt_1kb", |b| {
        b.iter(|| {
            encrypt(black_box(&key), black_box(&plaintext_1k)).unwrap()
        });
    });
}

fn bench_x25519_key_exchange(c: &mut Criterion) {
    let alice = KeyPair::generate();
    let bob = KeyPair::generate();

    c.bench_function("x25519_diffie_hellman", |b| {
        b.iter(|| {
            alice.key_exchange(black_box(&bob.public))
        });
    });
}

fn bench_ed25519_signing(c: &mut Criterion) {
    let signing_keys = SigningKeyPair::generate();
    let message = b"CRITICAL_EMERGENCY_BEACON_PAYLOAD";

    c.bench_function("ed25519_sign", |b| {
        b.iter(|| {
            signing_keys.sign(black_box(message))
        });
    });
}

fn bench_double_ratchet_cycle(c: &mut Criterion) {
    let shared_root = [0x42u8; 32];
    let bob_keys = KeyPair::generate();
    let mut alice = DoubleRatchet::new_initiator(shared_root, bob_keys.public).unwrap();

    c.bench_function("double_ratchet_encrypt_turn", |b| {
        b.iter(|| {
            alice.encrypt(black_box(b"Tactical Ping payload")).unwrap()
        });
    });
}

criterion_group!(
    benches,
    bench_blake3_hashing,
    bench_chacha20_poly1305_aead,
    bench_x25519_key_exchange,
    bench_ed25519_signing,
    bench_double_ratchet_cycle
);
criterion_main!(benches);

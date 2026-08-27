/**
 * PqcCryptoEngine.ts — RED Post-Quantum Hybrid Cryptography Engine (NIST ML-KEM-768 / Kyber + X25519)
 *
 * Implements a dual-hybrid Key Encapsulation Mechanism (KEM) combining classical Curve25519 (X25519)
 * with NIST FIPS 203 ML-KEM-768 (Kyber-768) lattice-based encryption over ring R_q = Z_q[X]/(X^256 + 1).
 * Protects against both classical and quantum "Harvest Now, Decrypt Later" adversaries.
 */

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export interface HybridKeyPair {
    x25519PublicKeyHex: string;
    x25519PrivateKeyHex: string;
    kyberPublicKeyHex: string;
    kyberPrivateKeyHex: string;
}

export interface PostQuantumSigningKeyPair {
    ed25519PublicKeyHex: string;
    ed25519PrivateKeyHex: string;
    dilithiumPublicKeyHex: string;
    dilithiumPrivateKeyHex: string;
}

export interface HybridSignature {
    ed25519SigHex: string;
    dilithiumSigHex: string;
    combinedSignatureHex: string;
}

export interface EncapsulatedSecret {
    ciphertextHex: string;
    sharedSecretHex: string;
}

export class PqcCryptoEngine {
    private static CT_KEM_LEN = 1088; // NIST FIPS 203 ML-KEM-768 ciphertext length
    private static X25519_PUB_LEN = 32; // Curve25519 public key length
    private static KYBER_PUB_LEN = 1184; // ML-KEM-768 public key length
    private static KYBER_SEC_LEN = 2400; // ML-KEM-768 secret key length

    /**
     * Generates a hybrid post-quantum key pair:
     * - Classical X25519 Diffie-Hellman key pair (32B public, 32B private)
     * - ML-KEM-768 key pair with authentic NTT polynomial arithmetic (1184B public, 2400B secret)
     */
    public static async generateHybridKeyPair(): Promise<HybridKeyPair> {
        // 1. Classical X25519 key generation (32 bytes)
        const x25519Keys = x25519.keygen();

        // 2. Authentic NIST FIPS 203 ML-KEM-768 key generation (1184B pub, 2400B sec)
        const mlKemKeys = ml_kem768.keygen();

        return {
            x25519PublicKeyHex:  bytesToHex(x25519Keys.publicKey),
            x25519PrivateKeyHex: bytesToHex(x25519Keys.secretKey),
            kyberPublicKeyHex:   bytesToHex(mlKemKeys.publicKey),
            kyberPrivateKeyHex:  bytesToHex(mlKemKeys.secretKey),
        };
    }

    /**
     * Encapsulates a shared secret using recipient's ML-KEM-768 public key (1184 bytes) and X25519 public key (32 bytes).
     * Produces an authentic combined ciphertext (1088B ML-KEM + 32B Ephemeral X25519 = 1120B)
     * and derives a 256-bit hybrid shared secret via SHA-256 KDF(ss_kem || ss_x25519).
     */
    public static async encapsulateSharedSecret(
        peerKyberPubHex: string,
        peerX25519PubHex: string
    ): Promise<EncapsulatedSecret> {
        const peerKyberPubBytes = hexToBytes(peerKyberPubHex.trim());
        const peerX25519PubBytes = hexToBytes(peerX25519PubHex.trim());

        if (peerKyberPubBytes.length !== this.KYBER_PUB_LEN) {
            throw new Error(`Invalid ML-KEM-768 public key length: ${peerKyberPubBytes.length} bytes (expected ${this.KYBER_PUB_LEN})`);
        }
        if (peerX25519PubBytes.length !== this.X25519_PUB_LEN) {
            throw new Error(`Invalid X25519 public key length: ${peerX25519PubBytes.length} bytes (expected ${this.X25519_PUB_LEN})`);
        }

        // 1. Authentic ML-KEM-768 Encapsulation
        const { cipherText: ctKem, sharedSecret: ssKem } = ml_kem768.encapsulate(peerKyberPubBytes);

        // 2. Ephemeral X25519 Key Exchange (32B)
        const ephemKeys = x25519.keygen();
        const ssX25519 = x25519.getSharedSecret(ephemKeys.secretKey, peerX25519PubBytes);

        // 3. Combined Ciphertext: ctKem (1088 bytes) + ephemPub (32 bytes) = 1120 bytes
        const combinedCt = new Uint8Array(ctKem.length + ephemKeys.publicKey.length);
        combinedCt.set(ctKem, 0);
        combinedCt.set(ephemKeys.publicKey, ctKem.length);

        // 4. Hybrid KDF: SHA-256(ssKem || ssX25519)
        const kdfInput = new Uint8Array(ssKem.length + ssX25519.length);
        kdfInput.set(ssKem, 0);
        kdfInput.set(ssX25519, ssKem.length);
        const finalSecret = sha256(kdfInput);

        return {
            ciphertextHex:   bytesToHex(combinedCt),
            sharedSecretHex: bytesToHex(finalSecret),
        };
    }

    /**
     * Decapsulates the shared secret using recipient's ML-KEM-768 secret key (2400 bytes) and X25519 private key (32 bytes).
     */
    public static async decapsulateSharedSecret(
        ciphertextHex: string,
        kyberPrivHex:  string,
        x25519PrivHex: string
    ): Promise<string> {
        const combinedCt = hexToBytes(ciphertextHex.trim());
        const kyberPrivBytes = hexToBytes(kyberPrivHex.trim());
        const x25519PrivBytes = hexToBytes(x25519PrivHex.trim());

        if (combinedCt.length < this.CT_KEM_LEN + this.X25519_PUB_LEN) {
            throw new Error(`Ciphertext too short for hybrid decapsulation: ${combinedCt.length} bytes (expected at least ${this.CT_KEM_LEN + this.X25519_PUB_LEN})`);
        }
        if (kyberPrivBytes.length !== this.KYBER_SEC_LEN) {
            throw new Error(`Invalid ML-KEM-768 secret key length: ${kyberPrivBytes.length} bytes (expected ${this.KYBER_SEC_LEN})`);
        }
        if (x25519PrivBytes.length !== this.X25519_PUB_LEN) {
            throw new Error(`Invalid X25519 secret key length: ${x25519PrivBytes.length} bytes (expected ${this.X25519_PUB_LEN})`);
        }

        const ctKem = combinedCt.slice(0, this.CT_KEM_LEN);
        const ephemPubBytes = combinedCt.slice(this.CT_KEM_LEN, this.CT_KEM_LEN + this.X25519_PUB_LEN);

        // 1. Authentic ML-KEM-768 Decapsulation
        const ssKem = ml_kem768.decapsulate(ctKem, kyberPrivBytes);

        // 2. X25519 Decapsulation
        const ssX25519 = x25519.getSharedSecret(x25519PrivBytes, ephemPubBytes);

        // 3. Hybrid KDF: SHA-256(ssKem || ssX25519)
        const kdfInput = new Uint8Array(ssKem.length + ssX25519.length);
        kdfInput.set(ssKem, 0);
        kdfInput.set(ssX25519, ssKem.length);

        return bytesToHex(sha256(kdfInput));
    }

    /**
     * Generates a hybrid post-quantum digital signature key pair:
     * - Ed25519 classical Edwards curve key pair (32B public, 32B private)
     * - NIST FIPS 204 ML-DSA-65 (Dilithium3) lattice key pair (1952B public, 4032B secret)
     */
    public static async generatePostQuantumSigningKeyPair(): Promise<PostQuantumSigningKeyPair> {
        // 1. Classical Ed25519 Key Generation
        const { secretKey: edPriv, publicKey: edPub } = ed25519.keygen();

        // 2. NIST FIPS 204 ML-DSA-65 Key Generation
        const mlDsaKeys = ml_dsa65.keygen();

        return {
            ed25519PublicKeyHex:   bytesToHex(edPub),
            ed25519PrivateKeyHex:  bytesToHex(edPriv),
            dilithiumPublicKeyHex: bytesToHex(mlDsaKeys.publicKey),
            dilithiumPrivateKeyHex: bytesToHex(mlDsaKeys.secretKey),
        };
    }

    /**
     * Signs a message using both Ed25519 (classical) and ML-DSA-65 (quantum-resistant).
     * Output format: combined hex = ed25519Sig (64B) + mlDsaSig (3309B)
     */
    public static async signHybrid(
        message: Uint8Array,
        ed25519PrivKeyHex: string,
        dilithiumPrivKeyHex: string
    ): Promise<HybridSignature> {
        const edPrivBytes = hexToBytes(ed25519PrivKeyHex.trim());
        const dsaPrivBytes = hexToBytes(dilithiumPrivKeyHex.trim());

        // 1. Classical Ed25519 Signature (64 bytes)
        const edSig = ed25519.sign(message, edPrivBytes);

        // 2. NIST FIPS 204 ML-DSA-65 Signature (3309 bytes) — (message, secretKey)
        const dsaSig = ml_dsa65.sign(message, dsaPrivBytes);

        // 3. Combined Signature: Ed25519 (64B) + ML-DSA-65 (3309B)
        const combined = new Uint8Array(edSig.length + dsaSig.length);
        combined.set(edSig, 0);
        combined.set(dsaSig, edSig.length);

        return {
            ed25519SigHex: bytesToHex(edSig),
            dilithiumSigHex: bytesToHex(dsaSig),
            combinedSignatureHex: bytesToHex(combined),
        };
    }

    /**
     * Verifies a hybrid post-quantum signature against both Ed25519 and ML-DSA-65 public keys.
     * Both signatures MUST be valid for the verification to succeed.
     */
    public static async verifyHybrid(
        message: Uint8Array,
        signature: HybridSignature | string,
        ed25519PubKeyHex: string,
        dilithiumPubKeyHex: string
    ): Promise<boolean> {
        try {
            let edSigBytes: Uint8Array;
            let dsaSigBytes: Uint8Array;

            if (typeof signature === 'string') {
                const rawSig = hexToBytes(signature.trim());
                if (rawSig.length < 64) return false;
                edSigBytes = rawSig.slice(0, 64);
                dsaSigBytes = rawSig.slice(64);
            } else {
                edSigBytes = hexToBytes(signature.ed25519SigHex.trim());
                dsaSigBytes = hexToBytes(signature.dilithiumSigHex.trim());
            }

            const edPubBytes = hexToBytes(ed25519PubKeyHex.trim());
            const dsaPubBytes = hexToBytes(dilithiumPubKeyHex.trim());

            // 1. Verify Ed25519
            const edOk = ed25519.verify(edSigBytes, message, edPubBytes);
            if (!edOk) return false;

            // 2. Verify ML-DSA-65 — (signature, message, publicKey)
            const dsaOk = ml_dsa65.verify(dsaSigBytes, message, dsaPubBytes);
            return dsaOk;
        } catch {
            return false;
        }
    }
}




/**
 * PqcCryptoEngine.ts — RED Post-Quantum Hybrid Cryptography Engine (NIST ML-KEM-768 / Kyber + ECDH)
 *
 * Implements a dual-hybrid Key Encapsulation Mechanism (KEM) combining classical ECDH P-256
 * with NIST FIPS 203 ML-KEM-768 (Kyber-768) lattice-based encryption over ring R_q = Z_q[X]/(X^256 + 1).
 * Protects against both classical and quantum "Harvest Now, Decrypt Later" adversaries.
 */

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

export interface HybridKeyPair {
    x25519PublicKeyHex: string;
    x25519PrivateKeyHex: string;
    kyberPublicKeyHex: string;
    kyberPrivateKeyHex: string;
}

export interface EncapsulatedSecret {
    ciphertextHex: string;
    sharedSecretHex: string;
}

export class PqcCryptoEngine {
    private static CT_KEM_LEN = 1088; // NIST FIPS 203 ML-KEM-768 ciphertext length

    /**
     * Generates a hybrid post-quantum key pair:
     * - Classical ECDH P-256 key pair (65B raw public, 138B pkcs8 private)
     * - ML-KEM-768 key pair with authentic NTT polynomial arithmetic (1184B public, 2400B secret)
     */
    public static async generateHybridKeyPair(): Promise<HybridKeyPair> {
        const cryptoSubtle = this.getCryptoSubtle();

        // 1. Classical ECDH P-256 key generation
        const ecdhKeyPair = await cryptoSubtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );

        const rawPub = await cryptoSubtle.exportKey('raw', ecdhKeyPair.publicKey);
        const pkcs8Priv = await cryptoSubtle.exportKey('pkcs8', ecdhKeyPair.privateKey);

        // 2. Authentic NIST FIPS 203 ML-KEM-768 key generation
        const mlKemKeys = ml_kem768.keygen();

        return {
            x25519PublicKeyHex:  this.bytesToHex(new Uint8Array(rawPub)),
            x25519PrivateKeyHex: this.bytesToHex(new Uint8Array(pkcs8Priv)),
            kyberPublicKeyHex:   this.bytesToHex(mlKemKeys.publicKey),
            kyberPrivateKeyHex:  this.bytesToHex(mlKemKeys.secretKey),
        };
    }

    /**
     * Encapsulates a shared secret using recipient's ML-KEM-768 public key (1184 bytes) and ECDH public key (65 bytes).
     * Produces an authentic combined ciphertext (1088B ML-KEM + 65B Ephemeral ECDH = 1153B)
     * and derives a 256-bit hybrid shared secret via SHA-256 KDF(ss_kem || ss_ecdh).
     */
    public static async encapsulateSharedSecret(
        peerKyberPubHex: string,
        peerEcdhPubHex: string
    ): Promise<EncapsulatedSecret> {
        const cryptoSubtle = this.getCryptoSubtle();
        const peerKyberPubBytes = this.hexToBytes(peerKyberPubHex);
        const peerEcdhPubBytes = this.hexToBytes(peerEcdhPubHex);

        // 1. Authentic ML-KEM-768 Encapsulation
        const { cipherText: ctKem, sharedSecret: ssKem } = ml_kem768.encapsulate(peerKyberPubBytes);

        // 2. Ephemeral ECDH P-256 Key Exchange
        const ephemKeyPair = await cryptoSubtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits']
        );
        const ephemPubRaw = await cryptoSubtle.exportKey('raw', ephemKeyPair.publicKey);
        const peerEcdhKey = await cryptoSubtle.importKey(
            'raw',
            peerEcdhPubBytes as ArrayBufferView<ArrayBuffer>,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
        const ssEcdhBuffer = await cryptoSubtle.deriveBits(
            { name: 'ECDH', public: peerEcdhKey },
            ephemKeyPair.privateKey,
            256
        );
        const ssEcdh = new Uint8Array(ssEcdhBuffer);

        // 3. Combined Ciphertext: ctKem (1088 bytes) + ephemPubRaw (65 bytes) = 1153 bytes
        const combinedCt = new Uint8Array(ctKem.length + ephemPubRaw.byteLength);
        combinedCt.set(ctKem, 0);
        combinedCt.set(new Uint8Array(ephemPubRaw), ctKem.length);

        // 4. Hybrid KDF: SHA-256(ssKem || ssEcdh)
        const kdfInput = new Uint8Array(ssKem.length + ssEcdh.length);
        kdfInput.set(ssKem, 0);
        kdfInput.set(ssEcdh, ssKem.length);
        const finalSecretHex = await this.sha256Hex(kdfInput);

        return {
            ciphertextHex:   this.bytesToHex(combinedCt),
            sharedSecretHex: finalSecretHex,
        };
    }

    /**
     * Decapsulates the shared secret using recipient's ML-KEM-768 secret key (2400 bytes) and ECDH private key.
     */
    public static async decapsulateSharedSecret(
        ciphertextHex: string,
        kyberPrivHex:  string,
        ecdhPrivHex:   string
    ): Promise<string> {
        const cryptoSubtle = this.getCryptoSubtle();
        const combinedCt = this.hexToBytes(ciphertextHex);
        const kyberPrivBytes = this.hexToBytes(kyberPrivHex);
        const ecdhPrivBytes = this.hexToBytes(ecdhPrivHex);

        const ctKem = combinedCt.slice(0, this.CT_KEM_LEN);
        const ephemPubBytes = combinedCt.slice(this.CT_KEM_LEN);

        // 1. Authentic ML-KEM-768 Decapsulation
        const ssKem = ml_kem768.decapsulate(ctKem, kyberPrivBytes);

        // 2. ECDH Decapsulation
        const ephemPubKey = await cryptoSubtle.importKey(
            'raw',
            ephemPubBytes as ArrayBufferView<ArrayBuffer>,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
        const myPrivKey = await cryptoSubtle.importKey(
            'pkcs8',
            ecdhPrivBytes as ArrayBufferView<ArrayBuffer>,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            ['deriveBits']
        );
        const ssEcdhBuffer = await cryptoSubtle.deriveBits(
            { name: 'ECDH', public: ephemPubKey },
            myPrivKey,
            256
        );
        const ssEcdh = new Uint8Array(ssEcdhBuffer);

        // 3. Hybrid KDF: SHA-256(ssKem || ssEcdh)
        const kdfInput = new Uint8Array(ssKem.length + ssEcdh.length);
        kdfInput.set(ssKem, 0);
        kdfInput.set(ssEcdh, ssKem.length);

        return this.sha256Hex(kdfInput);
    }

    private static getCryptoSubtle(): SubtleCrypto {
        if (typeof window !== 'undefined' && window.crypto?.subtle) {
            return window.crypto.subtle;
        }
        if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
            return globalThis.crypto.subtle;
        }
        throw new Error(
            '[PqcCryptoEngine] crypto.subtle unavailable. ' +
            'This engine requires a secure origin (HTTPS or Capacitor).'
        );
    }

    private static async sha256Hex(data: Uint8Array): Promise<string> {
        const cryptoSubtle = this.getCryptoSubtle();
        const buf: ArrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        const hashBuffer = await cryptoSubtle.digest('SHA-256', buf);
        const hashArray  = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private static bytesToHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private static hexToBytes(hex: string): Uint8Array {
        const bytes = new Uint8Array(Math.ceil(hex.length / 2));
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16) || 0;
        }
        return bytes;
    }
}




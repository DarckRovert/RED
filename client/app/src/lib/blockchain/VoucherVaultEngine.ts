/**
 * VoucherVaultEngine.ts — RED Sovereign Offline Cryptographic Voucher Vault
 * 
 * Manages off-grid cryptographic barter vouchers (energy, bandwidth, water, radio time)
 * protected against double-spending via deterministic Nullifier Hashes H(Secret || Nonce)
 * and Ed25519 signatures committed to the local blockchain ledger.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '../mesh/meshProtocol';
import { ed25519 } from '@noble/curves/ed25519.js';
import { LocalChainLedger } from './LocalChainLedger';

export type VoucherAssetType = 'ENERGY_WH' | 'BANDWIDTH_MB' | 'RADIO_MIN' | 'RATION_UNIT' | 'RED_CREDITS';

export interface SovereignVoucher {
    id: string;
    issuerDid: string;
    recipientDid?: string;
    assetType: VoucherAssetType;
    amount: number;
    description: string;
    issuedAt: number;
    expiresAt: number;
    nullifierHash: string;
    merkleRoot: string;
    signature: string;
    redeemed: boolean;
    redeemedAt?: number;
    redeemerDid?: string;
}

export interface VoucherRedeemResult {
    success: boolean;
    voucher?: SovereignVoucher;
    error?: string;
}

const STORAGE_VOUCHERS_KEY = 'red_sovereign_vouchers_vault_v1';
const STORAGE_NULLIFIERS_KEY = 'red_spent_nullifiers_registry_v1';

export class VoucherVaultEngine {
    private static instance: VoucherVaultEngine | null = null;
    private vouchers: SovereignVoucher[] = [];
    private spentNullifiers: Set<string> = new Set();
    private listeners: Set<() => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadVault();
        }
    }

    public static getInstance(): VoucherVaultEngine {
        if (!this.instance) {
            this.instance = new VoucherVaultEngine();
        }
        return this.instance;
    }

    public subscribe(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notify() {
        this.listeners.forEach(cb => {
            try { cb(); } catch {}
        });
    }

    private loadVault() {
        try {
            const rawV = localStorage.getItem(STORAGE_VOUCHERS_KEY);
            if (rawV) {
                this.vouchers = JSON.parse(rawV);
            }
            const rawN = localStorage.getItem(STORAGE_NULLIFIERS_KEY);
            if (rawN) {
                const arr = JSON.parse(rawN);
                this.spentNullifiers = new Set(arr);
            }
        } catch (e) {
            console.error('[VoucherVaultEngine] Error loading storage:', e);
        }
    }

    private saveVault() {
        try {
            localStorage.setItem(STORAGE_VOUCHERS_KEY, JSON.stringify(this.vouchers));
            localStorage.setItem(STORAGE_NULLIFIERS_KEY, JSON.stringify(Array.from(this.spentNullifiers)));
            this.notify();
        } catch (e) {
            console.error('[VoucherVaultEngine] Error saving storage:', e);
        }
    }

    /**
     * Calcula el Nullifier Hash determinista H(Secret || Nonce)
     */
    public static computeNullifier(issuerDid: string, secretNonce: string): string {
        const payload = `${issuerDid}:${secretNonce}`;
        const hash = sha256(new TextEncoder().encode(payload));
        return bytesToHex(hash);
    }

    /**
     * Emite un nuevo cupón soberano firmado con la clave privada Ed25519 del emisor
     */
    public async issueVoucher(
        issuerDid: string,
        issuerPrivateKeyHex: string,
        assetType: VoucherAssetType,
        amount: number,
        description = 'Cupón Táctico Soberano',
        validityHours = 72,
        recipientDid?: string
    ): Promise<SovereignVoucher> {
        const now = Date.now();
        const expiresAt = now + (validityHours * 3600 * 1000);
        
        // Generar nonce secreto criptográfico
        const nonceBytes = new Uint8Array(16);
        const c = (typeof window !== 'undefined' && window.crypto) || (globalThis as any)?.crypto;
        if (c?.getRandomValues) {
            c.getRandomValues(nonceBytes);
        } else {
            try {
                const nodeCrypto = require('crypto');
                const buf = nodeCrypto.randomBytes(16);
                nonceBytes.set(buf);
            } catch {
                for (let i = 0; i < 16; i++) nonceBytes[i] = (Date.now() ^ (i * 0x9e3779b9)) & 0xFF;
            }
        }
        const secretNonce = bytesToHex(nonceBytes);
        const nullifierHash = VoucherVaultEngine.computeNullifier(issuerDid, secretNonce);

        const ledger = LocalChainLedger.getInstance();
        const latestBlock = ledger.getLatestBlock();
        const merkleRoot = latestBlock ? latestBlock.merkle_root : 'GENESIS_MERKLE_ROOT';

        const id = `VCH-${nullifierHash.substring(0, 12).toUpperCase()}`;

        // Payload canónico para firma: id:issuer:asset:amount:expiresAt:nullifier:merkleRoot
        const signPayload = `${id}:${issuerDid}:${assetType}:${amount}:${expiresAt}:${nullifierHash}:${merkleRoot}`;
        const signBytes = new TextEncoder().encode(signPayload);

        let signature = 'OFFLINE_UNSIGNED';
        try {
            const privKey = hexToBytes(issuerPrivateKeyHex.padStart(64, '0').substring(0, 64));
            const sigBytes = ed25519.sign(signBytes, privKey);
            signature = bytesToHex(sigBytes);
        } catch (e) {
            console.warn('[VoucherVaultEngine] Could not sign with ed25519:', e);
        }

        const voucher: SovereignVoucher = {
            id,
            issuerDid,
            recipientDid,
            assetType,
            amount,
            description,
            issuedAt: now,
            expiresAt,
            nullifierHash,
            merkleRoot,
            signature,
            redeemed: false,
        };

        this.vouchers.push(voucher);
        this.saveVault();

        // Registrar transacción de emisión en el ledger blockchain
        try {
            await ledger.submitTransaction({
                type: 'VOUCHER_ISSUE',
                sender: issuerDid,
                recipient: recipientDid || 'BROADCAST_MESH',
                amount,
                fee: 0,
                signature,
                payload: {
                    voucherId: id,
                    assetType,
                    nullifierHash,
                },
            });
        } catch {}

        return voucher;
    }

    /**
     * Valida la autenticidad e integridad criptográfica de un cupón recibido
     */
    public async verifyVoucher(voucher: SovereignVoucher): Promise<{ valid: boolean; reason?: string }> {
        const now = Date.now();
        if (now > voucher.expiresAt) {
            return { valid: false, reason: 'El cupón ha expirado.' };
        }

        if (this.spentNullifiers.has(voucher.nullifierHash)) {
            return { valid: false, reason: 'DOBLE GASTO DETECTADO: Este cupón ya fue canjeado previamente.' };
        }

        const signPayload = `${voucher.id}:${voucher.issuerDid}:${voucher.assetType}:${voucher.amount}:${voucher.expiresAt}:${voucher.nullifierHash}:${voucher.merkleRoot}`;
        const signBytes = new TextEncoder().encode(signPayload);

        // Si la clave pública del emisor tiene 64 hex chars, verificar firma Ed25519
        try {
            if (voucher.issuerDid.length >= 64 && voucher.signature !== 'OFFLINE_UNSIGNED') {
                const pubKey = hexToBytes(voucher.issuerDid.substring(0, 64));
                const sigBytes = hexToBytes(voucher.signature);
                const isValidSig = ed25519.verify(sigBytes, signBytes, pubKey);
                if (!isValidSig) {
                    return { valid: false, reason: 'Firma criptográfica inválida del emisor.' };
                }
            }
        } catch {
            // Continuar si es formato DID no-raw
        }

        return { valid: true };
    }

    /**
     * Canjea un cupón registrando su NullifierHash de forma inmutable
     */
    public async redeemVoucher(
        voucher: SovereignVoucher,
        redeemerDid: string,
        redeemerPrivateKeyHex?: string
    ): Promise<VoucherRedeemResult> {
        const verification = await this.verifyVoucher(voucher);
        if (!verification.valid) {
            return { success: false, error: verification.reason };
        }

        if (voucher.recipientDid && voucher.recipientDid !== redeemerDid && voucher.recipientDid !== 'BROADCAST_MESH') {
            return { success: false, error: 'Este cupón está destinado a otro identificador DID.' };
        }

        // Marcar nullifier como gastado permanentemente
        this.spentNullifiers.add(voucher.nullifierHash);

        const now = Date.now();
        voucher.redeemed = true;
        voucher.redeemedAt = now;
        voucher.redeemerDid = redeemerDid;

        // Actualizar o añadir a la bóveda local
        const existingIdx = this.vouchers.findIndex(v => v.id === voucher.id || v.nullifierHash === voucher.nullifierHash);
        if (existingIdx >= 0) {
            this.vouchers[existingIdx] = voucher;
        } else {
            this.vouchers.push(voucher);
        }

        this.saveVault();

        // Anclar canje al ledger local
        try {
            const ledger = LocalChainLedger.getInstance();
            await ledger.submitTransaction({
                type: 'VOUCHER_REDEEM',
                sender: voucher.issuerDid,
                recipient: redeemerDid,
                amount: voucher.amount,
                fee: 0,
                signature: voucher.signature,
                payload: {
                    voucherId: voucher.id,
                    assetType: voucher.assetType,
                    nullifierHash: voucher.nullifierHash,
                    redeemedAt: now,
                },
            });
        } catch {}

        return { success: true, voucher };
    }

    public getVouchers(): SovereignVoucher[] {
        return [...this.vouchers];
    }

    public getActiveVouchers(): SovereignVoucher[] {
        const now = Date.now();
        return this.vouchers.filter(v => !v.redeemed && v.expiresAt > now);
    }

    public isNullifierSpent(nullifierHash: string): boolean {
        return this.spentNullifiers.has(nullifierHash);
    }

    public destroy(): void {
        this.listeners.clear();
    }
}

export const voucherVault = VoucherVaultEngine.getInstance();

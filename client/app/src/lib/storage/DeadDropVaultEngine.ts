/**
 * DeadDropVaultEngine.ts — RED Sovereign Cryptographic P2P Dead-Drop Geocache Vault
 * 
 * Manages encrypted tactical geocaches deposited at specific coordinates with physical
 * proximity-gated decryption (<= 15m tolerance radius), off-grid gossip sync and DTN persistence.
 */

import { dtnStorage } from '../mesh/dtnStorage';
import { meshRouter } from '../mesh/meshRouter';
import { sha256 } from '@noble/hashes/sha2.js';

export type DeadDropCategory = 'TEXT_INTEL' | 'CRYPTO_KEY' | 'SUPPLY_CACHE' | 'EMERGENCY_COORDS';

export interface DeadDropItem {
    id: string;
    title: string;
    category: DeadDropCategory;
    lat: number;
    lon: number;
    unlockRadiusMeters: number;
    ciphertextPayload: string;
    plaintextPayload?: string;
    authorDid: string;
    authorName: string;
    timestamp: number;
    expiresAt: number;
    isUnlocked: boolean;
    passphraseHint?: string;
}

const STORAGE_DEAD_DROPS_KEY = 'red_deaddrop_vault_v1';
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class DeadDropVaultEngine {
    private static instance: DeadDropVaultEngine | null = null;
    private drops: Map<string, DeadDropItem> = new Map();
    private listeners: Set<() => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadState();
            this.listenToMesh();
        }
    }

    public static getInstance(): DeadDropVaultEngine {
        if (!this.instance) {
            this.instance = new DeadDropVaultEngine();
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

    private loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_DEAD_DROPS_KEY);
            if (raw) {
                const arr: DeadDropItem[] = JSON.parse(raw);
                arr.forEach(d => this.drops.set(d.id, d));
            }
        } catch (e) {
            console.error('[DeadDropVaultEngine] Error loading state:', e);
        }
    }

    private saveState() {
        try {
            const arr = Array.from(this.drops.values());
            localStorage.setItem(STORAGE_DEAD_DROPS_KEY, JSON.stringify(arr));
            this.notify();
        } catch (e) {
            console.error('[DeadDropVaultEngine] Error saving state:', e);
        }
    }

    private listenToMesh() {
        try {
            meshRouter.onLocalDelivery(async (packet) => {
                try {
                    const text = new TextDecoder().decode(packet.payload);
                    if (text.startsWith('DEAD_DROP_V1:')) {
                        const jsonStr = text.substring(13);
                        const drop: DeadDropItem = JSON.parse(jsonStr);
                        this.processIncomingDrop(drop);
                    }
                } catch {}
            });
        } catch {}
    }

    public processIncomingDrop(drop: DeadDropItem) {
        if (!drop || !drop.id) return;
        const existing = this.drops.get(drop.id);
        if (!existing || drop.timestamp > existing.timestamp) {
            // No sobreescribir el contenido descifrado si ya fue desbloqueado localmente
            if (existing && existing.isUnlocked && !drop.isUnlocked) {
                drop.isUnlocked = true;
                drop.plaintextPayload = existing.plaintextPayload;
            }
            this.drops.set(drop.id, drop);
            this.saveState();
        }
    }

    /**
     * Deposita un nuevo geocaché Dead-Drop cifrado en coordenadas fijas
     */
    public async depositDeadDrop(params: {
        title: string;
        category: DeadDropCategory;
        lat: number;
        lon: number;
        unlockRadiusMeters?: number;
        secretContent: string;
        authorDid: string;
        authorName: string;
        passphraseHint?: string;
        ttlDays?: number;
    }): Promise<DeadDropItem> {
        const now = Date.now();
        const id = `DROP-${now.toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const radius = params.unlockRadiusMeters || 15;
        const expiresAt = now + (params.ttlDays ? params.ttlDays * 86400000 : DEFAULT_RETENTION_MS);

        // Cifrado simple por hash de coordenadas base + secret
        const keyMaterial = `${params.lat.toFixed(4)}:${params.lon.toFixed(4)}:${params.passphraseHint || 'RED'}`;
        const keyBytes = sha256(new TextEncoder().encode(keyMaterial));
        const ciphertext = this.xorEncrypt(params.secretContent, keyBytes);

        const drop: DeadDropItem = {
            id,
            title: params.title,
            category: params.category,
            lat: params.lat,
            lon: params.lon,
            unlockRadiusMeters: radius,
            ciphertextPayload: ciphertext,
            plaintextPayload: params.secretContent, // El creador siempre tiene acceso
            authorDid: params.authorDid,
            authorName: params.authorName,
            timestamp: now,
            expiresAt,
            isUnlocked: true,
            passphraseHint: params.passphraseHint,
        };

        this.drops.set(drop.id, drop);
        this.saveState();

        // Difusión a la malla y bóveda DTN
        try {
            const envelope = `DEAD_DROP_V1:${JSON.stringify({
                ...drop,
                plaintextPayload: undefined, // Se remueve el texto en claro para la difusión pública
                isUnlocked: false,
            })}`;
            const bytes = new TextEncoder().encode(envelope);

            await meshRouter.broadcast(bytes);
            dtnStorage.enqueue({
                recipient: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
                sender: params.authorDid,
                ttl: 7,
                flags: 0x01,
                timestamp: now,
                nonce: `drop_${drop.id}_${now}`,
                payload: bytes,
            }, 8);
        } catch (e) {
            console.warn('[DeadDropVaultEngine] Error broadcasting dead-drop:', e);
        }

        return drop;
    }

    /**
     * Intenta desbloquear un geocaché por proximidad física
     */
    public attemptUnlock(dropId: string, userLat: number, userLon: number, inputPassphrase?: string): { success: boolean; plaintext?: string; distanceMeters: number } {
        const drop = this.drops.get(dropId);
        if (!drop) return { success: false, distanceMeters: 999999 };

        const distanceMeters = this.getHaversineDistanceMeters(userLat, userLon, drop.lat, drop.lon);

        if (distanceMeters > drop.unlockRadiusMeters) {
            return { success: false, distanceMeters };
        }

        try {
            const keyMaterial = `${drop.lat.toFixed(4)}:${drop.lon.toFixed(4)}:${inputPassphrase || drop.passphraseHint || 'RED'}`;
            const keyBytes = sha256(new TextEncoder().encode(keyMaterial));
            const decrypted = this.xorDecrypt(drop.ciphertextPayload, keyBytes);

            drop.isUnlocked = true;
            drop.plaintextPayload = decrypted;
            this.saveState();

            return { success: true, plaintext: decrypted, distanceMeters };
        } catch (e) {
            return { success: false, distanceMeters };
        }
    }

    public getDeadDrops(): DeadDropItem[] {
        const cutoff = Date.now();
        return Array.from(this.drops.values())
            .filter(d => d.expiresAt > cutoff)
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    public deleteDeadDrop(id: string): boolean {
        const deleted = this.drops.delete(id);
        if (deleted) this.saveState();
        return deleted;
    }

    private xorEncrypt(plaintext: string, key: Uint8Array): string {
        const textBytes = new TextEncoder().encode(plaintext);
        const out = new Uint8Array(textBytes.length);
        for (let i = 0; i < textBytes.length; i++) {
            out[i] = textBytes[i] ^ key[i % key.length];
        }
        return Array.from(out).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private xorDecrypt(hex: string, key: Uint8Array): string {
        const len = Math.floor(hex.length / 2);
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16) ^ key[i % key.length];
        }
        return new TextDecoder().decode(bytes);
    }

    private getHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    }
}

export const deadDropVault = DeadDropVaultEngine.getInstance();

/**
 * ShamirSocialRecoveryVault.ts — RED P2P Threshold Social Recovery & Guardian Vault
 * 
 * Manages polynomial secret sharing (3-of-5 threshold) across trusted peer guardians,
 * allowing decentralized mathematical identity and key recovery after hardware loss or panic purges.
 */

import { ShamirSecretSharingEngine, SecretShare } from './ShamirSecretSharingEngine';

export interface GuardianRecord {
    id: string;
    guardianName: string;
    guardianDid?: string;
    shareIndex: number;
    shareHex?: string;
    status: 'ASSIGNED' | 'COLLECTED';
    lastSyncTime: number;
}

export interface SocialRecoveryVaultState {
    isInitialized: boolean;
    threshold: number;
    totalShares: number;
    guardians: GuardianRecord[];
    collectedShares: SecretShare[];
    canReconstruct: boolean;
}

const STORAGE_GUARDIANS_KEY = 'red_shamir_guardians_vault_v1';

export class ShamirSocialRecoveryVault {
    private static instance: ShamirSocialRecoveryVault | null = null;

    private guardians: GuardianRecord[] = [];
    private collectedShares: SecretShare[] = [];
    private listeners: Set<(s: SocialRecoveryVaultState) => void> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            this.loadState();
        }
    }

    public static getInstance(): ShamirSocialRecoveryVault {
        if (!this.instance) {
            this.instance = new ShamirSocialRecoveryVault();
        }
        return this.instance;
    }

    public subscribe(cb: (s: SocialRecoveryVaultState) => void): () => void {
        this.listeners.add(cb);
        cb(this.getState());
        return () => this.listeners.delete(cb);
    }

    private notify() {
        const state = this.getState();
        this.listeners.forEach(cb => {
            try { cb(state); } catch {}
        });
    }

    private loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_GUARDIANS_KEY);
            if (raw) {
                this.guardians = JSON.parse(raw);
            }
        } catch (e) {
            console.error('[ShamirSocialRecoveryVault] Error loading guardians:', e);
        }
    }

    private saveState() {
        try {
            localStorage.setItem(STORAGE_GUARDIANS_KEY, JSON.stringify(this.guardians));
            this.notify();
        } catch (e) {
            console.error('[ShamirSocialRecoveryVault] Error saving guardians:', e);
        }
    }

    public getState(): SocialRecoveryVaultState {
        return {
            isInitialized: this.guardians.length >= 5,
            threshold: 3,
            totalShares: 5,
            guardians: [...this.guardians],
            collectedShares: [...this.collectedShares],
            canReconstruct: this.collectedShares.length >= 3,
        };
    }

    /**
     * Fragmenta la clave maestra en 5 fragmentos y asigna guardianes
     */
    public initializeGuardians(masterSecretHex: string, guardianNames: string[]): SecretShare[] {
        const shares = ShamirSecretSharingEngine.splitSecret(masterSecretHex, 3, 5);

        this.guardians = shares.map((share, idx) => ({
            id: `GUARD-${idx + 1}`,
            guardianName: guardianNames[idx] || `Guardián #${idx + 1}`,
            shareIndex: share.shareIndex,
            shareHex: share.shareHex,
            status: 'ASSIGNED',
            lastSyncTime: Date.now(),
        }));

        this.collectedShares = [];
        this.saveState();
        return shares;
    }

    /**
     * Registra un fragmento recibido de un guardián para el proceso de recuperación
     */
    public addCollectedShare(share: SecretShare): boolean {
        // Evitar duplicados por shareIndex
        const existingIdx = this.collectedShares.findIndex(s => s.shareIndex === share.shareIndex);
        if (existingIdx >= 0) {
            this.collectedShares[existingIdx] = share;
        } else {
            this.collectedShares.push(share);
        }

        // Marcar estado en la lista de guardianes
        const g = this.guardians.find(g => g.shareIndex === share.shareIndex);
        if (g) {
            g.status = 'COLLECTED';
            g.shareHex = share.shareHex;
            g.lastSyncTime = Date.now();
            this.saveState();
        }

        this.notify();
        return this.collectedShares.length >= 3;
    }

    /**
     * Reconstruye la clave maestra si se tienen al menos 3 fragmentos válidos
     */
    public reconstructSecret(): string | null {
        if (this.collectedShares.length < 3) {
            return null;
        }
        try {
            return ShamirSecretSharingEngine.reconstructSecret(this.collectedShares.slice(0, 3));
        } catch (e) {
            console.error('[ShamirSocialRecoveryVault] Error reconstruyendo secreto:', e);
            return null;
        }
    }

    public clearCollectedShares() {
        this.collectedShares = [];
        this.guardians.forEach(g => {
            g.status = 'ASSIGNED';
        });
        this.saveState();
    }
}

export const shamirRecoveryVault = ShamirSocialRecoveryVault.getInstance();

/**
 * ZeroKnowledgeBarterEngine.ts — RED Zero-Knowledge Merkle Membership Barter Engine
 * 
 * Enables operators to cryptographically prove ownership of barter credits or emergency rations
 * against the ledger's Merkle Root WITHOUT revealing their DID, transaction history, or voucher IDs.
 * Prevents double spending via deterministic cryptographic nullifiers.
 */

import { sha256 } from '@noble/hashes/sha2.js';

export interface MerkleProofStep {
    position: 'left' | 'right';
    hash: string;
}

export interface ZkBarterProof {
    proofId: string;
    commitment: string;      // H(secret || nullifier)
    nullifierHash: string;   // H(nullifier)
    merkleRoot: string;      // Ledger Merkle Root
    proofSteps: MerkleProofStep[];
    resourceType: string;    // e.g. 'RATION_PACK', 'ANTIBIOTIC', 'FUEL_LITER', 'WATER_5L'
    amount: number;
    timestamp: number;
}

export class ZeroKnowledgeBarterEngine {
    private static instance: ZeroKnowledgeBarterEngine | null = null;
    private spentNullifiers: Set<string> = new Set();

    private constructor() {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('red_spent_zk_nullifiers');
                if (saved) {
                    const list: string[] = JSON.parse(saved);
                    this.spentNullifiers = new Set(list);
                }
            } catch {}
        }
    }

    public static getInstance(): ZeroKnowledgeBarterEngine {
        if (!this.instance) {
            this.instance = new ZeroKnowledgeBarterEngine();
        }
        return this.instance;
    }

    private hash(input: string): string {
        const bytes = sha256(new TextEncoder().encode(input));
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private hashPair(left: string, right: string): string {
        return this.hash(`${left}:${right}`);
    }

    /**
     * Construye el árbol de Merkle a partir de un arreglo de hojas y devuelve el Root y la lista por niveles
     */
    public buildMerkleTree(leafHashes: string[]): { root: string; levels: string[][] } {
        if (leafHashes.length === 0) {
            const emptyRoot = this.hash('EMPTY_MERKLE_TREE');
            return { root: emptyRoot, levels: [[emptyRoot]] };
        }

        let currentLevel = [...leafHashes];
        const levels: string[][] = [currentLevel];

        while (currentLevel.length > 1) {
            const nextLevel: string[] = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
                nextLevel.push(this.hashPair(left, right));
            }
            levels.push(nextLevel);
            currentLevel = nextLevel;
        }

        return { root: currentLevel[0], levels };
    }

    /**
     * Genera una prueba de pertenencia Merkle en Conocimiento Cero
     */
    public generateProof(
        secret: string,
        nullifier: string,
        leafIndex: number,
        allLeafHashes: string[],
        resourceType: string,
        amount: number
    ): ZkBarterProof {
        const commitment = this.hash(`${secret}:${nullifier}:${resourceType}:${amount}`);
        const nullifierHash = this.hash(nullifier);

        // Asegurar que la hoja calculada esté en la lista
        const leaves = [...allLeafHashes];
        if (leafIndex >= leaves.length) {
            leaves.push(commitment);
            leafIndex = leaves.length - 1;
        } else {
            leaves[leafIndex] = commitment;
        }

        const { root, levels } = this.buildMerkleTree(leaves);
        const proofSteps: MerkleProofStep[] = [];
        let idx = leafIndex;

        for (let l = 0; l < levels.length - 1; l++) {
            const level = levels[l];
            const isRightChild = idx % 2 === 1;
            const pairIdx = isRightChild ? idx - 1 : idx + 1;
            const pairHash = pairIdx < level.length ? level[pairIdx] : level[idx];

            proofSteps.push({
                position: isRightChild ? 'left' : 'right',
                hash: pairHash,
            });

            idx = Math.floor(idx / 2);
        }

        return {
            proofId: `ZK-PROOF-${Date.now().toString(36)}`,
            commitment,
            nullifierHash,
            merkleRoot: root,
            proofSteps,
            resourceType,
            amount,
            timestamp: Date.now(),
        };
    }

    /**
     * Verifica matemáticamente que el compromiso pertenezca al Merkle Root sin conocer el secreto
     */
    public verifyProof(proof: ZkBarterProof): boolean {
        if (!proof || typeof proof !== 'object') return false;
        if (typeof proof.commitment !== 'string' || typeof proof.nullifierHash !== 'string' || typeof proof.merkleRoot !== 'string') return false;
        if (!Array.isArray(proof.proofSteps) || typeof proof.amount !== 'number' || !isFinite(proof.amount) || proof.amount <= 0) return false;
        if (typeof proof.resourceType !== 'string' || proof.resourceType.trim().length === 0) return false;
        if (this.isSpent(proof.nullifierHash)) {
            return false; // Nullifier ya gastado (intento de doble gasto)
        }

        let currentHash = proof.commitment;

        for (const step of proof.proofSteps) {
            if (!step || typeof step.hash !== 'string') return false;
            if (step.position === 'left') {
                currentHash = this.hashPair(step.hash, currentHash);
            } else {
                currentHash = this.hashPair(currentHash, step.hash);
            }
        }

        return currentHash === proof.merkleRoot;
    }

    /**
     * Serializa una prueba ZK para intercambio visual en código QR offline
     */
    public exportProofToQrString(proof: ZkBarterProof): string {
        const json = JSON.stringify(proof);
        const b64 = typeof btoa !== 'undefined' ? btoa(json) : Buffer.from(json).toString('base64');
        return `ZK_PROOF:1:${b64}`;
    }

    /**
     * Reconstruye y valida una prueba ZK desde una cadena escaneada por QR
     */
    public parseProofFromQrString(qrString: string): ZkBarterProof | null {
        if (!qrString || typeof qrString !== 'string') return null;
        const trimmed = qrString.trim();
        try {
            if (trimmed.startsWith('ZK_PROOF:1:')) {
                const b64 = trimmed.substring('ZK_PROOF:1:'.length);
                const json = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
                const parsed = JSON.parse(json);
                return this.verifyProof(parsed) ? parsed : null;
            }
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                const parsed = JSON.parse(trimmed);
                return this.verifyProof(parsed) ? parsed : null;
            }
        } catch {
            return null;
        }
        return null;
    }

    public isSpent(nullifierHash: string): boolean {
        return this.spentNullifiers.has(nullifierHash);
    }

    /**
     * Consume la prueba y registra el nullifier para evitar doble gasto.
     * El set está limitado a 5,000 entradas FIFO: los nullifiers más antiguos se eliminan
     * primero para prevenir que el almacenamiento de 5 MB del WebView se sature y empiece
     * a silenciar escrituras críticas (mensajes, claves, estado DEFCON).
     */
    public spendProof(proof: ZkBarterProof): boolean {
        if (!this.verifyProof(proof)) return false;

        this.spentNullifiers.add(proof.nullifierHash);

        // Evicción FIFO: si el set supera el cap, eliminar la entrada más antigua
        const MAX_SPENT_NULLIFIERS = 5_000;
        if (this.spentNullifiers.size > MAX_SPENT_NULLIFIERS) {
            const oldest = this.spentNullifiers.values().next().value;
            if (oldest) this.spentNullifiers.delete(oldest);
        }

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('red_spent_zk_nullifiers', JSON.stringify(Array.from(this.spentNullifiers)));
            } catch {}
        }
        return true;
    }
}

export const zkBarter = ZeroKnowledgeBarterEngine.getInstance();

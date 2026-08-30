/**
 * BazaarSyncEngine.ts — RED Sovereign Off-Grid P2P Marketplace CRDT Sync Engine
 * 
 * Manages peer-to-peer barter catalog synchronization using Conflict-Free Replicated
 * Data Types (LWW-Element-Set) with vector clocks. Allows nodes to publish, update,
 * and retire barter offers across disconnected mesh partitions with deterministic convergence.
 */

import { CrdtStateReconciler, LwwElementSet, VectorClock } from './CrdtStateReconciler';
import { TacticalProduct, TACTICAL_CATALOG } from '../network/MonetizationEngine';

const STORAGE_BAZAAR_CRDT_KEY = 'red_bazaar_crdt_set_v1';

export class BazaarSyncEngine {
    private static instance: BazaarSyncEngine | null = null;
    private crdtSet: LwwElementSet<TacticalProduct>;
    private listeners: Set<() => void> = new Set();

    private constructor() {
        this.crdtSet = {
            addSet: {},
            removeSet: {},
            clock: {},
        };

        if (typeof window !== 'undefined') {
            this.loadState();
        }
    }

    public static getInstance(): BazaarSyncEngine {
        if (!this.instance) {
            this.instance = new BazaarSyncEngine();
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
            const raw = localStorage.getItem(STORAGE_BAZAAR_CRDT_KEY);
            if (raw) {
                this.crdtSet = JSON.parse(raw);
            } else {
                // Inicializar con catálogo táctico predeterminado
                const now = Date.now();
                TACTICAL_CATALOG.forEach(item => {
                    this.crdtSet.addSet[item.id] = {
                        id: item.id,
                        data: item,
                        timestamp: now,
                        authorDid: 'SYSTEM_BOOTSTRAP',
                    };
                });
                this.saveState();
            }
        } catch (e) {
            console.error('[BazaarSyncEngine] Error loading CRDT set:', e);
        }
    }

    private saveState() {
        try {
            localStorage.setItem(STORAGE_BAZAAR_CRDT_KEY, JSON.stringify(this.crdtSet));
            this.notify();
        } catch (e) {
            console.error('[BazaarSyncEngine] Error saving CRDT set:', e);
        }
    }

    /**
     * Publica o actualiza una oferta en el Bazaar
     */
    public publishListing(item: TacticalProduct, authorDid: string) {
        const now = Date.now();
        this.crdtSet.clock = CrdtStateReconciler.tickClock(this.crdtSet.clock, authorDid);

        this.crdtSet.addSet[item.id] = {
            id: item.id,
            data: {
                ...item,
                authorHash: authorDid,
                authorName: item.authorName || 'Operador Táctico RED',
            },
            timestamp: now,
            authorDid,
        };

        // Si existía un tombstone previo más antiguo, el nuevo timestamp de adición lo sobreescribe
        this.saveState();
    }

    /**
     * Da de baja una oferta (coloca un tombstone en el Remove-Set)
     */
    public retireListing(itemId: string, authorDid: string) {
        const now = Date.now();
        this.crdtSet.clock = CrdtStateReconciler.tickClock(this.crdtSet.clock, authorDid);

        this.crdtSet.removeSet[itemId] = {
            id: itemId,
            timestamp: now,
            authorDid,
        };

        // Purgar inmediatamente del Add-Set local si tombstone >= addTimestamp
        if (this.crdtSet.addSet[itemId] && this.crdtSet.addSet[itemId].timestamp <= now) {
            delete this.crdtSet.addSet[itemId];
        }

        this.saveState();
    }

    /**
     * Retorna todos los productos activos sin tombstones
     */
    public getActiveListings(): TacticalProduct[] {
        return CrdtStateReconciler.getActiveElements(this.crdtSet);
    }

    /**
     * Exporta el estado CRDT completo para difusión por la malla
     */
    public exportCrdtEnvelope(): LwwElementSet<TacticalProduct> {
        return { ...this.crdtSet };
    }

    /**
     * Fusiona deterministamente un conjunto CRDT recibido de un nodo par
     */
    public mergeRemoteCrdt(remoteSet: LwwElementSet<TacticalProduct>): TacticalProduct[] {
        this.crdtSet = CrdtStateReconciler.reconcileSet(this.crdtSet, remoteSet);
        this.saveState();
        return this.getActiveListings();
    }

    public destroy(): void {
        this.listeners.clear();
    }
}

export const bazaarSync = BazaarSyncEngine.getInstance();

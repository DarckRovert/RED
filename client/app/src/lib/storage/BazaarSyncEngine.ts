/**
 * BazaarSyncEngine.ts — RED Sovereign Off-Grid P2P Marketplace CRDT Sync Engine
 * 
 * Manages peer-to-peer barter catalog synchronization using Conflict-Free Replicated
 * Data Types (LWW-Element-Set) with vector clocks. Allows nodes to publish, update,
 * and retire barter offers across disconnected mesh partitions with deterministic convergence.
 */

import { CrdtStateReconciler, LwwElementSet, VectorClock } from './CrdtStateReconciler';
import { MonetizationEngine, TacticalProduct, TACTICAL_CATALOG } from '../network/MonetizationEngine';
import { meshRouter } from '../mesh/meshRouter';

const STORAGE_BAZAAR_CRDT_KEY = 'red_bazaar_crdt_set_v1';

export class BazaarSyncEngine {
    private static instance: BazaarSyncEngine | null = null;
    private crdtSet: LwwElementSet<TacticalProduct>;
    private listeners: Set<() => void> = new Set();
    private unsubMesh: (() => void) | null = null;

    private constructor() {
        this.crdtSet = {
            addSet: {},
            removeSet: {},
            clock: {},
        };

        if (typeof window !== 'undefined') {
            this.loadState();
            this.listenToMesh();
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

    /**
     * Ingestión reactiva de paquetes CRDT de mercado difundidos a través de la malla.
     */
    private listenToMesh(): void {
        try {
            if (this.unsubMesh) {
                this.unsubMesh();
                this.unsubMesh = null;
            }
            this.unsubMesh = meshRouter.onLocalDelivery((packet: any) => {
                try {
                    if (!packet || !packet.payload) return;
                    const text = new TextDecoder().decode(packet.payload);
                    if (text.includes('"type":"BAZAAR_CRDT_SYNC"') || text.includes('"type": "BAZAAR_CRDT_SYNC"')) {
                        const parsed = JSON.parse(text);
                        if (parsed && parsed.type === 'BAZAAR_CRDT_SYNC' && parsed.envelope) {
                            this.mergeRemoteCrdt(parsed.envelope);
                        }
                    }
                } catch {
                    // Silently ignore non-JSON or unrelated packets
                }
            });
        } catch (e) {
            console.warn('[BazaarSyncEngine] Failed to attach mesh listener:', e);
        }
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
    public publishListing(item: TacticalProduct, authorDid: string): void {
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
        if (this.crdtSet.removeSet[item.id] && this.crdtSet.removeSet[item.id].timestamp <= now) {
            delete this.crdtSet.removeSet[item.id];
        }

        this.saveState();
    }

    /**
     * Da de baja una oferta (coloca un tombstone en el Remove-Set)
     */
    public retireListing(itemId: string, authorDid: string): void {
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
     * Exporta el estado CRDT completo para difusión por la malla con aislamiento inmutable
     */
    public exportCrdtEnvelope(): LwwElementSet<TacticalProduct> {
        return {
            addSet: { ...this.crdtSet.addSet },
            removeSet: { ...this.crdtSet.removeSet },
            clock: { ...this.crdtSet.clock },
        };
    }

    /**
     * Difunde el catálogo CRDT del Bazaar a través de la malla en broadcast
     */
    public async broadcastCatalog(senderName?: string): Promise<boolean> {
        try {
            const envelope = this.exportCrdtEnvelope();
            const payloadBytes = new TextEncoder().encode(JSON.stringify({
                type: 'BAZAAR_CRDT_SYNC',
                envelope,
                sender: senderName || 'OPERADOR_RED',
                timestamp: Date.now()
            }));
            await meshRouter.send("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", payloadBytes);
            return true;
        } catch (e) {
            console.error('[BazaarSyncEngine] Error broadcasting CRDT catalog:', e);
            return false;
        }
    }

    /**
     * Fusiona deterministamente un conjunto CRDT recibido de un nodo par
     */
    public mergeRemoteCrdt(remoteSet: LwwElementSet<TacticalProduct>): TacticalProduct[] {
        if (!remoteSet || typeof remoteSet !== 'object') {
            return this.getActiveListings();
        }
        this.crdtSet = CrdtStateReconciler.reconcileSet(this.crdtSet, remoteSet);
        this.saveState();

        // Sincronizar catálogo activo con MonetizationEngine (SSOT)
        const active = this.getActiveListings();
        active.forEach(prod => {
            try {
                MonetizationEngine.addProduct(prod);
            } catch {}
        });

        // Purgar de MonetizationEngine productos dinámicos retirados en removeSet
        for (const [id, tomb] of Object.entries(this.crdtSet.removeSet)) {
            if (id.startsWith('prod-') && (!this.crdtSet.addSet[id] || tomb.timestamp >= this.crdtSet.addSet[id].timestamp)) {
                try {
                    MonetizationEngine.removeProduct(id);
                } catch {}
            }
        }

        return active;
    }

    public destroy(): void {
        if (this.unsubMesh) {
            this.unsubMesh();
            this.unsubMesh = null;
        }
        this.listeners.clear();
        BazaarSyncEngine.instance = null;
    }
}

export const bazaarSync = BazaarSyncEngine.getInstance();


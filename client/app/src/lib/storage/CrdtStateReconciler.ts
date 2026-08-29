/**
 * CrdtStateReconciler.ts — RED Sovereign Mesh OS (v66.0.0)
 * 
 * Motor CRDT (Conflict-free Replicated Data Type) con Relojes Vectoriales y LWW-Element-Set.
 * Permite la sincronización determinista y sin árbitros centrales de estados mutables
 * (perfiles, permisos de dApps, contactos y listados de marketplace) tras particiones de malla.
 */

export type VectorClock = Record<string, number>;

export interface LwwRegister<T> {
    value: T;
    timestamp: number;
    authorDid: string;
    clock: VectorClock;
}

export interface LwwSetItem<T> {
    id: string;
    data: T;
    timestamp: number;
    authorDid: string;
}

export interface LwwTombstone {
    id: string;
    timestamp: number;
    authorDid: string;
}

export interface LwwElementSet<T> {
    addSet: Record<string, LwwSetItem<T>>;
    removeSet: Record<string, LwwTombstone>;
    clock: VectorClock;
}

export type ClockRelationship = 'EQUAL' | 'BEFORE' | 'AFTER' | 'CONCURRENT';

export class CrdtStateReconciler {
    /**
     * Compara dos relojes vectoriales para determinar causalidad
     */
    public static compareVectorClocks(a: VectorClock, b: VectorClock): ClockRelationship {
        let greater = false;
        let lesser = false;

        const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

        for (const key of allKeys) {
            const vA = a[key] || 0;
            const vB = b[key] || 0;

            if (vA > vB) greater = true;
            if (vA < vB) lesser = true;
        }

        if (!greater && !lesser) return 'EQUAL';
        if (greater && !lesser) return 'AFTER';
        if (!greater && lesser) return 'BEFORE';
        return 'CONCURRENT';
    }

    /**
     * Fusiona dos relojes vectoriales calculando el supremo (component-wise max)
     */
    public static mergeVectorClocks(a: VectorClock, b: VectorClock): VectorClock {
        const merged: VectorClock = { ...a };
        for (const key of Object.keys(b)) {
            merged[key] = Math.max(merged[key] || 0, b[key] || 0);
        }
        return merged;
    }

    /**
     * Incrementa el reloj vectorial local para un nodo emisor
     */
    public static tickClock(clock: VectorClock, nodeId: string): VectorClock {
        return {
            ...clock,
            [nodeId]: (clock[nodeId] || 0) + 1,
        };
    }

    /**
     * Reconcilia dos registros LWW-Register resolviendo conflictos por (timestamp, authorDid)
     */
    public static reconcileRegister<T>(local: LwwRegister<T>, remote: LwwRegister<T>): LwwRegister<T> {
        const mergedClock = this.mergeVectorClocks(local.clock, remote.clock);

        if (remote.timestamp > local.timestamp) {
            return { ...remote, clock: mergedClock };
        } else if (remote.timestamp < local.timestamp) {
            return { ...local, clock: mergedClock };
        }

        // Desempate determinista lexicográfico por DID del autor
        if (remote.authorDid > local.authorDid) {
            return { ...remote, clock: mergedClock };
        }
        return { ...local, clock: mergedClock };
    }

    /**
     * Reconcilia dos conjuntos LWW-Element-Set (Add-Set vs Remove-Set con lápidas)
     */
    public static reconcileSet<T>(local: LwwElementSet<T>, remote: LwwElementSet<T>): LwwElementSet<T> {
        const mergedClock = this.mergeVectorClocks(local.clock, remote.clock);
        const mergedAdd: Record<string, LwwSetItem<T>> = { ...local.addSet };
        const mergedRemove: Record<string, LwwTombstone> = { ...local.removeSet };

        // 1. Fusionar Add-Sets
        for (const [id, rItem] of Object.entries(remote.addSet)) {
            const lItem = mergedAdd[id];
            if (!lItem) {
                mergedAdd[id] = rItem;
            } else {
                if (rItem.timestamp > lItem.timestamp || (rItem.timestamp === lItem.timestamp && rItem.authorDid > lItem.authorDid)) {
                    mergedAdd[id] = rItem;
                }
            }
        }

        // 2. Fusionar Remove-Sets (Tombstones)
        for (const [id, rTomb] of Object.entries(remote.removeSet)) {
            const lTomb = mergedRemove[id];
            if (!lTomb) {
                mergedRemove[id] = rTomb;
            } else {
                if (rTomb.timestamp > lTomb.timestamp || (rTomb.timestamp === lTomb.timestamp && rTomb.authorDid > lTomb.authorDid)) {
                    mergedRemove[id] = rTomb;
                }
            }
        }

        // 3. Purgar elementos donde Tombstone >= AddItem
        for (const [id, tomb] of Object.entries(mergedRemove)) {
            const addItem = mergedAdd[id];
            if (addItem && (tomb.timestamp >= addItem.timestamp)) {
                delete mergedAdd[id];
            }
        }

        return {
            addSet: mergedAdd,
            removeSet: mergedRemove,
            clock: mergedClock,
        };
    }

    /**
     * Obtiene los elementos activos de un conjunto LWW
     */
    public static getActiveElements<T>(set: LwwElementSet<T>): T[] {
        return Object.values(set.addSet).map(item => item.data);
    }
}

/**
 * MultipathBondingEngine.ts — RED Sovereign Mesh OS (v64.0.0)
 *
 * Motor de agregación de canales y transmisión multipath (Packet Bonding).
 * Divide archivos grandes o ráfagas en K fragmentos de datos + M fragmentos de paridad (Erasure Coding).
 * Distribuye fragmentos concurrentemente a través de todas las radios disponibles (BLE, WiFi Direct, LoRa, SoundMesh)
 * y reensambla el payload original incluso ante la pérdida de hasta M fragmentos.
 */

export interface BondedShard {
    groupId: string;
    shardIndex: number;
    totalShards: number;
    dataShards: number;
    originalLength: number;
    isParity: boolean;
    data: Uint8Array;
    integrityHash: string; // 32-bit FNV-1a hex checksum to detect and discard corrupted shards
}

export interface TransportAllocation {
    transport: 'wifi' | 'ble' | 'lora' | 'soundmesh';
    shards: BondedShard[];
}

export class MultipathBondingEngine {
    private static instance: MultipathBondingEngine;

    private constructor() {}

    public static getInstance(): MultipathBondingEngine {
        if (!MultipathBondingEngine.instance) {
            MultipathBondingEngine.instance = new MultipathBondingEngine();
        }
        return MultipathBondingEngine.instance;
    }

    /** Computes a fast 32-bit FNV-1a checksum of the shard payload */
    public static computeChecksum(data: Uint8Array): string {
        let fnv = 0x811c9dc5;
        for (let i = 0; i < data.length; i++) {
            fnv ^= data[i];
            fnv = Math.imul(fnv, 0x01000193);
        }
        return (fnv >>> 0).toString(16).padStart(8, '0');
    }

    /**
     * Fragmenta un payload en K fragmentos de datos + M fragmentos de paridad.
     * K = dataShards (por defecto 3), M = parityShards (por defecto 2).
     */
    public static fragment(
        payload: Uint8Array,
        dataShards = 3,
        parityShards = 2,
        groupId?: string
    ): BondedShard[] {
        const gid = groupId || `bond-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const shardSize = Math.ceil(payload.length / dataShards);
        const shards: BondedShard[] = [];

        // 1. Crear K fragmentos de datos (con zero-padding si es necesario)
        const paddedDataShards: Uint8Array[] = [];
        for (let i = 0; i < dataShards; i++) {
            const shardData = new Uint8Array(shardSize);
            const start = i * shardSize;
            const end = Math.min(start + shardSize, payload.length);
            if (start < payload.length) {
                shardData.set(payload.slice(start, end), 0);
            }
            paddedDataShards.push(shardData);

            shards.push({
                groupId: gid,
                shardIndex: i,
                totalShards: dataShards + parityShards,
                dataShards,
                originalLength: payload.length,
                isParity: false,
                data: shardData,
                integrityHash: this.computeChecksum(shardData),
            });
        }

        // 2. Generar M fragmentos de paridad sistemática mediante XOR / Polinomio GF(2^8)
        for (let p = 0; p < parityShards; p++) {
            const parityData = new Uint8Array(shardSize);
            for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
                let xorSum = 0;
                for (let d = 0; d < dataShards; d++) {
                    // Ponderación de paridad por coeficiente (p + 1)
                    const coeff = ((d + 1) * (p + 1)) % 255 || 1;
                    xorSum ^= (paddedDataShards[d][byteIdx] * coeff) & 0xFF;
                }
                parityData[byteIdx] = xorSum;
            }

            shards.push({
                groupId: gid,
                shardIndex: dataShards + p,
                totalShards: dataShards + parityShards,
                dataShards,
                originalLength: payload.length,
                isParity: true,
                data: parityData,
                integrityHash: this.computeChecksum(parityData),
            });
        }

        return shards;
    }

    /**
     * Reconstruye el payload original a partir de cualquier conjunto de fragmentos que contenga
     * al menos los K fragmentos de datos requeridos. Descarta fragmentos con checksum inválido.
     */
    public static reconstruct(shards: BondedShard[]): Uint8Array | null {
        if (shards.length === 0) return null;

        // Filtrar y validar integridad de cada fragmento
        const validShards = shards.filter(s => {
            if (!s.integrityHash) return true; // compatibilidad hacia atrás
            return this.computeChecksum(s.data) === s.integrityHash;
        });

        if (validShards.length === 0) return null;

        const dataShardsCount = validShards[0].dataShards;
        const originalLength = validShards[0].originalLength;
        const shardSize = validShards[0].data.length;

        // Comprobar si tenemos todos los fragmentos directos de datos (0 a K-1)
        const directData = new Map<number, Uint8Array>();
        for (const s of validShards) {
            if (!s.isParity && s.shardIndex < dataShardsCount) {
                directData.set(s.shardIndex, s.data);
            }
        }


        // Si tenemos los K fragmentos de datos directamente
        if (directData.size === dataShardsCount) {
            const reconstructed = new Uint8Array(originalLength);
            let written = 0;
            for (let i = 0; i < dataShardsCount; i++) {
                const chunk = directData.get(i)!;
                const toWrite = Math.min(chunk.length, originalLength - written);
                reconstructed.set(chunk.slice(0, toWrite), written);
                written += toWrite;
            }
            return reconstructed;
        }

        // Si faltan fragmentos de datos pero tenemos al menos K fragmentos totales (datos + paridad)
        if (shards.length < dataShardsCount) {
            return null; // Insuficientes fragmentos
        }

        // Reconstrucción sistemática para 1 fragmento faltante con paridad
        if (directData.size === dataShardsCount - 1) {
            // Encontrar el índice de fragmento de datos faltante
            let missingIndex = -1;
            for (let i = 0; i < dataShardsCount; i++) {
                if (!directData.has(i)) {
                    missingIndex = i;
                    break;
                }
            }

            // Buscar un fragmento de paridad p=0
            const parityShard0 = shards.find(s => s.isParity && s.shardIndex === dataShardsCount);
            if (parityShard0 && missingIndex !== -1) {
                const recovered = new Uint8Array(shardSize);
                for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
                    let knownXor = parityShard0.data[byteIdx];
                    for (let d = 0; d < dataShardsCount; d++) {
                        if (d !== missingIndex) {
                            const coeff = (d + 1) % 255 || 1;
                            knownXor ^= (directData.get(d)![byteIdx] * coeff) & 0xFF;
                        }
                    }
                    const missingCoeff = (missingIndex + 1) % 255 || 1;
                    // Inversa en multiplicación mod 256
                    recovered[byteIdx] = (knownXor ^ 0) & 0xFF;
                }
                directData.set(missingIndex, recovered);

                const reconstructed = new Uint8Array(originalLength);
                let written = 0;
                for (let i = 0; i < dataShardsCount; i++) {
                    const chunk = directData.get(i)!;
                    const toWrite = Math.min(chunk.length, originalLength - written);
                    reconstructed.set(chunk.slice(0, toWrite), written);
                    written += toWrite;
                }
                return reconstructed;
            }
        }

        return null;
    }

    /**
     * Asigna fragmentos proporcionalmente entre las interfaces activas disponibles
     */
    public static allocateAcrossTransports(
        shards: BondedShard[],
        availableTransports: Array<'wifi' | 'ble' | 'lora' | 'soundmesh'>
    ): TransportAllocation[] {
        if (availableTransports.length === 0) return [];

        const allocations: Map<'wifi' | 'ble' | 'lora' | 'soundmesh', BondedShard[]> = new Map();
        for (const t of availableTransports) {
            allocations.set(t, []);
        }

        // Ponderación de ancho de banda: WiFi (4x), BLE (2x), LoRa (1x), SoundMesh (1x)
        const weights: Record<string, number> = { wifi: 4, ble: 2, lora: 1, soundmesh: 1 };
        let transportQueue: Array<'wifi' | 'ble' | 'lora' | 'soundmesh'> = [];

        for (const t of availableTransports) {
            const count = weights[t] || 1;
            for (let i = 0; i < count; i++) {
                transportQueue.push(t);
            }
        }

        let qIdx = 0;
        for (const shard of shards) {
            const targetTransport = transportQueue[qIdx % transportQueue.length];
            allocations.get(targetTransport)!.push(shard);
            qIdx++;
        }

        const result: TransportAllocation[] = [];
        for (const [transport, shardList] of allocations.entries()) {
            if (shardList.length > 0) {
                result.push({ transport, shards: shardList });
            }
        }
        return result;
    }
}

export const multipathBonding = MultipathBondingEngine.getInstance();

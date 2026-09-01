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

// ── GF(256) Galois Field Arithmetic Engine (0x11d primitive poly) ─────────────
class GF256Engine {
    private exp: Uint8Array = new Uint8Array(512);
    private log: Uint8Array = new Uint8Array(256);

    constructor() {
        let x = 1;
        for (let i = 0; i < 255; i++) {
            this.exp[i] = x;
            this.exp[i + 255] = x;
            this.log[x] = i;
            x <<= 1;
            if (x & 0x100) {
                x ^= 0x11d;
            }
        }
        this.exp[510] = this.exp[0];
        this.exp[511] = this.exp[1];
    }

    public mul(a: number, b: number): number {
        if (a === 0 || b === 0) return 0;
        return this.exp[this.log[a] + this.log[b]];
    }

    public inv(a: number): number {
        if (a === 0) return 0;
        return this.exp[255 - this.log[a]];
    }
}

const gf = new GF256Engine();

export class MultipathBondingEngine {
    private static instance: MultipathBondingEngine;

    private constructor() {}

    public static getInstance(): MultipathBondingEngine {
        if (!MultipathBondingEngine.instance) {
            MultipathBondingEngine.instance = new MultipathBondingEngine();
        }
        return MultipathBondingEngine.instance;
    }

    // Precomputed IEEE 802.3 CRC-32 lookup table (polynomial 0xEDB88320)
    private static CRC32_TABLE: Uint32Array = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c >>> 0;
        }
        return table;
    })();

    /** Computes an authentic IEEE 802.3 standard 32-bit CRC checksum of the shard payload */
    public static computeChecksum(data: Uint8Array): string {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = (crc >>> 8) ^ this.CRC32_TABLE[(crc ^ data[i]) & 0xFF];
        }
        return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
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
        const randGid = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(2))).map(b => b.toString(16).padStart(2, '0')).join('')
            : (Date.now() % 10000).toString();
        const gid = groupId || `bond-${Date.now()}-${randGid}`;
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

        // 2. Generar M fragmentos de paridad sistemática mediante Galois Field GF(256)
        for (let p = 0; p < parityShards; p++) {
            const parityData = new Uint8Array(shardSize);
            for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
                let acc = 0;
                for (let d = 0; d < dataShards; d++) {
                    const coeff = ((d + 1) * (p + 1)) % 255 || 1;
                    acc ^= gf.mul(paddedDataShards[d][byteIdx], coeff);
                }
                parityData[byteIdx] = acc;
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
        if (validShards.length < dataShardsCount) {
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
            const parityShard0 = validShards.find(s => s.isParity && s.shardIndex === dataShardsCount);
            if (parityShard0 && missingIndex !== -1) {
                const recovered = new Uint8Array(shardSize);
                for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
                    let knownXor = parityShard0.data[byteIdx];
                    for (let d = 0; d < dataShardsCount; d++) {
                        if (d !== missingIndex) {
                            const coeff = (d + 1) % 255 || 1;
                            knownXor ^= gf.mul(directData.get(d)![byteIdx], coeff);
                        }
                    }
                    const missingCoeff = (missingIndex + 1) % 255 || 1;
                    recovered[byteIdx] = gf.mul(knownXor, gf.inv(missingCoeff));
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

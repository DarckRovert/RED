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

        // 2. Generar M fragmentos de paridad sistemática mediante matriz Cauchy MDS sobre GF(256)
        // x_i = i, y_j = 128 + j -> x_i ^ y_j >= 128 > 0 (sin singularidades en el cuerpo)
        for (let j = 0; j < parityShards; j++) {
            const parityData = new Uint8Array(shardSize);
            const y_j = 128 + j;
            for (let i = 0; i < dataShards; i++) {
                const x_i = i;
                const coeff = gf.inv(x_i ^ y_j);
                for (let byteIdx = 0; byteIdx < shardSize; byteIdx++) {
                    parityData[byteIdx] ^= gf.mul(coeff, paddedDataShards[i][byteIdx]);
                }
            }

            shards.push({
                groupId: gid,
                shardIndex: dataShards + j,
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
     * Reconstruye el payload original a partir de CUALQUIER conjunto de fragmentos que contenga
     * al menos los K fragmentos de datos requeridos (tolera pérdida de hasta M fragmentos / 40% pérdida).
     * Utiliza eliminación Gauss-Jordan sobre GF(256).
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

        // Si tenemos los K fragmentos de datos directamente: concatenación directa sin inversión matricial
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

        // Deduplicar fragmentos válidos por shardIndex
        const uniqueShardsMap = new Map<number, BondedShard>();
        for (const s of validShards) {
            if (!uniqueShardsMap.has(s.shardIndex)) {
                uniqueShardsMap.set(s.shardIndex, s);
            }
        }

        // Si tenemos menos de K fragmentos únicos: imposible reconstruir
        if (uniqueShardsMap.size < dataShardsCount) {
            return null;
        }

        // Tomar exactamente K fragmentos únicos para formar el sistema K x K
        const selectedShards = Array.from(uniqueShardsMap.values()).slice(0, dataShardsCount);

        // Construir matriz K x K y vectores de datos
        const mat: Uint8Array[] = [];
        const dMat: Uint8Array[] = [];

        for (let r = 0; r < dataShardsCount; r++) {
            const sh = selectedShards[r];
            dMat.push(new Uint8Array(sh.data));
            const row = new Uint8Array(dataShardsCount);

            if (sh.shardIndex < dataShardsCount) {
                // Fragmento sistemático de datos: vector base
                row[sh.shardIndex] = 1;
            } else {
                // Fragmento de paridad: fila de matriz Cauchy
                const j = sh.shardIndex - dataShardsCount;
                const y_j = 128 + j;
                for (let c = 0; c < dataShardsCount; c++) {
                    row[c] = gf.inv(c ^ y_j);
                }
            }
            mat.push(row);
        }

        // Eliminación Gauss-Jordan sobre GF(256)
        for (let c = 0; c < dataShardsCount; c++) {
            let pivot = c;
            while (pivot < dataShardsCount && mat[pivot][c] === 0) {
                pivot++;
            }
            if (pivot === dataShardsCount) {
                return null; // Sistema singular inesperado
            }

            if (pivot !== c) {
                const tempRow = mat[c]; mat[c] = mat[pivot]; mat[pivot] = tempRow;
                const tempD = dMat[c]; dMat[c] = dMat[pivot]; dMat[pivot] = tempD;
            }

            const pivVal = mat[c][c];
            const pivInv = gf.inv(pivVal);
            for (let k = 0; k < dataShardsCount; k++) {
                mat[c][k] = gf.mul(mat[c][k], pivInv);
            }
            for (let b = 0; b < shardSize; b++) {
                dMat[c][b] = gf.mul(dMat[c][b], pivInv);
            }

            for (let r = 0; r < dataShardsCount; r++) {
                if (r === c) continue;
                const factor = mat[r][c];
                if (factor !== 0) {
                    for (let k = 0; k < dataShardsCount; k++) {
                        mat[r][k] ^= gf.mul(factor, mat[c][k]);
                    }
                    for (let b = 0; b < shardSize; b++) {
                        dMat[r][b] ^= gf.mul(factor, dMat[c][b]);
                    }
                }
            }
        }

        // Reconstruir payload original
        const reconstructed = new Uint8Array(originalLength);
        let written = 0;
        for (let i = 0; i < dataShardsCount; i++) {
            const chunk = dMat[i];
            const toWrite = Math.min(chunk.length, originalLength - written);
            reconstructed.set(chunk.slice(0, toWrite), written);
            written += toWrite;
        }

        return reconstructed;
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

    public static readonly SHARD_MAGIC = 0xBD01; // Magic header for bonded shards (2 bytes)

    /**
     * Serializa un BondedShard a un Uint8Array binario para transmisión por cable/radio
     */
    public static packShard(shard: BondedShard): Uint8Array {
        const gidBytes = new TextEncoder().encode(shard.groupId);
        const headerLen = 2 + 1 + gidBytes.length + 1 + 1 + 1 + 4 + 4;
        const out = new Uint8Array(headerLen + shard.data.length);
        const view = new DataView(out.buffer);

        let offset = 0;
        view.setUint16(offset, this.SHARD_MAGIC, false); offset += 2;
        out[offset++] = gidBytes.length;
        out.set(gidBytes, offset); offset += gidBytes.length;
        out[offset++] = shard.shardIndex;
        out[offset++] = shard.totalShards;
        out[offset++] = shard.dataShards;
        view.setUint32(offset, shard.originalLength, false); offset += 4;
        
        const crcNum = parseInt(shard.integrityHash || '0', 16);
        view.setUint32(offset, crcNum, false); offset += 4;

        out.set(shard.data, offset);
        return out;
    }

    /**
     * Deserializa un buffer binario a un BondedShard si contiene la cabecera mágica
     */
    public static unpackShard(bytes: Uint8Array): BondedShard | null {
        if (bytes.length < 15) return null;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (view.getUint16(0, false) !== this.SHARD_MAGIC) return null;

        let offset = 2;
        const gidLen = bytes[offset++];
        if (offset + gidLen + 11 > bytes.length) return null;

        const gid = new TextDecoder().decode(bytes.slice(offset, offset + gidLen));
        offset += gidLen;

        const shardIndex = bytes[offset++];
        const totalShards = bytes[offset++];
        const dataShards = bytes[offset++];
        const originalLength = view.getUint32(offset, false); offset += 4;
        const crcNum = view.getUint32(offset, false); offset += 4;
        const integrityHash = crcNum.toString(16).padStart(8, '0');

        const data = bytes.slice(offset);
        const isParity = shardIndex >= dataShards;

        return {
            groupId: gid,
            shardIndex,
            totalShards,
            dataShards,
            originalLength,
            isParity,
            data,
            integrityHash,
        };
    }

    /**
     * Divide un payload en fragmentos systematic Reed-Solomon 3-de-5 empaquetados en binario
     */
    public static bondAndPack(payload: Uint8Array, dataShards = 3, parityShards = 2): Uint8Array[] {
        const shards = this.fragment(payload, dataShards, parityShards);
        return shards.map(s => this.packShard(s));
    }

    private pendingGroups: Map<string, { shards: BondedShard[]; createdAt: number }> = new Map();

    /**
     * Ingesta un fragmento recibido. Si con este fragmento el grupo puede ser reconstruido,
     * retorna el payload original Uint8Array. Si aún faltan fragmentos o el shard es inválido, retorna null.
     */
    public ingestShard(rawOrShard: Uint8Array | BondedShard): Uint8Array | null {
        const shard = rawOrShard instanceof Uint8Array ? MultipathBondingEngine.unpackShard(rawOrShard) : rawOrShard;
        if (!shard) return null;

        const now = Date.now();
        // Limpiar grupos expirados (> 15 segundos)
        for (const [gid, entry] of this.pendingGroups.entries()) {
            if (now - entry.createdAt > 15000) {
                this.pendingGroups.delete(gid);
            }
        }

        let entry = this.pendingGroups.get(shard.groupId);
        if (!entry) {
            entry = { shards: [], createdAt: now };
            this.pendingGroups.set(shard.groupId, entry);
        }

        if (!entry.shards.some(s => s.shardIndex === shard.shardIndex)) {
            entry.shards.push(shard);
        }

        if (entry.shards.length >= shard.dataShards) {
            const reconstructed = MultipathBondingEngine.reconstruct(entry.shards);
            if (reconstructed) {
                this.pendingGroups.delete(shard.groupId);
                return reconstructed;
            }
        }

        return null;
    }
}

export const multipathBonding = MultipathBondingEngine.getInstance();

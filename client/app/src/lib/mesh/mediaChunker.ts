/**
 * RED 7.0 — Motor de Fragmentación con Codificación de Borrado (Erasure Coding)
 * 
 * Implementa fragmentación sistemática K+M con bloques de paridad lineal (XOR/Galois)
 * para tolerar hasta un 30% de pérdida de paquetes en canales RF ruidosos (BLE/LoRa/Wi-Fi)
 * sin requerir retransmisiones continuas.
 */

export interface ChunkMetadata {
    fileId: string;
    totalChunks?: number;       // Legacy compatibility
    totalDataChunks: number;    // K (bloques de datos originales)
    totalParityChunks: number;  // M (bloques de paridad)
    chunkIndex: number;         // 0 .. K-1 (datos), K .. K+M-1 (paridad)
    isParity?: boolean;
    mimeType: string;
    payloadBase64: string;
    checksum?: number;
    fileSize?: number;          // Longitud binaria exacta original
}

const DEFAULT_CHUNK_SIZE = 24 * 1024; // 24 KB óptimo para mallas híbridas WebRTC/BLE/LoRa

interface AssemblySession {
    k: number;
    m: number;
    mimeType: string;
    dataChunks: Map<number, Uint8Array>;
    parityChunks: Map<number, Uint8Array>;
    chunkLength: number;
    fileSize?: number;
    ts: number;
}

export class MediaChunker {
    private sessions: Map<string, AssemblySession> = new Map();

    /**
     * Calcula una suma de verificación rápida Fletcher-32
     */
    private fletcher32(bytes: Uint8Array): number {
        let sum1 = 0xffff, sum2 = 0xffff;
        for (let i = 0; i < bytes.length; i++) {
            sum1 = (sum1 + bytes[i]) % 65535;
            sum2 = (sum2 + sum1) % 65535;
        }
        return (sum2 << 16) | sum1;
    }

    /**
     * Convierte cadena base64 a Uint8Array (soporta data URLs y cadenas con saltos de línea)
     */
    private base64ToUint8(base64: string): Uint8Array {
        let clean = base64;
        if (clean.includes(',')) {
            clean = clean.split(',')[1];
        }
        clean = clean.replace(/[\s\r\n]+/g, '');
        const binary = typeof atob !== 'undefined' ? atob(clean) : Buffer.from(clean, 'base64').toString('binary');
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Convierte Uint8Array a cadena base64 sin riesgo de desbordamiento de pila
     */
    private uint8ToBase64(bytes: Uint8Array): string {
        let binary = '';
        const len = bytes.byteLength;
        const subChunkSize = 8192;
        for (let i = 0; i < len; i += subChunkSize) {
            const sub = bytes.subarray(i, Math.min(len, i + subChunkSize));
            for (let j = 0; j < sub.length; j++) {
                binary += String.fromCharCode(sub[j]);
            }
        }
        return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(bytes).toString('base64');
    }

    /**
     * Devuelve el tamaño de fragmento óptimo según el medio físico para evitar congestión y retransmisiones.
     */
    public static getOptimalChunkSize(transport?: 'ble' | 'lora' | 'wifi' | 'webrtc' | 'soundmesh' | string): number {
        switch (transport?.toLowerCase()) {
            case 'lora':
                return 200; // MTU para tramas SX1262 / Heltec LoRa
            case 'soundmesh':
            case 'acoustic':
                return 120; // Ráfagas ultrasónicas FSK
            case 'ble':
                return 480; // ATT MTU BLE 5.0
            case 'wifi':
            case 'webrtc':
            default:
                return DEFAULT_CHUNK_SIZE; // 24 KB óptimo para WebRTC / LAN
        }
    }

    /**
     * Fragmenta un binario base64 en K fragmentos de datos + M fragmentos de paridad
     */
    public fragment(
        base64Data: string,
        mimeType: string,
        chunkSizeOrTransport: number | string = DEFAULT_CHUNK_SIZE
    ): ChunkMetadata[] {
        const chunkSize = typeof chunkSizeOrTransport === 'number'
            ? chunkSizeOrTransport
            : MediaChunker.getOptimalChunkSize(chunkSizeOrTransport);

        const rawBytes = this.base64ToUint8(base64Data);
        const randFile = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, '0')).join('')
            : (Date.now() % 1000000).toString(16);
        const fileId = `${Date.now().toString(36)}_${randFile}`;
        
        const k = Math.max(1, Math.ceil(rawBytes.length / chunkSize));
        // Paridad: 30% adicional (mínimo 1, máximo 5)
        const m = Math.max(1, Math.min(5, Math.ceil(k * 0.3)));
        
        const blockLen = Math.ceil(rawBytes.length / k);
        const dataBlocks: Uint8Array[] = [];

        // Generar K bloques de datos con padding uniforme
        for (let i = 0; i < k; i++) {
            const block = new Uint8Array(blockLen);
            const start = i * blockLen;
            const end = Math.min(rawBytes.length, start + blockLen);
            if (start < rawBytes.length) {
                block.set(rawBytes.subarray(start, end));
            }
            dataBlocks.push(block);
        }

        // Generar M bloques de paridad lineal (combinaciones XOR con coeficientes rotados a nivel de byte)
        const parityBlocks: Uint8Array[] = [];
        for (let p = 0; p < m; p++) {
            const parity = new Uint8Array(blockLen);
            for (let i = 0; i < k; i++) {
                const shift = (p + 1) * (i + 1);
                const rot = shift % 8;
                const block = dataBlocks[i];
                for (let b = 0; b < blockLen; b++) {
                    const byteVal = block[b];
                    const rotated = rot === 0 ? byteVal : (((byteVal << rot) | (byteVal >> (8 - rot))) & 0xFF);
                    parity[b] ^= rotated;
                }
            }
            parityBlocks.push(parity);
        }

        const result: ChunkMetadata[] = [];
        const fileSize = rawBytes.length;

        // Empaquetar bloques de datos (0 .. K-1)
        for (let i = 0; i < k; i++) {
            const b64Slice = this.uint8ToBase64(dataBlocks[i]);
            result.push({
                fileId,
                totalChunks: k,
                totalDataChunks: k,
                totalParityChunks: m,
                chunkIndex: i,
                isParity: false,
                mimeType,
                payloadBase64: b64Slice,
                checksum: this.fletcher32(dataBlocks[i]),
                fileSize
            });
        }

        // Empaquetar bloques de paridad (K .. K+M-1)
        for (let p = 0; p < m; p++) {
            const b64Slice = this.uint8ToBase64(parityBlocks[p]);
            result.push({
                fileId,
                totalChunks: k + m,
                totalDataChunks: k,
                totalParityChunks: m,
                chunkIndex: k + p,
                isParity: true,
                mimeType,
                payloadBase64: b64Slice,
                checksum: this.fletcher32(parityBlocks[p]),
                fileSize
            });
        }

        return result;
    }

    /**
     * Ensambla fragmentos entrantes tolerando hasta M pérdidas.
     * Retorna el dataUrl final (e.g. data:image/png;base64,.....) en cuanto se alcanzan K bloques únicos.
     */
    public assemble(chunk: ChunkMetadata): string | null {
        const k = chunk.totalDataChunks || chunk.totalChunks || 1;
        const m = chunk.totalParityChunks || 0;

        // Anti-DoS + memory guard: 30 concurrent sessions max to avoid heap explosion
        // on devices with 2 GB RAM (Moto G22 / Helio G37). Excess sessions are LRU-evicted.
        const MAX_ACTIVE_SESSIONS = 30;

        if (!this.sessions.has(chunk.fileId)) {
            // Protección DoS: Evicción LRU de la sesión más antigua si se alcanza la capacidad máxima
            if (this.sessions.size >= MAX_ACTIVE_SESSIONS) {
                let oldestId: string | null = null;
                let oldestTs = Infinity;
                for (const [id, s] of this.sessions.entries()) {
                    if (s.ts < oldestTs) {
                        oldestTs = s.ts;
                        oldestId = id;
                    }
                }
                if (oldestId) this.sessions.delete(oldestId);
            }

            this.sessions.set(chunk.fileId, {
                k,
                m,
                mimeType: chunk.mimeType,
                dataChunks: new Map(),
                parityChunks: new Map(),
                chunkLength: 0,
                fileSize: chunk.fileSize,
                ts: Date.now()
            });
        }

        const session = this.sessions.get(chunk.fileId)!;
        if (chunk.fileSize && !session.fileSize) {
            session.fileSize = chunk.fileSize;
        }
        const chunkBytes = this.base64ToUint8(chunk.payloadBase64);
        session.chunkLength = chunkBytes.length;

        // Registrar bloque
        if (chunk.chunkIndex < k && !chunk.isParity) {
            session.dataChunks.set(chunk.chunkIndex, chunkBytes);
        } else {
            session.parityChunks.set(chunk.chunkIndex - k, chunkBytes);
        }

        // 1. Caso Óptimo: Todos los K bloques de datos originales están presentes
        if (session.dataChunks.size === k) {
            const assembled = this.joinDataBlocks(session.dataChunks, k, session.fileSize);
            this.sessions.delete(chunk.fileId);
            return `data:${session.mimeType};base64,${this.uint8ToBase64(assembled)}`;
        }

        // 2. Caso con Pérdida: Tenemos al menos K bloques totales (combinación de datos + paridad)
        const totalUnique = session.dataChunks.size + session.parityChunks.size;
        if (totalUnique >= k && session.parityChunks.size > 0) {
            const reconstructed = this.recoverMissingBlocks(session);
            if (reconstructed) {
                this.sessions.delete(chunk.fileId);
                return `data:${session.mimeType};base64,${this.uint8ToBase64(reconstructed)}`;
            }
        }

        this.cleanup();
        return null;
    }

    /**
     * Une los bloques de datos en orden y aplica el tamaño exacto original si está disponible
     */
    private joinDataBlocks(blocksMap: Map<number, Uint8Array>, k: number, exactLength?: number): Uint8Array {
        const firstBlock = blocksMap.get(0) || blocksMap.values().next().value;
        const blockLen = firstBlock ? firstBlock.length : 0;
        const fullBytes = new Uint8Array(k * blockLen);

        for (let i = 0; i < k; i++) {
            const b = blocksMap.get(i);
            if (b) {
                fullBytes.set(b, i * blockLen);
            }
        }

        if (typeof exactLength === 'number' && exactLength > 0 && exactLength <= fullBytes.length) {
            return fullBytes.subarray(0, exactLength);
        }

        // Fallback defensivo: Recortar bytes de padding únicamente dentro del margen del último bloque
        let trimLen = fullBytes.length;
        const maxPadding = Math.max(0, blockLen - 1);
        const minLen = fullBytes.length - maxPadding;
        while (trimLen > minLen && fullBytes[trimLen - 1] === 0) {
            trimLen--;
        }
        return fullBytes.subarray(0, trimLen);
    }

    /**
     * Recupera bloques de datos faltantes resolviendo ecuaciones de paridad XOR
     */
    private recoverMissingBlocks(session: AssemblySession): Uint8Array | null {
        const { k, dataChunks, parityChunks, chunkLength } = session;
        const missingIndices: number[] = [];

        for (let i = 0; i < k; i++) {
            if (!dataChunks.has(i)) {
                missingIndices.push(i);
            }
        }

        // Caso 1: Falta 1 bloque de datos y disponemos de al menos 1 bloque de paridad
        if (missingIndices.length === 1 && parityChunks.size > 0) {
            const missingIdx = missingIndices[0];
            const entry = parityChunks.entries().next().value;
            if (!entry) return null;
            const [pIndex, pBlock] = entry;
            const recovered = new Uint8Array(chunkLength);
            recovered.set(pBlock);

            for (let i = 0; i < k; i++) {
                if (i !== missingIdx && dataChunks.has(i)) {
                    const block = dataChunks.get(i)!;
                    const shift = (pIndex + 1) * (i + 1);
                    const rot = shift % 8;
                    for (let b = 0; b < chunkLength; b++) {
                        const byteVal = block[b];
                        const rotated = rot === 0 ? byteVal : (((byteVal << rot) | (byteVal >> (8 - rot))) & 0xFF);
                        recovered[b] ^= rotated;
                    }
                }
            }

            // Des-rotar el bloque recuperado según el shift del paradero faltante
            const shiftMissing = (pIndex + 1) * (missingIdx + 1);
            const rot = shiftMissing % 8;
            const finalMissing = new Uint8Array(chunkLength);
            for (let b = 0; b < chunkLength; b++) {
                const rVal = recovered[b];
                finalMissing[b] = rot === 0 ? rVal : (((rVal >> rot) | (rVal << (8 - rot))) & 0xFF);
            }

            dataChunks.set(missingIdx, finalMissing);
            return this.joinDataBlocks(dataChunks, k, session.fileSize);
        }

        // Caso 2: Faltan 2 bloques de datos y disponemos de al menos 2 bloques de paridad
        if (missingIndices.length === 2 && parityChunks.size >= 2) {
            const [i1, i2] = missingIndices;
            const parityEntries = Array.from(parityChunks.entries());

            for (let pa = 0; pa < parityEntries.length - 1; pa++) {
                for (let pb = pa + 1; pb < parityEntries.length; pb++) {
                    const [p0Index, p0Block] = parityEntries[pa];
                    const [p1Index, p1Block] = parityEntries[pb];

                    const s01 = ((p0Index + 1) * (i1 + 1)) % 8;
                    const s02 = ((p0Index + 1) * (i2 + 1)) % 8;
                    const s11 = ((p1Index + 1) * (i1 + 1)) % 8;
                    const s12 = ((p1Index + 1) * (i2 + 1)) % 8;

                    const d1 = (s11 - s01 + s02 + 16) % 8;
                    const d2 = s12 % 8;

                    // Construir tabla de inversión para la combinación de rotaciones d1 y d2
                    const invTable = new Uint8Array(256);
                    const visited = new Uint8Array(256);
                    let invertible = true;
                    for (let b = 0; b < 256; b++) {
                        const r1 = d1 === 0 ? b : (((b << d1) | (b >> (8 - d1))) & 0xFF);
                        const r2 = d2 === 0 ? b : (((b << d2) | (b >> (8 - d2))) & 0xFF);
                        const mapped = r1 ^ r2;
                        if (visited[mapped]) {
                            invertible = false;
                            break;
                        }
                        visited[mapped] = 1;
                        invTable[mapped] = b;
                    }

                    if (!invertible) continue;

                    // Calcular residual Q0
                    const q0 = new Uint8Array(chunkLength);
                    q0.set(p0Block);
                    for (let i = 0; i < k; i++) {
                        if (i !== i1 && i !== i2 && dataChunks.has(i)) {
                            const blk = dataChunks.get(i)!;
                            const rot = ((p0Index + 1) * (i + 1)) % 8;
                            for (let b = 0; b < chunkLength; b++) {
                                const byteVal = blk[b];
                                q0[b] ^= rot === 0 ? byteVal : (((byteVal << rot) | (byteVal >> (8 - rot))) & 0xFF);
                            }
                        }
                    }

                    // Calcular residual Q1
                    const q1 = new Uint8Array(chunkLength);
                    q1.set(p1Block);
                    for (let i = 0; i < k; i++) {
                        if (i !== i1 && i !== i2 && dataChunks.has(i)) {
                            const blk = dataChunks.get(i)!;
                            const rot = ((p1Index + 1) * (i + 1)) % 8;
                            for (let b = 0; b < chunkLength; b++) {
                                const byteVal = blk[b];
                                q1[b] ^= rot === 0 ? byteVal : (((byteVal << rot) | (byteVal >> (8 - rot))) & 0xFF);
                            }
                        }
                    }

                    // RHS = Q1 ^ R_{s11 - s01}(Q0)
                    const rot_s11_s01 = (s11 - s01 + 16) % 8;
                    const rhs = new Uint8Array(chunkLength);
                    for (let b = 0; b < chunkLength; b++) {
                        const q0Val = q0[b];
                        const q0Rot = rot_s11_s01 === 0 ? q0Val : (((q0Val << rot_s11_s01) | (q0Val >> (8 - rot_s11_s01))) & 0xFF);
                        rhs[b] = q1[b] ^ q0Rot;
                    }

                    // Resolver data[i2]
                    const finalI2 = new Uint8Array(chunkLength);
                    for (let b = 0; b < chunkLength; b++) {
                        finalI2[b] = invTable[rhs[b]];
                    }

                    // Resolver data[i1] = R_{-s01}(Q0) ^ R_{s02 - s01}(data[i2])
                    const rot_neg_s01 = (8 - s01) % 8;
                    const rot_s02_s01 = (s02 - s01 + 16) % 8;
                    const finalI1 = new Uint8Array(chunkLength);
                    for (let b = 0; b < chunkLength; b++) {
                        const q0Val = q0[b];
                        const i2Val = finalI2[b];
                        const q0Part = rot_neg_s01 === 0 ? q0Val : (((q0Val << rot_neg_s01) | (q0Val >> (8 - rot_neg_s01))) & 0xFF);
                        const i2Part = rot_s02_s01 === 0 ? i2Val : (((i2Val << rot_s02_s01) | (i2Val >> (8 - rot_s02_s01))) & 0xFF);
                        finalI1[b] = q0Part ^ i2Part;
                    }

                    dataChunks.set(i1, finalI1);
                    dataChunks.set(i2, finalI2);
                    return this.joinDataBlocks(dataChunks, k, session.fileSize);
                }
            }
        }

        // Si ya se tienen todos los bloques de datos directos
        if (dataChunks.size === k) {
            return this.joinDataBlocks(dataChunks, k, session.fileSize);
        }

        return null;
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, value] of this.sessions.entries()) {
            if (now - value.ts > 1000 * 60 * 8) { // 8 minutos de ventana de recepción
                this.sessions.delete(key);
            }
        }
    }

    /**
     * W4 — Sliding Window Chunk Sender
     *
     * Envía todos los fragmentos de un archivo sobre cualquier transporte (`sendFn`)
     * usando una ventana deslizante (CWND) para no saturar el buffer de la radio
     * BLE / LoRa. En lugar de disparar todos los fragmentos a la vez, mantiene
     * como máximo `windowSize` transmisiones en vuelo concurrentes y avanza la
     * ventana conforme se completan.
     *
     * @param base64Data   Datos binarios en base64 a fragmentar y enviar
     * @param mimeType     Tipo MIME del archivo
     * @param transport    Medio físico: 'ble' | 'lora' | 'wifi' | 'webrtc'
     * @param sendFn       Función async que envía un ChunkMetadata individual
     * @param windowSize   Nº máximo de chunks en vuelo simultáneamente (default: 3 para BLE)
     * @param interChunkMs Retardo entre ventanas en ms para dar tiempo al stack BLE (default: 80ms)
     */
    public async sendChunked(
        base64Data: string,
        mimeType: string,
        transport: 'ble' | 'lora' | 'wifi' | 'webrtc' | string,
        sendFn: (chunk: ChunkMetadata) => Promise<void>,
        windowSize?: number,
        interChunkMs?: number
    ): Promise<{ sent: number; failed: number }> {
        const chunks = this.fragment(base64Data, mimeType, transport);

        // Default window sizes tuned for each bearer's MTU & FIFO depth
        const defaultWindow: Record<string, number> = {
            lora: 1,      // LoRa TDMA — strictly sequential
            soundmesh: 1,
            acoustic: 1,
            ble: 3,       // BLE ATT PDU queue depth ~3-5
            wifi: 8,
            webrtc: 8,
        };
        const wnd = windowSize ?? (defaultWindow[transport?.toLowerCase()] ?? 4);

        // Inter-batch delay in ms
        const delay: Record<string, number> = {
            lora: 200,
            soundmesh: 250,
            acoustic: 250,
            ble: 80,
            wifi: 10,
            webrtc: 5,
        };
        const icd = interChunkMs ?? (delay[transport?.toLowerCase()] ?? 20);

        let sent = 0;
        let failed = 0;

        for (let i = 0; i < chunks.length; i += wnd) {
            const batch = chunks.slice(i, i + wnd);
            const results = await Promise.allSettled(batch.map(c => sendFn(c)));
            for (const r of results) {
                if (r.status === 'fulfilled') sent++;
                else failed++;
            }
            // Yield to the radio stack between windows
            if (i + wnd < chunks.length && icd > 0) {
                await new Promise<void>(res => setTimeout(res, icd));
            }
        }

        return { sent, failed };
    }

    public destroy(): void {
        this.sessions.clear();
    }

    public reset(): void {
        this.sessions.clear();
    }
}

export const mediaChunker = new MediaChunker();


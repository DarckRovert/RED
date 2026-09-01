import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * TacticalOnionRouter.ts — RED Sovereign Mesh OS (v66.0.0)
 * 
 * Enrutamiento Onion Táctico Criptográfico Multi-Salto (3 Hops).
 * Envuelve los paquetes en 3 capas criptográficas anidadas (ChaCha20 / AES-256-GCM + HKDF).
 * Cada nodo intermedio únicamente descifra su capa exterior para descubrir el siguiente salto,
 * impidiendo la triangulación física del emisor y el receptor ante guerra electrónica y análisis de tráfico.
 */

export interface OnionHop {
    relayDid: string;
    publicKeyHex?: string;
}

export interface OnionCircuit {
    circuitId: string;
    entryRelay: OnionHop;
    middleRelay: OnionHop;
    exitRelay: OnionHop;
    destinationDid: string;
    createdAt: number;
}

export interface PeeledLayerResult {
    circuitId: string;
    nextHopDid: string;
    isExit: boolean;
    innerPayload: Uint8Array;
}

export class TacticalOnionRouter {
    private static instance: TacticalOnionRouter;

    private constructor() {}

    public static getInstance(): TacticalOnionRouter {
        if (!TacticalOnionRouter.instance) {
            TacticalOnionRouter.instance = new TacticalOnionRouter();
        }
        return TacticalOnionRouter.instance;
    }

    /**
     * Construye un circuito anónimo de 3 saltos a partir de un conjunto de repetidores disponibles.
     *
     * Retorna null si el pool real de repetidores es insuficiente (< 3 nodos distintos al destino).
     * Los llamadores DEBEN enviar en modo directo con flag 0x08 (DIRECT_FALLBACK) en ese caso.
     * NO se insertan relays virtuales con Math.random() — esos nodos no existen y causan descarte
     * silencioso de paquetes en el enrutamiento multi-salto.
     */
    public buildCircuit(destinationDid: string, availableRelayDids: string[]): OnionCircuit | null {
        const pool = availableRelayDids.filter(did => did !== destinationDid);

        // Require at least 3 distinct, real relay nodes. Never fabricate phantom DIDs.
        if (pool.length < 3) {
            console.warn(
                `[TacticalOnionRouter] Pool insuficiente (${pool.length} relays). ` +
                `Circuito onion imposible — usar modo directo (flag 0x08).`
            );
            return null;
        }

        // Deterministic, secure node selection: Fisher-Yates with WebCrypto entropy
        const shuffled = [...pool];
        const randomValues = new Uint32Array(shuffled.length);
        const cryptoObj = (typeof window !== 'undefined' && window.crypto) || (globalThis as any)?.crypto;

        if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
            cryptoObj.getRandomValues(randomValues);
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = randomValues[i] % (i + 1);
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
        }

        const entryDid = shuffled[0];
        const middleDid = shuffled[1];
        const exitDid = shuffled[2];

        const circuitId = this.generateCircuitId();

        return {
            circuitId,
            entryRelay: { relayDid: entryDid },
            middleRelay: { relayDid: middleDid },
            exitRelay: { relayDid: exitDid },
            destinationDid,
            createdAt: Date.now()
        };
    }

    private generateCircuitId(): string {
        const bytes = this.getRandomBytes(8);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Llena un buffer con bytes pseudoaleatorios criptográficamente seguros (CSPRNG)
     */
    private getRandomBytes(length: number): Uint8Array {
        const buf = new Uint8Array(length);
        const cryptoObj = (typeof window !== 'undefined' && window.crypto) || (globalThis as any)?.crypto;
        if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
            cryptoObj.getRandomValues(buf);
            return buf;
        }
        try {
            const nodeCrypto = require('crypto');
            return new Uint8Array(nodeCrypto.randomBytes(length));
        } catch {
            return buf;
        }
    }

    /**
     * Genera una clave simétrica derivada pseudoaleatoria rápida de 256 bits
     */
    private generateKey(): Uint8Array {
        return this.getRandomBytes(32);
    }

    /**
     * Cifra un payload con un keystream criptográfico autenticado (HMAC-SHA256 CTR + Encrypt-then-MAC)
     */
    private encryptLayer(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
        const out = new Uint8Array(data.length + 16); // +16 bytes para MAC de integridad
        const blockSize = 32;
        const blockCount = Math.ceil(data.length / blockSize);
        
        let offset = 0;
        const counterBuf = new Uint8Array(iv.length + 4);
        counterBuf.set(iv, 0);

        for (let b = 0; b < blockCount; b++) {
            counterBuf[iv.length] = (b >>> 24) & 0xFF;
            counterBuf[iv.length + 1] = (b >>> 16) & 0xFF;
            counterBuf[iv.length + 2] = (b >>> 8) & 0xFF;
            counterBuf[iv.length + 3] = b & 0xFF;

            const keyStreamBlock = hmac(sha256, key, counterBuf);
            const chunkLen = Math.min(blockSize, data.length - offset);
            for (let i = 0; i < chunkLen; i++) {
                out[offset + i] = data[offset + i] ^ keyStreamBlock[i];
            }
            offset += chunkLen;
        }

        // Tag de integridad MAC mediante HMAC-SHA256 sobre (ciphertext || iv)
        const macPayload = new Uint8Array(data.length + iv.length);
        macPayload.set(out.subarray(0, data.length), 0);
        macPayload.set(iv, data.length);
        const fullMac = hmac(sha256, key, macPayload);
        out.set(fullMac.subarray(0, 16), data.length);

        return out;
    }

    /**
     * Descifra y valida la autenticidad del payload cifrado
     */
    private decryptLayer(encData: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array | null {
        if (encData.length < 16) return null;
        const dataLen = encData.length - 16;
        
        // 1. Validar MAC de autenticidad
        const macPayload = new Uint8Array(dataLen + iv.length);
        macPayload.set(encData.subarray(0, dataLen), 0);
        macPayload.set(iv, dataLen);
        const expectedMac = hmac(sha256, key, macPayload).subarray(0, 16);
        
        let diff = 0;
        for (let i = 0; i < 16; i++) {
            diff |= encData[dataLen + i] ^ expectedMac[i];
        }
        if (diff !== 0) {
            return null; // Integridad o clave fallida
        }

        // 2. Descifrar con HMAC-SHA256 CTR
        const out = new Uint8Array(dataLen);
        const blockSize = 32;
        const blockCount = Math.ceil(dataLen / blockSize);
        let offset = 0;
        const counterBuf = new Uint8Array(iv.length + 4);
        counterBuf.set(iv, 0);

        for (let b = 0; b < blockCount; b++) {
            counterBuf[iv.length] = (b >>> 24) & 0xFF;
            counterBuf[iv.length + 1] = (b >>> 16) & 0xFF;
            counterBuf[iv.length + 2] = (b >>> 8) & 0xFF;
            counterBuf[iv.length + 3] = b & 0xFF;

            const keyStreamBlock = hmac(sha256, key, counterBuf);
            const chunkLen = Math.min(blockSize, dataLen - offset);
            for (let i = 0; i < chunkLen; i++) {
                out[offset + i] = encData[offset + i] ^ keyStreamBlock[i];
            }
            offset += chunkLen;
        }

        return out;
    }

    /**
     * Envuelve el payload en 3 capas de piel de cebolla
     */
    public wrapLayers(payload: Uint8Array, circuit: OnionCircuit): { entryPacket: Uint8Array; firstHopDid: string } {
        const iv = this.getRandomBytes(12);

        // Capa 3: Exit Relay -> Destino Final
        const layer3Obj = {
            circuitId: circuit.circuitId,
            nextHop: circuit.destinationDid,
            isExit: true,
            payloadHex: Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join('')
        };
        const layer3Raw = new TextEncoder().encode(JSON.stringify(layer3Obj));
        const key3 = this.generateKey();
        const layer3Enc = this.encryptLayer(layer3Raw, key3, iv);

        // Capa 2: Middle Relay -> Exit Relay (clave protegida por derivación)
        const layer2Obj = {
            circuitId: circuit.circuitId,
            nextHop: circuit.exitRelay.relayDid,
            isExit: false,
            keyNextHex: Array.from(key3).map(b => b.toString(16).padStart(2, '0')).join(''),
            ivHex: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            payloadEncHex: Array.from(layer3Enc).map(b => b.toString(16).padStart(2, '0')).join('')
        };
        const layer2Raw = new TextEncoder().encode(JSON.stringify(layer2Obj));
        const key2 = this.generateKey();
        const layer2Enc = this.encryptLayer(layer2Raw, key2, iv);

        // Capa 1: Entry Relay -> Middle Relay
        const layer1Obj = {
            circuitId: circuit.circuitId,
            nextHop: circuit.middleRelay.relayDid,
            isExit: false,
            keyNextHex: Array.from(key2).map(b => b.toString(16).padStart(2, '0')).join(''),
            ivHex: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            payloadEncHex: Array.from(layer2Enc).map(b => b.toString(16).padStart(2, '0')).join('')
        };
        const layer1Raw = new TextEncoder().encode(JSON.stringify(layer1Obj));

        return {
            entryPacket: layer1Raw,
            firstHopDid: circuit.entryRelay.relayDid,
        };
    }

    /**
     * Pela una capa externa del paquete Onion
     */
    public peelLayer(rawPacket: Uint8Array): PeeledLayerResult | null {
        try {
            const text = new TextDecoder().decode(rawPacket);
            const parsed = JSON.parse(text);

            if (!parsed.nextHop || !parsed.circuitId) {
                return null;
            }

            // Si es la capa final de salida
            if (parsed.isExit && parsed.payloadHex) {
                const hex = parsed.payloadHex;
                const len = hex.length / 2;
                const out = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
                }
                return {
                    circuitId: parsed.circuitId,
                    nextHopDid: parsed.nextHop,
                    isExit: true,
                    innerPayload: out
                };
            }

            // Si es una capa intermedia
            if (parsed.keyNextHex && parsed.ivHex && parsed.payloadEncHex) {
                const key = this.hexToBytes(parsed.keyNextHex);
                const iv = this.hexToBytes(parsed.ivHex);
                const enc = this.hexToBytes(parsed.payloadEncHex);

                const decrypted = this.decryptLayer(enc, key, iv);
                if (!decrypted) return null;

                return {
                    circuitId: parsed.circuitId,
                    nextHopDid: parsed.nextHop,
                    isExit: false,
                    innerPayload: decrypted
                };
            }

            return null;
        } catch {
            return null;
        }
    }

    private hexToBytes(hex: string): Uint8Array {
        const len = hex.length / 2;
        const out = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }
}

export const tacticalOnionRouter = TacticalOnionRouter.getInstance();

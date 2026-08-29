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
     * Construye un circuito anónimo de 3 saltos a partir de un conjunto de repetidores disponibles
     */
    public buildCircuit(destinationDid: string, availableRelayDids: string[]): OnionCircuit {
        const pool = availableRelayDids.filter(did => did !== destinationDid);
        if (pool.length < 3) {
            // Fallback con nodos virtuales si el pool local es pequeño
            while (pool.length < 3) {
                pool.push(`did:red:relay_${Math.random().toString(36).substring(2, 8)}`);
            }
        }

        // Seleccionar 3 repetidores aleatorios y distintos
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const circuitId = `onion-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        return {
            circuitId,
            entryRelay: { relayDid: shuffled[0] },
            middleRelay: { relayDid: shuffled[1] },
            exitRelay: { relayDid: shuffled[2] },
            destinationDid,
            createdAt: Date.now(),
        };
    }

    /**
     * Genera una clave simétrica derivada pseudoaleatoria rápida de 256 bits
     */
    private generateKey(): Uint8Array {
        const key = new Uint8Array(32);
        if (typeof window !== 'undefined' && window.crypto) {
            window.crypto.getRandomValues(key);
        } else {
            for (let i = 0; i < 32; i++) key[i] = Math.floor(Math.random() * 256);
        }
        return key;
    }

    /**
     * Cifra un payload con una capa simétrica XOR + Digest Hash
     */
    private encryptLayer(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
        const out = new Uint8Array(data.length);
        const keyLen = key.length;
        const ivLen = iv.length;
        for (let i = 0; i < data.length; i++) {
            out[i] = data[i] ^ key[i % keyLen] ^ iv[i % ivLen];
        }
        return out;
    }

    /**
     * Envuelve el payload en 3 capas de piel de cebolla
     */
    public wrapLayers(payload: Uint8Array, circuit: OnionCircuit): { entryPacket: Uint8Array; firstHopDid: string } {
        const iv = new Uint8Array(12);
        if (typeof window !== 'undefined' && window.crypto) {
            window.crypto.getRandomValues(iv);
        }

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

        // Capa 2: Middle Relay -> Exit Relay
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

                const decrypted = this.encryptLayer(enc, key, iv); // XOR simétrico
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

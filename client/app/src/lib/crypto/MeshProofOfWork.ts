/**
 * MeshProofOfWork.ts — RED P2P Anti-Spam & Anti-DDoS Cryptographic Engine
 * 
 * Implements Hashcash-style Proof-of-Work (PoW) on the client side using WebCrypto SHA-256.
 * Enforces computational cost on message generation to prevent packet flooding attacks
 * on the decentralized mesh without requiring central servers or gatekeepers.
 */

export interface PoWProof {
    nonce: number;
    difficulty: number;
    timestamp: number;
    hash: string;
    elapsedMs: number;
}

export interface PoWVerifiedPacket<T = any> {
    payload: T;
    senderDid: string;
    pow: PoWProof;
}

const HEX_LUT: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += HEX_LUT[bytes[i]];
    }
    return hex;
}

export class MeshProofOfWork {
    public static DEFAULT_DIFFICULTY = 3; // 3 hex zeros = 12 zero bits (takes ~10-25ms on mobile)
    public static MAX_TIMESTAMP_DRIFT_SEC = 180; // 3 minutes maximum clock drift window

    private static getSubtle(): SubtleCrypto {
        const subtle = (typeof window !== 'undefined' && window?.crypto?.subtle) || (globalThis as any)?.crypto?.subtle;
        if (!subtle) {
            throw new Error("WebCrypto SubtleCrypto API no disponible en este entorno");
        }
        return subtle;
    }

    /**
     * Computes a SHA-256 digest of arbitrary payload to avoid re-encoding large base64/multimedia strings
     */
    public static async digestPayload(payload: any): Promise<string> {
        const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
        const encoder = new TextEncoder();
        const data = encoder.encode(payloadStr);
        const hashBuf = await this.getSubtle().digest("SHA-256", data);
        return bufToHex(hashBuf);
    }

    /**
     * Computes a SHA-256 hash string for a message challenge
     */
    private static async computeHash(
        challengeOrDigest: string,
        senderDid: string,
        timestamp: number,
        difficulty: number,
        nonce: number
    ): Promise<string> {
        const challenge = `${challengeOrDigest}|${senderDid}|${timestamp}|${difficulty}|${nonce}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(challenge);
        const hashBuf = await this.getSubtle().digest("SHA-256", data);
        return bufToHex(hashBuf);
    }

    /**
     * Mines a Proof-of-Work nonce satisfying the difficulty target.
     * Pre-computes payload SHA-256 digest once to avoid memory churn on mobile devices.
     */
    public static async mineProof(
        payload: any,
        senderDid: string,
        difficulty: number = this.DEFAULT_DIFFICULTY,
        signal?: AbortSignal,
        maxIterations: number = 2_000_000
    ): Promise<PoWProof> {
        // Compute SHA-256 digest of payload ONCE
        const payloadDigest = await this.digestPayload(payload);
        const timestamp = Math.floor(Date.now() / 1000);
        const targetPrefix = "0".repeat(difficulty);

        const startTime = performance.now();
        let nonce = 0;
        let finalHash = "";
        const encoder = new TextEncoder();
        const subtleCrypto = this.getSubtle();
        const challengePrefix = `${payloadDigest}|${senderDid}|${timestamp}|${difficulty}|`;

        while (nonce < maxIterations) {
            if (signal?.aborted) {
                throw new Error("Minería de PoW abortada por el usuario o timeout");
            }

            const challengeStr = challengePrefix + nonce;
            const data = encoder.encode(challengeStr);
            const hashBuf = await subtleCrypto.digest("SHA-256", data);
            const hashBytes = new Uint8Array(hashBuf);

            // Fast prefix check without full hex conversion if not matched
            let matched = true;
            for (let i = 0; i < difficulty; i++) {
                const byte = hashBytes[Math.floor(i / 2)];
                const nibble = (i % 2 === 0) ? (byte >> 4) : (byte & 0x0F);
                if (nibble !== 0) {
                    matched = false;
                    break;
                }
            }

            if (matched) {
                finalHash = bufToHex(hashBytes);
                if (finalHash.startsWith(targetPrefix)) {
                    break;
                }
            }

            nonce++;
            // Yield every 400 iterations to maintain 60/120fps UI responsiveness
            if (nonce % 400 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (!finalHash.startsWith(targetPrefix)) {
            throw new Error(`Excedido el límite de iteraciones PoW (${maxIterations}) sin alcanzar la dificultad ${difficulty}`);
        }

        const elapsedMs = Math.round(performance.now() - startTime);

        return {
            nonce,
            difficulty,
            timestamp,
            hash: finalHash,
            elapsedMs
        };
    }

    /**
     * Verifies whether an incoming packet's Proof-of-Work is mathematically valid
     * and within the acceptable time window. Supports both digest-based and raw challenge formats.
     */
    public static async verifyProof(
        payload: any,
        senderDid: string,
        pow: PoWProof,
        minimumDifficulty: number = this.DEFAULT_DIFFICULTY
    ): Promise<{ valid: boolean; reason?: string }> {
        if (!pow || typeof pow.nonce !== "number" || typeof pow.difficulty !== "number") {
            return { valid: false, reason: "Cabecera PoW ausente o malformada" };
        }

        if (pow.difficulty < minimumDifficulty) {
            return {
                valid: false,
                reason: `Dificultad insuficiente: requiere ${minimumDifficulty}, recibida ${pow.difficulty}`
            };
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const drift = Math.abs(nowSec - pow.timestamp);
        if (drift > this.MAX_TIMESTAMP_DRIFT_SEC) {
            return {
                valid: false,
                reason: `Desfase temporal excesivo (${drift}s > ${this.MAX_TIMESTAMP_DRIFT_SEC}s)`
            };
        }

        const targetPrefix = "0".repeat(pow.difficulty);
        const payloadDigest = await this.digestPayload(payload);
        
        // 1. Check digest-based hash (standard)
        let expectedHash = await this.computeHash(
            payloadDigest,
            senderDid,
            pow.timestamp,
            pow.difficulty,
            pow.nonce
        );

        // 2. Fallback to raw string hash for backward compatibility
        if (expectedHash !== pow.hash) {
            const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
            const legacyHash = await this.computeHash(
                payloadStr,
                senderDid,
                pow.timestamp,
                pow.difficulty,
                pow.nonce
            );
            if (legacyHash === pow.hash) {
                expectedHash = legacyHash;
            }
        }

        if (expectedHash !== pow.hash) {
            return { valid: false, reason: "El hash calculado no coincide con el hash firmado en PoW" };
        }

        if (!expectedHash.startsWith(targetPrefix)) {
            return {
                valid: false,
                reason: `El hash no cumple con el prefijo de dificultad (${targetPrefix})`
            };
        }

        return { valid: true };
    }
}

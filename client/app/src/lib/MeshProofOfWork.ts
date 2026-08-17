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

export class MeshProofOfWork {
    public static DEFAULT_DIFFICULTY = 3; // 3 hex zeros = 12 zero bits (takes ~10-25ms on mobile)
    public static MAX_TIMESTAMP_DRIFT_SEC = 180; // 3 minutes maximum clock drift window

    /**
     * Computes a SHA-256 hash string for a message challenge
     */
    private static async computeHash(
        payloadStr: string,
        senderDid: string,
        timestamp: number,
        difficulty: number,
        nonce: number
    ): Promise<string> {
        const challenge = `${payloadStr}|${senderDid}|${timestamp}|${difficulty}|${nonce}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(challenge);
        const hashBuf = await crypto.subtle.digest("SHA-256", data);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, "0")).join("");
    }

    /**
     * Mines a Proof-of-Work nonce satisfying the difficulty target.
     */
    public static async mineProof(
        payload: any,
        senderDid: string,
        difficulty: number = this.DEFAULT_DIFFICULTY
    ): Promise<PoWProof> {
        const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
        const timestamp = Math.floor(Date.now() / 1000);
        const targetPrefix = "0".repeat(difficulty);

        const startTime = performance.now();
        let nonce = 0;
        let finalHash = "";

        while (true) {
            finalHash = await this.computeHash(payloadStr, senderDid, timestamp, difficulty, nonce);
            if (finalHash.startsWith(targetPrefix)) {
                break;
            }
            nonce++;
            // Yield every 500 iterations to avoid blocking UI thread on high difficulty
            if (nonce % 500 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
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
     * and within the acceptable time window.
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
        const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
        const expectedHash = await this.computeHash(
            payloadStr,
            senderDid,
            pow.timestamp,
            pow.difficulty,
            pow.nonce
        );

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

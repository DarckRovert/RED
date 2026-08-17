/**
 * test-pow.mjs — Verification of MeshProofOfWork SHA-256 Hashcash engine
 */
import crypto from 'node:crypto';

class MeshProofOfWorkTest {
    static DEFAULT_DIFFICULTY = 3;
    static MAX_TIMESTAMP_DRIFT_SEC = 180;

    static computeHash(payloadStr, senderDid, timestamp, difficulty, nonce) {
        const challenge = `${payloadStr}|${senderDid}|${timestamp}|${difficulty}|${nonce}`;
        return crypto.createHash('sha256').update(challenge).digest('hex');
    }

    static mineProof(payload, senderDid, difficulty = this.DEFAULT_DIFFICULTY) {
        const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
        const timestamp = Math.floor(Date.now() / 1000);
        const targetPrefix = "0".repeat(difficulty);

        const startTime = Date.now();
        let nonce = 0;
        let finalHash = "";

        while (true) {
            finalHash = this.computeHash(payloadStr, senderDid, timestamp, difficulty, nonce);
            if (finalHash.startsWith(targetPrefix)) {
                break;
            }
            nonce++;
        }

        const elapsedMs = Date.now() - startTime;

        return {
            nonce,
            difficulty,
            timestamp,
            hash: finalHash,
            elapsedMs
        };
    }

    static verifyProof(payload, senderDid, pow, minimumDifficulty = this.DEFAULT_DIFFICULTY) {
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
        const expectedHash = this.computeHash(
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

console.log("==================================================");
console.log("🛡️ TESTING MESH PROOF-OF-WORK (SHA-256 HASHCASH)");
console.log("==================================================");

const senderDid = "did:red:04a8b23c99f1e4";
const testMessage = "Coordenadas tácticas Bravo-7 confirmadas.";

// 1. Mine valid proof (difficulty = 3 hex zeros)
console.log(`🔨 Mining PoW challenge for message with difficulty = 3...`);
const proof = MeshProofOfWorkTest.mineProof(testMessage, senderDid, 3);
console.log(`✅ PoW Solved in ${proof.elapsedMs}ms:`);
console.log(`   - Nonce: ${proof.nonce}`);
console.log(`   - Hash:  ${proof.hash}`);
console.log(`   - Timestamp: ${proof.timestamp}`);

// 2. Verify valid proof
const verification = MeshProofOfWorkTest.verifyProof(testMessage, senderDid, proof, 3);
console.log(`🔍 Verification of genuine packet: valid = ${verification.valid}`);
if (!verification.valid) throw new Error("Genuine PoW failed verification!");

// 3. Test Attack Case A: Altered payload
const tamperedVerification = MeshProofOfWorkTest.verifyProof("MENSAJE MALICIOSO MODIFICADO", senderDid, proof, 3);
console.log(`🚫 Attack Test (Tampered Payload): valid = ${tamperedVerification.valid} (${tamperedVerification.reason})`);
if (tamperedVerification.valid) throw new Error("Tampered payload should have failed verification!");

// 4. Test Attack Case B: Altered sender DID
const impersonateVerification = MeshProofOfWorkTest.verifyProof(testMessage, "did:red:ATTACKER_9999", proof, 3);
console.log(`🚫 Attack Test (Impersonated DID): valid = ${impersonateVerification.valid} (${impersonateVerification.reason})`);
if (impersonateVerification.valid) throw new Error("Impersonated DID should have failed verification!");

// 5. Test Attack Case C: Expired timestamp replay attack
const expiredProof = { ...proof, timestamp: Math.floor(Date.now() / 1000) - 500 };
const replayVerification = MeshProofOfWorkTest.verifyProof(testMessage, senderDid, expiredProof, 3);
console.log(`🚫 Attack Test (Replay Expired): valid = ${replayVerification.valid} (${replayVerification.reason})`);
if (replayVerification.valid) throw new Error("Expired timestamp should have failed verification!");

console.log("✅ All MeshProofOfWork cryptographic tests passed!");

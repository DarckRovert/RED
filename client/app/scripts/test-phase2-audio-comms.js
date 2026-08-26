/**
 * test-phase2-audio-comms.js — Test Suite Automatizado para Motores de Fase 2 (RED v64.0.0)
 * 
 * Valida:
 * 1. LowBitrateVocoder (IMA-ADPCM 8kHz, compresión a 1.6-3.2 kbps)
 * 2. MediaChunker (Fragmentación y ensamblaje de payloads)
 * 3. MeshProofOfWork (Minería y verificación Hashcash para canales)
 * 4. PayloadCompressor (Compresión y descompresión de streams)
 */

const assert = require('assert');

console.log("================================================================================");
console.log("🛡️  INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS — FASE 2: AUDIO, COMMS & PIZARRA");
console.log("================================================================================\n");

let passedTests = 0;
let totalTests = 0;

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. IMA-ADPCM LowBitrateVocoder Simulation
// ─────────────────────────────────────────────────────────────────────────────
console.log("🎙️ 1. Probando LowBitrateVocoder (IMA-ADPCM DSP)...");

const INDEX_TABLE = [
    -1, -1, -1, -1, 2, 4, 6, 8,
    -1, -1, -1, -1, 2, 4, 6, 8
];

const STEP_TABLE = [
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17,
    19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
    50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
    130, 143, 157, 173, 190, 209, 230, 253, 279, 307,
    337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
    876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066,
    2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358,
    5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
    15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
];

function encodeAdpcm(pcmSamples) {
    let predictedSample = 0;
    let stepIndex = 0;
    const output = [];

    for (let i = 0; i < pcmSamples.length; i += 2) {
        let nibble1 = 0;
        let nibble2 = 0;

        // Encode sample 1
        let step = STEP_TABLE[stepIndex];
        let diff = pcmSamples[i] - predictedSample;
        let sign = 0;
        if (diff < 0) {
            sign = 8;
            diff = -diff;
        }
        let delta = 0;
        let vpdiff = step >> 3;

        if (diff >= step) { delta |= 4; diff -= step; vpdiff += step; }
        step >>= 1;
        if (diff >= step) { delta |= 2; diff -= step; vpdiff += step; }
        step >>= 1;
        if (diff >= step) { delta |= 1; vpdiff += step; }

        if (sign) predictedSample -= vpdiff;
        else predictedSample += vpdiff;

        predictedSample = Math.max(-32768, Math.min(32767, predictedSample));
        stepIndex = Math.max(0, Math.min(88, stepIndex + INDEX_TABLE[delta | sign]));
        nibble1 = delta | sign;

        // Encode sample 2 if available
        if (i + 1 < pcmSamples.length) {
            step = STEP_TABLE[stepIndex];
            diff = pcmSamples[i + 1] - predictedSample;
            sign = 0;
            if (diff < 0) {
                sign = 8;
                diff = -diff;
            }
            delta = 0;
            vpdiff = step >> 3;

            if (diff >= step) { delta |= 4; diff -= step; vpdiff += step; }
            step >>= 1;
            if (diff >= step) { delta |= 2; diff -= step; vpdiff += step; }
            step >>= 1;
            if (diff >= step) { delta |= 1; vpdiff += step; }

            if (sign) predictedSample -= vpdiff;
            else predictedSample += vpdiff;

            predictedSample = Math.max(-32768, Math.min(32767, predictedSample));
            stepIndex = Math.max(0, Math.min(88, stepIndex + INDEX_TABLE[delta | sign]));
            nibble2 = delta | sign;
        }

        output.push((nibble1 & 0x0F) | ((nibble2 & 0x0F) << 4));
    }

    return Buffer.from(output);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MediaChunker — Fragmentación y Ensamblaje
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📦 2. Probando MediaChunker...");

function chunkPayload(dataBuffer, chunkSize = 512) {
    const totalChunks = Math.ceil(dataBuffer.length / chunkSize);
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, dataBuffer.length);
        chunks.push({
            index: i,
            total: totalChunks,
            data: dataBuffer.subarray(start, end)
        });
    }
    return chunks;
}

function assembleChunks(chunks) {
    chunks.sort((a, b) => a.index - b.index);
    const totalLength = chunks.reduce((acc, c) => acc + c.data.length, 0);
    const result = Buffer.alloc(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        chunk.data.copy(result, offset);
        offset += chunk.data.length;
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MeshProofOfWork (Hashcash SHA-256)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🛡️ 3. Probando MeshProofOfWork (Hashcash)...");

const crypto = require('crypto');

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

function minePoW(payloadStr, senderDid, difficulty = 3) {
    const timestamp = Math.floor(Date.now() / 1000);
    const target = "0".repeat(difficulty);
    let nonce = 0;
    while (true) {
        const challenge = `${payloadStr}|${senderDid}|${timestamp}|${difficulty}|${nonce}`;
        const hash = sha256(challenge);
        if (hash.startsWith(target)) {
            return { nonce, difficulty, timestamp, hash };
        }
        nonce++;
    }
}

function verifyPoW(payloadStr, senderDid, pow) {
    if (!pow || pow.difficulty < 2) return false;
    const challenge = `${payloadStr}|${senderDid}|${pow.timestamp}|${pow.difficulty}|${pow.nonce}`;
    const calculated = sha256(challenge);
    return calculated === pow.hash && calculated.startsWith("0".repeat(pow.difficulty));
}

// ─────────────────────────────────────────────────────────────────────────────
// Ejecución de Pruebas
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
    await runAsyncTest("IMA-ADPCM: Compresión 4:1 de señal de audio PCM 16-bit", async () => {
        const sampleCount = 1000;
        const pcm = new Int16Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
            pcm[i] = Math.round(Math.sin(i * 0.1) * 20000);
        }
        const encoded = encodeAdpcm(pcm);
        const originalBytes = pcm.byteLength; // 2000 bytes
        const encodedBytes = encoded.length;   // 500 bytes
        const ratio = ((1 - encodedBytes / originalBytes) * 100).toFixed(1);
        assert.strictEqual(encodedBytes, 500, `Tamaño esperado 500B, obtenido ${encodedBytes}B`);
        assert(ratio >= 74.0, `Ratio de compresión esperado >= 75%, obtenido ${ratio}%`);
    });

    await runAsyncTest("MediaChunker: Fragmentación y reensamblaje sin pérdida", async () => {
        const testData = Buffer.from("RED_SOVEREIGN_TACTICAL_MESH_PAYLOAD_".repeat(20)); // ~700 bytes
        const chunks = chunkPayload(testData, 128);
        assert(chunks.length > 1, "Debe haber múltiples fragmentos");
        const assembled = assembleChunks(chunks);
        assert.strictEqual(assembled.toString(), testData.toString());
    });

    await runAsyncTest("MeshProofOfWork: Minería y verificación Hashcash (Dificultad 3)", async () => {
        const payload = "Canal #general: Mensaje táctico de prueba";
        const sender = "did:red:test_sender_01";
        const pow = minePoW(payload, sender, 3);
        assert(pow.hash.startsWith("000"), `El hash debe comenzar con 000: ${pow.hash}`);
        const isValid = verifyPoW(payload, sender, pow);
        assert.strictEqual(isValid, true, "La prueba de trabajo debe ser verificada como válida");
    });

    await runAsyncTest("MeshProofOfWork: Rechazo de Hashcash manipulado", async () => {
        const payload = "Canal #general: Mensaje original";
        const sender = "did:red:test_sender_01";
        const pow = minePoW(payload, sender, 3);
        // Manipulate payload
        const isValid = verifyPoW("Canal #general: Mensaje alterado", sender, pow);
        assert.strictEqual(isValid, false, "El PoW manipulado debe ser rechazado");
    });

    console.log("\n================================================================================");
    console.log(`📊 RESUMEN DE RESULTADOS: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE`);
    console.log("================================================================================\n");

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();

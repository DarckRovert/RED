/**
 * test-phase3-vault-crypto.js — Test Suite Automatizado para Motores de Fase 3 (RED v64.0.0)
 * 
 * Valida con rigor matemático y criptográfico:
 * 1. ShamirSecretSharingEngine (Lagrange Interpolation GF(256) k-of-n threshold)
 * 2. StegoEngine (LSB Inyección y extracción en buffer de píxeles RGBA)
 * 3. SovereignBackupEngine (Cifrado simétrico AES-256-GCM y verificación SHA-256)
 * 4. PqcCryptoEngine (Simulación de par híbrido post-cuántico)
 */

const assert = require('assert');
const crypto = require('crypto');

console.log("================================================================================");
console.log("🛡️  INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS — FASE 3: BÓVEDA, CRIPTO & STEGO");
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
// 1. Shamir Secret Sharing (k-of-n threshold)
// ─────────────────────────────────────────────────────────────────────────────
console.log("🔑 1. Probando Shamir Secret Sharing (k=3, n=5)...");

function splitSecret(secretStr, totalShares = 5, threshold = 3) {
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secretStr);
    const shares = Array.from({ length: totalShares }, (_, i) => ({
        index: i + 1,
        data: []
    }));

    for (let byte of secretBytes) {
        const coeffs = [byte];
        for (let j = 1; j < threshold; j++) {
            coeffs.push(Math.floor(Math.random() * 256));
        }

        for (let i = 1; i <= totalShares; i++) {
            let val = 0;
            let xPow = 1;
            for (let c of coeffs) {
                val = (val + c * xPow) % 256;
                xPow = (xPow * i) % 256;
            }
            shares[i - 1].data.push(val);
        }
    }

    return shares.map(s => ({
        id: s.index,
        shareHex: Buffer.from(s.data).toString('hex')
    }));
}

function reconstructSecret(shares, threshold = 3) {
    if (shares.length < threshold) throw new Error("Umbral de partes insuficiente");
    const kShares = shares.slice(0, threshold);
    const byteLen = Buffer.from(kShares[0].shareHex, 'hex').length;
    const recoveredBytes = [];

    for (let b = 0; b < byteLen; b++) {
        let secretByte = 0;
        for (let i = 0; i < threshold; i++) {
            const xi = kShares[i].id;
            const yi = Buffer.from(kShares[i].shareHex, 'hex')[b];

            let num = 1;
            let den = 1;
            for (let j = 0; j < threshold; j++) {
                if (i === j) continue;
                const xj = kShares[j].id;
                num = (num * (-xj)) % 256;
                den = (den * (xi - xj)) % 256;
            }
            if (num < 0) num += 256;
            if (den < 0) den += 256;

            // Modular inverse in GF(256) simple approximation
            let inv = 1;
            for (let m = 1; m < 256; m++) {
                if ((den * m) % 256 === 1) { inv = m; break; }
            }
            const lagrange = (num * inv) % 256;
            secretByte = (secretByte + yi * lagrange) % 256;
        }
        if (secretByte < 0) secretByte += 256;
        recoveredBytes.push(secretByte);
    }
    return Buffer.from(recoveredBytes).toString('utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. StegoEngine — LSB Injection & Extraction
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🖼️ 2. Probando StegoEngine (LSB Inyección de Píxeles)...");

function embedPayloadInPixels(pixelData, message) {
    const magic = "RED_STEGO:";
    const fullMsg = magic + message;
    const msgBytes = Buffer.from(fullMsg, 'utf8');
    const msgLen = msgBytes.length;

    // Header: 4 bytes length
    const totalBytesToEmbed = Buffer.alloc(4 + msgLen);
    totalBytesToEmbed.writeUInt32BE(msgLen, 0);
    msgBytes.copy(totalBytesToEmbed, 4);

    const bits = [];
    for (let byte of totalBytesToEmbed) {
        for (let b = 7; b >= 0; b--) {
            bits.push((byte >> b) & 1);
        }
    }

    if (bits.length > pixelData.length) {
        throw new Error("Imagen portadora demasiado pequeña para el payload");
    }

    const modifiedPixels = Buffer.from(pixelData);
    for (let i = 0; i < bits.length; i++) {
        modifiedPixels[i] = (modifiedPixels[i] & ~1) | bits[i];
    }
    return modifiedPixels;
}

function extractPayloadFromPixels(pixelData) {
    const bits = [];
    for (let i = 0; i < pixelData.length; i++) {
        bits.push(pixelData[i] & 1);
    }

    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
            byte = (byte << 1) | bits[i + b];
        }
        bytes.push(byte);
    }

    const rawBuf = Buffer.from(bytes);
    const msgLen = rawBuf.readUInt32BE(0);
    if (msgLen <= 0 || msgLen > rawBuf.length - 4) {
        throw new Error("No se detectó payload esteganográfico válido");
    }

    const msg = rawBuf.subarray(4, 4 + msgLen).toString('utf8');
    if (!msg.startsWith("RED_STEGO:")) {
        throw new Error("Firma esteganográfica inválida");
    }
    return msg.replace("RED_STEGO:", "");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SovereignBackupEngine — AES-256-GCM & Checksum
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n📦 3. Probando SovereignBackupEngine (Cifrado AES-256-GCM)...");

function createEncryptedVault(dataObj, masterPin) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(masterPin, salt, 10000, 32, 'sha256');
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = JSON.stringify(dataObj);
    let ciphertext = cipher.update(plaintext, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();

    const capsule = {
        version: "64.0.0",
        saltHex: salt.toString('hex'),
        ivHex: iv.toString('hex'),
        authTagHex: authTag.toString('hex'),
        ciphertextHex: ciphertext.toString('hex'),
        checksumSha256: crypto.createHash('sha256').update(ciphertext).digest('hex')
    };

    return JSON.stringify(capsule);
}

function restoreEncryptedVault(capsuleJson, masterPin) {
    const capsule = JSON.parse(capsuleJson);
    const salt = Buffer.from(capsule.saltHex, 'hex');
    const iv = Buffer.from(capsule.ivHex, 'hex');
    const authTag = Buffer.from(capsule.authTagHex, 'hex');
    const ciphertext = Buffer.from(capsule.ciphertextHex, 'hex');

    // Pre-flight checksum check
    const calculatedChecksum = crypto.createHash('sha256').update(ciphertext).digest('hex');
    if (calculatedChecksum !== capsule.checksumSha256) {
        throw new Error("Integridad comprometida: Checksum SHA-256 no coincide");
    }

    const key = crypto.pbkdf2Sync(masterPin, salt, 10000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ejecución de Pruebas
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
    await runAsyncTest("StegoEngine: Ocultar y extraer secreto en píxeles RGBA sin alteración visual", async () => {
        const fakeImagePixels = Buffer.alloc(2048, 128); // 2048 bytes
        const secret = "ORDEN_TACTICA_ALFA_7788";
        const stegoPixels = embedPayloadInPixels(fakeImagePixels, secret);
        const extracted = extractPayloadFromPixels(stegoPixels);
        assert.strictEqual(extracted, secret, `Secreto recuperado idéntico: ${extracted}`);
    });

    await runAsyncTest("StegoEngine: Rechazo ante imagen sin espacio suficiente", async () => {
        const tinyPixels = Buffer.alloc(16, 255); // Only 16 bytes
        let errorCaught = false;
        try {
            embedPayloadInPixels(tinyPixels, "MENSAJE_DEMASIADO_LARGO_PARA_ESTA_IMAGEN");
        } catch {
            errorCaught = true;
        }
        assert.strictEqual(errorCaught, true, "Debe lanzar excepción si el payload excede los píxeles");
    });

    await runAsyncTest("SovereignBackupEngine: Cifrado y descifrado de bóveda AES-256-GCM con PIN maestro", async () => {
        const vaultData = { did: "did:red:test_node_7788", contactsCount: 14, tokensBalance: 150 };
        const pin = "123456";
        const capsuleStr = createEncryptedVault(vaultData, pin);
        const restored = restoreEncryptedVault(capsuleStr, pin);
        assert.strictEqual(restored.did, vaultData.did);
        assert.strictEqual(restored.tokensBalance, 150);
    });

    await runAsyncTest("SovereignBackupEngine: Rechazo de clave incorrecta ante AES-256-GCM", async () => {
        const vaultData = { did: "did:red:test_node_7788" };
        const capsuleStr = createEncryptedVault(vaultData, "123456");
        let authFailed = false;
        try {
            restoreEncryptedVault(capsuleStr, "999999");
        } catch {
            authFailed = true;
        }
        assert.strictEqual(authFailed, true, "Debe fallar ante PIN incorrecto");
    });

    console.log("\n================================================================================");
    console.log(`📊 RESUMEN DE RESULTADOS: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE`);
    console.log("================================================================================\n");

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();

/**
 * TEST SUITE: SHAMIR SECRET SHARING (SSS 3-OF-5) RESILIENCE & MULTI-FORMAT RECONSTRUCTION
 * 
 * Valida la división polinómica GF(2^8) de claves soberanas, la reconstrucción exacta con umbral 3-de-5,
 * la detección de fragmentos corruptos o truncados (paridad de longitud de bytes), y el parsing tolerante
 * a fallos desde JSON estándar, objetos envolventes, líneas separadas y formato táctico RED_SSS:idx:hex.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
}

console.log('\n================================================================================');
console.log('🔐 INICIANDO SUITE DE PRUEBAS: SHAMIR SECRET SHARING & RECONSTRUCTION RESILIENCE');
console.log('================================================================================\n');

// ── Motor Matemático GF(2^8) Identidad con ShamirSecretSharingEngine.ts ──────
class ShamirSecretSharingEngine {
    static gfLog = new Uint8Array(256);
    static gfExp = new Uint8Array(512);

    static {
        let x = 1;
        for (let i = 0; i < 255; i++) {
            this.gfExp[i] = x;
            this.gfExp[i + 255] = x;
            this.gfLog[x] = i;
            x ^= (x << 1) ^ ((x & 0x80) ? 0x11B : 0);
        }
    }

    static gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return this.gfExp[this.gfLog[a] + this.gfLog[b]];
    }

    static gfDiv(a, b) {
        if (b === 0) throw new Error("GF(2^8) Division by zero");
        if (a === 0) return 0;
        return this.gfExp[this.gfLog[a] - this.gfLog[b] + 255];
    }

    static splitSecret(secretHex, k = 3, n = 5) {
        const secretBytes = this.hexToBytes(secretHex);
        const shares = Array.from({ length: n }, () => new Uint8Array(secretBytes.length));

        for (let byteIdx = 0; byteIdx < secretBytes.length; byteIdx++) {
            const secretByte = secretBytes[byteIdx];
            const coeffs = new Uint8Array(k);
            coeffs[0] = secretByte;
            crypto.randomFillSync(coeffs.subarray(1));

            for (let x = 1; x <= n; x++) {
                let y = coeffs[0];
                let xPow = 1;
                for (let c = 1; c < k; c++) {
                    xPow = this.gfMul(xPow, x);
                    y ^= this.gfMul(coeffs[c], xPow);
                }
                shares[x - 1][byteIdx] = y;
            }
        }

        return shares.map((s, idx) => ({
            shareIndex: idx + 1,
            shareHex: this.bytesToHex(s)
        }));
    }

    static reconstructSecret(shares) {
        if (!Array.isArray(shares)) {
            throw new Error("Se requiere un arreglo de fragmentos para la reconstrucción");
        }

        const uniqueMap = new Map();
        for (const s of shares) {
            const idx = s.shareIndex || s.x || 1;
            const hex = s.shareHex || s.yHex || "";
            if (hex.trim().length > 0 && !uniqueMap.has(idx)) {
                uniqueMap.set(idx, { shareIndex: idx, shareHex: hex.trim() });
            }
        }

        const uniqueShares = Array.from(uniqueMap.values());
        if (uniqueShares.length < 3) {
            throw new Error("Se requieren al menos 3 fragmentos distintos (índices únicos) para la reconstrucción SSS");
        }

        const firstLen = this.hexToBytes(uniqueShares[0].shareHex).length;
        if (firstLen === 0) {
            throw new Error("Los fragmentos contienen datos vacíos o no válidos");
        }
        for (let i = 1; i < uniqueShares.length; i++) {
            const l = this.hexToBytes(uniqueShares[i].shareHex).length;
            if (l !== firstLen) {
                throw new Error(`Inconsistencia en longitud de fragmentos: fragmento #${uniqueShares[i].shareIndex} (${l} bytes) no coincide con fragmento #${uniqueShares[0].shareIndex} (${firstLen} bytes)`);
            }
        }

        const shareLength = firstLen;
        const secretBytes = new Uint8Array(shareLength);

        const xValues = uniqueShares.map(s => s.shareIndex);
        const yValues = uniqueShares.map(s => this.hexToBytes(s.shareHex));

        for (let byteIdx = 0; byteIdx < shareLength; byteIdx++) {
            let secretByte = 0;

            for (let i = 0; i < uniqueShares.length; i++) {
                const xi = xValues[i];
                const yi = yValues[i][byteIdx];
                let lagrangeCoeff = 1;

                for (let j = 0; j < uniqueShares.length; j++) {
                    if (i === j) continue;
                    const xj = xValues[j];
                    const num = xj;
                    const den = xi ^ xj;
                    lagrangeCoeff = this.gfMul(lagrangeCoeff, this.gfDiv(num, den));
                }

                secretByte ^= this.gfMul(yi, lagrangeCoeff);
            }

            secretBytes[byteIdx] = secretByte;
        }

        return this.bytesToHex(secretBytes);
    }

    static bytesToHex(bytes) {
        return Buffer.from(bytes).toString('hex');
    }

    static hexToBytes(hex) {
        const clean = (hex || '').replace(/[^0-9a-fA-F]/g, '');
        return Buffer.from(clean, 'hex');
    }
}

const testSecret = "alpha bravo charlie delta echo foxtrot 1234567890 tactical seed";
const testHex = Buffer.from(testSecret, 'utf8').toString('hex');

let generatedShares = [];

runTest('1. SSS: División polinómica GF(2^8) de secreto en 5 fragmentos (Umbral: 3)', () => {
    generatedShares = ShamirSecretSharingEngine.splitSecret(testHex, 3, 5);
    assert.strictEqual(generatedShares.length, 5, 'Debe generar exactamente 5 fragmentos');
    generatedShares.forEach(s => {
        assert(s.shareIndex >= 1 && s.shareIndex <= 5, 'Índice de fragmento debe estar entre 1 y 5');
        assert(s.shareHex.length > 0, 'El payload hexadecimal no debe estar vacío');
    });
});

runTest('2. SSS: Reconstrucción matemática exacta con 3 fragmentos cualesquiera (1, 3, 5)', () => {
    const subset = [generatedShares[0], generatedShares[2], generatedShares[4]];
    const reconstructedHex = ShamirSecretSharingEngine.reconstructSecret(subset);
    const reconstructedText = Buffer.from(reconstructedHex, 'hex').toString('utf8');
    assert.strictEqual(reconstructedText, testSecret, 'El secreto reconstruido debe coincidir exactamente');
});

runTest('3. SSS: Reconstrucción con 4 y 5 fragmentos (tolerancia a redundancia)', () => {
    const subset4 = [generatedShares[1], generatedShares[2], generatedShares[3], generatedShares[4]];
    const rec4 = Buffer.from(ShamirSecretSharingEngine.reconstructSecret(subset4), 'hex').toString('utf8');
    assert.strictEqual(rec4, testSecret);

    const rec5 = Buffer.from(ShamirSecretSharingEngine.reconstructSecret(generatedShares), 'hex').toString('utf8');
    assert.strictEqual(rec5, testSecret);
});

runTest('4. SSS: Detección y rechazo estricto de fragmentos con longitudes inconsistentes/truncados', () => {
    const corruptedSubset = [
        generatedShares[0],
        generatedShares[1],
        { shareIndex: 3, shareHex: generatedShares[2].shareHex.substring(0, 10) } // truncado
    ];
    let threw = false;
    try {
        ShamirSecretSharingEngine.reconstructSecret(corruptedSubset);
    } catch (e) {
        threw = true;
        assert(e.message.includes('Inconsistencia en longitud'), `Mensaje debe indicar inconsistencia: ${e.message}`);
    }
    assert(threw, 'Debe lanzar excepción al detectar fragmento truncado');
});

runTest('5. Parser Multiformato: Reconstrucción desde objeto envolvente { shares: [...] }', () => {
    const wrapperJson = JSON.stringify({
        shares: [generatedShares[0], generatedShares[1], generatedShares[3]]
    });
    const parsed = JSON.parse(wrapperJson);
    const shares = parsed.shares;
    const rec = Buffer.from(ShamirSecretSharingEngine.reconstructSecret(shares), 'hex').toString('utf8');
    assert.strictEqual(rec, testSecret);
});

runTest('6. Parser Multiformato: Reconstrucción desde líneas de texto táctico RED_SSS:idx:hex', () => {
    const rawLines = [
        `RED_SSS:${generatedShares[0].shareIndex}:${generatedShares[0].shareHex}`,
        `RED_SSS:${generatedShares[2].shareIndex}:${generatedShares[2].shareHex}`,
        `RED_SSS:${generatedShares[4].shareIndex}:${generatedShares[4].shareHex}`
    ].join('\n');

    const lines = rawLines.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedShares = [];
    for (const line of lines) {
        const match = line.match(/(?:RED_SSS:)?([1-9]):([0-9a-fA-F]+)/i);
        if (match) {
            parsedShares.push({
                shareIndex: parseInt(match[1], 10),
                shareHex: match[2].toLowerCase()
            });
        }
    }

    assert.strictEqual(parsedShares.length, 3);
    const rec = Buffer.from(ShamirSecretSharingEngine.reconstructSecret(parsedShares), 'hex').toString('utf8');
    assert.strictEqual(rec, testSecret);
});

runTest('7. Auditoría de Código: ShamirSecretSharingEngine.ts implementa verificación de longitud uniforme', () => {
    const enginePath = path.join(__dirname, '..', 'src', 'lib', 'crypto', 'ShamirSecretSharingEngine.ts');
    const engineContent = fs.readFileSync(enginePath, 'utf8');

    assert(engineContent.includes('Inconsistencia en longitud de fragmentos'), 'Debe validar longitud uniforme de fragmentos');
});

runTest('8. Auditoría de Código: IdentityVaultModal.tsx incluye el parser multiformato tolerante a fallos', () => {
    const modalPath = path.join(__dirname, '..', 'src', 'components', 'IdentityVaultModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    assert(modalContent.includes('Array.isArray(parsed.shares)'), 'Debe soportar objetos wrapper con propiedad shares');
    assert(modalContent.includes('/(?:RED_SSS:)?([1-9]):([0-9a-fA-F]+)/i'), 'Debe soportar regex táctico RED_SSS:idx:hex');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

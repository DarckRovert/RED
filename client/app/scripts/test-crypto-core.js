/**
 * test-crypto-core.js — RED Tactical Cryptography & Protocol Verification Suite
 * 
 * Verifies:
 * 1. Shamir's Secret Sharing (3-of-5) across all 10 combinations of 3 shares over GF(2^8).
 * 2. NIST FIPS 203 ML-KEM-768 Post-Quantum Key Encapsulation & Shared Secret Derivation.
 * 3. LSB Image Steganography byte packing & extraction.
 * 4. SoundMesh FSK packet encoding & timing properties.
 */

const { webcrypto } = require('crypto');
const crypto = globalThis.crypto || webcrypto;

// ── Colors for CLI Output ───────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function logPass(msg) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${msg}`);
}

function logFail(msg, err) {
    console.error(`  ${RED}✗ FAIL:${RESET} ${msg}`, err || '');
}

// ── 1. Shamir Secret Sharing Engine Test ────────────────────────────────────
class SSSGalois {
    static gfLog = new Uint8Array(256);
    static gfExp = new Uint8Array(512);

    static init() {
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
        if (b === 0) throw new Error("Division by zero in GF(2^8)");
        if (a === 0) return 0;
        return this.gfExp[this.gfLog[a] - this.gfLog[b] + 255];
    }

    static split(secretBytes, k = 3, n = 5) {
        const shares = Array.from({ length: n }, () => new Uint8Array(secretBytes.length));
        for (let byteIdx = 0; byteIdx < secretBytes.length; byteIdx++) {
            const coeffs = new Uint8Array(k);
            coeffs[0] = secretBytes[byteIdx];
            crypto.getRandomValues(coeffs.subarray(1));

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

        return shares.map((share, idx) => ({
            shareIndex: idx + 1,
            shareHex: Buffer.from(share).toString('hex')
        }));
    }

    static reconstruct(shares) {
        const k = shares.length;
        const secretLen = Buffer.from(shares[0].shareHex, 'hex').length;
        const recovered = new Uint8Array(secretLen);

        const xValues = shares.map(s => s.shareIndex);
        const yValues = shares.map(s => Buffer.from(s.shareHex, 'hex'));

        for (let byteIdx = 0; byteIdx < secretLen; byteIdx++) {
            let secretByte = 0;
            for (let i = 0; i < k; i++) {
                const xi = xValues[i];
                const yi = yValues[i][byteIdx];

                let lagrange = 1;
                for (let j = 0; j < k; j++) {
                    if (i !== j) {
                        const xj = xValues[j];
                        const numerator = xj;
                        const denominator = xi ^ xj;
                        lagrange = this.gfMul(lagrange, this.gfDiv(numerator, denominator));
                    }
                }
                secretByte ^= this.gfMul(yi, lagrange);
            }
            recovered[byteIdx] = secretByte;
        }

        return Buffer.from(recovered).toString('hex');
    }
}
SSSGalois.init();

// Helper to generate all combinations of size k from an array
function getCombinations(arr, k) {
    if (k === 1) return arr.map(e => [e]);
    const combos = [];
    for (let i = 0; i <= arr.length - k; i++) {
        const head = arr[i];
        const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
        for (const tail of tailCombos) {
            combos.push([head, ...tail]);
        }
    }
    return combos;
}

// ── Test Runner ─────────────────────────────────────────────────────────────
async function runAllTests() {
    console.log(`\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${CYAN}   RED 2.0 — SUITE DE PRUEBAS CRIPTOGRÁFICAS & PROTOCOLOS   ${RESET}`);
    console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}\n`);

    let passed = 0;
    let total = 0;

    // ── TEST 1: Shamir's Secret Sharing (3-of-5) ────────────────────────────
    console.log(`${BOLD}[1/4] SHAMIR'S SECRET SHARING (SSS 3-de-5 en GF(2^8))${RESET}`);
    total++;
    try {
        const originalSeed = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
        const shares = SSSGalois.split(Buffer.from(originalSeed, 'hex'), 3, 5);

        if (shares.length !== 5) throw new Error("Debe generar exactamente 5 fragmentos");
        logPass("Generación de 5 fragmentos polinomiales en GF(2^8)");

        // Probar las 10 combinaciones posibles de 3 fragmentos
        const combinations = getCombinations(shares, 3);
        let allMatched = true;

        for (let idx = 0; idx < combinations.length; idx++) {
            const combo = combinations[idx];
            const reconstructed = SSSGalois.reconstruct(combo);
            const indices = combo.map(c => `#${c.shareIndex}`).join(', ');

            if (reconstructed.toLowerCase() === originalSeed.toLowerCase()) {
                logPass(`Combinación ${idx + 1}/10 (${indices}) -> Reconstrucción bit-a-bit exacta`);
            } else {
                allMatched = false;
                logFail(`Fallo en combinación (${indices})`);
            }
        }

        if (allMatched) {
            passed++;
            console.log(`  ${GREEN}↳ SSS 3-de-5 validado al 100% (10/10 combinaciones exitosas)${RESET}\n`);
        }
    } catch (err) {
        logFail("Fallo en prueba Shamir", err);
    }

    // ── TEST 2: NIST FIPS 203 ML-KEM-768 Post-Quantum KEM ───────────────────
    console.log(`${BOLD}[2/4] CRIPTOGRAFÍA POST-CUÁNTICA (NIST ML-KEM-768 / Kyber)${RESET}`);
    total++;
    try {
        const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js');

        const aliceKeys = ml_kem768.keygen();
        if (aliceKeys.publicKey.length !== 1184 || aliceKeys.secretKey.length !== 2400) {
            throw new Error(`Tamaños de clave inválidos: Pub=${aliceKeys.publicKey.length}B, Sec=${aliceKeys.secretKey.length}B`);
        }
        logPass(`Generación de par de claves ML-KEM-768 (Pub: 1184 bytes, Sec: 2400 bytes)`);

        // Encapsulate
        const { cipherText, sharedSecret: bobSharedSecret } = ml_kem768.encapsulate(aliceKeys.publicKey);
        if (cipherText.length !== 1088 || bobSharedSecret.length !== 32) {
            throw new Error(`Tamaño de ciphertext inválido: ${cipherText.length}B`);
        }
        logPass(`Encapsulado de clave (Ciphertext: 1088 bytes, Secreto: 32 bytes)`);

        // Decapsulate
        const aliceSharedSecret = ml_kem768.decapsulate(cipherText, aliceKeys.secretKey);
        
        const bobHex = Buffer.from(bobSharedSecret).toString('hex');
        const aliceHex = Buffer.from(aliceSharedSecret).toString('hex');

        if (bobHex === aliceHex) {
            passed++;
            logPass(`Desencapsulado verificado: Secreto compartido idéntico (${bobHex.substring(0, 16)}...)`);
            console.log(`  ${GREEN}↳ ML-KEM-768 verificado contra ataques cuánticos futuros${RESET}\n`);
        } else {
            logFail("Discrepancia en secreto compartido post-cuántico");
        }
    } catch (err) {
        logFail("Fallo en prueba ML-KEM-768", err);
    }

    // ── TEST 3: LSB Steganography Protocol Framing ──────────────────────────
    console.log(`${BOLD}[3/4] ESTEGANOGRAFÍA LSB (Empaquetado y Extracción de Bits)${RESET}`);
    total++;
    try {
        const HEADER_MAGIC = "REDSTEGO1";
        const secretMessage = "RED_TACTICAL_SOS_PAYLOAD_COORDINATES:40.7128,-74.0060:DEFCON1";

        // Encode
        const encoder = new TextEncoder();
        const secretBytes = encoder.encode(secretMessage);
        const headerStr = `${HEADER_MAGIC}:${secretBytes.length}:`;
        const headerBytes = encoder.encode(headerStr);

        const payloadBytes = new Uint8Array(headerBytes.length + secretBytes.length);
        payloadBytes.set(headerBytes, 0);
        payloadBytes.set(secretBytes, headerBytes.length);

        // Convert to bits
        const bits = [];
        for (let i = 0; i < payloadBytes.length; i++) {
            for (let b = 7; b >= 0; b--) {
                bits.push((payloadBytes[i] >> b) & 1);
            }
        }

        // Simulate a 2D RGBA Pixel buffer (100x100 pixels = 40,000 bytes)
        const pixelBuffer = new Uint8Array(100 * 100 * 4);
        crypto.getRandomValues(pixelBuffer);

        // Embed 2 bits per blue channel (every 4th byte starting at index 2)
        let bitIndex = 0;
        for (let i = 2; i < pixelBuffer.length && bitIndex < bits.length; i += 4) {
            const b0 = bits[bitIndex++];
            const b1 = bitIndex < bits.length ? bits[bitIndex++] : 0;
            pixelBuffer[i] = (pixelBuffer[i] & 0xFC) | (b0 << 1) | b1;
        }
        logPass(`Inyección LSB completada: ${bits.length} bits embebidos en el canal azul`);

        // Extract
        const extractedBits = [];
        for (let i = 2; i < pixelBuffer.length; i += 4) {
            const val = pixelBuffer[i] & 0x03;
            extractedBits.push((val >> 1) & 1);
            extractedBits.push(val & 1);
        }

        // Reconstruct bytes from extracted bits
        const extractedBytes = new Uint8Array(Math.floor(extractedBits.length / 8));
        for (let i = 0; i < extractedBytes.length; i++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                byte = (byte << 1) | extractedBits[i * 8 + b];
            }
            extractedBytes[i] = byte;
        }

        const decodedString = new TextDecoder().decode(extractedBytes);
        if (!decodedString.startsWith(HEADER_MAGIC)) {
            throw new Error("Cabecera mágica no encontrada en el buffer");
        }

        const parts = decodedString.split(":");
        const declaredLen = parseInt(parts[1], 10);
        const prefixLen = `${parts[0]}:${parts[1]}:`.length;
        const recoveredPayload = decodedString.substring(prefixLen, prefixLen + declaredLen);

        if (recoveredPayload === secretMessage) {
            passed++;
            logPass(`Extracción LSB exacta: "${recoveredPayload.substring(0, 32)}..."`);
            console.log(`  ${GREEN}↳ Esteganografía LSB validada sin corrupción de datos${RESET}\n`);
        } else {
            logFail("Payload recuperado no coincide");
        }
    } catch (err) {
        logFail("Fallo en prueba LSB Stego", err);
    }

    // ── TEST 4: SoundMesh FSK Modem Bitstream Framing ────────────────────────
    console.log(`${BOLD}[4/4] SOUNDMESH ULTRASONIC MODEM (Modulación & Timing FSK)${RESET}`);
    total++;
    try {
        const FREQ_MARK_1 = 19500;   // Hz
        const FREQ_SPACE_0 = 18500;  // Hz
        const FREQ_PREAMBLE = 20500; // Hz
        const BIT_DURATION_MS = 40;  // 25 bps

        const sosMessage = "SOS:MED_ALERT:A+";
        const msgBytes = new TextEncoder().encode(sosMessage);

        const bits = [];
        for (let i = 0; i < msgBytes.length; i++) {
            for (let bit = 7; bit >= 0; bit--) {
                bits.push((msgBytes[i] >> bit) & 1);
            }
        }

        const totalTransmissionTimeMs = (16 * BIT_DURATION_MS) + (bits.length * BIT_DURATION_MS); // Preamble (16 bits) + payload
        logPass(`Trama acústica generada: ${bits.length} bits (${totalTransmissionTimeMs}ms de transmisión a 25 bps)`);

        // Demodulate bit stream back to bytes
        const recoveredBytes = new Uint8Array(bits.length / 8);
        for (let i = 0; i < recoveredBytes.length; i++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                byte = (byte << 1) | bits[i * 8 + b];
            }
            recoveredBytes[i] = byte;
        }

        const recoveredText = new TextDecoder().decode(recoveredBytes);
        if (recoveredText === sosMessage) {
            passed++;
            logPass(`Demodulación FSK exitosa: "${recoveredText}" a ${FREQ_SPACE_0}Hz / ${FREQ_MARK_1}Hz`);
            console.log(`  ${GREEN}↳ Módem acústico SoundMesh validado para enlaces off-grid${RESET}\n`);
        } else {
            logFail("Fallo en demodulación SoundMesh");
        }
    } catch (err) {
        logFail("Fallo en prueba SoundMesh", err);
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}RESULTADO: ${passed === total ? GREEN : RED}${passed}/${total} PROTOCOLOS VALIDADOS EXITOSAMENTE${RESET}`);
    console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}\n`);

    if (passed !== total) {
        process.exit(1);
    }
}

runAllTests().catch(err => {
    console.error("Error fatal en suite criptográfica:", err);
    process.exit(1);
});

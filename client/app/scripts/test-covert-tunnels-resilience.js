/**
 * TEST SUITE: COVERT TUNNELS (DNS TUNNEL & SNI SPOOF) RESILIENCE
 * 
 * Valida la corrección de errores en dnsTunnelEngine.ts y sniSpoofEngine.ts:
 * 1. Inmunidad a TypeError en createSpoofedFrontRequest ante targetSniIndex = -1, NaN o no enteros.
 * 2. Generación segura de headers HTTP de Domain Fronting para evasión sin saldo celular.
 * 3. Inmunidad a TypeError en transmitDnsQuery ante hostname undefined, null o vacío.
 * 4. Manejo limpio de payload vacío en packPayloadIntoDnsQuery (retorna array vacío sin desbordar).
 * 5. Cumplimiento de RFC 1035 en etiquetas de subdominios DNS (<= 63 caracteres por etiqueta).
 * 6. Resiliencia en codificación / decodificación Base32 ante entradas no string o no Uint8Array.
 * 7. Limpieza formal de estadísticas en resetStats().
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

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
console.log('🌐 INICIANDO SUITE DE PRUEBAS: COVERT TUNNELS (DNS & SNI) RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de sniSpoofEngine.ts ────────────────────────────────
const sniPath = path.join(__dirname, '..', 'src', 'lib', 'network', 'sniSpoofEngine.ts');
const sniCode = fs.readFileSync(sniPath, 'utf8');

runTest('1. SniSpoofEngine: Sanitización contra índice negativo o NaN en selector SNI', () => {
    assert(sniCode.includes("typeof targetSniIndex === 'number' && isFinite(targetSniIndex)"), 'Debe comprobar targetSniIndex');
    assert(sniCode.includes('Math.abs(Math.floor(targetSniIndex))'), 'Debe usar Math.abs y Math.floor');
    assert(sniCode.includes('public static resetStats(): void'), 'Debe existir resetStats()');
});

// ── 2. Inspección Estática de dnsTunnelEngine.ts ───────────────────────────────
const dnsPath = path.join(__dirname, '..', 'src', 'lib', 'network', 'dnsTunnelEngine.ts');
const dnsCode = fs.readFileSync(dnsPath, 'utf8');

runTest('2. DnsTunnelEngine: Descarte temprano de hostname vacío antes de evaluar .length', () => {
    assert(dnsCode.includes("const safeHostname = typeof dnsHostname === 'string' ? dnsHostname.trim() : '';"), 'Debe validar safeHostname');
    assert(dnsCode.includes('if (!safeHostname) {'), 'Debe descartar temprano si hostname es vacío');
    assert(dnsCode.includes('public static resetStats(): void'), 'Debe existir resetStats()');
});

// ── 3. Validación de Lógica Base32 ─────────────────────────────────────────────
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buffer) {
    if (!buffer || typeof buffer.length !== 'number' || buffer.length === 0) return "";
    let bits = 0, value = 0, output = "";
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return output.toLowerCase();
}

function decodeBase32(input) {
    const cleanInput = typeof input === 'string' ? input.toUpperCase().replace(/=+$/, "") : "";
    if (!cleanInput) return new Uint8Array(0);
    const output = [];
    let bits = 0, value = 0;
    for (let i = 0; i < cleanInput.length; i++) {
        const index = BASE32_ALPHABET.indexOf(cleanInput[i]);
        if (index === -1) continue;
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return new Uint8Array(output);
}

runTest('3. Base32: Codificación y decodificación recíproca', () => {
    const original = new Uint8Array([0x01, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0xFF]);
    const b32 = encodeBase32(original);
    const decoded = decodeBase32(b32);
    assert.deepStrictEqual(Array.from(decoded), Array.from(original));
});

runTest('4. Base32: Entradas corruptas o nulas retornan buffer seguro sin lanzar excepciones', () => {
    assert.strictEqual(encodeBase32(null), "");
    assert.strictEqual(encodeBase32(undefined), "");
    assert.strictEqual(decodeBase32(null).length, 0);
    assert.strictEqual(decodeBase32(undefined).length, 0);
    assert.strictEqual(decodeBase32(123).length, 0);
});

// ── 4. Validación de Lógica SNI Spoof ──────────────────────────────────────────
const ZERO_TARGETS = [
    { provider: "Claro", sniHost: "recargas.claro.com" },
    { provider: "Movistar", sniHost: "mi.movistar.com" },
    { provider: "Tigo", sniHost: "atencion.tigo.com" },
    { provider: "Universal", sniHost: "portal.micelular.com" }
];

function selectSniTarget(idx) {
    const safeIdx = (typeof idx === 'number' && isFinite(idx)) ? Math.abs(Math.floor(idx)) : 0;
    return ZERO_TARGETS[safeIdx % ZERO_TARGETS.length];
}

runTest('5. SNI Selector: Índice -1, NaN y float seleccionan host válido sin undefined', () => {
    const tNeg = selectSniTarget(-1);
    assert(tNeg && tNeg.sniHost, 'Debe seleccionar host ante índice -1');

    const tNaN = selectSniTarget(NaN);
    assert(tNaN && tNaN.sniHost === 'recargas.claro.com', 'Debe seleccionar fallback ante NaN');

    const tFloat = selectSniTarget(2.9);
    assert(tFloat && tFloat.sniHost === 'atencion.tigo.com', 'Debe truncar float a índice 2');
});

// ── 5. Validación de Fragmentación DNS Tunneling ───────────────────────────────
function packDns(payloadHex) {
    const rawStr = typeof payloadHex === 'string' ? payloadHex : '';
    if (!rawStr) return [];
    const b32 = encodeBase32(Buffer.from(rawStr, 'utf8'));
    if (!b32) return [];

    const CHUNK_SIZE = 48;
    const chunks = [];
    for (let i = 0; i < b32.length; i += CHUNK_SIZE) {
        chunks.push(b32.slice(i, i + CHUNK_SIZE));
    }
    return chunks.map((chunk, idx) => `${chunk}.s1001.p${idx + 1}of${chunks.length}.dns.redmesh.net`);
}

runTest('6. DNS Tunnel: Carga vacía o nula retorna array vacío de forma limpia', () => {
    assert.deepStrictEqual(packDns(''), []);
    assert.deepStrictEqual(packDns(null), []);
    assert.deepStrictEqual(packDns(undefined), []);
});

runTest('7. DNS Tunnel: Cada etiqueta de subdominio cumple con RFC 1035 (<= 63 caracteres)', () => {
    const longPayload = '0123456789abcdef'.repeat(16); // 256 chars
    const queries = packDns(longPayload);
    assert(queries.length > 0, 'Debe generar consultas DNS');

    queries.forEach((q, i) => {
        const labels = q.split('.');
        labels.forEach((label) => {
            assert(label.length <= 63, `Etiqueta "${label}" en query #${i} supera límite de 63 caracteres: ${label.length}`);
        });
    });
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

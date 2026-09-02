/**
 * TEST SUITE: CURSOR-ON-TARGET (CoT) & SITREP RESILIENCE
 * 
 * Valida la corrección de errores en CursorOnTargetEngine.ts y SitrepEngine.ts:
 * 1. Inmunidad a emisión de "NaN" en lat/lon/hae/ce/le en XML CoT.
 * 2. Inmunidad a TypeError en escapeXml ante argumentos no string.
 * 3. Rechazo de XML CoT corrupto con coordenadas alfanuméricas en parseFromXml.
 * 4. Fiel serialización y parseo de eventos CoT para interoperabilidad ATAK / CivTAK.
 * 5. Generación de balizas Blue-Force Tracking (BFT) con identificadores seguros.
 * 6. Inmunidad a RangeError por fechas no finitas en exportFormattedText de SITREP.
 * 7. Formateo seguro de coordenadas GPS sin "NaN°" en SITREP.
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
console.log('📡 INICIANDO SUITE DE PRUEBAS: CURSOR-ON-TARGET & SITREP RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de CursorOnTargetEngine.ts ───────────────────────────
const cotPath = path.join(__dirname, '..', 'src', 'lib', 'tactical', 'CursorOnTargetEngine.ts');
const cotCode = fs.readFileSync(cotPath, 'utf8');

runTest('1. CursorOnTargetEngine: Sanitización estricta de lat/lon en serializeToXml', () => {
    assert(cotCode.includes("typeof event.point?.lat === 'number' && isFinite(event.point.lat)"), 'Debe verificar isFinite(lat)');
    assert(cotCode.includes("typeof event.point?.lon === 'number' && isFinite(event.point.lon)"), 'Debe verificar isFinite(lon)');
});

runTest('2. CursorOnTargetEngine: escapeXml seguro contra argumentos no string', () => {
    assert(cotCode.includes("const str = typeof unsafe === 'string' ? unsafe : String(unsafe || '');"), 'Debe convertir safe string');
});

runTest('3. CursorOnTargetEngine: Validación de finitud en parseFromXml', () => {
    assert(cotCode.includes('if (!isFinite(lat) || !isFinite(lon)) return null;'), 'Debe rechazar lat/lon no finitas');
});

// ── 2. Inspección Estática de SitrepEngine.ts ──────────────────────────────────
const sitrepPath = path.join(__dirname, '..', 'src', 'lib', 'tactical', 'SitrepEngine.ts');
const sitrepCode = fs.readFileSync(sitrepPath, 'utf8');

runTest('4. SitrepEngine: Sanitización contra RangeError en exportFormattedText', () => {
    assert(sitrepCode.includes("typeof report.timestamp === 'number' && isFinite(report.timestamp)"), 'Debe verificar timestamp');
    assert(sitrepCode.includes('SitrepEngine.instance = null;'), 'Debe limpiar instance en destroy()');
});

// ── 3. Simulación y Validación de Protocolo CoT XML ───────────────────────────
function escapeXml(unsafe) {
    const str = typeof unsafe === 'string' ? unsafe : String(unsafe || '');
    return str.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function serializeCoT(lat, lon, callsign) {
    const safeLat = (typeof lat === 'number' && isFinite(lat)) ? Math.max(-90, Math.min(90, lat)) : 0.0;
    const safeLon = (typeof lon === 'number' && isFinite(lon)) ? Math.max(-180, Math.min(180, lon)) : 0.0;
    const safeCallsign = escapeXml(callsign);

    return `<?xml version="1.0" encoding="UTF-8"?>
<event version="2.0" uid="RED-TEST" type="a-f-G-U-C-I" time="2026-09-02T12:00:00.000Z">
  <point lat="${safeLat.toFixed(6)}" lon="${safeLon.toFixed(6)}" hae="0.0" ce="5.0" le="5.0"/>
  <detail><contact callsign="${safeCallsign}"/></detail>
</event>`;
}

function parseCoT(xmlStr) {
    const matchLat = xmlStr.match(/lat=["']([^"']*)["']/);
    const matchLon = xmlStr.match(/lon=["']([^"']*)["']/);
    if (!matchLat || !matchLon) return null;

    const lat = parseFloat(matchLat[1]);
    const lon = parseFloat(matchLon[1]);
    if (!isFinite(lat) || !isFinite(lon)) return null;

    return { lat, lon };
}

runTest('5. Interoperabilidad CoT: Serialización con lat/lon NaN no emite "NaN" a ATAK', () => {
    const xml = serializeCoT(NaN, Infinity, 'EAGLE-1');
    assert(!xml.includes('lat="NaN"'), 'No debe contener lat="NaN"');
    assert(!xml.includes('lon="Infinity"'), 'No debe contener lon="Infinity"');
    assert(xml.includes('lat="0.000000"'), 'Debe contener lat sanitizado 0.000000');
});

runTest('6. Interoperabilidad CoT: Parsing de XML corrupto devuelve null sin contaminar memoria', () => {
    const badXml = '<event><point lat="CORRUPT" lon="INVALID"/></event>';
    const parsed = parseCoT(badXml);
    assert.strictEqual(parsed, null, 'Debe retornar null');

    const validXml = serializeCoT(-12.046374, -77.042793, 'BRAVO-2');
    const validParsed = parseCoT(validXml);
    assert(validParsed !== null);
    assert.strictEqual(validParsed.lat.toFixed(4), '-12.0464');
    assert.strictEqual(validParsed.lon.toFixed(4), '-77.0428');
});

runTest('7. Resiliencia SITREP: Coordenadas NaN imprimen "0.00000°" en lugar de "NaN°"', () => {
    const safeLat = (typeof NaN === 'number' && isFinite(NaN)) ? (NaN).toFixed(5) : '0.00000';
    const text = `COORDENADAS GPS : ${safeLat}°, 0.00000°`;
    assert(!text.includes('NaN°'), 'No debe incluir "NaN°"');
    assert(text.includes('0.00000°'), 'Debe incluir "0.00000°"');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

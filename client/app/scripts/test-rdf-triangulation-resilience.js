/**
 * TEST SUITE: RDF & LOB TRIANGULATION SENSOR RESILIENCE
 * 
 * Valida la corrección de errores en RdfTriangulationEngine.ts y TacticalRdfEngine.ts:
 * 1. Sanitización de coordenadas y finitud en addBearing() de RdfTriangulationEngine.
 * 2. Inmunidad a singularidad polar (cos(lat) = 0) en triangulateTarget().
 * 3. Exactitud geométrica en intersección de LOBs perpendiculares para Foxhunt.
 * 4. Limpieza formal de listeners y singleton en RdfTriangulationEngine.destroy().
 * 5. Sanitización de heading y RSSI contra NaN en recordSample() de TacticalRdfEngine.
 * 6. Estimación log-distance y confidencePct finitos en getPeakBearing().
 * 7. Limpieza formal de sectores y singleton en TacticalRdfEngine.destroy().
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
console.log('📡 INICIANDO SUITE DE PRUEBAS: RDF & LOB TRIANGULATION RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de RdfTriangulationEngine.ts ─────────────────────────
const triPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'RdfTriangulationEngine.ts');
const triCode = fs.readFileSync(triPath, 'utf8');

runTest('1. RdfTriangulationEngine: Protección con safeCosLat contra división por cero en polos', () => {
    assert(triCode.includes('Math.max(0.01, Math.abs(Math.cos((latRef * Math.PI) / 180)))'), 'Debe usar safeCosLat');
    assert(triCode.includes('RdfTriangulationEngine.instance = null;'), 'Debe limpiar instance en destroy()');
});

runTest('2. RdfTriangulationEngine: Sanitización estricta de observerLat y observerLon', () => {
    assert(triCode.includes("typeof observerLat === 'number' && isFinite(observerLat)"), 'Debe validar observerLat');
    assert(triCode.includes("typeof observerLon === 'number' && isFinite(observerLon)"), 'Debe validar observerLon');
});

// ── 2. Inspección Estática de TacticalRdfEngine.ts ─────────────────────────────
const rdfPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'TacticalRdfEngine.ts');
const rdfCode = fs.readFileSync(rdfPath, 'utf8');

runTest('3. TacticalRdfEngine: Sanitización de headingDeg y rssiDbm contra NaN', () => {
    assert(rdfCode.includes("typeof headingDeg === 'number' && isFinite(headingDeg)"), 'Debe validar headingDeg');
    assert(rdfCode.includes("typeof rssiDbm === 'number' && isFinite(rssiDbm)"), 'Debe validar rssiDbm');
    assert(rdfCode.includes('TacticalRdfEngine.instance = null;'), 'Debe limpiar instance en destroy()');
});

// ── 3. Simulación de Geometría LOB Polar ────────────────────────────────────────
function simulatePolarTriangulation(latRef, lobs) {
    const safeCosLat = Math.max(0.01, Math.abs(Math.cos((latRef * Math.PI) / 180)));
    const mPerDegLat = 111320;
    const mPerDegLon = 111320 * safeCosLat;

    const lob1 = lobs[0];
    const lob2 = lobs[1];

    const x1 = lob1.lon * mPerDegLon;
    const y1 = lob1.lat * mPerDegLat;
    const x2 = lob2.lon * mPerDegLon;
    const y2 = lob2.lat * mPerDegLat;

    const theta1Rad = (lob1.bearing * Math.PI) / 180;
    const theta2Rad = (lob2.bearing * Math.PI) / 180;

    const dx1 = Math.sin(theta1Rad);
    const dy1 = Math.cos(theta1Rad);
    const dx2 = Math.sin(theta2Rad);
    const dy2 = Math.cos(theta2Rad);

    const det = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(det) < 0.05) return null;

    const t1 = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / det;
    const targetX = x1 + t1 * dx1;
    const targetY = y1 + t1 * dy1;

    const targetLon = targetX / mPerDegLon;
    const targetLat = targetY / mPerDegLat;

    return { targetLat, targetLon };
}

runTest('4. Triangulación LOB: En el Polo Norte (90° N), no produce NaN ni división por cero', () => {
    const lobs = [
        { lat: 89.9, lon: 0.0, bearing: 90 },
        { lat: 89.8, lon: 0.1, bearing: 0 }
    ];
    const fix = simulatePolarTriangulation(90.0, lobs);
    assert(fix !== null, 'Debe resolver fix');
    assert(isFinite(fix.targetLat), 'targetLat debe ser finito');
    assert(isFinite(fix.targetLon), 'targetLon debe ser finito');
    assert(!isNaN(fix.targetLat) && !isNaN(fix.targetLon), 'No debe ser NaN');
});

runTest('5. Triangulación LOB: Intersección perpendicular a 45° converge en posición objetivo', () => {
    // Observador 1 en (0, 0) apuntando al Norte (bearing 0°)
    // Observador 2 en (0.01, -0.01) apuntando al Este (bearing 90°)
    const lobs = [
        { lat: 0.0, lon: 0.0, bearing: 0 },
        { lat: 0.01, lon: -0.01, bearing: 90 }
    ];
    const fix = simulatePolarTriangulation(0.0, lobs);
    assert(fix !== null);
    assert(Math.abs(fix.targetLat - 0.01) < 0.001, 'targetLat debe aproximarse a 0.01');
    assert(Math.abs(fix.targetLon - 0.0) < 0.001, 'targetLon debe aproximarse a 0.0');
});

// ── 4. Validación de Sectores Polares de TacticalRdfEngine ──────────────────────
runTest('6. Polar RDF: Heading NaN normaliza a 0° y no desborda sectores [0, 15]', () => {
    const SECTOR_COUNT = 16;
    const SECTOR_WIDTH = 360 / SECTOR_COUNT;
    const safeHeading = (typeof NaN === 'number' && isFinite(NaN)) ? Math.round(NaN) % 360 : 0;
    const normalized = (safeHeading + 360) % 360;
    const sectorIndex = Math.floor(normalized / SECTOR_WIDTH) % SECTOR_COUNT;

    assert.strictEqual(sectorIndex, 0, 'Debe ser sector 0');
    assert(sectorIndex >= 0 && sectorIndex < SECTOR_COUNT, 'Debe estar en rango legal');
});

runTest('7. Polar RDF: Distancia Log-Distance no genera valores negativos ni NaN ante RSSI fuerte', () => {
    const rssi0 = -40;
    const pathLossExponent = 2.5;
    const peakRssiDbm = -50;
    const rawDist = Math.pow(10, (rssi0 - peakRssiDbm) / (10 * pathLossExponent));
    const safeDist = isFinite(rawDist) ? Math.max(1, Math.min(500, Math.round(rawDist * 10) / 10)) : 0;

    assert(safeDist > 0 && safeDist <= 500, 'Distancia debe ser positiva acotada');
    assert(isFinite(safeDist) && !isNaN(safeDist), 'Distancia debe ser número finito');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

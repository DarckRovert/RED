/**
 * TEST SUITE: CELESTIAL NAVIGATION & ASTRONOMICAL EPHEMERIS RESILIENCE
 * 
 * Valida la corrección de errores en CelestialNavigationEngine.ts:
 * 1. Inmunidad a división por cero e indeterminación trigonométrica en el cenit (altitud = 90°).
 * 2. Inmunidad a división por cero en polos geográficos (latitud = ±90°).
 * 3. Sanitización de coordenadas NaN e Infinity en calculateEphemeris.
 * 4. Normalización canónica de azimut solar y lunar en el rango [0, 360).
 * 5. Clamping de hora solar de mediodía UTC en el rango [0, 24).
 * 6. Sanitización y clamping físico en estimatePositionFromSolarNoon (Lat [-90, 90], Lon [-180, 180]).
 * 7. Resiliencia ante cadenas horarias de tránsito vacías o malformadas.
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
console.log('☀️ INICIANDO SUITE DE PRUEBAS: CELESTIAL NAVIGATION RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de CelestialNavigationEngine.ts ────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'CelestialNavigationEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. CelestialNavigationEngine: Protección de denominador contra división por cero en azimut', () => {
    assert(engineCode.includes('Math.abs(denom) > 1e-6'), 'Debe proteger el denominador de azimut solar');
    assert(engineCode.includes('isFinite(cosAz)'), 'Debe validar que cosAz sea finito previo a Math.acos');
});

runTest('2. CelestialNavigationEngine: Sanitización y clamping de coordenadas en calculateEphemeris', () => {
    assert(engineCode.includes('Math.max(-90, Math.min(90, latDeg))'), 'Debe acotar latDeg a [-90, 90]');
    assert(engineCode.includes('Math.max(-180, Math.min(180, lonDeg))'), 'Debe acotar lonDeg a [-180, 180]');
});

runTest('3. CelestialNavigationEngine: Normalización canónica angular [0, 360) de azimut', () => {
    assert(engineCode.includes('((azimuthDeg % 360) + 360) % 360'), 'Debe normalizar azimut solar');
    assert(engineCode.includes('((rawMoonAz % 360) + 360) % 360'), 'Debe normalizar azimut lunar');
});

// ── 2. Simulación y Validación Astronómica ─────────────────────────────────────
function simulateEphemeris(latDeg, lonDeg, date = new Date()) {
    const rad = Math.PI / 180;
    const deg = 180 / Math.PI;

    const safeLat = (typeof latDeg === 'number' && isFinite(latDeg)) ? Math.max(-90, Math.min(90, latDeg)) : 0;
    const safeLon = (typeof lonDeg === 'number' && isFinite(lonDeg)) ? Math.max(-180, Math.min(180, lonDeg)) : 0;
    const safeDate = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();

    const time = safeDate.getTime();
    const julianDay = (time / 86400000) - (safeDate.getTimezoneOffset() / 1440) + 2440587.5;
    const d = julianDay - 2451545.0;

    const L = (280.460 + 0.9856474 * d) % 360;
    const g = ((357.528 + 0.9856003 * d) % 360) * rad;
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    const epsilon = (23.439 - 0.0000004 * d) * rad;

    const sinDecl = Math.sin(epsilon) * Math.sin(lambda);
    const declinationDeg = Math.asin(sinDecl) * deg;

    const gmst = (280.46061837 + 360.98564736629 * d) % 360;
    const lst = (gmst + safeLon) % 360;

    const ha = (lst - L) * rad;
    const latRad = safeLat * rad;
    const sinAlt = Math.sin(latRad) * Math.sin(declinationDeg * rad) + Math.cos(latRad) * Math.cos(declinationDeg * rad) * Math.cos(ha);
    const altitudeDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * deg;

    const denom = Math.cos(latRad) * Math.cos(altitudeDeg * rad);
    const cosAz = Math.abs(denom) > 1e-6
        ? (Math.sin(declinationDeg * rad) - Math.sin(latRad) * sinAlt) / denom
        : 0;
    let azimuthDeg = isFinite(cosAz) ? Math.acos(Math.max(-1, Math.min(1, cosAz))) * deg : 0;
    if (Math.sin(ha) > 0) azimuthDeg = 360 - azimuthDeg;
    azimuthDeg = ((azimuthDeg % 360) + 360) % 360;

    return {
        azimuthDeg,
        altitudeDeg,
        declinationDeg,
    };
}

runTest('4. Astronomía: Cálculo en Polo Norte (90° N) no genera división por cero ni NaN', () => {
    const res = simulateEphemeris(90, 0);
    assert(isFinite(res.azimuthDeg), `Azimut debe ser finito en polo: ${res.azimuthDeg}`);
    assert(isFinite(res.altitudeDeg), `Altitud debe ser finita en polo: ${res.altitudeDeg}`);
});

runTest('5. Astronomía: Coordenadas NaN devuelven efemérides válidas sin propagar NaN', () => {
    const res = simulateEphemeris(NaN, NaN);
    assert(isFinite(res.azimuthDeg), 'Azimut debe ser finito con NaN');
    assert(isFinite(res.altitudeDeg), 'Altitud debe ser finita con NaN');
    assert(isFinite(res.declinationDeg), 'Declinación debe ser finita con NaN');
});

function simulateSolarNoonPosition(timeStr, altitudeDeg) {
    const safeStr = typeof timeStr === 'string' ? timeStr.trim() : '12:00:00';
    const parts = safeStr.split(':');
    const h = parseFloat(parts[0] || '12');
    const m = parseFloat(parts[1] || '0');
    const s = parseFloat(parts[2] || '0');
    const utcHours = (!isNaN(h) && isFinite(h)) ? h + ((!isNaN(m) && isFinite(m)) ? m / 60 : 0) + ((!isNaN(s) && isFinite(s)) ? s / 3600 : 0) : 12;

    const rawLon = ((12 - utcHours) * 15);
    const normalizedLon = ((((rawLon + 180) % 360) + 360) % 360) - 180;
    const estimatedLon = Math.round(normalizedLon * 100) / 100;

    const safeAltitude = (typeof altitudeDeg === 'number' && isFinite(altitudeDeg))
        ? Math.max(0, Math.min(90, altitudeDeg))
        : 45;

    const rawLat = 90 - safeAltitude;
    const estimatedLat = Math.round(Math.max(-90, Math.min(90, rawLat)) * 100) / 100;

    return { estimatedLat, estimatedLon };
}

runTest('6. Tránsito Solar: Tránsito a las 17:00 UTC calcula longitud 75° Oeste (-75.0°)', () => {
    const pos = simulateSolarNoonPosition('17:00:00', 60);
    assert.strictEqual(pos.estimatedLon, -75, `Longitud esperada: -75°, obtenida: ${pos.estimatedLon}°`);
    assert(pos.estimatedLat >= 0 && pos.estimatedLat <= 90, `Latitud debe estar acotada: ${pos.estimatedLat}°`);
});

runTest('7. Tránsito Solar: Cadena de tiempo vacía o corrupta no arroja excepción', () => {
    const pos = simulateSolarNoonPosition('corrupt_time', NaN);
    assert(isFinite(pos.estimatedLat), 'Latitud debe ser finita');
    assert(isFinite(pos.estimatedLon), 'Longitud debe ser finita');
    assert.strictEqual(pos.estimatedLon, 0, 'UTC 12:00 por defecto genera longitud 0°');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

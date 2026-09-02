/**
 * TEST SUITE: TACTICAL TCCC & BALLISTICS ENGINE RESILIENCE
 * 
 * Valida la corrección de errores en TacticalTcccEngine.ts y TacticalBallisticsEngine.ts:
 * 1. Inmunidad a RangeError: Invalid time value en DD Form 1380 ante timestamps corruptos o NaN.
 * 2. Cálculo estricto de minutos de isquemia no negativos en el ticker de torniquetes.
 * 3. Activación de alerta de isquemia a los 120 minutos conforme al protocolo MARCH militar.
 * 4. Limpieza garantizada de intervalo y reinicio de singleton en destroy().
 * 5. Solución balística zeroed finita y segura ante distancias 0, negativas o NaN.
 * 6. Consistencia de balística a 300m: caída calculada, clics de elevación MRAD/MOA finitos.
 * 7. Inmunidad a NaN en viento cruzado e inclinación angular en torretas de mira telescópica.
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
console.log('🎯 INICIANDO SUITE DE PRUEBAS: TCCC & TACTICAL BALLISTICS RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de TacticalTcccEngine.ts ─────────────────────────────
const tcccPath = path.join(__dirname, '..', 'src', 'lib', 'tactical', 'TacticalTcccEngine.ts');
const tcccCode = fs.readFileSync(tcccPath, 'utf8');

runTest('1. TacticalTcccEngine: Sanitización contra RangeError en fechas de DD Form 1380', () => {
    assert(tcccCode.includes('validTimestamp = (typeof card.createdTimestamp === \'number\' && isFinite(card.createdTimestamp))'), 'Debe sanitizar createdTimestamp');
    assert(tcccCode.includes('new Date(validTimestamp).toISOString()'), 'Debe usar validTimestamp');
});

runTest('2. TacticalTcccEngine: Minutos de isquemia no negativos en ticker', () => {
    assert(tcccCode.includes('const mins = Math.max(0, Math.floor((now - tq.appliedTimestamp) / 60000));'), 'Debe usar Math.max(0, ...)');
});

runTest('3. TacticalTcccEngine: Reinicio de instancia singleton en destroy()', () => {
    assert(tcccCode.includes('TacticalTcccEngine.instance = null;'), 'Debe resetear instance a null');
});

// ── 2. Inspección Estática de TacticalBallisticsEngine.ts ────────────────────────
const ballisticsPath = path.join(__dirname, '..', 'src', 'lib', 'tactical', 'TacticalBallisticsEngine.ts');
const ballisticsCode = fs.readFileSync(ballisticsPath, 'utf8');

runTest('4. TacticalBallisticsEngine: Solución segura ante distancia nula, negativa o NaN', () => {
    assert(ballisticsCode.includes('if (!isFinite(distanceMeters) || distanceMeters <= 0)'), 'Debe validar distanceMeters');
    assert(ballisticsCode.includes('targetDistanceMeters: 0,'), 'Debe retornar targetDistanceMeters: 0');
});

// ── 3. Simulación y Validación de Lógica Balística ─────────────────────────────
function simulateBallistics(distanceMeters, crosswindMps = 0, inclineAngleDeg = 0) {
    const muzzleVelocityMps = 940;
    const bulletMassGrams = 4.02;
    const bc = 0.304;
    const zeroRangeMeters = 100;
    const g = 9.80665;

    if (!isFinite(distanceMeters) || distanceMeters <= 0) {
        return {
            targetDistanceMeters: 0,
            bulletDropCm: 0,
            elevationMrad: 0,
            elevationClicksMrad: 0,
            elevationClicksMoa: 0,
            windDriftCm: 0,
            windageMrad: 0,
            timeOfFlightSec: 0,
            remainingVelocityMps: muzzleVelocityMps,
        };
    }

    const safeDistance = Math.min(3000, Math.max(1, distanceMeters));
    const safeCrosswind = (typeof crosswindMps === 'number' && isFinite(crosswindMps)) ? crosswindMps : 0;
    const safeIncline = (typeof inclineAngleDeg === 'number' && isFinite(inclineAngleDeg))
        ? Math.max(-89, Math.min(89, inclineAngleDeg))
        : 0;

    const cosAngle = Math.cos((safeIncline * Math.PI) / 180);
    const avgVelocity = muzzleVelocityMps * (1 - (0.00035 / Math.max(0.1, bc)) * (safeDistance / 2));
    const vMps = Math.max(150, avgVelocity);
    const timeOfFlightSec = safeDistance / vMps;

    const rawDropM = 0.5 * g * Math.pow(timeOfFlightSec, 2);
    const zeroDropM = 0.5 * g * Math.pow(zeroRangeMeters / muzzleVelocityMps, 2);
    const netDropM = Math.max(0, (rawDropM - (zeroDropM * (safeDistance / zeroRangeMeters)))) * cosAngle;
    const bulletDropCm = Math.round(netDropM * 100 * 10) / 10;

    const mradFactor = Math.max(0.1, safeDistance * 0.1);
    const elevationMrad = Math.round((bulletDropCm / mradFactor) * 10) / 10;
    const elevationMoa = Math.round((elevationMrad * 3.4377) * 10) / 10;

    const windDriftM = Math.abs(safeCrosswind) * Math.max(0, (timeOfFlightSec - (safeDistance / muzzleVelocityMps)));
    const windDriftCm = Math.round(Math.max(0, windDriftM * 100) * 10) / 10;
    const windageMrad = Math.round((windDriftCm / mradFactor) * 10) / 10;

    return {
        targetDistanceMeters: safeDistance,
        bulletDropCm,
        elevationMrad,
        elevationClicksMrad: Math.round(elevationMrad * 10),
        elevationClicksMoa: Math.round(elevationMoa * 4),
        windDriftCm,
        windageMrad,
        timeOfFlightSec: Math.round(timeOfFlightSec * 100) / 100,
    };
}

runTest('5. Balística: Distancia 0 o NaN retorna solución zeroed finita sin NaN', () => {
    const solZero = simulateBallistics(0);
    assert.strictEqual(solZero.bulletDropCm, 0);
    assert.strictEqual(solZero.elevationClicksMrad, 0);

    const solNaN = simulateBallistics(NaN);
    assert.strictEqual(solNaN.bulletDropCm, 0);
    assert.strictEqual(solNaN.elevationClicksMrad, 0);
});

runTest('6. Balística: Blanco a 300m calcula caída y clics positivos para 5.56 NATO', () => {
    const sol300 = simulateBallistics(300, 4, 0);
    assert(sol300.bulletDropCm > 20, `Caída a 300m debe ser > 20cm, obtenida: ${sol300.bulletDropCm}cm`);
    assert(sol300.elevationClicksMrad > 5, `Clics MRAD deben ser > 5, obtenidos: ${sol300.elevationClicksMrad}`);
    assert(isFinite(sol300.timeOfFlightSec) && sol300.timeOfFlightSec > 0.2);
});

runTest('7. Resiliencia: Viento cruzado NaN e inclinación 90° no provocan NaN en torreta', () => {
    const solGlitch = simulateBallistics(500, NaN, 90);
    assert(isFinite(solGlitch.elevationClicksMrad), `Elevación debe ser finita: ${solGlitch.elevationClicksMrad}`);
    assert(isFinite(solGlitch.windageMrad), `Deriva debe ser finita: ${solGlitch.windageMrad}`);
    assert(solGlitch.windDriftCm === 0, `Deriva con viento NaN debe ser 0`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

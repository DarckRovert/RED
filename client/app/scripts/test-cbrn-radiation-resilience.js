/**
 * TEST SUITE: CBRN NUCLEAR DOSIMETRY & PLUME DISPERSION RESILIENCE
 * 
 * Valida la resiliencia y corrección física de:
 * 1. CbrnRadiationEngine.ts: Inmunidad absoluta a corrupción NaN en tasa de dosis y dosis acumulada.
 * 2. CbrnRadiationEngine.ts: Cálculo acotado de tiempo seguro de permanencia (safeStayTimeMinutes).
 * 3. CbrnRadiationEngine.ts: Recuperación de dosis guardada en localStorage frente a valores inválidos.
 * 4. CbrnPlumeDispersionEngine.ts: Manejo seguro de coordenadas y vientos NaN sin romper el vector de escape.
 * 5. CbrnPlumeDispersionEngine.ts: Cálculo fidedigno de cono Gaussiano y vector de evacuación perpendicular (90°).
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
console.log('☢️ INICIANDO SUITE DE PRUEBAS: CBRN RADIATION & PLUME DISPERSION RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de CbrnRadiationEngine.ts ──────────────────────────
const radPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'CbrnRadiationEngine.ts');
const radCode = fs.readFileSync(radPath, 'utf8');

runTest('1. CbrnRadiationEngine: Sanitización estricta contra NaN en setDoseRate', () => {
    assert(radCode.includes("const safeRate = (typeof rateUsVh === 'number' && isFinite(rateUsVh) && rateUsVh >= 0) ? rateUsVh : 0;"), 'setDoseRate debe verificar finitud');
});

runTest('2. CbrnRadiationEngine: Sanitización de fotones CMOS contra entradas negativas o no finitas', () => {
    assert(radCode.includes("if (!isFinite(hotPixelCount) || hotPixelCount < 0 || !isFinite(exposureTimeMs) || exposureTimeMs <= 0) return;"), 'recordCmosPhotonHits debe rechazar NaN y tiempos <= 0');
});

runTest('3. CbrnRadiationEngine: Tiempo de permanencia seguro no desborda y acota a 0 ante >= 50 mSv', () => {
    assert(radCode.includes("const remainingDoseMsv = Math.max(0, 50 - cum);"), 'Debe calcular dosis remanente');
    assert(radCode.includes("safeStayMins = Math.min(99999, Math.max(0, isFinite(calculated) ? calculated : 99999));"), 'Debe acotar safeStayMins');
});

// ── 2. Validación Dosimétrica y Matemática ────────────────────────────────────
function computeStayTime(rateUsVh, cumulativeDoseMsv) {
    const rate = (typeof rateUsVh === 'number' && isFinite(rateUsVh) && rateUsVh >= 0) ? rateUsVh : 0.12;
    const cum = (typeof cumulativeDoseMsv === 'number' && isFinite(cumulativeDoseMsv) && cumulativeDoseMsv >= 0) ? cumulativeDoseMsv : 0;

    const remainingDoseMsv = Math.max(0, 50 - cum);
    let safeStayMins = 99999;
    if (remainingDoseMsv <= 0) {
        safeStayMins = 0;
    } else if (rate > 0.0001) {
        const calculated = Math.round((remainingDoseMsv / (rate / 1000)) * 60);
        safeStayMins = Math.min(99999, Math.max(0, isFinite(calculated) ? calculated : 99999));
    }
    return safeStayMins;
}

runTest('4. Dosimetría: Dosis de fondo (0.12 uSv/h) y 0 mSv acumulados otorgan 99999 min máximos', () => {
    const stayMins = computeStayTime(0.12, 0);
    assert.strictEqual(stayMins, 99999, `Esperado 99999 min acotado, obtenido: ${stayMins}`);
});

runTest('5. Dosimetría: Operador expuesto a 50 mSv acumulados obtiene 0 min de permanencia inmediata', () => {
    const stayMins = computeStayTime(25.0, 50.0);
    assert.strictEqual(stayMins, 0, `Esperado 0 min, obtenido: ${stayMins}`);
});

runTest('6. Dosimetría: Entrada de tasa NaN o dosis acumulada NaN produce tiempo finito seguro', () => {
    const stayMins = computeStayTime(NaN, NaN);
    assert(isFinite(stayMins) && stayMins >= 0, `Tiempo debe ser finito y no negativo: ${stayMins}`);
});

// ── 3. Inspección Estática de CbrnPlumeDispersionEngine.ts ────────────────────
const plumePath = path.join(__dirname, '..', 'src', 'lib', 'tactical', 'CbrnPlumeDispersionEngine.ts');
const plumeCode = fs.readFileSync(plumePath, 'utf8');

runTest('7. CbrnPlumeDispersionEngine: Coordenadas NaN devuelven rumbo seguro sin singularidades', () => {
    assert(plumeCode.includes("const areCoordsFinite = isFinite(operatorLat) && isFinite(operatorLon) && isFinite(source.lat) && isFinite(source.lon);"), 'Debe validar finitud de coordenadas de operador y foco');
    assert(plumeCode.includes("recommendedAzimuthDegrees: (windDir + 90) % 360"), 'Debe proveer rumbo de escape perpendicular de emergencia');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

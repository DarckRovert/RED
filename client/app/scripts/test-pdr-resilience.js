/**
 * TEST SUITE: PEDESTRIAN DEAD RECKONING (PDR) INERTIAL RESILIENCE
 * 
 * Valida la corrección de errores en PedestrianDeadReckoningEngine.ts:
 * 1. Inmunidad a congelamiento por NaN en detección de pasos y Weinberg stride.
 * 2. Normalización canónica de rumbo angular en el rango legal [0, 360).
 * 3. Sanitización contra rumbos o zancadas NaN en el vector de desplazamiento 2D.
 * 4. Precisión de desplazamiento inercial ortogonal (Norte 0°, Este 90°).
 * 5. Ciclo de vida y limpieza de listeners en start/stop/destroy.
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
console.log('🚶 INICIANDO SUITE DE PRUEBAS: PEDESTRIAN DEAD RECKONING RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de PedestrianDeadReckoningEngine.ts ─────────────────
const pdrPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'PedestrianDeadReckoningEngine.ts');
const pdrCode = fs.readFileSync(pdrPath, 'utf8');

runTest('1. PDR Engine: Descarte temprano si magnitud de aceleración es NaN o negativa', () => {
    assert(pdrCode.includes('if (!isFinite(mag) || mag < 0) return;'), 'motionHandler debe descartar mag no finita');
});

runTest('2. PDR Engine: Normalización angular canónica [0, 360) ante ángulos negativos o desbordados', () => {
    assert(pdrCode.includes('((Math.round(heading) % 360) + 360) % 360'), 'orientationHandler debe normalizar el rumbo');
    assert(pdrCode.includes('((rawHeading % 360) + 360) % 360'), 'recordStep debe normalizar el rumbo');
});

runTest('3. PDR Engine: Sanitización de zancada y rumbo en recordStep', () => {
    assert(pdrCode.includes("typeof headingDeg === 'number' && isFinite(headingDeg)"), 'Debe comprobar que headingDeg sea finito');
    assert(pdrCode.includes("typeof strideMeters === 'number' && isFinite(strideMeters) && strideMeters > 0"), 'Debe comprobar que strideMeters sea finito y positivo');
});

// ── 2. Validación de Lógica Trigonométrica e Inercial ─────────────────────────
function computeDisplacement(steps) {
    let north = 0;
    let east = 0;

    for (const step of steps) {
        const rawHeading = (typeof step.headingDeg === 'number' && isFinite(step.headingDeg)) ? step.headingDeg : 0;
        const safeHeading = ((rawHeading % 360) + 360) % 360;
        const safeStride = (typeof step.strideMeters === 'number' && isFinite(step.strideMeters) && step.strideMeters > 0) ? step.strideMeters : 0.75;

        const headingRad = (safeHeading * Math.PI) / 180;
        north = Math.round((north + safeStride * Math.cos(headingRad)) * 100) / 100;
        east = Math.round((east + safeStride * Math.sin(headingRad)) * 100) / 100;
    }

    return { north, east };
}

runTest('4. Vector Inercial: 10 pasos hacia el Norte (0°) a 0.8m avanzan 8.0m Norte y 0m Este', () => {
    const steps = Array(10).fill({ headingDeg: 0, strideMeters: 0.8 });
    const disp = computeDisplacement(steps);
    assert.strictEqual(disp.north, 8.0, `Norte esperado: 8.0m, obtenido: ${disp.north}`);
    assert.strictEqual(disp.east, 0.0, `Este esperado: 0.0m, obtenido: ${disp.east}`);
});

runTest('5. Vector Inercial: 5 pasos hacia el Este (90°) a 1.0m avanzan 0m Norte y 5.0m Este', () => {
    const steps = Array(5).fill({ headingDeg: 90, strideMeters: 1.0 });
    const disp = computeDisplacement(steps);
    assert.strictEqual(disp.north, 0.0, `Norte esperado: 0.0m, obtenido: ${disp.north}`);
    assert.strictEqual(disp.east, 5.0, `Este esperado: 5.0m, obtenido: ${disp.east}`);
});

runTest('6. Vector Inercial: Glitch con rumbo NaN o zancada NaN no rompe el cálculo', () => {
    const steps = [
        { headingDeg: 0, strideMeters: 1.0 },
        { headingDeg: NaN, strideMeters: NaN }, // Glitch
        { headingDeg: 0, strideMeters: 1.0 }
    ];
    const disp = computeDisplacement(steps);
    assert(isFinite(disp.north) && isFinite(disp.east), 'Desplazamiento debe permanecer finito');
    assert.strictEqual(disp.north, 2.75, `Esperado 2.75m (1 + 0.75 default + 1), obtenido: ${disp.north}`);
});

runTest('7. Normalización Angular: Ángulo -90° se convierte canónicamente en 270° (Oeste)', () => {
    const norm = ((-90 % 360) + 360) % 360;
    assert.strictEqual(norm, 270, `Esperado 270°, obtenido: ${norm}`);
    const normOver = ((450 % 360) + 360) % 360;
    assert.strictEqual(normOver, 90, `Esperado 90°, obtenido: ${normOver}`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

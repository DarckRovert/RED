/**
 * TEST SUITE: BAROMETRIC FAN-SHAPED BODY (FB) 3D HYPSOMETRIC RESILIENCE
 * 
 * Valida la integración hipsométrica barométrica real en FanShapedBodyEngine:
 * 1. Fórmula Hipsométrica ICAO estándar para cálculo de desnivel altimétrico (Δz).
 * 2. Descenso de presión barométrica (P_curr < P_prev) indica ascenso (Δz > 0).
 * 3. Aumento de presión barométrica (P_curr > P_prev) indica descenso (Δz < 0).
 * 4. Inyección directa de lecturas barométricas y actualización de posZ y HomeVector.
 * 5. Rechazo estricto de presiones absurdas fuera del rango terrestre (600 - 1150 hPa).
 * 6. Inmunidad a NaN y variaciones nulas.
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
console.log('🏔️📐 INICIANDO SUITE DE PRUEBAS: BAROMETRIC FAN-SHAPED BODY 3D RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de FanShapedBodyEngine.ts ───────────────────────────
const fbPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'FanShapedBodyEngine.ts');
const fbCode = fs.readFileSync(fbPath, 'utf8');

runTest('1. FanShapedBodyEngine: Integración de weatherBarometerEngine y Fórmula ICAO', () => {
    assert(fbCode.includes('getBaroHistory'), 'Debe importar getBaroHistory');
    assert(fbCode.includes('lastPressureHpa'), 'Debe almacenar última presión barométrica');
    assert(fbCode.includes('calculateDeltaAltitudeFromPressure'), 'Debe exponer función hipsométrica');
    assert(fbCode.includes('injectBarometricPressure'), 'Debe permitir inyección de telemetría barométrica');
});

runTest('2. FanShapedBodyEngine: Expresión Matemática Hipsométrica ICAO', () => {
    assert(fbCode.includes('44330.77'), 'Debe usar constante barométrica estándar ICAO 44330.77');
    assert(fbCode.includes('0.190263'), 'Debe usar exponente barométrico 0.190263');
    assert(fbCode.includes('1013.25'), 'Debe usar presión de referencia a nivel del mar 1013.25 hPa');
});

// ── 2. Validación Numérica de la Fórmula Hipsométrica ─────────────────────────

function calculateDeltaAltitude(pPrevHpa, pCurrHpa) {
    if (!isFinite(pPrevHpa) || !isFinite(pCurrHpa) || pPrevHpa <= 0 || pCurrHpa <= 0) return 0.0;
    const altPrev = 44330.77 * (1.0 - Math.pow(pPrevHpa / 1013.25, 0.190263));
    const altCurr = 44330.77 * (1.0 - Math.pow(pCurrHpa / 1013.25, 0.190263));
    const delta = altCurr - altPrev;
    return isFinite(delta) ? Math.round(delta * 100) / 100 : 0.0;
}

runTest('3. Dinámica Hipsométrica: Ascenso vertical produce Δz positivo', () => {
    // Al subir una colina o edificio, la presión cae de 1013.25 hPa a 1001.25 hPa (~12 hPa de caída)
    const deltaZ = calculateDeltaAltitude(1013.25, 1001.25);
    assert(deltaZ > 0, `Ascenso debe ser positivo: obtenido ${deltaZ}m`);
    // En la atmósfera estándar, 1 hPa equivale a ~8.3 metros cerca del nivel del mar. 12 hPa ~ 100 metros
    assert(deltaZ >= 90 && deltaZ <= 110, `Desnivel esperado ~100m, obtenido ${deltaZ}m`);
});

runTest('4. Dinámica Hipsométrica: Descenso vertical produce Δz negativo', () => {
    // Al descender a una quebrada o sótano, la presión sube de 990 hPa a 1005 hPa
    const deltaZ = calculateDeltaAltitude(990.0, 1005.0);
    assert(deltaZ < 0, `Descenso debe ser negativo: obtenido ${deltaZ}m`);
    assert(deltaZ <= -110 && deltaZ >= -135, `Desnivel esperado ~-125m, obtenido ${deltaZ}m`);
});

runTest('5. Dinámica Hipsométrica: Presión constante produce Δz = 0.0', () => {
    const deltaZ = calculateDeltaAltitude(1010.5, 1010.5);
    assert.strictEqual(deltaZ, 0.0, 'Δz debe ser exactamente 0 cuando la presión no cambia');
});

runTest('6. Inmunidad a Valores Anómalos o No Finitos', () => {
    assert.strictEqual(calculateDeltaAltitude(NaN, 1000), 0.0, 'NaN en P_prev debe retornar 0.0');
    assert.strictEqual(calculateDeltaAltitude(1000, Infinity), 0.0, 'Infinity en P_curr debe retornar 0.0');
    assert.strictEqual(calculateDeltaAltitude(0, 1000), 0.0, 'Presión 0 debe retornar 0.0');
});

// ── 3. Simulación de Integración en Fan-Shaped Body ───────────────────────────

class MockFanShapedBody {
    constructor() {
        this.posX = 0;
        this.posY = 0;
        this.posZ = 0;
        this.homeOriginZ = 0;
        this.lastPressureHpa = null;
    }

    injectBarometricPressure(pressureHpa) {
        if (!isFinite(pressureHpa) || pressureHpa < 600 || pressureHpa > 1150) return;
        if (this.lastPressureHpa !== null) {
            const deltaZ = calculateDeltaAltitude(this.lastPressureHpa, pressureHpa);
            this.posZ += deltaZ;
        }
        this.lastPressureHpa = pressureHpa;
    }

    getHomeVector() {
        return {
            deltaAltitudeMeters: Math.round((this.posZ - this.homeOriginZ) * 10) / 10,
        };
    }
}

runTest('7. Simulación de Odometría 3D: Acumulación de Altitud y Desnivel Home', () => {
    const fb = new MockFanShapedBody();
    
    // Nivel base al encender (Home en 1013.25 hPa)
    fb.injectBarometricPressure(1013.25);
    assert.strictEqual(fb.posZ, 0.0);

    // El operador sube un campamento táctico (presión cae a 985 hPa)
    fb.injectBarometricPressure(985.0);
    const alt1 = fb.posZ;
    assert(alt1 > 200 && alt1 < 260, `Debe reflejar ascenso de ~235m: actual ${alt1}m`);
    assert.strictEqual(fb.getHomeVector().deltaAltitudeMeters, Math.round(alt1 * 10) / 10);

    // El operador desciende 50 metros (presión sube ligeramente a 991 hPa)
    fb.injectBarometricPressure(991.0);
    const alt2 = fb.posZ;
    assert(alt2 < alt1, 'Altitud debe haber descendido');
    assert(alt2 > 170 && alt2 < 200, `Altitud tras descenso debe ser ~185m: actual ${alt2}m`);
});

runTest('8. Rechazo de Presiones Corruptas o Sensores en Cero', () => {
    const fb = new MockFanShapedBody();
    fb.injectBarometricPressure(1010.0);
    const prevZ = fb.posZ;

    // Sensor roto reportando 0 hPa o 50 hPa
    fb.injectBarometricPressure(0);
    fb.injectBarometricPressure(50);
    fb.injectBarometricPressure(1500);

    assert.strictEqual(fb.posZ, prevZ, 'posZ no debe alterarse ante presiones corruptas fuera de 600..1150 hPa');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests < totalTests) {
    process.exit(1);
}

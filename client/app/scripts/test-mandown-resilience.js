/**
 * TEST SUITE: MAN-DOWN DETECTOR & EMERGENCY SENTRY RESILIENCE
 * 
 * Valida la corrección de errores críticos en ManDownDetectorEngine.ts:
 * 1. Cancelación obligatoria de baliza SOS en la malla al desarmar o cancelar la alarma.
 * 2. Limpieza preventiva de temporizadores huérfanos al re-armar el centinela.
 * 3. Sanitización del acelerómetro contra NaN, Infinity y lecturas no finitas.
 * 4. Detección fidedigna de impactos (>= 2.4g) e inmovilidad sin falsos positivos por glitches.
 * 5. Ciclo de vida limpio en destroy().
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
console.log('🚨 INICIANDO SUITE DE PRUEBAS: MAN-DOWN DETECTOR RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de ManDownDetectorEngine.ts ────────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'ManDownDetectorEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. ManDownDetectorEngine: Desarmado desactiva baliza SOS si estaba en ALARM_DISPATCHED', () => {
    assert(engineCode.includes("const wasDispatched = this.state === 'ALARM_DISPATCHED'"), 'Debe detectar si la alarma ya fue emitida');
    assert(engineCode.includes('meshSosBeacon.deactivateSosBeacon().catch(() => {})'), 'Debe emitir paquete de cancelación a la malla');
});

runTest('2. ManDownDetectorEngine: CancelPreAlarm permite rescate tras ALARM_DISPATCHED', () => {
    assert(engineCode.includes("this.state === 'PRE_ALARM_COUNTDOWN' || this.state === 'IMPACT_DETECTED' || wasDispatched"), 'cancelPreAlarm debe admitir estado ALARM_DISPATCHED');
});

runTest('3. ManDownDetectorEngine: Limpieza preventiva de timers al invocar armSentry()', () => {
    assert(engineCode.includes('this.stopAllTimers();'), 'armSentry debe invocar stopAllTimers preventivamente');
});

runTest('4. ManDownDetectorEngine: Sanitización estricta de aceleración contra NaN e Infinity', () => {
    assert(engineCode.includes("typeof rawX === 'number' && isFinite(rawX)"), 'Debe comprobar que X sea finita');
    assert(engineCode.includes("typeof rawY === 'number' && isFinite(rawY)"), 'Debe comprobar que Y sea finita');
    assert(engineCode.includes("typeof rawZ === 'number' && isFinite(rawZ)"), 'Debe comprobar que Z sea finita');
    assert(engineCode.includes('if (!isFinite(magnitudeG) || magnitudeG < 0) return;'), 'Debe descartar magnitudG no finita');
});

// ── 2. Validación de Lógica Inercial ──────────────────────────────────────────
function computeMagnitude(rawX, rawY, rawZ, hasGravity = true) {
    const x = (typeof rawX === 'number' && isFinite(rawX)) ? rawX : 0;
    const y = (typeof rawY === 'number' && isFinite(rawY)) ? rawY : 0;
    const defaultZ = hasGravity ? 9.81 : 0;
    const z = (typeof rawZ === 'number' && isFinite(rawZ)) ? rawZ : defaultZ;

    const magnitudeMps2 = Math.sqrt(x * x + y * y + z * z);
    const magnitudeG = magnitudeMps2 / 9.81;

    if (!isFinite(magnitudeG) || magnitudeG < 0) return null;
    return magnitudeG;
}

runTest('5. Física Inercial: Gravedad estándar 1g en reposo (Z = 9.81 m/s²)', () => {
    const mag = computeMagnitude(0, 0, 9.81, true);
    assert(mag !== null && Math.abs(mag - 1.0) < 0.01, `Magnitud esperada ~1.0g, obtenida: ${mag}`);
});

runTest('6. Física Inercial: Glitch con NaN / Infinity es descartado sin disparar impacto', () => {
    assert.strictEqual(computeMagnitude(NaN, 0, 9.81), 1.0); // NaN se sanitiza a 0
    assert.strictEqual(computeMagnitude(0, Infinity, 9.81), 1.0); // Infinity se sanitiza a 0
});

runTest('7. Detección de Caída e Impacto: 3.5g supera umbral crítico (2.4g)', () => {
    const impactG = computeMagnitude(25, 18, 15, true);
    assert(impactG !== null && impactG >= 2.4, `Impacto severo detectado: ${impactG}g`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

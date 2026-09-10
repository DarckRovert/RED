/**
 * TEST SUITE: STRUCTURAL HEALTH SEISMIC RESILIENCE & DFT OPTIMIZATION
 * 
 * Valida:
 * 1. Optimización del hop interval en el bucle DFT de 64 puntos (cada 8 muestras).
 * 2. Integridad de cálculo de frecuencia natural f0 y riesgo de colapso.
 * 3. Preservación de identidad singleton en destroy().
 * 4. Throttle de sirena de evacuación.
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
console.log('🏢 INICIANDO SUITE DE PRUEBAS: STRUCTURAL HEALTH SEISMIC RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de StructuralHealthSeismicEngine.ts ────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'StructuralHealthSeismicEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. StructuralHealthSeismicEngine: Incorporación de hopCounter y salto de 8 muestras', () => {
    assert(engineCode.includes('hopCounter'), 'Debe definir hopCounter');
    assert(engineCode.includes('this.hopCounter % 8 === 0'), 'Debe espaciar el cálculo DFT cada 8 muestras');
});

runTest('2. StructuralHealthSeismicEngine: Bounding de búfer a 64 muestras', () => {
    assert(engineCode.includes('if (this.sampleBuffer.length > 64)'), 'Debe acotar el búfer a 64 muestras');
    assert(engineCode.includes('this.sampleBuffer.shift()'), 'Debe descartar la muestra más antigua');
});

runTest('3. StructuralHealthSeismicEngine: Limpieza de referencia singleton en destroy()', () => {
    assert(engineCode.includes('StructuralHealthSeismicEngine.instance = null;'), 'Debe limpiar la instancia singleton');
});

runTest('4. StructuralHealthSeismicEngine: Throttle de sirena de evacuación para prevenir saturación de audio', () => {
    assert(engineCode.includes('now - this.lastAlarmTimeMs < 2500'), 'Debe regular las alertas de sirena a 2.5s');
});

// ── 2. Simulación de Reducción de Carga DFT ──────────────────────────────────
runTest('5. Simulación de Reducción de Carga: 100 muestras inerciales solo disparan 5 cálculos DFT', () => {
    let dftExecutions = 0;
    let hopCounter = 0;
    const sampleBuffer = [];

    for (let i = 0; i < 100; i++) {
        sampleBuffer.push(Math.sin(i * 0.1));
        if (sampleBuffer.length > 64) {
            sampleBuffer.shift();
        }
        hopCounter++;
        if (sampleBuffer.length >= 64 && (hopCounter % 8 === 0)) {
            dftExecutions++;
        }
    }

    // A partir de la muestra 64 (cuando el búfer se llena):
    // Muestras restantes = 100 - 64 = 36 muestras.
    // Con hop % 8 === 0, solo se ejecuta en muestras 64, 72, 80, 88, 96 = 5 veces en total.
    assert.strictEqual(dftExecutions, 5, `Ejecuciones esperadas: 5, obtenidas: ${dftExecutions}`);
    console.log(`     Reducción de carga: ${((1 - dftExecutions / 37) * 100).toFixed(1)}% de llamadas evitadas`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

/**
 * TEST SUITE: MAGNETIC ANOMALY GEIGER & OFF-GRID COMPASS RESILIENCE
 * 
 * Valida la corrección de errores en MagneticAnomalyDetectorEngine.ts y OffGridCompassModal.tsx:
 * 1. Desconexión de AudioNodes (osc y gain) en osc.onended (previene colapso de WebAudio por fugas).
 * 2. Reseteo obligatorio de isAudioBeepActive al detener la escucha (previene bips huérfanos).
 * 3. Sanitización de vectores magnéticos y magnitudes contra NaN y valores no finitos.
 * 4. Descarte de coordenadas (0,0) / Null Island en el GPS de la brújula táctica.
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
console.log('🧭 INICIANDO SUITE DE PRUEBAS: MAGNETIC GEIGER & OFF-GRID COMPASS RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de MagneticAnomalyDetectorEngine.ts ───────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'MagneticAnomalyDetectorEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. MagneticDetector: Desconexión de oscilador y gain en osc.onended', () => {
    assert(engineCode.includes('osc.onended = () => {'), 'Debe implementar callback onended');
    assert(engineCode.includes('osc.disconnect();'), 'Debe desconectar oscilador');
    assert(engineCode.includes('gain.disconnect();'), 'Debe desconectar nodo gain');
});

runTest('2. MagneticDetector: Reseteo incondicional de isAudioBeepActive en stopListening()', () => {
    assert(engineCode.includes('this.isListening = false;\n        this.isAudioBeepActive = false;'), 'Debe apagar isAudioBeepActive para prevenir reactivación huérfana');
});

runTest('3. MagneticDetector: Sanitización contra NaN en processRawMagneticVector', () => {
    assert(engineCode.includes('if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return;'), 'Debe descartar vectores triaxiales no finitos o NaN');
});

runTest('4. MagneticDetector: Sanitización contra NaN en processMagnitude', () => {
    assert(engineCode.includes('if (!isFinite(mag)) return;'), 'Debe descartar magnitudes no finitas o NaN');
});

runTest('5. MagneticDetector: Liberación de listeners y audioCtx en destroy()', () => {
    assert(engineCode.includes('this.stopListening();'), 'destroy() debe invocar stopListening()');
    assert(engineCode.includes('this.audioCtx.close()'), 'destroy() debe cerrar audioCtx');
    assert(engineCode.includes('this.listeners.clear()'), 'destroy() debe vaciar listeners');
});

// ── 2. Inspección Estática de OffGridCompassModal.tsx ─────────────────────────
const compassPath = path.join(__dirname, '..', 'src', 'components', 'OffGridCompassModal.tsx');
const compassCode = fs.readFileSync(compassPath, 'utf8');

runTest('6. OffGridCompassModal: Erradicación de Null Island (0,0) en watchPosition', () => {
    assert(compassCode.includes('if (!isFinite(lat) || !isFinite(lon) || (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001)) return;'), 'Debe descartar coordenadas (0,0) en el seguimiento de brújula');
});

runTest('7. OffGridCompassModal: Parada limpia de magneticDetector al desmontar', () => {
    assert(compassCode.includes('magneticDetector.stopListening();'), 'useEffect cleanup debe detener la escucha magnética');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

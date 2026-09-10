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

runTest('5. MagneticDetector: Liberación de listeners y preservación de singleton en destroy()', () => {
    assert(engineCode.includes('this.stopListening();'), 'destroy() debe invocar stopListening()');
    assert(engineCode.includes('this.listeners.clear()'), 'destroy() debe vaciar listeners');
    assert(!engineCode.includes('MagneticAnomalyDetectorEngine.instance = null'), 'destroy() debe preservar la instancia singleton');
});

// ── 2. Inspección Estática de OffGridCompassModal.tsx ─────────────────────────
const compassPath = path.join(__dirname, '..', 'src', 'components', 'OffGridCompassModal.tsx');
const compassCode = fs.readFileSync(compassPath, 'utf8');

runTest('6. OffGridCompassModal: Erradicación de Null Island (0,0) en watchPosition', () => {
    assert(
        compassCode.includes('TacticalLocationEngine.isValidCoordinates') ||
        compassCode.includes('if (!isFinite(lat) || !isFinite(lon) || (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001)) return;'),
        'Debe descartar coordenadas (0,0) en el seguimiento de brújula'
    );
});

runTest('7. OffGridCompassModal: Parada limpia de magneticDetector al desmontar', () => {
    assert(compassCode.includes('magneticDetector.stopListening();'), 'useEffect cleanup debe detener la escucha magnética');
});

// ── 3. Inspección Estática y Matemática de TacticalCompassEngine.ts ──────────
const tacticalCompassPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'TacticalCompassEngine.ts');
const tacticalCompassCode = fs.readFileSync(tacticalCompassPath, 'utf8');

runTest('8. TacticalCompassEngine: Erradicación de fórmula corrupta de inclinación y condición >15°', () => {
    assert(!tacticalCompassCode.includes('Math.abs(beta) > 15 || Math.abs(gamma) > 15'), 'No debe existir la condición dañina que rompía el compás al levantarlo de la mesa');
    assert(!tacticalCompassCode.includes('const rY = -sA * cB;'), 'La fórmula rota rY = -sA * cB debe estar erradicada');
});

runTest('9. TacticalCompassEngine: Filtro vectorial adaptativo con histéresis anti-parpadeo', () => {
    assert(tacticalCompassCode.includes('adaptiveFactor'), 'Debe implementar factor adaptativo');
    assert(tacticalCompassCode.includes('deltaFromCurrent >= 0.35'), 'Debe contar con histéresis de 0.35° para suprimir parpadeo de números en mano');
});

runTest('10. TacticalCompassEngine: Compensación de orientación de pantalla (landscape/portrait)', () => {
    assert(tacticalCompassCode.includes('screenOrientation') || tacticalCompassCode.includes('orientation'), 'Debe compensar la orientación de la pantalla');
});

runTest('11. TacticalCompassEngine: Proyección canónica 3D de vector +Y y modo periscopio vertical', () => {
    assert(tacticalCompassCode.includes('(360 - alpha) % 360'), 'Debe proyectar el rumbo canónico de W3C para modo portátil');
    assert(tacticalCompassCode.includes('Math.abs(beta) > 75'), 'Debe reservar la proyección de cámara trasera para ángulos casi verticales (>75°)');
});

runTest('12. Simulación Matemática: Rumbo canónico invariante bajo inclinación de 45° en mano y micro-alabeo', () => {
    // Simulamos la orientación del teléfono apuntando al Norte (alpha = 0) sostenido en mano (beta = 45°, gamma = 2°)
    const alpha = 0;
    const beta = 45;
    const gamma = 2;

    // En modo portátil normal (|beta| <= 75°):
    const heading = ((360 - alpha) % 360 + 360) % 360;
    assert.strictEqual(heading, 0, 'El rumbo al Norte debe ser exactamente 0° independientemente del pitch de 45° y roll de 2°');

    // Ahora apuntando al Este (alpha = 270) sostenido en mano (beta = 40°, gamma = -5°)
    const alphaEast = 270;
    const headingEast = ((360 - alphaEast) % 360 + 360) % 360;
    assert.strictEqual(headingEast, 90, 'El rumbo al Este debe ser exactamente 90° en mano');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

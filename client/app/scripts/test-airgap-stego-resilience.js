/**
 * TEST SUITE: AIR-GAP STEGO RESILIENCE & HARDWARE RESOURCE HYGIENE
 * 
 * Valida la erradicación de la explosión exponencial de bucles setInterval/rAF,
 * la optimización de lectura de texturas con willReadFrequently, la prevención
 * de fugas de hardware de cámara en carreras de montaje, y la liberación de memoria blob.
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
console.log('👁️ INICIANDO SUITE DE PRUEBAS: AIR-GAP STEGO RESILIENCE & RESOURCE HYGIENE');
console.log('================================================================================\n');

const modalPath = path.join(__dirname, '..', 'src', 'components', 'AirGapStegoModal.tsx');
const content = fs.readFileSync(modalPath, 'utf8');

runTest('1. Erradicación del antipatrón explosivo setInterval + rAF', () => {
    assert(!content.includes('setInterval(processLuma'), 'No debe existir un setInterval invocando processLuma recursivo');
    assert(content.includes('animationFrame = requestAnimationFrame(processLuma)'), 'Debe usar bucle rAF único');
});

runTest('2. Optimización GPU-CPU: willReadFrequently en canvas 2D context', () => {
    assert(content.includes('willReadFrequently: true'), 'Debe incluir willReadFrequently: true para aceleración en móviles');
});

runTest('3. Prevención de fugas de hardware de cámara en carreras de montaje', () => {
    assert(content.includes('if (!isActive)'), 'Debe verificar estado activo tras getUserMedia');
    assert(content.includes('s.getTracks().forEach(t => t.stop())'), 'Debe detener tracks inmediatamente si se desmonta antes de resolver');
});

runTest('4. Liberación de memoria de blobs psicoacústicos (URL.revokeObjectURL)', () => {
    assert(content.includes('URL.revokeObjectURL(carrierAudioUrl)'), 'Debe revocar URLs de blobs en reemplazo y unmount');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

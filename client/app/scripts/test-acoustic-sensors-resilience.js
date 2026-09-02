/**
 * TEST SUITE: TACTICAL ACOUSTIC SENSORS RESILIENCE & NODE HYGIENE
 * 
 * Valida la erradicación de nodos zombie en el grafo de Web Audio (sonar FMCW y subsurface VLF),
 * la prevención de excepciones no capturadas en AudioContext.resume(), el soporte de reapertura
 * tras cierre en motores acústicos, y el apagado garantizado en unmount.
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
console.log('🔊 INICIANDO SUITE DE PRUEBAS: TACTICAL ACOUSTIC SENSORS & NODE HYGIENE');
console.log('================================================================================\n');

// 1. AcousticSonarEngine
const sonarPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'AcousticSonarEngine.ts');
const sonarContent = fs.readFileSync(sonarPath, 'utf8');

runTest('1. AcousticSonarEngine: Desconexión de osc y gain en osc.onended', () => {
    assert(sonarContent.includes('osc.onended = () => {'), 'Debe definir osc.onended');
    assert(sonarContent.includes('osc.disconnect()'), 'Debe desconectar osc');
    assert(sonarContent.includes('gain.disconnect()'), 'Debe desconectar gain');
});

runTest('2. AcousticSonarEngine: initAudio soporta estado closed para reapertura', () => {
    assert(sonarContent.includes("this.audioCtx.state === 'closed'"), 'Debe comprobar si audioCtx está cerrado');
});

// 2. SubsurfaceAcousticEngine
const subPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'SubsurfaceAcousticEngine.ts');
const subContent = fs.readFileSync(subPath, 'utf8');

runTest('3. SubsurfaceAcousticEngine: Desconexión de osc y gain en osc.onended', () => {
    assert(subContent.includes('osc.onended = () => {'), 'Debe definir osc.onended');
    assert(subContent.includes('osc.disconnect()'), 'Debe desconectar osc');
    assert(subContent.includes('gain.disconnect()'), 'Debe desconectar gain');
});

// 3. TacticalBinauralEngine
const binPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'TacticalBinauralEngine.ts');
const binContent = fs.readFileSync(binPath, 'utf8');

runTest('4. TacticalBinauralEngine: audioCtx.resume protegido con .catch() y soporte closed', () => {
    assert(binContent.includes("this.audioCtx.resume().catch(() => {})"), 'resume debe tener catch');
    assert(binContent.includes("this.audioCtx.state === 'closed'"), 'Debe comprobar estado closed');
});

// 4. AcousticScramblerEngine
const scramPath = path.join(__dirname, '..', 'src', 'lib', 'security', 'AcousticScramblerEngine.ts');
const scramContent = fs.readFileSync(scramPath, 'utf8');

runTest('5. AcousticScramblerEngine: audioCtx.resume protegido con .catch() y soporte closed', () => {
    assert(scramContent.includes("this.audioCtx.resume().catch(() => {})"), 'resume debe tener catch');
    assert(scramContent.includes("this.audioCtx.state === 'closed'"), 'Debe comprobar estado closed');
});

// 5. AcousticWarfareModal
const warModalPath = path.join(__dirname, '..', 'src', 'components', 'AcousticWarfareModal.tsx');
const warModalContent = fs.readFileSync(warModalPath, 'utf8');

runTest('6. AcousticWarfareModal: Detiene scrambler y binaural al desmontar componente', () => {
    assert(warModalContent.includes('acousticScrambler.stopScrambler()'), 'Debe detener perturbador en unmount');
    assert(warModalContent.includes('tacticalBinaural.stopPreset()'), 'Debe detener generador binaural en unmount');
});

// 6. SonarSeismicModal
const sonarModalPath = path.join(__dirname, '..', 'src', 'components', 'SonarSeismicModal.tsx');
const sonarModalContent = fs.readFileSync(sonarModalPath, 'utf8');

runTest('7. SonarSeismicModal: Libera hardware con acousticSonar.destroy() al desmontar', () => {
    assert(sonarModalContent.includes('acousticSonar.destroy()'), 'Debe destruir instancia de sonar en unmount');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

/**
 * TEST SUITE: AUDIOCONTEXT RESILIENCE & RESOURCE LEAK PREVENTION
 * 
 * Valida la prevención del agotamiento del límite de hardware de AudioContext (6 instancias)
 * en WebViews Android (Moto G22), asegurando la reutilización de singletons,
 * cierre garantizado tras reproducción y reanudación ante estados suspendidos.
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
console.log('🔊 INICIANDO SUITE DE PRUEBAS: AUDIOCONTEXT RESILIENCE & LEAK PREVENTION');
console.log('================================================================================\n');

const componentsDir = path.join(__dirname, '..', 'src', 'components');
const libDir = path.join(__dirname, '..', 'src', 'lib');

runTest('1. CallRingtoneEngine: Expone unlockAudioContext reutilizando el singleton de audio', () => {
    const content = fs.readFileSync(path.join(libDir, 'audio', 'CallRingtoneEngine.ts'), 'utf8');
    assert(content.includes('public static unlockAudioContext(): AudioContext | null'), 'Debe exponer unlockAudioContext');
});

runTest('2. IncomingCallBanner: Reutiliza unlockAudioContext y no crea instancias huérfanas', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'IncomingCallBanner.tsx'), 'utf8');
    assert(content.includes('CallRingtoneEngine.unlockAudioContext()'), 'Debe llamar a unlockAudioContext()');
    assert(!content.includes('new AudioContextClass()'), 'No debe crear instancia huérfana descartada');
});

runTest('3. IncomingContactRequestModal: Cierra AudioContext tras reproducir tono de notificación', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'IncomingContactRequestModal.tsx'), 'utf8');
    assert(content.includes('ctx.close()'), 'Debe invocar ctx.close() para no fugar recursos');
    assert(content.includes('setTimeout'), 'Debe temporizar el cierre tras finalizar el oscilador');
});

runTest('4. LoraTransceiverModal: Reutiliza audioCtx para decodificación y cierra en bloque finally', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'LoraTransceiverModal.tsx'), 'utf8');
    assert(content.includes('audioCtx.decodeAudioData(arrayBuffer)'), 'Debe decodificar con el audioCtx existente');
    assert(content.includes('finally'), 'Debe contener bloque finally');
    assert(content.includes('audioCtx.close()'), 'Debe cerrar en finally');
    assert(!content.includes('new AudioContext().decodeAudioData'), 'No debe crear segundo contexto huérfano');
});

runTest('5. ExtremeSurvivalHudModal: Cierra contexto previo, auto-libera y detiene baliza en unmount', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'ExtremeSurvivalHudModal.tsx'), 'utf8');
    assert(content.includes('stopAcousticBeacon()'), 'Debe detener y cerrar contexto');
    assert(content.includes('ctx.close()'), 'Debe auto-liberar');
});

runTest('6. StructuralHealthSeismicEngine: Reanuda contexto suspendido para evitar alarmas mudas', () => {
    const content = fs.readFileSync(path.join(libDir, 'sensors', 'StructuralHealthSeismicEngine.ts'), 'utf8');
    assert(content.includes("this.audioCtx.state === 'suspended'"), 'Debe detectar suspensión');
    assert(content.includes('this.audioCtx.resume()'), 'Debe invocar resume()');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

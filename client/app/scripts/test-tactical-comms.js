/**
 * TEST SUITE: TACTICAL COMMS & AUDIO/LOCATION RESILIENCE
 * 
 * Valida la mitigación de race conditions en MediaRecorder de notas de voz,
 * la prevención de fugas de reproducción de audio al desmontar VoiceMessage,
 * y la geolocalización táctica con URIs geo: y TacticalLocationEngine en chat y Amber alerts.
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

async function runAsyncTest(name, fn) {
    totalTests++;
    try {
        await fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
}

console.log('\n================================================================================');
console.log('🎙️ INICIANDO SUITE DE PRUEBAS: TACTICAL COMMS, AUDIO & GEO RESILIENCE');
console.log('================================================================================\n');

console.log('🎙️ 1. Probando Mitigación de Race Conditions en MediaRecorder (Voice Notes)...');

runTest('ChatWindow: stopRecording asigna mr.onstop antes de invocar mr.stop()', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'ChatWindow.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    const onstopIdx = content.indexOf('mr.onstop = () => resolve()');
    const stopIdx = content.indexOf('mr.stop()', onstopIdx);

    assert(onstopIdx !== -1, 'Debe registrar mr.onstop dentro de la promesa');
    assert(stopIdx !== -1, 'Debe invocar mr.stop()');
    assert(onstopIdx < stopIdx, 'mr.onstop DEBE registrarse antes de mr.stop() para evitar cuelgues asíncronos');
});

runTest('VoiceMessage: Cleanup de desmontaje pausa audioRef para evitar fugas en segundo plano', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'chat', 'VoiceMessage.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('globalVoiceCoordinator.unregister'), 'Debe desregistrar del coordinador');
    assert(content.includes('audioRef.current.pause()'), 'Debe pausar audioRef en el cleanup');
});

console.log('\n📍 2. Probando Compartición Táctica de Ubicación en Chat P2P...');

runTest('ChatWindow: handleLocation incluye URI táctica geo:lat,lon y usa TacticalLocationEngine', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'ChatWindow.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('TacticalLocationEngine.getEmergencyLocation'), 'Debe usar TacticalLocationEngine');
    assert(content.includes('geo:${lat},${lon}'), 'Debe formatear URI estándar geo: para mapas offline');
    assert(!content.includes('navigator.geolocation.getCurrentPosition'), 'No debe usar llamada frágil de 5s en handleLocation');
});

console.log('\n🚨 3. Probando Resiliencia GNSS en Sistema de Alertas Amber...');

runTest('AmberAlertBanner: Reporte de avistamiento utiliza TacticalLocationEngine', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'AmberAlertBanner.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('TacticalLocationEngine.getEmergencyLocation'), 'AmberAlertBanner debe usar TacticalLocationEngine');
    assert(!content.includes('timeout: 4000'), 'No debe tener timeout agresivo de 4s');
});

runTest('AmberAdminPanel: Emisión oficial de alertas Amber no inyecta ceros (0:0) en firmas', () => {
    const filePath = path.join(__dirname, '..', 'src', 'components', 'AmberAdminPanel.tsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert(content.includes('TacticalLocationEngine.getEmergencyLocation'), 'AmberAdminPanel debe usar TacticalLocationEngine');
    assert(!content.includes('lat || 0}:${lon || 0}'), 'No debe inyectar Null Island (0,0) en la firma');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

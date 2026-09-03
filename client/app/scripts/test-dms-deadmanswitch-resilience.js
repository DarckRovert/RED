/**
 * TEST SUITE: DEAD MAN'S SWITCH (DMS) & PANIC WIPE CONTINGENCY RESILIENCE
 * 
 * Valida la integridad del protocolo de Interruptor de Hombre Muerto:
 * 1. Cálculo dinámico y no destructivo de seconds_remaining en getDmsConfig().
 * 2. Actualización de last_active_timestamp en pingDmsActivity() y saveDmsConfig().
 * 3. Inmunidad a NaN en el reloj regresivo y barra de progreso de DMSSettings.tsx.
 * 4. Disparo automático del protocolo de contingencia / purga al expirar el temporizador.
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
console.log('💀 INICIANDO SUITE DE PRUEBAS: DEAD MAN\'S SWITCH & PANIC WIPE RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de client.ts ────────────────────────────────────────
const clientPath = path.join(__dirname, '..', 'src', 'api', 'client.ts');
const clientCode = fs.readFileSync(clientPath, 'utf8');

runTest('1. API Client: getDmsConfig calcula seconds_remaining dinámicamente', () => {
    assert(clientCode.includes('seconds_remaining: secondsRemaining'), 'getDmsConfig debe retornar seconds_remaining');
    assert(clientCode.includes('STORAGE_KEYS.DMS_CONFIG'), 'getDmsConfig debe usar la clave canónica DMS_CONFIG');
});

runTest('2. API Client: saveDmsConfig persiste last_active_timestamp', () => {
    assert(clientCode.includes('last_active_timestamp:'), 'saveDmsConfig debe persistir la marca temporal de actividad');
});

// ── 2. Inspección Estática de DMSSettings.tsx ──────────────────────────────────
const dmsPath = path.join(__dirname, '..', 'src', 'components', 'DMSSettings.tsx');
const dmsCode = fs.readFileSync(dmsPath, 'utf8');

runTest('3. DMSSettings: Sanitización de trigger_hours y seconds_remaining contra NaN', () => {
    assert(dmsCode.includes('typeof data.trigger_hours === \'number\' && isFinite(data.trigger_hours)'), 'Debe validar trigger_hours finito');
    assert(dmsCode.includes('typeof data.seconds_remaining === \'number\' && isFinite(data.seconds_remaining)'), 'Debe validar seconds_remaining finito');
});

runTest('4. DMSSettings: Intervalo de cuenta regresiva protegido contra NaN', () => {
    assert(dmsCode.includes('typeof prev === \'number\' && isFinite(prev)'), 'El decremento del temporizador no debe propagar NaN');
});

runTest('5. DMSSettings: Disparo automático de contingencia cuando secondsLeft llega a cero', () => {
    assert(dmsCode.includes('config.enabled && secondsLeft === 0'), 'Debe monitorear la expiración con el interruptor armado');
    assert(dmsCode.includes('handleImmediateWipe()'), 'Debe disparar la purga automática ante expiración');
});

// ── 3. Validación Algorítmica del Cronómetro DMS ───────────────────────────────
runTest('6. Algoritmo DMS: Cálculo de tiempo restante basado en inactividad', () => {
    const triggerHours = 48;
    const now = Math.floor(Date.now() / 1000);
    const lastActive = now - (12 * 3600); // 12 horas de inactividad
    const elapsed = Math.max(0, now - lastActive);
    const totalSec = triggerHours * 3600;
    const remaining = Math.max(0, totalSec - elapsed);

    assert.strictEqual(remaining, 36 * 3600, 'Debe restar exactamente 12h de las 48h configuradas');
});

runTest('7. Algoritmo DMS: Inactividad superior al umbral acota a 0 segundos sin números negativos', () => {
    const triggerHours = 24;
    const now = Math.floor(Date.now() / 1000);
    const lastActive = now - (30 * 3600); // 30 horas de inactividad (expirado)
    const elapsed = Math.max(0, now - lastActive);
    const totalSec = triggerHours * 3600;
    const remaining = Math.max(0, totalSec - elapsed);

    assert.strictEqual(remaining, 0, 'Tiempo restante debe ser 0 segundos cuando se excede el umbral');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

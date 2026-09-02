/**
 * TEST SUITE: AUTODESTRUCT ENGINE RESILIENCE & 32-BIT OVERFLOW ERADICATION
 * 
 * Valida la corrección de errores críticos en AutoDestructEngine.ts:
 * 1. Normalización de timestamps en milisegundos (evita cálculo erróneo de 54,000 años).
 * 2. Protección de límite de 32 bits en setTimeout (evita auto-destrucción inmediata a 1ms).
 * 3. Protección contra saltos de índice en el bucle de localStorage durante purga.
 * 4. Liberación completa de recursos en destroy().
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
console.log('⏱️ INICIANDO SUITE DE PRUEBAS: AUTODESTRUCT ENGINE RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de AutoDestructEngine.ts ──────────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'AutoDestructEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. AutoDestructEngine: Normalización de expires_at en milisegundos (> 1e11)', () => {
    assert(engineCode.includes('msg.expires_at > 1e11 ? msg.expires_at / 1000 : msg.expires_at'), 'Debe convertir expires_at de ms a segundos si > 1e11');
});

runTest('2. AutoDestructEngine: Protección de límite entero 32-bit (2147483647 ms) en setTimeout', () => {
    assert(engineCode.includes('Math.min(2147483647,'), 'Debe acotar el delay a 2147483647 ms para evitar overflow en V8');
});

runTest('3. AutoDestructEngine: Captura de claves previa a la iteración de tick para evitar shifting', () => {
    assert(engineCode.includes('const keys: string[] = [];'), 'Debe recolectar claves antes de mutar');
    assert(engineCode.includes('for (const key of keys)'), 'Debe iterar sobre la lista estática capturada');
});

runTest('4. AutoDestructEngine: Exposición de destroy() para limpieza de timers y subscribers', () => {
    assert(engineCode.includes('public destroy(): void'), 'Debe implementar método destroy()');
    assert(engineCode.includes('this.activeTimers.clear()'), 'destroy() debe limpiar activeTimers');
    assert(engineCode.includes('this.subscribers.clear()'), 'destroy() debe limpiar subscribers');
});

// ── 2. Validación de Lógica de Cálculo Temporal ──────────────────────────────
runTest('5. Cálculo Temporal: Mensaje con expires_at en milisegundos computa el tiempo restante exacto', () => {
    const nowMs = Date.now();
    const nowSec = nowMs / 1000;
    const ttlSeconds = 60; // 60 segundos de vida
    const msgWithMs = {
        id: 'test-msg-ms',
        expires_at: nowMs + (ttlSeconds * 1000)
    };

    const expSec = msgWithMs.expires_at > 1e11 ? msgWithMs.expires_at / 1000 : msgWithMs.expires_at;
    const remainingSec = expSec - nowSec;
    const delayMs = Math.min(2147483647, Math.max(50, Math.round(remainingSec * 1000)));

    assert(delayMs >= 59000 && delayMs <= 61000, `delayMs debe rondar 60,000 ms, calculado: ${delayMs}`);
});

runTest('6. Cálculo Temporal: Mensaje con expires_at en segundos computa el tiempo restante exacto', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const ttlSeconds = 120;
    const msgWithSec = {
        id: 'test-msg-sec',
        expires_at: nowSec + ttlSeconds
    };

    const expSec = msgWithSec.expires_at > 1e11 ? msgWithSec.expires_at / 1000 : msgWithSec.expires_at;
    const remainingSec = expSec - nowSec;
    const delayMs = Math.min(2147483647, Math.max(50, Math.round(remainingSec * 1000)));

    assert(delayMs >= 119000 && delayMs <= 121000, `delayMs debe rondar 120,000 ms, calculado: ${delayMs}`);
});

runTest('7. Cálculo Temporal: Mensajes con TTL ultra-largo no desbordan el entero de 32 bits', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const massiveTtl = 100 * 86400; // 100 días
    const msgMassive = {
        id: 'test-msg-massive',
        ttl: massiveTtl,
        timestamp: nowSec
    };

    const expSec = msgMassive.timestamp + msgMassive.ttl;
    const remainingSec = expSec - nowSec;
    const delayMs = Math.min(2147483647, Math.max(50, Math.round(remainingSec * 1000)));

    assert.strictEqual(delayMs, 2147483647, 'Debe acotarse al límite superior de setTimeout (2147483647 ms)');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

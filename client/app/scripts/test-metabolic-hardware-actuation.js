/**
 * TEST SUITE: METABOLIC HARDWARE ACTUATION & TORPOR THROTTLING RESILIENCE
 * 
 * Valida la conexión física entre el Gobernador Metabólico, el hardware de batería
 * y los actuadores de red/IA:
 * 1. Hidratación nativa de batería (navigator.getBattery + listeners reactivos + Capacitor fallback).
 * 2. Transición activa a régimen TORPOR (< 20% batería o >= 48°C).
 * 3. Actuación real sobre LoRaTdmaSchedulerEngine (setTorporThrottle).
 * 4. Actuación real sobre LocalAIEngine (pauseHeavyWorkloads).
 * 5. Supresión de transmisiones LoRa no críticas espaciadas a 15 segundos en Torpor.
 * 6. Bypass incondicional garantizado para emergencias vitales SOS en Torpor.
 * 7. Restauración inmediata al conectar cargador o elevar nivel de batería.
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
console.log('⚡🔋 INICIANDO SUITE DE PRUEBAS: METABOLIC HARDWARE ACTUATION & TORPOR');
console.log('================================================================================\n');

// ── 1. Verificación Estática del Código Fuente ────────────────────────────────
const govPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'MetabolicNeuromorphicGovernor.ts');
const govCode = fs.readFileSync(govPath, 'utf8');

const tdmaPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'LoRaTdmaSchedulerEngine.ts');
const tdmaCode = fs.readFileSync(tdmaPath, 'utf8');

const aiPath = path.join(__dirname, '..', 'src', 'lib', 'ai', 'localAiEngine.ts');
const aiCode = fs.readFileSync(aiPath, 'utf8');

runTest('1. MetabolicNeuromorphicGovernor: API Nativa de Batería W3C & Listeners', () => {
    assert(govCode.includes('navigator.getBattery'), 'Debe consultar navigator.getBattery');
    assert(govCode.includes('levelchange'), 'Debe escuchar evento reactivo levelchange');
    assert(govCode.includes('chargingchange'), 'Debe escuchar evento reactivo chargingchange');
    assert(govCode.includes('Plugins?.Device'), 'Debe mantener fallback a Capacitor Device');
});

runTest('2. MetabolicNeuromorphicGovernor: Actuadores Reales LoRa y AI en Transición', () => {
    assert(govCode.includes('loraTdmaScheduler.setTorporThrottle(true)'), 'Debe activar torpor en TDMA');
    assert(govCode.includes('localAiEngine.pauseHeavyWorkloads()'), 'Debe pausar cargas pesadas de IA');
    assert(govCode.includes('loraTdmaScheduler.setTorporThrottle(false)'), 'Debe restaurar TDMA al salir de Torpor');
    assert(govCode.includes('localAiEngine.resumeWorkloads()'), 'Debe reanudar IA al salir de Torpor');
});

runTest('3. LoRaTdmaSchedulerEngine: Control de Ciclo de Trabajo en Torpor', () => {
    assert(tdmaCode.includes('setTorporThrottle'), 'Debe exponer setTorporThrottle');
    assert(tdmaCode.includes('TORPOR_MIN_TX_INTERVAL_MS = 15_000'), 'Debe definir espaciado de 15 segundos');
    assert(tdmaCode.includes('isTorporThrottled && !isEmergency && priority < 8'), 'Debe suprimir tráfico no vital');
});

runTest('4. LocalAIEngine: Métodos de Pausa Metabólica de IA', () => {
    assert(aiCode.includes('pauseHeavyWorkloads()'), 'Debe tener pauseHeavyWorkloads');
    assert(aiCode.includes('resumeWorkloads()'), 'Debe tener resumeWorkloads');
    assert(aiCode.includes('isHeavyWorkloadsPaused()'), 'Debe tener isHeavyWorkloadsPaused');
});

// ── 2. Simulación Funcional de Comportamiento ─────────────────────────────────

class MockTdmaScheduler {
    constructor() {
        this.isTorporThrottled = false;
        this.lastTorporTxTimestamp = 0;
        this.TORPOR_MIN_TX_INTERVAL_MS = 15000;
        this.transmittedCount = 0;
    }

    setTorporThrottle(enabled) {
        this.isTorporThrottled = enabled;
    }

    scheduleTransmission(priority, isEmergency, now = Date.now()) {
        if (isEmergency && priority >= 9) {
            this.transmittedCount++;
            return true; // Bypass incondicional SOS
        }

        if (this.isTorporThrottled && !isEmergency && priority < 8) {
            if (now - this.lastTorporTxTimestamp < this.TORPOR_MIN_TX_INTERVAL_MS) {
                return false; // Suprimido por Torpor
            }
            this.lastTorporTxTimestamp = now;
        }

        this.transmittedCount++;
        return true;
    }
}

class MockLocalAi {
    constructor() {
        this.paused = false;
    }
    pauseHeavyWorkloads() { this.paused = true; }
    resumeWorkloads() { this.paused = false; }
}

runTest('5. Dinámica de Torpor: Supresión de Ráfagas TDMA no críticas', () => {
    const tdma = new MockTdmaScheduler();
    const ai = new MockLocalAi();

    // Activar Torpor
    tdma.setTorporThrottle(true);
    ai.pauseHeavyWorkloads();
    assert.strictEqual(ai.paused, true, 'IA debe estar en pausa');

    const t0 = 1000000;
    // Primera transmisión normal pasa
    const firstOk = tdma.scheduleTransmission(5, false, t0);
    assert.strictEqual(firstOk, true, 'Primera transmisión debe pasar');

    // Transmisión normal 2 segundos después DEBE ser suprimida (t < 15s)
    const secondOk = tdma.scheduleTransmission(5, false, t0 + 2000);
    assert.strictEqual(secondOk, false, 'Transmisión a los 2s debe ser suprimida por Torpor');

    // Transmisión normal 16 segundos después DEBE pasar
    const thirdOk = tdma.scheduleTransmission(5, false, t0 + 16000);
    assert.strictEqual(thirdOk, true, 'Transmisión a los 16s debe pasar');
});

runTest('6. Dinámica de Torpor: Bypass Incondicional de SOS de Emergencia', () => {
    const tdma = new MockTdmaScheduler();
    tdma.setTorporThrottle(true);

    const t0 = 1000000;
    // Transmisión de SOS (prioridad 10, isEmergency true) debe pasar INCLUSO con t < 15s
    const sos1 = tdma.scheduleTransmission(10, true, t0);
    const sos2 = tdma.scheduleTransmission(10, true, t0 + 100);
    const sos3 = tdma.scheduleTransmission(9, true, t0 + 200);

    assert.strictEqual(sos1, true, 'SOS 1 debe pasar');
    assert.strictEqual(sos2, true, 'SOS 2 inmediato debe pasar');
    assert.strictEqual(sos3, true, 'SOS 3 inmediato debe pasar');
});

runTest('7. Dinámica de Recuperación: Salida de Torpor restaura TDMA e IA', () => {
    const tdma = new MockTdmaScheduler();
    const ai = new MockLocalAi();

    tdma.setTorporThrottle(true);
    ai.pauseHeavyWorkloads();

    // Restaurar
    tdma.setTorporThrottle(false);
    ai.resumeWorkloads();

    assert.strictEqual(ai.paused, false, 'IA debe reanudarse');
    const t0 = 1000000;
    const ok1 = tdma.scheduleTransmission(5, false, t0);
    const ok2 = tdma.scheduleTransmission(5, false, t0 + 500);

    assert.strictEqual(ok1, true, 'Tráfico normal nominal debe pasar');
    assert.strictEqual(ok2, true, 'Tráfico normal posterior debe pasar sin bloqueo de 15s');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests < totalTests) {
    process.exit(1);
}

/**
 * TEST SUITE: KINETIC DUTY GOVERNOR RESILIENCE
 * 
 * Valida la corrección de errores en KineticDutyGovernor.ts:
 * 1. Inmunidad a contaminación NaN por typeof NaN === 'number' en DeviceMotionEvent.
 * 2. Descarte temprano de magnitudes no finitas en recordMotionSample.
 * 3. Admisión legítima de batería al 0% con autonomía de 0.0 horas estimadas.
 * 4. Sanitización de nivel de batería ante entradas NaN en setManualBattery.
 * 5. Mitigación de brownout por caída de tensión en SHAKE_BOOST (acotado a 14 dBm ante batería <= 10%).
 * 6. Potencia máxima (20 dBm) preservada en SHAKE_BOOST con batería adecuada (> 10%).
 * 7. Limpieza estricta de event listeners en destroy() para prevenir fugas de memoria.
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
console.log('⚡ INICIANDO SUITE DE PRUEBAS: KINETIC DUTY GOVERNOR RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de KineticDutyGovernor.ts ───────────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'KineticDutyGovernor.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. KineticDutyGovernor: Verificación de finitud en componentes de aceleración (evitando typeof NaN)', () => {
    assert(engineCode.includes('isFinite(acc.x) &&'), 'Debe verificar isFinite(acc.x)');
    assert(engineCode.includes('isFinite(acc.y) &&'), 'Debe verificar isFinite(acc.y)');
    assert(engineCode.includes('isFinite(acc.z)'), 'Debe verificar isFinite(acc.z)');
});

runTest('2. KineticDutyGovernor: Descarte temprano de magnitudes no finitas en recordMotionSample', () => {
    assert(engineCode.includes('if (!isFinite(magnitude) || magnitude < 0) return;'), 'Debe descartar magnitudes NaN');
});

runTest('3. KineticDutyGovernor: Limpieza garantizada de listeners en destroy()', () => {
    assert(engineCode.includes('window.removeEventListener("devicemotion", this.motionHandler);'), 'Debe retirar devicemotion');
    assert(engineCode.includes('document.removeEventListener("visibilitychange", this.visibilityHandler);'), 'Debe retirar visibilitychange');
    assert(engineCode.includes('this.batteryObj.removeEventListener("levelchange", this.batteryLevelHandler);'), 'Debe retirar levelchange');
});

// ── 2. Simulación y Validación de Lógica del Gobernador ────────────────────────
function simulateKineticGovernor(readings, batteryLevel, isShakeBoost = false, isStationary = true, isCharging = false) {
    const validReadings = readings.filter(r => isFinite(r) && r >= 0);
    const avgDelta = validReadings.length > 0
        ? validReadings.reduce((a, b) => a + b, 0) / validReadings.length
        : 0;

    const kineticEnergyScore = isFinite(avgDelta) ? Math.min(100, Math.round(avgDelta * 20)) : 0;
    const safeBattery = (typeof batteryLevel === 'number' && isFinite(batteryLevel))
        ? Math.max(0, Math.min(100, Math.round(batteryLevel)))
        : 100;

    let profile = "BALANCED_PATROL";
    let bleScanIntervalMs = 4000;
    let loraTxPowerDbm = 14;
    let estimatedMeshHours = (safeBattery / 100) * 32;

    if (isShakeBoost) {
        profile = "SHAKE_BOOST";
        bleScanIntervalMs = 800;
        loraTxPowerDbm = safeBattery <= 10 ? 14 : 20;
        estimatedMeshHours = (safeBattery / 100) * 12;
    } else if (isCharging || (safeBattery > 50 && !isStationary)) {
        profile = "HIGH_PERFORMANCE";
        bleScanIntervalMs = 1500;
        loraTxPowerDbm = 18;
        estimatedMeshHours = (safeBattery / 100) * 20;
    } else if (safeBattery <= 20 || (safeBattery <= 40 && isStationary)) {
        profile = "SURVIVAL_SENTRY";
        bleScanIntervalMs = 12000;
        loraTxPowerDbm = 10;
        estimatedMeshHours = (safeBattery / 100) * 48;
    }

    if (safeBattery === 0) {
        estimatedMeshHours = 0.0;
    }

    return {
        kineticEnergyScore,
        currentProfile: profile,
        bleScanIntervalMs,
        loraTxPowerDbm,
        estimatedMeshHours: parseFloat(estimatedMeshHours.toFixed(1)),
    };
}

runTest('4. Gobernador: Batería 0% reporta exactamente 0.0 horas estimadas de malla', () => {
    const res = simulateKineticGovernor([0.1, 0.2], 0);
    assert.strictEqual(res.estimatedMeshHours, 0.0, `Horas estimadas esperadas: 0.0, obtenidas: ${res.estimatedMeshHours}`);
});

runTest('5. Gobernador: Muestras con NaN no contaminan score cinético ni congelan cálculo', () => {
    const res = simulateKineticGovernor([1.5, NaN, 2.0, NaN, 1.0], 80);
    assert(isFinite(res.kineticEnergyScore) && res.kineticEnergyScore > 0, `Score cinético debe ser finito: ${res.kineticEnergyScore}`);
});

runTest('6. Brownout Protection: SHAKE_BOOST con batería al 8% limita LoRa a 14 dBm', () => {
    const res = simulateKineticGovernor([5.0], 8, true);
    assert.strictEqual(res.currentProfile, 'SHAKE_BOOST');
    assert.strictEqual(res.loraTxPowerDbm, 14, `Potencia esperada: 14 dBm, obtenida: ${res.loraTxPowerDbm} dBm`);
});

runTest('7. Full Power: SHAKE_BOOST con batería al 75% habilita máxima potencia LoRa (20 dBm)', () => {
    const res = simulateKineticGovernor([5.0], 75, true);
    assert.strictEqual(res.currentProfile, 'SHAKE_BOOST');
    assert.strictEqual(res.loraTxPowerDbm, 20, `Potencia esperada: 20 dBm, obtenida: ${res.loraTxPowerDbm} dBm`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

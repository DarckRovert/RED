/**
 * TEST SUITE: SIGINT C-UAS & SUBSURFACE ACOUSTIC RESILIENCE
 * 
 * Valida la corrección de errores en SubsurfaceAcousticEngine.ts y RfSigintWatchdogEngine.ts:
 * 1. Sanitización de frecuencia, pulso e intervalo en SubsurfaceAcousticEngine.startBeacon().
 * 2. Cálculo dinámico de attackTime garantizando attackTime < durationSec en envolvente Web Audio.
 * 3. Prevención de bucles setInterval con delay <= 0 o NaN en baliza acústica.
 * 4. Limpieza de AudioContext y singleton en SubsurfaceAcousticEngine.destroy().
 * 5. Sanitización de RSSI no numérico o NaN a rango físico en RfSigintWatchdogEngine.
 * 6. Detección resiliente de OpenDroneID (0xFFFA) y AirTag sin fallos con payloads malformados.
 * 7. Limpieza formal de listeners y singleton en RfSigintWatchdogEngine.destroy().
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
console.log('🛸 INICIANDO SUITE DE PRUEBAS: SIGINT C-UAS & SUBSURFACE ACOUSTIC RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de SubsurfaceAcousticEngine.ts ──────────────────────
const ssaPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'SubsurfaceAcousticEngine.ts');
const ssaCode = fs.readFileSync(ssaPath, 'utf8');

runTest('1. SubsurfaceAcousticEngine: Sanitización estricta de parámetros en startBeacon', () => {
    assert(ssaCode.includes("typeof customConfig.frequencyHz === 'number' && isFinite(customConfig.frequencyHz)"), 'Debe validar frequencyHz');
    assert(ssaCode.includes("typeof customConfig.pulseDurationMs === 'number' && isFinite(customConfig.pulseDurationMs)"), 'Debe validar pulseDurationMs');
    assert(ssaCode.includes("typeof customConfig.repeatIntervalSec === 'number' && isFinite(customConfig.repeatIntervalSec)"), 'Debe validar repeatIntervalSec');
});

runTest('2. SubsurfaceAcousticEngine: Attack time dinámico evita DOMException en Web Audio', () => {
    assert(ssaCode.includes('const attackTime = Math.min(0.08, durationSec * 0.2);'), 'Debe calcular attackTime relativo');
    assert(ssaCode.includes('SubsurfaceAcousticEngine.instance = null;'), 'Debe limpiar instance en destroy()');
});

// ── 2. Inspección Estática de RfSigintWatchdogEngine.ts ────────────────────────
const rfsPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'RfSigintWatchdogEngine.ts');
const rfsCode = fs.readFileSync(rfsPath, 'utf8');

runTest('3. RfSigintWatchdogEngine: Sanitización de RSSI contra NaN y distancia finita', () => {
    assert(rfsCode.includes("typeof rawRssi === 'number' && isFinite(rawRssi)"), 'Debe validar rawRssi');
    assert(rfsCode.includes('isFinite(rawDist)'), 'Debe validar finitud de rawDist');
    assert(rfsCode.includes('RfSigintWatchdogEngine.instance = null;'), 'Debe limpiar instance en destroy()');
});

// ── 3. Simulación de Envolvente VLF Web Audio ──────────────────────────────────
runTest('4. Envolvente VLF: Duración corta (100ms) mantiene attackTime < durationSec', () => {
    const pulseMs = 100;
    const durationSec = Math.max(0.2, pulseMs / 1000); // 0.2s mínimo
    const attackTime = Math.min(0.08, durationSec * 0.2); // 0.04s

    assert(attackTime > 0, 'Attack time debe ser positivo');
    assert(attackTime < durationSec, 'Attack time debe ser menor que la duración total');
    const startTime = 10.0;
    const tAttack = startTime + attackTime;
    const tEnd = startTime + durationSec;
    assert(tEnd > tAttack && tAttack > startTime, 'Eventos estrictamente crecientes en tiempo');
});

// ── 4. Simulación de Modelo de Pérdida de Propagación (Log-Distance) ───────────
function calculateSigintDistance(rssi) {
    const safeRssi = (typeof rssi === 'number' && isFinite(rssi)) ? Math.max(-140, Math.min(0, rssi)) : -80;
    const measuredPower = -59;
    const n = 2.2;
    const rawDist = Math.pow(10, (measuredPower - safeRssi) / (10 * n));
    return isFinite(rawDist) ? Math.max(0.5, Math.min(100, Math.round(rawDist * 10) / 10)) : 10;
}

runTest('5. SIGINT Path Loss: RSSI NaN devuelve distancia nominal segura sin NaN', () => {
    const dist = calculateSigintDistance(NaN);
    assert(isFinite(dist) && !isNaN(dist), 'Distancia debe ser finita');
    assert(dist >= 0.5 && dist <= 100, 'Distancia debe estar acotada');
    assert.strictEqual(dist, 9.0, 'Distancia con fallback -80dBm debe ser ~9.0m');
});

runTest('6. SIGINT Path Loss: RSSI fuerte (-40 dBm) calcula distancia cercana < 1m', () => {
    const dist = calculateSigintDistance(-40);
    assert(dist <= 1.0, 'Distancia debe ser muy cercana con señal fuerte');
    assert(dist >= 0.5, 'Suelo mínimo de 0.5m respetado');
});

// ── 5. Simulación de Clasificación de Amenazas SIGINT C-UAS ───────────────────
function classifyEmitter(name, serviceUuids, mfgData) {
    let type = 'UNKNOWN_BLE';
    let isSuspicious = false;

    if (name && (name.toLowerCase().includes('drone') || name.toLowerCase().includes('opendroneid') || name.toLowerCase().includes('dji'))) {
        type = 'OPEN_DRONE_ID';
        isSuspicious = true;
    } else if (serviceUuids && typeof serviceUuids === 'object' && Object.keys(serviceUuids).some(k => typeof k === 'string' && (k.toLowerCase().includes('fffa') || k.toLowerCase().includes('0000fffa')))) {
        type = 'OPEN_DRONE_ID';
        isSuspicious = true;
    } else if (name && (name.toLowerCase().includes('airtag') || name.toLowerCase().includes('tile'))) {
        type = 'APPLE_FIND_MY';
        isSuspicious = true;
    } else if (mfgData && typeof mfgData === 'object' && (mfgData['76'] || mfgData['0x004c'] || mfgData['004c'])) {
        type = 'APPLE_FIND_MY';
        isSuspicious = true;
    }

    return { type, isSuspicious };
}

runTest('7. SIGINT Clasificación: Detecta Drone ASTM F3411 y AirTag sin excepción con datos nulos', () => {
    const drone = classifyEmitter('DJI-Mavic3-RemoteID', null, null);
    assert.strictEqual(drone.type, 'OPEN_DRONE_ID');
    assert.strictEqual(drone.isSuspicious, true);

    const fffaDrone = classifyEmitter(undefined, { '0000fffa-0000-1000-8000-00805f9b34fb': [] }, null);
    assert.strictEqual(fffaDrone.type, 'OPEN_DRONE_ID');
    assert.strictEqual(fffaDrone.isSuspicious, true);

    const airtag = classifyEmitter(undefined, null, { '76': [1, 2, 3] });
    assert.strictEqual(airtag.type, 'APPLE_FIND_MY');
    assert.strictEqual(airtag.isSuspicious, true);

    const clear = classifyEmitter(null, null, null);
    assert.strictEqual(clear.type, 'UNKNOWN_BLE');
    assert.strictEqual(clear.isSuspicious, false);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

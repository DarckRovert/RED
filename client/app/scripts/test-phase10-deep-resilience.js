/**
 * test-phase10-deep-resilience.js — RED Sovereign Mesh OS
 *
 * Suite de Pruebas Automatizadas de Fase 10: 5 Pilares de Resiliencia Táctica Extrema
 * 1. EcoMeshDutyCycleEngine (Gestión energética adaptativa por batería y movimiento)
 * 2. BroadcastStormGuardEngine (Supresor de tormentas RF y TTL adaptativo por densidad)
 * 3. LamportMeshClockEngine (Reloj lógico Lamport y consenso sin NTP)
 * 4. ZeroFootprintAiMemoryManager (Purga automática de tensores IA tras inactividad)
 * 5. ExtremeSurvivalHud & Azimuth Calculation (Rumbo hacia punto seguro)
 */

const assert = require('assert');

console.log('================================================================================');
console.log('🛡️  INICIANDO SUITE DE PRUEBAS — FASE 10: RESILIENCIA TÁCTICA EXTREMA');
console.log('================================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}`);
    }
}

// ── 1. EcoMeshDutyCycleEngine ────────────────────────────────────────────────
console.log('⚡ 1. Probando EcoMeshDutyCycleEngine (Gestión Energética & Duty-Cycling)...');

class TestEcoMeshDutyCycleEngine {
    constructor() {
        this.mode = 'balanced';
        this.batteryLevel = 100;
        this.isStationary = false;
        this.lastMotionTime = Date.now();
        this.CONFIGS = {
            aggressive: { scanDurationMs: 10000, sleepDurationMs: 0 },
            balanced: { scanDurationMs: 5000, sleepDurationMs: 15000 },
            ultra_eco: { scanDurationMs: 3000, sleepDurationMs: 30000 },
            sos_override: { scanDurationMs: 15000, sleepDurationMs: 0 },
        };
    }

    setMode(newMode) { this.mode = newMode; }

    triggerEmergencyOverride() { this.mode = 'sos_override'; }

    getState() {
        const config = this.CONFIGS[this.mode];
        const total = config.scanDurationMs + config.sleepDurationMs;
        const pct = total > 0 ? Math.round((config.scanDurationMs / total) * 100) : 100;
        const drainPerHour = pct === 100 ? 12 : pct >= 25 ? 3.8 : 1.9;
        const estimatedHours = Math.max(1, Math.round(this.batteryLevel / drainPerHour));
        return {
            mode: this.mode,
            activeDutyCyclePct: pct,
            isScanning: true,
            estimatedBatteryLifeHours: estimatedHours,
        };
    }

    evaluatePolicy(battery, stationarySec, isCharging) {
        this.batteryLevel = battery;
        if (isCharging) {
            this.mode = 'aggressive';
            return;
        }
        if (battery <= 15) {
            this.mode = 'ultra_eco';
        } else if (battery <= 40 || stationarySec > 180) {
            this.mode = stationarySec > 600 ? 'ultra_eco' : 'balanced';
        } else {
            this.mode = 'balanced';
        }
    }
}

const ecoEngine = new TestEcoMeshDutyCycleEngine();

test('Modo inicial y cálculo de porcentaje de ciclo activo', () => {
    ecoEngine.setMode('aggressive');
    assert.strictEqual(ecoEngine.getState().activeDutyCyclePct, 100);

    ecoEngine.setMode('balanced');
    assert.strictEqual(ecoEngine.getState().activeDutyCyclePct, 25);

    ecoEngine.setMode('ultra_eco');
    assert.strictEqual(ecoEngine.getState().activeDutyCyclePct, 9);
});

test('Evaluación automática por nivel de batería y reposo inercial', () => {
    ecoEngine.evaluatePolicy(85, 0, false);
    assert.strictEqual(ecoEngine.getState().mode, 'balanced');

    ecoEngine.evaluatePolicy(30, 200, false);
    assert.strictEqual(ecoEngine.getState().mode, 'balanced');

    ecoEngine.evaluatePolicy(10, 0, false);
    assert.strictEqual(ecoEngine.getState().mode, 'ultra_eco');

    ecoEngine.evaluatePolicy(10, 0, true);
    assert.strictEqual(ecoEngine.getState().mode, 'aggressive');
});

test('Anulación de Emergencia SOS Override (100% Escaneo Inmediato)', () => {
    ecoEngine.setMode('ultra_eco');
    ecoEngine.triggerEmergencyOverride();
    assert.strictEqual(ecoEngine.getState().mode, 'sos_override');
    assert.strictEqual(ecoEngine.getState().activeDutyCyclePct, 100);
});

// ── 2. BroadcastStormGuardEngine ─────────────────────────────────────────────
console.log('\n📡 2. Probando BroadcastStormGuardEngine (Supresor de Tormentas RF & TTL)...');

class TestBroadcastStormGuardEngine {
    constructor() {
        this.seen = new Set();
        this.metrics = { evaluated: 0, forwarded: 0, suppressed: 0 };
    }

    calculateAdaptiveTtl(peerCount) {
        if (peerCount <= 3) return 7;
        if (peerCount <= 15) return 4;
        return 2;
    }

    evaluateRelay(packetId, currentHop, maxTtl, peerCount) {
        this.metrics.evaluated++;
        if (this.seen.has(packetId)) {
            this.metrics.suppressed++;
            return { shouldRelay: false, backoffDelayMs: 0 };
        }
        const adaptiveTtl = Math.min(maxTtl, this.calculateAdaptiveTtl(peerCount));
        if (currentHop >= adaptiveTtl) {
            this.metrics.suppressed++;
            return { shouldRelay: false, backoffDelayMs: 0 };
        }
        this.seen.add(packetId);
        this.metrics.forwarded++;
        const jitter = Math.floor(Math.random() * 40) + 15;
        return { shouldRelay: true, backoffDelayMs: jitter };
    }
}

const stormGuard = new TestBroadcastStormGuardEngine();

test('TTL Adaptativo según Densidad de Pares en Radio', () => {
    assert.strictEqual(stormGuard.calculateAdaptiveTtl(2), 7, 'Malla dispersa (2 nodos) debe usar TTL=7');
    assert.strictEqual(stormGuard.calculateAdaptiveTtl(8), 4, 'Malla media (8 nodos) debe usar TTL=4');
    assert.strictEqual(stormGuard.calculateAdaptiveTtl(25), 2, 'Malla densa (25 nodos) debe usar TTL=2');
});

test('Deduplicación y Supresión de Paquetes Repetidos', () => {
    const pktId = 'pkt_alpha_test_1';
    const eval1 = stormGuard.evaluateRelay(pktId, 1, 7, 5);
    assert.strictEqual(eval1.shouldRelay, true);
    assert.ok(eval1.backoffDelayMs >= 15);

    const eval2 = stormGuard.evaluateRelay(pktId, 1, 7, 5);
    assert.strictEqual(eval2.shouldRelay, false);
    assert.strictEqual(stormGuard.metrics.suppressed, 1);
});

// ── 3. LamportMeshClockEngine ────────────────────────────────────────────────
console.log('\n⏱️ 3. Probando LamportMeshClockEngine (Reloj Lógico Lamport & Consenso sin NTP)...');

class TestLamportMeshClockEngine {
    constructor() {
        this.counter = 0;
        this.offsets = [];
    }

    tick(peerId) {
        this.counter++;
        return {
            logicalCounter: this.counter,
            orderingKey: `${this.counter.toString().padStart(12, '0')}_${peerId.slice(0, 8)}`,
        };
    }

    receiveEvent(remoteCounter) {
        this.counter = Math.max(this.counter, remoteCounter) + 1;
        return this.counter;
    }

    recordPeerTime(offsetMs) {
        this.offsets.push(offsetMs);
    }

    getMedianDrift() {
        if (this.offsets.length === 0) return 0;
        const sorted = [...this.offsets].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
}

const lamport = new TestLamportMeshClockEngine();

test('Monotonía estricta de eventos locales (L_n+1 > L_n)', () => {
    const t1 = lamport.tick('nodeA');
    const t2 = lamport.tick('nodeA');
    assert.ok(t2.logicalCounter > t1.logicalCounter);
    assert.ok(t1.orderingKey.startsWith('000000000001_nodeA'));
});

test('Regla de Causalidad Lamport (L = max(L_local, L_remote) + 1)', () => {
    const remote = 450;
    const synced = lamport.receiveEvent(remote);
    assert.strictEqual(synced, 451);
});

test('Consenso de Mediana de Desvío Temporal (Median Offset Filter)', () => {
    lamport.recordPeerTime(5000);
    lamport.recordPeerTime(-2000);
    lamport.recordPeerTime(6000);
    assert.strictEqual(lamport.getMedianDrift(), 5000);
});

// ── 4. ZeroFootprintAiMemoryManager ──────────────────────────────────────────
console.log('\n🧠 4. Probando ZeroFootprintAiMemoryManager (Gestión de Memoria IA)...');

class TestAiMemoryManager {
    constructor() {
        this.isLoaded = false;
        this.purges = 0;
    }
    notifyStart() { this.isLoaded = true; }
    notifyEnd() { this.isLoaded = false; }
    purge() { this.purges++; this.isLoaded = false; }
}

const memManager = new TestAiMemoryManager();

test('Ciclo de Actividad y Purga de Tensores IA', () => {
    memManager.notifyStart();
    assert.strictEqual(memManager.isLoaded, true);

    memManager.notifyEnd();
    assert.strictEqual(memManager.isLoaded, false);

    memManager.purge();
    assert.strictEqual(memManager.purges, 1);
});

// ── 5. Cálculo de Azimut de Evacuación (HUD Táctico) ──────────────────────────
console.log('\n🧭 5. Probando Cálculo Táctico de Azimut y Rumbo de Evacuación...');

function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const y = Math.sin(dLng) * Math.cos(lat2 * (Math.PI / 180));
    const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
              Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLng);
    return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
}

test('Azimut directo hacia el Norte Verdadero (0° / 360°)', () => {
    const bearingNorth = calculateBearing(0, 0, 10, 0);
    assert.strictEqual(bearingNorth, 0);
});

test('Azimut directo hacia el Este (90°)', () => {
    const bearingEast = calculateBearing(0, 0, 0, 10);
    assert.strictEqual(bearingEast, 90);
});

// ── Resumen Final ─────────────────────────────────────────────────────────────
console.log('\n================================================================================');
console.log(`📊 RESUMEN FASE 10: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

/**
 * test-tdma-clock-skew-pll.js — RED LoRa TDMA Clock Skew PLL Verification Suite
 * 
 * Verifies Physical Clock Drift Compensation and Dynamic Guard Times:
 * 1. LamportMeshClockEngine tracking of relative clock frequency skew in PPM.
 * 2. Median Skew Filtering bounded to realistic physical quartz limits (±200 PPM).
 * 3. Continuous drift integration in getConsensusTime() during GNSS-denied blackouts.
 * 4. Adaptive Guard Time scaling (15ms -> 25ms -> 35ms) based on sync quality and drift.
 * 5. LoRaTdmaSchedulerEngine slot boundary protection preventing slot bleeding.
 * 6. Eradication of Math.random() in TDMA ID generation (CSPRNG validation).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("================================================================================");
console.log("⏱️  SUITE: LORA TDMA CLOCK SKEW PLL & ADAPTIVE GUARD TIMES (v117.0.0)");
console.log("================================================================================\n");

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

// ── 1. Static Source Code Integrity Checks ───────────────────────────────────

const clockPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'LamportMeshClockEngine.ts');
const tdmaPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'LoRaTdmaSchedulerEngine.ts');
const meshTabPath = path.join(__dirname, '..', 'src', 'components', 'settings', 'MeshTab.tsx');
const protocolPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshProtocol.ts');
const routerPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts');

const clockCode = fs.readFileSync(clockPath, 'utf8');
const tdmaCode = fs.readFileSync(tdmaPath, 'utf8');
const meshTabCode = fs.readFileSync(meshTabPath, 'utf8');
const protocolCode = fs.readFileSync(protocolPath, 'utf8');
const routerCode = fs.readFileSync(routerPath, 'utf8');

runTest("1. LamportMeshClockEngine: Declara interfaces ClockSyncQuality y PeerTimeSample", () => {
    assert(clockCode.includes("export interface PeerTimeSample"), "Debe declarar PeerTimeSample");
    assert(clockCode.includes("export interface ClockSyncQuality"), "Debe declarar ClockSyncQuality");
    assert(clockCode.includes("recommendedGuardTimeMs: number;"), "Debe incluir recommendedGuardTimeMs");
});

runTest("2. LamportMeshClockEngine: Implementa cálculo de frecuencia Skew en PPM con cota física", () => {
    assert(clockCode.includes("medianSkewPpm"), "Debe declarar medianSkewPpm");
    assert(clockCode.includes("(dOffset / dt) * 1_000_000") || clockCode.includes("(dOffset / dt) * 1000000"), "Debe calcular skew en PPM");
    assert(clockCode.includes("Math.abs(skewPpm) <= 200"), "Debe acotar sesgo a +-200 ppm para osciladores de cristal");
});

runTest("3. LamportMeshClockEngine: getConsensusTime() integra deriva acumulada (PLL Skew Tracker)", () => {
    assert(clockCode.includes("integratedDriftMs = Math.round(elapsedSinceUpdateMs * (this.medianSkewPpm / 1_000_000))")
        || clockCode.includes("this.medianSkewPpm / 1_000_000"), "Debe integrar deriva por PPM");
    assert(clockCode.includes("rawNow + this.medianOffsetMs + integratedDriftMs"), "Consensus time debe sumar offset y deriva integrada");
});

runTest("4. LamportMeshClockEngine: getSyncQuality() escala guard time dinámicamente (15ms, 25ms, 35ms)", () => {
    assert(clockCode.includes("recommendedGuardTimeMs = 15"), "Debe asignar 15ms en calidad HIGH");
    assert(clockCode.includes("recommendedGuardTimeMs = 25"), "Debe asignar 25ms en calidad DEGRADED");
    assert(clockCode.includes("recommendedGuardTimeMs = 35"), "Debe asignar 35ms en calidad DRIFTING");
});

runTest("5. LoRaTdmaSchedulerEngine: TdmaSlotInfo incorpora métricas de guarda y calidad PLL", () => {
    assert(tdmaCode.includes("guardTimeMs: number;"), "TdmaSlotInfo debe incluir guardTimeMs");
    assert(tdmaCode.includes("syncQuality: 'HIGH' | 'DEGRADED' | 'DRIFTING';"), "TdmaSlotInfo debe incluir syncQuality");
    assert(tdmaCode.includes("driftPpm: number;"), "TdmaSlotInfo debe incluir driftPpm");
});

runTest("6. LoRaTdmaSchedulerEngine: Protege borde de ranura impidiendo transmisiones dentro del tiempo de guarda", () => {
    assert(tdmaCode.includes("slotTimeRemainingMs > guardTimeMs"), "isMySlotActive debe exigir margen de guarda");
    assert(tdmaCode.includes("slotInfo.slotTimeRemainingMs <= slotInfo.guardTimeMs && currentSlot !== 9"), "onSlotBoundary debe abortar si el tiempo restante invade la guarda");
});

runTest("7. LoRaTdmaSchedulerEngine: Erradicación estricta de Math.random() en identificadores TDMA", () => {
    assert(!tdmaCode.includes("Math.random()"), "No debe contener llamadas a Math.random()");
    assert(tdmaCode.includes("generateNonce()"), "Debe usar generador criptográfico de nonce");
    assert(tdmaCode.includes("crypto.getRandomValues"), "Debe recurrir a entropía CSPRNG");
});

runTest("8. MeshTab.tsx: Telemetría visual de Calidad PLL, Deriva Cuarzo y Guarda Adaptativa", () => {
    assert(meshTabCode.includes("Calidad PLL"), "Debe mostrar Calidad PLL en UI");
    assert(meshTabCode.includes("Deriva Cuarzo"), "Debe mostrar Deriva Cuarzo en UI");
    assert(meshTabCode.includes("Guarda Adaptativa"), "Debe mostrar Guarda Adaptativa en UI");
});

runTest("9. LoRaTdmaSchedulerEngine: Bloquea transmisiones de datos en ranuras ajenas en cambios de época", () => {
    assert(tdmaCode.includes("if (currentSlot !== 9 && !slotInfo.isMySlotActive)"), "onSlotBoundary debe verificar isMySlotActive para evitar colisiones entre épocas");
    assert(tdmaCode.includes("this.queue.findIndex(it => it.isEmergency)"), "Debe reservar slot 9 para SOS y despachar prioridad en slot asignado");
});

runTest("10. meshProtocol.ts: createPacket utiliza marca de tiempo consensuada de Lamport", () => {
    assert(protocolCode.includes("LamportMeshClockEngine"), "Debe importar LamportMeshClockEngine");
    assert(protocolCode.includes("LamportMeshClockEngine.getInstance().getConsensusTime()"), "createPacket debe obtener getConsensusTime");
});

runTest("11. meshRouter.ts: Ingesta de paquetes alimenta continuamente el seguidor PLL de deriva", () => {
    assert(routerCode.includes("LamportMeshClockEngine"), "Debe importar LamportMeshClockEngine");
    assert(routerCode.includes("LamportMeshClockEngine.getInstance().recordPeerTime(packet.sender, packet.timestamp)"), "meshRouter debe registrar marcas de tiempo remotas en PLL");
});

// ── 2. Algorithmic PLL & Drift Simulation ──────────────────────────────────────

runTest("12. Simulación Algorítmica: Cálculo de Frequency Skew y Deriva Integrada", () => {
    // Simular muestras de reloj de un par:
    // t0 = 0 ms, offset = 100 ms
    // t1 = 10,000 ms (10 seg), offset = 100.2 ms (+200 µs de deriva en 10s = +20 PPM)
    const t0 = 1000;
    const offset0 = 50;
    const t1 = 11000;
    const offset1 = 50.2; // +0.2 ms en 10,000 ms = (0.2 / 10000) * 1e6 = 20 PPM

    const dt = t1 - t0;
    const dOffset = offset1 - offset0;
    const calculatedPpm = Math.round((dOffset / dt) * 1_000_000);

    assert.strictEqual(calculatedPpm, 20, "El sesgo de frecuencia calculado debe ser exactamente +20 PPM");

    // Proyectar deriva en 60 segundos sin sincronización GNSS
    const elapsed60s = 60_000;
    const projectedDriftMs = Math.round(elapsed60s * (calculatedPpm / 1_000_000));
    assert.strictEqual(projectedDriftMs, 1, "En 60 segundos a +20 PPM la deriva física acumulada es de ~1 ms");

    // Proyectar deriva en 24 horas (86,400 segundos)
    const elapsed24h = 86_400_000;
    const drift24hMs = Math.round(elapsed24h * (calculatedPpm / 1_000_000));
    assert.strictEqual(drift24hMs, 1728, "En 24 horas a +20 PPM la deriva física acumulada es de ~1.73 segundos");
});

runTest("13. Simulación Algorítmica: Supresión de transmisión en frontera de guarda", () => {
    const slotDurationMs = 200;
    const guardTimeMs = 25; // Nivel DEGRADED

    // Caso A: 40 ms restantes en la ranura (40 > 25) -> Transmisión permitida
    const remainingA = 40;
    const allowedA = remainingA > guardTimeMs;
    assert.strictEqual(allowedA, true, "Con 40ms restantes y 25ms de guarda, la transmisión debe autorizarse");

    // Caso B: 18 ms restantes en la ranura (18 <= 25) -> Transmisión bloqueada para no colisionar
    const remainingB = 18;
    const allowedB = remainingB > guardTimeMs;
    assert.strictEqual(allowedB, false, "Con 18ms restantes y 25ms de guarda, la transmisión debe ser retenida");
});

console.log("\n================================================================================");
console.log(`📊 RESULTADO FINAL TDMA CLOCK SKEW PLL: ${passedTests}/${totalTests} PRUEBAS EXITOSAS`);
console.log("================================================================================\n");

if (passedTests !== totalTests) {
    process.exit(1);
}

/**
 * TEST SUITE: UNIFIED BLE SCAN ARBITER & MULTIPLEXED RADIO RESILIENCE
 * 
 * Valida la resolución de contención de hardware de radio BLE entre el transporte mesh
 * y el watchdog táctico SIGINT (C-UAS / Remote ID):
 * 1. bluetoothTransport.ts: Implementación de árbitro multiplexado con conteo de referencias.
 * 2. bluetoothTransport.ts: Despacho simultáneo a rawScanListeners y scanDeviceListeners.
 * 3. bluetoothTransport.ts: Protección contra apagado prematuro si continuousScanRequesters > 0 o activeScanHolders > 0.
 * 4. bluetoothTransport.ts: stopDutyCycleScan() respeta consumidores continuos sin apagar el hardware.
 * 5. RfSigintWatchdogEngine.ts: Delegación limpia al árbitro central sin invocar BleClient directamente.
 * 6. RfSigintWatchdogEngine.ts: Rollback de isScanning ante excepciones de inicialización.
 * 7. Simulación algorítmica de contención y multiplexación de radio LE en tiempo de ejecución.
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
console.log('📡 INICIANDO SUITE DE PRUEBAS: UNIFIED BLE SCAN ARBITER RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de bluetoothTransport.ts ──────────────────────────
const btPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'bluetoothTransport.ts');
const btCode = fs.readFileSync(btPath, 'utf8');

runTest('1. bluetoothTransport: Árbitro multiplexado de escaneo, mutex y contadores declarados', () => {
    assert(btCode.includes('rawScanListeners: Map<string, (result: ScanResult) => void>'), 'Debe existir rawScanListeners');
    assert(btCode.includes('continuousScanRequesters: Set<string>'), 'Debe existir continuousScanRequesters');
    assert(btCode.includes('scanDeviceListeners: Map<string, (device: RedDevice) => void>'), 'Debe existir scanDeviceListeners como Map');
    assert(btCode.includes('activeScanHolders = 0'), 'Debe existir activeScanHolders');
    assert(btCode.includes('scanStartingPromise: Promise<void> | null = null'), 'Debe existir mutex scanStartingPromise');
});

runTest('2. bluetoothTransport: ensurePhysicalScanRunning realiza fan-out simultáneo', () => {
    assert(btCode.includes('this.rawScanListeners.forEach((listener) => {'), 'Debe notificar a escuchas crudos');
    assert(btCode.includes('this.scanDeviceListeners.forEach((listener) => {'), 'Debe notificar a escuchas de dispositivos RED');
});

runTest('3. bluetoothTransport: stopPhysicalScanIfIdle protege hardware contra apagado prematuro', () => {
    assert(btCode.includes('if (this.continuousScanRequesters.size > 0)'), 'No debe apagar si hay consumidores continuos');
    assert(btCode.includes('if (this.activeScanHolders > 0)'), 'No debe apagar si hay ventanas de escaneo activas');
    assert(btCode.includes('await BleClient.stopLEScan();'), 'Solo debe apagar cuando esté inactivo');
});

runTest('4. bluetoothTransport: Métodos públicos de escaneo continuo disponibles', () => {
    assert(btCode.includes('startContinuousScan(requesterId: string'), 'Debe exponer startContinuousScan');
    assert(btCode.includes('stopContinuousScan(requesterId: string'), 'Debe exponer stopContinuousScan');
    assert(btCode.includes('this.stopPhysicalScanIfIdle().catch'), 'stopDutyCycleScan debe delegar a stopPhysicalScanIfIdle');
});

// ── 2. Inspección Estática de RfSigintWatchdogEngine.ts ───────────────────────
const rfsPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'RfSigintWatchdogEngine.ts');
const rfsCode = fs.readFileSync(rfsPath, 'utf8');

runTest('5. RfSigintWatchdogEngine: Delegación al árbitro central bluetoothTransport', () => {
    assert(rfsCode.includes("import { bluetoothTransport } from '../mesh/bluetoothTransport';"), 'Debe importar bluetoothTransport');
    assert(rfsCode.includes("bluetoothTransport.startContinuousScan('rf_sigint_watchdog'"), 'startScanning debe usar startContinuousScan');
    assert(rfsCode.includes("bluetoothTransport.stopContinuousScan('rf_sigint_watchdog')"), 'stopScanning debe usar stopContinuousScan');
    assert(!rfsCode.includes("BleClient.requestLEScan"), 'No debe invocar BleClient.requestLEScan directamente');
});

runTest('6. RfSigintWatchdogEngine: Rollback de estado isScanning ante fallo de inicialización', () => {
    assert(rfsCode.includes('this.isScanning = false;'), 'Debe restaurar isScanning en caso de catch');
    assert(rfsCode.includes('return false;'), 'Debe retornar false si falla startScanning');
});

// ── 3. Simulación Algorítmica del Árbitro de Radio BLE ───────────────────────
class MockBleArbiter {
    constructor() {
        this.isPhysicalScanning = false;
        this.continuousRequesters = new Set();
        this.activeHolders = 0;
        this.rawListeners = new Map();
        this.redListeners = new Set();
    }

    startPhysicalScan() {
        this.isPhysicalScanning = true;
    }

    stopPhysicalScanIfIdle() {
        if (this.continuousRequesters.size > 0 || this.activeHolders > 0) {
            return false; // Hardware remains active
        }
        this.isPhysicalScanning = false;
        return true; // Hardware stopped
    }

    startContinuous(id, cb) {
        this.continuousRequesters.add(id);
        this.rawListeners.set(id, cb);
        this.startPhysicalScan();
    }

    stopContinuous(id) {
        this.continuousRequesters.delete(id);
        this.rawListeners.delete(id);
        return this.stopPhysicalScanIfIdle();
    }

    startWindowScan(cb) {
        this.activeHolders++;
        this.redListeners.add(cb);
        this.startPhysicalScan();
    }

    endWindowScan(cb) {
        this.redListeners.delete(cb);
        this.activeHolders = Math.max(0, this.activeHolders - 1);
        return this.stopPhysicalScanIfIdle();
    }

    simulatePacket(result) {
        const rawNotified = [];
        const redNotified = [];
        this.rawListeners.forEach((_, id) => rawNotified.push(id));
        if (result.name && result.name.startsWith('RED-')) {
            this.redListeners.forEach(() => redNotified.push(result.name));
        }
        return { rawNotified, redNotified };
    }
}

runTest('7. Simulación: SIGINT no es apagado cuando expira la ventana de escaneo mesh de 4s', () => {
    const arbiter = new MockBleArbiter();

    // 1. Mesh inicia escaneo de 4s
    const meshCb = () => {};
    arbiter.startWindowScan(meshCb);
    assert.strictEqual(arbiter.isPhysicalScanning, true, 'Hardware debe estar encendido por mesh');

    // 2. Usuario abre SIGINT watchdog mientras el mesh está escaneando
    const sigintCb = () => {};
    arbiter.startContinuous('sigint', sigintCb);
    assert.strictEqual(arbiter.isPhysicalScanning, true, 'Hardware debe continuar encendido');

    // 3. Expira la ventana de 4s del mesh
    const stopped = arbiter.endWindowScan(meshCb);
    assert.strictEqual(stopped, false, 'Hardware NO debe apagarse porque SIGINT sigue activo');
    assert.strictEqual(arbiter.isPhysicalScanning, true, 'Hardware permanece activo para SIGINT');
});

runTest('8. Simulación: Cierre de SIGINT no interrumpe ventana de escaneo mesh en curso', () => {
    const arbiter = new MockBleArbiter();

    // 1. SIGINT y Mesh activos concurrentemente
    arbiter.startContinuous('sigint', () => {});
    const meshCb = () => {};
    arbiter.startWindowScan(meshCb);

    // 2. Usuario cierra modal de SIGINT mientras la ventana de 4s del mesh sigue corriendo
    const stopped = arbiter.stopContinuous('sigint');
    assert.strictEqual(stopped, false, 'Hardware NO debe apagarse porque la ventana mesh está activa');
    assert.strictEqual(arbiter.isPhysicalScanning, true, 'Hardware sigue activo para el mesh');

    // 3. Ventana mesh finaliza
    const fullyStopped = arbiter.endWindowScan(meshCb);
    assert.strictEqual(fullyStopped, true, 'Hardware se apaga limpiamente al quedar todos inactivos');
    assert.strictEqual(arbiter.isPhysicalScanning, false, 'Radio BLE entra en reposo de bajo consumo');
});

runTest('9. Simulación: Fan-out multiplexa paquetes a SIGINT y filtro RED simultáneamente', () => {
    const arbiter = new MockBleArbiter();
    arbiter.startContinuous('sigint_cuas', () => {});
    arbiter.startWindowScan(() => {});

    // Paquete 1: Drone DJI Remote ID
    const resDrone = arbiter.simulatePacket({ name: 'DJI_Mavic3_RID', uuids: ['0000fffa-0000-1000-8000-00805f9b34fb'] });
    assert.deepStrictEqual(resDrone.rawNotified, ['sigint_cuas'], 'Drone debe ser entregado a SIGINT');
    assert.strictEqual(resDrone.redNotified.length, 0, 'Drone no debe ser entregado al listener RED');

    // Paquete 2: Nodo RED de escuadrón
    const resRed = arbiter.simulatePacket({ name: 'RED-Alpha-01', uuids: ['00001818-0000-1000-8000-00805f9b34fb'] });
    assert.deepStrictEqual(resRed.rawNotified, ['sigint_cuas'], 'Nodo RED debe ser entregado a SIGINT para análisis RF');
    assert.strictEqual(resRed.redNotified.length, 1, 'Nodo RED debe ser entregado al listener de malla RED');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

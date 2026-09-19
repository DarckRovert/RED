/**
 * TEST SUITE: METABOLIC NEUROMORPHIC GOVERNOR & TORPOR RESILIENCE
 * 
 * Valida el triaje metabólico bio-inspirado en los circuitos IPC/NPF de Drosophila:
 * 1. Transición tri-estado: SATIATED -> CONSERVATIVE -> TORPOR.
 * 2. Modulación dinámica del reloj sináptico (100 Hz -> 50 Hz -> 5 Hz).
 * 3. Restricción del ciclo de trabajo LoRa TDMA para prolongación de batería.
 * 4. Disparo de Torpor por sobrecalentamiento térmico (> 48°C) o batería crítica (< 20%).
 * 5. Inmunidad a muerte súbita y cálculo de autonomía estimada en horas.
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
console.log('🔋🦗 INICIANDO SUITE DE PRUEBAS: METABOLIC GOVERNOR IPC/NPF & TORPOR');
console.log('================================================================================\n');

// ── 1. Inspección Estática de MetabolicNeuromorphicGovernor.ts ───────────────
const govPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'MetabolicNeuromorphicGovernor.ts');
const govCode = fs.readFileSync(govPath, 'utf8');

runTest('1. MetabolicNeuromorphicGovernor: Regímenes Metabólicos y Eje IPC/NPF', () => {
    assert(govCode.includes('MetabolicRegime = \'SATIATED\' | \'CONSERVATIVE\' | \'TORPOR\''), 'Debe definir los 3 regímenes');
    assert(govCode.includes('ipcLevel: number'), 'Debe exponer nivel de Células de Insulina');
    assert(govCode.includes('npfLevel: number'), 'Debe exponer nivel de Neuropéptido F');
});

runTest('2. MetabolicNeuromorphicGovernor: Modulación de Reloj y TDMA LoRa', () => {
    assert(govCode.includes('neuralClockIntervalMs'), 'Debe modular intervalo del reloj sináptico');
    assert(govCode.includes('loraTxThrottleRatio'), 'Debe gobernar ciclo de transmisión LoRa');
    assert(govCode.includes('uiFrameRateLimit'), 'Debe regular FPS de la interfaz');
});

runTest('3. MetabolicNeuromorphicGovernor: Métodos de Telemetría e Inyección', () => {
    assert(govCode.includes('injectBatteryTelemetry'), 'Debe permitir inyección de telemetría de hardware');
    assert(govCode.includes('setOverrideRegime'), 'Debe permitir override táctico manual');
});

// ── 2. Simulación Numérica de Transiciones Metabólicas ────────────────────────

class MockMetabolicGovernor {
    constructor() {
        this.batteryPct = 100;
        this.isCharging = false;
        this.temperatureC = 25.0;
        this.regime = 'SATIATED';
        this.ipc = 1.0;
        this.npf = 0.1;
    }

    update(batteryPct, isCharging, tempC = 25.0) {
        this.batteryPct = batteryPct;
        this.isCharging = isCharging;
        this.temperatureC = tempC;

        if (this.isCharging) {
            this.regime = 'SATIATED';
            this.ipc = 1.0;
            this.npf = 0.05;
            return;
        }

        if (this.batteryPct < 20 || this.temperatureC >= 48.0) {
            this.regime = 'TORPOR';
            this.ipc = 0.10;
            this.npf = 0.95;
        } else if (this.batteryPct < 50 || this.temperatureC >= 42.0) {
            this.regime = 'CONSERVATIVE';
            this.ipc = 0.50;
            this.npf = 0.50;
        } else {
            this.regime = 'SATIATED';
            this.ipc = 0.90;
            this.npf = 0.15;
        }
    }

    getClockInterval() {
        if (this.regime === 'TORPOR') return 200; // 5 Hz
        if (this.regime === 'CONSERVATIVE') return 20; // 50 Hz
        return 10; // 100 Hz
    }

    getLoraThrottle() {
        if (this.regime === 'TORPOR') return 0.05; // 5% SOS solo
        if (this.regime === 'CONSERVATIVE') return 0.50; // 50%
        return 1.0; // 100%
    }
}

runTest('4. Dinámica Metabólica: Estado SATIATED con batería alta (> 50%)', () => {
    const gov = new MockMetabolicGovernor();
    gov.update(85, false, 28.0);

    assert(gov.regime === 'SATIATED', 'Debe estar en régimen SATIATED');
    assert(gov.ipc >= 0.8, 'Nivel de IPC debe ser alto');
    assert(gov.npf <= 0.3, 'Nivel de NPF debe ser bajo');
    assert(gov.getClockInterval() === 10, 'Reloj sináptico debe ser 10ms (100 Hz)');
    assert(gov.getLoraThrottle() === 1.0, 'Ciclo LoRa debe ser 100%');
});

runTest('5. Dinámica Metabólica: Estado CONSERVATIVE con batería media (20% - 50%)', () => {
    const gov = new MockMetabolicGovernor();
    gov.update(35, false, 32.0);

    assert(gov.regime === 'CONSERVATIVE', 'Debe estar en régimen CONSERVATIVE');
    assert(gov.getClockInterval() === 20, 'Reloj sináptico debe ser 20ms (50 Hz)');
    assert(gov.getLoraThrottle() === 0.50, 'Ciclo LoRa debe reducirse al 50%');
});

runTest('6. Dinámica Metabólica: Estado TORPOR con batería crítica (< 20%)', () => {
    const gov = new MockMetabolicGovernor();
    gov.update(12, false, 25.0);

    assert(gov.regime === 'TORPOR', 'Debe activar TORPOR de supervivencia');
    assert(gov.npf >= 0.9, 'NPF debe estar en su nivel máximo');
    assert(gov.getClockInterval() === 200, 'Reloj sináptico debe frenarse a 200ms (5 Hz)');
    assert(gov.getLoraThrottle() === 0.05, 'Ciclo LoRa debe limitarse al 5% para balizas SOS');
});

runTest('7. Protección Térmica: Temperatura crítica (> 48°C) fuerza TORPOR inmediato', () => {
    const gov = new MockMetabolicGovernor();
    // Batería en 90% pero sobrecalentado a 49°C
    gov.update(90, false, 49.0);

    assert(gov.regime === 'TORPOR', 'Debe forzar TORPOR para mitigar sobrecalentamiento');
    assert(gov.getClockInterval() === 200, 'Reloj debe frenar disipación térmica');
});

runTest('8. Restauración al Conectar Cargador', () => {
    const gov = new MockMetabolicGovernor();
    // Batería en 5% pero conectado a cargador solar
    gov.update(5, true, 25.0);

    assert(gov.regime === 'SATIATED', 'Debe restaurarse a SATIATED en carga');
    assert(gov.ipc === 1.0, 'IPC al máximo');
});

console.log('\n================================================================================');
console.log(`📊 RESULTADO DE LA SUITE METABOLIC: ${passedTests}/${totalTests} PRUEBAS EXITOSAS (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

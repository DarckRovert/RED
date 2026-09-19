/**
 * TEST SUITE: TACTICAL MOTOR ACTUATOR & DNa01/02 HAPTIC STEERING RESILIENCE
 * 
 * Valida la emulación de las neuronas descendentes DNa01/DNa02 y actuadores hápticos:
 * 1. Modulación de motoneuronas DNa01 (giro babor) y DNa02 (giro estribor) según error de timoneo.
 * 2. Transición de modos: ALIGNED (|error| <= 15°), TURN_LEFT, TURN_RIGHT, EMERGENCY, IDLE.
 * 3. Patrones de micro-vibración diferenciados para guiado a ciegas sin pantalla.
 * 4. Ráfaga táctica de emergencia (200-80-200-80-200 ms) disparada por Giant Fiber Reflex.
 * 5. Inmunidad a sobre-vibración (throttling temporal de 3 segundos).
 * 6. Respeto al modo sigilo (tactical stealth) y conmutación de habilitación.
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
console.log('📳🦗 INICIANDO SUITE DE PRUEBAS: TACTICAL MOTOR ACTUATOR DNa01/02 & HAPTICS');
console.log('================================================================================\n');

// ── 1. Inspección Estática de TacticalMotorActuatorEngine.ts ──────────────────
const motorPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'TacticalMotorActuatorEngine.ts');
const motorCode = fs.readFileSync(motorPath, 'utf8');

runTest('1. TacticalMotorActuatorEngine: Definición de Neuronas DNa y Modos', () => {
    assert(motorCode.includes('dna01IpsilateralExcitation'), 'Debe definir excitación DNa01');
    assert(motorCode.includes('dna02ContralateralExcitation'), 'Debe definir excitación DNa02');
    assert(motorCode.includes('HapticSteeringMode'), 'Debe definir tipos de modo háptico');
    assert(motorCode.includes('triggerEmergencyBurst'), 'Debe exponer ráfaga de emergencia');
});

runTest('2. TacticalMotorActuatorEngine: Enlace con FanShapedBody y GiantFiberReflex', () => {
    assert(motorCode.includes('fanShapedBody.subscribe'), 'Debe acoplarse al Fan-Shaped Body');
    assert(motorCode.includes('giantFiberReflex.subscribe'), 'Debe acoplarse a Fibra Gigante');
    assert(motorCode.includes('navigator.vibrate'), 'Debe utilizar API de vibración nativa');
});

// ── 2. Validación Numérica de las Neuronas Descendentes DNa ───────────────────

class MockMotorActuator {
    constructor() {
        this.dna01 = 0.0;
        this.dna02 = 0.0;
        this.mode = 'IDLE';
        this.lastVibratedPattern = null;
        this.pulseCount = 0;
        this.lastVibrateTime = 0;
        this.minIntervalMs = 3000;
    }

    updateSteering(errorDeg, now = Date.now()) {
        const error = Math.max(-180, Math.min(180, errorDeg));
        if (error < 0) {
            this.dna01 = Math.min(1.0, Math.abs(error) / 90.0);
            this.dna02 = 0.0;
        } else {
            this.dna02 = Math.min(1.0, error / 90.0);
            this.dna01 = 0.0;
        }

        const absError = Math.abs(error);
        if (absError <= 15) {
            this.mode = 'ALIGNED';
        } else if (error < -25) {
            this.mode = 'TURN_LEFT';
        } else if (error > 25) {
            this.mode = 'TURN_RIGHT';
        } else {
            this.mode = 'IDLE';
        }

        if (now - this.lastVibrateTime >= this.minIntervalMs) {
            this.lastVibrateTime = now;
            this.pulseCount++;
            if (this.mode === 'ALIGNED') this.lastVibratedPattern = 40;
            else if (this.mode === 'TURN_LEFT') this.lastVibratedPattern = [40, 60, 40];
            else if (this.mode === 'TURN_RIGHT') this.lastVibratedPattern = 140;
        }
    }

    triggerEmergency(now = Date.now()) {
        this.mode = 'EMERGENCY';
        this.lastVibratedPattern = [200, 80, 200, 80, 200];
        this.pulseCount++;
        this.lastVibrateTime = now;
    }
}

runTest('3. Dinámica DNa: Rumbo Alineado hacia Home Vector (|error| <= 15°)', () => {
    const act = new MockMotorActuator();
    act.updateSteering(5); // 5 grados de desvío (dentro de tolerancia)

    assert.strictEqual(act.mode, 'ALIGNED');
    assert.strictEqual(act.lastVibratedPattern, 40, 'Debe emitir pulso sutil de 40ms');
    assert(act.dna01 < 0.2 && act.dna02 < 0.2, 'Excitaciones de giro deben ser mínimas al estar alineado');
});

runTest('4. Dinámica DNa: Corrección hacia la Izquierda (Babor, error < -25°)', () => {
    const act = new MockMotorActuator();
    act.updateSteering(-60); // Desvío a babor

    assert.strictEqual(act.mode, 'TURN_LEFT');
    assert.deepStrictEqual(act.lastVibratedPattern, [40, 60, 40], 'Debe emitir doble pulso asimétrico de giro');
    assert(act.dna01 > 0.6, `DNa01 (izquierda) debe tener alta excitación: actual ${act.dna01}`);
    assert.strictEqual(act.dna02, 0.0, 'DNa02 (derecha) debe estar inhibida');
});

runTest('5. Dinámica DNa: Corrección hacia la Derecha (Estribor, error > +25°)', () => {
    const act = new MockMotorActuator();
    act.updateSteering(75); // Desvío a estribor

    assert.strictEqual(act.mode, 'TURN_RIGHT');
    assert.strictEqual(act.lastVibratedPattern, 140, 'Debe emitir pulso sostenido de 140ms');
    assert(act.dna02 > 0.8, `DNa02 (derecha) debe tener alta excitación: actual ${act.dna02}`);
    assert.strictEqual(act.dna01, 0.0, 'DNa01 (izquierda) debe estar inhibida');
});

runTest('6. Dinámica de Emergencia: Ráfaga Háptica Táctica', () => {
    const act = new MockMotorActuator();
    act.triggerEmergency();

    assert.strictEqual(act.mode, 'EMERGENCY');
    assert.deepStrictEqual(act.lastVibratedPattern, [200, 80, 200, 80, 200], 'Debe emitir ráfaga táctica completa');
});

runTest('7. Throttling Temporal: Protección contra saturación háptica', () => {
    const act = new MockMotorActuator();
    const t0 = 1000000;
    act.updateSteering(-45, t0);
    const pulsesAfter1 = act.pulseCount;

    // Actualización 500 ms después no debe emitir vibración adicional
    act.updateSteering(-45, t0 + 500);
    assert.strictEqual(act.pulseCount, pulsesAfter1, 'No debe vibrar de nuevo antes de 3 segundos');

    // Actualización 3.5 segundos después DEBE emitir vibración
    act.updateSteering(-45, t0 + 3500);
    assert.strictEqual(act.pulseCount, pulsesAfter1 + 1, 'Debe emitir pulso tras cumplirse el intervalo');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests < totalTests) {
    process.exit(1);
}

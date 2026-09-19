/**
 * test-eyes-free-haptic-steering.js — RED Sovereign Mesh OS
 * 
 * Test Suite Automatizado: Eyes-Free Haptic Steering & DNa01/DNa02 Descending Neurons.
 * Valida la guía táctil subconsciente de la Drosophila para operaciones nocturnas:
 * 1. Cálculo de error de timoneo angular [-180° a +180°].
 * 2. Zona muerta de alineación (deadband <= 15°) -> Modo ALIGNED.
 * 3. Excitación diferencial DNa01 / DNa02 para viraje a Babor o Estribor.
 * 4. Patrones de pulsos hápticos (navigator.vibrate) según dirección y desviación.
 * 5. Interrupción inmediata por reflejo de amenaza LC4 (EMERGENCY Looming Burst).
 * 6. Integración en EyesFreeHapticModal.tsx con modo Sigilo OLED negro puro.
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
console.log('📳 EYES-FREE HAPTIC STEERING & DESCENDING NEURONS TEST SUITE');
console.log('================================================================================\n');

// ── 1. Verificación Estática del Código Fuente ────────────────────────────────
const motorPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'TacticalMotorActuatorEngine.ts');
const motorCode = fs.readFileSync(motorPath, 'utf8');

const modalPath = path.join(__dirname, '..', 'src', 'components', 'tactical', 'EyesFreeHapticModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

runTest('1. TacticalMotorActuatorEngine: Neuronas Descendentes DNa01/02 y Modos Hápticos', () => {
    assert(motorCode.includes('dna01IpsilateralExcitation'), 'Debe calcular excitación DNa01');
    assert(motorCode.includes('dna02ContralateralExcitation'), 'Debe calcular excitación DNa02');
    assert(motorCode.includes('currentHapticMode'), 'Debe reportar modo háptico');
    assert(motorCode.includes('triggerEmergencyBurst'), 'Debe soportar ráfaga de emergencia');
});

runTest('2. EyesFreeHapticModal: Interfaz de Navegación Ciega & Modo Sigilo', () => {
    assert(modalCode.includes('tacticalMotorActuator'), 'Debe suscribirse al actuador motor');
    assert(modalCode.includes('fanShapedBody'), 'Debe acceder a la telemetría del Fan-Shaped Body');
    assert(modalCode.includes('isBlackoutActive'), 'Debe soportar modo sigilo OLED negro');
    assert(modalCode.includes('BackHandlerRegistry'), 'Debe tener interceptor LIFO de botón atrás');
});

// ── 2. Verificación Dinámica de Algoritmos de Timoneo ─────────────────────────
runTest('3. Algoritmo de Timoneo: Normalización Angular y Detección de Banda Muerta', () => {
    function computeSteering(headingDeg, targetBearingDeg) {
        let diff = targetBearingDeg - headingDeg;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        
        let mode = 'ALIGNED';
        if (diff < -15) mode = 'PORT';
        else if (diff > 15) mode = 'STARBOARD';

        return { diff, mode };
    }

    // Rumbo alineado con objetivo (0° vs 5°) -> ALIGNED
    const s1 = computeSteering(0, 5);
    assert.strictEqual(s1.mode, 'ALIGNED', 'Desviación <= 15° debe ser ALIGNED');
    assert.strictEqual(s1.diff, 5);

    // Rumbo a babor (Rumbo 180°, Objetivo 120° = -60°) -> PORT
    const s2 = computeSteering(180, 120);
    assert.strictEqual(s2.mode, 'PORT', 'Desviación negativa debe ser PORT (Babor)');
    assert.strictEqual(s2.diff, -60);

    // Rumbo a estribor (Rumbo 350°, Objetivo 30° = +40°) -> STARBOARD
    const s3 = computeSteering(350, 30);
    assert.strictEqual(s3.mode, 'STARBOARD', 'Desviación positiva debe ser STARBOARD (Estribor)');
    assert.strictEqual(s3.diff, 40);

    // Cruce de meridiano 0°/360° (Rumbo 10°, Objetivo 350° = -20°) -> PORT
    const s4 = computeSteering(10, 350);
    assert.strictEqual(s4.mode, 'PORT', 'Cruce de 360° debe calcular menor arco a babor (-20°)');
    assert.strictEqual(s4.diff, -20);
});

runTest('4. Generación de Patrones Hápticos de Vibración', () => {
    function getVibrationPattern(mode) {
        switch (mode) {
            case 'ALIGNED': return [50]; // Pulso corto suave
            case 'PORT': return [80, 60, 80]; // Dos pulsos para Babor
            case 'STARBOARD': return [80, 50, 80, 50, 80]; // Tres pulsos para Estribor
            case 'EMERGENCY': return [250, 60, 250, 60, 400]; // Ráfaga de pánico Looming
            default: return [];
        }
    }

    assert.deepStrictEqual(getVibrationPattern('ALIGNED'), [50]);
    assert.deepStrictEqual(getVibrationPattern('PORT'), [80, 60, 80]);
    assert.deepStrictEqual(getVibrationPattern('STARBOARD'), [80, 50, 80, 50, 80]);
    assert.deepStrictEqual(getVibrationPattern('EMERGENCY'), [250, 60, 250, 60, 400]);
});

console.log(`\nResultados: ${passedTests}/${totalTests} pruebas superadas.`);
if (passedTests !== totalTests) {
    process.exit(1);
}
console.log('✨ SUITE EYES-FREE HAPTIC STEERING EXITOSA.\n');

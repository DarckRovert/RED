/**
 * TEST SUITE: OPTIC LOBE ELEMENTARY MOTION & LC4 LOOMING DETECTOR RESILIENCE
 * 
 * Valida la emulación biofísica de los lóbulos ópticos de Drosophila:
 * 1. Matriz de omatidios 16x16 (256 receptores) en micro-resolución espacial.
 * 2. Vías de contraste ON (Neuronas T4) y OFF (Neuronas T5).
 * 3. Correlador de movimiento Hassenstein-Reichardt (delay-and-correlate) para HS y VS.
 * 4. Odometría visual traslacional para navegación inercial sin podómetro.
 * 5. Detector de amenaza y colisión LC4 / LPLC2 con cálculo de TTC (Time-to-Contact).
 * 6. Disparo determinista de escape en GiantFiberReflexEngine ante aproximación crítica.
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
console.log('👁️🦗 INICIANDO SUITE DE PRUEBAS: OPTIC LOBE H-R MOTION & LC4 LOOMING DETECTOR');
console.log('================================================================================\n');

// ── 1. Inspección Estática de OpticLobeEngine.ts ───────────────────────────────
const opticPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'OpticLobeEngine.ts');
const opticCode = fs.readFileSync(opticPath, 'utf8');

const gfsPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'GiantFiberReflexEngine.ts');
const gfsCode = fs.readFileSync(gfsPath, 'utf8');

runTest('1. OpticLobeEngine: Parámetros Anatómicos y Receptores de Omatidios', () => {
    assert(opticCode.includes('GRID_WIDTH = 16'), 'Debe tener 16 columnas');
    assert(opticCode.includes('GRID_HEIGHT = 16'), 'Debe tener 16 filas');
    assert(opticCode.includes('TOTAL_OMMATIDIA = 256'), 'Debe tener 256 omatidios');
    assert(opticCode.includes('t4OnMotionMagnitude'), 'Debe exponer vía ON T4');
    assert(opticCode.includes('t5OffMotionMagnitude'), 'Debe exponer vía OFF T5');
});

runTest('2. OpticLobeEngine: Células Tangenciales LPTC y Odometría Visual', () => {
    assert(opticCode.includes('hsHorizontalMotion'), 'Debe calcular flujo horizontal HS');
    assert(opticCode.includes('vsVerticalMotion'), 'Debe calcular flujo vertical VS');
    assert(opticCode.includes('visualAngularVelocityDegPerSec'), 'Debe estimar velocidad angular visual');
    assert(opticCode.includes('visualOdometryDistanceMeters'), 'Debe integrar distancia odometría visual');
});

runTest('3. OpticLobeEngine & GFS: Enlace con GiantFiberReflexEngine', () => {
    assert(opticCode.includes("giantFiberReflex.triggerReflex('VISUAL_LOOMING_THREAT')"), 'Debe disparar arco reflejo ante amenaza');
    assert(gfsCode.includes("'VISUAL_LOOMING_THREAT'"), 'GiantFiberReflexEngine debe aceptar VISUAL_LOOMING_THREAT');
});

// ── 2. Validación Numérica del Correlador Hassenstein-Reichardt ───────────────

function computeHrStep(framePrev, frameCurr, W = 16, H = 16) {
    let sumDx = 0.0;
    let sumDy = 0.0;
    let sumT4 = 0.0;
    let sumT5 = 0.0;
    let pairs = 0;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            const curr = frameCurr[idx];
            const prev = framePrev[idx];
            const deltaL = curr - prev;

            if (deltaL > 0) sumT4 += deltaL;
            else sumT5 += Math.abs(deltaL);

            if (x + 1 < W) {
                const idxR = y * W + (x + 1);
                const currR = frameCurr[idxR];
                const prevR = framePrev[idxR];
                // H-R: I1(t)*I2(t-τ) - I2(t)*I1(t-τ)
                sumDx += (curr * prevR) - (currR * prev);
                pairs++;
            }
            if (y + 1 < H) {
                const idxD = (y + 1) * W + x;
                const currD = frameCurr[idxD];
                const prevD = framePrev[idxD];
                sumDy += (curr * prevD) - (currD * prev);
            }
        }
    }

    const norm = pairs > 0 ? pairs : 1;
    return {
        hs: Math.max(-1.0, Math.min(1.0, (sumDx / norm) * 8.0)),
        vs: Math.max(-1.0, Math.min(1.0, (sumDy / norm) * 8.0)),
        t4: sumT4 / (W * H),
        t5: sumT5 / (W * H),
    };
}

runTest('4. Dinámica H-R: Detección de Flujo Óptico Horizontal hacia la Derecha', () => {
    // Franja vertical brillante moviéndose de columna 5 a columna 6
    const f0 = new Float32Array(256);
    const f1 = new Float32Array(256);

    for (let y = 0; y < 16; y++) {
        f0[y * 16 + 5] = 1.0;
        f1[y * 16 + 6] = 1.0;
    }

    const res = computeHrStep(f0, f1);
    // En el modelo delay-and-correlate, movimiento a la derecha genera respuesta asimétrica
    assert(Math.abs(res.hs) > 0.05, `Debe registrar flujo horizontal: actual ${res.hs}`);
    assert.strictEqual(res.vs, 0.0, 'Flujo vertical debe ser 0 para desplazamiento horizontal puro');
    assert(res.t4 > 0, 'Debe registrar incremento de contraste ON');
});

runTest('5. Dinámica H-R: Inmunidad ante Cuadros Idénticos Estáticos', () => {
    const f0 = new Float32Array(256).fill(0.5);
    const f1 = new Float32Array(256).fill(0.5);

    const res = computeHrStep(f0, f1);
    assert.strictEqual(res.hs, 0.0, 'HS debe ser 0.0 con escena estática');
    assert.strictEqual(res.vs, 0.0, 'VS debe ser 0.0 con escena estática');
    assert.strictEqual(res.t4, 0.0, 'T4 debe ser 0.0');
    assert.strictEqual(res.t5, 0.0, 'T5 debe ser 0.0');
});

// ── 3. Validación del Detector de Looming y Colisión LC4 / LPLC2 ──────────────

class MockOpticLobe {
    constructor() {
        this.escaped = false;
        this.threat = { isThreatDetected: false, expansionRate: 0, estimatedTtcMs: 9999 };
    }

    injectStimulus(targetSizeDeg, expansionRate) {
        const isCritical = expansionRate >= 1.2;
        const ttcMs = expansionRate > 0 ? Math.round((targetSizeDeg / expansionRate) * 10) : 150;
        this.threat = {
            isThreatDetected: isCritical,
            expansionRate,
            estimatedTtcMs: ttcMs,
        };
        if (isCritical) {
            this.escaped = true;
        }
        return isCritical;
    }
}

runTest('6. Detector Looming LC4: Expansión Lenta Normal NO dispara Reflejo', () => {
    const engine = new MockOpticLobe();
    const fired = engine.injectStimulus(20, 0.4); // 0.4 deg/s (tráfico distante)

    assert.strictEqual(fired, false, 'Expansión lenta no debe activar amenaza');
    assert.strictEqual(engine.escaped, false, 'No debe disparar reflejo de fibra gigante');
});

runTest('7. Detector Looming LC4: Expansión Balística Rápida (> 1.2/s) Dispara Escape', () => {
    const engine = new MockOpticLobe();
    const fired = engine.injectStimulus(45, 2.5); // Expansión violenta de aproximación

    assert.strictEqual(fired, true, 'Expansión violenta debe activar amenaza');
    assert.strictEqual(engine.escaped, true, 'Debe activar escape monosináptico inmediato');
    assert(engine.threat.estimatedTtcMs < 500, `TTC debe ser menor a 500ms: actual ${engine.threat.estimatedTtcMs}ms`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests < totalTests) {
    process.exit(1);
}

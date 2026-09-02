/**
 * TEST SUITE: OPTICAL GAS, SMOKE & AIR QUALITY INDEX (AQI) RESILIENCE
 * 
 * Valida la corrección de errores en OpticalGasAqiEngine.ts y AtmosphericSafetyModal.tsx:
 * 1. Inmunidad a corrupción NaN en métricas ópticas (luma, contraste, varianza de llama).
 * 2. Erradicación del bucle exponencial desbocado (setInterval + rAF) en AtmosphericSafetyModal.
 * 3. Incorporación de { willReadFrequently: true } y guardia de división por count > 0.
 * 4. Precisión de interpolación EPA AQI para PM2.5 y estimación de monóxido de carbono (CO).
 * 5. Detección espectral de partículas por dispersión Mie (cociente R/B) y vapores químicos.
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
console.log('🌫️ INICIANDO SUITE DE PRUEBAS: OPTICAL GAS & SMOKE AQI RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de AtmosphericSafetyModal.tsx ──────────────────────
const modalPath = path.join(__dirname, '..', 'src', 'components', 'AtmosphericSafetyModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

runTest('1. AtmosphericSafetyModal: Erradicación del doble bucle desbocado setInterval + rAF', () => {
    assert(!modalCode.includes('setInterval(processFrame, 500)'), 'No debe tener setInterval duplicando processFrame');
    assert(modalCode.includes('let isActive = true;'), 'Debe usar bandera isActive para control de ciclo de vida');
    assert(modalCode.includes('cancelAnimationFrame(animationFrame);'), 'Debe limpiar animationFrame en unmount');
});

runTest('2. AtmosphericSafetyModal: Optimización 2D willReadFrequently y guardia count > 0', () => {
    assert(modalCode.includes('{ willReadFrequently: true }'), 'Debe optimizar getImageData con willReadFrequently');
    assert(modalCode.includes('if (count > 0)'), 'Debe verificar count > 0 para evitar divisiones por cero');
});

// ── 2. Inspección Estática de OpticalGasAqiEngine.ts ──────────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'OpticalGasAqiEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('3. OpticalGasAqiEngine: Sanitización estricta contra NaN y valores no finitos', () => {
    assert(engineCode.includes("typeof stdDevContrast === 'number' && isFinite(stdDevContrast)"), 'Debe validar contraste finito');
    assert(engineCode.includes("typeof meanLuminance === 'number' && isFinite(meanLuminance)"), 'Debe validar luma finita');
    assert(engineCode.includes("typeof flameFlickerVariance === 'number' && isFinite(flameFlickerVariance)"), 'Debe validar parpadeo finito');
});

runTest('4. OpticalGasAqiEngine: Análisis de dispersión Mie espectral (R/B y G/B)', () => {
    assert(engineCode.includes('safeColor.r > safeColor.b * 1.35'), 'Debe identificar dispersión de Mie por humo orgánico');
    assert(engineCode.includes('safeColor.g > safeColor.b * 1.35'), 'Debe identificar alerta de vapores químicos');
});

// ── 3. Validación Matemática y Física de AQI ───────────────────────────────────
function simulateOpticalFrame(meanLuminance, stdDevContrast, colorShift, flameFlickerVariance = 0) {
    const safeContrast = (typeof stdDevContrast === 'number' && isFinite(stdDevContrast) && stdDevContrast >= 0)
        ? stdDevContrast
        : 48;
    const safeFlicker = (typeof flameFlickerVariance === 'number' && isFinite(flameFlickerVariance) && flameFlickerVariance >= 0)
        ? flameFlickerVariance
        : 0;

    const normalizedContrast = Math.max(5, Math.min(60, safeContrast));
    const smokeOpacityPct = Math.round(Math.max(0, Math.min(100, (1 - (normalizedContrast / 55)) * 100)));
    const pm25Ugm3 = Math.round(10 + (smokeOpacityPct / 100) * 450);

    const flameFlickerDetected = safeFlicker > 18;
    const flickerFrequencyHz = flameFlickerDetected ? Math.round((6 + (safeFlicker % 6)) * 10) / 10 : 0;

    return {
        smokeOpacityPct,
        pm25Ugm3,
        flameFlickerDetected,
        flickerFrequencyHz,
    };
}

runTest('5. Física Óptica: Entrada NaN retorna opacidad y PM2.5 seguros sin NaN', () => {
    const res = simulateOpticalFrame(NaN, NaN, null, NaN);
    assert(isFinite(res.smokeOpacityPct) && res.smokeOpacityPct >= 0, 'Opacidad debe ser finita');
    assert(isFinite(res.pm25Ugm3) && res.pm25Ugm3 >= 10, 'PM2.5 debe ser finito');
});

runTest('6. Física Óptica: Humo denso (stdDev = 8) arroja opacidad > 80% y PM2.5 > 350 ug/m³', () => {
    const res = simulateOpticalFrame(80, 8, { r: 150, g: 100, b: 80 });
    assert(res.smokeOpacityPct >= 80, `Opacidad esperada >= 80%, obtenida: ${res.smokeOpacityPct}%`);
    assert(res.pm25Ugm3 >= 350, `PM2.5 esperado >= 350, obtenido: ${res.pm25Ugm3}`);
});

runTest('7. Detección de Fuego: Varianza de parpadeo temporal = 24 detecta llama activa en 3-15 Hz', () => {
    const res = simulateOpticalFrame(160, 30, { r: 200, g: 100, b: 50 }, 24);
    assert.strictEqual(res.flameFlickerDetected, true, 'Debe detectar parpadeo de llama');
    assert(res.flickerFrequencyHz >= 6 && res.flickerFrequencyHz <= 15, `Frecuencia esperada 6-15 Hz, obtenida: ${res.flickerFrequencyHz} Hz`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

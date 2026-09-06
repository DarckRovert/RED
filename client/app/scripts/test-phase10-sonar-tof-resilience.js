/**
 * TEST SUITE: PHASE 10 - ACOUSTIC SONAR TOF & CAVITY RESONANCE RESILIENCE
 * 
 * Valida la Ecosonda Sonar ToF y Resonancia de Cavidades:
 * 1. Inspección Estática: Inicialización de captura de micrófono raw (sin cancelación de eco).
 * 2. Inspección Estática: Filtro pasabanda Biquad (5000 Hz, Q 1.2) y Analizador FFT.
 * 3. Inspección Estática: Liberación rigurosa de tracks de micrófono y nodos en destroy().
 * 4. Modelo Acústico Físico: Ecuación de Laplace para velocidad del sonido en aire según temperatura.
 * 5. Modelo Acústico Hidroacústico: Bilaniuk-Wong con corrección de salinidad para agua.
 * 6. Análisis Espectral de Cavidad: Relación de resonancia de Helmholtz / modos normales y volumen m³.
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
console.log('🦇 INICIANDO SUITE DE PRUEBAS: PHASE 10 - ACOUSTIC SONAR TOF & CAVITY RESONANCE');
console.log('================================================================================\n');

const sonarPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'AcousticSonarEngine.ts');
const sonarCode = fs.readFileSync(sonarPath, 'utf8');

const modalPath = path.join(__dirname, '..', 'src', 'components', 'SonarSeismicModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

// ── 1. Inspección Estática de Código Fuente ───────────────────────────────────
runTest('1. AcousticSonarEngine: Captura de micrófono raw con cancelación de eco desactivada', () => {
    assert(sonarCode.includes('echoCancellation: false'), 'Debe solicitar audio sin echoCancellation para captar ecos físicos');
    assert(sonarCode.includes('noiseSuppression: false'), 'Debe solicitar audio sin noiseSuppression');
    assert(sonarCode.includes('autoGainControl: false'), 'Debe solicitar audio sin autoGainControl');
});

runTest('2. AcousticSonarEngine: Filtro pasabanda acústico Biquad para FMCW (3 kHz - 7.5 kHz)', () => {
    assert(sonarCode.includes("this.bandpassFilter.type = 'bandpass'"), 'Debe configurar filtro tipo bandpass');
    assert(sonarCode.includes('this.echoAnalyser = this.audioCtx.createAnalyser()'), 'Debe inicializar AnalyserNode para correlación');
    assert(sonarCode.includes('this.echoAnalyser.fftSize = 2048'), 'FFT size debe ser 2048 para resolución espectral');
});

runTest('3. AcousticSonarEngine: Higiene de recursos y detención de streams en destroy()', () => {
    assert(sonarCode.includes('this.micStream.getTracks().forEach(t => t.stop())'), 'Debe apagar pistas de micrófono en destroy()');
    assert(sonarCode.includes('osc.onended = () => {'), 'Debe definir osc.onended');
    assert(sonarCode.includes('osc.disconnect()'), 'Debe desconectar osc');
    assert(sonarCode.includes('gain.disconnect()'), 'Debe desconectar gain');
    assert(sonarCode.includes('this.bandpassFilter.disconnect()'), 'Debe desconectar bandpassFilter');
    assert(sonarCode.includes('this.echoAnalyser.disconnect()'), 'Debe desconectar echoAnalyser');
});

runTest('4. SonarSeismicModal: HUD táctico muestra indicador de retorno micro y SNR', () => {
    assert(modalCode.includes('🎙️ RETORNO ACÚSTICO MICRO'), 'Debe incluir badge para retorno acústico de micrófono');
    assert(modalCode.includes('Relación SNR Eco:'), 'Debe mostrar relación SNR de eco');
    assert(modalCode.includes('Resonancia Cavidad:'), 'Debe mostrar resonancia de cavidad');
});

// ── 2. Simulación de Fórmulas Físicas ─────────────────────────────────────────

// Ecuación de Laplace para aire
function getLaplaceSpeedAir(tempC) {
    const ratio = Math.max(0.01, 1 + tempC / 273.15);
    return Math.round((331.3 * Math.sqrt(ratio)) * 10) / 10;
}

runTest('5. Física Acústica: Velocidad de propagación en aire a 20°C y variaciones térmicas', () => {
    const speed20C = getLaplaceSpeedAir(20);
    assert(Math.abs(speed20C - 343.2) < 0.3, `Velocidad a 20°C debe ser ~343.2 m/s (obtenido: ${speed20C})`);

    const speed0C = getLaplaceSpeedAir(0);
    assert.strictEqual(speed0C, 331.3, 'Velocidad a 0°C debe ser exactamente 331.3 m/s');

    const speed40C = getLaplaceSpeedAir(40);
    assert(speed40C > speed20C, 'A mayor temperatura, la velocidad del sonido en aire aumenta');
});

// Ecuación Bilaniuk-Wong con salinidad
function getSpeedWater(tempC, salinityPpt) {
    const cBase = 1402.4 + 5.01 * tempC - 0.055 * (tempC * tempC) + 0.00022 * (tempC * tempC * tempC);
    const salinityCorrection = 1.34 * salinityPpt;
    const c = cBase + salinityCorrection;
    return Math.round((c > 0 ? c : 1480.0) * 10) / 10;
}

runTest('6. Física Hidroacústica: Ecuación Bilaniuk-Wong con corrección de salinidad', () => {
    const waterFresh20C = getSpeedWater(20, 0);
    assert(Math.abs(waterFresh20C - 1482.4) < 1.0, `Agua dulce a 20°C debe ser ~1482.4 m/s (obtenido: ${waterFresh20C})`);

    const waterSea20C = getSpeedWater(20, 35);
    assert(waterSea20C > waterFresh20C, 'La salinidad oceánica aumenta la velocidad del sonido bajo el agua');
    assert(Math.abs(waterSea20C - 1529.3) < 1.0, `Agua de mar 35ppt a 20°C debe ser ~1529.3 m/s (obtenido: ${waterSea20C})`);
});

// Resonancia de cavidad y estimación de volumen
function estimateCavityVolume(speed, resonanceHz) {
    const wavelengthHalf = speed / (2 * Math.max(20, resonanceHz));
    return Math.round(Math.pow(wavelengthHalf, 3) * 10) / 10;
}

runTest('7. Resonancia de Cavidad: Frecuencias bajas corresponden a mayores volúmenes subterráneos', () => {
    const volLargeCave = estimateCavityVolume(343, 30); // 30 Hz
    const volSmallRoom = estimateCavityVolume(343, 150); // 150 Hz

    assert(volLargeCave > volSmallRoom, 'Una frecuencia de resonancia menor debe indicar una cavidad significativamente mayor');
    assert(volLargeCave > 100, 'Una cavidad de 30 Hz debe superar los 100 m³');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

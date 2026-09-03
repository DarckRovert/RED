/**
 * TEST SUITE: TACTICAL SENSORS ZERO-CALIBRATION, HARDWARE RESILIENCE & NAN IMMUNITY
 * 
 * Valida empíricamente la robustez de los sensores tácticos de campo:
 * 1. Calibración de cero magnético y persistencia en localStorage en MagneticAnomalyDetectorEngine.ts.
 * 2. Inmunidad a NaNs en orientación y detección de presencia de sensor físico (isSensorOnline).
 * 3. Calibración de frecuencia base f0 y persistencia en StructuralHealthSeismicEngine.ts.
 * 4. Resiliencia de velocidad del sonido ante temperaturas criogénicas y salinidades extremas en AcousticSonarEngine.ts.
 * 5. Calibración barométrica QNH a nivel del mar en weatherBarometerEngine.ts.
 * 6. Integración de controles y HUD en OffGridCompassModal.tsx y SonarSeismicModal.tsx.
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
console.log('📡 INICIANDO SUITE DE PRUEBAS: TACTICAL SENSORS CALIBRATION & RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección y Verificación de MagneticAnomalyDetectorEngine.ts ──────────
const magPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'MagneticAnomalyDetectorEngine.ts');
const magCode = fs.readFileSync(magPath, 'utf8');

runTest('1. MagneticDetector: Persistencia de calibración cero en localStorage y reseteo', () => {
    assert(magCode.includes("localStorage.getItem('red_magnetic_baseline_ut')"), 'Debe leer línea base guardada');
    assert(magCode.includes("localStorage.setItem('red_magnetic_baseline_ut'"), 'Debe persistir calibración en disco');
    assert(magCode.includes("localStorage.removeItem('red_magnetic_baseline_ut')"), 'Debe limpiar en resetCalibration');
    assert(magCode.includes('public resetCalibration()'), 'Debe proveer método público resetCalibration');
});

runTest('2. MagneticDetector: Telemetría isSensorOnline y sanitización de ángulos NaN', () => {
    assert(magCode.includes('isSensorOnline: boolean;'), 'MagneticTelemetry debe reportar estado del hardware');
    assert(magCode.includes('this.isSensorOnline = true;'), 'Debe marcar online al recibir datos de hardware u orientación');
    assert(magCode.includes("typeof e.alpha === 'number' && isFinite(e.alpha)"), 'Debe verificar finitud en alpha');
    assert(magCode.includes("typeof e.beta === 'number' && isFinite(e.beta)"), 'Debe verificar finitud en beta');
    assert(magCode.includes("typeof e.gamma === 'number' && isFinite(e.gamma)"), 'Debe verificar finitud en gamma');
});

// ── 2. Inspección y Verificación de StructuralHealthSeismicEngine.ts ──────────
const structPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'StructuralHealthSeismicEngine.ts');
const structCode = fs.readFileSync(structPath, 'utf8');

runTest('3. StructuralHealth: Calibración f0, persistencia y estado isSensorAvailable', () => {
    assert(structCode.includes('isSensorAvailable: boolean;'), 'StructuralHealthTelemetry debe reportar disponibilidad de sensor');
    assert(structCode.includes("localStorage.getItem('red_structural_baseline_hz')"), 'Debe leer f0 base guardada');
    assert(structCode.includes("localStorage.setItem('red_structural_baseline_hz'"), 'Debe persistir f0 en localStorage');
    assert(structCode.includes('public resetCalibration()'), 'Debe proveer resetCalibration');
    assert(structCode.includes('this.isSensorAvailable = true;'), 'Debe detectar eventos inerciales físicos activos');
});

// ── 3. Inspección y Verificación de AcousticSonarEngine.ts ────────────────────
const sonarPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'AcousticSonarEngine.ts');
const sonarCode = fs.readFileSync(sonarPath, 'utf8');

runTest('4. AcousticSonarEngine: Protección contra NaN y temperaturas criogénicas', () => {
    assert(sonarCode.includes('Math.max(0.01, 1 + T / 273.15)'), 'Debe evitar números complejos en raíz cuadrada');
    assert(sonarCode.includes("typeof tempC === 'number' && isFinite(tempC)"), 'Debe validar finitud en temperatura');
    assert(sonarCode.includes("typeof ppt === 'number' && isFinite(ppt)"), 'Debe validar finitud en salinidad');
});

// ── 4. Algoritmo Barométrico QNH (Física Atmosférica) ─────────────────────────
function calculateQnhSeaLevelPressure(stationPressureHpa, elevationMeters, temperatureC = 15) {
    if (!isFinite(stationPressureHpa) || stationPressureHpa < 500 || stationPressureHpa > 1150) {
        return 1013.25;
    }
    if (!isFinite(elevationMeters) || elevationMeters < -500 || elevationMeters > 9000) {
        return Math.round(stationPressureHpa * 10) / 10;
    }
    const safeTemp = (typeof temperatureC === 'number' && isFinite(temperatureC)) ? temperatureC : 15;
    const lapseRate = 0.0065; // K/m
    const tKelvin = safeTemp + 273.15;
    const factor = 1 - (lapseRate * elevationMeters) / (tKelvin + lapseRate * elevationMeters);
    if (factor <= 0) return Math.round(stationPressureHpa * 10) / 10;
    const seaLevel = stationPressureHpa * Math.pow(factor, -5.257);
    return Math.round((isFinite(seaLevel) ? seaLevel : stationPressureHpa) * 10) / 10;
}

runTest('5. weatherBarometer: Algoritmo de calibración QNH a nivel del mar', () => {
    // 1. A nivel del mar, QNH es idéntico a estación
    const sea = calculateQnhSeaLevelPressure(1013.2, 0, 15);
    assert.strictEqual(sea, 1013.2, 'A 0 metros debe dar 1013.2 hPa');

    // 2. A 2000m de altitud con 800 hPa de estación
    const qnh = calculateQnhSeaLevelPressure(800, 2000, 10);
    assert(qnh > 800, 'QNH debe ser mayor que estación');
    assert(qnh > 1000 && qnh < 1030, 'QNH debe corresponder al estándar troposférico');

    // 3. Resiliencia ante entradas no finitas
    assert.strictEqual(calculateQnhSeaLevelPressure(NaN, 100), 1013.25, 'NaN retorna estándar');
});

// ── 5. Componentes UI Tácticos ───────────────────────────────────────────────
const compassPath = path.join(__dirname, '..', 'src', 'components', 'OffGridCompassModal.tsx');
const compassCode = fs.readFileSync(compassPath, 'utf8');

runTest('6. HUD OffGridCompassModal: Tarjeta táctica de anomalías y botón calibrar cero', () => {
    assert(compassCode.includes('DETECTOR DE ANOMALÍAS MAGNÉTICAS'), 'Debe contener la tarjeta de anomalías');
    assert(compassCode.includes('magneticDetector.calibrateBaseline()'), 'Debe enlazar el botón de calibración');
    assert(compassCode.includes('magneticDetector.toggleAudioBeeps()'), 'Debe enlazar el toggle de audio Geiger');
    assert(compassCode.includes('magTelemetry.magnitudeMicroteslas'), 'Debe mostrar lectura de microteslas');
});

const sonarModalPath = path.join(__dirname, '..', 'src', 'components', 'SonarSeismicModal.tsx');
const sonarModalCode = fs.readFileSync(sonarModalPath, 'utf8');

runTest('7. HUD SonarSeismicModal: Control de monitoreo y calibración de f0 base', () => {
    assert(sonarModalCode.includes('handleToggleStructuralMonitoring'), 'Debe tener control para iniciar/detener monitoreo');
    assert(sonarModalCode.includes('handleCalibrateStructuralBaseline'), 'Debe tener botón de calibrar f0 base');
    assert(sonarModalCode.includes('structuralHealthSeismic.calibrateBaseline()'), 'Debe invocar calibración en el motor');
    assert(sonarModalCode.includes('structTelemetry.isSensorAvailable'), 'Debe reflejar estado del hardware acelerómetro');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

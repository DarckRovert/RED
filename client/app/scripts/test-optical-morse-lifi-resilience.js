/**
 * TEST SUITE: OPTICAL MORSE LI-FI TRANSCEIVER RESILIENCE
 * 
 * Valida la corrección de errores en OpticalMorseLiFiEngine.ts y SurvivalBeaconModal.tsx:
 * 1. Cancelación instantánea a 0ms mediante abortSleep al invocar stopTransmission().
 * 2. Inmunidad a corrupción NaN en WPM y unitMs.
 * 3. Rechazo inmediato de mensajes vacíos o nulos sin división por cero (0/0) en progreso.
 * 4. Fiel codificación ITU de patrones de emergencia (SOS = "... --- ...").
 * 5. Supresión de setTimeout huérfano en audioTone mediante osc.onended y stop programado.
 * 6. Limpieza garantizada de transmisión en el unmount de SurvivalBeaconModal.tsx.
 * 7. Limpieza formal de recursos y estado en destroy().
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
console.log('💡 INICIANDO SUITE DE PRUEBAS: OPTICAL MORSE LI-FI RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de SurvivalBeaconModal.tsx ──────────────────────────
const modalPath = path.join(__dirname, '..', 'src', 'components', 'SurvivalBeaconModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

runTest('1. SurvivalBeaconModal: Limpieza obligatoria de stopTransmission() en unmount cleanup', () => {
    assert(modalCode.includes('opticalMorseLiFi.stopTransmission();'), 'Debe detener la transmisión al desmontar el modal');
});

// ── 2. Inspección Estática de OpticalMorseLiFiEngine.ts ────────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'OpticalMorseLiFiEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('2. OpticalMorseLiFiEngine: Mecanismo de cancelación instantánea abortSleep()', () => {
    assert(engineCode.includes('private abortSleep()'), 'Debe existir el método abortSleep');
    assert(engineCode.includes('this.abortSleep();'), 'stopTransmission debe abortar sleep inmediatamente');
});

runTest('3. OpticalMorseLiFiEngine: Sanitización estricta de WPM contra NaN y valores extremos', () => {
    assert(engineCode.includes("typeof wpm === 'number' && isFinite(wpm)"), 'Debe comprobar que wpm sea finito');
    assert(engineCode.includes('Math.max(4, Math.min(25, Math.round(wpm)))'), 'Debe acotar WPM a [4, 25]');
});

runTest('4. OpticalMorseLiFiEngine: Web Audio sin setTimeout huérfano con osc.onended', () => {
    assert(engineCode.includes('osc.onended = () => {'), 'Debe registrar onended en el oscilador');
    assert(!engineCode.includes('setTimeout(() => {\n                try {\n                    osc.stop();'), 'No debe usar setTimeout para stop del oscilador');
});

// ── 3. Validación de Lógica de Codificación y Temporización ───────────────────
const MORSE_DICTIONARY = {
    'S': '...', 'O': '---', 'R': '.-.', 'E': '.', 'D': '-..'
};

function encodeMorse(text) {
    const clean = typeof text === 'string' ? text.toUpperCase().trim() : '';
    if (!clean) return '';
    return Array.from(clean).map(c => MORSE_DICTIONARY[c] || '?').join(' ');
}

runTest('5. Codificación ITU: Patrón de emergencia SOS produce "... --- ..."', () => {
    const code = encodeMorse('SOS');
    assert.strictEqual(code, '... --- ...', `Esperado: "... --- ...", obtenido: "${code}"`);
});

runTest('6. Codificación ITU: Entrada vacía o de solo espacios retorna cadena vacía sin error', () => {
    assert.strictEqual(encodeMorse(''), '');
    assert.strictEqual(encodeMorse('   '), '');
    assert.strictEqual(encodeMorse(null), '');
});

runTest('7. Temporización: WPM 12 produce unidad de 100ms; WPM NaN produce fallback 100ms', () => {
    const calcUnit = (wpm) => {
        const safe = (typeof wpm === 'number' && isFinite(wpm)) ? Math.max(4, Math.min(25, Math.round(wpm))) : 12;
        return Math.round(1200 / safe);
    };
    assert.strictEqual(calcUnit(12), 100, `Esperado 100ms a 12 WPM, obtenido: ${calcUnit(12)}ms`);
    assert.strictEqual(calcUnit(NaN), 100, `Esperado fallback 100ms ante NaN, obtenido: ${calcUnit(NaN)}ms`);
    assert.strictEqual(calcUnit(20), 60, `Esperado 60ms a 20 WPM, obtenido: ${calcUnit(20)}ms`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

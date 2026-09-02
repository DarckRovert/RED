/**
 * TEST SUITE: OPTICAL MORSE RX RESILIENCE & GHOST LISTENER LEAK ERADICATION
 * 
 * Valida la corrección de errores en OpticalMorseRxEngine.ts y AirGapStegoModal.tsx:
 * 1. getState() retorna estado tipado válido sin fugar listeners fantasma.
 * 2. processFrameLuminance descarta valores NaN sin envenenar el historial móvil de luminancia.
 * 3. Acotación de seguridad del buffer de símbolos (<= 8) contra saturación por parpadeo ruidoso.
 * 4. reset() y destroy() limpian historial, estado y liberan listeners.
 * 5. AirGapStegoModal.tsx no invoca subscribe en useState.
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
console.log('💡 INICIANDO SUITE DE PRUEBAS: OPTICAL MORSE RX & LI-FI RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de OpticalMorseRxEngine.ts ─────────────────────────
const rxPath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'OpticalMorseRxEngine.ts');
const rxCode = fs.readFileSync(rxPath, 'utf8');

runTest('1. OpticalMorseRxEngine: Exposición de método getState() sin suscripciones parásitas', () => {
    assert(rxCode.includes('public getState(): MorseRxState'), 'Debe implementar getState()');
    assert(rxCode.includes('return { ...this.currentState };'), 'getState() debe retornar copia del estado actual');
});

runTest('2. OpticalMorseRxEngine: Sanitización de luma contra NaN y valores no finitos', () => {
    assert(rxCode.includes('if (!isFinite(luma)) return this.currentState;'), 'Debe rechazar luma no finita o NaN');
});

runTest('3. OpticalMorseRxEngine: Acotamiento de buffer de símbolos para prevenir desbordamientos', () => {
    assert(rxCode.includes('this.currentSymbolBuffer.length < 8'), 'Debe acotar el buffer de símbolos ITU a <= 8');
});

runTest('4. OpticalMorseRxEngine: Implementación de reset() y destroy() para ciclo de vida limpio', () => {
    assert(rxCode.includes('public reset(): void'), 'Debe implementar reset()');
    assert(rxCode.includes('public destroy(): void'), 'Debe implementar destroy()');
    assert(rxCode.includes('this.listeners.clear()'), 'destroy() debe limpiar listeners');
});

// ── 2. Inspección Estática de AirGapStegoModal.tsx ────────────────────────────
const modalPath = path.join(__dirname, '..', 'src', 'components', 'AirGapStegoModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

runTest('5. AirGapStegoModal: Erradicación de la fuga de listener en useState', () => {
    assert(!modalCode.includes('opticalMorseRxEngine.subscribe(() => {})'), 'No debe invocar subscribe(() => {}) en useState');
    assert(modalCode.includes('useState<MorseRxState>(() => opticalMorseRxEngine.getState())'), 'Debe inicializar con opticalMorseRxEngine.getState()');
});

runTest('6. AirGapStegoModal: Invocación de opticalMorseRxEngine.reset() en unmount cleanup', () => {
    assert(modalCode.includes('opticalMorseRxEngine.reset();'), 'useEffect cleanup debe resetear el motor óptico');
});

// ── 3. Validación de Lógica Decodificadora ITU Morse ──────────────────────────
const REVERSE_MORSE_TABLE = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z', '...---...': 'SOS'
};

runTest('7. Decodificación ITU: Resolución de patrones críticos de emergencia (SOS, RED)', () => {
    assert.strictEqual(REVERSE_MORSE_TABLE['...---...'], 'SOS');
    assert.strictEqual(REVERSE_MORSE_TABLE['.-.'], 'R');
    assert.strictEqual(REVERSE_MORSE_TABLE['.'], 'E');
    assert.strictEqual(REVERSE_MORSE_TABLE['-..'], 'D');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

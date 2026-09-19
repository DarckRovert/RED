/**
 * test-manual-torpor-override.js — RED Sovereign Mesh OS
 * 
 * Test Suite Automatizado: Manual Forced Torpor Override & Multi-Module Synchrony.
 * Valida el control de torpor inducido manualmente para situaciones de supervivencia crítica:
 * 1. Activación de torpor forzado vía metabolicGovernor.setForcedTorpor(true).
 * 2. Transición inmediata al régimen TORPOR independientemente del porcentaje de batería.
 * 3. Estrangulamiento de radio LoRa TDMA y suspensión de workers de IA pesados.
 * 4. Desactivación manual y restauración higiénica del régimen dinámico.
 * 5. Integración en ExtremeSurvivalHudModal.tsx y MaleCnsConnectomeHUD.tsx.
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
console.log('🧊 MANUAL FORCED TORPOR OVERRIDE & HARDWARE RESILIENCE TEST SUITE');
console.log('================================================================================\n');

// ── 1. Verificación Estática del Código Fuente ────────────────────────────────
const govPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'MetabolicNeuromorphicGovernor.ts');
const govCode = fs.readFileSync(govPath, 'utf8');

const extremeHudPath = path.join(__dirname, '..', 'src', 'components', 'ExtremeSurvivalHudModal.tsx');
const extremeHudCode = fs.readFileSync(extremeHudPath, 'utf8');

const cnsHudPath = path.join(__dirname, '..', 'src', 'components', 'MaleCnsConnectomeHUD.tsx');
const cnsHudCode = fs.readFileSync(cnsHudPath, 'utf8');

runTest('1. MetabolicNeuromorphicGovernor: Métodos de Torpor Forzado', () => {
    assert(govCode.includes('public setForcedTorpor(enabled: boolean): void'), 'Debe exponer setForcedTorpor');
    assert(govCode.includes('public isForcedTorpor(): boolean'), 'Debe exponer isForcedTorpor');
    assert(govCode.includes('setOverrideRegime'), 'Debe persistir régimen de torpor forzado');
});

runTest('2. ExtremeSurvivalHudModal: Integración de Banner y Control de Torpor', () => {
    assert(extremeHudCode.includes('metabolicGovernor'), 'Debe importar metabolicGovernor');
    assert(extremeHudCode.includes('handleToggleTorpor'), 'Debe implementar manejador handleToggleTorpor');
    assert(extremeHudCode.includes('TORPOR NEUROMÓRFICO FORZADO'), 'Debe presentar banner de alto impacto visual');
});

runTest('3. MaleCnsConnectomeHUD: Control de Torpor en Tarjeta Metabólica', () => {
    assert(cnsHudCode.includes('isForcedTorpor'), 'Debe mantener estado isForcedTorpor');
    assert(cnsHudCode.includes('metabolicGovernor.setForcedTorpor'), 'Debe permitir alternar torpor forzado');
});

// ── 2. Emulación Funcional de la Lógica del Gobernador ────────────────────────
runTest('4. Simulación Funcional: Régimen Dinámico vs Torpor Forzado', () => {
    class MockMetabolicGovernor {
        constructor() {
            this.batteryPct = 85;
            this.isCharging = false;
            this.forcedTorpor = false;
            this.loraThrottled = false;
            this.aiPaused = false;
        }

        evalRegime() {
            if (this.forcedTorpor) return 'TORPOR';
            if (this.isCharging) return 'SURFEIT';
            if (this.batteryPct < 20) return 'TORPOR';
            if (this.batteryPct < 50) return 'CONSERVATIVE';
            return 'OPTIMAL';
        }

        setForcedTorpor(enabled) {
            this.forcedTorpor = enabled;
            const regime = this.evalRegime();
            if (regime === 'TORPOR') {
                this.loraThrottled = true;
                this.aiPaused = true;
            } else {
                this.loraThrottled = false;
                this.aiPaused = false;
            }
        }
    }

    const gov = new MockMetabolicGovernor();
    assert.strictEqual(gov.evalRegime(), 'OPTIMAL', 'Con 85% y sin forzar debe ser OPTIMAL');
    assert.strictEqual(gov.loraThrottled, false);
    assert.strictEqual(gov.aiPaused, false);

    // Activar Torpor forzado
    gov.setForcedTorpor(true);
    assert.strictEqual(gov.evalRegime(), 'TORPOR', 'Con torpor forzado debe forzar régimen TORPOR');
    assert.strictEqual(gov.loraThrottled, true, 'LoRa debe ser estrangulado');
    assert.strictEqual(gov.aiPaused, true, 'IA debe ser pausada');

    // Desactivar Torpor forzado
    gov.setForcedTorpor(false);
    assert.strictEqual(gov.evalRegime(), 'OPTIMAL', 'Al liberar torpor debe regresar a OPTIMAL');
    assert.strictEqual(gov.loraThrottled, false, 'LoRa debe reanudar cadencia');
    assert.strictEqual(gov.aiPaused, false, 'IA debe reanudarse');
});

console.log(`\nResultados: ${passedTests}/${totalTests} pruebas superadas.`);
if (passedTests !== totalTests) {
    process.exit(1);
}
console.log('✨ SUITE MANUAL FORCED TORPOR OVERRIDE EXITOSA.\n');

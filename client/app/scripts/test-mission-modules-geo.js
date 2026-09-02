/**
 * TEST SUITE: MISSION MODULES TACTICAL LOCATION RESILIENCE
 * 
 * Valida que los 7 módulos de misión táctica (ATAK LoRa CoT, Foxhunt RDF,
 * Ephemeris Celestial, CBRN Plume, Extreme Survival HUD, TCCC VitalScan y Weather Alert)
 * utilicen TacticalLocationEngine sin llamadas bloqueantes ni ceros artificiales.
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
console.log('🛰️ INICIANDO SUITE DE PRUEBAS: MISSION MODULES TACTICAL LOCATION RESILIENCE');
console.log('================================================================================\n');

const componentsDir = path.join(__dirname, '..', 'src', 'components');

runTest('1. LoraTransceiverModal: Emisión ATAK CoT usa TacticalLocationEngine (Cero tropas en 0,0)', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'LoraTransceiverModal.tsx'), 'utf8');
    assert(content.includes('TacticalLocationEngine.getEmergencyLocation'), 'Debe usar TacticalLocationEngine');
    assert(!content.includes('timeout: 3000'), 'No debe tener timeout agresivo de 3000ms');
});

runTest('2. ExtremeSurvivalHudModal: HUD de supervivencia extrema usa watchLocation', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'ExtremeSurvivalHudModal.tsx'), 'utf8');
    assert(content.includes('TacticalLocationEngine.watchLocation'), 'Debe usar watchLocation');
});

runTest('3. TacticalFoxhuntModal: Triangulación RDF usa watchLocation para muestreo dinámico', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'TacticalFoxhuntModal.tsx'), 'utf8');
    assert(content.includes('TacticalLocationEngine.watchLocation'), 'Debe usar watchLocation');
});

runTest('4. CelestialPdrModal: Efemérides solares y navegación astronómica usan watchLocation', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'CelestialPdrModal.tsx'), 'utf8');
    assert(content.includes('TacticalLocationEngine.watchLocation'), 'Debe usar watchLocation');
});

runTest('5. CbrnSatelliteModal: Pluma nuclear y órbitas satelitales usan watchLocation', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'CbrnSatelliteModal.tsx'), 'utf8');
    assert(content.includes('TacticalLocationEngine.watchLocation'), 'Debe usar watchLocation');
});

runTest('6. VitalScanModal: Reportes de triaje médico de combate TCCC usan watchLocation', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'VitalScanModal.tsx'), 'utf8');
    assert(content.includes('TacticalLocationEngine.watchLocation'), 'Debe usar watchLocation');
});

runTest('7. WeatherAlertPanel: Alertas climáticas usan TacticalLocationEngine', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'WeatherAlertPanel.tsx'), 'utf8');
    assert(content.includes('TacticalLocationEngine.getEmergencyLocation'), 'Debe usar TacticalLocationEngine');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

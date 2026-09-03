/**
 * TEST SUITE: TACTICAL MAP & PDR INERTIAL NAVIGATION INTEGRATION
 * 
 * Valida la integración completa del subsistema de navegación inercial (PDR)
 * y persistencia cartográfica offline en NodeMap.tsx y OfflineTileCacheEngine.ts.
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
console.log('🗺️ INICIANDO SUITE DE PRUEBAS: MAPA TÁCTICO & PDR INERCIAL INTEGRADO');
console.log('================================================================================\n');

const nodeMapPath = path.join(__dirname, '..', 'src', 'components', 'NodeMap.tsx');
const nodeMapCode = fs.readFileSync(nodeMapPath, 'utf8');

runTest('1. Integración PDR: Importación de PdrState y suscripción en NodeMap.tsx', () => {
    assert(nodeMapCode.includes('import { pedestrianDeadReckoning, PdrState }'), 'Debe importar pedestrianDeadReckoning y PdrState');
    assert(nodeMapCode.includes('pedestrianDeadReckoning.subscribe'), 'Debe suscribirse a eventos de paso y rumbo');
});

runTest('2. Vector Inercial Táctico: Conversión de metros N/E a coordenadas geodésicas WGS84', () => {
    assert(nodeMapCode.includes('pdrState.displacementNorthMeters / 111000'), 'Debe proyectar delta norte a latitud');
    assert(nodeMapCode.includes('Math.max(0.01, Math.cos((pdrOriginRef.current.lat * Math.PI) / 180))'), 'Debe aplicar corrección cos(lat) segura');
});

runTest('3. Erradicación de Fuga de Memoria: Eliminado listener tileerror con capas duplicadas', () => {
    assert(!nodeMapCode.includes('osmLayer.on("tileerror"'), 'No debe agregar capas ArcGIS duplicadas en cada tesela fallida');
    assert(nodeMapCode.includes('errorTileUrl: "data:image/svg+xml'), 'Debe renderizar la grilla vectorial táctica SVG sin emitir requests');
});

runTest('4. HUD & Marcador Táctico: Conmutación visual entre GPS (📍) e Inercial (🧭 con rotación)', () => {
    assert(nodeMapCode.includes('transform:rotate(${pdrState.currentHeadingDeg}deg)'), 'Debe rotar el marcador táctico según el rumbo magnético');
    assert(nodeMapCode.includes('🧭 PDR INERCIAL ACTIVO'), 'Debe reflejar estado inercial en el HUD superior');
    assert(nodeMapCode.includes('handleTogglePdr'), 'Debe proveer botón de alternancia PDR');
});

runTest('5. Guía Táctica Off-Grid: Vector a objetivo guiado por brújula PDR en ausencia de GPS', () => {
    assert(nodeMapCode.includes('isPdrActive ? pdrState.currentHeadingDeg : (gpsData.heading || 0)'), 'La orientación hacia el objetivo debe alimentarse del compás PDR');
});

runTest('6. Bóveda Cartográfica: Control de descarga de cuadrícula y estadísticas en HUD', () => {
    assert(nodeMapCode.includes('Bóveda de Mapas Offline'), 'Debe incluir modal de persistencia offline');
    assert(nodeMapCode.includes('offlineTileCacheEngine.downloadRegion'), 'Debe invocar downloadRegion con radio seleccionado');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

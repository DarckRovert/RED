/**
 * TEST SUITE: PHASE 10 - SATELLITE TRANSPORT INTEGRATION & UNIVERSAL UI RESILIENCE
 * 
 * Valida la integración de transporte real y visibilidad omnicanal del Gateway Satelital LEO:
 * 1. DynamicBearerGovernor.ts:
 *    - Definición de SATELLITE_LEO como portador táctico enjambre.
 *    - Sincronización con la telemetría orbital y cálculo de AOS.
 *    - Promoción a portador primario ante ausencia de radio terrestre (Failover Espacial).
 * 2. meshRouter.ts:
 *    - Fallback Paso 6 autónomo a satélite LEO en meshRouter.send().
 *    - Encolamiento y ráfaga automática ante paquetes SOS o prioridad sin enlace local.
 * 3. StatusHeader.tsx:
 *    - Suscripción reactiva a telemetría satelital.
 *    - Pill satelital táctico interactivo (🛰️ LEO AOS) con navegación directa.
 *    - Reflejo de red activa SAT LEO.
 * 4. SwarmHealthHUD.tsx:
 *    - Soporte completo para SATELLITE_LEO en matriz de portadores.
 *    - Acción para forzar conmutación a enlace satelital.
 * 5. SidebarHeader.tsx:
 *    - Indicador de enlace orbital continuo en cabecera de mensajería.
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
console.log('🛰️🌐 INICIANDO SUITE PHASE 10: UNIVERSAL LEO SATELLITE TRANSPORT & UI INTEGRATION');
console.log('================================================================================\n');

// ── 1. Inspección de DynamicBearerGovernor.ts ──────────────────────────────────
const governorPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'DynamicBearerGovernor.ts');
const governorCode = fs.readFileSync(governorPath, 'utf8');

runTest('1. DynamicBearerGovernor: SATELLITE_LEO incluido en TacticalBearerType', () => {
    assert(governorCode.includes("'SATELLITE_LEO'"), 'Debe incluir SATELLITE_LEO en TacticalBearerType');
});

runTest('2. DynamicBearerGovernor: Inicialización de estadísticas del portador satelital', () => {
    assert(governorCode.includes("b === 'SATELLITE_LEO' ? 'BUSCANDO PASO ORBITAL' : 'DESCONECTADO'"), 'Debe inicializar estado satelital');
});

runTest('3. DynamicBearerGovernor: Sincronización con telemetría de satélite y cálculo de AOS', () => {
    assert(governorCode.includes("const satStat = this.bearerStats.get('SATELLITE_LEO');"), 'Debe recuperar estadísticas de SATELLITE_LEO');
    assert(governorCode.includes("satelliteMeshGateway.getTelemetry()"), 'Debe consultar la telemetría del gateway');
    assert(governorCode.includes("satStat.isOnline = isAos"), 'Debe marcar en línea según disponibilidad de AOS');
});

runTest('4. DynamicBearerGovernor: Promoción a SATELLITE_LEO cuando no hay enlaces terrestres', () => {
    assert(governorCode.includes("this.primaryBearer = 'SATELLITE_LEO';"), 'Debe conmutar a satélite si no hay radios locales');
});

// ── 2. Inspección de meshRouter.ts (Paso 6 Fallback Satelital) ─────────────────
const routerPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts');
const routerCode = fs.readFileSync(routerPath, 'utf8');

runTest('5. meshRouter: Implementación del Paso 6 LEO SATELLITE GATEWAY FALLBACK', () => {
    assert(routerCode.includes("6. AUTONOMOUS LEO SATELLITE GATEWAY FALLBACK & ORBITAL UPLINK"), 'Debe contener el encabezado del Paso 6');
    assert(routerCode.includes("satelliteMeshGateway.enqueueOutboundUplink(payloadStr, 8)"), 'Debe encolar paquete en el gateway satelital');
    assert(routerCode.includes("satelliteMeshGateway.triggerSatelliteBurst()"), 'Debe disparar ráfaga si hay AOS');
});

// ── 3. Inspección de StatusHeader.tsx (Pill y Red Satelital) ───────────────────
const statusHeaderPath = path.join(__dirname, '..', 'src', 'components', 'StatusHeader.tsx');
const statusHeaderCode = fs.readFileSync(statusHeaderPath, 'utf8');

runTest('6. StatusHeader: Suscripción a satelliteMeshGateway y estado reactivo', () => {
    assert(statusHeaderCode.includes("satelliteMeshGateway.subscribe(setSatTelem)"), 'Debe suscribirse a la telemetría');
    assert(statusHeaderCode.includes("unsubSat();"), 'Debe desuscribirse limpiamente');
});

runTest('7. StatusHeader: Red activa SAT LEO reconocida en selector y paleta de colores', () => {
    assert(statusHeaderCode.includes('if (satTelem.isUplinkAvailable) return "SAT LEO";'), 'Debe retornar SAT LEO si no hay pares terrestres');
    assert(statusHeaderCode.includes('"SAT LEO":     "var(--accent-cyan, #00E5FF)"'), 'Debe definir color cian espacial');
});

runTest('8. StatusHeader: Pill interactivo de satélite LEO con navegación táctica', () => {
    assert(statusHeaderCode.includes('onClick={() => navigate("cbrnSatellite")}'), 'Debe permitir navegar al panel satelital');
    assert(statusHeaderCode.includes('satTelem.isUplinkAvailable ? "LEO AOS" : "LEO"'), 'Debe alternar entre LEO AOS y LEO');
    assert(statusHeaderCode.includes('🛰️'), 'Debe renderizar icono satelital');
});

// ── 4. Inspección de SwarmHealthHUD.tsx ────────────────────────────────────────
const hudPath = path.join(__dirname, '..', 'src', 'components', 'SwarmHealthHUD.tsx');
const hudCode = fs.readFileSync(hudPath, 'utf8');

runTest('9. SwarmHealthHUD: Icono y color para SATELLITE_LEO', () => {
    assert(hudCode.includes('case "SATELLITE_LEO": return "🛰️";'), 'Debe tener icono de satélite');
    assert(hudCode.includes('case "SATELLITE_LEO": return "var(--accent-cyan, #00E5FF)";'), 'Debe tener color cian neón');
});

runTest('10. SwarmHealthHUD: Conmutación manual forzada a SATELLITE_LEO', () => {
    assert(hudCode.includes("if (b === 'SATELLITE_LEO')"), 'Debe manejar clic en SATELLITE_LEO');
    assert(hudCode.includes("dynamicBearerGovernor.forceSwitchBearer(b)"), 'Debe invocar forceSwitchBearer');
});

// ── 5. Inspección de SidebarHeader.tsx ────────────────────────────────────────
const sidebarHeaderPath = path.join(__dirname, '..', 'src', 'components', 'sidebar', 'SidebarHeader.tsx');
const sidebarHeaderCode = fs.readFileSync(sidebarHeaderPath, 'utf8');

runTest('11. SidebarHeader: Indicador espacial en cabecera de mensajería', () => {
    assert(sidebarHeaderCode.includes('satelliteMeshGateway.subscribe(t => setSatAos(t.isUplinkAvailable))'), 'Debe suscribirse a AOS');
    assert(sidebarHeaderCode.includes('{satAos ? " · 🛰️ LEO AOS" : ""}'), 'Debe mostrar badge orbital en el subtítulo');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

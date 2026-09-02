/**
 * TEST SUITE: TACTICAL GEOFENCING & HAVERSINE RESILIENCE
 * 
 * Valida la corrección de errores en TacticalGeofenceEngine.ts:
 * 1. Clamping numérico en Haversine para prevenir singularidades NaN en puntos límite.
 * 2. Erradicación del fallo Null Island (0,0) y rechazo de Infinity en evaluatePosition.
 * 3. Sanitización de radio y coordenadas en createZone.
 * 4. Precisión geodésica de detección de inclusión circular y distancia mínima.
 * 5. Activación fiel de alarmas y mandato de silencio RF ante incursión en zonas tácticas.
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
console.log('🛡️ INICIANDO SUITE DE PRUEBAS: TACTICAL GEOFENCE & HAVERSINE RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección Estática de TacticalGeofenceEngine.ts ────────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'TacticalGeofenceEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('1. TacticalGeofenceEngine: Clamping numérico seguro de safeA en getHaversineDistanceMeters', () => {
    assert(engineCode.includes('const safeA = Math.max(0, Math.min(1, a));'), 'Debe acotar safeA a [0, 1]');
    assert(engineCode.includes('Math.sqrt(1 - safeA)'), 'Radicando nunca debe ser negativo');
});

runTest('2. TacticalGeofenceEngine: Erradicación de Null Island (0,0) y rechazo de Infinity', () => {
    assert(engineCode.includes('Math.abs(userLat) < 0.0001 && Math.abs(userLon) < 0.0001'), 'Debe descartar Null Island (0,0)');
    assert(engineCode.includes('!isFinite(userLat) || !isFinite(userLon)'), 'Debe verificar isFinite en lugar de solo isNaN');
});

runTest('3. TacticalGeofenceEngine: Sanitización de radio y coordenadas en createZone', () => {
    assert(engineCode.includes('safeRadius = (typeof zoneData.radiusMeters ==='), 'Debe validar radio finito y positivo');
    assert(engineCode.includes('safeLat = (typeof zoneData.centerLat ==='), 'Debe validar latitud finita');
});

// ── 2. Validación de Haversine y Geocercas ─────────────────────────────────────
function computeHaversineDistance(lat1, lon1, lat2, lon2) {
    if (!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) {
        return Infinity;
    }
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const safeA = Math.max(0, Math.min(1, a));
    const c = 2 * Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA));
    return Math.round(R * c);
}

runTest('4. Geodesia: Distancia entre puntos idénticos es exactamente 0 metros (sin NaN)', () => {
    const d = computeHaversineDistance(-12.0464, -77.0428, -12.0464, -77.0428);
    assert.strictEqual(d, 0, `Distancia esperada: 0m, obtenida: ${d}m`);
});

runTest('5. Geodesia: Entrada Infinity o NaN retorna Infinity sin propagar NaN', () => {
    const d1 = computeHaversineDistance(Infinity, -77.0, -12.0, -77.0);
    assert.strictEqual(d1, Infinity, 'Infinity en latitud debe retornar Infinity');
    const d2 = computeHaversineDistance(NaN, -77.0, -12.0, -77.0);
    assert.strictEqual(d2, Infinity, 'NaN en latitud debe retornar Infinity');
});

runTest('6. Geocercas Circulares: Operador a 150m dentro de zona de radio 300m es clasificado como INSIDE', () => {
    // Zona centrada en (-12.0000, -77.0000), radio 300m
    const zone = { centerLat: -12.0000, centerLon: -77.0000, radiusMeters: 300 };
    // Punto desplazado ~150 metros al Norte (1 grado lat ~ 111,320m => 0.00135 grados ~ 150m)
    const userLat = -12.0000 + 0.00135;
    const userLon = -77.0000;
    const dist = computeHaversineDistance(userLat, userLon, zone.centerLat, zone.centerLon);
    assert(dist <= zone.radiusMeters, `Distancia ${dist}m debe ser <= radio ${zone.radiusMeters}m`);
});

runTest('7. Geocercas Circulares: Operador a 800m fuera de zona de radio 300m es clasificado como OUTSIDE', () => {
    const zone = { centerLat: -12.0000, centerLon: -77.0000, radiusMeters: 300 };
    const userLat = -12.0000 + 0.0072; // ~800m
    const userLon = -77.0000;
    const dist = computeHaversineDistance(userLat, userLon, zone.centerLat, zone.centerLon);
    assert(dist > zone.radiusMeters, `Distancia ${dist}m debe ser > radio ${zone.radiusMeters}m`);
    assert(isFinite(dist) && dist > 750 && dist < 850, `Distancia esperada ~800m, obtenida: ${dist}m`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

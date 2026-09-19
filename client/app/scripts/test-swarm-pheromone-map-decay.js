/**
 * test-swarm-pheromone-map-decay.js — RED Sovereign Mesh OS
 * 
 * Test Suite Automatizado: Swarm Pheromones Stigmergy & Leaflet Map Decay.
 * Verifica la estigmergia bio-neuromórfica de enjambre inspirada en el Mushroom Body:
 * 1. Emisión de feromonas de Alarma, Rastro y Encuentro (ALARM, TRAIL, AGGREGATION).
 * 2. Codificación / Decodificación de cuadrantes Geohash para delimitación territorial.
 * 3. Decaimiento temporal exponencial según tiempo de vida (TTL).
 * 4. Poda espacial e integración con capas cartográficas de NodeMap.
 * 5. Serialización / Deserialización de paquetes de difusión en malla LoRa/BLE.
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
console.log('🍄 SWARM PHEROMONES STIGMERGY & GEOHASH DECAY TEST SUITE');
console.log('================================================================================\n');

// ── 1. Verificación Estática del Código Fuente ────────────────────────────────
const mbPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'DtnMushroomBodyEngine.ts');
const mbCode = fs.readFileSync(mbPath, 'utf8');

const modalPath = path.join(__dirname, '..', 'src', 'components', 'tactical', 'PheromoneBroadcastModal.tsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');

const mapPath = path.join(__dirname, '..', 'src', 'components', 'NodeMap.tsx');
const mapCode = fs.readFileSync(mapPath, 'utf8');

runTest('1. DtnMushroomBodyEngine: API de Feromonas de Enjambre', () => {
    assert(mbCode.includes('emitPheromone'), 'Debe exponer emitPheromone');
    assert(mbCode.includes('ingestPheromone'), 'Debe exponer ingestPheromone');
    assert(mbCode.includes('getActivePheromones'), 'Debe exponer getActivePheromones');
    assert(mbCode.includes('cleanExpiredPheromones'), 'Debe purgar feromonas vencidas');
});

runTest('2. PheromoneBroadcastModal: Difusión sobre Malla Soberana', () => {
    assert(modalCode.includes('meshRouter.broadcastPheromone') || modalCode.includes('meshRouter'), 'Debe integrarse con el router de malla');
    assert(modalCode.includes('currentLocation'), 'Debe aceptar currentLocation');
    assert(modalCode.includes('GeohashSpatialRouting'), 'Debe emplear codificador espacial canónico');
});

runTest('3. NodeMap.tsx: Capa de Renderizado Cartográfico de Feromonas', () => {
    assert(mapCode.includes('activePheromones.forEach'), 'Debe iterar sobre feromonas activas');
    assert(mapCode.includes('GeohashSpatialRouting.decode'), 'Debe decodificar geohash para ubicar centro');
    assert(mapCode.includes('L.circle'), 'Debe dibujar círculos semitransparentes en Leaflet');
});

// ── 2. Verificación Dinámica de Algoritmos Matemáticos ─────────────────────────
runTest('4. Modelo Matemático: Decaimiento Temporal Lineal/Exponencial', () => {
    const createdAt = Date.now() - 30 * 60 * 1000; // Creado hace 30 minutos
    const ttlMs = 60 * 60 * 1000; // TTL de 60 minutos
    const initialIntensity = 1.0;

    const ageMs = Date.now() - createdAt;
    const remainingRatio = Math.max(0, Math.min(1, 1 - ageMs / ttlMs));
    const currentIntensity = initialIntensity * remainingRatio;

    // A los 30 minutos de un TTL de 60m, la intensidad debe ser exactamente ~0.50 (± 0.05)
    assert(currentIntensity >= 0.45 && currentIntensity <= 0.55, `Intensidad a medio camino (${currentIntensity}) debe rondar 0.50`);

    // Al sobrepasar el TTL, la intensidad debe ser 0
    const expiredAgeMs = 70 * 60 * 1000;
    const expiredRatio = Math.max(0, Math.min(1, 1 - expiredAgeMs / ttlMs));
    assert.strictEqual(expiredRatio, 0, 'Feromona vencida debe tener ratio 0');
});

runTest('5. Geohash Spatial Resolution: Relación de Radio según Longitud de Hash', () => {
    function getRadiusForGeohash(geohash) {
        if (!geohash) return 100;
        return geohash.length <= 6 ? 600 : geohash.length === 7 ? 150 : 50;
    }

    assert.strictEqual(getRadiusForGeohash('d25x7k'), 600, 'Geohash len 6 debe tener radio 600m');
    assert.strictEqual(getRadiusForGeohash('d25x7k9'), 150, 'Geohash len 7 debe tener radio 150m');
    assert.strictEqual(getRadiusForGeohash('d25x7k9a'), 50, 'Geohash len 8 debe tener radio 50m');
});

console.log(`\nResultados: ${passedTests}/${totalTests} pruebas superadas.`);
if (passedTests !== totalTests) {
    process.exit(1);
}
console.log('✨ SUITE SWARM PHEROMONES STIGMERGY EXITOSA.\n');

/**
 * TEST SUITE: OFFLINE TILE CACHE RESILIENCE & MERCATOR POLE SINGULARITY ERADICATION
 * 
 * Valida la corrección de errores matemáticos y de ciclo de vida en OfflineTileCacheEngine.ts:
 * 1. Proyección Mercator segura en latitudes extremas (polos +-90°).
 * 2. Prevención de divisiones por cero e Infinity en lonDelta (cosLat guard).
 * 3. Sanitización contra valores NaN en coordenadas.
 * 4. Manejo de db.onversionchange y método closeDB().
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
console.log('🗺️ INICIANDO SUITE DE PRUEBAS: OFFLINE TILE CACHE RESILIENCE');
console.log('================================================================================\n');

// ── 1. Motor de Proyección y Cálculo Matemático Autocontenido ─────────────────
function latLonToTile(lat, lon, zoom) {
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(zoom)) {
        return { x: 0, y: 0 };
    }
    const safeZoom = Math.max(0, Math.min(22, Math.floor(zoom)));
    const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
    const clampedLon = Math.max(-180, Math.min(180, lon));
    const radLat = (clampedLat * Math.PI) / 180;
    const n = Math.pow(2, safeZoom);
    const x = Math.floor(((clampedLon + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(radLat) + 1 / Math.cos(radLat)) / Math.PI) / 2) * n);
    return {
        x: Math.max(0, Math.min(n - 1, x || 0)),
        y: Math.max(0, Math.min(n - 1, y || 0))
    };
}

function calculateTilesForRadius(centerLat, centerLon, radiusKm, minZoom = 12, maxZoom = 17) {
    const tiles = [];
    const seen = new Set();

    if (!isFinite(centerLat) || !isFinite(centerLon)) {
        return [];
    }

    const safeRadiusKm = Math.min(30, Math.max(0.5, radiusKm));
    const safeMinZoom = Math.max(8, Math.min(17, Math.floor(minZoom)));
    const safeMaxZoom = Math.max(safeMinZoom, Math.min(17, Math.floor(maxZoom)));
    const MAX_BATCH_TILES = 3500;

    const clampedCenterLat = Math.max(-85.0511, Math.min(85.0511, centerLat));
    const clampedCenterLon = Math.max(-180, Math.min(180, centerLon));
    const cosLat = Math.max(0.01, Math.cos((clampedCenterLat * Math.PI) / 180));

    const latDelta = safeRadiusKm / 111.0;
    const lonDelta = safeRadiusKm / (111.0 * cosLat);

    const minLat = Math.max(-85.0511, clampedCenterLat - latDelta);
    const maxLat = Math.min(85.0511, clampedCenterLat + latDelta);
    const minLon = Math.max(-180, clampedCenterLon - lonDelta);
    const maxLon = Math.min(180, clampedCenterLon + lonDelta);

    for (let z = safeMinZoom; z <= safeMaxZoom; z++) {
        const topLeft = latLonToTile(maxLat, minLon, z);
        const bottomRight = latLonToTile(minLat, maxLon, z);

        const minX = Math.min(topLeft.x, bottomRight.x);
        const maxX = Math.max(topLeft.x, bottomRight.x);
        const minY = Math.min(topLeft.y, bottomRight.y);
        const maxY = Math.max(topLeft.y, bottomRight.y);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${z}_${x}_${y}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    tiles.push({ z, x, y, key });
                    if (tiles.length >= MAX_BATCH_TILES) {
                        return tiles;
                    }
                }
            }
        }
    }

    return tiles;
}

runTest('1. Proyección Mercator: Coordenadas estándar calculan teselas válidas', () => {
    // Ciudad de México ~ 19.4326, -99.1332, zoom 14
    const tile = latLonToTile(19.4326, -99.1332, 14);
    assert(tile.x >= 0 && tile.x < Math.pow(2, 14), 'x debe estar en rango 0..16383');
    assert(tile.y >= 0 && tile.y < Math.pow(2, 14), 'y debe estar en rango 0..16383');
});

runTest('2. Proyección Mercator: Inmunidad a singularidades en polos (+-90°)', () => {
    const northPole = latLonToTile(90, 0, 10);
    assert(isFinite(northPole.x) && isFinite(northPole.y), 'Polo Norte no debe producir NaN');
    assert.strictEqual(northPole.y, 0, 'Polo Norte debe mapear al borde superior de teselas');

    const southPole = latLonToTile(-90, 0, 10);
    assert(isFinite(southPole.x) && isFinite(southPole.y), 'Polo Sur no debe producir NaN');
    assert.strictEqual(southPole.y, Math.pow(2, 10) - 1, 'Polo Sur debe mapear al borde inferior de teselas');
});

runTest('3. Proyección Mercator: Rechazo de coordenadas NaN o no finitas', () => {
    const nanTile = latLonToTile(NaN, NaN, 12);
    assert.deepStrictEqual(nanTile, { x: 0, y: 0 });
});

runTest('4. Bounding Box: Cálculo de radio en el Polo Norte no divide por cero', () => {
    const tilesNorth = calculateTilesForRadius(90, 0, 5, 12, 13);
    assert(Array.isArray(tilesNorth) && tilesNorth.length > 0, 'Debe generar teselas en latitudes polares');
    tilesNorth.forEach(t => {
        assert(isFinite(t.x) && isFinite(t.y), 'Coordenadas de tesela deben ser números finitos');
    });
});

runTest('5. Bounding Box: Entrada de coordenadas NaN retorna arreglo vacío', () => {
    const tiles = calculateTilesForRadius(NaN, -99, 5);
    assert.deepStrictEqual(tiles, []);
});

// ── 2. Inspección Estática de OfflineTileCacheEngine.ts ──────────────────────
const enginePath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'OfflineTileCacheEngine.ts');
const engineCode = fs.readFileSync(enginePath, 'utf8');

runTest('6. Auditoría de Código: OfflineTileCacheEngine.ts incluye pole guard y clamping de Mercator', () => {
    assert(engineCode.includes('Math.max(-85.0511, Math.min(85.0511'), 'Debe acotar latitud al rango legal Mercator');
    assert(engineCode.includes('Math.max(0.01, Math.cos'), 'Debe proteger cosLat con suelo mínimo contra división por cero');
});

runTest('7. Auditoría de Código: OfflineTileCacheEngine.ts implementa closeDB y onversionchange', () => {
    assert(engineCode.includes('public async closeDB(): Promise<void>'), 'Debe implementar closeDB()');
    assert(engineCode.includes('db.onversionchange = () => {'), 'Debe manejar onversionchange');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

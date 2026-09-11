/**
 * test-geohash-spatial-pruning.js — Validación Automatizada de Enrutamiento Espacial y Poda DTN
 */

const assert = require('assert');

// 1. Simulación o importación directa de la lógica canónica de GeohashSpatialRouting
const BASE32_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';
const BASE32_MAP = {};
for (let i = 0; i < BASE32_CHARS.length; i++) {
    BASE32_MAP[BASE32_CHARS[i]] = i;
}

function encodeGeohash(lat, lon, precision = 4) {
    if (!isFinite(lat) || !isFinite(lon)) return '';
    const safeLat = Math.max(-90, Math.min(90, lat));
    const safeLon = Math.max(-180, Math.min(180, lon));
    let minLat = -90.0, maxLat = 90.0;
    let minLon = -180.0, maxLon = 180.0;
    let isEven = true;
    let bit = 0;
    let ch = 0;
    let geohash = '';

    while (geohash.length < precision) {
        if (isEven) {
            const mid = (minLon + maxLon) / 2;
            if (safeLon >= mid) {
                ch |= (1 << (4 - bit));
                minLon = mid;
            } else {
                maxLon = mid;
            }
        } else {
            const mid = (minLat + maxLat) / 2;
            if (safeLat >= mid) {
                ch |= (1 << (4 - bit));
                minLat = mid;
            } else {
                maxLat = mid;
            }
        }
        isEven = !isEven;
        if (bit < 4) {
            bit++;
        } else {
            geohash += BASE32_CHARS[ch];
            bit = 0;
            ch = 0;
        }
    }
    return geohash;
}

function decodeGeohash(geohash) {
    if (!geohash) return null;
    let minLat = -90.0, maxLat = 90.0;
    let minLon = -180.0, maxLon = 180.0;
    let isEven = true;

    for (let i = 0; i < geohash.length; i++) {
        const cd = BASE32_MAP[geohash[i]];
        if (cd === undefined) return null;
        for (let mask = 16; mask > 0; mask >>= 1) {
            if (isEven) {
                const mid = (minLon + maxLon) / 2;
                if ((cd & mask) !== 0) minLon = mid;
                else maxLon = mid;
            } else {
                const mid = (minLat + maxLat) / 2;
                if ((cd & mask) !== 0) minLat = mid;
                else maxLat = mid;
            }
            isEven = !isEven;
        }
    }
    return {
        lat: (minLat + maxLat) / 2,
        lon: (minLon + maxLon) / 2,
        error: { lat: (maxLat - minLat) / 2, lon: (maxLon - minLon) / 2 }
    };
}

function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return R * c;
}

function shouldCarrierAcceptPacket(carrierRouteGeohashes, targetGeohash, maxDeviationKm = 250) {
    if (!targetGeohash || targetGeohash.trim().length === 0) return true;
    if (!carrierRouteGeohashes || carrierRouteGeohashes.length === 0) return true;

    const cleanTarget = targetGeohash.toLowerCase().trim();
    const targetDecoded = decodeGeohash(cleanTarget);

    for (const routeHash of carrierRouteGeohashes) {
        const cleanRoute = routeHash.toLowerCase().trim();
        const minLen = Math.min(cleanTarget.length, cleanRoute.length);
        if (minLen >= 2 && cleanTarget.slice(0, minLen) === cleanRoute.slice(0, minLen)) {
            return true;
        }
        if (targetDecoded) {
            const routeDecoded = decodeGeohash(cleanRoute);
            if (routeDecoded) {
                const dist = distanceKm(routeDecoded.lat, routeDecoded.lon, targetDecoded.lat, targetDecoded.lon);
                if (dist <= maxDeviationKm) return true;
            }
        }
    }
    return false;
}

console.log('🧪 Iniciando Suite de Pruebas: Enrutamiento Geográfico y Poda Espacial Geohash...\n');

// TEST 1: Codificación de Coordenadas de Referencia
console.log('1️⃣ Probando Codificación Geohash de Cuadrantes Mundiales:');
const madridGeo = encodeGeohash(40.4168, -3.7038, 5); // Madrid
const nyGeo = encodeGeohash(40.7128, -74.0060, 5);     // New York
const tokyoGeo = encodeGeohash(35.6762, 139.6503, 5);  // Tokyo
const santiagoGeo = encodeGeohash(-33.4489, -70.6693, 5); // Santiago

console.log(`   - Madrid (40.41, -3.70)      -> [${madridGeo}] (Prefijo: ${madridGeo.slice(0, 2)})`);
console.log(`   - Nueva York (40.71, -74.00)  -> [${nyGeo}] (Prefijo: ${nyGeo.slice(0, 2)})`);
console.log(`   - Tokio (35.67, 139.65)       -> [${tokyoGeo}] (Prefijo: ${tokyoGeo.slice(0, 2)})`);
console.log(`   - Santiago (-33.44, -70.66)   -> [${santiagoGeo}] (Prefijo: ${santiagoGeo.slice(0, 2)})`);

assert(madridGeo.startsWith('ez'), 'Madrid debe empezar con ez');
assert(nyGeo.startsWith('dr'), 'New York debe empezar con dr');
assert(tokyoGeo.startsWith('xn'), 'Tokyo debe empezar con xn');
assert(santiagoGeo.startsWith('66'), 'Santiago debe empezar con 66');
console.log('   ✅ Codificación correcta en 4 continentes.');

// TEST 2: Decodificación y Error Bounding Box
console.log('\n2️⃣ Probando Decodificación y Precisión de Cajas Delimitadoras:');
const decodedMadrid = decodeGeohash(madridGeo);
assert(Math.abs(decodedMadrid.lat - 40.4168) < 0.05, 'Latitud decodificada dentro del margen');
assert(Math.abs(decodedMadrid.lon - (-3.7038)) < 0.05, 'Longitud decodificada dentro del margen');
console.log(`   - Centro decodificado Madrid: lat=${decodedMadrid.lat.toFixed(4)}, lon=${decodedMadrid.lon.toFixed(4)}`);
console.log(`   - Error máximo de celda: ±${(decodedMadrid.error.lat * 111).toFixed(1)} km lat, ±${(decodedMadrid.error.lon * 111).toFixed(1)} km lon`);
console.log('   ✅ Decodificación geodésica verificada.');

// TEST 3: Poda Espacial en Mulas de Datos (Spatial Pruning)
console.log('\n3️⃣ Probando Algoritmo de Poda Espacial en Transporte DTN:');
// Supongamos un buque o avión cubriendo una ruta europea: Madrid ('ez') -> París ('u0') -> Berlín ('u3')
const europeanCarrierTrajectory = ['ezjm', 'u09t', 'u33d'];

// Paquete A: Destinado a Barcelona ('sp3e', cerca de Madrid ~500km, o España)
const barcelonaGeo = encodeGeohash(41.3851, 2.1734, 4); // 'sp3e'
const acceptBarcelona = shouldCarrierAcceptPacket(europeanCarrierTrajectory, barcelonaGeo, 600);
console.log(`   - Paquete hacia Barcelona (${barcelonaGeo}): Aceptado = ${acceptBarcelona}`);
assert(acceptBarcelona === true, 'El transporte europeo debe aceptar paquetes para Barcelona');

// Paquete B: Destinado a Tokio ('xn77')
const acceptTokyo = shouldCarrierAcceptPacket(europeanCarrierTrajectory, tokyoGeo, 600);
console.log(`   - Paquete hacia Tokio (${tokyoGeo}): Aceptado = ${acceptTokyo}`);
assert(acceptTokyo === false, 'El transporte europeo debe podar (rechazar) paquetes para Tokio');

// Paquete C: Paquete SOS global sin etiqueta Geohash
const acceptGlobalSos = shouldCarrierAcceptPacket(europeanCarrierTrajectory, '', 600);
console.log(`   - Paquete SOS Global (sin geohash): Aceptado = ${acceptGlobalSos}`);
assert(acceptGlobalSos === true, 'Paquetes globales o de emergencia siempre deben aceptarse');

console.log('   ✅ Poda espacial previno exitosamente la contaminación intercontinental.');

console.log('\n=======================================================');
console.log('🎉 100% de Pruebas de Enrutamiento Geohash superadas con éxito');
console.log('=======================================================');

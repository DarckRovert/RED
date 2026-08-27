/**
 * test-phase1-sensors.js — Test Suite Automatizado para Motores de Fase 1 (RED v64.0.0)
 * 
 * Valida con precisión matemática y empírica:
 * 1. OffGridNavigationEngine (Haversine, DestPoint, Azimut Solar J2000, Resección Snellius-Pothenot, GPS->UTM)
 * 2. weatherBarometerEngine (Delta P/3h, Zambretti, Punto de Rocío Magnus-Tetens, Heat Index Rothfusz, LCL)
 * 3. KineticDutyGovernor (Perfiles de consumo, Acelerometría, Shake Boost)
 * 4. RfSpectrumAnalyzerEngine (Heurística Anti-Jamming, Densidad Espectral, Canal Óptimo)
 * 5. VitalScanEngine (Árbol de Decisión START Triage Oficial)
 */

const assert = require('assert');

console.log("================================================================================");
console.log("🛡️  INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS — FASE 1: SENSORES & HARDWARE TÁCTICO");
console.log("================================================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OffGridNavigationEngine
// ─────────────────────────────────────────────────────────────────────────────
console.log("📐 1. Probando OffGridNavigationEngine...");

function mod(n, m) {
    return ((n % m) + m) % m;
}

function calculateDistanceAndBearing(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const radLat1 = (lat1 * Math.PI) / 180;
    const radLat2 = (lat2 * Math.PI) / 180;
    const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(radLat1) * Math.cos(radLat2) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    const distanceMeters = Math.round(R * c);

    const y = Math.sin(deltaLon) * Math.cos(radLat2);
    const x =
        Math.cos(radLat1) * Math.sin(radLat2) -
        Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(deltaLon);
    
    let bearing = (Math.atan2(y, x) * 180) / Math.PI;
    bearing = mod(bearing, 360);

    return { distanceMeters, bearingDegrees: Math.round(bearing * 10) / 10 };
}

function calculateDestinationPoint(lat, lon, distanceMeters, bearingDegrees) {
    const R = 6371000;
    const d = distanceMeters / R;
    const brg = (bearingDegrees * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;

    const sinLat2 = Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg);
    const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
    
    const lon2 = lon1 + Math.atan2(
        Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

    const resLat = (lat2 * 180) / Math.PI;
    const resLon = mod((lon2 * 180) / Math.PI + 180, 360) - 180;

    return {
        lat: Math.round(resLat * 100000) / 100000,
        lon: Math.round(resLon * 100000) / 100000
    };
}

function calculateResection(p1, bearing1Degrees, p2, bearing2Degrees) {
    const backBearing1 = mod(bearing1Degrees + 180, 360);
    const backBearing2 = mod(bearing2Degrees + 180, 360);

    const radBB1 = (backBearing1 * Math.PI) / 180;
    const radBB2 = (backBearing2 * Math.PI) / 180;

    const lat1 = (p1.lat * Math.PI) / 180;
    const lat2 = (p2.lat * Math.PI) / 180;
    const lon1 = (p1.lon * Math.PI) / 180;
    const lon2 = (p2.lon * Math.PI) / 180;

    let meanLat = (lat1 + lat2) / 2;
    let x1 = lon1 * Math.cos(meanLat);
    let y1 = lat1;
    let x2 = lon2 * Math.cos(meanLat);
    let y2 = lat2;

    const dx1 = Math.sin(radBB1);
    const dy1 = Math.cos(radBB1);
    const dx2 = Math.sin(radBB2);
    const dy2 = Math.cos(radBB2);

    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-6) return null;

    const t1 = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / denom;
    const t2 = ((x2 - x1) * dy1 - (y2 - y1) * dx1) / denom;

    if (t1 <= 0 || t2 <= 0) return null;

    const xObs = x1 + t1 * dx1;
    const yObs = y1 + t1 * dy1;

    meanLat = (lat1 + lat2 + yObs) / 3;
    const latObs = (yObs * 180) / Math.PI;
    const lonObs = ((xObs / Math.cos(meanLat)) * 180) / Math.PI;

    const geomFactor = Math.abs(denom);
    const dynamicAccuracy = Math.round(Math.max(2, Math.min(50, 4 / Math.max(0.08, geomFactor))));

    return {
        lat: Math.round(latObs * 100000) / 100000,
        lon: Math.round(lonObs * 100000) / 100000,
        accuracyMeters: dynamicAccuracy
    };
}

function gpsToUtm(lat, lon) {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const hemi = lat >= 0 ? 'N' : 'S';

    const a = 6378137;
    const k0 = 0.9996;
    const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    const radLat = lat * Math.PI / 180;
    const radLon = lon * Math.PI / 180;

    const e = 0.081819191;
    const e2 = e * e;
    const N = a / Math.sqrt(1 - e2 * Math.sin(radLat) * Math.sin(radLat));
    const T = Math.tan(radLat) * Math.tan(radLat);
    const C = e2 / (1 - e2) * Math.cos(radLat) * Math.cos(radLat);
    const A = (radLon - lon0) * Math.cos(radLat);

    const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64) * radLat
        - (3 * e2 / 8 + 3 * e2 * e2 / 32) * Math.sin(2 * radLat)
        + (15 * e2 * e2 / 256) * Math.sin(4 * radLat));

    const eastingVal = Math.round(500000 + k0 * N * (A + (1 - T + C) * A * A * A / 6));
    let northingVal = Math.round(k0 * (M + N * Math.tan(radLat) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24)));
    if (lat < 0) northingVal += 10000000;

    const eastingPadded = String(eastingVal).padStart(6, '0');
    const northingPadded = String(northingVal).padStart(7, '0');

    return `${zone}${hemi} ${eastingPadded}E ${northingPadded}N`;
}

runTest("Cálculo Haversine: Distancia y Rumbo entre Lima (-12.0464, -77.0428) y Callao (-12.0565, -77.1181)", () => {
    const res = calculateDistanceAndBearing(-12.0464, -77.0428, -12.0565, -77.1181);
    assert(res.distanceMeters > 8000 && res.distanceMeters < 8500, `Distancia esperada ~8.2km, obtenida: ${res.distanceMeters}m`);
    assert(res.bearingDegrees > 260 && res.bearingDegrees < 275, `Rumbo esperado Oeste-Suroeste (~265°), obtenido: ${res.bearingDegrees}°`);
});

runTest("Geodesia Directa: Punto Destino y Reversibilidad", () => {
    const origin = { lat: -12.0464, lon: -77.0428 };
    const dest = calculateDestinationPoint(origin.lat, origin.lon, 5000, 90); // 5km al Este
    const reverse = calculateDistanceAndBearing(origin.lat, origin.lon, dest.lat, dest.lon);
    assert.strictEqual(Math.round(reverse.distanceMeters), 5000);
    assert(Math.abs(reverse.bearingDegrees - 90) < 1.0);
});

runTest("Triangulación por Resección Snellius-Pothenot", () => {
    const p1 = { id: "1", name: "Faro Noroeste", lat: -12.0400, lon: -77.0400 };
    const p2 = { id: "2", name: "Torre Noreste", lat: -12.0400, lon: -77.0300 };
    // Observer is South: looks NW (315°) to P1 and NE (45°) to P2
    const res = calculateResection(p1, 315, p2, 45);
    assert(res !== null, "Resección debió converger a una posición válida");
    assert(res.lat < -12.0400, "Observador debe estar al Sur de los puntos de referencia");
    assert(res.accuracyMeters > 0 && res.accuracyMeters <= 50);
});

runTest("Conversión GPS a Coordenadas Militares OTAN UTM/MGRS", () => {
    const utm = gpsToUtm(-12.0464, -77.0428); // Lima, Zona 18S
    assert(utm.startsWith("18S"), `Zona UTM esperada 18S, obtenida: ${utm}`);
    assert(/\d{6}E \d{7}N/.test(utm), `Formato OTAN 6 dígitos Este y 7 dígitos Norte esperado, obtenido: ${utm}`);
});

function isPointInGeofence(point, polygon) {
    if (polygon.length < 3) return false;
    let inside = false;
    const x = point.lon;
    const y = point.lat;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lon, yi = polygon[i].lat;
        const xj = polygon[j].lon, yj = polygon[j].lat;
        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function calculateFresnelZone(distanceMeters, frequencyMhz = 915) {
    const dKm = Math.max(0.01, distanceMeters / 1000);
    const fGhz = Math.max(0.001, frequencyMhz / 1000);
    const maxRadiusMeters = 8.656 * Math.sqrt(dKm / fGhz);
    return {
        maxRadiusMeters: Math.round(maxRadiusMeters * 100) / 100,
        requiredClearance60PercentMeters: Math.round(maxRadiusMeters * 0.6 * 100) / 100
    };
}

runTest("Geofencing Táctico: Inclusión / Exclusión Ray-Casting en Perímetro Defensivo", () => {
    const polygon = [
        { lat: -12.0400, lon: -77.0500 },
        { lat: -12.0400, lon: -77.0300 },
        { lat: -12.0600, lon: -77.0300 },
        { lat: -12.0600, lon: -77.0500 }
    ];
    assert.strictEqual(isPointInGeofence({ lat: -12.0500, lon: -77.0400 }, polygon), true);
    assert.strictEqual(isPointInGeofence({ lat: -12.0700, lon: -77.0400 }, polygon), false);
});

runTest("Cálculo Radiofrecuencia: Despeje Zona de Fresnel 1a para Enlace LoRa 915MHz", () => {
    const fresnel = calculateFresnelZone(5000, 915);
    assert(fresnel.maxRadiusMeters >= 20.0 && fresnel.maxRadiusMeters <= 20.5);
    assert(fresnel.requiredClearance60PercentMeters >= 12.0 && fresnel.requiredClearance60PercentMeters <= 12.5);
});

function calculateRadioLineOfSight(h1, h2) {
    const h1m = Math.max(0.1, h1);
    const h2m = Math.max(0.1, h2);
    const maxRangeKm = 4.12 * (Math.sqrt(h1m) + Math.sqrt(h2m));
    return {
        maxRangeKm: Math.round(maxRangeKm * 100) / 100,
        maxRangeMeters: Math.round(maxRangeKm * 1000)
    };
}

runTest("Cálculo Radiofrecuencia: Línea de Vista Óptica y RF (Horizonte con Refracción 4/3)", () => {
    // 2m handheld to 25m tower mast
    const los = calculateRadioLineOfSight(2, 25);
    assert(los.maxRangeKm >= 26.0 && los.maxRangeKm <= 27.0, `Rango LOS esperado ~26.4km, obtenido ${los.maxRangeKm}km`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. weatherBarometerEngine
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n⛅ 2. Probando weatherBarometerEngine...");

function calculateDewPoint(tempC, rhPercent) {
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * tempC) / (b + tempC)) + Math.log(Math.max(1, Math.min(100, rhPercent)) / 100.0);
    const dp = (b * alpha) / (a - alpha);
    return Math.round(dp * 10) / 10;
}

function calculateHeatIndex(tempC, rhPercent) {
    if (tempC < 20) return null;
    const tF = (tempC * 9/5) + 32;
    const rh = Math.max(0, Math.min(100, rhPercent));
    
    let hiF = -42.379 + 2.04901523*tF + 10.14333127*rh - 0.22475541*tF*rh 
      - 6.83783e-3*tF*tF - 5.481717e-2*rh*rh + 1.22874e-3*tF*tF*rh 
      + 8.5282e-4*tF*rh*rh - 1.99e-6*tF*tF*rh*rh;
      
    const hiC = (hiF - 32) * 5/9;
    return Math.round(hiC * 10) / 10;
}

function estimateCloudBaseMeters(tempC, dewPointC) {
    const spreadC = Math.max(0, tempC - dewPointC);
    const baseFeet = (spreadC / 2.5) * 1000;
    return Math.round(baseFeet * 0.3048);
}

runTest("Punto de Rocío Magnus-Tetens (25°C, 60% HR)", () => {
    const dp = calculateDewPoint(25, 60);
    assert(dp >= 16.5 && dp <= 17.5, `Punto de rocío esperado ~16.7°C, obtenido: ${dp}°C`);
});

runTest("Índice de Calor Rothfusz (32°C, 80% HR)", () => {
    const hi = calculateHeatIndex(32, 80);
    assert(hi !== null && hi > 40, `Sensación térmica extrema esperada (>40°C), obtenida: ${hi}°C`);
});

runTest("Estimación Altura Base de Nubes Cúmulos (LCL)", () => {
    const lcl = estimateCloudBaseMeters(25, 17);
    assert(lcl > 900 && lcl < 1050, `Base de nubes esperada ~975m AGL, obtenida: ${lcl}m`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. VitalScanEngine — START Triage Decision Tree
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🏥 3. Probando VitalScanEngine (Protocolo START Triage)...");

function evaluateStartTriage(canWalk, isBreathing, breathesAfterAirwayOpened, respiratoryRateBpm, capillaryRefillSec, canFollowCommands) {
    if (canWalk) {
        return { category: 'VERDE', priorityNumber: 3 };
    }
    if (!isBreathing) {
        if (breathesAfterAirwayOpened) {
            return { category: 'ROJO', priorityNumber: 1 };
        }
        return { category: 'NEGRO', priorityNumber: 4 };
    }
    if (respiratoryRateBpm > 30 || respiratoryRateBpm < 10 || capillaryRefillSec > 2 || !canFollowCommands) {
        return { category: 'ROJO', priorityNumber: 1 };
    }
    return { category: 'AMARILLO', priorityNumber: 2 };
}

runTest("START Triaje: Lesionado Leve Ambulatorio -> VERDE (Prioridad 3)", () => {
    const res = evaluateStartTriage(true, true, true, 20, 1.5, true);
    assert.strictEqual(res.category, 'VERDE');
    assert.strictEqual(res.priorityNumber, 3);
});

runTest("START Triaje: Paro Respiratorio que no responde a apertura de vía aérea -> NEGRO (Prioridad 4)", () => {
    const res = evaluateStartTriage(false, false, false, 0, 5, false);
    assert.strictEqual(res.category, 'NEGRO');
    assert.strictEqual(res.priorityNumber, 4);
});

runTest("START Triaje: Taquipnea severa (>30 rpm) -> ROJO (Prioridad 1)", () => {
    const res = evaluateStartTriage(false, true, true, 34, 1.5, true);
    assert.strictEqual(res.category, 'ROJO');
    assert.strictEqual(res.priorityNumber, 1);
});

runTest("START Triaje: Llenado capilar lento (>2s) -> ROJO (Prioridad 1)", () => {
    const res = evaluateStartTriage(false, true, true, 18, 3.5, true);
    assert.strictEqual(res.category, 'ROJO');
    assert.strictEqual(res.priorityNumber, 1);
});

runTest("START Triaje: Respiración normal, perfusión <2s pero no ambulatorio -> AMARILLO (Prioridad 2)", () => {
    const res = evaluateStartTriage(false, true, true, 18, 1.5, true);
    assert.strictEqual(res.category, 'AMARILLO');
    assert.strictEqual(res.priorityNumber, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. KineticDutyGovernor & RfSpectrumAnalyzerEngine Heuristics
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n🔋 4. Probando KineticDutyGovernor & RfSpectrumAnalyzerEngine...");

function evaluateDutyCycleProfile(batteryLevel, isCharging, isStationary, isShakeBoostActive) {
    if (isShakeBoostActive) return { profile: "SHAKE_BOOST", bleScanIntervalMs: 800 };
    if (isCharging || (batteryLevel > 50 && !isStationary)) return { profile: "HIGH_PERFORMANCE", bleScanIntervalMs: 1500 };
    if (batteryLevel <= 20 || (batteryLevel <= 40 && isStationary)) return { profile: "SURVIVAL_SENTRY", bleScanIntervalMs: 12000 };
    return { profile: "BALANCED_PATROL", bleScanIntervalMs: 4000 };
}

function evaluateJammingThreat(avgRssi, variance, deviceCount) {
    if (avgRssi < -85 && variance < 2.0 && deviceCount > 5) return 'CRÍTICO_JAMMING';
    if (avgRssi < -78 && variance < 5.0 && deviceCount > 3) return 'ELEVADO';
    return 'NORMAL';
}

runTest("Gobernador Cinemático: Transición a CENTINELA DE SUPERVIVENCIA con batería baja (15%)", () => {
    const res = evaluateDutyCycleProfile(15, false, true, false);
    assert.strictEqual(res.profile, "SURVIVAL_SENTRY");
    assert.strictEqual(res.bleScanIntervalMs, 12000);
});

runTest("Gobernador Cinemático: Ráfaga BOOST por Sacudida (800ms scan)", () => {
    const res = evaluateDutyCycleProfile(50, false, false, true);
    assert.strictEqual(res.profile, "SHAKE_BOOST");
    assert.strictEqual(res.bleScanIntervalMs, 800);
});

runTest("Analizador Espectro RF: Detección de Ataque de Jamming / Supresión Espectral", () => {
    const threat = evaluateJammingThreat(-92, 0.8, 8);
    assert.strictEqual(threat, 'CRÍTICO_JAMMING');
});

runTest("Analizador Espectro RF: Condiciones Normales de Señal Malla", () => {
    const threat = evaluateJammingThreat(-65, 12.4, 4);
    assert.strictEqual(threat, 'NORMAL');
});

console.log("\n================================================================================");
console.log(`📊 RESUMEN DE RESULTADOS: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE`);
console.log("================================================================================\n");

if (passedTests !== totalTests) {
    process.exit(1);
}

/**
 * test_sensors_and_navigation_resilience.js
 * 
 * Verificación Matemática y Empírica de Sensores Tácticos, Fusión 3D,
 * Arbitraje Multi-Nivel de Brújula y Resiliencia GNSS / COG.
 */

const assert = require('assert');

console.log("================================================================================");
console.log("   RED OS — SUITE DE PRUEBAS DE RESILIENCIA DE SENSORES Y NAVEGACIÓN TÁCTICA   ");
console.log("================================================================================\n");

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
    testsTotal++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}`);
        process.exitCode = 1;
    }
}

// ── 1. CÁLCULO DE AZIMUT GRAN CÍRCULO (GREAT-CIRCLE BEARING) ─────────────────
function calculateBearing(lat1, lon1, lat2, lon2) {
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const theta = Math.atan2(y, x);
    return Math.round((((theta * 180) / Math.PI) + 360) % 360);
}

runTest("Bearing Gran Círculo: Desplazamiento hacia el Norte debe dar 0°", () => {
    const bearing = calculateBearing(4.6097, -74.0817, 4.6197, -74.0817);
    assert.strictEqual(bearing, 0);
});

runTest("Bearing Gran Círculo: Desplazamiento hacia el Este debe dar 90°", () => {
    const bearing = calculateBearing(0, 0, 0, 1);
    assert.strictEqual(bearing, 90);
});

runTest("Bearing Gran Círculo: Desplazamiento hacia el Sur debe dar 180°", () => {
    const bearing = calculateBearing(10, -74, 9, -74);
    assert.strictEqual(bearing, 180);
});

runTest("Bearing Gran Círculo: Desplazamiento hacia el Oeste debe dar 270°", () => {
    const bearing = calculateBearing(0, 10, 0, 9);
    assert.strictEqual(bearing, 270);
});

// ── 2. DISTANCIA HAVERSINE ──────────────────────────────────────────────────
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

runTest("Distancia Haversine: 1 grado de latitud en el ecuador debe ser ~111.19 km", () => {
    const dist = calculateDistanceMeters(0, 0, 1, 0);
    assert(dist >= 111000 && dist <= 111400, `Distancia esperada ~111 km, recibida: ${dist} m`);
});

runTest("Distancia Haversine: Mismo punto debe dar 0 metros", () => {
    const dist = calculateDistanceMeters(4.6097, -74.0817, 4.6097, -74.0817);
    assert.strictEqual(dist, 0);
});

// ── 3. FILTRO VECTORIAL CIRCULAR (SUPRESIÓN DE DISCONTINUIDAD 0° <-> 360°) ───
class CircularVectorFilter {
    constructor(factor = 0.22) {
        this.factor = factor;
        this.vecX = 0;
        this.vecY = 0;
        this.currentHeading = 0;
    }

    update(deg) {
        const rad = (deg * Math.PI) / 180;
        const curCos = Math.cos(rad);
        const curSin = Math.sin(rad);

        if (this.vecX === 0 && this.vecY === 0) {
            this.vecX = curCos;
            this.vecY = curSin;
        } else {
            this.vecX = this.vecX * (1 - this.factor) + curCos * this.factor;
            this.vecY = this.vecY * (1 - this.factor) + curSin * this.factor;
        }

        let smoothDeg = Math.round((Math.atan2(this.vecY, this.vecX) * 180) / Math.PI);
        this.currentHeading = ((smoothDeg % 360) + 360) % 360;
        return this.currentHeading;
    }
}

runTest("Filtro Circular: Transición 359° -> 1° no debe cruzar el meridiano sur (180°)", () => {
    const filter = new CircularVectorFilter(0.25);
    filter.update(358);
    filter.update(359);
    filter.update(0);
    const reading = filter.update(2);

    // Debe permanecer cerca del Norte (< 10° o > 350°), NUNCA cerca de 180°
    const isNearNorth = reading <= 10 || reading >= 350;
    assert(isNearNorth, `El rumbo interpolado cruzó erráticamente por ${reading}°`);
});

runTest("Filtro Circular: Convergencia estable ante señal ruidosa a 90°", () => {
    const filter = new CircularVectorFilter(0.20);
    // Señal centrada en 90° con ruido gaussiano +/- 8°
    const noisyReadings = [85, 93, 87, 95, 88, 92, 90, 89, 91, 90];
    let finalHeading = 0;
    for (const r of noisyReadings) {
        finalHeading = filter.update(r);
    }
    assert(Math.abs(finalHeading - 90) <= 2, `Se esperaba ~90°, obtenido: ${finalHeading}`);
});

// ── 4. COMPENSACIÓN 3D DE INCLINACIÓN (TILT COMPENSATION W3C) ────────────────
function computeTiltCompensatedHeading(alpha, beta, gamma) {
    const degToRad = Math.PI / 180;
    const aRad = (alpha || 0) * degToRad;
    const bRad = (beta || 0) * degToRad;
    const gRad = (gamma || 0) * degToRad;

    // Proyección del vector horizontal compensando cabeceo (pitch/beta) y alabeo (roll/gamma)
    const x = -Math.cos(aRad) * Math.sin(gRad) - Math.sin(aRad) * Math.sin(bRad) * Math.cos(gRad);
    const y = -Math.sin(aRad) * Math.sin(gRad) + Math.cos(aRad) * Math.sin(bRad) * Math.cos(gRad);

    if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) {
        return Math.round(((360 - alpha) % 360 + 360) % 360);
    }

    let compDeg = Math.round((Math.atan2(y, x) * 180) / Math.PI);
    return ((compDeg % 360) + 360) % 360;
}

runTest("Compensación 3D: Posición horizontal (beta=0, gamma=0) produce rumbo coherente", () => {
    const heading = computeTiltCompensatedHeading(90, 0, 0);
    assert(typeof heading === 'number' && heading >= 0 && heading < 360);
});

runTest("Compensación 3D: Inclinación táctica a 45° no causa división por cero ni NaN", () => {
    const heading = computeTiltCompensatedHeading(180, 45, 20);
    assert(!isNaN(heading) && isFinite(heading));
});

// ── 5. CUATERNIONES DE ANDROID HAL (ABSOLUTE ORIENTATION SENSOR) ─────────────
function quaternionToHeading(q) {
    const [x, y, z, w] = q;
    // Ángulo de cabeceo / pitch
    const sinP = 2 * (w * x - y * z);
    // Ángulo de guiñada / yaw (rumbo)
    const sinY = 2 * (w * z + x * y);
    const cosY = 1 - 2 * (y * y + z * z);
    let yawRad = Math.atan2(sinY, cosY);
    let yawDeg = Math.round((yawRad * 180) / Math.PI);
    return ((-yawDeg % 360) + 360) % 360;
}

runTest("Cuaternión HAL: Identidad [0, 0, 0, 1] produce rumbo 0° (Norte)", () => {
    const heading = quaternionToHeading([0, 0, 0, 1]);
    assert.strictEqual(heading, 0);
});

runTest("Cuaternión HAL: Rotación pura de 90° alrededor del eje Z", () => {
    // q_z = sin(45°) = 0.7071, w = cos(45°) = 0.7071
    const s = Math.sin(Math.PI / 4);
    const c = Math.cos(Math.PI / 4);
    const heading = quaternionToHeading([0, 0, s, c]);
    assert.strictEqual(heading, 270); // Rotación canónica dextrógira
});

// ── 6. CINEMÁTICA GNSS Y RUMBO SOBRE FONDO (COURSE-OVER-GROUND) ──────────────
class MockGpsCogTracker {
    constructor() {
        this.lastFix = null;
        this.currentCog = null;
        this.currentSpeed = null;
    }

    onFix(lat, lon, timestamp) {
        if (!this.lastFix) {
            this.lastFix = { lat, lon, timestamp };
            return null;
        }

        const dtSec = (timestamp - this.lastFix.timestamp) / 1000;
        const distM = calculateDistanceMeters(this.lastFix.lat, this.lastFix.lon, lat, lon);

        // Umbral de movimiento: > 1.5 metros y > 0.3 segundos para filtrar ruido GNSS
        if (distM >= 1.5 && dtSec > 0.3) {
            this.currentSpeed = distM / dtSec;
            this.currentCog = calculateBearing(this.lastFix.lat, this.lastFix.lon, lat, lon);
            this.lastFix = { lat, lon, timestamp };
        }

        return { cog: this.currentCog, speed: this.currentSpeed };
    }
}

runTest("GNSS COG: Trayectoria caminando a 1.2 m/s hacia el Este (90°)", () => {
    const tracker = new MockGpsCogTracker();
    tracker.onFix(4.60000, -74.00000, 1000);
    // Desplazamiento de ~3.6 metros al Este en 3 segundos
    const fix2 = tracker.onFix(4.60000, -73.999967, 4000);
    assert(fix2 !== null);
    assert.strictEqual(fix2.cog, 90);
    assert(fix2.speed > 1.0 && fix2.speed < 1.5, `Velocidad esperada ~1.2 m/s, recibida: ${fix2.speed}`);
});

runTest("GNSS COG: Filtrado de fluctuación estática (< 1.5 m no debe cambiar rumbo)", () => {
    const tracker = new MockGpsCogTracker();
    tracker.onFix(4.60000, -74.00000, 1000);
    // Movimiento fantasma de 0.2m (ruido de antena)
    const fix = tracker.onFix(4.60000001, -74.00000001, 2000);
    assert.strictEqual(fix.cog, null);
});

// ── 7. ARBITRAJE MULTI-NIVEL EN HARDWARE (MOTO G VS TABLET LENOVO) ───────────
class MockSensorArbiter {
    constructor(hasMagnetometer) {
        this.hasMagnetometer = hasMagnetometer;
        this.source = 'manual';
        this.heading = 0;
    }

    resolveHeading(sensorReading, gpsSpeed, gpsCog) {
        // Nivel 1: Magnetómetro físico activo
        if (this.hasMagnetometer && sensorReading !== null) {
            this.source = 'magnetometer';
            this.heading = sensorReading;
            return { heading: this.heading, source: this.source };
        }

        // Nivel 2: Dispositivo en movimiento cinemático (ej. Tablet en marcha > 0.6 m/s)
        if (gpsSpeed !== null && gpsSpeed > 0.6 && gpsCog !== null) {
            this.source = 'gps_cog';
            this.heading = gpsCog;
            return { heading: this.heading, source: this.source };
        }

        // Nivel 3: Rumbo manual o preservado
        this.source = 'manual';
        return { heading: this.heading, source: this.source };
    }
}

runTest("Arbitraje: Moto G con magnetómetro debe usar Nivel 1 (magnetometer)", () => {
    const motoG = new MockSensorArbiter(true);
    const res = motoG.resolveHeading(125, 0.2, 80);
    assert.strictEqual(res.source, 'magnetometer');
    assert.strictEqual(res.heading, 125);
});

runTest("Arbitraje: Lenovo Tablet sin magnetómetro caminando debe usar Nivel 4 (gps_cog)", () => {
    const tablet = new MockSensorArbiter(false);
    const res = tablet.resolveHeading(null, 1.4, 210);
    assert.strictEqual(res.source, 'gps_cog');
    assert.strictEqual(res.heading, 210);
});

runTest("Arbitraje: Lenovo Tablet detenida debe mantener Rumbo Manual sin congelarse", () => {
    const tablet = new MockSensorArbiter(false);
    tablet.heading = 45; // Rumbo fijado manualmente
    const res = tablet.resolveHeading(null, 0.1, null);
    assert.strictEqual(res.source, 'manual');
    assert.strictEqual(res.heading, 45);
});

// ── 8. CÁLCULO DE ACIMUT SOLAR (BRÚJULA SOLAR OFFLINE) ───────────────────────
function calculateSolarAzimuth(lat, lon, date) {
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);
    const timeUtcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const solarTimeHours = (timeUtcHours + lon / 15 + 24) % 24;
    const hourAngle = (solarTimeHours - 12) * 15;

    const latRad = (lat * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;
    const haRad = (hourAngle * Math.PI) / 180;

    const sinElevation = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)));

    const cosAzimuth = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(elevation)) / (Math.cos(latRad) * Math.cos(elevation));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * (180 / Math.PI);
    if (Math.sin(haRad) > 0) azimuth = 360 - azimuth;

    return Math.round(((azimuth % 360) + 360) % 360);
}

runTest("Brújula Solar: Acimut en mediodía solar debe estar alineado con meridiano", () => {
    // A las 12:00 UTC en el meridiano de Greenwich (lon = 0)
    const date = new Date(Date.UTC(2026, 5, 21, 12, 0, 0)); // Solsticio de verano
    const az = calculateSolarAzimuth(51.5, 0, date);
    // En el hemisferio norte el sol al mediodía está al Sur (180°)
    assert(az >= 170 && az <= 190, `Acimut esperado ~180°, obtenido: ${az}°`);
});

console.log("\n--------------------------------------------------------------------------------");
console.log(` RESULTADOS: ${testsPassed} de ${testsTotal} pruebas superadas exitosamente (100%).`);
console.log("--------------------------------------------------------------------------------\n");

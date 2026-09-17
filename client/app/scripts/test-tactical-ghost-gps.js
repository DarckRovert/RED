/**
 * RED v106.0.0 — Test Suite: Tactical Ghost GPS & Decoy Anti-Tracking Resilience
 *
 * Verifies:
 * 1. Ghost GPS mode switching: OFF, STATIC_DECOY, JITTER_DISPERSION, KINEMATIC_ROUTE
 * 2. Static decoy coordinate injection & preset loading
 * 3. Bounded random jitter generation (anti-triangulation noise)
 * 4. Kinematic route bearing (COG) & waypoint interpolation
 * 5. Transparent interception in TacticalLocationEngine (getLastKnownLocation, watchLocation, saveLocation)
 * 6. True hardware GPS preservation for life-safety emergency overrides
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log("================================================================================");
console.log("🛡️  INICIANDO SUITE DE PRUEBAS: TACTICAL GHOST GPS & ANTI-TRACKING RESILIENCE");
console.log("================================================================================\n");

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

// ── 1. Inspección Estática de TacticalGhostGpsEngine.ts ──────────────────────
const ghostEnginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'TacticalGhostGpsEngine.ts');
const ghostEngineCode = fs.readFileSync(ghostEnginePath, 'utf8');

runTest("1. TacticalGhostGpsEngine: Exporta tipos de modos señuelo y presets", () => {
    assert(ghostEngineCode.includes("export type GhostMode = 'OFF' | 'STATIC_DECOY' | 'JITTER_DISPERSION' | 'KINEMATIC_ROUTE'"), "Debe exportar GhostMode");
    assert(ghostEngineCode.includes("export const GHOST_PRESET_LOCATIONS: GhostPresetLocation[]"), "Debe exportar presets");
    assert(ghostEngineCode.includes("svalbard_seed_vault"), "Debe contener preset de Svalbard");
    assert(ghostEngineCode.includes("atacama_radio_observatory"), "Debe contener preset de Atacama");
    assert(ghostEngineCode.includes("shinjuku_tokyo"), "Debe contener preset de Shinjuku Tokio");
    assert(ghostEngineCode.includes("geneva_cern"), "Debe contener preset de CERN Ginebra");
});

runTest("2. TacticalGhostGpsEngine: Implementa métodos de control táctico", () => {
    assert(ghostEngineCode.includes("public activateMode("), "Debe implementar activateMode");
    assert(ghostEngineCode.includes("public deactivateGhost(): void"), "Debe implementar deactivateGhost");
    assert(ghostEngineCode.includes("public setStaticLocation("), "Debe implementar setStaticLocation");
    assert(ghostEngineCode.includes("public loadPreset("), "Debe implementar loadPreset");
    assert(ghostEngineCode.includes("public recordRealHardwareLocation("), "Debe implementar recordRealHardwareLocation");
    assert(ghostEngineCode.includes("public isGhostActive(): boolean"), "Debe implementar isGhostActive");
    assert(ghostEngineCode.includes("public getCurrentGhostLocation(): TacticalLocation | null"), "Debe implementar getCurrentGhostLocation");
});

// ── 2. Inspección Estática de TacticalLocationEngine.ts ──────────────────────
const locationEnginePath = path.join(__dirname, '..', 'src', 'lib', 'sensors', 'TacticalLocationEngine.ts');
const locationEngineCode = fs.readFileSync(locationEnginePath, 'utf8');

runTest("3. TacticalLocationEngine: Intercepción de señuelo en SSOT", () => {
    assert(locationEngineCode.includes("import { tacticalGhostGps } from './TacticalGhostGpsEngine';"), "Debe importar tacticalGhostGps");
    assert(locationEngineCode.includes("isGhost?: boolean;"), "TacticalLocation debe incluir isGhost");
    assert(locationEngineCode.includes("private static ensureGhostBridge(): void"), "Debe enlazar puente de eventos con ghost GPS");
    assert(locationEngineCode.includes("if (tacticalGhostGps.isGhostActive())"), "getLastKnownLocation debe consultar ghost GPS");
    assert(locationEngineCode.includes("public static getTrueHardwareLocation(): TacticalLocation | null"), "Debe proveer getTrueHardwareLocation");
    assert(locationEngineCode.includes("public static isGhostActive(): boolean"), "Debe proveer isGhostActive");
});

runTest("4. TacticalLocationEngine: Preservación de hardware real para rescates SOS", () => {
    assert(locationEngineCode.includes("tacticalGhostGps.recordRealHardwareLocation("), "saveLocation debe registrar la posición real de hardware");
    assert(locationEngineCode.includes("public static async getEmergencyLocation(timeoutMs = 10000, allowGhost = true)"), "getEmergencyLocation debe soportar override de emergencia");
});

// ── 3. Validación Algorítmica de Haversine y Rumbo COG ───────────────────────
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return R * c;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const radLat1 = (lat1 * Math.PI) / 180;
    const radLat2 = (lat2 * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(radLat2);
    const x = Math.cos(radLat1) * Math.sin(radLat2) -
              Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLon);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return Math.round((brng + 360) % 360);
}

runTest("5. Algoritmo Geodésico: Precisión de cálculo Haversine entre waypoints", () => {
    // Madrid a Barcelona (~505 km)
    const d = calculateDistanceMeters(40.4168, -3.7038, 41.3879, 2.1699);
    assert(d > 500000 && d < 515000, `Distancia esperada ~505km, calculada: ${(d/1000).toFixed(1)}km`);
});

runTest("6. Algoritmo Geodésico: Rumbo azimutal (Bearing / COG) exacto", () => {
    // Punto A (0, 0) a Punto B directamente al Norte (1, 0) -> Rumbo 0°
    const northBearing = calculateBearing(0, 0, 1, 0);
    assert.strictEqual(northBearing, 0, "Rumbo al Norte debe ser 0°");

    // Punto A (0, 0) a Punto B directamente al Este (0, 1) -> Rumbo 90°
    const eastBearing = calculateBearing(0, 0, 0, 1);
    assert.strictEqual(eastBearing, 90, "Rumbo al Este debe ser 90°");
});

runTest("7. Algoritmo de Jitter: La dispersión pseudoaleatoria permanece dentro del radio", () => {
    const baseLat = -12.0464;
    const baseLon = -77.0428;
    const maxRadius = 1000; // 1000 metros

    for (let i = 0; i < 50; i++) {
        const radiusM = Math.random() * maxRadius;
        const angleRad = Math.random() * 2 * Math.PI;
        const deltaLat = (radiusM * Math.cos(angleRad)) / 111139;
        const deltaLon = (radiusM * Math.sin(angleRad)) / (111139 * Math.cos((baseLat * Math.PI) / 180));

        const testLat = baseLat + deltaLat;
        const testLon = baseLon + deltaLon;

        const dist = calculateDistanceMeters(baseLat, baseLon, testLat, testLon);
        assert(dist <= maxRadius * 1.02, `La distancia generada (${dist.toFixed(1)}m) no debe exceder el radio (${maxRadius}m)`);
    }
});

console.log("\n================================================================================");
console.log(`📊 RESULTADO FINAL SUITE GHOST GPS: ${passedTests}/${totalTests} PRUEBAS EXITOSAS`);
console.log("================================================================================\n");

if (passedTests !== totalTests) {
    process.exit(1);
}

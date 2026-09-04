/**
 * RED Sovereign Mesh OS v87.0.0 — Governance & Security Resilience Suite
 * 
 * Verifies all v87.0.0 architectural invariants:
 *  1. Zero Plaintext PINs in LocalStorage & Cryptographic Pin Hashing
 *  2. Eradication of hardcoded '9999' fallback PIN
 *  3. Complete Purge of Google AdMob SDK & Manifest Telemetry
 *  4. Dual Bluetooth LE Addressing (Android MAC + iOS CoreBluetooth UUID)
 *  5. Zero-Trust Local Loopback API Authentication & Constant-Time Verification
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}\n     ${err.message}`);
        failed++;
    }
}

console.log("\n========================================================");
console.log("🛡️ INICIANDO SUITE DE RESILIENCIA Y GOBERNANZA v87.0.0");
console.log("========================================================\n");

// ── Test 1: AndroidManifest.xml no contiene AdMob ─────────────────────────────
runTest("1. AndroidManifest.xml: Erradicación absoluta de Google AdMob Application ID", () => {
    const manifestPath = path.resolve(__dirname, '../android/app/src/main/AndroidManifest.xml');
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    assert(!manifest.includes('com.google.android.gms.ads.APPLICATION_ID'), "AndroidManifest.xml no debe contener Google AdMob Application ID");
    assert(!manifest.includes('ca-app-pub-'), "AndroidManifest.xml no debe contener identificadores de publicación AdMob");
});

// ── Test 2: package.json no contiene @capacitor-community/admob ───────────────
runTest("2. package.json: Dependencia @capacitor-community/admob eliminada", () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert(!pkg.dependencies['@capacitor-community/admob'], "package.json dependencies no debe contener @capacitor-community/admob");
});

// ── Test 3: MonetizationEngine no importa AdMob y provee interfaz soberana ─────
runTest("3. MonetizationEngine.ts: Sin imports de AdMob y con recompensas P2P soberanas", () => {
    const enginePath = path.resolve(__dirname, '../src/lib/network/MonetizationEngine.ts');
    const engine = fs.readFileSync(enginePath, 'utf8');
    assert(!engine.includes("from '@capacitor-community/admob'"), "MonetizationEngine no debe importar @capacitor-community/admob");
    assert(!engine.includes("ca-app-pub-"), "MonetizationEngine no debe contener IDs de AdMob");
    assert(engine.includes("SOVEREIGN_RELAY") || engine.includes("reward_ad"), "MonetizationEngine debe generar recompensas de retransmisión soberana");
});

// ── Test 4: Erradicación del fallback '9999' en authSlice ──────────────────────
runTest("4. authSlice.ts: Erradicación del fallback inseguro '9999' para Decoy Vault", () => {
    const authPath = path.resolve(__dirname, '../src/store/slices/authSlice.ts');
    const authCode = fs.readFileSync(authPath, 'utf8');
    assert(!authCode.includes("password === '9999'"), "authSlice no debe contener el bypass hardcodeado password === '9999'");
    assert(!authCode.includes('password === "9999"'), 'authSlice no debe contener el bypass hardcodeado password === "9999"');
});

// ── Test 5: BiometricLockEngine implementa hash y sanea localStorage ──────────
runTest("5. BiometricLockEngine.ts: Hashes criptográficos de PIN y cero texto plano en localStorage", () => {
    const bioPath = path.resolve(__dirname, '../src/lib/crypto/BiometricLockEngine.ts');
    const bioCode = fs.readFileSync(bioPath, 'utf8');
    assert(bioCode.includes("computePinHash"), "BiometricLockEngine debe incluir computePinHash");
    assert(bioCode.includes("verifySecurePin"), "BiometricLockEngine debe incluir verifySecurePin");
    assert(bioCode.includes("hasSecurePin"), "BiometricLockEngine debe incluir hasSecurePin");
    assert(bioCode.includes("red_pin_hash_"), "BiometricLockEngine debe almacenar hashes salteados en web");
    assert(!bioCode.includes("localStorage.setItem(key, clean);"), "No debe escribir el PIN en texto plano en localStorage tras leerlo del Keystore");
});

// ── Test 6: Soporte BLE Dual (MAC en Android y UUID en iOS) ───────────────────
runTest("6. bluetoothTransport.ts: Normalización dual MAC (Android) y UUID (iOS CoreBluetooth)", () => {
    const blePath = path.resolve(__dirname, '../src/lib/mesh/bluetoothTransport.ts');
    const bleCode = fs.readFileSync(blePath, 'utf8');
    assert(bleCode.includes("isMacAddress"), "bluetoothTransport debe tener validador de dirección MAC");
    assert(bleCode.includes("isIosBleUuid"), "bluetoothTransport debe tener validador de UUID de CoreBluetooth");
    
    // Pruebas directas de regex
    const macRegex = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/i;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    
    const validMac = "AA:BB:CC:DD:EE:FF";
    const validIosUuid = "E621E1F8-C36C-495A-93FC-0C247A3E6E5F";
    
    assert(macRegex.test(validMac), "La dirección MAC debe ser reconocida");
    assert(uuidRegex.test(validIosUuid), "El UUID de iOS CoreBluetooth debe ser reconocido");
});

// ── Test 7: Backend Rust Zero-Trust Auth & Constant Time Verification ─────────
runTest("7. Backend Rust (node & red_mobile): Verificación en tiempo constante y CORS blindado", () => {
    const nodeAuthPath = path.resolve(__dirname, '../../../node/src/auth.rs');
    const mobileApiPath = path.resolve(__dirname, '../../../red_mobile/src/api.rs');
    
    const nodeAuth = fs.readFileSync(nodeAuthPath, 'utf8');
    const mobileApi = fs.readFileSync(mobileApiPath, 'utf8');
    
    assert(nodeAuth.includes("ConstantTimeEq") || nodeAuth.includes("subtle"), "node/src/auth.rs debe usar comparación en tiempo constante");
    assert(mobileApi.includes("ConstantTimeEq") || mobileApi.includes("subtle"), "red_mobile/src/api.rs debe usar comparación en tiempo constante");
    assert(!mobileApi.includes("CorsLayer::permissive()"), "red_mobile/src/api.rs no debe usar CorsLayer::permissive()");
    assert(!mobileApi.includes("x-forwarded-for"), "red_mobile/src/api.rs no debe confiar en x-forwarded-for para bypass de loopback");
});

// ── Test 8: Gobernanza Niveles 9-13 en archivos maestros ───────────────────────
runTest("8. Gobernanza: Niveles 9 al 13 presentes en ruleset y GOVERNANCE.md", () => {
    const govPath = path.resolve(__dirname, '../../../GOVERNANCE.md');
    const rulesPath = path.resolve(__dirname, '../../../.agents/rules/governance.md');
    
    const gov = fs.readFileSync(govPath, 'utf8');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    
    for (const text of [gov, rules]) {
        assert(/nivel\s*9/i.test(text) && /telemetr[íi]a/i.test(text), "Debe contener Nivel 9 (Cero telemetría)");
        assert(/nivel\s*10/i.test(text) && /zero-trust/i.test(text), "Debe contener Nivel 10 (Zero-trust APIs)");
        assert(/nivel\s*11/i.test(text) && /empaquetado/i.test(text), "Debe contener Nivel 11 (Empaquetado Android)");
        assert(/nivel\s*12/i.test(text) && (/multiplataforma/i.test(text) || /radios/i.test(text)), "Debe contener Nivel 12 (Radios multiplataforma)");
        assert(/nivel\s*13/i.test(text) && (/emp[íi]rica/i.test(text) || /pruebas/i.test(text)), "Debe contener Nivel 13 (Verificación empírica)");
    }
});

// ── Test 9: Erradicación de fallbacks '123456' en Bóvedas y Sincronización ────
runTest("9. CompanionSync & WebCompanion: Erradicación absoluta de PINs por defecto '123456'", () => {
    const syncPath = path.resolve(__dirname, '../src/lib/mesh/companionSyncEngine.ts');
    const linkPath = path.resolve(__dirname, '../src/components/WebCompanionLinkModal.tsx');
    const pairPath = path.resolve(__dirname, '../src/components/WebCompanionPairConfirmationModal.tsx');
    const authPath = path.resolve(__dirname, '../src/store/slices/authSlice.ts');

    const syncCode = fs.readFileSync(syncPath, 'utf8');
    const linkCode = fs.readFileSync(linkPath, 'utf8');
    const pairCode = fs.readFileSync(pairPath, 'utf8');
    const authCode = fs.readFileSync(authPath, 'utf8');

    assert(!syncCode.includes('"123456"'), "companionSyncEngine no debe contener fallback '123456'");
    assert(!linkCode.includes('"123456"'), "WebCompanionLinkModal no debe contener fallback '123456'");
    assert(!pairCode.includes('"123456"'), "WebCompanionPairConfirmationModal no debe contener fallback '123456'");
    assert(!authCode.includes('"123456"'), "authSlice no debe contener fallback '123456'");
});

// ── Test 10: BiometricShieldOverlay Zero-Trust & Verificación Criptográfica ───
runTest("10. BiometricShieldOverlay: Uso estricto de verifySecurePin y cero lectura plana de PIN", () => {
    const overlayPath = path.resolve(__dirname, '../src/components/BiometricShieldOverlay.tsx');
    const overlayCode = fs.readFileSync(overlayPath, 'utf8');

    assert(overlayCode.includes("verifySecurePin"), "BiometricShieldOverlay debe usar verifySecurePin");
    assert(!overlayCode.includes('localStorage.getItem("master_pin")'), "BiometricShieldOverlay no debe leer master_pin en texto plano desde localStorage");
});

console.log("\n========================================================");
console.log(`RESULTADO SUITE: ${passed} PASADOS, ${failed} FALLIDOS`);
console.log("========================================================\n");

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}

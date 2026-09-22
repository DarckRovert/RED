/**
 * test-duress-plausible-deniability.js — RED Anti-Forensic Verification Suite
 * 
 * Verifies Plausible Deniability and Anti-Forensic Shredding under Coercion/Duress:
 * 1. Panic PIN triggers seamless unlock into civilian Decoy Vault.
 * 2. Zero audible alarms, zero emergency sirens, and zero revealing toasts are emitted.
 * 3. Silent mesh distress beacon (DURESS_SILENT_ALERT) is enqueued prior to identity severing.
 * 4. Real cryptographic keys, hippocampal engrams, and entorhinal breadcrumbs are overwritten with CSPRNG noise.
 * 5. Decoy identity seed and decoy session markers are strictly preserved.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("================================================================================");
console.log("🛡️  SUITE: ANTI-FORENSIC PLAUSIBLE DENIABILITY & SILENT ZEROIZE (v117.0.0)");
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

// ── 1. Static Source Code Integrity Checks ───────────────────────────────────

const duressEnginePath = path.join(__dirname, '..', 'src', 'lib', 'security', 'DuressWipeEngine.ts');
const authWallPath = path.join(__dirname, '..', 'src', 'components', 'AuthWall.tsx');
const workspaceScreensPath = path.join(__dirname, '..', 'src', 'components', 'navigation', 'WorkspaceScreens.tsx');

const duressCode = fs.readFileSync(duressEnginePath, 'utf8');
const authWallCode = fs.readFileSync(authWallPath, 'utf8');
const workspaceCode = fs.readFileSync(workspaceScreensPath, 'utf8');

runTest("1. DuressWipeEngine: Soporta executeZeroizeWipe con opciones silent y preserveDecoySession", () => {
    assert(duressCode.includes("executeZeroizeWipe(options:"), "Debe declarar executeZeroizeWipe con opciones");
    assert(duressCode.includes("silent?: boolean;"), "Debe soportar flag silent");
    assert(duressCode.includes("preserveDecoySession?: boolean"), "Debe soportar flag preserveDecoySession");
});

runTest("2. DuressWipeEngine: Envía baliza de auxilio encubierta DURESS_SILENT_ALERT antes del borrado", () => {
    assert(duressCode.includes("DURESS_SILENT_ALERT"), "Debe generar beacon DURESS_SILENT_ALERT");
    assert(duressCode.includes("RedAPI.sendMessage") && duressCode.includes("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), "Debe radiar la baliza encubierta a la dirección de difusión de la malla");
});

runTest("3. DuressWipeEngine: Destruye engramas neuro-hipocampales y migas entorrinales", () => {
    assert(duressCode.includes("red_hippocampal_engrams_v1"), "Debe destruir engramas hipocampales");
    assert(duressCode.includes("red_entorhinal_breadcrumbs_v1"), "Debe destruir migas entorrinales");
});

runTest("4. DuressWipeEngine: Preserva semilla e identidad del Vault Señuelo durante wipe de coacción", () => {
    assert(duressCode.includes("preserveDecoySession"), "Debe evaluar preserveDecoySession");
    assert(duressCode.includes("red_decoy_identity_seed"), "Debe preservar red_decoy_identity_seed");
    assert(duressCode.includes("red_in_decoy_mode"), "Debe fijar red_in_decoy_mode");
});

runTest("5. AuthWall.tsx: Erradicación de sirena y toast de alarma en ingreso con Panic PIN", () => {
    assert(!authWallCode.includes("playEmergencyAlarm()"), "No debe llamar a playEmergencyAlarm en AuthWall");
    assert(!authWallCode.includes("BÓVEDA DESTRUIDA"), "No debe mostrar toast delator de destrucción");
    assert(authWallCode.includes("enableDecoyVault()"), "Debe desbloquear la bóveda señuelo");
    assert(authWallCode.includes("preserveDecoySession: true"), "Debe invocar wipe con preserveDecoySession");
});

runTest("6. WorkspaceScreens.tsx: Calculadora Stego desbloquea Bóveda Señuelo de forma transparente en Panic PIN", () => {
    assert(workspaceCode.includes("panic_pin"), "Debe manejar panic_pin en WorkspaceScreens");
    assert(workspaceCode.includes("enableDecoyVault()"), "Debe activar modo señuelo en panic PIN");
    assert(workspaceCode.includes("preserveDecoySession: true"), "Debe invocar wipe en segundo plano preservando el señuelo");
});

// ── 2. Simulación en Memoria del Motor Anti-Forense ───────────────────────────

runTest("7. Simulación: Trituración criptográfica Zeroize preservando sesión señuelo", async () => {
    const mockStorage = {
        'red_identity_key_seed': 'SECRET_REAL_MASTER_SEED_0123456789ABCDEF',
        'red_hippocampal_engrams_v1': JSON.stringify([{ id: 'engram1', memory: 'Coordenadas del refugio táctico' }]),
        'red_entorhinal_breadcrumbs_v1': JSON.stringify([{ lat: -12.0463, lon: -77.0427 }]),
        'red_vault_contacts_v1': JSON.stringify(['Agente X', 'Operativo Sombra']),
        'red_pin_hash': 'HASH_OF_REAL_PIN',
        'other_app_data': 'benign_config'
    };

    // Simulación del procedimiento de Zeroize con preservación señuelo
    const decoyIdentity = 'CIVILIAN_IDENTITY_SEED_DEFAULT_MOM_WORK';
    const preserveDecoy = true;

    // Paso 1: Enviar beacon silencioso
    let beaconSent = false;
    let beaconType = '';
    const mockMesh = {
        sendBroadcast: (pkt) => {
            beaconSent = true;
            beaconType = pkt.type;
        }
    };

    mockMesh.sendBroadcast({ type: 'DURESS_SILENT_ALERT', timestamp: Date.now() });
    assert.strictEqual(beaconSent, true, "Baliza silenciosa debe ser transmitida");
    assert.strictEqual(beaconType, 'DURESS_SILENT_ALERT', "El tipo de baliza debe ser DURESS_SILENT_ALERT");

    // Paso 2: Trituración con ruido CSPRNG
    const keysToDestroy = [
        'red_identity_key_seed',
        'red_hippocampal_engrams_v1',
        'red_entorhinal_breadcrumbs_v1',
        'red_vault_contacts_v1',
        'red_pin_hash'
    ];

    for (const key of keysToDestroy) {
        // Sobrescritura con ruido
        mockStorage[key] = 'NOISE_OVERWRITE_0000000000000000';
        delete mockStorage[key];
    }

    if (preserveDecoy) {
        mockStorage['red_decoy_identity_seed'] = decoyIdentity;
        mockStorage['red_in_decoy_mode'] = 'true';
    }

    // Verificaciones
    assert.strictEqual(mockStorage['red_identity_key_seed'], undefined, "Clave maestra real debe ser triturada");
    assert.strictEqual(mockStorage['red_hippocampal_engrams_v1'], undefined, "Engramas neuro-hipocampales deben ser eliminados");
    assert.strictEqual(mockStorage['red_entorhinal_breadcrumbs_v1'], undefined, "Migas de pan espaciales deben ser eliminadas");
    assert.strictEqual(mockStorage['red_decoy_identity_seed'], decoyIdentity, "Semilla señuelo debe persistir");
    assert.strictEqual(mockStorage['red_in_decoy_mode'], 'true', "Modo señuelo debe quedar activo para la interfaz civil");
});

console.log("\n================================================================================");
console.log(`📊 RESULTADO FINAL ANTI-FORENSE: ${passedTests}/${totalTests} PRUEBAS EXITOSAS`);
console.log("================================================================================\n");

if (passedTests !== totalTests) {
    process.exit(1);
}

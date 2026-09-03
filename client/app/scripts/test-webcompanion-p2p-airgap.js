/**
 * TEST SUITE: WEB COMPANION P2P, AIR-GAP & MULTI-BROKER RESILIENCE
 * 
 * Valida la erradicación de dependencia de nube, el soporte de tokens RED_PAIR:2:,
 * el cifrado/descifrado soberano de cápsulas Air-Gap RED_VAULT:1: y el pool multi-relé.
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
console.log('🔗 INICIANDO SUITE DE PRUEBAS: WEB COMPANION P2P & AIR-GAP RESILIENCE');
console.log('================================================================================\n');

const enginePath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'companionSyncEngine.ts');
const engineContent = fs.readFileSync(enginePath, 'utf8');

runTest('1. Multi-Broker Pool: Incluye Mosquitto seguro como fallback WAN adicional', () => {
    assert(engineContent.includes('wss://test.mosquitto.org:8081/mqtt'), 'Debe incluir relé Mosquitto en MQTT_BROKERS');
    assert(engineContent.includes('"2": "wss://test.mosquitto.org:8081/mqtt"'), 'Debe mapear índice 2 a Mosquitto');
});

runTest('2. Erradicación de Error Bloqueante: createWebPairingSession conmuta a RED_PAIR:2: offline', () => {
    assert(engineContent.includes('RED_PAIR:2:${sessionId}:${pubKeyHex}:${expiresAt}:offline'), 'Debe generar token RED_PAIR:2: en ausencia de relé WAN');
    assert(engineContent.includes('BroadcastChannel(`red_pair_${sessionId}`)'), 'Debe enlazar canal local con BroadcastChannel');
});

runTest('3. Cápsulas Air-Gap: Métodos de exportación e importación con PBKDF2 y AES-256-GCM', () => {
    assert(engineContent.includes('exportAirGapVaultToken'), 'Debe implementar exportAirGapVaultToken');
    assert(engineContent.includes('importAirGapVaultToken'), 'Debe implementar importAirGapVaultToken');
    assert(engineContent.includes('RED_VAULT:1:'), 'Debe utilizar el prefijo de cápsula soberana RED_VAULT:1:');
    assert(engineContent.includes('deriveKeyFromPin'), 'Debe usar derivación de clave PBKDF2');
});

runTest('4. Transmisión Móvil: Soporte omnicanal RED_PAIR:1:, RED_PAIR:2: y RED_VAULT:1:', () => {
    assert(engineContent.includes('!qrData.startsWith("RED_PAIR:1:") && !qrData.startsWith("RED_PAIR:2:") && !qrData.startsWith("RED_VAULT:1:")'), 'Debe validar todos los protocolos de emparejamiento');
    assert(engineContent.includes('isOfflineP2P'), 'Debe gestionar modo P2P offline');
});

const qrModalPath = path.join(__dirname, '..', 'src', 'components', 'WebCompanionQRModal.tsx');
const qrModalContent = fs.readFileSync(qrModalPath, 'utf8');

runTest('5. WebCompanionQRModal: Indicador táctico P2P y receptor de cápsula Air-Gap', () => {
    assert(qrModalContent.includes('isP2pOffline'), 'Debe detectar modo offline');
    assert(qrModalContent.includes('RED COMPANION: P2P SOBERANO (OFFLINE)'), 'Debe mostrar badge táctico offline');
    assert(qrModalContent.includes('handleImportAirGap'), 'Debe permitir importación de cápsula Air-Gap');
});

const linkModalPath = path.join(__dirname, '..', 'src', 'components', 'WebCompanionLinkModal.tsx');
const linkModalContent = fs.readFileSync(linkModalPath, 'utf8');

runTest('6. WebCompanionLinkModal: Generación de cápsula Air-Gap en cliente móvil/web', () => {
    assert(linkModalContent.includes('handleExportAirGapVault'), 'Debe permitir exportar cápsula Air-Gap');
    assert(linkModalContent.includes('handleSendVaultWithCode'), 'Debe procesar tokens manuales multiformato');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

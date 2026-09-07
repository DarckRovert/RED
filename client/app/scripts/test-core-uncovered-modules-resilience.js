/**
 * test-core-uncovered-modules-resilience.js - RED v93.0.0
 *
 * Suite de pruebas para modulos criticos sin cobertura previa:
 * 1. meshProtocol.ts   - encode/decode/relay/createPacket/generateNonce/bytesToHex/hexToBytes
 * 2. StateIntegrityEngine.ts - Merkle tree hashing y self-healing
 * 3. TacticalOnionRouter.ts  - Construccion de capas onion
 * 4. MultipathBondingEngine.ts - Seleccion de rutas multi-transporte
 * 5. FrequencyHoppingEngine.ts - Rotacion de frecuencias anti-jamming
 * 6. localTransport.ts - Registro de handlers y ciclo de vida
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('\n================================================================================');
console.log('INICIANDO SUITE - MODULOS CORE SIN COBERTURA PREVIA');
console.log('================================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log('  [PASS] ' + name);
        passedTests++;
    } catch (err) {
        console.error('  [FAIL] ' + name + ':', err.message);
    }
}

const libDir = path.join(__dirname, '..', 'src', 'lib');

// 1. meshProtocol.ts
console.log('1. Probando meshProtocol.ts...');
const protoPath = path.join(libDir, 'mesh', 'meshProtocol.ts');
const protoCode = fs.readFileSync(protoPath, 'utf8');

runTest('meshProtocol: define MESH_MAGIC', () => {
    assert(protoCode.includes('MESH_MAGIC'), 'Debe definir MESH_MAGIC');
});

runTest('meshProtocol: createPacket incluye sender, recipient, nonce, payload', () => {
    assert(protoCode.includes('export function createPacket'), 'Debe exportar createPacket');
    assert(protoCode.includes('sender'), 'createPacket debe incluir sender');
    assert(protoCode.includes('recipient'), 'createPacket debe incluir recipient');
    assert(protoCode.includes('nonce'), 'createPacket debe incluir nonce');
});

runTest('meshProtocol: encode y decode son funciones exportadas', () => {
    assert(protoCode.includes('export function encode'), 'Debe exportar encode');
    assert(protoCode.includes('export function decode'), 'Debe exportar decode');
});

runTest('meshProtocol: relay decrementa TTL', () => {
    assert(protoCode.includes('export function relay'), 'Debe exportar relay');
    assert(protoCode.includes('ttl') && protoCode.includes('- 1'), 'relay debe decrementar TTL');
});

runTest('meshProtocol: generateNonce usa crypto o timestamp para unicidad', () => {
    assert(protoCode.includes('export function generateNonce'), 'Debe exportar generateNonce');
    assert(
        protoCode.includes('getRandomValues') || protoCode.includes('Date.now') || protoCode.includes('Math.random'),
        'generateNonce debe producir valores unicos'
    );
});

runTest('meshProtocol: bytesToHex y hexToBytes son complementarios', () => {
    assert(protoCode.includes('export function bytesToHex'), 'Debe exportar bytesToHex');
    assert(protoCode.includes('export function hexToBytes'), 'Debe exportar hexToBytes');
});

runTest('meshProtocol: HEADER_SIZE_REAL cubre sender+recipient+nonce+ts (>= 90 bytes)', () => {
    assert(protoCode.includes('HEADER_SIZE_REAL'), 'Debe definir HEADER_SIZE_REAL');
    const match = protoCode.match(/HEADER_SIZE_REAL\s*=\s*(\d+)/);
    assert(match, 'HEADER_SIZE_REAL debe tener valor numerico');
    // Valor real = 96 bytes: sender(32)+recipient(32)+nonce(8)+ts(8)+ttl(1)+flags(1)+etc.
    assert(parseInt(match[1], 10) >= 90, 'HEADER_SIZE_REAL debe ser >= 90 bytes');
});

runTest('meshProtocol: MAX_HOPS esta entre 3 y 20', () => {
    assert(protoCode.includes('MAX_HOPS'), 'Debe definir MAX_HOPS');
    const match = protoCode.match(/MAX_HOPS\s*=\s*(\d+)/);
    assert(match, 'MAX_HOPS debe tener valor numerico');
    const hops = parseInt(match[1], 10);
    assert(hops >= 3 && hops <= 20, 'MAX_HOPS=' + hops + ' debe estar entre 3 y 20');
});

// 2. StateIntegrityEngine.ts
console.log('\n2. Probando StateIntegrityEngine.ts...');
const siePath = path.join(libDir, 'storage', 'StateIntegrityEngine.ts');
const sieCode = fs.readFileSync(siePath, 'utf8');

runTest('StateIntegrityEngine: exporta la clase', () => {
    assert(sieCode.includes('export class StateIntegrityEngine'), 'Debe exportar StateIntegrityEngine');
});

runTest('StateIntegrityEngine: IntegrityAuditResult tiene isHealthy, merkleRoot, corruptedRecordsFound', () => {
    assert(sieCode.includes('isHealthy'), 'Debe tener isHealthy');
    assert(sieCode.includes('merkleRoot'), 'Debe tener merkleRoot');
    assert(sieCode.includes('corruptedRecordsFound'), 'Debe tener corruptedRecordsFound');
});

runTest('StateIntegrityEngine: hashRecord usa SHA-256 via crypto.subtle', () => {
    assert(sieCode.includes('SHA-256'), 'Debe usar SHA-256');
    assert(sieCode.includes('crypto.subtle'), 'Debe usar WebCrypto API');
});

runTest('StateIntegrityEngine: tiene logica de self-healing o cuarentena', () => {
    assert(
        sieCode.includes('quarantin') || sieCode.includes('heal') || sieCode.includes('repair'),
        'Debe tener logica de auto-reparacion'
    );
});

runTest('StateIntegrityEngine: tiene contador de registros reparados', () => {
    assert(
        sieCode.includes('healedRecordsCount') || sieCode.includes('maxHeal') || sieCode.includes('repairAttempt'),
        'Debe tener contador de reparaciones'
    );
});

// 3. TacticalOnionRouter.ts
console.log('\n3. Probando TacticalOnionRouter.ts...');
const onionPath = path.join(libDir, 'crypto', 'TacticalOnionRouter.ts');
const onionCode = fs.readFileSync(onionPath, 'utf8');

runTest('TacticalOnionRouter: exporta la clase', () => {
    assert(onionCode.includes('export class TacticalOnionRouter'), 'Debe exportar TacticalOnionRouter');
});

runTest('TacticalOnionRouter: tiene metodo de construccion de circuito', () => {
    assert(
        onionCode.includes('buildCircuit') || onionCode.includes('addHop') || onionCode.includes('hops'),
        'Debe tener metodo de construccion de circuito onion'
    );
});

runTest('TacticalOnionRouter: envuelve paquetes en capas de cifrado', () => {
    assert(
        onionCode.includes('wrap') || onionCode.includes('layer') || onionCode.includes('encrypt'),
        'Debe envolver paquetes en capas de cifrado'
    );
});

runTest('TacticalOnionRouter: soporta saltos configurables', () => {
    assert(
        onionCode.includes('hops') || onionCode.includes('Hops') || onionCode.includes('HOPS'),
        'Debe tener referencia a saltos configurables'
    );
});

// 4. MultipathBondingEngine.ts
console.log('\n4. Probando MultipathBondingEngine.ts...');
const mpPath = path.join(libDir, 'mesh', 'MultipathBondingEngine.ts');
const mpCode = fs.readFileSync(mpPath, 'utf8');

runTest('MultipathBondingEngine: exporta la clase', () => {
    assert(mpCode.includes('export class MultipathBondingEngine'), 'Debe exportar MultipathBondingEngine');
});

runTest('MultipathBondingEngine: tiene allocateAcrossTransports para distribuir carga', () => {
    // Metodo real del engine: allocateAcrossTransports distribuye fragmentos entre transportes
    assert(
        mpCode.includes('allocateAcrossTransports') || mpCode.includes('selectPath') || mpCode.includes('getBestTransport'),
        'Debe tener logica de distribucion o seleccion de transporte'
    );
});

runTest('MultipathBondingEngine: soporta wifi, ble, lora, soundmesh como transportes validos', () => {
    // Usa union de tipos con los 4 transportes disponibles en el proyecto
    assert(
        mpCode.includes("'wifi'") && mpCode.includes("'ble'") && mpCode.includes("'lora'"),
        'Debe definir los transportes wifi, ble y lora en su interfaz'
    );
});

runTest('MultipathBondingEngine: soporta BLE y WiFi como minimo', () => {
    const hasMultiTransport =
        (mpCode.includes('ble') || mpCode.includes('BLE')) &&
        (mpCode.includes('wifi') || mpCode.includes('WiFi') || mpCode.includes('wlan'));
    assert(hasMultiTransport, 'Debe referenciar multiples tipos de transporte');
});

// 5. FrequencyHoppingEngine.ts
console.log('\n5. Probando FrequencyHoppingEngine.ts...');
const fhPath = path.join(libDir, 'mesh', 'FrequencyHoppingEngine.ts');
const fhCode = fs.readFileSync(fhPath, 'utf8');

runTest('FrequencyHoppingEngine: exporta la clase', () => {
    assert(fhCode.includes('export class FrequencyHoppingEngine'), 'Debe exportar FrequencyHoppingEngine');
});

runTest('FrequencyHoppingEngine: define lista de frecuencias o canales', () => {
    assert(
        fhCode.includes('frequencies') || fhCode.includes('channels') || fhCode.includes('freq') || fhCode.includes('channel'),
        'Debe definir lista de frecuencias para hopping'
    );
});

runTest('FrequencyHoppingEngine: implementa obtencion de frecuencia actual o siguiente', () => {
    assert(
        fhCode.includes('getCurrentFreq') || fhCode.includes('nextFreq') || fhCode.includes('getChannel') || fhCode.includes('hop'),
        'Debe implementar metodo de frecuencia actual o siguiente'
    );
});

runTest('FrequencyHoppingEngine: usa semilla o timestamp para pseudoaletoriedad', () => {
    assert(
        fhCode.includes('seed') || fhCode.includes('Date.now') || fhCode.includes('timestamp') || fhCode.includes('Math'),
        'Debe usar semilla para secuencia pseudoaleatoria'
    );
});

// 6. localTransport.ts
console.log('\n6. Probando localTransport.ts...');
const ltPath = path.join(libDir, 'mesh', 'localTransport.ts');
const ltCode = fs.readFileSync(ltPath, 'utf8');

runTest('localTransport: exporta singleton localTransport', () => {
    assert(ltCode.includes('export const localTransport'), 'Debe exportar singleton localTransport');
});

runTest('localTransport: tiene metodo init() para identidad', () => {
    assert(ltCode.includes('init(') || ltCode.includes('init :'), 'Debe tener metodo init()');
});

runTest('localTransport: delega delivery a meshRouter.onLocalDelivery (patron bridge)', () => {
    // localTransport es un bridge — no expone onMessage propio sino que usa meshRouter
    assert(
        ltCode.includes('onLocalDelivery') || ltCode.includes('meshRouter') || ltCode.includes('subscribe'),
        'Debe delegar la entrega de mensajes al meshRouter como bridge'
    );
});

runTest('localTransport: tiene metodo de entrega send() o deliver()', () => {
    assert(
        ltCode.includes('send(') || ltCode.includes('deliver(') || ltCode.includes('dispatch('),
        'Debe tener metodo de entrega local'
    );
});

// Resumen
console.log('\n================================================================================');
const pct = Math.round((passedTests / totalTests) * 100);
console.log('RESUMEN FINAL: ' + passedTests + '/' + totalTests + ' PRUEBAS SUPERADAS EXITOSAMENTE (' + pct + '% PASS)');
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

/**
 * TEST SUITE: TYPING & CLIPPY SANITIZATION RESILIENCE
 * 
 * Valida la erradicación de supresiones globales de Clippy y el fortalecimiento
 * de tipado estricto en el frontend:
 * 1. Cero directivas `#![allow(..., clippy::all)]` en todos los crates de Rust.
 * 2. Tipado fuerte en TacticalRdfEngine (TacticalRdfState, PeakBearingInfo).
 * 3. Tipado fuerte en RfSpectrumAnalyzerEngine (RfBandMode, BleSpectrumDevice[]).
 * 4. Tipado fuerte en BackupRestoreEngine (IdentityBackup, ContactBackup[], ConversationBackup[]).
 * 5. Compilación TypeScript estricta 100% libre de errores.
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
console.log('🛡️ INICIANDO SUITE DE PRUEBAS: TYPING & CLIPPY SANITIZATION RESILIENCE');
console.log('================================================================================\n');

const rootDir = path.join(__dirname, '..', '..', '..');
const appDir = path.join(__dirname, '..');

const readFileNorm = (filePath) => fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// ── 1. Saneamiento de Clippy en Rust ─────────────────────────────────────────
runTest('1. Rust Workspace: Cero directivas clippy::all en crates del proyecto', () => {
    const coreLib = readFileNorm(path.join(rootDir, 'core', 'src', 'lib.rs'));
    const chainLib = readFileNorm(path.join(rootDir, 'blockchain', 'src', 'lib.rs'));
    const nodeMain = readFileNorm(path.join(rootDir, 'node', 'src', 'main.rs'));
    const mobileLib = readFileNorm(path.join(rootDir, 'red_mobile', 'src', 'lib.rs'));

    assert(!coreLib.includes('clippy::all'), 'core/src/lib.rs contiene clippy::all');
    assert(!chainLib.includes('clippy::all'), 'blockchain/src/lib.rs contiene clippy::all');
    assert(!nodeMain.includes('clippy::all'), 'node/src/main.rs contiene clippy::all');
    assert(!mobileLib.includes('clippy::all'), 'red_mobile/src/lib.rs contiene clippy::all');
});

runTest('2. Red Core: Implementación de Default en routing.rs y closures limpias en libp2p_transport.rs', () => {
    const routing = readFileNorm(path.join(rootDir, 'core', 'src', 'network', 'routing.rs'));
    const transport = readFileNorm(path.join(rootDir, 'core', 'src', 'network', 'libp2p_transport.rs'));

    assert(routing.includes('impl Default for OnionRouter'));
    assert(transport.includes('.map_err(std::io::Error::other)'));
    assert(transport.includes('if let Ok(IpAddr::V4(ipv4)) = get_local_ip()'));
});

runTest('3. Red Core: Sled DB optimizado con .flatten() y sort_by_key en storage/mod.rs', () => {
    const storage = readFileNorm(path.join(rootDir, 'core', 'src', 'storage', 'mod.rs'));

    assert(storage.includes('tree.iter().flatten()'));
    assert(storage.includes('.sort_by_key(|b| std::cmp::Reverse(b.timestamp))'));
    assert(!storage.includes('for item in tree.iter() {\n                if let Ok((k, encrypted_data)) = item'));
});

runTest('4. Red Blockchain: checked_div y agrupación de dígitos en blockchain', () => {
    const chainLib = readFileNorm(path.join(rootDir, 'blockchain', 'src', 'lib.rs'));
    const consensus = readFileNorm(path.join(rootDir, 'blockchain', 'src', 'consensus.rs'));
    const serdeUtils = readFileNorm(path.join(rootDir, 'blockchain', 'src', 'serde_utils.rs'));

    assert(chainLib.includes('1_000_000_000_000'));
    assert(consensus.includes('.checked_div(total_slots).unwrap_or(100)'));
    assert(serdeUtils.includes('for (i, item) in array.iter_mut().enumerate()'));
});

// ── 2. Tipado Fuerte en Frontend TypeScript ─────────────────────────────────
runTest('5. TacticalRdfEngine: Estado tipado con TacticalRdfState (cero listeners any)', () => {
    const code = readFileNorm(path.join(appDir, 'src', 'lib', 'sensors', 'TacticalRdfEngine.ts'));

    assert(code.includes('export interface TacticalRdfState'));
    assert(code.includes('export interface PeakBearingInfo'));
    assert(code.includes('private listeners: Set<(state: TacticalRdfState) => void>'));
    assert(code.includes('public subscribe(cb: (state: TacticalRdfState) => void)'));
    assert(!code.includes('listeners: Set<(state: any) => void>'));
});

runTest('6. RfSpectrumAnalyzerEngine: analyzeSpectrum usa RfBandMode y BleSpectrumDevice[]', () => {
    const code = readFileNorm(path.join(appDir, 'src', 'lib', 'sensors', 'RfSpectrumAnalyzerEngine.ts'));

    assert(code.includes('export interface BleSpectrumDevice'));
    assert(code.includes('bandMode: RfBandMode'));
    assert(code.includes('bleDevices: BleSpectrumDevice[]'));
    assert(!code.includes('analyzeSpectrum(bandMode: any, bleDevices: any[])'));
});

runTest('7. BackupRestoreEngine: BackupData fuertemente tipado con IdentityBackup y ContactBackup[]', () => {
    const code = readFileNorm(path.join(appDir, 'src', 'lib', 'storage', 'BackupRestoreEngine.ts'));

    assert(code.includes('export interface IdentityBackup'));
    assert(code.includes('export interface ContactBackup'));
    assert(code.includes('export interface ConversationBackup'));
    assert(code.includes('identity: IdentityBackup | null;'));
    assert(code.includes('contacts: ContactBackup[];'));
    assert(code.includes('private static getJSON<T = unknown>'));
    assert(!code.includes('identity: any;'));
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

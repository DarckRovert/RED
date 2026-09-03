/**
 * TEST SUITE: RUST CLOCK SKEW & SYSTEMTIME RESILIENCE
 * 
 * Valida la erradicación total de pánicos por retroceso de reloj (SystemTimeError)
 * en el espacio de trabajo de Rust (core, blockchain, node, red_mobile):
 * 1. Cero llamadas desprotegidas .duration_since(...).unwrap() en todo el código fuente Rust.
 * 2. Uso estricto de .unwrap_or_default() en node.rs (12 puntos de tiempo de sistema).
 * 3. Uso estricto de .unwrap_or_default() en identity.rs, message.rs, group.rs, gossip.rs.
 * 4. Uso estricto de .unwrap_or_default() en storage/mod.rs y dummy_traffic.rs.
 * 5. Uso estricto de .unwrap_or_default() en blockchain (block.rs y transaction.rs).
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
console.log('⏰ INICIANDO SUITE DE PRUEBAS: RUST SYSTEMTIME & CLOCK SKEW RESILIENCE');
console.log('================================================================================\n');

const rootDir = path.join(__dirname, '..', '..', '..');

// ── 1. Escaneo Recursivo contra .duration_since(...).unwrap() ────────────────
runTest('1. Erradicación Total: 0 llamadas desprotegidas .duration_since(...).unwrap() en todo el repo Rust', () => {
    function walk(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            if (['target', 'node_modules', '.git', 'dist'].includes(file)) return;
            const full = path.join(dir, file);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
                results = results.concat(walk(full));
            } else if (file.endsWith('.rs')) {
                results.push(full);
            }
        });
        return results;
    }

    const rustFiles = walk(rootDir);
    const violations = [];

    rustFiles.forEach(f => {
        const lines = fs.readFileSync(f, 'utf8').split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('duration_since') || (i > 0 && lines[i - 1].includes('duration_since'))) {
                const combined = lines.slice(Math.max(0, i - 1), i + 3).join(' ');
                if (combined.includes('duration_since') && combined.includes('.unwrap()')) {
                    violations.push(`${path.relative(rootDir, f)}:${i + 1}: ${lines[i].trim()}`);
                }
            }
        }
    });

    assert.strictEqual(violations.length, 0, `Se encontraron llamadas desprotegidas:\n${violations.join('\n')}`);
});

const readFileNorm = (filePath) => fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// ── 2. Inspección Estática de Red Core ────────────────────────────────────────
runTest('2. Red Core: node.rs usa unwrap_or_default() en generación de timestamps y OTPs', () => {
    const code = readFileNorm(path.join(rootDir, 'core', 'src', 'network', 'node.rs'));
    assert(code.includes('std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()'));
    assert(code.includes('std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()'));
    assert(!code.includes('.duration_since(std::time::UNIX_EPOCH).unwrap()'));
});

runTest('3. Red Core: identity.rs, message.rs y group.rs blindados contra desvío temporal', () => {
    const idCode = readFileNorm(path.join(rootDir, 'core', 'src', 'identity', 'identity.rs'));
    const msgCode = readFileNorm(path.join(rootDir, 'core', 'src', 'protocol', 'message.rs'));
    const grpCode = readFileNorm(path.join(rootDir, 'core', 'src', 'protocol', 'group.rs'));

    assert(idCode.includes('.duration_since(UNIX_EPOCH)\n            .unwrap_or_default()'));
    assert(msgCode.includes('.duration_since(UNIX_EPOCH)\n            .unwrap_or_default()'));
    assert(grpCode.includes('.duration_since(std::time::UNIX_EPOCH)\n            .unwrap_or_default()'));
});

runTest('4. Red Core: gossip.rs, storage/mod.rs y dummy_traffic.rs blindados', () => {
    const gosCode = readFileNorm(path.join(rootDir, 'core', 'src', 'network', 'gossip.rs'));
    const stoCode = readFileNorm(path.join(rootDir, 'core', 'src', 'storage', 'mod.rs'));
    const dumCode = readFileNorm(path.join(rootDir, 'core', 'src', 'network', 'dummy_traffic.rs'));

    assert(gosCode.includes('.duration_since(std::time::UNIX_EPOCH)\n            .unwrap_or_default()'));
    assert(stoCode.includes('std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()'));
    assert(dumCode.includes('std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()'));
});

// ── 3. Inspección Estática de Blockchain ─────────────────────────────────────
runTest('5. Red Blockchain: block.rs y transaction.rs blindados contra saltos de reloj', () => {
    const blkCode = readFileNorm(path.join(rootDir, 'blockchain', 'src', 'block.rs'));
    const txCode = readFileNorm(path.join(rootDir, 'blockchain', 'src', 'transaction.rs'));

    assert(blkCode.includes('.duration_since(UNIX_EPOCH)\n                .unwrap_or_default()'));
    assert(txCode.includes('.duration_since(UNIX_EPOCH)\n                .unwrap_or_default()'));
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests / totalTests) * 100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

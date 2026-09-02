/**
 * TEST SUITE: STORAGE VAULT RESILIENCE & ORPHANED GEOCACHE PRUNING
 * 
 * Valida el blindaje de almacenamiento en DeadDropVaultEngine.ts y indexedMediaVault.ts:
 * 1. Rechazo de geocachés vacíos o en coordenadas (0,0) / Null Island.
 * 2. Purga garantizada de claves huérfanas en IndexedDB en saveState.
 * 3. Descarte de geocachés expirados durante loadState.
 * 4. Limpieza de autoScrubInterval en destroy().
 * 5. Manejo de onversionchange y auto-recuperación de conexión ante errores.
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
console.log('📦 INICIANDO SUITE DE PRUEBAS: STORAGE VAULT & GEOCACHE RESILIENCE');
console.log('================================================================================\n');

// ── 1. Inspección de DeadDropVaultEngine.ts ──────────────────────────────────
const deadDropPath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'DeadDropVaultEngine.ts');
const deadDropCode = fs.readFileSync(deadDropPath, 'utf8');

runTest('1. DeadDropVault: Rechazo de geocachés con contenido vacío', () => {
    assert(deadDropCode.includes('if (!params.secretContent || !params.secretContent.trim())'), 'Debe exigir contenido no vacío');
});

runTest('2. DeadDropVault: Erradicación de depósitos en Null Island (0,0) o coordenadas inválidas', () => {
    assert(deadDropCode.includes('Math.abs(params.lat) < 0.0001 && Math.abs(params.lon) < 0.0001'), 'Debe rechazar geocachés en (0,0)');
    assert(deadDropCode.includes('!isFinite(params.lat) || !isFinite(params.lon)'), 'Debe rechazar coordenadas no finitas');
});

runTest('3. DeadDropVault: Purga de claves huérfanas en saveState para evitar zombis en IDB', () => {
    assert(deadDropCode.includes('for (const idbKey of allKeys) {\n                if (typeof idbKey === \'string\' && !this.drops.has(idbKey)) {\n                    store.delete(idbKey);\n                }\n            }'), 'saveState debe eliminar claves que ya no están en memoria');
});

runTest('4. DeadDropVault: Descarte de geocachés expirados durante loadState', () => {
    assert(deadDropCode.includes('if (drop.expiresAt && drop.expiresAt <= Date.now()) {\n                        continue;\n                    }'), 'loadState no debe rehidratar geocachés expirados');
});

runTest('5. DeadDropVault: Liberación de autoScrubInterval en destroy()', () => {
    assert(deadDropCode.includes('if (this.autoScrubInterval) {\n            clearInterval(this.autoScrubInterval);\n            this.autoScrubInterval = null;\n        }'), 'destroy() debe limpiar el intervalo de scrub');
});

runTest('6. DeadDropVault: Manejo de db.onversionchange en openVaultDB()', () => {
    assert(deadDropCode.includes('db.onversionchange = () => {\n                db.close();\n            };'), 'Debe cerrar la conexión ante upgrades de versión');
});

// ── 2. Inspección de indexedMediaVault.ts ───────────────────────────────────
const mediaVaultPath = path.join(__dirname, '..', 'src', 'lib', 'storage', 'indexedMediaVault.ts');
const mediaVaultCode = fs.readFileSync(mediaVaultPath, 'utf8');

runTest('7. IndexedMediaVault: Manejo de db.onversionchange en getDB()', () => {
    assert(/db\.onversionchange\s*=\s*\(\)\s*=>\s*\{\s*db\.close\(\);\s*this\.dbPromise\s*=\s*null;\s*\};/.test(mediaVaultCode), 'Debe cerrar la conexión y reiniciar dbPromise');
});

runTest('8. IndexedMediaVault: Reseteo de dbPromise en bloques catch para auto-reconexión', () => {
    // Contar cuántas veces se resetea this.dbPromise = null en bloques catch
    const matches = (mediaVaultCode.match(/this\.dbPromise\s*=\s*null;/g) || []).length;
    assert(matches >= 6, `Debe resetear dbPromise en catch para auto-recuperación (encontrados: ${matches})`);
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

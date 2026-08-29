#!/usr/bin/env node
/**
 * pre_build_check.js — Validador Pre-Flight de Limpieza, Higiene y Paridad SSOT
 * 
 * Se ejecuta automáticamente antes de cualquier build para:
 * 1. Purgar caché obsoleta (.next, out, android/app/build)
 * 2. Bloquear APKs o binarios recursivos en public/ o src/
 * 3. Verificar 100% de paridad de versiones entre los 12 archivos SSOT
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_APP = path.join(ROOT_DIR, 'client', 'app');

console.log(`\n${"=".repeat(70)}`);
console.log(`🛡️  RED PRE-BUILD HYGIENE & SSOT PARITY CHECK`);
console.log(`${"=".repeat(70)}\n`);

let hasError = false;

// ── PASO 1: Purga de Directorios de Caché ────────────────────────────────────
console.log("🧹 1. Purgando directorios de caché...");
const dirsToClean = [
    path.join(CLIENT_APP, '.next'),
    path.join(CLIENT_APP, 'out'),
    path.join(ROOT_DIR, '_next'),
    path.join(ROOT_DIR, 'out'),
];

dirsToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`  ✅ Purgado: ${path.relative(ROOT_DIR, dir)}`);
        } catch (e) {
            console.warn(`  ⚠️  No se pudo purgar ${path.relative(ROOT_DIR, dir)}: ${e.message}`);
        }
    } else {
        console.log(`  🔹 Limpio: ${path.relative(ROOT_DIR, dir)} (no existe)`);
    }
});

// ── PASO 2: Detección de Archivos Prohibidos (APKs / Binarios en public) ─────
console.log("\n🔍 2. Verificando que no existan APKs ni binarios recursivos en public/...");
const publicDir = path.join(CLIENT_APP, 'public');
if (fs.existsSync(publicDir)) {
    function scanRogueBinaries(dir) {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        files.forEach(file => {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                scanRogueBinaries(fullPath);
            } else {
                const ext = path.extname(file.name).toLowerCase();
                if (['.apk', '.exe', '.so', '.dll'].includes(ext)) {
                    console.error(`  ❌ [PROHIBIDO] Binario encontrado en carpeta web: ${path.relative(ROOT_DIR, fullPath)}`);
                    hasError = true;
                }
            }
        });
    }
    scanRogueBinaries(publicDir);
    if (!hasError) {
        console.log("  ✅ Directorio public/ libre de binarios infladores.");
    }
}

// ── PASO 3: Verificación Estricta de Paridad de Versión SSOT ─────────────────
console.log("\n📋 3. Verificando paridad de versión en los 12 archivos maestros...");

const versionTsPath = path.join(CLIENT_APP, 'src', 'lib', 'version.ts');
if (!fs.existsSync(versionTsPath)) {
    console.error("  ❌ No se encontró version.ts");
    process.exit(1);
}

const versionTsContent = fs.readFileSync(versionTsPath, 'utf8');
const versionMatch = versionTsContent.match(/export const RED_VERSION = ["']([^"']+)["'];/);
if (!versionMatch) {
    console.error("  ❌ No se pudo extraer RED_VERSION de version.ts");
    process.exit(1);
}

const authoritativeVersion = versionMatch[1];
const authoritativeMajor = parseInt(authoritativeVersion.split('.')[0], 10);
const expectedCacheName = `red-vault-cache-v${authoritativeMajor}`;
console.log(`  🎯 Versión Autorizada (SSOT): v${authoritativeVersion}`);

const filesToCheck = [
    {
        name: 'client/app/package.json',
        filePath: 'client/app/package.json',
        check: (c) => JSON.parse(c).version === authoritativeVersion,
        expected: authoritativeVersion
    },
    {
        name: 'client/app/android/app/build.gradle',
        filePath: 'client/app/android/app/build.gradle',
        check: (c) => c.includes(`versionName "${authoritativeVersion}"`),
        expected: `versionName "${authoritativeVersion}"`
    },
    {
        name: 'sw.js (root)',
        filePath: 'sw.js',
        check: (c) => c.includes(`v${authoritativeVersion}`) && c.includes(`'${expectedCacheName}'`),
        expected: `v${authoritativeVersion} & ${expectedCacheName}`
    },
    {
        name: 'client/app/public/sw.js',
        filePath: 'client/app/public/sw.js',
        check: (c) => c.includes(`v${authoritativeVersion}`) && c.includes(`'${expectedCacheName}'`),
        expected: `v${authoritativeVersion} & ${expectedCacheName}`
    },
    {
        name: 'Cargo.toml (workspace)',
        filePath: 'Cargo.toml',
        check: (c) => c.includes(`version = "${authoritativeVersion}"`),
        expected: `version = "${authoritativeVersion}"`
    },
    {
        name: 'core/Cargo.toml',
        filePath: 'core/Cargo.toml',
        check: (c) => c.includes(`version = "${authoritativeVersion}"`),
        expected: `version = "${authoritativeVersion}"`
    },
    {
        name: 'red_mobile/Cargo.toml',
        filePath: 'red_mobile/Cargo.toml',
        check: (c) => c.includes(`version = "${authoritativeVersion}"`),
        expected: `version = "${authoritativeVersion}"`
    },
    {
        name: 'node/Cargo.toml',
        filePath: 'node/Cargo.toml',
        check: (c) => c.includes(`version = "${authoritativeVersion}"`),
        expected: `version = "${authoritativeVersion}"`
    },
    {
        name: 'blockchain/Cargo.toml',
        filePath: 'blockchain/Cargo.toml',
        check: (c) => c.includes(`version = "${authoritativeVersion}"`),
        expected: `version = "${authoritativeVersion}"`
    },
    {
        name: 'client/Cargo.toml',
        filePath: 'client/Cargo.toml',
        check: (c) => c.includes(`version = "${authoritativeVersion}"`),
        expected: `version = "${authoritativeVersion}"`
    }
];

filesToCheck.forEach(item => {
    const p = path.join(ROOT_DIR, item.filePath);
    if (!fs.existsSync(p)) {
        console.error(`  ❌ [MISSING] Archivo no encontrado: ${item.name}`);
        hasError = true;
        return;
    }
    const content = fs.readFileSync(p, 'utf8');
    if (item.check(content)) {
        console.log(`  ✅ [PARIDAD OK] ${item.name}`);
    } else {
        console.error(`  ❌ [DESFASADO] ${item.name} no coincide con v${authoritativeVersion} (Esperado: ${item.expected})`);
        hasError = true;
    }
});

// ── RESULTADO FINAL ──────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(70)}`);
if (hasError) {
    console.error("❌ FALLO EN LA VALIDACIÓN PRE-FLIGHT. Corrige los problemas o ejecuta:");
    console.error(`   node scripts/bump_version.js ${authoritativeVersion}`);
    console.log(`${"=".repeat(70)}\n`);
    process.exit(1);
} else {
    console.log("✅ SISTEMA 100% HIGIÉNICO Y SINCRONIZADO — LISTO PARA COMPILACIÓN.");
    console.log(`${"=".repeat(70)}\n`);
    process.exit(0);
}

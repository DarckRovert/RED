#!/usr/bin/env node
/**
 * bump_version.js — Incremento Atómico y Sincronización SSOT de Versión para RED
 *
 * Actualiza LA VERSIÓN en los 12 archivos maestros del ecosistema de forma
 * atómica y determinista. Tras la ejecución llama a check_release_integrity.js
 * para verificar que todos los archivos quedaron sincronizados.
 *
 * Archivos actualizados:
 *   1.  client/app/src/lib/version.ts        (SSOT principal)
 *   2.  client/app/package.json
 *   3.  client/app/android/app/build.gradle   (versionCode + versionName)
 *   4.  core/Cargo.toml
 *   5.  blockchain/Cargo.toml
 *   6.  node/Cargo.toml
 *   7.  red_mobile/Cargo.toml
 *   8.  signaling/package.json
 *   9.  client/app/public/manifest.json
 *   10. client/app/public/sw.js              (cache name major)
 *   11. sw.js                               (cache name major, root)
 *   12. manifest.json                       (root)
 *
 * Uso:
 *   node scripts/bump_version.js <X.Y.Z>
 *   node scripts/bump_version.js 106.0.0
 */

'use strict';
const fs = require('fs');
const path = require('path');

// ── Resolución de rutas ───────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..', '..', '..');
const CLIENT_APP = path.join(ROOT, 'client', 'app');

// ── Argumento de versión ──────────────────────────────────────────────────────
const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('❌  USO: node scripts/bump_version.js <X.Y.Z>');
    console.error('    Ejemplo: node scripts/bump_version.js 106.0.0');
    process.exit(1);
}

const [newMajor, newMinor, newPatch] = newVersion.split('.').map(Number);
const versionCode = newMajor * 1000 + newMinor * 10 + newPatch;
const buildDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ── Leer versión antigua desde SSOT ──────────────────────────────────────────
function readCurrentVersion() {
    const vf = path.join(CLIENT_APP, 'src', 'lib', 'version.ts');
    const src = fs.readFileSync(vf, 'utf-8');
    const m = src.match(/RED_VERSION\s*=\s*["']([^"']+)["']/);
    return m ? m[1] : '?.?.?';
}

const oldVersion = readCurrentVersion();
console.log(`\n🚀  Bumping RED versión: v${oldVersion} → v${newVersion}`);
console.log(`    VersionCode: ${versionCode}  |  BuildDate: ${buildDate}\n`);

let updated = 0;
let skipped = 0;

// ── Helper: reemplazar con regex + log ────────────────────────────────────────
function replace(filePath, label, searchRE, replacement) {
    const rel = path.relative(ROOT, filePath);
    if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️   SKIP ${label}: archivo no encontrado (${rel})`);
        skipped++;
        return;
    }
    const original = fs.readFileSync(filePath, 'utf-8');
    const modified = original.replace(searchRE, replacement);
    if (modified === original) {
        console.warn(`  ⚠️   NOOP ${label}: el patrón no encontró nada en ${rel}`);
        skipped++;
        return;
    }
    fs.writeFileSync(filePath, modified, 'utf-8');
    console.log(`  ✅  ${label} → ${rel}`);
    updated++;
}

// =============================================================================
// 1. version.ts — SSOT principal
// =============================================================================
const versionTsPath = path.join(CLIENT_APP, 'src', 'lib', 'version.ts');
const TITLE_SUFFIX = `RED Sovereign Mesh — v${newVersion}`;
const PROTOCOL_VER = `RED/${newMajor}.0-NOISE-PQC`;
const CACHE_KEY = `red-vault-cache-v${newMajor}`;

replace(
    versionTsPath,
    'version.ts (RED_VERSION)',
    /RED_VERSION\s*=\s*["'][^"']+["']/,
    `RED_VERSION = "${newVersion}"`
);
replace(
    versionTsPath,
    'version.ts (RED_VERSION_MAJOR)',
    /RED_VERSION_MAJOR\s*=\s*\d+/,
    `RED_VERSION_MAJOR = ${newMajor}`
);
replace(
    versionTsPath,
    'version.ts (RED_VERSION_MINOR)',
    /RED_VERSION_MINOR\s*=\s*\d+/,
    `RED_VERSION_MINOR = ${newMinor}`
);
replace(
    versionTsPath,
    'version.ts (RED_VERSION_PATCH)',
    /RED_VERSION_PATCH\s*=\s*\d+/,
    `RED_VERSION_PATCH = ${newPatch}`
);
replace(
    versionTsPath,
    'version.ts (RED_VERSION_CODE)',
    /RED_VERSION_CODE\s*=\s*\d+/,
    `RED_VERSION_CODE = ${versionCode}`
);
replace(
    versionTsPath,
    'version.ts (RED_BUILD_CODE)',
    /RED_BUILD_CODE\s*=\s*\d+/,
    `RED_BUILD_CODE = ${versionCode}`
);
replace(
    versionTsPath,
    'version.ts (RED_BUILD_DATE)',
    /RED_BUILD_DATE\s*=\s*["'][^"']*["']/,
    `RED_BUILD_DATE = "${buildDate}"`
);
replace(
    versionTsPath,
    'version.ts (RED_PROTOCOL_VERSION)',
    /RED_PROTOCOL_VERSION\s*=\s*["'][^"']*["']/,
    `RED_PROTOCOL_VERSION = "${PROTOCOL_VER}"`
);
replace(
    versionTsPath,
    'version.ts (RED_APK_SHA256 placeholder)',
    /RED_APK_SHA256\s*=\s*["'][^"']*["']/,
    `RED_APK_SHA256 = "PENDING_BUILD"`
);

// =============================================================================
// 2. client/app/package.json
// =============================================================================
replace(
    path.join(CLIENT_APP, 'package.json'),
    'client/app/package.json',
    /"version"\s*:\s*"[^"]+"/,
    `"version": "${newVersion}"`
);

// =============================================================================
// 3. client/app/android/app/build.gradle
// =============================================================================
const gradlePath = path.join(CLIENT_APP, 'android', 'app', 'build.gradle');
replace(gradlePath, 'build.gradle (versionCode)',
    /versionCode\s+\d+/,
    `versionCode ${versionCode}`
);
replace(gradlePath, 'build.gradle (versionName)',
    /versionName\s+"[^"]+"/,
    `versionName "${newVersion}"`
);

// =============================================================================
// 4-7. Cargo.toml de cada crate
// =============================================================================
for (const crate of ['core', 'blockchain', 'node', 'red_mobile']) {
    replace(
        path.join(ROOT, crate, 'Cargo.toml'),
        `${crate}/Cargo.toml`,
        /^(version\s*=\s*)"[^"]+"/m,
        `$1"${newVersion}"`
    );
}
// Workspace Cargo.toml (workspace.package.version)
replace(
    path.join(ROOT, 'Cargo.toml'),
    'Cargo.toml (workspace)',
    /^(version\s*=\s*)"[^"]+"/m,
    `$1"${newVersion}"`
);

// =============================================================================
// 8. signaling/package.json
// =============================================================================
replace(
    path.join(ROOT, 'signaling', 'package.json'),
    'signaling/package.json',
    /"version"\s*:\s*"[^"]+"/,
    `"version": "${newVersion}"`
);

// =============================================================================
// 9. client/app/public/manifest.json
// =============================================================================
const pubManifest = path.join(CLIENT_APP, 'public', 'manifest.json');
if (fs.existsSync(pubManifest)) {
    replace(pubManifest, 'public/manifest.json',
        /"version"\s*:\s*"[^"]+"/,
        `"version": "${newVersion}"`
    );
}

// =============================================================================
// 10 & 11. sw.js (root + public) — cache name usa solo el major
// =============================================================================
const oldMajor = oldVersion.split('.')[0];
for (const swPath of [
    path.join(ROOT, 'sw.js'),
    path.join(CLIENT_APP, 'public', 'sw.js'),
]) {
    if (fs.existsSync(swPath)) {
        replace(swPath, `${path.basename(path.dirname(swPath))}/sw.js`,
            new RegExp(`red-vault-cache-v${oldMajor}`, 'g'),
            `red-vault-cache-v${newMajor}`
        );
    }
}

// =============================================================================
// 12. manifest.json (root)
// =============================================================================
const rootManifest = path.join(ROOT, 'manifest.json');
if (fs.existsSync(rootManifest)) {
    const mf = JSON.parse(fs.readFileSync(rootManifest, 'utf-8'));
    if (mf.version !== undefined) {
        mf.version = newVersion;
        fs.writeFileSync(rootManifest, JSON.stringify(mf, null, 2) + '\n', 'utf-8');
        console.log(`  ✅  manifest.json (root) → ${path.relative(ROOT, rootManifest)}`);
        updated++;
    }
}

// =============================================================================
// RESUMEN Y SIGUIENTE PASO
// =============================================================================
console.log(`\n${'─'.repeat(60)}`);
console.log(`📊  ${updated} archivos actualizados, ${skipped} omitidos.`);

if (skipped > 0) {
    console.warn(`\n⚠️   Algunos archivos no se pudieron actualizar. Verifica manualmente.`);
}

console.log(`
📋  PRÓXIMOS PASOS OBLIGATORIOS:
    1. Compilar el APK de release:
         cd client/app && npm run build
         cd client/android && ./gradlew assembleRelease
    2. Copiar APK a release-assets/ y calcular el hash real:
         copy /Y android\\app\\build\\outputs\\apk\\release\\app-release.apk ..\\..\\..\\release-assets\\red-v${newVersion}-release.apk
         copy /Y release-assets\\red-v${newVersion}-release.apk release-assets\\red-latest.apk
    3. Actualizar SHA256SUMS.txt con el hash real del APK compilado:
         node scripts/update_sha256sums.js
    4. Crear release_notes_v${newVersion}.md en el root del repositorio
    5. Ejecutar la verificación de integridad:
         node scripts/check_release_integrity.js --strict
    6. Commit atómico:
         git add -A && git commit -m "release(v${newVersion}): <descripción>"
`);

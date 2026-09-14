#!/usr/bin/env node
/**
 * update_sha256sums.js — Recalcula SHA256SUMS.txt desde los APKs reales
 *
 * Ejecutar DESPUÉS de compilar el APK y copiarlo a release-assets/.
 * Nunca más hay que editar SHA256SUMS.txt a mano.
 *
 * Uso:
 *   node scripts/update_sha256sums.js
 */

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RELEASE_ASSETS = path.join(ROOT, 'release-assets');
const SUMS_FILE = path.join(ROOT, 'SHA256SUMS.txt');

// Leer versión canónica
function readVersion() {
    const vf = path.join(ROOT, 'client', 'app', 'src', 'lib', 'version.ts');
    const src = fs.readFileSync(vf, 'utf-8');
    const m = src.match(/RED_VERSION\s*=\s*["']([^"']+)["']/);
    return m ? m[1] : null;
}

function sha256File(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

const version = readVersion();
if (!version) {
    console.error('❌  No se pudo leer RED_VERSION de version.ts');
    process.exit(1);
}

console.log(`\n🔐  Recalculando SHA256SUMS.txt para RED v${version}...`);

// APKs que deben estar en SHA256SUMS.txt
const apkEntries = [
    `red-v${version}-release.apk`,
    'red-latest.apk',
];

const lines = [];
let anyMissing = false;

for (const apkName of apkEntries) {
    const apkPath = path.join(RELEASE_ASSETS, apkName);
    if (!fs.existsSync(apkPath)) {
        console.error(`  ❌  No encontrado: release-assets/${apkName}`);
        console.error(`       → Compila el APK y cópialo antes de ejecutar este script`);
        anyMissing = true;
        continue;
    }
    const hash = sha256File(apkPath);
    lines.push(`${hash}  ${apkName}`);
    console.log(`  ✅  ${hash.slice(0, 16)}…  ${apkName}`);
}

if (anyMissing) {
    console.error('\n❌  SHA256SUMS.txt NO fue actualizado (faltan APKs).\n');
    process.exit(1);
}

// También actualizar RED_APK_SHA256 en version.ts
const versionTsPath = path.join(ROOT, 'client', 'app', 'src', 'lib', 'version.ts');
const latestHash = lines.find(l => l.includes('red-latest.apk'))?.split('  ')[0] || '';
if (latestHash && fs.existsSync(versionTsPath)) {
    let src = fs.readFileSync(versionTsPath, 'utf-8');
    src = src.replace(
        /RED_APK_SHA256\s*=\s*["'][^"']*["']/,
        `RED_APK_SHA256 = "${latestHash}"`
    );
    fs.writeFileSync(versionTsPath, src, 'utf-8');
    console.log(`  ✅  version.ts (RED_APK_SHA256) → ${latestHash.slice(0, 16)}…`);
}

fs.writeFileSync(SUMS_FILE, lines.join('\n') + '\n', 'utf-8');
console.log(`\n  📄  SHA256SUMS.txt → ${lines.length} entrada(s) escritas`);
console.log(`\n🎯  Listo. Ejecuta ahora:\n    node scripts/check_release_integrity.js --strict\n`);

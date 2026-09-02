#!/usr/bin/env node
/**
 * bump_version.js — Script Atómico Unificado de Gobernanza de Versiones RED
 * 
 * Sincroniza atómicamente el número de versión y versionCode en todos los archivos
 * del repositorio para garantizar 100% de paridad SSOT (Single Source of Truth).
 * 
 * Uso:
 *   node scripts/bump_version.js <version> [release_name]
 *   Ejemplo: node scripts/bump_version.js 66.0.0 "Sovereign App Store & Hyper-Browser Edition"
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Obtener versión objetivo de los argumentos o de client/app/src/lib/version.ts
let targetVersion = process.argv[2];
let releaseName = process.argv[3] || "Sovereign App Store & Hyper-Browser Edition";

if (!targetVersion) {
    // Si no se especifica, leer de version.ts
    const versionTsPath = path.join(ROOT_DIR, 'client/app/src/lib/version.ts');
    if (fs.existsSync(versionTsPath)) {
        const content = fs.readFileSync(versionTsPath, 'utf8');
        const match = content.match(/RED_VERSION\s*=\s*["']([^"']+)["']/);
        if (match) {
            targetVersion = match[1];
        }
    }
}

if (!targetVersion || !/^\d+\.\d+\.\d+$/.test(targetVersion)) {
    console.error("❌ Error: Debes especificar una versión válida en formato SemVer (ej. 66.0.0)");
    console.error("   Uso: node scripts/bump_version.js <X.Y.Z> [release_name]");
    process.exit(1);
}

const [majorStr, minorStr, patchStr] = targetVersion.split('.');
const major = parseInt(majorStr, 10);
const minor = parseInt(minorStr, 10);
const patch = parseInt(patchStr, 10);
const versionCode = major * 1000 + minor * 100 + patch;
const today = new Date().toISOString().split('T')[0];
const cacheName = `red-vault-cache-v${major}`;

console.log(`\n${"=".repeat(70)}`);
console.log(`🛡️  RED VERSION GOVERNANCE — ACTUALIZACIÓN ATÓMICA DE VERSIÓN`);
console.log(`${"=".repeat(70)}`);
console.log(`🎯 Versión Objetivo:  ${targetVersion}`);
console.log(`🔢 Version Code:      ${versionCode}`);
console.log(`📦 Cache Name (SW):   ${cacheName}`);
console.log(`📅 Fecha de Build:    ${today}`);
console.log(`🏷️  Release Tag:       v${targetVersion}\n`);

const results = [];

function updateFile(filePath, updaterFn, description) {
    const fullPath = path.join(ROOT_DIR, filePath);
    if (!fs.existsSync(fullPath)) {
        results.push({ file: filePath, status: 'SKIP (No encontrado)', success: false });
        return;
    }

    try {
        const originalContent = fs.readFileSync(fullPath, 'utf8');
        const updatedContent = updaterFn(originalContent);
        if (originalContent !== updatedContent) {
            fs.writeFileSync(fullPath, updatedContent, 'utf8');
            results.push({ file: filePath, status: 'UPDATED', success: true, description });
        } else {
            results.push({ file: filePath, status: 'PARITY (Sin cambios necesarios)', success: true, description });
        }
    } catch (err) {
        results.push({ file: filePath, status: `ERROR: ${err.message}`, success: false });
    }
}

// 1. client/app/src/lib/version.ts
updateFile('client/app/src/lib/version.ts', () => {
    return `/**
 * RED Sovereign Mesh — Single Source of Truth for System Version
 * Version: ${targetVersion} RED Sovereign Mesh — ${releaseName}
 */

export const RED_VERSION = "${targetVersion}";
export const RED_VERSION_MAJOR = ${major};
export const RED_VERSION_MINOR = ${minor};
export const RED_VERSION_PATCH = ${patch};
export const RED_VERSION_CODE = ${versionCode};
export const RED_BUILD_CODE = ${versionCode};
export const RED_VERSION_NAME = "RED v${targetVersion} Sovereign Mesh — ${releaseName}";
export const RED_BUILD_DATE = "${today}";
export const RED_PROTOCOL_VERSION = "RED/${major}.${minor}-NOISE-PQC";
export const RED_RELEASE_CHANNEL = "stable-p2p";
export const RED_APK_NAME = "red-latest.apk";
export const RED_APK_CANONICAL = "red-latest.apk";
export const RED_APK_SHA256 = "DAC30005D02A01752A10D59E3F6DD21345CAE0AE85307FF91B5D5DA68475A515";
`;
}, 'Constantes TypeScript');

// 2. client/app/package.json
updateFile('client/app/package.json', (content) => {
    const pkg = JSON.parse(content);
    pkg.version = targetVersion;
    return JSON.stringify(pkg, null, 2) + '\n';
}, 'NPM Package Manifest');

// 3. client/app/package-lock.json
updateFile('client/app/package-lock.json', (content) => {
    try {
        const lock = JSON.parse(content);
        lock.version = targetVersion;
        if (lock.packages && lock.packages['']) {
            lock.packages[''].version = targetVersion;
        }
        return JSON.stringify(lock, null, 2) + '\n';
    } catch {
        return content;
    }
}, 'NPM Lockfile');

// 4. client/app/android/app/build.gradle
updateFile('client/app/android/app/build.gradle', (content) => {
    let updated = content.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
    updated = updated.replace(/versionName\s+["'][^"']+["']/, `versionName "${targetVersion}"`);
    return updated;
}, 'Android Gradle Build');

// 5. Root sw.js
updateFile('sw.js', (content) => {
    let updated = content.replace(/\/\/ RED Service Worker v\d+\.\d+\.\d+/, `// RED Service Worker v${targetVersion}`);
    updated = updated.replace(/const CACHE_NAME = ['"]red-vault-cache-v\d+['"];/, `const CACHE_NAME = '${cacheName}';`);
    return updated;
}, 'Service Worker Root PWA');

// 6. client/app/public/sw.js
updateFile('client/app/public/sw.js', (content) => {
    let updated = content.replace(/\/\/ RED Service Worker v\d+\.\d+\.\d+/, `// RED Service Worker v${targetVersion}`);
    updated = updated.replace(/const CACHE_NAME = ['"]red-vault-cache-v\d+['"];/, `const CACHE_NAME = '${cacheName}';`);
    return updated;
}, 'Service Worker Public PWA');

// 7. Root Workspace Cargo.toml
updateFile('Cargo.toml', (content) => {
    return content.replace(/\[workspace\.package\][\s\S]*?version\s*=\s*"[^"]+"/, (match) => {
        return match.replace(/version\s*=\s*"[^"]+"/, `version = "${targetVersion}"`);
    });
}, 'Rust Workspace Root');

// 8. core/Cargo.toml
updateFile('core/Cargo.toml', (content) => {
    return content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
}, 'Rust red_core Crate');

// 9. red_mobile/Cargo.toml
updateFile('red_mobile/Cargo.toml', (content) => {
    return content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
}, 'Rust red_mobile JNI Crate');

// 10. node/Cargo.toml
updateFile('node/Cargo.toml', (content) => {
    return content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
}, 'Rust red-node CLI Crate');

// 11. blockchain/Cargo.toml
updateFile('blockchain/Cargo.toml', (content) => {
    return content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
}, 'Rust red_blockchain Crate');

// 12. client/Cargo.toml
updateFile('client/Cargo.toml', (content) => {
    return content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${targetVersion}"`);
}, 'Rust client Crate');

// 12.1 Cargo.lock (Workspace Packages Synchronization)
updateFile('Cargo.lock', (content) => {
    const localCrates = ['red-blockchain', 'red_core', 'red_mobile', 'red_node'];
    let updated = content;
    localCrates.forEach(crateName => {
        const crateRegex = new RegExp(`(name = "${crateName}"[\\r\\n]+version = ")[^"]+(")`);
        updated = updated.replace(crateRegex, `$1${targetVersion}$2`);
    });
    return updated;
}, 'Rust Workspace Cargo.lock');

// 13. README.md
updateFile('README.md', (content) => {
    let updated = content.replace(/# 🛡️ RED — Sovereign Mesh OS v\d+\.\d+\.\d+/, `# 🛡️ RED — Sovereign Mesh OS v${targetVersion}`);
    updated = updated.replace(/badge\/Descargar_APK_v\d+\.\d+\.\d+-/g, `badge/Descargar_APK_v${targetVersion}-`);
    updated = updated.replace(/\/releases\/tag\/v\d+\.\d+\.\d+/g, `/releases/tag/v${targetVersion}`);
    updated = updated.replace(/RED v\d+\.\d+\.\d+/g, `RED v${targetVersion}`);
    return updated;
}, 'README Documentación Principal');

// 14. GOVERNANCE.md
updateFile('GOVERNANCE.md', (content) => {
    return content.replace(/# 🤖 RULESET AUTÓMATA RED v\d+\.\d+\.\d+/, `# 🤖 RULESET AUTÓMATA RED v${targetVersion}`);
}, 'Reglas de Gobernanza');

// 15. .agents/rules/governance.md
updateFile('.agents/rules/governance.md', (content) => {
    return content.replace(/# GOBERNANZA AUTOMÁTICA Y ESTÁNDARES RED v\d+\.\d+\.\d+/, `# GOBERNANZA AUTOMÁTICA Y ESTÁNDARES RED v${targetVersion}`);
}, 'Reglas de Gobernanza Local Agent');

// 16. USER_MANUAL.md
updateFile('USER_MANUAL.md', (content) => {
    return content.replace(/# 📘 Manual Operativo del Usuario — RED v\d+\.\d+\.\d+/, `# 📘 Manual Operativo del Usuario — RED v${targetVersion}`);
}, 'Manual Operativo de Usuario');

// 17. ARCHITECTURE.md
updateFile('ARCHITECTURE.md', (content) => {
    return content.replace(/# 🏛️ RED OS v\d+\.\d+\.\d+/, `# 🏛️ RED OS v${targetVersion}`);
}, 'Arquitectura Técnica');

// Imprimir Reporte de Resultados
console.log("📋 REPORTE DE ACTUALIZACIÓN DE ARCHIVOS:");
let hasErrors = false;
results.forEach(res => {
    const icon = res.success ? (res.status === 'UPDATED' ? '✅' : '🔹') : '❌';
    console.log(`  ${icon} [${res.status}] ${res.file} ${res.description ? '(' + res.description + ')' : ''}`);
    if (!res.success) hasErrors = true;
});

if (hasErrors) {
    console.error("\n❌ Se produjeron errores durante la actualización de versión.");
    process.exit(1);
} else {
    console.log(`\n✨ Gobernanza de versión v${targetVersion} aplicada exitosamente en ${results.length} archivos.`);
}

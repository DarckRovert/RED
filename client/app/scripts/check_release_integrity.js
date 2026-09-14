#!/usr/bin/env node
/**
 * check_release_integrity.js — Guardián de Integridad de Release para RED
 *
 * Detecta automáticamente la clase exacta de problemas encontrados en la
 * auditoría manual de v105.0.0 y evita que vuelvan a llegar a un commit.
 *
 * Verificaciones:
 *   [1] SHA256SUMS.txt apunta al APK de la versión correcta con el hash real
 *   [2] No hay versiones hardcodeadas en scripts de auditoría (violación SSOT)
 *   [3] release_notes_vX.Y.Z.md existe en el root para la versión actual
 *   [4] Todos los archivos maestros SSOT tienen la misma versión
 *   [5] Los archivos generados por scripts no están rastreados en git
 *
 * Uso:
 *   node scripts/check_release_integrity.js           # modo reporte
 *   node scripts/check_release_integrity.js --strict  # exit 1 si hay errores
 */

'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Configuración de rutas (relativa al root del repo) ────────────────────────
const ROOT = path.resolve(__dirname, '..', '..', '..');  // d:/PROYECTO RED
const CLIENT_APP = path.join(ROOT, 'client', 'app');
const RELEASE_ASSETS = path.join(ROOT, 'release-assets');

const STRICT = process.argv.includes('--strict');

let errors = 0;
let warnings = 0;
let passed = 0;

function pass(msg) { console.log(`  ✅  ${msg}`); passed++; }
function fail(msg) { console.error(`  ❌  ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠️   ${msg}`); warnings++; }
function header(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 65 - t.length))}`); }

// ── Leer la versión canónica desde SSOT ───────────────────────────────────────
function readCanonicalVersion() {
    const vf = path.join(CLIENT_APP, 'src', 'lib', 'version.ts');
    if (!fs.existsSync(vf)) return null;
    const src = fs.readFileSync(vf, 'utf-8');
    const m = src.match(/RED_VERSION\s*=\s*["']([^"']+)["']/);
    return m ? m[1] : null;
}

// ── Computar SHA-256 de un fichero ────────────────────────────────────────────
function sha256File(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

// ── Parsear SHA256SUMS.txt ─────────────────────────────────────────────────────
function parseSHA256Sums(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const map = {};
    for (const line of fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
        const m = line.trim().match(/^([0-9a-fA-F]{64})\s+(.+)$/);
        if (m) map[m[2].trim()] = m[1].toUpperCase();
    }
    return map;
}

// =============================================================================
// [1] VERIFICACIÓN: SHA256SUMS.txt coincide con los APKs físicos reales
// =============================================================================
function checkSHA256Sums(version) {
    header('CHECK 1 — SHA256SUMS.txt vs APKs reales');

    const sumsFile = path.join(ROOT, 'SHA256SUMS.txt');
    if (!fs.existsSync(sumsFile)) {
        fail('SHA256SUMS.txt no existe en el root del repositorio');
        return;
    }

    const declared = parseSHA256Sums(sumsFile);
    if (Object.keys(declared).length === 0) {
        fail('SHA256SUMS.txt existe pero está vacío o mal formateado');
        return;
    }

    // El APK canónico de la versión actual debe estar declarado
    const expectedApkName = `red-v${version}-release.apk`;
    const latestApkName = 'red-latest.apk';

    const apksToCheck = [
        { declared: expectedApkName, physical: expectedApkName },
        { declared: latestApkName, physical: latestApkName },
    ];

    let allOk = true;
    for (const { declared: declName, physical: physName } of apksToCheck) {
        const declaredHash = declared[declName];
        if (!declaredHash) {
            fail(`SHA256SUMS.txt no declara hash para "${declName}"`);
            allOk = false;
            continue;
        }

        const physPath = path.join(RELEASE_ASSETS, physName);
        if (!fs.existsSync(physPath)) {
            warn(`APK físico no encontrado en release-assets/${physName} (¿pendiente de compilar?)`);
            continue;
        }

        const realHash = sha256File(physPath);
        if (realHash !== declaredHash) {
            fail(
                `Hash INCORRECTO para "${physName}":\n` +
                `       declarado: ${declaredHash}\n` +
                `       real:      ${realHash}`
            );
            allOk = false;
        } else {
            pass(`${physName} → ${realHash.slice(0, 16)}… ✓`);
        }
    }

    // Verificar que no queden entradas de versiones viejas en SHA256SUMS.txt
    for (const name of Object.keys(declared)) {
        if (name !== latestApkName && name !== expectedApkName) {
            const versionMatch = name.match(/red-v(\d+\.\d+\.\d+)-release\.apk/);
            if (versionMatch && versionMatch[1] !== version) {
                fail(`SHA256SUMS.txt tiene entrada de versión antigua: "${name}" (actual: ${version})`);
                allOk = false;
            }
        }
    }

    if (allOk) pass('SHA256SUMS.txt completamente sincronizado con APKs reales');
}

// =============================================================================
// [2] VERIFICACIÓN: Ningún script tiene versión hardcodeada (violación SSOT)
// =============================================================================
function checkHardcodedVersions(version) {
    header('CHECK 2 — Sin versiones hardcodeadas en scripts');

    const scriptsDir = path.join(CLIENT_APP, 'scripts');
    if (!fs.existsSync(scriptsDir)) { warn('Directorio scripts/ no encontrado'); return; }

    // Versiones que NO deberían aparecer como literales en scripts
    // (la versión ACTUAL sí puede aparecer si es intencional, solo buscamos versiones VIEJAS)
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));

    const OLD_VERSION_RE = /v(\d+)\.(\d+)\.(\d+)/g;
    const [curMajor, curMinor, curPatch] = version.split('.').map(Number);

    let found = false;
    for (const file of files) {
        const src = fs.readFileSync(path.join(scriptsDir, file), 'utf-8');
        let m;
        OLD_VERSION_RE.lastIndex = 0;
        while ((m = OLD_VERSION_RE.exec(src)) !== null) {
            const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
            // Ignorar la versión actual, solo alertar sobre versiones definitivamente antiguas
            if (maj < curMajor || (maj === curMajor && min < curMinor) || (maj === curMajor && min === curMinor && pat < curPatch)) {
                // Excluir contextos donde la versión es parte de un comentario de historial
                const lineStart = src.lastIndexOf('\n', m.index) + 1;
                const lineEnd = src.indexOf('\n', m.index);
                const line = src.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
                if (!line.startsWith('//') && !line.startsWith('*') && !line.startsWith('#')) {
                    fail(`${file}: versión hardcodeada obsoleta "${m[0]}" en código activo (línea: "${line.slice(0, 80)}")`);
                    found = true;
                }
            }
        }
    }
    if (!found) pass('Ningún script tiene versiones hardcodeadas obsoletas en código activo');
}

// =============================================================================
// [3] VERIFICACIÓN: release_notes_vX.Y.Z.md existe en el root del repo
// =============================================================================
function checkReleaseNotes(version) {
    header('CHECK 3 — release_notes_vX.Y.Z.md existe en root del repo');

    const expectedFile = path.join(ROOT, `release_notes_v${version}.md`);
    if (!fs.existsSync(expectedFile)) {
        fail(`Falta release_notes_v${version}.md en la raíz del repositorio`);
        fail('  → Crear el archivo con las notas de la versión antes de hacer el release');
    } else {
        const size = fs.statSync(expectedFile).size;
        if (size < 200) {
            warn(`release_notes_v${version}.md existe pero parece demasiado corto (${size} bytes). ¿Está completo?`);
        } else {
            pass(`release_notes_v${version}.md presente (${(size / 1024).toFixed(1)} KB)`);
        }
    }
}

// =============================================================================
// [4] VERIFICACIÓN: Todos los archivos maestros SSOT tienen la misma versión
// =============================================================================
function checkSSotVersionParity(version) {
    header('CHECK 4 — Paridad de versión en archivos SSOT');

    const checks = [
        {
            label: 'version.ts (SSOT principal)',
            path: path.join(CLIENT_APP, 'src', 'lib', 'version.ts'),
            regex: /RED_VERSION\s*=\s*["']([^"']+)["']/,
        },
        {
            label: 'client/app/package.json',
            path: path.join(CLIENT_APP, 'package.json'),
            regex: /"version"\s*:\s*"([^"]+)"/,
        },
        {
            label: 'client/app/android/app/build.gradle (versionName)',
            path: path.join(CLIENT_APP, 'android', 'app', 'build.gradle'),
            regex: /versionName\s+"([^"]+)"/,
        },
        {
            label: 'sw.js (root, cache name)',
            path: path.join(ROOT, 'sw.js'),
            regex: /red-vault-cache-v(\d+)/,
            transform: (m) => { const major = version.split('.')[0]; return m === major ? version : m; },
            compareWith: (found) => found === version.split('.')[0],
            display: (found) => `major=${found} (cache versioning uses major only)`,
        },
        {
            label: 'Cargo.toml (workspace root)',
            path: path.join(ROOT, 'Cargo.toml'),
            regex: /^version\s*=\s*"([^"]+)"/m,
        },
        {
            label: 'core/Cargo.toml',
            path: path.join(ROOT, 'core', 'Cargo.toml'),
            regex: /^version\s*=\s*"([^"]+)"/m,
        },
        {
            label: 'node/Cargo.toml',
            path: path.join(ROOT, 'node', 'Cargo.toml'),
            regex: /^version\s*=\s*"([^"]+)"/m,
        },
        {
            label: 'blockchain/Cargo.toml',
            path: path.join(ROOT, 'blockchain', 'Cargo.toml'),
            regex: /^version\s*=\s*"([^"]+)"/m,
        },
        {
            label: 'red_mobile/Cargo.toml',
            path: path.join(ROOT, 'red_mobile', 'Cargo.toml'),
            regex: /^version\s*=\s*"([^"]+)"/m,
        },
        {
            label: 'signaling/package.json',
            path: path.join(ROOT, 'signaling', 'package.json'),
            regex: /"version"\s*:\s*"([^"]+)"/,
        },
    ];

    for (const check of checks) {
        if (!fs.existsSync(check.path)) {
            warn(`${check.label}: archivo no encontrado (${check.path})`);
            continue;
        }
        const src = fs.readFileSync(check.path, 'utf-8');
        const m = src.match(check.regex);
        if (!m) {
            fail(`${check.label}: no se encontró patrón de versión en el archivo`);
            continue;
        }
        const found = m[1];
        const isOk = check.compareWith ? check.compareWith(found) : found === version;
        const display = check.display ? check.display(found) : found;
        if (!isOk) {
            fail(`${check.label}: versión "${display}" ≠ esperada "${version}"`);
        } else {
            pass(`${check.label}: ${display}`);
        }
    }
}

// =============================================================================
// [5] VERIFICACIÓN: Archivos generados no rastreados (git status limpio)
// =============================================================================
function checkGeneratedFilesNotTracked() {
    header('CHECK 5 — Archivos generados no rastreados en git');

    const problematic = [
        path.join(CLIENT_APP, 'scripts', 'missing_keys_report.json'),
        path.join(CLIENT_APP, 'scripts', 'audit_report.json'),
    ];

    let allOk = true;
    for (const f of problematic) {
        if (fs.existsSync(f)) {
            // Verificar si está en .gitignore consultando git check-ignore
            try {
                const { execSync } = require('child_process');
                const result = execSync(`git check-ignore -q "${f}"`, { cwd: ROOT, stdio: 'pipe' });
                pass(`${path.basename(f)} existe pero está correctamente ignorado por git`);
            } catch {
                // exit code 1 = no ignorado
                warn(`${path.basename(f)} existe y NO está en .gitignore — podría hacer commit accidental`);
                allOk = false;
            }
        }
    }
    if (allOk) pass('Ningún artefacto de auditoría puede hacer commit accidental');
}

// =============================================================================
// EJECUCIÓN PRINCIPAL
// =============================================================================
console.log('\n' + '='.repeat(70));
console.log('🔒  RED RELEASE INTEGRITY CHECK');
console.log('='.repeat(70));

const version = readCanonicalVersion();
if (!version) {
    console.error('❌ FATAL: No se pudo leer RED_VERSION de version.ts. ¿Está el path correcto?');
    process.exit(1);
}
console.log(`\n  📌 Versión canónica detectada: v${version}\n`);

checkSHA256Sums(version);
checkHardcodedVersions(version);
checkReleaseNotes(version);
checkSSotVersionParity(version);
checkGeneratedFilesNotTracked();

// ── Resumen ───────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(70));
console.log(`📊  RESUMEN: ✅ ${passed} pasados  |  ❌ ${errors} errores  |  ⚠️  ${warnings} advertencias`);
console.log('='.repeat(70) + '\n');

if (errors > 0) {
    console.error(`❌  HAY ${errors} PROBLEMA(S) CRÍTICO(S). Corrige antes de hacer push/release.\n`);
    if (STRICT) process.exit(1);
} else if (warnings > 0) {
    console.warn(`⚠️   Hay ${warnings} advertencia(s). Revisa antes del release.\n`);
} else {
    console.log('🎯  INTEGRIDAD DE RELEASE VERIFICADA — Listo para push y release.\n');
}

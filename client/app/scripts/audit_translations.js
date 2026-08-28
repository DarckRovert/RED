/**
 * audit_translations.js — Auditoría estricta de calidad de traducción RED v65.0.1
 *
 * Detecta strings IDÉNTICOS al locale canónico (es.ts) en los demás locales.
 * Valor idéntico = fallback sin traducir.
 * Parsing por regex de línea (sin require/eval — compatible con TypeScript export).
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');

/**
 * Extrae pares flatKey → valor de un archivo .ts de locale usando regex por línea.
 * Soporta objetos anidados de hasta N niveles.
 */
function extractStrings(filePath) {
    const src = fs.readFileSync(filePath, 'utf-8');
    const result = new Map();
    const keyStack = [];
    let braceDepth = 0;

    // Detecta apertura de sección: key: {
    const sectionRe = /^\s*([\w]+)\s*:\s*\{\s*$/;
    // Detecta cierre de sección: },  o  }
    const closingRe = /^\s*\},?\s*$/;
    // Detecta valor string: key: "value"  o  key: 'value'
    const valueRe = /^\s*([\w]+)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,?\s*$/;

    for (const rawLine of src.split('\n')) {
        const line = rawLine.replace(/\r/, '');

        const secMatch = line.match(sectionRe);
        if (secMatch) {
            keyStack.push(secMatch[1]);
            braceDepth++;
            continue;
        }

        const closeMatch = line.match(closingRe);
        if (closeMatch && braceDepth > 0) {
            keyStack.pop();
            braceDepth--;
            continue;
        }

        const valMatch = line.match(valueRe);
        if (valMatch && braceDepth > 0) {
            const flatKey = [...keyStack, valMatch[1]].join('.');
            const value = valMatch[2] !== undefined ? valMatch[2] : valMatch[3];
            result.set(flatKey, value);
        }
    }

    return result;
}

// ── Cargar locale base (Español) ───────────────────────────────────────────────
const esMap = extractStrings(path.join(LOCALES_DIR, 'es.ts'));
const totalKeys = esMap.size;

const localeFiles = fs.readdirSync(LOCALES_DIR)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'es.ts')
    .sort();

console.log(`\n${'='.repeat(80)}`);
console.log(`🌍  AUDITORÍA DE TRADUCCIÓN ESTRICTA — RED v65.0.1`);
console.log(`    Base: es.ts — ${totalKeys} claves canónicas detectadas`);
console.log(`${'='.repeat(80)}\n`);

const report = {};

for (const localeFile of localeFiles) {
    const langCode = localeFile.replace('.ts', '');
    const locMap = extractStrings(path.join(LOCALES_DIR, localeFile));

    const untranslated = [];
    const missing = [];

    for (const [key, esVal] of esMap) {
        if (!locMap.has(key)) {
            missing.push(key);
        } else if (locMap.get(key) === esVal) {
            untranslated.push({ key, value: esVal });
        }
    }

    const translated = totalKeys - untranslated.length - missing.length;
    const pct = ((translated / totalKeys) * 100).toFixed(1);
    const status = untranslated.length === 0 && missing.length === 0
        ? '✅'
        : untranslated.length > 150 ? '🔴'
        : untranslated.length > 50  ? '🟡'
        : untranslated.length > 0   ? '🟠'
        : '✅';

    const tag = langCode.toUpperCase().padEnd(3);
    console.log(`${status}  [${tag}]  Traducidas: ${String(translated).padStart(3)}/${totalKeys} (${pct.padStart(5)}%)  |  Sin traducir: ${String(untranslated.length).padStart(3)}  |  Faltantes: ${missing.length}`);
    report[langCode] = { translated, total: totalKeys, untranslated, missing, pct: parseFloat(pct) };
}

// ── Detalle de deuda por locale ────────────────────────────────────────────────
console.log(`\n${'─'.repeat(80)}`);
console.log(`📋  DEUDA POR LOCALE — Top 8 strings sin traducir por idioma:`);
console.log(`${'─'.repeat(80)}\n`);

const sorted = Object.entries(report).sort((a, b) => b[1].untranslated.length - a[1].untranslated.length);
for (const [lang, data] of sorted) {
    if (data.untranslated.length === 0) continue;
    console.log(`  🌐 [${lang.toUpperCase()}] — ${data.untranslated.length} strings sin traducir:`);
    data.untranslated.slice(0, 8).forEach(u => {
        const preview = u.value.length > 65 ? u.value.substring(0, 65) + '…' : u.value;
        console.log(`      • ${u.key}`);
        console.log(`        ES: "${preview}"`);
    });
    console.log('');
}

// ── Resumen global ─────────────────────────────────────────────────────────────
const totalDebt = sorted.reduce((acc, [, d]) => acc + d.untranslated.length, 0);
const fullLocales = Object.values(report).filter(r => r.untranslated.length === 0 && r.missing.length === 0).length;
console.log(`${'='.repeat(80)}`);
console.log(`📊  RESUMEN: ${fullLocales}/${localeFiles.length} locales al 100%  |  Deuda total: ${totalDebt} strings`);
console.log(`${'='.repeat(80)}\n`);

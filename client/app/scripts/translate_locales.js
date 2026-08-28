/**
 * translate_locales.js — Motor de Traducción Batch via IA Local (Bonsai-27B)
 * RED v65.0.1 — Traduce los 583 strings faltantes en 11 locales
 *
 * Estrategia:
 *   1. Detectar strings sin traducir (valor === valor ES) por locale
 *   2. Enviar lotes de BATCH_SIZE strings con contexto de app táctica/P2P
 *   3. Parsear respuesta JSON del modelo
 *   4. Parchear quirúrgicamente cada archivo .ts
 *
 * Uso: node scripts/translate_locales.js [locale] [--dry-run]
 *   locale: en|de|fr|ar|pt|ja|ko|ru|it|zh|qu   (omitir = todos)
 *   --dry-run: mostrar qué se traduciría sin escribir
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── Config ─────────────────────────────────────────────────────────────────────
const LOCAL_AI_URL = 'http://localhost:1234/v1/chat/completions';
const MODEL = 'prism-ml/bonsai-27b';
const MAX_TOKENS = 2000;      // Bonsai-27B: ~278 thinking tokens + respuesta corta
const BATCH_SIZE = 1;         // 1 string por llamada — modelo de razonamiento, lotes grandes → timeout
const DELAY_MS = 200;         // delay entre llamadas
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');

const LOCALE_NAMES = {
    en: 'English', de: 'German', fr: 'French', ar: 'Arabic',
    pt: 'Portuguese (Brazilian)', ja: 'Japanese', ko: 'Korean',
    ru: 'Russian', it: 'Italian', zh: 'Chinese (Simplified)', qu: 'Quechua'
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TARGET_LOCALE = args.find(a => !a.startsWith('--'));
const TARGET_LOCALES = TARGET_LOCALE
    ? [TARGET_LOCALE]
    : Object.keys(LOCALE_NAMES);

// ── Regex-based string extractor ───────────────────────────────────────────────
function extractStrings(filePath) {
    const src = fs.readFileSync(filePath, 'utf-8');
    const result = new Map(); // flatKey → { value, lineNumber, rawLine }
    const keyStack = [];
    let braceDepth = 0;
    const sectionRe = /^\s*([\w]+)\s*:\s*\{\s*$/;
    const closingRe = /^\s*\},?\s*$/;
    const valueRe = /^(\s*)([\w]+)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,?\s*$/;

    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r/, '');
        const secMatch = line.match(sectionRe);
        if (secMatch) { keyStack.push(secMatch[1]); braceDepth++; continue; }
        const closeMatch = line.match(closingRe);
        if (closeMatch && braceDepth > 0) { keyStack.pop(); braceDepth--; continue; }
        const valMatch = line.match(valueRe);
        if (valMatch && braceDepth > 0) {
            const flatKey = [...keyStack, valMatch[2]].join('.');
            const value = valMatch[3] !== undefined ? valMatch[3] : valMatch[4];
            result.set(flatKey, { value, lineNumber: i, rawLine: line, indent: valMatch[1] });
        }
    }
    return result;
}

// ── HTTP call to local AI ──────────────────────────────────────────────────────
function callLocalAI(messages) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ model: MODEL, messages, max_tokens: MAX_TOKENS });
        const url = new URL(LOCAL_AI_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.message?.content ?? '';
                    resolve(content.trim());
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message} | Raw: ${data.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('Request timeout (120s)')); });
        req.write(body);
        req.end();
    });
}

// ── Translate a single string ─────────────────────────────────────────────────
// Bonsai-27B es un modelo de razonamiento: lotes grandes disparan thinking excesivo.
// Estrategia: 1 string por llamada, prompt ultracompacto para minimizar reasoning tokens.
async function translateBatch(strings, targetLang, langName) {
    const s = strings[0]; // BATCH_SIZE = 1

    // Prompt mínimo: menos contexto = menos reasoning tokens = más rápido
    const systemPrompt = `Translate Spanish mobile app UI text to ${langName}. Rules: keep emojis, keep acronyms (P2P,E2E,PQC,BLE,OTA,SOS,RF,DID,DMS,GPS,QR,APK,AES,VPN), keep brand names (RED,LoRa,MetaMask,WebRTC). UPPERCASE stays UPPERCASE. Reply ONLY with the translated text, nothing else.`;

    const content = await callLocalAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: s.esValue }
    ]);

    // Clean any accidental markdown/quotes the model might add
    const cleaned = content
        .replace(/^[`"']+|[`"']+$/g, '')  // strip wrapping quotes/backticks
        .replace(/^Translation:\s*/i, '')   // strip "Translation: " prefix
        .trim();

    return [{ key: s.key, translated: cleaned || null }];
}

// ── Patch a locale file with translations ─────────────────────────────────────
function patchLocaleFile(filePath, translations) {
    // translations: Map<flatKey, translatedValue>
    let src = fs.readFileSync(filePath, 'utf-8');
    const lines = src.split('\n');

    const keyStack = [];
    let braceDepth = 0;
    const sectionRe = /^\s*([\w]+)\s*:\s*\{\s*$/;
    const closingRe = /^\s*\},?\s*$/;
    const valueRe = /^(\s*)([\w]+)\s*:([ \t]*)(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*(,?)\s*$/;

    let patchCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r/, '');
        const secMatch = line.match(sectionRe);
        if (secMatch) { keyStack.push(secMatch[1]); braceDepth++; continue; }
        const closeMatch = line.match(closingRe);
        if (closeMatch && braceDepth > 0) { keyStack.pop(); braceDepth--; continue; }
        const valMatch = line.match(valueRe);
        if (valMatch && braceDepth > 0) {
            const flatKey = [...keyStack, valMatch[2]].join('.');
            if (translations.has(flatKey)) {
                const newVal = translations.get(flatKey);
                // Escape double quotes in value
                const escaped = newVal.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const comma = valMatch[6] || ',';
                lines[i] = `${valMatch[1]}${valMatch[2]}:${valMatch[3]}"${escaped}"${comma}`;
                patchCount++;
            }
        }
    }

    // Preserve original line endings
    const eol = src.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(filePath, lines.join(eol), 'utf-8');
    return patchCount;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🌍  MOTOR DE TRADUCCIÓN RED v65.0.1 — Bonsai-27B @ localhost:1234`);
    console.log(`    Modo: ${DRY_RUN ? '🔍 DRY RUN (sin escritura)' : '✍️  ESCRITURA REAL'}`);
    console.log(`    Locales objetivo: ${TARGET_LOCALES.join(', ')}`);
    console.log(`${'═'.repeat(80)}\n`);

    const esMap = extractStrings(path.join(LOCALES_DIR, 'es.ts'));

    for (const locale of TARGET_LOCALES) {
        const langName = LOCALE_NAMES[locale];
        if (!langName) { console.log(`⚠️  Locale desconocido: ${locale}`); continue; }

        const localeFile = path.join(LOCALES_DIR, `${locale}.ts`);
        if (!fs.existsSync(localeFile)) { console.log(`⚠️  Archivo no encontrado: ${localeFile}`); continue; }

        const locMap = extractStrings(localeFile);

        // Detectar strings sin traducir (valor === ES)
        const toTranslate = [];
        for (const [key, esData] of esMap) {
            const locData = locMap.get(key);
            if (locData && locData.value === esData.value) {
                toTranslate.push({ key, esValue: esData.value });
            }
        }

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`🌐 [${locale.toUpperCase()}] ${langName} — ${toTranslate.length} strings para traducir`);
        console.log(`${'─'.repeat(60)}`);

        if (toTranslate.length === 0) {
            console.log(`   ✅ Ya traducido completamente.`);
            continue;
        }

        if (DRY_RUN) {
            console.log(`   🔍 Primeros 5 a traducir:`);
            toTranslate.slice(0, 5).forEach(s => console.log(`      • ${s.key}: "${s.esValue.substring(0, 50)}"`));
            continue;
        }

        // Procesar string a string (BATCH_SIZE=1)
        const allTranslations = new Map();
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < toTranslate.length; i++) {
            const s = toTranslate[i];
            const progress = `[${i + 1}/${toTranslate.length}]`;
            process.stdout.write(`   ${progress} ${s.key}... `);

            try {
                const results = await translateBatch([s], locale, langName);
                if (results[0].translated) {
                    allTranslations.set(s.key, results[0].translated);
                    successCount++;
                    // Print a short preview of the translation
                    const preview = results[0].translated.substring(0, 45);
                    console.log(`✅ "${preview}"`);
                } else {
                    failCount++;
                    console.log(`⚠️  Sin respuesta`);
                }
            } catch (e) {
                failCount++;
                console.log(`❌ ${e.message}`);
            }

            if (i < toTranslate.length - 1) {
                await new Promise(r => setTimeout(r, DELAY_MS));
            }
        }

        // Patchear el archivo
        const patchCount = patchLocaleFile(localeFile, allTranslations);
        console.log(`   📝 Parcheadas: ${patchCount} líneas | ✅ OK: ${successCount} | ❌ Fallidas: ${failCount}`);
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🏁  TRADUCCIÓN COMPLETADA. Ejecuta 'node scripts/audit_translations.js' para verificar.`);
    console.log(`${'═'.repeat(80)}\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

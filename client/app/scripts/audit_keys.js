const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/lib/i18n/locales');
const esContent = fs.readFileSync(path.join(localesDir, 'es.ts'), 'utf8');

function extractKeys(tsContent) {
    const keys = [];
    const lines = tsContent.split('\n');
    let currentObject = '';
    
    for (const line of lines) {
        // Match top level objects e.g. "    auth: {" or "    map: {"
        const objMatch = line.match(/^\s{4}([a-zA-Z0-9_]+):\s*\{/);
        if (objMatch) {
            currentObject = objMatch[1];
            continue;
        }
        
        // Match properties inside objects e.g. "        title: ..."
        const propMatch = line.match(/^\s{8}([a-zA-Z0-9_]+):\s*["`]/);
        if (propMatch && currentObject) {
            keys.push(`${currentObject}.${propMatch[1]}`);
        }
    }
    return keys;
}

const esKeys = extractKeys(esContent);
console.log(`[ES] Total canonical keys: ${esKeys.length}`);

const languages = ['en', 'zh', 'pt', 'fr', 'de', 'ru', 'ja', 'ar', 'it', 'ko', 'qu'];
let allPassed = true;

for (const lang of languages) {
    const filePath = path.join(localesDir, `${lang}.ts`);
    if (!fs.existsSync(filePath)) {
        console.error(`[ERROR] File missing: ${lang}.ts`);
        allPassed = false;
        continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const langKeys = extractKeys(content);
    
    const missing = esKeys.filter(k => !langKeys.includes(k));
    const extra = langKeys.filter(k => !esKeys.includes(k));
    
    if (missing.length === 0 && extra.length === 0) {
        console.log(`[PASS] ${lang}.ts: 100% matched (${langKeys.length}/${esKeys.length} keys)`);
    } else {
        allPassed = false;
        console.error(`[FAIL] ${lang}.ts: total=${langKeys.length}, missing=${missing.length}, extra=${extra.length}`);
        if (missing.length > 0) console.error(`       Missing:`, missing);
        if (extra.length > 0) console.error(`       Extra:`, extra);
    }
}

if (allPassed) {
    console.log('\n>>> ALL 12 LOCALE SCHEMAS HAVE 100% PARITY! <<<');
} else {
    process.exit(1);
}

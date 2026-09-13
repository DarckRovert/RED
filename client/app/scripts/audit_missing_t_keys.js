const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'locales');
const esContent = fs.readFileSync(path.join(localesDir, 'es.ts'), 'utf8');

function extractKeys(tsContent) {
    const keys = new Set();
    const lines = tsContent.split('\n');
    let currentObject = '';
    
    for (const line of lines) {
        const objMatch = line.match(/^\s{4}([a-zA-Z0-9_]+):\s*\{/);
        if (objMatch) {
            currentObject = objMatch[1];
            continue;
        }
        const propMatch = line.match(/^\s{8}["']?([a-zA-Z0-9_]+)["']?\s*:\s*["'`]/);
        if (propMatch && currentObject) {
            keys.add(`${currentObject}.${propMatch[1]}`);
        }
    }
    return keys;
}

const canonicalKeys = extractKeys(esContent);
console.log(`Total canonical keys in es.ts: ${canonicalKeys.size}`);

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
    let results = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                results = results.concat(getAllFiles(fullPath, exts));
            }
        } else if (exts.includes(path.extname(file))) {
            results.push(fullPath);
        }
    }
    return results;
}

const srcDir = path.join(__dirname, '..', 'src');
const allSrcFiles = getAllFiles(srcDir);
console.log(`Total source files in src: ${allSrcFiles.length}`);

const missingTCalls = [];
const tRegex = /\bt\(\s*['"]([^'"]+)['"]/g;

for (const file of allSrcFiles) {
    if (file.includes(path.join('src', 'lib', 'i18n', 'locales'))) continue;
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = tRegex.exec(content)) !== null) {
        const key = match[1];
        if (!canonicalKeys.has(key)) {
            missingTCalls.push({
                file: path.relative(srcDir, file).replace(/\\/g, '/'),
                key
            });
        }
    }
}

console.log(`\n--- Missing t() Keys in es.ts (Total: ${missingTCalls.length}) ---`);
const grouped = {};
for (const item of missingTCalls) {
    grouped[item.key] = grouped[item.key] || [];
    grouped[item.key].push(item.file);
}

const report = [];
const prefixes = {};
for (const [key, files] of Object.entries(grouped)) {
    const p = key.split('.')[0];
    prefixes[p] = (prefixes[p] || 0) + 1;
    report.push({ key, files: [...new Set(files)], count: files.length });
}
report.sort((a, b) => a.key.localeCompare(b.key));

fs.writeFileSync(path.join(__dirname, 'missing_keys_report.json'), JSON.stringify(report, null, 2));
console.log(`\n📊 Total distinct missing keys: ${report.length}`);
console.log('📊 Missing keys by prefix:');
for (const [p, count] of Object.entries(prefixes).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${p}: ${count} missing keys`);
}


const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src');

function getAllFiles(dir, exts = ['.tsx', '.ts']) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            files = files.concat(getAllFiles(full, exts));
        } else if (exts.some(ext => e.name.endsWith(ext))) {
            files.push(full);
        }
    }
    return files;
}

const allFiles = getAllFiles(srcDir);
console.log(`[DEBT AUDIT] Auditing ${allFiles.length} files in ${srcDir}`);

const emptyHandlers = [];
const consoleHandlers = [];
const notImplementedAlerts = [];
const hardcodedArrays = [];
const disabledButtons = [];
const suspiciousMocks = [];

allFiles.forEach(fullPath => {
    const rel = path.relative(srcDir, fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();

        // 1. Empty onClick
        if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(trimmed)) {
            emptyHandlers.push({ file: rel, lineNum, text: trimmed });
        }

        // 2. onClick with console.log only
        if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*console\.log\(/.test(trimmed)) {
            consoleHandlers.push({ file: rel, lineNum, text: trimmed });
        }

        // 3. alert / toast with "not implemented", "próximamente", "en desarrollo", "TODO"
        if (/(alert|toast\.(info|warn|warning|error))\s*\([^)]*(?:not implemented|próximamente|proximamente|en desarrollo|TODO|sin implementar)/i.test(trimmed)) {
            notImplementedAlerts.push({ file: rel, lineNum, text: trimmed });
        }

        // 4. Hardcoded sample or dummy arrays
        if (/(const|let|var)\s+(?:mock|dummy|fake|sample)[A-Za-z0-9_]*\s*=\s*\[/i.test(trimmed) && !rel.includes('test')) {
            suspiciousMocks.push({ file: rel, lineNum, text: trimmed });
        }
    });
});

console.log('\n--- 1. EMPTY ONCLICK HANDLERS ---');
console.log(`Found: ${emptyHandlers.length}`);
emptyHandlers.forEach(h => console.log(`  ${h.file}:${h.lineNum} -> ${h.text}`));

console.log('\n--- 2. CONSOLE.LOG ONCLICK HANDLERS ---');
console.log(`Found: ${consoleHandlers.length}`);
consoleHandlers.forEach(h => console.log(`  ${h.file}:${h.lineNum} -> ${h.text}`));

console.log('\n--- 3. "NOT IMPLEMENTED / PRÓXIMAMENTE" ALERTS/TOASTS ---');
console.log(`Found: ${notImplementedAlerts.length}`);
notImplementedAlerts.forEach(h => console.log(`  ${h.file}:${h.lineNum} -> ${h.text}`));

console.log('\n--- 4. SUSPICIOUS MOCKS / DUMMY DATA ARRAYS ---');
console.log(`Found: ${suspiciousMocks.length}`);
suspiciousMocks.forEach(h => console.log(`  ${h.file}:${h.lineNum} -> ${h.text}`));

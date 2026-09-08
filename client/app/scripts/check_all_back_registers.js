const fs = require('fs');
const path = require('path');

const compDir = path.join(__dirname, '..', 'src', 'components');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(fullPath);
        }
    });
    return results;
}

const allFiles = walk(compDir);
console.log(`Checking ${allFiles.length} files for BackHandlerRegistry.register...\n`);

for (const file of allFiles) {
    const code = fs.readFileSync(file, 'utf8');
    if (!code.includes('BackHandlerRegistry.register')) continue;

    const relPath = path.relative(compDir, file);
    // Extract each register call
    const matches = code.match(/BackHandlerRegistry\.register\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)/g);
    if (matches) {
        matches.forEach((m, idx) => {
            const callsGoBack = /goBack\s*\(/.test(m) || /handleClose\s*\(/.test(m) || /onClose\s*\(/.test(m);
            const returnsTrue = /return\s+true/.test(m);
            console.log(`[${relPath}] Call #${idx + 1}: callsExit=${callsGoBack}, returnsTrue=${returnsTrue}`);
            if (callsGoBack) {
                console.log(`   Snippet: ${m.replace(/\s+/g, ' ').substring(0, 140)}...`);
            }
        });
    }
}

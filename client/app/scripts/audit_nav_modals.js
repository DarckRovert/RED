const fs = require('fs');
const path = require('path');

const compDir = path.join(__dirname, '..', 'src', 'components');
const files = fs.readdirSync(compDir).filter(f => f.endsWith('.tsx'));
const pagePath = path.join(__dirname, '..', 'src', 'app', 'page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf8');

const results = [];
for (const file of files) {
    const code = fs.readFileSync(path.join(compDir, file), 'utf8');
    const compName = file.replace('.tsx', '');
    const acceptsOnClose = /interface\s+\w+Props[^{]*\{[^}]*onClose\??\s*:/.test(code) || 
                           /props:\s*\{[^}]*onClose/.test(code) ||
                           /\{\s*onClose\s*[,:\)]/.test(code);
    if (!acceptsOnClose) continue;

    // Check occurrences in page.tsx
    const lines = pageContent.split('\n');
    const usages = [];
    lines.forEach((line, idx) => {
        if (line.includes(`<${compName}`)) {
            usages.push({ lineNum: idx + 1, content: line.trim() });
        }
    });

    if (usages.length > 0) {
        results.push({ compName, usages });
    }
}

console.log(`Found ${results.length} components accepting onClose used in page.tsx:\n`);
for (const r of results) {
    console.log(`=== ${r.compName} ===`);
    for (const u of r.usages) {
        const hasOnCloseProp = u.content.includes('onClose=');
        console.log(`  Line ${u.lineNum}: ${u.content} -> ${hasOnCloseProp ? '✅ HAS onClose' : '❌ MISSING onClose'}`);
    }
}

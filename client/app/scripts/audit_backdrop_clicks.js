const fs = require('fs');
const path = require('path');
const compDir = path.join(__dirname, '..', 'src', 'components');
const files = fs.readdirSync(compDir).filter(f => f.endsWith('.tsx'));

const results = [];
for (const file of files) {
    const code = fs.readFileSync(path.join(compDir, file), 'utf8');
    
    // Check if it renders a fixed centered overlay
    const isOverlay = code.includes('position: "fixed"') || code.includes("position: 'fixed'") || code.includes('position: `fixed`');
    const isCentered = code.includes('alignItems: "center"') || code.includes("alignItems: 'center'");
    const isJustifiedCenter = code.includes('justifyContent: "center"') || code.includes("justifyContent: 'center'");

    if (isOverlay && isCentered && isJustifiedCenter) {
        // It's a modal dialog with a backdrop!
        const hasBackdropClick = /e\.target\s*===\s*e\.currentTarget/.test(code);
        const hasCloseFunction = /onClose|handleClose|goBack/.test(code);
        results.push({
            file,
            hasBackdropClick,
            hasCloseFunction
        });
    }
}

console.log(`Found ${results.length} centered overlay modals:\n`);
results.forEach(r => {
    console.log(`- ${r.file}: ${r.hasBackdropClick ? '✅ HAS backdrop click' : '⚠️ MISSING backdrop click'}`);
});

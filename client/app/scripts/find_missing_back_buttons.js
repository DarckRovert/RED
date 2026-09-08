const fs = require('fs');
const path = require('path');

const compDir = path.join(__dirname, '..', 'src', 'components');

const pageContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'page.tsx'), 'utf8');

// Find all components rendered when currentScreen === "..."
const screenRegex = /currentScreen\s*===?\s*['"]([^'"]+)['"][^<]*<([A-Z]\w+)/g;
let match;
const renderedScreens = new Map(); // CompName -> Array of screen keys

while ((match = screenRegex.exec(pageContent)) !== null) {
    const screenKey = match[1];
    const compName = match[2];
    if (!renderedScreens.has(compName)) {
        renderedScreens.set(compName, []);
    }
    renderedScreens.get(compName).push(screenKey);
}

console.log(`Auditing ${renderedScreens.size} screen components rendered in page.tsx...\n`);

const missingButtons = [];
const missingOnCloseProp = [];

for (const [compName, screenKeys] of renderedScreens.entries()) {
    let filePath = path.join(compDir, `${compName}.tsx`);
    if (!fs.existsSync(filePath)) {
        // search subdirs
        const subdirs = ['tactical', 'settings', 'call', 'stories', 'ui'];
        for (const sub of subdirs) {
            const p = path.join(compDir, sub, `${compName}.tsx`);
            if (fs.existsSync(p)) {
                filePath = p;
                break;
            }
        }
    }

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Could not locate file for ${compName}`);
        continue;
    }

    const code = fs.readFileSync(filePath, 'utf8');

    // Check if component has any button or clickable element for returning/closing
    const hasBackOrClose = 
        /<button[^>]*>[\s\S]*?(?:‹|←|✕|×|Volver|Atrás)[\s\S]*?<\/button>/i.test(code) ||
        /aria-label=['"][^'"]*(?:close|cerrar|volver|back|atras)[^'"]*['"]/i.test(code) ||
        /onClick\s*=\s*\{[^}]*(?:goBack|handleClose|onClose|navigate\s*\(\s*['"]sidebar['"]\))/i.test(code);

    const acceptsOnClose = /interface\s+\w+Props[^{]*\{[^}]*onClose\??\s*:/.test(code) || 
                           /props:\s*\{[^}]*onClose/.test(code) ||
                           /\{\s*onClose\s*[,:\)]/.test(code);

    if (!hasBackOrClose) {
        missingButtons.push({ compName, screenKeys, filePath });
    }
    if (!acceptsOnClose) {
        missingOnCloseProp.push({ compName, screenKeys, filePath });
    }
}

console.log(`=== SCREENS WITH NO VISIBLE BACK/CLOSE BUTTON (${missingButtons.length}) ===`);
missingButtons.forEach(s => console.log(`❌ ${s.compName} (screens: ${s.screenKeys.join(', ')})`));

console.log(`\n=== SCREENS NOT ACCEPTING onClose PROP (${missingOnCloseProp.length}) ===`);
missingOnCloseProp.forEach(s => console.log(`ℹ️ ${s.compName} (screens: ${s.screenKeys.join(', ')})`));

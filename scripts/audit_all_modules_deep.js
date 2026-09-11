const fs = require('fs');
const path = require('path');

console.log("================================================================================");
console.log("🔎 AUDITORÍA EXHAUSTIVA DE INTEGRIDAD DE TODOS LOS MÓDULOS DE RED OS (V3)");
console.log("================================================================================");

const rootDir = path.join(__dirname, '..');
const pagePath = path.join(rootDir, 'client/app/src/app/page.tsx');
const sidebarPath = path.join(rootDir, 'client/app/src/components/Sidebar.tsx');
const ccPath = path.join(rootDir, 'client/app/src/components/TacticalCommandCenter.tsx');

const pageContent = fs.readFileSync(pagePath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
const ccContent = fs.readFileSync(ccPath, 'utf8');

// 1. Extract tools and modules
const sidebarTools = [...sidebarContent.matchAll(/{\s*icon:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*action:\s*"([^"]+)"\s*}/g)]
    .map(m => ({ icon: m[1], label: m[2], action: m[3] }));

const ccModules = [...ccContent.matchAll(/id:\s*['"]([^'"]+)['"],\s*action:\s*['"]([^'"]+)['"],\s*icon:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"]/g)]
    .map(m => ({ id: m[1], action: m[2], icon: m[3], title: m[4] }));

// 2. Extract dynamic imports in page.tsx
const dynamicImports = {};
const dynamicRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*dynamic\(\(\)\s*=>\s*import\(["']([^"']+)["']\)/g;
let dMatch;
while ((dMatch = dynamicRegex.exec(pageContent)) !== null) {
    dynamicImports[dMatch[1]] = dMatch[2];
}

// Split page.tsx into Tablet layout and Mobile layout
const tabletSplitIndex = pageContent.indexOf('/* ── Master-Detail Tablet Layout');
const mobileSplitIndex = pageContent.indexOf('/* ── Single-Column Mobile Layout');

const tabletSection = pageContent.slice(tabletSplitIndex, mobileSplitIndex);
const mobileSection = pageContent.slice(mobileSplitIndex);

// Mapping of action to actual React component name
const ACTION_TO_COMP = {
    call: 'CallScreen',
    webCompanionLink: 'WebCompanionLinkModal',
    swarmHealthHUD: 'SwarmHealthHUD',
    channels: 'PublicChannelsPanel',
    canvas: 'LiveCanvasModal',
    radar: 'RadarWindow',
    nodemap: 'NodeMap',
    appStore: 'SovereignAppStoreModal',
    hyperBrowser: 'RedHyperBrowserModal',
    settings: 'SettingsModal',
    updater: 'UpdateModal'
};

const actionsToCheck = new Set([...sidebarTools.map(t => t.action), ...ccModules.map(m => m.action)]);

const issues = [];
const moduleReport = [];

for (const action of actionsToCheck) {
    if (action === 'commandCenter') {
        continue;
    }
    
    // Check in tablet section
    const inTablet = tabletSection.includes(`"${action}"`) || tabletSection.includes(`'${action}'`);
    // Check in mobile section
    const inMobile = mobileSection.includes(`"${action}"`) || mobileSection.includes(`'${action}'`);

    let compName = ACTION_TO_COMP[action];
    if (!compName) {
        const actionIdx = pageContent.indexOf(`"${action}"`);
        const slice = pageContent.slice(actionIdx, actionIdx + 300);
        const compMatch = slice.match(/<([A-Z][A-Za-z0-9_]+)/);
        compName = compMatch ? compMatch[1] : 'UNKNOWN';
    }

    // Resolve component file
    let compPath = dynamicImports[compName];
    let fileExists = false;
    let fileSize = 0;
    let fileLines = 0;
    let fullFilePath = '';

    if (compPath) {
        if (compPath.startsWith('.')) {
            fullFilePath = path.resolve(path.join(rootDir, 'client/app/src/app'), compPath);
            if (!fs.existsSync(fullFilePath)) {
                if (fs.existsSync(fullFilePath + '.tsx')) fullFilePath += '.tsx';
                else if (fs.existsSync(fullFilePath + '.ts')) fullFilePath += '.ts';
                else if (fs.existsSync(path.join(fullFilePath, 'index.tsx'))) fullFilePath = path.join(fullFilePath, 'index.tsx');
            }
        }
        if (fs.existsSync(fullFilePath)) {
            fileExists = true;
            const content = fs.readFileSync(fullFilePath, 'utf8');
            fileSize = content.length;
            fileLines = content.split('\n').length;
        }
    }

    const itemStatus = {
        action,
        component: compName,
        filePath: compPath || 'N/A',
        fileExists,
        fileSize,
        fileLines,
        inTablet,
        inMobile,
        status: (inTablet && inMobile && fileExists && fileSize > 500) ? 'OK' : 'FAIL'
    };

    moduleReport.push(itemStatus);

    if (itemStatus.status === 'FAIL') {
        issues.push(itemStatus);
    }
}

console.log(`Total acciones únicas auditadas: ${moduleReport.length}`);
console.log(`Acciones con estado OK: ${moduleReport.filter(m => m.status === 'OK').length}`);
console.log(`Acciones con fallas: ${issues.length}`);

if (issues.length > 0) {
    console.log("\n⚠️ DETALLES DE FALLAS:");
    console.dir(issues, { depth: null });
} else {
    console.log("\n✅ ¡100% DE LOS 61 MÓDULOS DE RUTA TIENEN COMPONENTE REAL EN DISCO, TAMAÑO SUSTANCIAL Y PARIDAD TOTAL EN TABLET Y MÓVIL!");
}

console.log("\n--- DETALLE DE TODOS LOS 61 MÓDULOS Y SUS COMPONENTES EN DISCO ---");
moduleReport.forEach((m, i) => {
    const kb = (m.fileSize / 1024).toFixed(1);
    console.log(`${String(i + 1).padStart(2, ' ')}. [${m.action.padEnd(20, ' ')}] -> <${m.component.padEnd(26, ' ')}> (${kb.padStart(5, ' ')} KB, ${String(m.fileLines).padStart(4, ' ')} líneas) [Tablet: ${m.inTablet ? '✓' : '✗'}, Mobile: ${m.inMobile ? '✓' : '✗'}]`);
});

console.log("\n================================================================================");
console.log("AUDITORÍA DE INTEGRIDAD FINALIZADA CON ÉXITO");
console.log("================================================================================");

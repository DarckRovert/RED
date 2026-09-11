const fs = require('fs');
const path = require('path');

console.log("=== RED COMPREHENSIVE REPOSITORY DEEP AUDIT ===");

// 1. Audit catalogData.ts
const catalogPath = path.join(__dirname, '../client/app/src/components/showcase/catalogData.ts');
const catalogContent = fs.readFileSync(catalogPath, 'utf8');
const catalogIds = [];
const catMatches = catalogContent.matchAll(/id:\s*["']([^"']+)["']/g);
for (const m of catMatches) {
    catalogIds.push(m[1]);
}
console.log(`\n1. Showcase Catalog (catalogData.ts): ${catalogIds.length} modules.`);

// 2. Audit Sidebar.tsx
const sidebarPath = path.join(__dirname, '../client/app/src/components/Sidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
const sidebarTools = [];
const sbMatches = sidebarContent.matchAll(/{\s*icon:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*action:\s*"([^"]+)"\s*}/g);
for (const m of sbMatches) {
    sidebarTools.push({ icon: m[1], label: m[2], action: m[3] });
}
console.log(`2. Sidebar Hubs (Sidebar.tsx): ${sidebarTools.length} tools.`);

// 3. Audit TacticalCommandCenter.tsx
const ccPath = path.join(__dirname, '../client/app/src/components/TacticalCommandCenter.tsx');
const ccContent = fs.readFileSync(ccPath, 'utf8');
const ccModules = [];
const ccMatches = ccContent.matchAll(/id:\s*['"]([^'"]+)['"],\s*action:\s*['"]([^'"]+)['"],\s*icon:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"]/g);
for (const m of ccMatches) {
    ccModules.push({ id: m[1], action: m[2], icon: m[3], title: m[4] });
}
console.log(`3. Command Center (TacticalCommandCenter.tsx): ${ccModules.length} modules.`);

// 4. Audit LandingModuleCatalog.tsx
const landingCatPath = path.join(__dirname, '../client/app/src/components/showcase/LandingModuleCatalog.tsx');
const landingContent = fs.readFileSync(landingCatPath, 'utf8');
console.log(`4. LandingModuleCatalog: Read ${landingContent.length} bytes.`);

// 5. Compare IDs and Actions
console.log("\n--- CROSS-CHECKING SIDEBAR vs COMMAND CENTER vs CATALOG ---");
const sbActions = new Set(sidebarTools.map(t => t.action));
const ccActions = new Set(ccModules.map(m => m.action));
const catSet = new Set(catalogIds);

console.log("Sidebar actions count:", sbActions.size);
console.log("CommandCenter actions count:", ccActions.size);
console.log("Catalog IDs count:", catSet.size);

// Check if any Sidebar tool is missing in CommandCenter
const inSidebarNotCC = [...sbActions].filter(a => !ccActions.has(a));
console.log("In Sidebar but NOT in CommandCenter:", inSidebarNotCC);

// Check if any CommandCenter module is missing in Sidebar
const inCCNotSidebar = [...ccActions].filter(a => !sbActions.has(a));
console.log("In CommandCenter but NOT in Sidebar:", inCCNotSidebar);

// Check all actions against page.tsx
const pagePath = path.join(__dirname, '../client/app/src/app/page.tsx');
const pageContent = fs.readFileSync(pagePath, 'utf8');

const unhandledInPage = [];
for (const a of sbActions) {
    if (!pageContent.includes(`"${a}"`) && !pageContent.includes(`'${a}'`)) {
        unhandledInPage.push(a);
    }
}
for (const a of ccActions) {
    if (!pageContent.includes(`"${a}"`) && !pageContent.includes(`'${a}'`)) {
        if (!unhandledInPage.includes(a)) unhandledInPage.push(a);
    }
}
console.log("Actions NOT handled in page.tsx:", unhandledInPage);

// 6. Check AuthWall.tsx
const authWallPath = path.join(__dirname, '../client/app/src/components/AuthWall.tsx');
const authWallContent = fs.readFileSync(authWallPath, 'utf8');
console.log(`\n5. AuthWall.tsx: Read ${authWallContent.length} bytes.`);

// 7. Check WebCompanionLinkModal.tsx
const webCompPath = path.join(__dirname, '../client/app/src/components/WebCompanionLinkModal.tsx');
const webCompContent = fs.readFileSync(webCompPath, 'utf8');
console.log(`6. WebCompanionLinkModal.tsx: Read ${webCompContent.length} bytes.`);

// 8. Check ru.ts locale
const ruPath = path.join(__dirname, '../client/app/src/lib/i18n/locales/ru.ts');
const ruContent = fs.readFileSync(ruPath, 'utf8');
const esPath = path.join(__dirname, '../client/app/src/lib/i18n/locales/es.ts');
const esContent = fs.readFileSync(esPath, 'utf8');

const esKeys = [...esContent.matchAll(/"([^"]+)":/g)].map(m => m[1]);
const ruKeys = new Set([...ruContent.matchAll(/"([^"]+)":/g)].map(m => m[1]));
const missingInRu = esKeys.filter(k => !ruKeys.has(k));
console.log(`7. i18n Parity (es vs ru): ${esKeys.length} es keys, ${ruKeys.size} ru keys. Missing in ru: ${missingInRu.length}`);
if (missingInRu.length > 0) {
    console.log("Sample missing keys in ru:", missingInRu.slice(0, 10));
}

console.log("\n=== DEEP AUDIT COMPLETE ===");

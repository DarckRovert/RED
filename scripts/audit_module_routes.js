const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(__dirname, '../client/app/src/components/Sidebar.tsx');
const commandCenterPath = path.join(__dirname, '../client/app/src/components/TacticalCommandCenter.tsx');
const pagePath = path.join(__dirname, '../client/app/src/app/page.tsx');
const typesPath = path.join(__dirname, '../client/app/src/store/types.ts');

const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
const commandCenterContent = fs.readFileSync(commandCenterPath, 'utf8');
const pageContent = fs.readFileSync(pagePath, 'utf8');
const typesContent = fs.readFileSync(typesPath, 'utf8');

// Extract ScreenView type
const screenViewMatch = typesContent.match(/export type ScreenView = (.*?);/s);
const screenViews = screenViewMatch ? screenViewMatch[1].split('|').map(s => s.trim().replace(/['"]/g, '')) : [];

console.log(`[AUDIT] Found ${screenViews.length} registered ScreenView types.`);

// Extract tools from Sidebar.tsx
const sidebarToolRegex = /{\s*icon:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*action:\s*"([^"]+)"\s*}/g;
const sidebarTools = [];
let match;
while ((match = sidebarToolRegex.exec(sidebarContent)) !== null) {
    sidebarTools.push({ icon: match[1], label: match[2], action: match[3] });
}

console.log(`[AUDIT] Found ${sidebarTools.length} tools in Sidebar.tsx.`);

// Extract actions from TacticalCommandCenter.tsx
const ccActionRegex = /id:\s*['"]([^'"]+)['"],\s*action:\s*['"]([^'"]+)['"],\s*icon:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"]/g;
const ccModules = [];
while ((match = ccActionRegex.exec(commandCenterContent)) !== null) {
    ccModules.push({ id: match[1], action: match[2], icon: match[3], title: match[4] });
}

console.log(`[AUDIT] Found ${ccModules.length} modules in TacticalCommandCenter.tsx.`);

// Check against page.tsx
console.log('\n--- AUDITING SIDEBAR TOOLS AGAINST PAGE.TSX ---');
sidebarTools.forEach((tool, idx) => {
    const isHandled = pageContent.includes(`"${tool.action}"`) || pageContent.includes(`'${tool.action}'`);
    const inTypes = screenViews.includes(tool.action);
    const status = isHandled && inTypes ? 'OK' : 'FAIL';
    if (status === 'FAIL') {
        console.log(`[${status}] #${idx + 1} "${tool.label}" -> action: "${tool.action}" (inTypes: ${inTypes}, inPage: ${isHandled})`);
    }
});

console.log('\n--- AUDITING COMMAND CENTER MODULES AGAINST PAGE.TSX ---');
ccModules.forEach((mod, idx) => {
    const isHandled = pageContent.includes(`"${mod.action}"`) || pageContent.includes(`'${mod.action}'`);
    const inTypes = screenViews.includes(mod.action);
    const status = isHandled && inTypes ? 'OK' : 'FAIL';
    if (status === 'FAIL') {
        console.log(`[${status}] #${idx + 1} "${mod.title}" -> action: "${mod.action}" (inTypes: ${inTypes}, inPage: ${isHandled})`);
    }
});

console.log('\n--- COMPARING SIDEBAR VS COMMAND CENTER ---');
const sActions = sidebarTools.map(t => t.action);
const ccActions = ccModules.map(m => m.action);
console.log('In Sidebar but not in CC:', sActions.filter(a => !ccActions.includes(a)));
console.log('In CC but not in Sidebar:', ccActions.filter(a => !sActions.includes(a)));

console.log('\n[AUDIT] Route validation completed.');

const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(__dirname, '../client/app/src/components/Sidebar.tsx');
const commandCenterPath = path.join(__dirname, '../client/app/src/components/TacticalCommandCenter.tsx');
const wsPath = path.join(__dirname, '../client/app/src/components/navigation/WorkspaceScreens.tsx');
const typesPath = path.join(__dirname, '../client/app/src/store/types.ts');

const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
const commandCenterContent = fs.readFileSync(commandCenterPath, 'utf8');
const wsContent = fs.readFileSync(wsPath, 'utf8');
const typesContent = fs.readFileSync(typesPath, 'utf8');

// Extract ScreenView type
const screenViewMatch = typesContent.match(/export type ScreenView = (.*?);/s);
const screenViews = screenViewMatch ? screenViewMatch[1].split('|').map(s => s.trim().replace(/['"]/g, '')) : [];

console.log(`[AUDIT] Found ${screenViews.length} registered ScreenView types.`);

// Extract tools from Sidebar.tsx
const sidebarActions = [...sidebarContent.matchAll(/action:\s*["']([^"']+)["']/g)].map(m => m[1]);
console.log(`[AUDIT] Found ${sidebarActions.length} tool actions in Sidebar.tsx.`);

// Extract actions from TacticalCommandCenter.tsx
const ccActions = [...commandCenterContent.matchAll(/action:\s*["']([^"']+)["']/g)].map(m => m[1]);
console.log(`[AUDIT] Found ${ccActions.length} module actions in TacticalCommandCenter.tsx.`);

let failCount = 0;

// Check against WorkspaceScreens.tsx
console.log('\n--- AUDITING SIDEBAR TOOLS AGAINST WORKSPACESCREENS.TSX ---');
sidebarActions.forEach((action, idx) => {
    if (action === 'commandCenter' || action === 'sidebar') return;
    const isHandled = wsContent.includes(`"${action}"`) || wsContent.includes(`'${action}'`);
    const inTypes = screenViews.includes(action);
    const status = isHandled && inTypes ? 'OK' : 'FAIL';
    if (status === 'FAIL') {
        failCount++;
        console.log(`[${status}] #${idx + 1} action: "${action}" (inTypes: ${inTypes}, inWorkspaceScreens: ${isHandled})`);
    }
});

console.log('\n--- AUDITING COMMAND CENTER MODULES AGAINST WORKSPACESCREENS.TSX ---');
ccActions.forEach((action, idx) => {
    if (action === 'commandCenter' || action === 'sidebar') return;
    const isHandled = wsContent.includes(`"${action}"`) || wsContent.includes(`'${action}'`);
    const inTypes = screenViews.includes(action);
    const status = isHandled && inTypes ? 'OK' : 'FAIL';
    if (status === 'FAIL') {
        failCount++;
        console.log(`[${status}] #${idx + 1} action: "${action}" (inTypes: ${inTypes}, inWorkspaceScreens: ${isHandled})`);
    }
});

if (failCount === 0) {
    console.log('\n✅ 100% DE LAS ACCIONES ESTÁN DEFINIDAS EN TYPES.TS Y ENRUTADAS EN WORKSPACESCREENS.TSX');
} else {
    console.log(`\n❌ SE DETECTARON ${failCount} ACCIONES NO ENRUTADAS O NO REGISTRADAS.`);
}

console.log('\n[AUDIT] Route validation completed.');

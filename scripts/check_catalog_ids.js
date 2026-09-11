const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '../client/app/src/components/showcase/catalogData.ts');
const typesPath = path.join(__dirname, '../client/app/src/store/types.ts');
const sidebarPath = path.join(__dirname, '../client/app/src/components/Sidebar.tsx');
const pagePath = path.join(__dirname, '../client/app/src/app/page.tsx');

const catalogContent = fs.readFileSync(catalogPath, 'utf8');
const typesContent = fs.readFileSync(typesPath, 'utf8');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
const pageContent = fs.readFileSync(pagePath, 'utf8');

// Extract ScreenViews
const screenViewMatch = typesContent.match(/export type ScreenView = (.*?);/s);
const screenViews = new Set(screenViewMatch[1].split('|').map(s => s.trim().replace(/['"]/g, '')));

// Extract catalog module IDs
const idMatches = [...catalogContent.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log(`Total IDs in catalogData.ts: ${idMatches.length}`);

// Check against screenViews
const missingInTypes = idMatches.filter(id => !screenViews.has(id));
console.log('Catalog IDs NOT in ScreenView:', missingInTypes);

// Extract sidebar tools
const sidebarTools = [...sidebarContent.matchAll(/action:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log(`Total actions in Sidebar.tsx: ${sidebarTools.length}`);

// Check which catalog IDs match sidebar actions
const matchedInSidebar = idMatches.filter(id => sidebarTools.includes(id));
console.log(`Catalog IDs present in Sidebar actions: ${matchedInSidebar.length} / ${idMatches.length}`);
const notInSidebar = idMatches.filter(id => !sidebarTools.includes(id));
console.log('Catalog IDs NOT in Sidebar actions:', notInSidebar);

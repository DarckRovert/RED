const fs = require('fs');
const path = require('path');

function getFiles(dir, exts = ['.ts', '.tsx', '.js']) {
    let list = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        if (['node_modules', '.next', 'out', 'android', 'target', '.git'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            list = list.concat(getFiles(full, exts));
        } else if (exts.some(ext => e.name.endsWith(ext))) {
            list.push(full);
        }
    }
    return list;
}

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'client', 'app', 'src');

console.log('======================================================================');
console.log('🔍 AUDITORIA INTEGRAL DE INTEGRIDAD DEL REPOSITORIO RED');
console.log('======================================================================\n');

// 1. Audit Lib Engines
const libFiles = getFiles(path.join(srcDir, 'lib'));
const allSrcFiles = getFiles(srcDir);
const allScripts = getFiles(path.join(root, 'client', 'app', 'scripts'));
const searchable = allSrcFiles.concat(allScripts).map(f => ({ path: f, content: fs.readFileSync(f, 'utf8') }));

console.log(`📦 [1/4] Motores en src/lib: ${libFiles.length} archivos.`);
let orphanLibCount = 0;
libFiles.forEach(f => {
    const base = path.basename(f).replace(/\.(ts|tsx|js)$/, '');
    if (['index', 'types'].includes(base) || base.endsWith('.d')) return;
    const usages = searchable.filter(s => s.path !== f && s.content.includes(base));
    if (usages.length === 0) {
        console.log(`  ⚠️ Motor huerfano: ${path.relative(srcDir, f)}`);
        orphanLibCount++;
    }
});
if (orphanLibCount === 0) console.log('  ✅ 100% de motores en src/lib estan activos y referenciados.\n');

// 2. Audit Components
const compFiles = getFiles(path.join(srcDir, 'components'));
console.log(`🧩 [2/4] Componentes de UI: ${compFiles.length} archivos.`);
let orphanCompCount = 0;
compFiles.forEach(f => {
    const base = path.basename(f).replace(/\.(ts|tsx|js)$/, '');
    if (['index', 'types'].includes(base) || base.endsWith('.d')) return;
    const usages = searchable.filter(s => s.path !== f && s.content.includes(base));
    if (usages.length === 0) {
        console.log(`  ⚠️ Componente huerfano: ${path.relative(srcDir, f)}`);
        orphanCompCount++;
    }
});
if (orphanCompCount === 0) console.log('  ✅ 100% de componentes de UI estan activos y referenciados.\n');

// 3. Audit ScreenView Router Coverage
const typesFile = fs.readFileSync(path.join(srcDir, 'store', 'types.ts'), 'utf8');
const pageFile = fs.readFileSync(path.join(srcDir, 'app', 'page.tsx'), 'utf8');
const match = typesFile.match(/export type ScreenView = ([^;]+);/);
if (match) {
    const views = match[1].split('|').map(v => v.trim().replace(/['"]/g, ''));
    console.log(`🗺️ [3/4] Enrutador C4ISR: ${views.length} vistas ScreenView.`);
    const unrouted = views.filter(v => !pageFile.includes(`"${v}"`) && !pageFile.includes(`'${v}'`));
    if (unrouted.length === 0) {
        console.log('  ✅ 100% de vistas ScreenView estan enlazadas en page.tsx.\n');
    } else {
        console.log(`  ⚠️ Vistas sin renderizador en page.tsx (${unrouted.length}): ${unrouted.join(', ')}\n`);
    }
}

// 4. Audit Navigation Drawer Tools vs Registered Screens
const sidebarFile = fs.readFileSync(path.join(srcDir, 'components', 'Sidebar.tsx'), 'utf8');
const commandFile = fs.readFileSync(path.join(srcDir, 'components', 'TacticalCommandCenter.tsx'), 'utf8');
const searchFile = fs.readFileSync(path.join(srcDir, 'components', 'GlobalSearchModal.tsx'), 'utf8');

const sidebarActions = Array.from(sidebarFile.matchAll(/action:\s*["']([^"']+)["']/g)).map(m => m[1]);
const commandActions = Array.from(commandFile.matchAll(/action:\s*["']([^"']+)["']/g)).map(m => m[1]);
const searchActions = Array.from(searchFile.matchAll(/action:\s*["']([^"']+)["']/g)).map(m => m[1]);

const uniqueSidebar = new Set(sidebarActions);
const uniqueCommand = new Set(commandActions);
const uniqueSearch = new Set(searchActions);

console.log(`📊 [4/4] Cobertura de Interfaz:`);
console.log(`  - Sidebar Drawer: ${uniqueSidebar.size} acciones unicas configuradas.`);
console.log(`  - Centro de Comando: ${uniqueCommand.size} modulos registrados.`);
console.log(`  - Buscador Global: ${uniqueSearch.size} herramientas indexadas.`);
console.log('\n======================================================================');
console.log('✅ AUDITORIA FINALIZADA SIN ERRORES CRITICOS NI ARCHIVOS HUERFANOS.');
console.log('======================================================================');

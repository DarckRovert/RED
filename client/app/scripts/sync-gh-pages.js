const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("================================================================================");
console.log("🌐 SINCRONIZACIÓN COMPLETA DE GITHUB PAGES & WEB COMPANION (v64.0.0)");
console.log("================================================================================");

const appDir = path.resolve(__dirname, '..');
const outDir = path.join(appDir, 'out');
const rootDir = path.resolve(appDir, '../..');

// 1. Build for GitHub Pages (/RED base path)
console.log("1️⃣ Compilando Single Page Application para GitHub Pages (/RED)...");
execSync('npm.cmd run build:gh', { cwd: appDir, stdio: 'inherit' });

// 2. Copy files to repository root for GitHub Pages hosting
console.log("\n2️⃣ Sincronizando archivos al root del repositorio...");

function copyRecursive(src, dst) {
    if (!fs.existsSync(src)) return;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            copyRecursive(path.join(src, child), path.join(dst, child));
        }
    } else {
        fs.copyFileSync(src, dst);
    }
}

// Clean old root _next folder
const rootNextDir = path.join(rootDir, '_next');
if (fs.existsSync(rootNextDir)) {
    fs.rmSync(rootNextDir, { recursive: true, force: true });
}

// Copy new assets
const itemsToCopy = ['index.html', '404.html', 'sw.js', '_next', 'offline', 'manifest.json', 'favicon.ico'];
for (const item of itemsToCopy) {
    const src = path.join(outDir, item);
    const dst = path.join(rootDir, item);
    if (fs.existsSync(src)) {
        copyRecursive(src, dst);
        console.log(`   ✓ Copiado: ${item}`);
    }
}

// 3. Rebuild for Android Mobile SPA (clean base path '') and sync Capacitor
console.log("\n3️⃣ Restaurando compilación móvil nativa (Capacitor Android)...");
execSync('npm.cmd run build:mobile && npx.cmd cap sync android', { cwd: appDir, stdio: 'inherit' });

console.log("\n================================================================================");
console.log("✅ GITHUB PAGES Y NATIVO ANDROID 100% SINCRONIZADOS Y ACTUALIZADOS");
console.log("================================================================================\n");

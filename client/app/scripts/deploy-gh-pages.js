const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("================================================================================");
console.log("🌐 DESPLIEGUE EXHAUSTIVO DE WEB COMPANION A GITHUB PAGES (v64.0.0)");
console.log("================================================================================\n");

const appDir = path.resolve(__dirname, '..');
const outDir = path.join(appDir, 'out');
const rootDir = path.resolve(appDir, '../..');

// 1. Build Next.js with /RED base path for GitHub Pages
console.log("1️⃣ Compilando Single Page Application con basePath='/RED' para GitHub Pages...");
execSync('npm.cmd run build:gh', { cwd: appDir, stdio: 'inherit' });

// 2. Ensure .nojekyll and 404.html exist in outDir
fs.writeFileSync(path.join(outDir, '.nojekyll'), '# Disable Jekyll for GitHub Pages\n');
if (fs.existsSync(path.join(outDir, 'index.html'))) {
    fs.copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
}
console.log("   ✓ .nojekyll y 404.html generados en out/");

// 3. Copy files to repository root of main branch (in case GitHub Pages uses main / root)
console.log("\n2️⃣ Sincronizando archivos al root del repositorio (rama main)...");

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

// Copy new assets to root
const itemsToCopy = ['index.html', '404.html', 'sw.js', '_next', 'offline', 'manifest.json', '.nojekyll', 'red_icon.png', 'red_splash.png', 'assets', 'models', 'ort-wasm'];
for (const item of itemsToCopy) {
    const src = path.join(outDir, item);
    const dst = path.join(rootDir, item);
    if (fs.existsSync(src)) {
        copyRecursive(src, dst);
        console.log(`   ✓ Copiado a root: ${item}`);
    }
}

// 4. Deploy directly to gh-pages branch (orphan branch for GitHub Pages)
console.log("\n3️⃣ Publicando rama huérfana gh-pages en origin...");
try {
    const gitDir = path.join(outDir, '.git');
    if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
    }

    execSync('git init', { cwd: outDir, stdio: 'inherit' });
    execSync('git config user.name "DarckRovert"', { cwd: outDir, stdio: 'inherit' });
    execSync('git config user.email "darckrovert@gmail.com"', { cwd: outDir, stdio: 'inherit' });
    execSync('git checkout -B gh-pages', { cwd: outDir, stdio: 'inherit' });
    execSync('git add -A', { cwd: outDir, stdio: 'inherit' });
    execSync('git commit -m "deploy(gh-pages): live web companion bundle v64.0.0"', { cwd: outDir, stdio: 'inherit' });
    execSync('git remote add origin https://github.com/DarckRovert/RED.git', { cwd: outDir, stdio: 'inherit' });
    execSync('git push -f origin gh-pages', { cwd: outDir, stdio: 'inherit' });
    console.log("   ✅ Rama gh-pages actualizada y empujada a origin/gh-pages con éxito.");
} catch (e) {
    console.error("   ❌ Error al empujar a gh-pages:", e.message);
}

// 5. Rebuild mobile SPA for Capacitor Android
console.log("\n4️⃣ Restaurando compilación móvil nativa (Capacitor Android)...");
execSync('npm.cmd run build:mobile && npx.cmd cap sync android', { cwd: appDir, stdio: 'inherit' });

console.log("\n================================================================================");
console.log("✅ GITHUB PAGES (gh-pages & main) Y NATIVO ANDROID 100% SINCRONIZADOS");
console.log("================================================================================\n");

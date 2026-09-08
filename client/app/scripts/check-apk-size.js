const fs = require('fs');
const path = require('path');

const apkPath = path.resolve(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
const releaseDir = path.resolve(__dirname, '../../../release-assets');

if (!fs.existsSync(apkPath)) {
    console.error("❌ Error: No se encontró app-release.apk en: " + apkPath);
    process.exit(1);
}

const stats = fs.statSync(apkPath);
const sizeBytes = stats.size;
const sizeKB = (sizeBytes / 1024).toFixed(2);
const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

let appVersion = '95.0.0';
try {
    const vContent = fs.readFileSync(path.join(__dirname, '../src/lib/version.ts'), 'utf8');
    const m = vContent.match(/RED_VERSION\s*=\s*["']([^"']+)["']/);
    if (m) appVersion = m[1];
} catch {}

console.log("================================================================================");
console.log(`📦 VERIFICACIÓN DE TAMAÑO & EMBALAJE DE RELEASE APK (RED v${appVersion})`);
console.log("================================================================================");
console.log(`📍 Ruta Origen: ${apkPath}`);
console.log(`📊 Tamaño Exacto: ${sizeBytes} bytes (${sizeKB} KB / ${sizeMB} MB)`);

if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
}

const crypto = require('crypto');

const targetLatest = path.join(releaseDir, 'red-latest.apk');
const targetVersion = path.join(releaseDir, `red-v${appVersion}.apk`);

fs.copyFileSync(apkPath, targetLatest);
fs.copyFileSync(apkPath, targetVersion);

console.log(`✅ Sincronizado a release-assets/red-latest.apk (${sizeMB} MB)`);
console.log(`✅ Sincronizado a release-assets/red-v${appVersion}.apk (${sizeMB} MB)`);

// Generate SHA256SUMS.txt
const releaseFiles = [`red-v${appVersion}.apk`, 'red-latest.apk', `red-node-windows-v${appVersion}.zip`, 'red-node.exe'];
const sums = [];

for (const file of releaseFiles) {
    const filePath = path.join(releaseDir, file);
    if (fs.existsSync(filePath)) {
        const fileBuf = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(fileBuf).digest('hex').toUpperCase();
        sums.push(`${hash}  ${file}`);
    }
}

const shaPath = path.join(releaseDir, 'SHA256SUMS.txt');
fs.writeFileSync(shaPath, sums.join('\n') + '\n', 'utf8');
console.log(`✅ SHA256SUMS.txt actualizado con ${sums.length} binarios.`);

// Ensure public directory does NOT contain any .apk files
const publicDir = path.resolve(__dirname, '../public');
if (fs.existsSync(publicDir)) {
    const publicFiles = fs.readdirSync(publicDir);
    let rogueFound = false;
    for (const f of publicFiles) {
        if (f.endsWith('.apk')) {
            fs.unlinkSync(path.join(publicDir, f));
            console.log(`⚠️ Eliminado archivo APK rebelde de public/: ${f}`);
            rogueFound = true;
        }
    }
    if (!rogueFound) {
        console.log(`🛡️ Regla de Oro Verificada: client/app/public/ libre de archivos APK.`);
    }
}

console.log("================================================================================\n");

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const apkSrc = path.join(rootDir, 'client', 'app', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const releaseDir = path.join(rootDir, 'release-assets');

if (!fs.existsSync(apkSrc)) {
    console.error('APK source does not exist:', apkSrc);
    process.exit(1);
}

const v88Apk = path.join(releaseDir, 'red-v88.0.0-release.apk');
const latestApk = path.join(releaseDir, 'red-latest.apk');

fs.copyFileSync(apkSrc, v88Apk);
fs.copyFileSync(apkSrc, latestApk);

const apkBuffer = fs.readFileSync(latestApk);
const sha256 = crypto.createHash('sha256').update(apkBuffer).digest('hex').toUpperCase();
const sizeMB = (apkBuffer.length / (1024 * 1024)).toFixed(2);

console.log(`APK Size: ${apkBuffer.length} bytes (${sizeMB} MB)`);
console.log(`SHA256: ${sha256}`);

const sumsContent = `${sha256}  red-v88.0.0-release.apk\n${sha256}  red-latest.apk\n`;
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), sumsContent, 'utf8');
fs.writeFileSync(path.join(releaseDir, 'RED-v88.0.0.apk.sha256'), sha256 + '\n', 'utf8');

// Update version.ts SHA256
const versionTsPath = path.join(rootDir, 'client', 'app', 'src', 'lib', 'version.ts');
let versionTs = fs.readFileSync(versionTsPath, 'utf8');
versionTs = versionTs.replace(/RED_APK_SHA256\s*=\s*"[^"]+"/, `RED_APK_SHA256 = "${sha256}"`);
fs.writeFileSync(versionTsPath, versionTs, 'utf8');

console.log('✅ release-assets and version.ts synchronized successfully with SHA256:', sha256);

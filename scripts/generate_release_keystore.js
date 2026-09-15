/**
 * generate_release_keystore.js
 * 
 * Genera un almacén de claves (Keystore) de producción de 4096 bits para firmar
 * legalmente artefactos de Android (AAB para Google Play y APK para Aptoide/F-Droid).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const keystorePath = path.join(rootDir, 'client', 'app', 'android', 'red-release.keystore');
const keytoolPath = 'C:\\Users\\darck\\.jdk\\jbr21\\bin\\keytool.exe';

const KEY_ALIAS = 'red-release-key';
const KEY_PASS = 'red_sovereign_release_2026';
const DNAME = 'CN=RED Sovereign Foundation, OU=Tactical Mesh OS, O=RED Network, L=Lima, ST=Lima, C=PE';
const VALIDITY_DAYS = 10950; // 30 años (hasta 2056, superando holgadamente el requisito de Google Play)

console.log('======================================================================');
console.log('🔐 GENERADOR DE KEYSTORE DE PRODUCCIÓN RED (4096-BIT RSA)');
console.log('======================================================================\n');

if (fs.existsSync(keystorePath)) {
    console.log(`ℹ️ El keystore ya existe en: ${keystorePath}`);
} else {
    console.log(`🔨 Generando nuevo Keystore de producción en:\n   ${keystorePath}\n`);
    const cmd = `"${keytoolPath}" -genkeypair -v -keystore "${keystorePath}" -alias "${KEY_ALIAS}" -keyalg RSA -keysize 4096 -validity ${VALIDITY_DAYS} -storepass "${KEY_PASS}" -keypass "${KEY_PASS}" -dname "${DNAME}"`;
    try {
        execSync(cmd, { stdio: 'inherit' });
        console.log('\n✅ Keystore de producción generado exitosamente.');
    } catch (err) {
        console.error('\n❌ Error al generar keystore:', err.message);
        process.exit(1);
    }
}

// Imprimir huellas dactilares para Google Play Console
console.log('\n🔍 Huellas digitales del Certificado X.509 (para Google Play & Aptoide):');
try {
    const certOutput = execSync(`"${keytoolPath}" -list -v -keystore "${keystorePath}" -alias "${KEY_ALIAS}" -storepass "${KEY_PASS}"`, { encoding: 'utf8' });
    const sha256Match = certOutput.match(/SHA256:\s*([A-F0-9:]+)/i);
    const sha1Match = certOutput.match(/SHA1:\s*([A-F0-9:]+)/i);
    if (sha256Match) console.log(`   SHA-256: ${sha256Match[1]}`);
    if (sha1Match) console.log(`   SHA-1:   ${sha1Match[1]}`);
} catch (e) {
    console.log('   (No se pudo listar el certificado)');
}

console.log('\n🎯 Keystore configurado y listo para compilación de producción.');

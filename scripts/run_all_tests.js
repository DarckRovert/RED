#!/usr/bin/env node
/**
 * run_all_tests.js — RED Sovereign Mesh OS Unified Test Runner
 * 
 * Orquestador Integral de Pruebas de Resiliencia, Bio-Cibernética y Conmutación:
 * 1. Pre-build hygiene & SSOT version parity.
 * 2. Compilación estática TypeScript (tsc --noEmit).
 * 3. Auditoría estricta de 11/11 idiomas al 100%.
 * 4. Ejecución paralela/secuencial de todas las 130 suites de resiliencia en client/app/scripts/test-*.js.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENT_APP = path.join(ROOT_DIR, 'client', 'app');
const SCRIPTS_DIR = path.join(CLIENT_APP, 'scripts');

console.log('\n' + '='.repeat(80));
console.log('🛡️  RED SOVEREIGN MESH OS — SUITE COMPLETA DE PRUEBAS & RESILIENCIA');
console.log('='.repeat(80) + '\n');

const startTime = Date.now();

// 1. Verificación de Higiene Pre-Build
console.log('📋 [PASO 1/4] Verificando Higiene Pre-Build y Paridad SSOT...');
try {
  execSync('node scripts/pre_build_check.js', { cwd: ROOT_DIR, stdio: 'inherit' });
} catch (err) {
  console.error('❌ Error en verificación de higiene pre-build.');
  process.exit(1);
}

// 2. Compilación Estática TypeScript
console.log('\n🔍 [PASO 2/4] Verificando Compilación Estática TypeScript (tsc --noEmit)...');
try {
  execSync('node node_modules/typescript/bin/tsc --noEmit', { cwd: CLIENT_APP, stdio: 'inherit' });
  console.log('✅ Compilación TypeScript sin errores (0 fallos).');
} catch (err) {
  console.error('❌ Fallo en compilación TypeScript.');
  process.exit(1);
}

// 3. Auditoría de Traducciones
console.log('\n🌍 [PASO 3/4] Auditando Cobertura de Traducción (11/11 locales)...');
try {
  execSync('node scripts/audit_translations.js', { cwd: CLIENT_APP, stdio: 'inherit' });
} catch (err) {
  console.error('❌ Fallo en auditoría de traducciones.');
  process.exit(1);
}

// 4. Ejecución de todas las suites de prueba en client/app/scripts/test-*.js
console.log('\n⚡ [PASO 4/4] Ejecutando todas las suites de resiliencia en client/app/scripts/...');
const testFiles = fs.readdirSync(SCRIPTS_DIR)
  .filter(f => f.startsWith('test-') && (f.endsWith('.js') || f.endsWith('.mjs')))
  .sort();

console.log(`Encontradas ${testFiles.length} suites de prueba.\n`);

let passedCount = 0;
const failedTests = [];

for (let i = 0; i < testFiles.length; i++) {
  const file = testFiles[i];
  const progress = `[${String(i + 1).padStart(3, ' ')}/${testFiles.length}]`;
  process.stdout.write(`  ${progress} ${file.padEnd(52, ' ')} `);

  const tStart = Date.now();
  try {
    execSync(`node scripts/${file}`, {
      cwd: CLIENT_APP,
      stdio: 'pipe',
      timeout: 35000,
    });
    const elapsed = Date.now() - tStart;
    console.log(`✅ PASS (${elapsed}ms)`);
    passedCount++;
  } catch (err) {
    const elapsed = Date.now() - tStart;
    console.log(`❌ FAIL (${elapsed}ms)`);
    const output = (err.stderr || err.stdout || '').toString();
    failedTests.push({ file, output: output.slice(-600) });
  }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n' + '='.repeat(80));
console.log(`📊 RESUMEN FINAL: ${passedCount}/${testFiles.length} suites superadas en ${totalTime}s`);
console.log('='.repeat(80));

if (failedTests.length > 0) {
  console.error(`\n❌ Se encontraron ${failedTests.length} fallos:`);
  failedTests.forEach(f => {
    console.error(`\n--- Fallo en: ${f.file} ---`);
    console.error(f.output);
  });
  process.exit(1);
} else {
  console.log('\n🏆 ¡TODAS LAS SUITES DE PRUEBA COMPLETADAS CON ÉXITO AL 100%!');
  process.exit(0);
}

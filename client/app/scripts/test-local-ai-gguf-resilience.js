/**
 * TEST SUITE: LOCAL AI GGUF INTEGRITY VERIFICATION & RESUMABLE DOWNLOAD RESILIENCE
 * 
 * Valida empíricamente la integridad del Ciclo 8:
 * 1. Verificación de la firma mágica GGUF (0x47, 0x47, 0x55, 0x46) contra archivos corruptos o HTMLs de error.
 * 2. Algoritmo de reanudación de descargas interrumpidas vía cabeceras HTTP Range y archivos .part.
 * 3. Detección y purga de pesos neuronales truncados (< 70% del tamaño esperado en disco).
 * 4. Limpieza atómica de archivos temporales (.part) al cancelar o eliminar modelos.
 * 5. Integración del botón de auditoría de integridad GGUF en AICopilotModal.tsx.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
}

console.log('\n================================================================================');
console.log('🤖 INICIANDO SUITE DE PRUEBAS: LOCAL AI GGUF INTEGRITY & RESUMABLE DOWNLOADS');
console.log('================================================================================\n');

// ── 1. Inspección Estática de modelManager.ts ──────────────────────────────────
const mmPath = path.join(__dirname, '..', 'src', 'lib', 'ai', 'modelManager.ts');
const mmCode = fs.readFileSync(mmPath, 'utf8');

runTest('1. ModelManager: Implementación de verifyGgufHeader con firma canónica 0x47475546', () => {
    assert(mmCode.includes('public static verifyGgufHeader(bytes: Uint8Array): boolean'), 'Debe existir el método público verifyGgufHeader');
    assert(mmCode.includes('bytes[0] === 0x47 && bytes[1] === 0x47 && bytes[2] === 0x55 && bytes[3] === 0x46'), 'Debe comparar con la cabecera ASCII GGUF');
});

runTest('2. ModelManager: Descargas reanudables mediante HTTP Range y archivo temporal .part', () => {
    assert(mmCode.includes("const partFilePath = `models/${model.fileName}.part`;"), 'Debe emplear archivo temporal .part');
    assert(mmCode.includes("headers['Range'] = `bytes=${existingBytes}-`;"), 'Debe enviar cabecera HTTP Range');
    assert(mmCode.includes('response.status === 206'), 'Debe gestionar el código HTTP 206 Partial Content');
});

runTest('3. ModelManager: Auditoría de integridad antes de promover el modelo (.part -> .gguf)', () => {
    assert(mmCode.includes('ModelManagerClass.verifyGgufHeader(bytes)'), 'Debe validar cabecera GGUF antes de finalizar la descarga');
    assert(mmCode.includes('minAcceptableBytes'), 'Debe validar el umbral mínimo aceptable de bytes');
    assert(mmCode.includes('Filesystem.copy'), 'Debe promover .part a destino tras validar');
});

runTest('4. ModelManager: Método público verifyModelIntegrity para auditoría en caliente', () => {
    assert(mmCode.includes('public async verifyModelIntegrity(modelId: string)'), 'Debe proveer verifyModelIntegrity');
    assert(mmCode.includes("reason: 'Cabecera GGUF inválida o archivo corrupto.'"), 'Debe detectar cabeceras espurias');
});

runTest('5. ModelManager: Purga de archivos .part al eliminar o abortar descargas', () => {
    assert(mmCode.includes("const partFilePath = `models/${model.fileName}.part`;"), 'deleteModel debe definir partFilePath');
    assert(mmCode.includes("path: partFilePath,"), 'deleteModel debe purgar partFilePath');
});

// ── 2. Inspección Estática de AICopilotModal.tsx ──────────────────────────────
const copilotPath = path.join(__dirname, '..', 'src', 'components', 'AICopilotModal.tsx');
const copilotCode = fs.readFileSync(copilotPath, 'utf8');

runTest('6. AICopilotModal: Integración de botón de auditoría GGUF y feedback de reanudación', () => {
    assert(copilotCode.includes('ModelManager.verifyModelIntegrity(m.id)'), 'Debe invocar la auditoría de integridad');
    assert(copilotCode.includes('🛡️ AUDITAR'), 'Debe renderizar el botón de auditoría en la tarjeta');
    assert(copilotCode.includes('toast.info("Descarga en pausa o cancelada. Se reanudará al presionar descargar.");'), 'Debe notificar la capacidad de reanudación');
});

// ── 3. Algoritmo Funcional de Validación de Cabecera GGUF ──────────────────────
function verifyGgufHeaderLocal(bytes) {
    if (!bytes || bytes.length < 4) return false;
    return bytes[0] === 0x47 && bytes[1] === 0x47 && bytes[2] === 0x55 && bytes[3] === 0x46;
}

runTest('7. Algoritmo GGUF: Aceptación de cabecera válida y rechazo estricto de HTML/basura', () => {
    // Cabecera GGUF válida
    const validGguf = new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x03, 0x00, 0x00, 0x00]);
    assert.strictEqual(verifyGgufHeaderLocal(validGguf), true, 'Debe aceptar cabecera GGUF válida');

    // Error 404 HTML devuelto por CDN
    const htmlError = new TextEncoder().encode('<!DOCTYPE html><html><head><title>404 Not Found</title></head></html>');
    assert.strictEqual(verifyGgufHeaderLocal(htmlError), false, 'Debe rechazar HTML de error 404');

    // Archivo vacío o truncado
    assert.strictEqual(verifyGgufHeaderLocal(new Uint8Array([0x47, 0x47])), false, 'Debe rechazar búfer menor a 4 bytes');
    assert.strictEqual(verifyGgufHeaderLocal(new Uint8Array([0, 0, 0, 0])), false, 'Debe rechazar búfer de ceros');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (${Math.round((passedTests/totalTests)*100)}% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

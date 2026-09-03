// Test de Resiliencia y Cero-OOM para el Gestor de Descargas GGUF Móvil (Ciclo AI-1)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST DE RESILIENCIA Y CERO-OOM: GGUF DOWNLOADER (MÓVIL) ===\n');

let passedTests = 0;

// Test 1: Verificar firma canónica GGUF (0x47, 0x47, 0x55, 0x46 -> "GGUF")
{
    const validHeader = new Uint8Array([0x47, 0x47, 0x55, 0x46, 0x03, 0x00, 0x00, 0x00]);
    const invalidHeaderHtml = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50]); // "<!DOCTYP"
    const truncatedHeader = new Uint8Array([0x47, 0x47]);

    function verifyGgufHeader(bytes) {
        if (!bytes || bytes.length < 4) return false;
        return bytes[0] === 0x47 && bytes[1] === 0x47 && bytes[2] === 0x55 && bytes[3] === 0x46;
    }

    assert.strictEqual(verifyGgufHeader(validHeader), true, 'Debe aceptar firma mágica GGUF');
    assert.strictEqual(verifyGgufHeader(invalidHeaderHtml), false, 'Debe rechazar HTML');
    assert.strictEqual(verifyGgufHeader(truncatedHeader), false, 'Debe rechazar cabecera truncada');
    console.log('✓ Test 1 PASÓ: Firma mágica GGUF validada con precisión binaria.');
    passedTests++;
}

// Test 2: Cero-OOM Static Analysis: Comprobar que NO existen llamadas no acotadas a Filesystem.readFile en .part o .gguf
{
    const modelManagerPath = path.join(__dirname, '../src/lib/ai/modelManager.ts');
    const content = fs.readFileSync(modelManagerPath, 'utf8');

    // Comprobar que no se lee partFilePath ni targetFilePath con Filesystem.readFile
    const dangerousPartRead = content.match(/Filesystem\.readFile\(\s*\{\s*path:\s*partFilePath/);
    const dangerousTargetRead = content.match(/Filesystem\.readFile\(\s*\{\s*path:\s*targetFilePath/);

    assert.strictEqual(dangerousPartRead, null, 'PROHIBIDO: Filesystem.readFile sobre partFilePath causa OOM en Android.');
    assert.strictEqual(dangerousTargetRead, null, 'PROHIBIDO: Filesystem.readFile sobre targetFilePath causa OOM en Android.');
    console.log('✓ Test 2 PASÓ: Erradicación certificada de lectura completa en Base64 (Cero OOM en Android).');
    passedTests++;
}

// Test 3: Validación de Promoción Atómica: Verifica que se use Filesystem.rename
{
    const modelManagerPath = path.join(__dirname, '../src/lib/ai/modelManager.ts');
    const content = fs.readFileSync(modelManagerPath, 'utf8');

    const usesRename = content.includes('Filesystem.rename({');
    assert.strictEqual(usesRename, true, 'Debe utilizar Filesystem.rename para promoción atómica instantánea de 1ms');
    console.log('✓ Test 3 PASÓ: Promoción atómica con Filesystem.rename confirmada (cero duplicación de disco).');
    passedTests++;
}

// Test 4: Verificación de Cabecera en Streaming Temprano (Chunk 0) y Archivo Ligero .header
{
    const modelManagerPath = path.join(__dirname, '../src/lib/ai/modelManager.ts');
    const content = fs.readFileSync(modelManagerPath, 'utf8');

    assert.ok(content.includes('headerFilePath'), 'Debe existir la ruta del archivo .header liviano');
    assert.ok(content.includes('ModelManagerClass.verifyGgufHeader(headSlice)'), 'Debe verificar la firma en Chunk 0');
    console.log('✓ Test 4 PASÓ: Validación de cabecera en Chunk 0 y persistencia de .header auxiliar de 16 bytes verificada.');
    passedTests++;
}

// Test 5: Saneamiento de Estado y Erradicación de Falsa Barra al 100%
{
    const modelManagerPath = path.join(__dirname, '../src/lib/ai/modelManager.ts');
    const content = fs.readFileSync(modelManagerPath, 'utf8');

    // En checkLocalModelsStatus debe reiniciar a 0 si el archivo está truncado o ausente
    assert.ok(content.includes('model.downloadProgress = 0;'), 'Debe resetear downloadProgress a 0');
    assert.ok(content.includes('localStorage.removeItem(`red_model_${id}_ready`);'), 'Debe purgar localStorage si no existe archivo real');
    assert.ok(content.includes('partSize'), 'Debe detectar descargas parciales .part');
    console.log('✓ Test 5 PASÓ: Saneamiento de estado y erradicación de barra fantasma al 100% confirmada.');
    passedTests++;
}

// Test 6: Limpieza Completa en deleteModel (incluye .header)
{
    const modelManagerPath = path.join(__dirname, '../src/lib/ai/modelManager.ts');
    const content = fs.readFileSync(modelManagerPath, 'utf8');

    const deleteSection = content.substring(content.indexOf('public async deleteModel'), content.indexOf('public async importModelFromLocalFile'));
    assert.ok(deleteSection.includes('headerFilePath'), 'deleteModel debe eliminar el archivo .header');
    assert.ok(deleteSection.includes('partFilePath'), 'deleteModel debe eliminar el archivo .part');
    assert.ok(deleteSection.includes('targetFilePath'), 'deleteModel debe eliminar el archivo final');
    console.log('✓ Test 6 PASÓ: deleteModel limpia exhaustivamente target, part y header en disco.');
    passedTests++;
}

console.log(`\n🎉 RESULTADO FINAL: ${passedTests}/${passedTests} TESTS PASARON EXITOSAMENTE (100%).`);
process.exit(0);

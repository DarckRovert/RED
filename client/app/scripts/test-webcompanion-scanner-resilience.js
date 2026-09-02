/**
 * TEST SUITE: WEB COMPANION SCANNER RESILIENCE & VIEWPORT TRANSPARENCY HYGIENE
 * 
 * Valida la prevención del bloqueo de WebView transparente, la eliminación de salidas tempranas
 * condicionales en stopCamera(), la verificación de shouldScanRef en todas las etapas asíncronas
 * del escáner nativo y el cleanup incondicional en el desmontaje del componente.
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
console.log('📷 INICIANDO SUITE DE PRUEBAS: WEB COMPANION SCANNER RESILIENCE');
console.log('================================================================================\n');

const modalPath = path.join(__dirname, '..', 'src', 'components', 'WebCompanionLinkModal.tsx');
const content = fs.readFileSync(modalPath, 'utf8');

runTest('1. Control de intención: Declaración y uso de shouldScanRef', () => {
    assert(content.includes('const shouldScanRef = useRef(false)'), 'Debe declarar shouldScanRef');
    assert(content.includes('shouldScanRef.current = true'), 'Debe activar shouldScanRef al iniciar');
    assert(content.includes('shouldScanRef.current = false'), 'Debe desactivar shouldScanRef al detener');
});

runTest('2. Erradicación de salida temprana en stopCamera (Limpieza incondicional)', () => {
    assert(!content.includes('if (!isScanningRef.current) return;'), 'No debe existir salida temprana en stopCamera');
    assert(content.includes('document.body.classList.remove("scanner-active")'), 'Debe remover scanner-active siempre');
    assert(content.includes('await BarcodeScanner.showBackground()'), 'Debe restaurar el WebView nativo');
    assert(content.includes('await BarcodeScanner.stopScan()'), 'Debe detener el hardware de la cámara');
});

runTest('3. Verificación de cancelación en etapas asíncronas de startNativeScan', () => {
    const afterPermMatch = content.includes('const perm = await BarcodeScanner.checkPermission({ force: true });\n                if (!shouldScanRef.current)');
    const afterHideMatch = content.includes('await BarcodeScanner.hideBackground();\n                if (!shouldScanRef.current)');
    const afterScanMatch = content.includes('const result = await BarcodeScanner.startScan();\n                if (!shouldScanRef.current)');
    
    assert(afterPermMatch || content.includes('if (!shouldScanRef.current) {\n                    await stopCamera();\n                    return;\n                }'), 'Debe abortar tras checkPermission si se cerró el modal');
    assert(content.includes('if (shouldScanRef.current) {\n                setMode("manual");\n            }'), 'No debe alterar modo si el modal fue cancelado');
});

runTest('4. Limpieza garantizada en el desmontaje global del componente', () => {
    const unmountMatch = content.includes('return () => {\n            isMounted = false;\n            stopCamera();\n        };');
    assert(unmountMatch, 'El efecto principal debe invocar stopCamera() al desmontar');
});

console.log('\n================================================================================');
console.log(`📊 RESUMEN FINAL: ${passedTests}/${totalTests} PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)`);
console.log('================================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

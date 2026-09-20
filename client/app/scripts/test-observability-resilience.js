/**
 * test-observability-resilience.js
 * 
 * Suite de verificación para validar:
 * 1. PqcCryptoEngine: CSPRNG fail-closed estricto (rechazo de Math.random).
 * 2. HippocampalEpisodicEngine: Persistencia debounced y vectores compactos Hex.
 * 3. TheoryOfMindEpistemicEngine: Límite estricto LRU (MAX_ASSESSED_PEERS) y persistencia debounced.
 * 4. ChatHeader.tsx: Desbloqueo de audio vía AudioContextManager sin instancias zombis.
 * 5. HumanBrainOrchestrator: Regulador de frecuencia de telemetría (UI_THROTTLE_MS).
 * 6. MaleCnsConnectomeHUD.tsx: Desacoplamiento de Canvas RAF mediante refs mutables.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\n================================================================================');
console.log('🔬 VERIFICACIÓN DE OBSERVABILIDAD, RESILIENCIA & BLINDAJE ARQUITECTÓNICO');
console.log('================================================================================\n');

const pqcCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'crypto', 'PqcCryptoEngine.ts'), 'utf8');
const hipCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'neuro', 'human', 'HippocampalEpisodicEngine.ts'), 'utf8');
const tomCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'neuro', 'human', 'TheoryOfMindEpistemicEngine.ts'), 'utf8');
const orchCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'neuro', 'human', 'HumanBrainOrchestrator.ts'), 'utf8');
const chatHeaderCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'chat', 'ChatHeader.tsx'), 'utf8');
const hudCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'MaleCnsConnectomeHUD.tsx'), 'utf8');
const routerCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts'), 'utf8');

// 1. PqcCryptoEngine CSPRNG Fail-Closed
runTest('1.1 PqcCryptoEngine: Erradicación de Math.random en generación de llaves (CWE-338)', () => {
  assert(!pqcCode.includes('Math.random() * 256'), 'No debe existir Math.random() para generación de bytes de claves');
  assert(pqcCode.includes('throw new Error("FATAL: Cryptographically secure random number generator'), 'Debe arrojar excepción fatal si CSPRNG no está disponible');
});

// 2. Hippocampal CA3 Persistencia No-Bloqueante & Compactación
runTest('2.1 HippocampalEpisodicEngine: Persistencia debounced y soporte de fragmentos binarios', () => {
  assert(hipCode.includes('schedulePersist()'), 'Debe contar con schedulePersist para diferir I/O síncrono');
  assert(hipCode.includes('flushPersistence()'), 'Debe exponer flushPersistence para guardado seguro ante beforeunload');
  assert(hipCode.includes('rawFragment: string | Uint8Array'), 'Debe soportar tanto strings como Uint8Array en MutilatedPacket');
  assert(hipCode.includes('generateSparseFeatureVector(input: string | Uint8Array)'), 'generateSparseFeatureVector debe admitir Uint8Array');
});

// 3. TheoryOfMind LRU & Persistencia
runTest('3.1 TheoryOfMindEpistemicEngine: Límite de capacidad LRU y persistencia debounced', () => {
  assert(tomCode.includes('MAX_ASSESSED_PEERS = 200'), 'Debe declarar cota máxima de 200 pares auditados');
  assert(tomCode.includes('schedulePersist()'), 'Debe posponer escritura en disco con schedulePersist');
  assert(tomCode.includes('this.peerAssessments.delete(oldestKey)'), 'Debe implementar desalojo LRU ante saturación');
});

// 4. ChatHeader AudioContext Leak Prevention
runTest('4.1 ChatHeader.tsx: Desbloqueo de llamadas mediante AudioContextManager', () => {
  assert(chatHeaderCode.includes('AudioContextManager.setupUserGestureUnlock()'), 'startAudioCall y startVideoCall deben usar setupUserGestureUnlock');
  assert(chatHeaderCode.includes('AudioContextManager.getSharedContext()'), 'Debe usar getSharedContext en lugar de new AudioContextClass');
  assert(!chatHeaderCode.includes('new AudioContextClass()'), 'No deben existir instancias huérfanas de AudioContextClass');
});

// 5. HumanBrainOrchestrator Telemetry Throttle
runTest('5.1 HumanBrainOrchestrator: Gobernador de cadencia (UI_THROTTLE_MS = 100)', () => {
  assert(orchCode.includes('UI_THROTTLE_MS = 100'), 'Debe definir gobernador de 100 ms (~10 Hz)');
  assert(orchCode.includes('notifyThrottleTimer'), 'Debe manejar temporizador defensivo para despacho en lote');
});

// 6. MaleCnsConnectomeHUD 3D Canvas RAF Decoupling
runTest('6.1 MaleCnsConnectomeHUD.tsx: RAF continuo desacoplado del ciclo de vida de React', () => {
  assert(hudCode.includes('const nodesRef = useRef<ConnectomeNode[]>(nodes)'), 'Debe sincronizar nodesRef');
  assert(hudCode.includes('const edgesRef = useRef<ConnectomeEdge[]>(edges)'), 'Debe sincronizar edgesRef');
  assert(hudCode.includes('cancelAnimationFrame(animationId);\n    };\n  }, []);'), 'El efecto de render 3D debe tener dependencias [] (persistente durante el montaje)');
});

// 7. MeshRouter Safe Binary Ingestion
runTest('7.1 MeshRouter: Decodificación defensiva para paquetes binarios vs texto', () => {
  assert(routerCode.includes("new TextDecoder('utf-8', { fatal: true })"), 'Debe probar decodificación estricta antes de forzar string');
});

console.log('\n================================================================================');
console.log(`TEST RESULTS: ${passed}/${passed + failed} TESTS PASSED (${failed === 0 ? '100% SUCCESS' : 'FAILURES DETECTED'})`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}

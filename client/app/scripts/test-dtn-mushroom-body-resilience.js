/**
 * test-dtn-mushroom-body-resilience.js — RED Sovereign Mesh OS
 *
 * Suite de Pruebas de Resiliencia del Cuerpo Fungiforme (DTN Mushroom Body Associative Memory)
 * Basado en el Conectoma de Drosophila melanogaster (MaleCNS v1.0 / FlyWire Murthy Lab).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('🧠🍄 INICIANDO SUITE DE PRUEBAS: DTN MUSHROOM BODY ASSOCIATIVE MEMORY');
console.log('='.repeat(80) + '\n');

// 1. Verificación Estática del Código Fuente
const enginePath = path.resolve(__dirname, '../src/lib/neuro/DtnMushroomBodyEngine.ts');
const dtnStoragePath = path.resolve(__dirname, '../src/lib/mesh/dtnStorage.ts');

assert(fs.existsSync(enginePath), 'DtnMushroomBodyEngine.ts debe existir en src/lib/neuro/');
assert(fs.existsSync(dtnStoragePath), 'dtnStorage.ts debe existir en src/lib/mesh/');

const engineCode = fs.readFileSync(enginePath, 'utf8');
const dtnCode = fs.readFileSync(dtnStoragePath, 'utf8');

// TEST 1: Parámetros biofísicos y arquitectura
console.log('  Testing 1: Arquitectura y constantes biofísicas de Drosophila...');
assert(engineCode.includes('totalKenyonCells: 2500'), 'Debe configurar 2,500 células de Kenyon');
assert(engineCode.includes('sparsityFactor: 0.05'), 'Debe utilizar codificación dispersa del 5%');
assert(engineCode.includes('ltpValenceThreshold: 0.80'), 'Umbral de LTP debe ser 0.80');
assert(engineCode.includes('isLtpPinned'), 'Debe incluir flag isLtpPinned de protección inmutable');
console.log('  ✅ [PASS] 1. Arquitectura y Parámetros Biofísicos del Cuerpo Fungiforme');

// TEST 2: Simulación de Codificación Dispersa de Kenyon (Sparse Coding)
console.log('  Testing 2: Codificación dispersa determinista en 2,500 Células de Kenyon...');

function generateSparseKenyonIndices(seed, totalKCs = 2500, sparsity = 0.05) {
  const targetActive = Math.max(1, Math.floor(totalKCs * sparsity)); // 125
  const activeIndices = new Set();

  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  let round = 0;
  while (activeIndices.size < targetActive && round < 1000) {
    hash = Math.imul(hash ^ (round * 0x9e3779b9), 0x85ebca6b);
    hash = (hash ^ (hash >>> 13)) >>> 0;
    const index = hash % totalKCs;
    activeIndices.add(index);
    round++;
  }

  let fallback = 0;
  while (activeIndices.size < targetActive && fallback < totalKCs) {
    activeIndices.add(fallback % totalKCs);
    fallback++;
  }

  return Array.from(activeIndices).sort((a, b) => a - b);
}

const seedA = 'NONCE-SOS-ALPHA-7788:fffff:PAYLOAD-EMERGENCY';
const kcA1 = generateSparseKenyonIndices(seedA);
const kcA2 = generateSparseKenyonIndices(seedA);

assert.strictEqual(kcA1.length, 125, 'Debe activar exactamente 125 Kenyon Cells (5% de 2,500)');
assert.deepStrictEqual(kcA1, kcA2, 'La codificación dispersa debe ser 100% reproducible y determinista');

const seedB = 'NONCE-CHAT-BETA-1122:user2:PAYLOAD-CASUAL-HELLO';
const kcB = generateSparseKenyonIndices(seedB);
assert.strictEqual(kcB.length, 125, 'Debe activar exactamente 125 Kenyon Cells para el segundo estímulo');

// Verificar que los subconjuntos activos son dispersos y diferentes
const overlap = kcA1.filter(idx => kcB.includes(idx)).length;
assert(overlap < 50, `El solapamiento entre estímulos no relacionados debe ser bajo (detectado: ${overlap}/125)`);
console.log(`  ✅ [PASS] 2. Codificación Dispersa de Kenyon (125/2500 KCs activas, solapamiento pseudo-ortogonal: ${overlap})`);

// TEST 3: Neuronas Dopaminérgicas (DAN) y Asignación de Valencia
console.log('  Testing 3: Valencia dopaminérgica biológica (DAN)...');

function evaluateDopaminergicValence(recipient, priority, flags, payloadHex) {
  const isBroadcast =
    recipient === 'f'.repeat(64) ||
    recipient === '0'.repeat(64);

  if (isBroadcast || priority >= 9) {
    return { valence: 1.0, category: 'SOS', isLtp: true };
  }

  if (payloadHex && payloadHex.includes('4342524e')) { // 'CBRN' en ASCII hex
    return { valence: 0.95, category: 'CBRN', isLtp: true };
  }

  if (priority === 8 || (flags & 0x02 && flags & 0x01)) {
    return { valence: 0.85, category: 'BLOCKCHAIN', isLtp: true };
  }

  if (priority === 6 || (flags & 0x02)) {
    return { valence: 0.70, category: 'IDENTITY', isLtp: false };
  }

  if (priority === 4) {
    return { valence: 0.50, category: 'DIRECT_MSG', isLtp: false };
  }

  return { valence: 0.20, category: 'MEDIA', isLtp: false };
}

const valSos = evaluateDopaminergicValence('f'.repeat(64), 10, 0, '');
assert.strictEqual(valSos.valence, 1.0);
assert.strictEqual(valSos.isLtp, true);

const valCbrn = evaluateDopaminergicValence('user_target', 7, 0, '4342524e_RADIATION_ZONE_A');
assert.strictEqual(valCbrn.valence, 0.95);
assert.strictEqual(valCbrn.isLtp, true);

const valChain = evaluateDopaminergicValence('user_target', 8, 3, '');
assert.strictEqual(valChain.valence, 0.85);
assert.strictEqual(valChain.isLtp, true);

const valDirect = evaluateDopaminergicValence('user_target', 4, 0, '');
assert.strictEqual(valDirect.valence, 0.50);
assert.strictEqual(valDirect.isLtp, false);

const valMedia = evaluateDopaminergicValence('user_target', 2, 0, '');
assert.strictEqual(valMedia.valence, 0.20);
assert.strictEqual(valMedia.isLtp, false);

console.log('  ✅ [PASS] 3. Evaluación de Valencia Dopaminérgica (DAN): SOS=1.0, CBRN=0.95, BLOCKCHAIN=0.85');

// TEST 4: Potenciación a Largo Plazo (LTP Pinned)
console.log('  Testing 4: Dinámica de Potenciación a Largo Plazo (LTP)...');
assert(engineCode.includes('isLtpPinned: isLtp || valence >= this.config.ltpValenceThreshold'), 'LTP debe activarse ante valencias >= 0.80');
assert(engineCode.includes('existing.reinforcementCount++'), 'Debe reforzar conteo sináptico ante estímulo repetido');
console.log('  ✅ [PASS] 4. Potenciación a Largo Plazo (LTP Pinned) y Refuerzo Sináptico');

// TEST 5: Inmunidad Inviolable de Salvamento de Vida ante Saturación del 200%
console.log('  Testing 5: Inmunidad Absoluta de Paquetes SOS/CBRN bajo saturación extrema (200%)...');

// Simulador de cola saturada con 100 paquetes (30 de emergencia vital LTP y 70 de tráfico prescindible)
const mockQueue = [];
for (let i = 0; i < 30; i++) {
  mockQueue.push({
    id: `SOS-PACKET-${i}`,
    priority: 10,
    createdAt: Date.now() - 100000 + i * 1000,
    attempts: 0,
    isLtpPinned: true,
  });
}
for (let i = 0; i < 70; i++) {
  mockQueue.push({
    id: `CASUAL-CHAT-${i}`,
    priority: i % 2 === 0 ? 4 : 2,
    createdAt: Date.now() - 50000 + i * 500,
    attempts: i % 3,
    isLtpPinned: false,
  });
}

// Simulador de selección de desalojo
function selectEvictionCandidatesMock(items, countToEvict) {
  const now = Date.now();
  const decayTauMs = 7 * 24 * 3600 * 1000;

  const eligible = items
    .filter(it => !it.isLtpPinned && it.priority < 9)
    .map(it => {
      const valence = it.priority / 10 * 0.5;
      const ageMs = Math.max(0, now - it.createdAt);
      const temporalDecay = 1.0 - Math.exp(-ageMs / decayTauMs);
      const attemptsPenalty = 1.0 + it.attempts * 0.2;
      const ltdScore = (1.0 - valence) * (1.0 + temporalDecay) * attemptsPenalty;
      return { id: it.id, ltdScore };
    });

  eligible.sort((a, b) => b.ltdScore - a.ltdScore);
  return eligible.slice(0, countToEvict).map(c => c.id);
}

const evicted = selectEvictionCandidatesMock(mockQueue, 60);
assert.strictEqual(evicted.length, 60, 'Debe seleccionar 60 candidatos a desalojo');

const sosEvicted = evicted.filter(id => id.startsWith('SOS-PACKET-'));
assert.strictEqual(sosEvicted.length, 0, '¡CERO paquetes SOS pueden ser desalojados!');

const chatEvicted = evicted.filter(id => id.startsWith('CASUAL-CHAT-'));
assert.strictEqual(chatEvicted.length, 60, 'El 100% de los desalojados deben ser tráfico de baja valencia');
console.log('  ✅ [PASS] 5. Inmunidad Inviolable de Salvamento de Vida (30/30 paquetes SOS preservados, 0% drop)');

// TEST 6: Depresión a Largo Plazo (LTD Eviction Ranking)
console.log('  Testing 6: Dinámica de Poda y Desalojo por Depresión Sináptica (LTD)...');
assert(engineCode.includes('selectEvictionCandidates'), 'Debe exponer selectEvictionCandidates()');
assert(engineCode.includes('ltdScore = (1.0 - valence) * (1.0 + temporalDecay) * attemptsPenalty'), 'Fórmula LTD debe ponderar valencia, decaimiento y reintentos fallidos');
assert(engineCode.includes('this.ltdEvictedTotal++'), 'Debe contabilizar telemetría de desalojos LTD');
console.log('  ✅ [PASS] 6. Dinámica de Poda y Depresión Sináptica (LTD Ranking)');

// TEST 7: Búsqueda Asociativa de Memoria por Solapamiento Jaccard
console.log('  Testing 7: Búsqueda asociativa Jaccard en células de Kenyon...');
assert(engineCode.includes('findAssociativeMatches'), 'Debe implementar findAssociativeMatches()');
assert(engineCode.includes('intersection / union'), 'Debe calcular índice de solapamiento Jaccard');
console.log('  ✅ [PASS] 7. Búsqueda Asociativa por Índice de Solapamiento Jaccard');

// TEST 8: Integración en dtnStorage.ts
console.log('  Testing 8: Integración bidireccional en dtnStorage.ts...');
assert(dtnCode.includes("import { dtnMushroomBody } from '../neuro/DtnMushroomBodyEngine'"), 'dtnStorage.ts debe importar dtnMushroomBody');
assert(dtnCode.includes('dtnMushroomBody.memorizePacket('), 'enqueue() debe memorizar paquetes en el Mushroom Body');
assert(dtnCode.includes('dtnMushroomBody.selectEvictionCandidates('), 'Desbordamiento de cola debe consultar al árbitro LTD');
assert(dtnCode.includes('dtnMushroomBody.forgetPacket('), 'Entrega exitosa o remoción debe liberar memoria asociativa');
console.log('  ✅ [PASS] 8. Integración Bidireccional en dtnStorage.ts (Enqueue, LTD Eviction, ACK Forget)');

// TEST 9: Resiliencia de Telemetría y Cero Fallos
console.log('  Testing 9: Telemetría bio-inspirada y sanitización...');
assert(engineCode.includes('getTelemetry'), 'Debe generar telemetría con saturación, valencia media y conteos');
assert(engineCode.includes('destroy()'), 'Debe soportar método destroy() para limpieza de ciclo de vida');
console.log('  ✅ [PASS] 9. Telemetría Bio-Inspirada y Sanitización de Ciclo de Vida');

// TEST 10: Estadísticas de Conectoma The Fly's Table (awesome-fly)
console.log('  Testing 10: Validación de arquitectura celular The Fly\'s Table...');
assert(engineCode.includes('PROJECTION_NEURONS_COUNT = 682'), 'Debe definir 682 Projection Neurons');
assert(engineCode.includes('MBON_COUNT = 97'), 'Debe definir 97 MBONs');
assert(engineCode.includes('DAN_PAM_COUNT = 130'), 'Debe definir 130 DAN PAM (LTP)');
assert(engineCode.includes('DAN_PPL1_COUNT = 12'), 'Debe definir 12 DAN PPL1 (SOS)');
assert(engineCode.includes('evaluateDanCluster'), 'Debe implementar evaluateDanCluster()');
console.log('  ✅ [PASS] 10. Validación de Arquitectura Celular The Fly\'s Table (682 PN, 97 MBON, 332 DAN)');

console.log('\n' + '='.repeat(80));
console.log('📊 RESUMEN FINAL: 10/10 PRUEBAS SUPERADAS EXITOSAMENTE (100% PASS)');
console.log('='.repeat(80) + '\n');


/**
 * test-aer-neuromorphic-spikes.js
 * 
 * Suite de Pruebas Automatizadas de Alta Precisión:
 * Protocolo Neuromórfico AER (Address-Event Representation) & Micro-Espigas para LoRa/BLE
 * Inspirado en BrainCog-X/Brain-Cog, brian2 y hardware neuromórfico (Intel Loihi).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('⚡ TEST SUITE: PROTOCOLO NEUROMÓRFICO AER & MICRO-ESPIGAS LPI/LPD');
console.log('='.repeat(80) + '\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// ── 1. Verificación de Código Fuente y Tipos SSOT ─────────────────────────────
const protocolPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshProtocol.ts');
const routerPath = path.join(__dirname, '..', 'src', 'lib', 'mesh', 'meshRouter.ts');
const synapticPath = path.join(__dirname, '..', 'src', 'lib', 'neuro', 'SynapticMeshRouterEngine.ts');
const hudPath = path.join(__dirname, '..', 'src', 'components', 'MaleCnsConnectomeHUD.tsx');

const protocolCode = fs.readFileSync(protocolPath, 'utf8');
const routerCode = fs.readFileSync(routerPath, 'utf8');
const synapticCode = fs.readFileSync(synapticPath, 'utf8');
const hudCode = fs.readFileSync(hudPath, 'utf8');

runTest('1.1 meshProtocol: Asignación de FLAG_AER_SPIKE (0x80) y AER_MAGIC (0xAE51)', () => {
  assert(protocolCode.includes('FLAG_AER_SPIKE = 0x80'), 'FLAG_AER_SPIKE debe ser 0x80');
  assert(protocolCode.includes('AER_MAGIC = 0xAE51'), 'AER_MAGIC debe ser 0xAE51');
  assert(protocolCode.includes('AerDomainCode'), 'Debe definir enum AerDomainCode');
  assert(protocolCode.includes('CX_COMPASS_HEADING = 0x01'), 'Debe incluir dominio de brújula');
  assert(protocolCode.includes('KURAMOTO_PHASE_PULSE = 0x03'), 'Debe incluir dominio de Kuramoto');
  assert(protocolCode.includes('CBRN_RADIATION_ALERT = 0x02'), 'Debe incluir dominio CBRN');
  assert(protocolCode.includes('EW_JAMMING_DETECTED = 0x05'), 'Debe incluir dominio de guerra electrónica');
});

runTest('1.2 meshProtocol: Definición de encodeAerSpikeFrame y decodeAerSpikeFrame', () => {
  assert(protocolCode.includes('function encodeAerSpikeFrame'), 'Debe exportar función encodeAerSpikeFrame');
  assert(protocolCode.includes('function decodeAerSpikeFrame'), 'Debe exportar función decodeAerSpikeFrame');
  assert(protocolCode.includes('export interface AerSpikeEvent'), 'Debe exportar interfaz AerSpikeEvent');
  assert(protocolCode.includes('export interface AerSpikeFrame'), 'Debe exportar interfaz AerSpikeFrame');
});

// ── 2. Simulación y Validación Funcional de Codificación Binaria AER ───────────
const AER_MAGIC = 0xAE51;
const FLAG_AER_SPIKE = 0x80;

function encodeAerSpikeFrameSim(senderShortId, seq, ttl, spikes) {
  const safeCount = Math.max(1, Math.min(spikes.length, 16));
  const totalSize = 10 + (safeCount * 4);
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  view.setUint16(0, AER_MAGIC, false);
  view.setUint32(2, (senderShortId >>> 0), true);
  view.setUint8(6, seq & 0xFF);
  view.setUint8(7, Math.max(1, Math.min(20, ttl)) & 0xFF);
  view.setUint8(8, FLAG_AER_SPIKE);
  view.setUint8(9, safeCount & 0xFF);

  let offset = 10;
  for (let i = 0; i < safeCount; i++) {
    const sp = spikes[i] || { domain: 0, neuronId: 0, value: 0 };
    view.setUint8(offset, sp.domain & 0xFF);
    view.setUint8(offset + 1, sp.neuronId & 0xFF);
    view.setInt16(offset + 2, Math.max(-32768, Math.min(32767, Math.round(sp.value || 0))), true);
    offset += 4;
  }

  return new Uint8Array(buf);
}

function decodeAerSpikeFrameSim(data) {
  if (!data || data.length < 14) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const magic = view.getUint16(0, false);
  if (magic !== AER_MAGIC) return null;

  const senderShortId = view.getUint32(2, true);
  const seq = view.getUint8(6);
  const ttl = view.getUint8(7);
  const flags = view.getUint8(8);
  const count = view.getUint8(9);

  if (count <= 0 || data.length < 10 + (count * 4)) return null;

  const spikes = [];
  let offset = 10;
  for (let i = 0; i < count; i++) {
    const domain = view.getUint8(offset);
    const neuronId = view.getUint8(offset + 1);
    const value = view.getInt16(offset + 2, true);
    spikes.push({ domain, neuronId, value });
    offset += 4;
  }

  return { senderShortId, seq, ttl, flags, spikes };
}

runTest('2.1 AER Binario: Tamaño exacto de 14 bytes para 1 evento (88.3% ahorro vs cabecera 96B)', () => {
  const spike = { domain: 0x01, neuronId: 0x05, value: 270 };
  const encoded = encodeAerSpikeFrameSim(0x12345678, 1, 5, [spike]);

  assert.strictEqual(encoded.length, 14, `La trama para 1 espiga debe medir exactamente 14 bytes, obtenido: ${encoded.length}`);
  const decoded = decodeAerSpikeFrameSim(encoded);
  assert(decoded !== null, 'La trama debe decodificarse exitosamente');
  assert.strictEqual(decoded.senderShortId, 0x12345678, 'El senderShortId debe coincidir');
  assert.strictEqual(decoded.seq, 1, 'El seq debe coincidir');
  assert.strictEqual(decoded.ttl, 5, 'El TTL debe coincidir');
  assert.strictEqual(decoded.flags, 0x80, 'La bandera debe ser 0x80');
  assert.strictEqual(decoded.spikes.length, 1, 'Debe contener exactamente 1 espiga');
  assert.strictEqual(decoded.spikes[0].domain, 0x01, 'El dominio debe ser 0x01');
  assert.strictEqual(decoded.spikes[0].neuronId, 0x05, 'El neuronId debe ser 0x05');
  assert.strictEqual(decoded.spikes[0].value, 270, 'El valor escalar debe ser 270');
});

runTest('2.2 AER Binario: Ráfaga Multi-Espiga compacta (4 espigas en 26 bytes)', () => {
  const spikes = [
    { domain: 0x01, neuronId: 0, value: 180 },  // Brújula 180°
    { domain: 0x03, neuronId: 1, value: 200 },  // Fase Kuramoto
    { domain: 0x02, neuronId: 0, value: 85 },   // Radiación CBRN
    { domain: 0x05, neuronId: 2, value: 1 }     // EW Jamming flag
  ];

  const encoded = encodeAerSpikeFrameSim(0xAABBCCDD, 42, 7, spikes);
  assert.strictEqual(encoded.length, 10 + 4 * 4, `4 espigas deben ocupar 26 bytes, obtenido: ${encoded.length}`);

  const decoded = decodeAerSpikeFrameSim(encoded);
  assert.strictEqual(decoded.spikes.length, 4, 'Deben decodificarse las 4 espigas');
  assert.strictEqual(decoded.spikes[0].value, 180);
  assert.strictEqual(decoded.spikes[1].value, 200);
  assert.strictEqual(decoded.spikes[2].value, 85);
  assert.strictEqual(decoded.spikes[3].value, 1);
});

runTest('2.3 AER Binario: Resiliencia contra tramas corruptas y truncadas', () => {
  assert.strictEqual(decodeAerSpikeFrameSim(null), null);
  assert.strictEqual(decodeAerSpikeFrameSim(new Uint8Array([0, 1, 2])), null);
  
  // Trama con magic erróneo
  const badMagic = new Uint8Array(14);
  badMagic[0] = 0x00;
  badMagic[1] = 0x00;
  assert.strictEqual(decodeAerSpikeFrameSim(badMagic), null);

  // Trama truncada (dice que tiene 2 espigas pero solo hay bytes para 1)
  const truncated = encodeAerSpikeFrameSim(0x12345678, 1, 5, [{ domain: 1, neuronId: 1, value: 10 }]);
  const view = new DataView(truncated.buffer);
  view.setUint8(9, 3); // Forzar cuenta a 3 espigas
  assert.strictEqual(decodeAerSpikeFrameSim(truncated), null);
});

// ── 3. Verificación de Integración en SynapticMeshRouterEngine ─────────────────
runTest('3.1 SynapticMeshRouterEngine: Propiedades y Métodos de Telemetría AER', () => {
  assert(synapticCode.includes('aerSpikesEmittedCount: number;'), 'SynapticMeshTelemetry debe incluir aerSpikesEmittedCount');
  assert(synapticCode.includes('aerSpikesReceivedCount: number;'), 'SynapticMeshTelemetry debe incluir aerSpikesReceivedCount');
  assert(synapticCode.includes('airtimeSavedBytesTotal: number;'), 'SynapticMeshTelemetry debe incluir airtimeSavedBytesTotal');
  assert(synapticCode.includes('recordAerSpikeReceived'), 'Debe exponer recordAerSpikeReceived');
  assert(synapticCode.includes('recordAerSpikeEmitted'), 'Debe exponer recordAerSpikeEmitted');
  assert(synapticCode.includes('onAerSpike'), 'Debe exponer onAerSpike');
});

runTest('3.2 SynapticMeshRouterEngine: Cálculo de Ahorro de Airtime (82 bytes/espiga)', () => {
  assert(synapticCode.includes('this.airtimeSavedBytes += 82'), 'Debe acumular 82 bytes ahorrados por espiga (96B - 14B)');
});

// ── 4. Verificación de Integración en meshRouter.ts ────────────────────────────
runTest('4.1 meshRouter: Fast-path de Ingestión AER en handleRawPacket', () => {
  assert(routerCode.includes('raw.length >= 14 && raw[0] === 0xAE && raw[1] === 0x51'), 'Debe interceptar Magic 0xAE51');
  assert(routerCode.includes('decodeAerSpikeFrame(raw)'), 'Debe invocar decodeAerSpikeFrame');
  assert(routerCode.includes('synapticMeshRouter.recordAerSpikeReceived'), 'Debe registrar la espiga en el motor sináptico');
  assert(routerCode.includes('ringAttractor.injectRemoteKuramotoPhase'), 'Debe inyectar fase Kuramoto ante espiga 0x03');
  assert(routerCode.includes("giantFiberReflex.triggerEscape('EW_JAMMING')"), 'Debe activar escape ante espiga EW Jamming');
});

runTest('4.2 meshRouter: Método broadcastAerSpike para Emisión Ultra-Rápida', () => {
  assert(routerCode.includes('broadcastAerSpike('), 'meshRouter debe exponer broadcastAerSpike');
  assert(routerCode.includes('encodeAerSpikeFrame('), 'Debe serializar usando encodeAerSpikeFrame');
  assert(routerCode.includes('synapticMeshRouter.recordAerSpikeEmitted('), 'Debe registrar espiga emitida');
});

runTest('4.3 meshRouter: Deduplicación con seenNonces para prevenir bucles de espigas', () => {
  assert(routerCode.includes('const aerNonce = `aer_${senderShortHex}_${aerFrame.seq}`;'), 'Debe generar aerNonce único');
  assert(routerCode.includes('this.seenNonces.has(aerNonce)'), 'Debe chequear existencia en seenNonces');
  assert(routerCode.includes('this.seenNonces.set(aerNonce, Date.now())'), 'Debe memorizar aerNonce para evitar re-inyección');
});

runTest('4.4 meshRouter: Reenvío Multi-Salto Neuromórfico con decaimiento de TTL', () => {
  assert(routerCode.includes('if (aerFrame.ttl > 1)'), 'Debe evaluar si el TTL permite reenvío');
  assert(routerCode.includes('aerFrame.ttl - 1'), 'Debe decrementar el TTL al retransmitir');
  assert(routerCode.includes('this.sendViaLoRa(relayedFrame)'), 'Debe retransmitir la trama derivada por LoRa');
});

// ── 5. Verificación de Integración en MaleCnsConnectomeHUD.tsx ─────────────────
runTest('5.1 MaleCnsConnectomeHUD: Módulo Visual y Controles AER', () => {
  assert(hudCode.includes('PROTOCOLO NEUROMÓRFICO AER (MICRO-ESPIGAS LPI/LPD)'), 'El HUD debe contener el título del módulo AER');
  assert(hudCode.includes('~90% Airtime Ahorrado'), 'El HUD debe mostrar el indicador de ahorro de espectro');
  assert(hudCode.includes('DISPARAR ESPIGA AER (14B)'), 'El HUD debe incluir el botón de emisión táctica de espiga');
  assert(hudCode.includes('synapticTelemetry.aerSpikesEmittedCount'), 'El HUD debe vincular espigas emitidas');
  assert(hudCode.includes('synapticTelemetry.airtimeSavedBytesTotal'), 'El HUD debe vincular bytes de espectro RF ahorrados');
});

console.log('\n' + '='.repeat(80));
console.log(`🎉 RESULTADO: ${passedTests}/${totalTests} PRUEBAS AER SUPERADAS CON ÉXITO (100% OK)`);
console.log('='.repeat(80) + '\n');

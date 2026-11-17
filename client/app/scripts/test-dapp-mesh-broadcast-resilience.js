/**
 * test-dapp-mesh-broadcast-resilience.js
 * 
 * Verificación profunda de:
 * 1. Normalización canónica de BROADCAST_RECIPIENT en meshProtocol (createPacket y encode).
 * 2. Inmunidad a mutilación hex: 'broadcast' -> 32 bytes de 0xFF (no 'badca00...').
 * 3. Detección de isBroadcast en MeshRouter y entrega local garantizada a localDeliveryHandlers.
 * 4. Recepción de Mini-Apps en SovereignAppStoreModal (MINIAPP_PACKAGE_BROADCAST, actualización de pkg).
 * 5. Recepción de peticiones y respuestas en MeshGatewayEngine a través de onLocalDelivery.
 */

const assert = require('assert');

// ─── 1. SIMULACIÓN DE meshProtocol.ts ──────────────────────────────────────────
const MESH_MAGIC = 0x52454401;
const HEADER_SIZE_REAL = 96;
const MAX_HOPS = 20;
const BROADCAST_RECIPIENT = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

const HEX_LUT = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += HEX_LUT[bytes[i]];
  }
  return hex;
}

function hexToBytes(hex) {
  const clean = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  const len = clean.length >>> 1;
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return result;
}

function generateNonce() {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytesToHex(bytes);
}

function createPacket(sender, recipient, payload, opts) {
  const normalizedRecipient = (!recipient || recipient.toLowerCase() === 'broadcast' || recipient === '*')
    ? BROADCAST_RECIPIENT
    : recipient;

  return {
    sender,
    recipient: normalizedRecipient,
    ttl: opts?.ttl ?? MAX_HOPS,
    flags: opts?.flags ?? 0x01,
    timestamp: opts?.timestamp ?? Date.now(),
    nonce: generateNonce(),
    payload,
  };
}

function encode(packet) {
  const payloadLen = packet.payload.length;
  const totalSize = HEADER_SIZE_REAL + payloadLen;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  view.setUint32(0, MESH_MAGIC, false);

  const targetRecipient = (!packet.recipient || packet.recipient.toLowerCase() === 'broadcast' || packet.recipient === '*')
    ? BROADCAST_RECIPIENT
    : packet.recipient;
  const recipientBytes = hexToBytes(targetRecipient.slice(0, 64).padEnd(64, '0'));
  u8.set(recipientBytes, 4);

  const targetSender = packet.sender?.startsWith('did:red:') ? packet.sender.slice(8) : (packet.sender || '');
  const senderBytes = hexToBytes(targetSender.slice(0, 64).padEnd(64, '0'));
  u8.set(senderBytes, 36);

  view.setUint8(68, packet.ttl & 0xFF);
  view.setUint8(69, packet.flags & 0xFF);
  view.setUint16(70, Math.min(payloadLen, 0xFFFF), true);

  const ts = packet.timestamp;
  view.setUint32(72, ts >>> 0, true);
  view.setUint32(76, Math.floor(ts / 0x100000000) & 0xFFFFFFFF, true);

  const nonceBytes = hexToBytes(packet.nonce.slice(0, 32).padEnd(32, '0'));
  u8.set(nonceBytes, 80);
  u8.set(packet.payload, HEADER_SIZE_REAL);

  return u8;
}

function decode(data) {
  if (data.length < HEADER_SIZE_REAL) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, false) !== MESH_MAGIC) return null;

  const recipient = bytesToHex(data.subarray(4, 36));
  const sender = bytesToHex(data.subarray(36, 68));
  const ttl = view.getUint8(68);
  const flags = view.getUint8(69);
  const payloadLen = view.getUint16(70, true);
  const tsLow = view.getUint32(72, true);
  const tsHigh = view.getUint32(76, true);
  const timestamp = tsLow + tsHigh * 0x100000000;
  const nonce = bytesToHex(data.subarray(80, 96));
  const payload = data.slice(HEADER_SIZE_REAL, HEADER_SIZE_REAL + payloadLen);

  return { recipient, sender, ttl, flags, timestamp, nonce, payload };
}

// ─── 2. SIMULACIÓN DE MeshRouter Delivery ──────────────────────────────────────
class MockMeshRouter {
  constructor(myIdentityHash) {
    this.myIdentityHash = myIdentityHash;
    this.localDeliveryHandlers = new Set();
  }

  onLocalDelivery(handler) {
    this.localDeliveryHandlers.add(handler);
    return () => this.localDeliveryHandlers.delete(handler);
  }

  handleRawPacket(raw) {
    const packet = decode(raw);
    if (!packet) return false;

    const isBroadcast =
      packet.recipient === 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' ||
      packet.recipient === '0000000000000000000000000000000000000000000000000000000000000000' ||
      packet.recipient?.toLowerCase() === 'broadcast';

    const isDirectlyToMe =
      (!!this.myIdentityHash && packet.recipient === this.myIdentityHash) ||
      (!!this.myIdentityHash && packet.recipient.length >= 8 && this.myIdentityHash.toLowerCase().startsWith(packet.recipient.toLowerCase()));

    const isForMe = isBroadcast || isDirectlyToMe;

    if (isForMe) {
      this.localDeliveryHandlers.forEach(h => {
        try { h(packet); } catch (e) { console.error('Handler error:', e); }
      });
      return true;
    }
    return false;
  }
}

// ─── 3. PRUEBAS DE SUITE ───────────────────────────────────────────────────────

console.log('🚀 Iniciando Suite de Pruebas: Sovereign dApp & Broadcast Resilience...');

// Test 1: createPacket normaliza 'broadcast' a BROADCAST_RECIPIENT
const payloadBytes = new TextEncoder().encode(JSON.stringify({ type: 'MINIAPP_MANIFEST', appId: 'app.test' }));
const packet1 = createPacket('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'broadcast', payloadBytes);
assert.strictEqual(packet1.recipient, BROADCAST_RECIPIENT, 'createPacket debe normalizar "broadcast" a BROADCAST_RECIPIENT');
console.log('  ✅ Test 1: createPacket("broadcast") normaliza a 64 "f"s');

// Test 2: encode serializa recipient como 32 bytes de 0xFF (no mutila a badca00...)
const wireBytes = encode(packet1);
const recipientWireSlice = wireBytes.slice(4, 36);
assert.strictEqual(recipientWireSlice.length, 32, 'Wire header recipient debe ser de 32 bytes');
assert(recipientWireSlice.every(b => b === 0xFF), 'Todos los 32 bytes del recipient deben ser 0xFF');
console.log('  ✅ Test 2: Wire encoding contiene 32 bytes de 0xFF (sin mutilación a "badca00...")');

// Test 3: decode extrae el recipient intacto como 64 "f"s
const decodedPacket = decode(wireBytes);
assert(decodedPacket !== null, 'Packet debe decodificarse exitosamente');
assert.strictEqual(decodedPacket.recipient, BROADCAST_RECIPIENT, 'Recipient decodificado debe ser BROADCAST_RECIPIENT');
console.log('  ✅ Test 3: decode reconstruye BROADCAST_RECIPIENT canónico');

// Test 4: encode tolera paquete manual con recipient = 'broadcast' directamente
const manualPacket = {
  sender: 'did:red:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  recipient: 'broadcast',
  ttl: 15,
  flags: 0x01,
  timestamp: Date.now(),
  nonce: generateNonce(),
  payload: payloadBytes
};
const wireManual = encode(manualPacket);
const decodedManual = decode(wireManual);
assert.strictEqual(decodedManual.recipient, BROADCAST_RECIPIENT, 'encode debe forzar BROADCAST_RECIPIENT si recibe "broadcast"');
console.log('  ✅ Test 4: encode normaliza defensivamente packet.recipient = "broadcast"');

// Test 5: MeshRouter entrega el paquete broadcast localmente
const receiverNodeHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const router = new MockMeshRouter(receiverNodeHash);

let deliveredPacket = null;
router.onLocalDelivery((pkt) => {
  deliveredPacket = pkt;
});

const deliverySuccess = router.handleRawPacket(wireBytes);
assert.strictEqual(deliverySuccess, true, 'router.handleRawPacket debe entregar paquetes broadcast');
assert(deliveredPacket !== null, 'Handler registrado debe haber recibido el paquete');
assert.strictEqual(deliveredPacket.recipient, BROADCAST_RECIPIENT);
console.log('  ✅ Test 5: MeshRouter.handleRawPacket entrega paquete broadcast a localDeliveryHandlers');

// Test 6: SovereignAppStoreModal - Ingesta de MINIAPP_PACKAGE_BROADCAST y actualización de manifest a bundle instalable
let discoveredApps = [];
const appStoreUnsub = router.onLocalDelivery((pkt) => {
  const str = new TextDecoder().decode(pkt.payload);
  if (!str.startsWith('{')) return;
  const data = JSON.parse(str);
  if ((data.type === 'MINIAPP_PACKAGE_BROADCAST' || data.type === 'MINIAPP_MANIFEST') && data.manifest && data.appId) {
    const existingIdx = discoveredApps.findIndex(a => a.appId === data.appId);
    const newEntry = {
      appId: data.appId,
      manifest: data.manifest,
      pkg: data.pkg || (existingIdx >= 0 ? discoveredApps[existingIdx].pkg : null),
      authorDid: data.authorDid || pkt.sender,
      timestamp: data.timestamp || Date.now()
    };
    if (existingIdx >= 0) {
      discoveredApps[existingIdx] = newEntry;
    } else {
      discoveredApps.unshift(newEntry);
    }
  }
});

// Paso 6.1: Enviar primero un MINIAPP_MANIFEST (sin pkg)
const manifestEnvelope = {
  type: 'MINIAPP_MANIFEST',
  appId: 'org.redmesh.tacticalchat',
  manifest: { id: 'org.redmesh.tacticalchat', name: 'Tactical Chat', version: '1.0.0' },
  timestamp: Date.now()
};
const manifestWire = encode(createPacket('sender1', 'broadcast', new TextEncoder().encode(JSON.stringify(manifestEnvelope))));
router.handleRawPacket(manifestWire);

assert.strictEqual(discoveredApps.length, 1);
assert.strictEqual(discoveredApps[0].appId, 'org.redmesh.tacticalchat');
assert.strictEqual(discoveredApps[0].pkg, null);

// Paso 6.2: Enviar el paquete completo MINIAPP_PACKAGE_BROADCAST
const packageEnvelope = {
  type: 'MINIAPP_PACKAGE_BROADCAST',
  appId: 'org.redmesh.tacticalchat',
  manifest: { id: 'org.redmesh.tacticalchat', name: 'Tactical Chat', version: '1.0.0' },
  pkg: 'RED_APP_V1:eyJpZCI6Im9yZy5yZWRtZXNoLnRhY3RpY2FsY2hhdCJ9...',
  authorDid: 'did:red:author123',
  timestamp: Date.now()
};
const packageWire = encode(createPacket('sender1', 'broadcast', new TextEncoder().encode(JSON.stringify(packageEnvelope))));
router.handleRawPacket(packageWire);

assert.strictEqual(discoveredApps.length, 1, 'No debe duplicar entradas para el mismo appId');
assert(discoveredApps[0].pkg !== null, 'Debe haber actualizado la entrada con el paquete firmado ejecutable');
assert.strictEqual(discoveredApps[0].pkg, packageEnvelope.pkg);
console.log('  ✅ Test 6: SovereignAppStoreModal actualiza pkg y permite instalación inmediata');

// Test 7: MeshGatewayEngine - Ingesta de PROXY_REQUEST y emisión de PROXY_RESPONSE vía onLocalDelivery
let gatewayProcessedRequest = null;
let clientReceivedResponse = null;

// Mock Gateway Node
const gatewayUnsub = router.onLocalDelivery((pkt) => {
  const str = new TextDecoder().decode(pkt.payload);
  if (!str.startsWith('{')) return;
  const data = JSON.parse(str);
  if (data.type === 'PROXY_REQUEST') {
    gatewayProcessedRequest = data;
  }
  if (data.type === 'PROXY_RESPONSE') {
    clientReceivedResponse = data;
  }
});

const proxyReqEnvelope = {
  type: 'PROXY_REQUEST',
  requestId: 'req_12345',
  url: 'https://emergency.redmesh.local/status',
  method: 'GET',
  originDid: 'did:red:client_node',
  timestamp: Date.now()
};
const proxyWire = encode(createPacket('client_node', 'broadcast', new TextEncoder().encode(JSON.stringify(proxyReqEnvelope))));
router.handleRawPacket(proxyWire);

assert(gatewayProcessedRequest !== null, 'Gateway Node debió recibir el PROXY_REQUEST vía onLocalDelivery');
assert.strictEqual(gatewayProcessedRequest.requestId, 'req_12345');

const proxyRespEnvelope = {
  type: 'PROXY_RESPONSE',
  requestId: 'req_12345',
  url: 'https://emergency.redmesh.local/status',
  status: 200,
  statusText: 'OK',
  headers: {},
  compressedBody: 'H4sIAAAAAAAAA...',
  gatewayDid: 'did:red:gateway_node',
  latencyMs: 42,
  timestamp: Date.now()
};
const proxyRespWire = encode(createPacket('gateway_node', receiverNodeHash, new TextEncoder().encode(JSON.stringify(proxyRespEnvelope))));
router.handleRawPacket(proxyRespWire);

assert(clientReceivedResponse !== null, 'Client Node debió recibir el PROXY_RESPONSE');
assert.strictEqual(clientReceivedResponse.status, 200);
console.log('  ✅ Test 7: MeshGatewayEngine procesa PROXY_REQUEST y PROXY_RESPONSE mediante onLocalDelivery');

// Limpieza
appStoreUnsub();
gatewayUnsub();

console.log('\n🎉 TODOS LOS 7 TESTS DE BROADCAST & DAPP DISCOVERY PASARON EXITOSAMENTE!');

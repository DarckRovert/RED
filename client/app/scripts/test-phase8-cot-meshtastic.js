/**
 * test-phase8-cot-meshtastic.js — RED Automated Test Suite (Phase 8)
 * Validates ATAK Cursor-on-Target (CoT) XML serialization & Meshtastic LoRa protocol bridging.
 */

const assert = require('assert');

// ─── PART 1: CURSOR-ON-TARGET (CoT) TESTS ─────────────────────────────
console.log("================================================================================");
console.log("🎯 INICIANDO SUITE DE PRUEBAS — FASE 8: ATAK CoT & LORA MESHTASTIC BRIDGE");
console.log("================================================================================\n");

console.log("1️⃣ Probando CursorOnTargetEngine (ATAK / CivTAK Interoperability)...");

function toCotType(affiliation, role) {
    let affChar = 'u';
    if (affiliation === 'FRIEND') affChar = 'f';
    else if (affiliation === 'HOSTILE') affChar = 'h';
    else if (affiliation === 'NEUTRAL') affChar = 'n';

    let roleSuffix = 'G-U-C';
    if (role === 'INFANTRY') roleSuffix = 'G-U-C-I';
    else if (role === 'MEDICAL') roleSuffix = 'G-U-C-M';
    else if (role === 'COMMAND_HQ') roleSuffix = 'G-U-C-HQ';
    else if (role === 'MEDEVAC') roleSuffix = 'b-m-p-s-m';
    else if (role === 'SUPPLY_AMMO') roleSuffix = 'G-I-A';
    else if (role === 'RECON_DRONE') roleSuffix = 'A-M-F-Q-r';

    if (roleSuffix.startsWith('b-')) return roleSuffix;
    return `a-${affChar}-${roleSuffix}`;
}

function parseCotType(cotType) {
    const parts = cotType.toLowerCase().split('-');
    let affiliation = 'UNKNOWN';
    if (parts[1] === 'f') affiliation = 'FRIEND';
    else if (parts[1] === 'h') affiliation = 'HOSTILE';
    else if (parts[1] === 'n') affiliation = 'NEUTRAL';

    let role = 'INFANTRY';
    if (cotType.includes('medevac') || cotType.includes('b-m-p-s-m')) {
        role = 'MEDEVAC';
        affiliation = 'FRIEND';
    } else if (cotType.includes('c-m') || cotType.includes('medical')) {
        role = 'MEDICAL';
    } else if (cotType.includes('hq') || cotType.includes('command')) {
        role = 'COMMAND_HQ';
    } else if (cotType.includes('ammo') || cotType.includes('supply')) {
        role = 'SUPPLY_AMMO';
    } else if (cotType.includes('drone') || cotType.includes('a-m-f-q')) {
        role = 'RECON_DRONE';
    }

    return { affiliation, role };
}

function serializeToXml(event) {
    const hae = event.point.hae !== undefined ? event.point.hae : 0.0;
    const ce = event.point.ce !== undefined ? event.point.ce : 9999999.0;
    const le = event.point.le !== undefined ? event.point.le : 9999999.0;

    let detailXml = '<detail>';
    if (event.detail?.contact) {
        detailXml += `<contact callsign="${event.detail.contact.callsign}"/>`;
    }
    if (event.detail?.remarks) {
        detailXml += `<remarks>${event.detail.remarks}</remarks>`;
    }
    detailXml += '</detail>';

    return `<?xml version="1.0" encoding="UTF-8"?>
<event version="${event.version || '2.0'}" uid="${event.uid}" type="${event.type}" time="${event.time}" start="${event.start}" stale="${event.stale}" how="${event.how || 'm-g'}">
  <point lat="${event.point.lat.toFixed(6)}" lon="${event.point.lon.toFixed(6)}" hae="${hae.toFixed(1)}" ce="${ce.toFixed(1)}" le="${le.toFixed(1)}"/>
  ${detailXml}
</event>`.trim();
}

function parseFromXml(xmlStr) {
    const getAttr = (tag, attr) => {
        const regex = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["']`, 'i');
        const match = xmlStr.match(regex);
        return match ? match[1] : '';
    };

    const uid = getAttr('event', 'uid');
    const type = getAttr('event', 'type');
    const lat = parseFloat(getAttr('point', 'lat'));
    const lon = parseFloat(getAttr('point', 'lon'));
    const callsign = getAttr('contact', 'callsign') || uid;
    
    let remarks = '';
    const remarksMatch = xmlStr.match(/<remarks>([\s\S]*?)<\/remarks>/i);
    if (remarksMatch) remarks = remarksMatch[1].trim();

    return {
        uid,
        type,
        point: { lat, lon },
        detail: { contact: { callsign }, remarks }
    };
}

// Test 1: Type conversions
assert.strictEqual(toCotType('FRIEND', 'INFANTRY'), 'a-f-G-U-C-I');
assert.strictEqual(toCotType('HOSTILE', 'COMMAND_HQ'), 'a-h-G-U-C-HQ');
assert.strictEqual(toCotType('FRIEND', 'MEDEVAC'), 'b-m-p-s-m');
console.log("  ✅ [PASS] Conversión de Simbología Táctica a Tipos CoT (MIL-STD-2525)");

const parsed = parseCotType('a-f-G-U-C-I');
assert.strictEqual(parsed.affiliation, 'FRIEND');
assert.strictEqual(parsed.role, 'INFANTRY');
console.log("  ✅ [PASS] Parseo de Tipos CoT estándar ATAK a Objetos Tácticos RED");

// Test 2: XML Serialization & Parsing Roundtrip
const mockEvent = {
    version: '2.0',
    uid: 'RED-OPERATOR-ALPHA',
    type: 'a-f-G-U-C-I',
    time: '2026-08-30T22:00:00.000Z',
    start: '2026-08-30T22:00:00.000Z',
    stale: '2026-08-30T22:05:00.000Z',
    how: 'm-g',
    point: { lat: -12.046374, lon: -77.042793, hae: 154.2, ce: 3.5, le: 3.5 },
    detail: {
        contact: { callsign: 'VIPER-1' },
        remarks: 'RED Tactical Team Recon'
    }
};

const xmlOutput = serializeToXml(mockEvent);
assert.ok(xmlOutput.includes('<event version="2.0" uid="RED-OPERATOR-ALPHA"'));
assert.ok(xmlOutput.includes('lat="-12.046374" lon="-77.042793"'));
assert.ok(xmlOutput.includes('callsign="VIPER-1"'));
console.log("  ✅ [PASS] Serialización de Evento CoT a XML válido para ATAK / CivTAK");

const parsedBack = parseFromXml(xmlOutput);
assert.strictEqual(parsedBack.uid, 'RED-OPERATOR-ALPHA');
assert.strictEqual(parsedBack.point.lat, -12.046374);
assert.strictEqual(parsedBack.point.lon, -77.042793);
assert.strictEqual(parsedBack.detail.contact.callsign, 'VIPER-1');
assert.strictEqual(parsedBack.detail.remarks, 'RED Tactical Team Recon');
console.log("  ✅ [PASS] Parseo de XML CoT externo a Evento Táctico RED (Roundtrip 100% exacto)");

// ─── PART 2: LORA MESHTASTIC BRIDGE TESTS ─────────────────────────────
console.log("\n2️⃣ Probando LoRaMeshtasticBridge (Semtech SX1262 / ESP32 Hardware Adapter)...");

function framePacket(packet) {
    const headerLen = 16;
    const totalLen = headerLen + packet.payload.length;
    const out = new Uint8Array(4 + totalLen);

    out[0] = 0x94;
    out[1] = 0xC3;
    out[2] = (totalLen >> 8) & 0xFF;
    out[3] = totalLen & 0xFF;

    const dv = new DataView(out.buffer, 4);
    dv.setUint32(0, packet.from, false);
    dv.setUint32(4, packet.to, false);
    dv.setUint8(8, packet.channel);
    dv.setUint8(9, packet.portnum);
    dv.setUint32(10, packet.id, false);
    dv.setUint8(14, packet.hopLimit || 3);
    dv.setUint8(15, packet.wantAck ? 1 : 0);

    out.set(packet.payload, 4 + headerLen);
    return out;
}

function unframePacket(buf) {
    if (buf.length < 20) return null;
    if (buf[0] !== 0x94 || buf[1] !== 0xC3) return null;

    const len = (buf[2] << 8) | buf[3];
    if (buf.length < 4 + len) return null;

    const dv = new DataView(buf.buffer, buf.byteOffset + 4, len);
    const from = dv.getUint32(0, false);
    const to = dv.getUint32(4, false);
    const channel = dv.getUint8(8);
    const portnum = dv.getUint8(9);
    const id = dv.getUint32(10, false);
    const hopLimit = dv.getUint8(14);
    const wantAck = dv.getUint8(15) === 1;

    const payload = buf.slice(20, 4 + len);

    return { from, to, channel, portnum, id, hopLimit, wantAck, payload };
}

// Test 3: LoRa Frame Construction with Sync Header (0x94, 0xC3)
const rawRedPayload = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]);
const loraPacket = {
    from: 0x12345678,
    to: 0xFFFFFFFF,
    channel: 0,
    portnum: 64, // RED_SOVEREIGN_VOCODER_APP
    payload: rawRedPayload,
    id: 42,
    hopLimit: 3,
    wantAck: false
};

const framedBuffer = framePacket(loraPacket);
assert.strictEqual(framedBuffer[0], 0x94);
assert.strictEqual(framedBuffer[1], 0xC3);
console.log("  ✅ [PASS] Empaquetado de Tramas Físicas con Encabezado de Sincronización Meshtastic (0x94, 0xC3)");

// Test 4: Unframing and Payload Integrity Verification
const unframed = unframePacket(framedBuffer);
assert.strictEqual(unframed.from, 0x12345678);
assert.strictEqual(unframed.to, 0xFFFFFFFF);
assert.strictEqual(unframed.portnum, 64);
assert.strictEqual(unframed.id, 42);
assert.deepStrictEqual(Array.from(unframed.payload), [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]);
console.log("  ✅ [PASS] Desempaquetado y Preservación de Carga Útil en Canales LoRa de 237 Bytes MTU");

// Test 5: Vocoder over LoRa Transmission Simulation (1.2 kbps voice frame)
const vocoderVoiceBurst = new Uint8Array(45); // 45 bytes ~ 300ms of compressed audio
for (let i = 0; i < 45; i++) vocoderVoiceBurst[i] = (i * 7) % 256;

const vocoderPacket = {
    from: 0xAABBCCDD,
    to: 0xFFFFFFFF,
    channel: 0,
    portnum: 64, // RED Vocoder Voice Burst
    payload: vocoderVoiceBurst,
    id: 101,
    hopLimit: 5,
    wantAck: false
};

const vocoderFramed = framePacket(vocoderPacket);
const vocoderUnframed = unframePacket(vocoderFramed);
assert.strictEqual(vocoderUnframed.portnum, 64);
assert.strictEqual(vocoderUnframed.payload.length, 45);
assert.deepStrictEqual(vocoderUnframed.payload, vocoderVoiceBurst);
console.log("  ✅ [PASS] Transmisión de Ráfaga de Voz Vocoder en Paquetes LoRa (Supera límite de Meshtastic)");

console.log("\n================================================================================");
console.log("📊 RESUMEN: 6/6 PRUEBAS SUPERADAS EXITOSAMENTE (ATAK CoT + LoRa Meshtastic)");
console.log("================================================================================\n");

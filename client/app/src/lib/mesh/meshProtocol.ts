/**
 * RED Mesh Protocol — Binary packet format for multi-hop mesh networking.
 *
 * Every packet that traverses the RED mesh uses this wire format regardless
 * of the underlying transport (WiFi, BLE, LoRa). This allows any node to
 * forward any packet without needing to decrypt it.
 *
 * Packet structure (fixed 64-byte header + variable payload):
 *   [4  bytes] Magic:     0x52454401  ("RED\x01")
 *   [32 bytes] Recipient: identity_hash of the final destination
 *   [32 bytes] Sender:    identity_hash of the original sender
 *   [1  byte ] TTL:       remaining hops (starts at MAX_HOPS, decrements each relay)
 *   [1  byte ] Flags:     bit0=encrypted, bit1=ack_requested, bit2=is_relay
 *   [2  bytes] PayloadLen: length of encrypted payload in bytes
 *   [8  bytes] Timestamp:  unix ms (u64 LE) — used for dedup expiry window
 *   [16 bytes] Nonce:      random bytes for message deduplication
 *   ─── 64 bytes header ───
 *   [N  bytes] Payload:   serialized & encrypted Message (bincode + AES-GCM)
 */

export const MESH_MAGIC = 0x52454401;
/** True header size: 4+32+32+1+1+2+8+16 = 96 bytes */
export const HEADER_SIZE_REAL = 96;
export const MAX_HOPS = 20;    // maximum mesh relay hops

// Wire flags bitmask
export const FLAG_ENCRYPTED = 0x01;     // Payload is encrypted
export const FLAG_ACK_REQUESTED = 0x02; // Receiver should emit cryptographic DELIVERY_ACK
export const FLAG_IS_RELAY = 0x04;      // Packet has been relayed by intermediate node
export const FLAG_PHEROMONE = 0x10;     // Bit 4: Packet carries Swarm Pheromone envelope in payload/header
export const FLAG_PQC_ENCRYPTED = 0x20; // NIST FIPS 203 ML-KEM-768 + X25519 hybrid post-quantum encapsulation
export const FLAG_KURAMOTO_SYNC = 0x40; // Bit 6: Sincronización de Fase de Kuramoto para TDMA y Atractor
export const FLAG_AER_SPIKE = 0x80;     // Bit 7: Paquete de Micro-Espiga Neuromórfica AER (Address-Event Representation)
export const AER_MAGIC = 0xAE51;        // Magic de 2 bytes para tramas AER compactas (14-42 bytes)

/** Dominios Funcionales de Micro-Espigas Neuromórficas AER (Brain-Cog / Loihi) */
export enum AerDomainCode {
  CX_COMPASS_HEADING = 0x01,   // Brújula E-PG (azimut cuantizado [0..255])
  CBRN_RADIATION_ALERT = 0x02, // Alerta radiológica / química instantánea
  KURAMOTO_PHASE_PULSE = 0x03, // Pulso de oscilador biológico de Kuramoto
  VITAL_HEART_RATE_MARCH = 0x04, // Telemetría de choque / tono vagal MARCH
  EW_JAMMING_DETECTED = 0x05,  // Detección de perturbación de guerra electrónica
  METABOLIC_TORPOR_STATE = 0x06, // Estado neuroendocrino / ahorro torpor
  PHEROMONE_ALARM = 0x07,       // Alarma estigmérgica biológica de enjambre
  KINETIC_SHOCK_MANDOWN = 0x08, // Shock cinético / impacto / inmovilidad Man-Down
  ACOUSTIC_SONAR_CAVITY = 0x09, // Eco de cavidad acústica / obstáculo físico cercano
  SYNAPTIC_DELTA_WEIGHT = 0x0A  // Sincronización de conductancia Hebbiana inter-pares
}

export interface AerSpikeEvent {
  domain: number;   // 1 byte (AerDomainCode)
  neuronId: number; // 1 byte (canal o id local 0-255)
  value: number;    // 2 bytes (escalar int16 LE -32768..32767)
}

export interface AerSpikeFrame {
  senderShortId: number; // uint32 (4 bytes)
  seq: number;           // uint8 (1 byte)
  ttl: number;           // uint8 (1 byte)
  flags: number;         // uint8 (1 byte: 0x80)
  spikes: AerSpikeEvent[];
}

/** Envelope de Feromona de Enjambre (Swarm Pheromone) para propagación estigmérgica en malla */
export interface SwarmPheromoneEnvelope {
  type: 'ALARM' | 'TRAIL' | 'AGGREGATION';
  intensity: number;      // 0.0 - 1.0
  geohash?: string;       // 6-8 caracteres para poda espacial
  originPeerId: string;
  timestamp: number;
  notes?: string;
}

/** Payload de sincronización de fase de Kuramoto (1 byte de fase + metadatos) */
export interface KuramotoSyncPayload {
  type: 'KURAMOTO_PHASE_SYNC';
  phaseByte: number; // [0, 255] correspondiente a [0, 360) grados
  frequencyHz?: number;
  confidence: number;
  timestamp: number;
}

/** JSON packet type for out-of-band PQC key announcements broadcast over the mesh */
export const PQC_TYPE_KEY_ANNOUNCE = 'PQC_KEY_ANNOUNCEMENT';

import { LamportMeshClockEngine } from './LamportMeshClockEngine';

export interface MeshPacket {
  /** 32-byte recipient identity hash (hex) */
  recipient: string;
  /** 32-byte sender identity hash (hex) */
  sender: string;
  /** Remaining relay hops */
  ttl: number;
  /** Bit flags: 0x01=encrypted 0x02=ack_requested 0x04=is_relay 0x10=pheromone 0x20=pqc_encrypted */
  flags: number;
  /** Timestamp (unix ms) */
  timestamp: number;
  /** 16-byte dedup nonce (hex) */
  nonce: string;
  /** Encrypted payload bytes */
  payload: Uint8Array;
  /** Optional transient flag indicating verified PQC decapsulation */
  isPqcEncrypted?: boolean;
  /** Opcional: Sobre de feromona de enjambre estigmérgica */
  pheromone?: SwarmPheromoneEnvelope;
}

/**
 * Encode a MeshPacket into wire-format bytes.
 */
export function encode(packet: MeshPacket): Uint8Array {
  const payloadLen = packet.payload.length;
  const totalSize = HEADER_SIZE_REAL + payloadLen;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // Magic (4 bytes, offset 0)
  view.setUint32(0, MESH_MAGIC, false);

  // Recipient (32 bytes, offset 4)
  const recipientBytes = hexToBytes(packet.recipient.slice(0, 64).padEnd(64, '0'));
  u8.set(recipientBytes, 4);

  // Sender (32 bytes, offset 36)
  const senderBytes = hexToBytes(packet.sender.slice(0, 64).padEnd(64, '0'));
  u8.set(senderBytes, 36);

  // TTL (1 byte, offset 68)
  view.setUint8(68, packet.ttl & 0xFF);

  // Flags (1 byte, offset 69)
  view.setUint8(69, packet.flags & 0xFF);

  // PayloadLen (2 bytes, offset 70, LE — capped at 0xFFFF for wire compatibility)
  view.setUint16(70, Math.min(payloadLen, 0xFFFF), true);

  // Timestamp (8 bytes, offset 72) — split into two u32 to avoid BigInt (ES2020 req.)
  const ts = packet.timestamp; // unix ms — safe as number for dates until year 2255
  const tsLow = ts >>> 0;                     // lower 32 bits
  const tsHigh = Math.floor(ts / 0x100000000) & 0xFFFFFFFF; // upper 32 bits
  view.setUint32(72, tsLow, true);
  view.setUint32(76, tsHigh, true);

  // Nonce (16 bytes, offset 80)
  const nonceBytes = hexToBytes(packet.nonce.slice(0, 32).padEnd(32, '0'));
  u8.set(nonceBytes, 80);

  // Payload (offset 96)
  u8.set(packet.payload, HEADER_SIZE_REAL);

  return u8;
}



/**
 * Decode wire-format bytes into a MeshPacket.
 * Returns null if magic doesn't match or packet is malformed.
 */
export function decode(data: Uint8Array): MeshPacket | null {
  if (data.length < HEADER_SIZE_REAL) return null;

  let offset = 0;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let magic = view.getUint32(0, false);
  if (magic !== MESH_MAGIC) {
    if (data.length >= HEADER_SIZE_REAL + 4 && view.getUint32(4, false) === MESH_MAGIC) {
      offset = 4;
      magic = MESH_MAGIC;
    } else {
      return null;
    }
  }

  const recipient = bytesToHex(data.subarray(offset + 4, offset + 36));
  const sender = bytesToHex(data.subarray(offset + 36, offset + 68));
  const ttl = view.getUint8(offset + 68);
  const flags = view.getUint8(offset + 69);
  const payloadLen = view.getUint16(offset + 70, true);
  const tsLow = view.getUint32(offset + 72, true);
  const tsHigh = view.getUint32(offset + 76, true);
  const timestamp = tsLow + tsHigh * 0x100000000;
  const nonce = bytesToHex(data.subarray(offset + 80, offset + 96));
  
  const headerEnd = offset + HEADER_SIZE_REAL;
  const actualRemaining = data.length - headerEnd;

  let payload: Uint8Array;
  if (payloadLen === 0xFFFF) {
    // Extended payload: take all remaining bytes in wire buffer
    payload = data.slice(headerEnd);
  } else {
    // If wire buffer is truncated before full payload arrived, reject incomplete packet
    if (actualRemaining < payloadLen) {
      return null;
    }
    // Extract exact payload bytes without trailing transport padding/garbage
    payload = data.slice(headerEnd, headerEnd + payloadLen);
  }

  return { recipient, sender, ttl, flags, timestamp, nonce, payload };
}

/**
 * Decrement TTL. Returns null if the packet should be dropped (TTL exhausted).
 */
export function relay(packet: MeshPacket): MeshPacket | null {
  if (packet.ttl === 0) return null;
  return { ...packet, ttl: packet.ttl - 1, flags: packet.flags | 0x04 };
}

/** Generate a 16-byte random nonce as hex */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/** Build a new MeshPacket ready to send */
export function createPacket(
  sender: string,
  recipient: string,
  payload: Uint8Array,
  opts?: { ttl?: number; flags?: number; timestamp?: number }
): MeshPacket {
  let packetTimestamp = opts?.timestamp;
  if (!packetTimestamp) {
    try {
      packetTimestamp = LamportMeshClockEngine.getInstance().getConsensusTime();
    } catch {
      packetTimestamp = Date.now();
    }
  }

  return {
    sender,
    recipient,
    ttl: opts?.ttl ?? MAX_HOPS,
    flags: opts?.flags ?? 0x01, // encrypted by default
    timestamp: packetTimestamp,
    nonce: generateNonce(),
    payload,
  };
}

/**
 * Codifica una trama de micro-espigas AER ultra-compacta para LoRa / BLE.
 * Tamaño base con 1 espiga: 2 (Magic) + 4 (ShortID) + 1 (Seq) + 1 (TTL) + 1 (Flags) + 1 (Count) + 4 (Spike) = 14 bytes.
 */
export function encodeAerSpikeFrame(
  senderShortId: number,
  seq: number,
  ttl: number,
  spikes: AerSpikeEvent[]
): Uint8Array {
  const safeCount = Math.max(1, Math.min(spikes.length, 16));
  const totalSize = 10 + (safeCount * 4);
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  // Magic 2 bytes (0xAE51)
  view.setUint16(0, AER_MAGIC, false);
  // Sender Short ID (4 bytes, LE)
  view.setUint32(2, (senderShortId >>> 0), true);
  // Sequence counter (1 byte)
  view.setUint8(6, seq & 0xFF);
  // TTL (1 byte)
  view.setUint8(7, Math.max(1, Math.min(20, ttl)) & 0xFF);
  // Flags (1 byte, 0x80)
  view.setUint8(8, FLAG_AER_SPIKE);
  // Spikes Count (1 byte)
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

/**
 * Decodifica una trama AER ultra-compacta o retorna null si es inválida o corrupta.
 */
export function decodeAerSpikeFrame(data: Uint8Array): AerSpikeFrame | null {
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

  const spikes: AerSpikeEvent[] = [];
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

// ─── Utilities ────────────────────────────────────────────────────────────────

export const HEX_LUT: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += HEX_LUT[bytes[i]];
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  const len = clean.length >>> 1;
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return result;
}

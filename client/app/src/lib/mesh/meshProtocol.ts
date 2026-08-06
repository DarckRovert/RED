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

export interface MeshPacket {
  /** 32-byte recipient identity hash (hex) */
  recipient: string;
  /** 32-byte sender identity hash (hex) */
  sender: string;
  /** Remaining relay hops */
  ttl: number;
  /** Bit flags: 0x01=encrypted 0x02=ack_requested 0x04=is_relay */
  flags: number;
  /** Timestamp (unix ms) */
  timestamp: number;
  /** 16-byte dedup nonce (hex) */
  nonce: string;
  /** Encrypted payload bytes */
  payload: Uint8Array;
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

  // PayloadLen (2 bytes, offset 70, LE)
  view.setUint16(70, payloadLen, true);

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

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const magic = view.getUint32(0, false);
  if (magic !== MESH_MAGIC) return null;

  const recipient = bytesToHex(data.slice(4, 36));
  const sender = bytesToHex(data.slice(36, 68));
  const ttl = view.getUint8(68);
  const flags = view.getUint8(69);
  const payloadLen = view.getUint16(70, true);
  const tsLow = view.getUint32(72, true);
  const tsHigh = view.getUint32(76, true);
  const timestamp = tsLow + tsHigh * 0x100000000;
  const nonce = bytesToHex(data.slice(80, 96));
  const payload = data.slice(HEADER_SIZE_REAL, HEADER_SIZE_REAL + payloadLen);

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
  opts?: { ttl?: number; flags?: number }
): MeshPacket {
  return {
    sender,
    recipient,
    ttl: opts?.ttl ?? MAX_HOPS,
    flags: opts?.flags ?? 0x01, // encrypted by default
    timestamp: Date.now(),
    nonce: generateNonce(),
    payload,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  const len = Math.floor(clean.length / 2);
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return result;
}
